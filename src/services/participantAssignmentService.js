// src/services/participantAssignmentService.js
import { supabase } from "./supabaseClient";

export const PARTICIPANT_PERMISSION_LEVELS = [
  {
    value: "viewer",
    label: "Viewer",
    description:
      "Read participant information only.",
  },
  {
    value: "contributor",
    label: "Contributor",
    description:
      "Read participant information and create support records.",
  },
  {
    value: "coordinator",
    label: "Coordinator",
    description:
      "Coordinate participant supports and planning.",
  },
  {
    value: "clinical",
    label: "Clinical",
    description:
      "Clinical or allied-health participant access.",
  },
  {
    value: "manager",
    label: "Manager",
    description:
      "Full participant management access.",
  },
];

function clean(value) {
  return String(value ?? "").trim();
}

export function getPermissionLabel(
  permission
) {
  const item =
    PARTICIPANT_PERMISSION_LEVELS.find(
      (option) =>
        option.value === permission
    );

  return item?.label || "Contributor";
}

export async function getOrganisationTeam(
  organisationId
) {
  if (!organisationId) {
    return [];
  }

  const { data, error } =
    await supabase.rpc(
      "get_organisation_team",
      {
        target_organisation_id:
          organisationId,
      }
    );

  if (error) {
    console.error(
      "Unable to load organisation team:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load organisation team."
    );
  }

  return (data || []).map(
    (member) => ({
      userId: member.user_id,
      fullName:
        member.full_name ||
        member.email ||
        "Team Member",
      email: member.email || "",
      role: member.role,
      status: member.status,
    })
  );
}

export async function listParticipantAssignments({
  participantId,
  organisationId,
}) {
  if (
    !participantId ||
    !organisationId
  ) {
    return [];
  }

  const { data, error } = await supabase
    .from("participant_assignments")
    .select(`
      id,
      organisation_id,
      participant_id,
      user_id,
      permission_level,
      assigned_by,
      created_at
    `)
    .eq(
      "participant_id",
      participantId
    )
    .eq(
      "organisation_id",
      organisationId
    )
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      error.message ||
        "Unable to load participant assignments."
    );
  }

  return data || [];
}

export async function assignParticipant({
  organisationId,
  participantId,
  teamMemberId,
  assignedBy,
  permissionLevel,
}) {
  if (
    !organisationId ||
    !participantId ||
    !teamMemberId
  ) {
    throw new Error(
      "Participant and team member are required."
    );
  }

  const validPermission =
    PARTICIPANT_PERMISSION_LEVELS.some(
      (item) =>
        item.value === permissionLevel
    );

  if (!validPermission) {
    throw new Error(
      "Select a valid permission level."
    );
  }

  const { data, error } = await supabase
    .from("participant_assignments")
    .upsert(
      {
        organisation_id:
          organisationId,

        participant_id:
          participantId,

        user_id:
          teamMemberId,

        permission_level:
          permissionLevel,

        assigned_by:
          assignedBy || null,
      },
      {
        onConflict:
          "participant_id,user_id",
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to assign team member."
    );
  }

  return data;
}

export async function updateParticipantAssignment({
  assignmentId,
  permissionLevel,
}) {
  if (!assignmentId) {
    throw new Error(
      "Assignment ID is required."
    );
  }

  const { data, error } = await supabase
    .from("participant_assignments")
    .update({
      permission_level:
        permissionLevel,
    })
    .eq("id", assignmentId)
    .select()
    .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to update assignment."
    );
  }

  return data;
}

export async function removeParticipantAssignment(
  assignmentId
) {
  if (!clean(assignmentId)) {
    throw new Error(
      "Assignment ID is required."
    );
  }

  const { error } = await supabase
    .from("participant_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) {
    throw new Error(
      error.message ||
        "Unable to remove participant access."
    );
  }
}