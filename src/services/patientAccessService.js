// src/services/patientAccessService.js
import { supabase } from "./supabaseClient";

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
      assignment?.permission_level ||
      (assignment ? "contributor" : "manager"),
  };
}

/**
 * Provider admins and managers may retrieve all participants in their
 * organisation. RLS verifies that they have permission.
 */
async function getOrganisationParticipants(organisationId) {
  const { data, error } = await supabase
    .from("participants")
    .select(`
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
    `)
    .eq("organisation_id", organisationId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Unable to load organisation participants:", error);
    throw new Error(
      error.message || "Unable to load organisation participants."
    );
  }

  return (data || []).map((row) => mapParticipant(row));
}

/**
 * Coordinators, workers, nurses and allied-health staff retrieve the
 * participants assigned to their user account.
 */
async function getAssignedParticipants({
  userId,
  organisationId,
}) {
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
      )
    `)
    .eq("user_id", userId)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Unable to load participant assignments:", error);
    throw new Error(
      error.message || "Unable to load assigned participants."
    );
  }

  return (data || [])
    .map((assignment) => {
      const participant = Array.isArray(assignment.participants)
        ? assignment.participants[0]
        : assignment.participants;

      return mapParticipant(participant, assignment);
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getParticipantsForWorkspace({
  userId,
  organisationId,
  role,
}) {
  if (!userId || !organisationId) {
    return [];
  }

  if (["provider_admin", "manager"].includes(role)) {
    return getOrganisationParticipants(organisationId);
  }

  return getAssignedParticipants({
    userId,
    organisationId,
  });
}

export async function getParticipantById({
  participantId,
  organisationId,
}) {
  if (!participantId || !organisationId) {
    return null;
  }

  const { data, error } = await supabase
    .from("participants")
    .select(`
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
    `)
    .eq("id", participantId)
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load participant:", error);
    throw new Error(error.message || "Unable to load participant.");
  }

  return mapParticipant(data);
}

export async function createParticipant({
  organisationId,
  userId,
  participant,
}) {
  if (!organisationId) {
    throw new Error("organisationId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!participant?.name?.trim()) {
    throw new Error("Participant name is required.");
  }

  const { data, error } = await supabase
    .from("participants")
    .insert({
      organisation_id: organisationId,
      name: participant.name.trim(),
      age: participant.age ? String(participant.age) : null,
      dob: participant.dob || null,
      gender: participant.gender || null,
      ndis_number: participant.ndisNumber || null,
      contact_number: participant.contactNumber || null,
      emergency_contact: participant.emergencyContact || null,
      address: participant.address || null,
      notes: participant.notes || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error("Unable to create participant:", error);
    throw new Error(error.message || "Unable to create participant.");
  }

  /*
   * Automatically assign the creator as participant manager.
   * Provider admins can already see all participants through organisation
   * membership, but this also establishes an explicit assignment.
   */
  const { error: assignmentError } = await supabase
    .from("participant_assignments")
    .insert({
      organisation_id: organisationId,
      participant_id: data.id,
      user_id: userId,
      permission_level: "manager",
      assigned_by: userId,
    });

  if (
    assignmentError &&
    assignmentError.code !== "23505"
  ) {
    console.error(
      "Participant created but creator assignment failed:",
      assignmentError
    );
  }

  return mapParticipant(data);
}

export async function assignUserToParticipant({
  organisationId,
  participantId,
  userId,
  assignedBy,
  permissionLevel = "contributor",
}) {
  const { data, error } = await supabase
    .from("participant_assignments")
    .upsert(
      {
        organisation_id: organisationId,
        participant_id: participantId,
        user_id: userId,
        permission_level: permissionLevel,
        assigned_by: assignedBy,
      },
      {
        onConflict: "participant_id,user_id",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Unable to assign participant access:", error);
    throw new Error(
      error.message || "Unable to assign participant access."
    );
  }

  return data;
}