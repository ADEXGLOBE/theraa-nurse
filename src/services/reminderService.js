// src/services/reminderService.js

import { supabase } from "./supabaseClient";

const VALID_TYPES = [
  "general",
  "compliance",
  "professional_document",
  "participant_review",
  "care_plan_review",
  "shift_documentation",
  "medication",
  "clinical",
];

const VALID_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
];

const VALID_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
];

function clean(value) {
  return String(value ?? "").trim();
}

function mapReminderRow(row) {
  if (!row) return null;

  return {
    id: row.id,

    organisationId:
      row.organisation_id,

    participantId:
      row.participant_id,

    assignedUserId:
      row.assigned_user_id,

    title:
      row.title || "",

    description:
      row.description || "",

    reminderType:
      row.reminder_type || "general",

    professionalType:
      row.professional_type || "",

    dueDate:
      row.due_date,

    priority:
      row.priority || "medium",

    status:
      row.status || "open",

    completedAt:
      row.completed_at,

    createdBy:
      row.created_by,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


/* =========================================================
   LIST REMINDERS
========================================================= */

export async function listWorkforceReminders({
  organisationId,
  participantId = null,
  assignedUserId = null,
  reminderType = null,
  status = null,
} = {}) {
  if (!organisationId) {
    return [];
  }

  let query = supabase
    .from("workforce_reminders")
    .select(`
      id,
      organisation_id,
      participant_id,
      assigned_user_id,
      title,
      description,
      reminder_type,
      professional_type,
      due_date,
      priority,
      status,
      completed_at,
      created_by,
      created_at,
      updated_at
    `)
    .eq(
      "organisation_id",
      organisationId
    );

  if (participantId) {
    query = query.eq(
      "participant_id",
      participantId
    );
  }

  if (assignedUserId) {
    query = query.eq(
      "assigned_user_id",
      assignedUserId
    );
  }

  if (reminderType) {
    query = query.eq(
      "reminder_type",
      reminderType
    );
  }

  if (status) {
    query = query.eq(
      "status",
      status
    );
  }

  const { data, error } =
    await query
      .order("due_date", {
        ascending: true,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    console.error(
      "Unable to load workforce reminders:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load workforce reminders."
    );
  }

  return (data || [])
    .map(mapReminderRow)
    .filter(Boolean);
}


/* =========================================================
   CREATE REMINDER
========================================================= */

export async function createWorkforceReminder({
  organisationId,
  participantId = null,
  assignedUserId = null,

  title,
  description = "",

  reminderType = "general",
  professionalType = "",

  dueDate = null,
  priority = "medium",

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

  if (!clean(title)) {
    throw new Error(
      "Reminder title is required."
    );
  }

  if (
    !VALID_TYPES.includes(
      reminderType
    )
  ) {
    throw new Error(
      "Invalid reminder type."
    );
  }

  if (
    !VALID_PRIORITIES.includes(
      priority
    )
  ) {
    throw new Error(
      "Invalid reminder priority."
    );
  }

  const { data, error } =
    await supabase
      .from("workforce_reminders")
      .insert({
        organisation_id:
          organisationId,

        participant_id:
          participantId || null,

        assigned_user_id:
          assignedUserId || null,

        title:
          clean(title),

        description:
          clean(description),

        reminder_type:
          reminderType,

        professional_type:
          clean(professionalType),

        due_date:
          dueDate || null,

        priority,

        status:
          "open",

        created_by:
          createdBy,
      })
      .select(`
        id,
        organisation_id,
        participant_id,
        assigned_user_id,
        title,
        description,
        reminder_type,
        professional_type,
        due_date,
        priority,
        status,
        completed_at,
        created_by,
        created_at,
        updated_at
      `)
      .single();

  if (error) {
    console.error(
      "Unable to create workforce reminder:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to create workforce reminder."
    );
  }

  return mapReminderRow(data);
}


/* =========================================================
   UPDATE REMINDER
========================================================= */

export async function updateWorkforceReminder({
  reminderId,
  organisationId,
  changes = {},
}) {
  if (!reminderId) {
    throw new Error(
      "Reminder ID is required."
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
    "assignedUserId" in changes
  ) {
    payload.assigned_user_id =
      changes.assignedUserId || null;
  }

  if ("title" in changes) {
    payload.title =
      clean(changes.title);
  }

  if (
    "description" in changes
  ) {
    payload.description =
      clean(changes.description);
  }

  if (
    "reminderType" in changes
  ) {
    if (
      !VALID_TYPES.includes(
        changes.reminderType
      )
    ) {
      throw new Error(
        "Invalid reminder type."
      );
    }

    payload.reminder_type =
      changes.reminderType;
  }

  if (
    "professionalType" in
    changes
  ) {
    payload.professional_type =
      clean(
        changes.professionalType
      );
  }

  if (
    "dueDate" in changes
  ) {
    payload.due_date =
      changes.dueDate || null;
  }

  if (
    "priority" in changes
  ) {
    if (
      !VALID_PRIORITIES.includes(
        changes.priority
      )
    ) {
      throw new Error(
        "Invalid reminder priority."
      );
    }

    payload.priority =
      changes.priority;
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
        "Invalid reminder status."
      );
    }

    payload.status =
      changes.status;

    payload.completed_at =
      changes.status ===
      "completed"
        ? new Date().toISOString()
        : null;
  }

  const { data, error } =
    await supabase
      .from("workforce_reminders")
      .update(payload)
      .eq(
        "id",
        reminderId
      )
      .eq(
        "organisation_id",
        organisationId
      )
      .select(`
        id,
        organisation_id,
        participant_id,
        assigned_user_id,
        title,
        description,
        reminder_type,
        professional_type,
        due_date,
        priority,
        status,
        completed_at,
        created_by,
        created_at,
        updated_at
      `)
      .single();

  if (error) {
    console.error(
      "Unable to update workforce reminder:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to update workforce reminder."
    );
  }

  return mapReminderRow(data);
}


/* =========================================================
   STATUS HELPERS
========================================================= */

export async function startWorkforceReminder({
  reminderId,
  organisationId,
}) {
  return updateWorkforceReminder({
    reminderId,
    organisationId,

    changes: {
      status:
        "in_progress",
    },
  });
}


export async function completeWorkforceReminder({
  reminderId,
  organisationId,
}) {
  return updateWorkforceReminder({
    reminderId,
    organisationId,

    changes: {
      status:
        "completed",
    },
  });
}


export async function reopenWorkforceReminder({
  reminderId,
  organisationId,
}) {
  return updateWorkforceReminder({
    reminderId,
    organisationId,

    changes: {
      status:
        "open",
    },
  });
}


export async function cancelWorkforceReminder({
  reminderId,
  organisationId,
}) {
  return updateWorkforceReminder({
    reminderId,
    organisationId,

    changes: {
      status:
        "cancelled",
    },
  });
}


/* =========================================================
   DELETE REMINDER
========================================================= */

export async function deleteWorkforceReminder({
  reminderId,
  organisationId,
}) {
  if (!reminderId) {
    throw new Error(
      "Reminder ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  const { error } =
    await supabase
      .from("workforce_reminders")
      .delete()
      .eq(
        "id",
        reminderId
      )
      .eq(
        "organisation_id",
        organisationId
      );

  if (error) {
    console.error(
      "Unable to delete workforce reminder:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to delete workforce reminder."
    );
  }

  return true;
}


/* =========================================================
   DISPLAY HELPERS
========================================================= */

export function getReminderTypeLabel(
  reminderType
) {
  const labels = {
    general:
      "General",

    compliance:
      "Compliance",

    professional_document:
      "Professional Document",

    participant_review:
      "Participant Review",

    care_plan_review:
      "Purpose Plan Review",

    shift_documentation:
      "Shift Documentation",

    medication:
      "Medication",

    clinical:
      "Clinical",
  };

  return (
    labels[reminderType] ||
    "General"
  );
}


export function getReminderPriorityLabel(
  priority
) {
  const labels = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };

  return (
    labels[priority] ||
    "Medium"
  );
}


export function daysUntilDue(
  dueDate
) {
  if (!dueDate) {
    return null;
  }

  const due =
    new Date(
      `${dueDate}T23:59:59`
    );

  if (
    Number.isNaN(
      due.getTime()
    )
  ) {
    return null;
  }

  return Math.ceil(
    (
      due.getTime() -
      Date.now()
    ) /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}