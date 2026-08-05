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
  const item = TEAM_ROLES.find(
    (option) => option.value === role
  );

  if (role === "provider_admin") {
    return "Provider Admin";
  }

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

  if (!clean(fullName)) {
    throw new Error(
      "Enter the team member's name."
    );
  }

  if (!normaliseEmail(email)) {
    throw new Error(
      "Enter the team member's email."
    );
  }

  if (
    !TEAM_ROLES.some(
      (item) => item.value === role
    )
  ) {
    throw new Error(
      "Select a valid team role."
    );
  }

  /*
   * Cancel any previous pending invitation
   * for the same organisation and email.
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
      .eq(
        "email",
        normaliseEmail(email)
      )
      .eq("status", "pending");

  if (cancelError) {
    throw new Error(
      cancelError.message ||
        "Unable to replace the previous invitation."
    );
  }

  const { data, error } = await supabase
    .from("organisation_invitations")
    .insert({
      organisation_id: organisationId,
      email: normaliseEmail(email),
      full_name: clean(fullName),
      role,
      invited_by: invitedBy,
    })
    .select()
    .single();

  if (error) {
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
  if (!invitationId) return;

  const { error } = await supabase
    .from("organisation_invitations")
    .update({
      status: "cancelled",
    })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) {
    throw new Error(
      error.message ||
        "Unable to cancel invitation."
    );
  }
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

  const { data, error } = await supabase
    .rpc("lookup_theraa_invitation", {
      invitation_token:
        invitationToken,
    });

  if (error) {
    throw new Error(
      error.message ||
        "Invitation could not be checked."
    );
  }

  const invitation = data?.[0] || null;

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

  if (
    new Date(invitation.expires_at).getTime() <
    Date.now()
  ) {
    throw new Error(
      "This invitation has expired."
    );
  }

  return invitation;
}

export function buildInvitationLink(token) {
  const url = new URL(
    window.location.origin
  );

  url.searchParams.set(
    "invite",
    token
  );

  return url.toString();
}