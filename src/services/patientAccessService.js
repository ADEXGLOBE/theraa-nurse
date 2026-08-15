// src/services/patientAccessService.js
import { supabase } from "./supabaseClient";

function clean(value) {
  return String(value ?? "").trim();
}

function mapParticipant(row, assignment = null) {
  if (!row) return null;

  return {
    id: row.id,
    organisationId: row.organisation_id,

    name: row.name || "Unnamed Participant",
    age: row.age || "",
    dob: row.dob || "",
    gender: row.gender || "",
    ndisNumber: row.ndis_number || "",
    contactNumber: row.contact_number || "",
    emergencyContact: row.emergency_contact || "",
    address: row.address || "",
    notes: row.notes || "",

    createdBy: row.created_by || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",

    assignmentId: assignment?.id || "",
    permissionLevel:
      assignment?.permission_level || "",
  };
}

const PARTICIPANT_FIELDS = `
  id,
  organisation_id,
  name,
  age,
  dob,
  gender,
  ndis_number,
  contact_number,
  emergency_contact,
  address,
  notes,
  created_by,
  created_at,
  updated_at
`;

export async function getOrganisationParticipants(
  organisationId
) {
  if (!organisationId) return [];

  const { data, error } = await supabase
    .from("participants")
    .select(PARTICIPANT_FIELDS)
    .eq("organisation_id", organisationId)
    .order("name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Unable to load organisation participants:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load organisation participants."
    );
  }

  return (data || []).map((row) =>
    mapParticipant(row)
  );
}

export async function getAssignedParticipants({
  userId,
  organisationId,
}) {
  if (!userId || !organisationId) {
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
      created_at,

      participants!participant_assignments_participant_id_fkey (
        ${PARTICIPANT_FIELDS}
      )
    `)
    .eq("user_id", userId)
    .eq("organisation_id", organisationId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Unable to load assigned participants:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load assigned participants."
    );
  }

  return (data || [])
    .map((assignment) => {
      const participant =
        Array.isArray(
          assignment.participants
        )
          ? assignment.participants[0]
          : assignment.participants;

      return mapParticipant(
        participant,
        assignment
      );
    })
    .filter(Boolean)
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    );
}

export async function getParticipantsForWorkspace({
  userId,
  organisationId,
  role,
}) {
  if (!userId || !organisationId) {
    return [];
  }

  /*
   * Provider Admin and Manager can see every
   * participant belonging to the organisation.
   */
  if (
    ["provider_admin", "manager"].includes(
      role
    )
  ) {
    return getOrganisationParticipants(
      organisationId
    );
  }

  /*
   * Coordinators, support workers, nurses,
   * allied health and viewers only see
   * explicit participant assignments.
   */
  return getAssignedParticipants({
    userId,
    organisationId,
  });
}

export async function getParticipantById({
  participantId,
  organisationId,
}) {
  if (
    !participantId ||
    !organisationId
  ) {
    return null;
  }

  const { data, error } = await supabase
    .from("participants")
    .select(PARTICIPANT_FIELDS)
    .eq("id", participantId)
    .eq(
      "organisation_id",
      organisationId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to load participant."
    );
  }

  return data
    ? mapParticipant(data)
    : null;
}

export async function createParticipant({
  organisationId,
  userId,
  participant,
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!clean(participant?.name)) {
    throw new Error(
      "Participant name is required."
    );
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      organisation_id:
        organisationId,

      name: clean(participant.name),

      age:
        clean(participant.age) ||
        null,

      dob:
        clean(participant.dob) ||
        null,

      gender:
        clean(participant.gender) ||
        null,

      ndis_number:
        clean(
          participant.ndisNumber
        ) || null,

      contact_number:
        clean(
          participant.contactNumber
        ) || null,

      emergency_contact:
        clean(
          participant.emergencyContact
        ) || null,

      address:
        clean(participant.address) ||
        null,

      notes:
        clean(participant.notes) ||
        null,

      created_by: userId,
    })
    .select(PARTICIPANT_FIELDS)
    .single();

  if (error) {
    console.error(
      "Unable to create participant:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to create participant."
    );
  }

  /*
   * Give the creator an explicit manager
   * assignment as well.
   */
  const { error: assignmentError } =
    await supabase
      .from("participant_assignments")
      .upsert(
        {
          organisation_id:
            organisationId,

          participant_id:
            data.id,

          user_id: userId,

          permission_level:
            "manager",

          assigned_by:
            userId,
        },
        {
          onConflict:
            "participant_id,user_id",
        }
      );

  if (assignmentError) {
    console.warn(
      "Participant created but creator assignment failed:",
      assignmentError
    );
  }

  return mapParticipant(data);
}

export async function updateParticipant({
  participantId,
  organisationId,
  participant,
}) {
  if (
    !participantId ||
    !organisationId
  ) {
    throw new Error(
      "Participant ID and organisation ID are required."
    );
  }

  if (!clean(participant?.name)) {
    throw new Error(
      "Participant name is required."
    );
  }

  const { data, error } = await supabase
    .from("participants")
    .update({
      name: clean(participant.name),

      age:
        clean(participant.age) ||
        null,

      dob:
        clean(participant.dob) ||
        null,

      gender:
        clean(participant.gender) ||
        null,

      ndis_number:
        clean(
          participant.ndisNumber
        ) || null,

      contact_number:
        clean(
          participant.contactNumber
        ) || null,

      emergency_contact:
        clean(
          participant.emergencyContact
        ) || null,

      address:
        clean(participant.address) ||
        null,

      notes:
        clean(participant.notes) ||
        null,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", participantId)
    .eq(
      "organisation_id",
      organisationId
    )
    .select(PARTICIPANT_FIELDS)
    .single();

  if (error) {
    console.error(
      "Unable to update participant:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to update participant."
    );
  }

  return mapParticipant(data);
}

export async function deleteParticipant({
  participantId,
  organisationId,
}) {
  if (
    !participantId ||
    !organisationId
  ) {
    throw new Error(
      "Participant ID and organisation ID are required."
    );
  }

  const { error } = await supabase
    .from("participants")
    .delete()
    .eq("id", participantId)
    .eq(
      "organisation_id",
      organisationId
    );

  if (error) {
    console.error(
      "Unable to delete participant:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to delete participant."
    );
  }
}

export async function assignUserToParticipant({
  organisationId,
  participantId,
  userId,
  assignedBy,
  permissionLevel = "contributor",
}) {
  if (
    !organisationId ||
    !participantId ||
    !userId
  ) {
    throw new Error(
      "Organisation, participant and team member are required."
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

        user_id: userId,

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
        "Unable to assign participant access."
    );
  }

  return data;
}