// src/services/sessionService.js
import { supabase } from "./supabaseClient";

const VALID_ZONES = [
  "therapy",
  "meds",
  "staff",
  "paramedic",
  "vpn",
  "general",
];

function clean(value) {
  return String(value ?? "").trim();
}

function ensureZone(zone) {
  const cleanedZone = clean(zone);

  if (!VALID_ZONES.includes(cleanedZone)) {
    throw new Error(
      `Invalid session zone: ${cleanedZone || "unknown"}`
    );
  }

  return cleanedZone;
}

/**
 * Convert a Supabase participant_sessions row
 * back into the structure the existing Theraa Nurse
 * V2 pages already understand.
 */
function mapSessionRow(row) {
  if (!row) return null;

  const sessionData =
    row.session_data &&
    typeof row.session_data === "object"
      ? row.session_data
      : {};

  return {
    ...sessionData,

    /*
     * The database UUID becomes the authoritative
     * session ID.
     */
    id: row.id,

    clientId: row.participant_id,
    participantId: row.participant_id,
    organisationId: row.organisation_id,

    zone: row.zone,

    createdBy: row.created_by,

    /*
     * Keep compatibility with existing V2 code,
     * which uses timestamp and createdAt.
     */
    timestamp:
      sessionData.timestamp ||
      row.created_at,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

/**
 * Load all shared sessions for one participant.
 *
 * RLS determines whether the signed-in user
 * is authorised to read the participant.
 */
export async function loadParticipantSessions({
  organisationId,
  participantId,
}) {
  if (!organisationId || !participantId) {
    return [];
  }

  const { data, error } = await supabase
    .from("participant_sessions")
    .select(`
      id,
      organisation_id,
      participant_id,
      zone,
      session_data,
      created_by,
      created_at,
      updated_at
    `)
    .eq(
      "organisation_id",
      organisationId
    )
    .eq(
      "participant_id",
      participantId
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Unable to load participant sessions:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load participant sessions."
    );
  }

  return (data || [])
    .map(mapSessionRow)
    .filter(Boolean);
}

/**
 * Load sessions for one participant and one zone.
 */
export async function loadSessionsByZone({
  organisationId,
  participantId,
  zone,
}) {
  if (
    !organisationId ||
    !participantId
  ) {
    return [];
  }

  const safeZone = ensureZone(zone);

  const { data, error } = await supabase
    .from("participant_sessions")
    .select(`
      id,
      organisation_id,
      participant_id,
      zone,
      session_data,
      created_by,
      created_at,
      updated_at
    `)
    .eq(
      "organisation_id",
      organisationId
    )
    .eq(
      "participant_id",
      participantId
    )
    .eq("zone", safeZone)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      `Unable to load ${safeZone} sessions:`,
      error
    );

    throw new Error(
      error.message ||
        "Unable to load participant sessions."
    );
  }

  return (data || [])
    .map(mapSessionRow)
    .filter(Boolean);
}

/**
 * Create a new shared participant session.
 *
 * The session belongs to:
 * organisation -> participant
 *
 * created_by records which authenticated staff
 * member actually wrote the entry.
 */
export async function createParticipantSession({
  organisationId,
  participantId,
  userId,
  zone,
  sessionData = {},
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  if (!participantId) {
    throw new Error(
      "Participant ID is required."
    );
  }

  if (!userId) {
    throw new Error(
      "Signed-in user ID is required."
    );
  }

  const safeZone = ensureZone(zone);

  /*
   * Do not keep the temporary browser ID inside
   * session_data. Supabase generates the real UUID.
   */
  const {
    id: _temporaryId,
    clientId: _clientId,
    participantId: _participantId,
    organisationId: _organisationId,
    createdBy: _createdBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...safeSessionData
  } = sessionData || {};

  const { data, error } = await supabase
    .from("participant_sessions")
    .insert({
      organisation_id:
        organisationId,

      participant_id:
        participantId,

      zone: safeZone,

      session_data: {
        ...safeSessionData,
        zone: safeZone,
      },

      created_by:
        userId,
    })
    .select(`
      id,
      organisation_id,
      participant_id,
      zone,
      session_data,
      created_by,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    console.error(
      "Unable to create participant session:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to save participant session."
    );
  }

  return mapSessionRow(data);
}

/**
 * Update an existing session.
 *
 * RLS allows:
 * - original author
 * - Provider Admin
 * - Manager
 */
export async function updateParticipantSession({
  sessionId,
  organisationId,
  sessionData,
}) {
  if (!sessionId) {
    throw new Error(
      "Session ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  const {
    id: _id,
    clientId: _clientId,
    participantId: _participantId,
    organisationId: _organisationId,
    createdBy: _createdBy,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...safeSessionData
  } = sessionData || {};

  const { data, error } = await supabase
    .from("participant_sessions")
    .update({
      session_data:
        safeSessionData,
    })
    .eq("id", sessionId)
    .eq(
      "organisation_id",
      organisationId
    )
    .select(`
      id,
      organisation_id,
      participant_id,
      zone,
      session_data,
      created_by,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    console.error(
      "Unable to update participant session:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to update participant session."
    );
  }

  return mapSessionRow(data);
}

/**
 * Delete one shared participant session.
 *
 * Your database RLS decides whether the user
 * is allowed to perform the deletion.
 */
export async function deleteParticipantSession({
  sessionId,
  organisationId,
}) {
  if (!sessionId) {
    throw new Error(
      "Session ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  const { error } = await supabase
    .from("participant_sessions")
    .delete()
    .eq("id", sessionId)
    .eq(
      "organisation_id",
      organisationId
    );

  if (error) {
    console.error(
      "Unable to delete participant session:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to delete participant session."
    );
  }

  return true;
}

/**
 * Convenience helper for pages that still expect
 * the old:
 *
 * {
 *   participantId: [sessions]
 * }
 *
 * object structure.
 */
export async function loadParticipantSessionMap({
  organisationId,
  participantId,
}) {
  if (
    !organisationId ||
    !participantId
  ) {
    return {};
  }

  const sessions =
    await loadParticipantSessions({
      organisationId,
      participantId,
    });

  return {
    [participantId]: sessions,
  };
}

/**
 * Convenience utility for future dashboards/reports.
 */
export function groupSessionsByZone(
  sessions = []
) {
  return (sessions || []).reduce(
    (groups, session) => {
      const zone =
        session?.zone || "general";

      if (!groups[zone]) {
        groups[zone] = [];
      }

      groups[zone].push(session);

      return groups;
    },
    {}
  );
}