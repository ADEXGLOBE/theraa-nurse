// src/services/teamService.js
import { supabase } from "./supabaseClient";

export const TEAM_ROLES = [
  {
    value: "manager",
    label: "Manager",
  },
  {
    value: "support_coordinator",
    label: "Support Coordinator",
  },
  {
    value: "support_worker",
    label: "Support Worker",
  },
  {
    value: "nurse",
    label: "Nurse",
  },
  {
    value: "allied_health",
    label: "Allied Health",
  },
  {
    value: "viewer",
    label: "Viewer",
  },
];

function clean(value) {
  return String(value ?? "").trim();
}

function normaliseEmail(value) {
  return clean(value).toLowerCase();
}

export function getTeamRoleLabel(role) {
  if (role === "provider_admin") {
    return "Provider Admin";
  }

  const item = TEAM_ROLES.find(
    (option) => option.value === role
  );

  return item?.label || "Workspace Member";
}

export async function listOrganisationMembers(
  organisationId
) {
  if (!organisationId) return [];

  const { data, error } = await supabase
    .from("organisation_members")
    .select(`
      id,
      organisation_id,
      user_id,
      role,
      status,
      created_at
    `)
    .eq("organisation_id", organisationId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Unable to load organisation members:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load team members."
    );
  }

  return data || [];
}

export async function listOrganisationInvitations(
  organisationId
) {
  if (!organisationId) return [];

  const { data, error } = await supabase
    .from("organisation_invitations")
    .select(`
      id,
      organisation_id,
      email,
      full_name,
      role,
      token,
      status,
      invited_by,
      accepted_by,
      created_at,
      expires_at,
      accepted_at
    `)
    .eq("organisation_id", organisationId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Unable to load organisation invitations:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load invitations."
    );
  }

  return data || [];
}

export async function createTeamInvitation({
  organisationId,
  invitedBy,
  fullName,
  email,
  role,
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  if (!invitedBy) {
    throw new Error(
      "Inviting user ID is required."
    );
  }

  const cleanedName = clean(fullName);

  if (!cleanedName) {
    throw new Error(
      "Enter the team member's name."
    );
  }

  const normalisedEmail =
    normaliseEmail(email);

  if (!normalisedEmail) {
    throw new Error(
      "Enter the team member's email."
    );
  }

  const validRole = TEAM_ROLES.some(
    (item) => item.value === role
  );

  if (!validRole) {
    throw new Error(
      "Select a valid team role."
    );
  }

  /*
   * Cancel any previous pending invitation
   * for the same organisation and email.
   *
   * This allows an admin to resend an invitation
   * without manually cleaning up the old pending record.
   */
  const { error: cancelError } =
    await supabase
      .from("organisation_invitations")
      .update({
        status: "cancelled",
      })
      .eq(
        "organisation_id",
        organisationId
      )
      .ilike(
        "email",
        normalisedEmail
      )
      .eq("status", "pending");

  if (cancelError) {
    console.error(
      "Unable to cancel previous invitation:",
      cancelError
    );

    throw new Error(
      cancelError.message ||
        "Unable to replace the existing invitation."
    );
  }

  const { data, error } = await supabase
    .from("organisation_invitations")
    .insert({
      organisation_id: organisationId,
      email: normalisedEmail,
      full_name: cleanedName,
      role,
      invited_by: invitedBy,
    })
    .select()
    .single();

  if (error) {
    console.error(
      "Unable to create team invitation:",
      error
    );

    if (error.code === "23505") {
      throw new Error(
        "A pending invitation already exists for this email. Cancel it or copy the existing invitation link."
      );
    }

    throw new Error(
      error.message ||
        "Unable to create invitation."
    );
  }

  return data;
}

export async function cancelTeamInvitation(
  invitationId
) {
  if (!invitationId) {
    throw new Error(
      "Invitation ID is required."
    );
  }

  const { data, error } = await supabase
    .from("organisation_invitations")
    .update({
      status: "cancelled",
    })
    .eq("id", invitationId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) {
    console.error(
      "Unable to cancel invitation:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to cancel invitation."
    );
  }

  if (!data) {
    throw new Error(
      "This invitation is no longer pending or could not be found."
    );
  }

  return data;
}

export async function lookupInvitation(
  token
) {
  const invitationToken = clean(token);

  if (!invitationToken) {
    throw new Error(
      "Enter an invitation code."
    );
  }

  const { data, error } = await supabase.rpc(
    "lookup_theraa_invitation",
    {
      invitation_token:
        invitationToken,
    }
  );

  if (error) {
    console.error(
      "Unable to look up invitation:",
      error
    );

    throw new Error(
      error.message ||
        "Invitation could not be checked."
    );
  }

  const invitation =
    data?.[0] || null;

  if (!invitation) {
    throw new Error(
      "Invitation was not found."
    );
  }

  if (
    invitation.invitation_status !==
    "pending"
  ) {
    throw new Error(
      "This invitation is no longer active."
    );
  }

  const expiresAt = new Date(
    invitation.expires_at
  ).getTime();

  if (
    Number.isFinite(expiresAt) &&
    expiresAt < Date.now()
  ) {
    throw new Error(
      "This invitation has expired."
    );
  }

  return invitation;
}

export function buildInvitationLink(
  token
) {
  const invitationToken = clean(token);

  if (!invitationToken) {
    throw new Error(
      "Invitation token is required."
    );
  }

  const url = new URL(
    window.location.origin
  );

  url.searchParams.set(
    "invite",
    invitationToken
  );

  return url.toString();
}