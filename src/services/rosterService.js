// src/services/rosterService.js

import { supabase } from "./supabaseClient";

const VALID_STATUSES = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

function clean(value) {
  return String(value ?? "").trim();
}

function mapRosterRow(row) {
  if (!row) return null;

  return {
    id: row.id,

    organisationId:
      row.organisation_id,

    participantId:
      row.participant_id,

    staffUserId:
      row.staff_user_id,

    serviceType:
      row.service_type,

    shiftDate:
      row.shift_date,

    startTime:
      row.start_time,

    endTime:
      row.end_time,

    location:
      row.location || "",

    notes:
      row.notes || "",

    status:
      row.status,

    createdBy:
      row.created_by,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


/* =========================================================
   LIST ROSTER SHIFTS
========================================================= */

export async function listRosterShifts({
  organisationId,
  startDate = null,
  endDate = null,
  staffUserId = null,
  participantId = null,
} = {}) {
  if (!organisationId) {
    return [];
  }

  let query = supabase
    .from("roster_shifts")
    .select(`
      id,
      organisation_id,
      participant_id,
      staff_user_id,
      service_type,
      shift_date,
      start_time,
      end_time,
      location,
      notes,
      status,
      created_by,
      created_at,
      updated_at
    `)
    .eq(
      "organisation_id",
      organisationId
    );

  if (startDate) {
    query =
      query.gte(
        "shift_date",
        startDate
      );
  }

  if (endDate) {
    query =
      query.lte(
        "shift_date",
        endDate
      );
  }

  if (staffUserId) {
    query =
      query.eq(
        "staff_user_id",
        staffUserId
      );
  }

  if (participantId) {
    query =
      query.eq(
        "participant_id",
        participantId
      );
  }

  const {
    data,
    error,
  } = await query
    .order(
      "shift_date",
      {
        ascending: true,
      }
    )
    .order(
      "start_time",
      {
        ascending: true,
      }
    );

  if (error) {
    console.error(
      "Unable to load roster shifts:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load roster shifts."
    );
  }

  return (
    data || []
  )
    .map(mapRosterRow)
    .filter(Boolean);
}


/* =========================================================
   CREATE SHIFT
========================================================= */

export async function createRosterShift({
  organisationId,
  participantId = null,
  staffUserId = null,
  serviceType,
  shiftDate,
  startTime,
  endTime,
  location = "",
  notes = "",
  status = "scheduled",
  createdBy,
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  if (!createdBy) {
    throw new Error(
      "Signed-in user ID is required."
    );
  }

  if (!clean(serviceType)) {
    throw new Error(
      "Service type is required."
    );
  }

  if (!shiftDate) {
    throw new Error(
      "Shift date is required."
    );
  }

  if (!startTime) {
    throw new Error(
      "Start time is required."
    );
  }

  if (!endTime) {
    throw new Error(
      "End time is required."
    );
  }

  if (
    !VALID_STATUSES.includes(
      status
    )
  ) {
    throw new Error(
      "Invalid roster status."
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("roster_shifts")
    .insert({
      organisation_id:
        organisationId,

      participant_id:
        participantId || null,

      staff_user_id:
        staffUserId || null,

      service_type:
        clean(serviceType),

      shift_date:
        shiftDate,

      start_time:
        startTime,

      end_time:
        endTime,

      location:
        clean(location),

      notes:
        clean(notes),

      status,

      created_by:
        createdBy,
    })
    .select(`
      id,
      organisation_id,
      participant_id,
      staff_user_id,
      service_type,
      shift_date,
      start_time,
      end_time,
      location,
      notes,
      status,
      created_by,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    console.error(
      "Unable to create roster shift:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to create roster shift."
    );
  }

  return mapRosterRow(
    data
  );
}


/* =========================================================
   UPDATE SHIFT
========================================================= */

export async function updateRosterShift({
  shiftId,
  organisationId,
  changes = {},
}) {
  if (!shiftId) {
    throw new Error(
      "Shift ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  const payload = {};

  if (
    "participantId" in changes
  ) {
    payload.participant_id =
      changes.participantId || null;
  }

  if (
    "staffUserId" in changes
  ) {
    payload.staff_user_id =
      changes.staffUserId || null;
  }

  if (
    "serviceType" in changes
  ) {
    payload.service_type =
      clean(
        changes.serviceType
      );
  }

  if (
    "shiftDate" in changes
  ) {
    payload.shift_date =
      changes.shiftDate;
  }

  if (
    "startTime" in changes
  ) {
    payload.start_time =
      changes.startTime;
  }

  if (
    "endTime" in changes
  ) {
    payload.end_time =
      changes.endTime;
  }

  if (
    "location" in changes
  ) {
    payload.location =
      clean(
        changes.location
      );
  }

  if (
    "notes" in changes
  ) {
    payload.notes =
      clean(
        changes.notes
      );
  }

  if (
    "status" in changes
  ) {
    if (
      !VALID_STATUSES.includes(
        changes.status
      )
    ) {
      throw new Error(
        "Invalid roster status."
      );
    }

    payload.status =
      changes.status;
  }

  const {
    data,
    error,
  } = await supabase
    .from("roster_shifts")
    .update(payload)
    .eq(
      "id",
      shiftId
    )
    .eq(
      "organisation_id",
      organisationId
    )
    .select(`
      id,
      organisation_id,
      participant_id,
      staff_user_id,
      service_type,
      shift_date,
      start_time,
      end_time,
      location,
      notes,
      status,
      created_by,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    console.error(
      "Unable to update roster shift:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to update roster shift."
    );
  }

  return mapRosterRow(
    data
  );
}


/* =========================================================
   UPDATE STATUS ONLY
========================================================= */

export async function updateRosterShiftStatus({
  shiftId,
  organisationId,
  status,
}) {
  if (
    !VALID_STATUSES.includes(
      status
    )
  ) {
    throw new Error(
      "Invalid roster status."
    );
  }

  return updateRosterShift({
    shiftId,
    organisationId,
    changes: {
      status,
    },
  });
}


/* =========================================================
   DELETE SHIFT
========================================================= */

export async function deleteRosterShift({
  shiftId,
  organisationId,
}) {
  if (!shiftId) {
    throw new Error(
      "Shift ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  const {
    error,
  } = await supabase
    .from("roster_shifts")
    .delete()
    .eq(
      "id",
      shiftId
    )
    .eq(
      "organisation_id",
      organisationId
    );

  if (error) {
    console.error(
      "Unable to delete roster shift:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to delete roster shift."
    );
  }

  return true;
}


/* =========================================================
   ROSTER HELPERS
========================================================= */

export function getRosterStatusLabel(
  status
) {
  const labels = {
    draft:
      "Draft",

    scheduled:
      "Scheduled",

    in_progress:
      "In Progress",

    completed:
      "Completed",

    cancelled:
      "Cancelled",
  };

  return (
    labels[status] ||
    "Unknown"
  );
}


export function groupRosterByDate(
  shifts = []
) {
  return (
    shifts || []
  ).reduce(
    (groups, shift) => {
      const date =
        shift?.shiftDate ||
        "unknown";

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date].push(
        shift
      );

      return groups;
    },
    {}
  );
}