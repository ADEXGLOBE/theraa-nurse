// src/services/carePlanService.js

import { supabase } from "./supabaseClient";

const VALID_STATUSES = [
  "draft",
  "reviewed",
  "approved",
  "archived",
];

function clean(value) {
  return String(value ?? "").trim();
}

function ensureStatus(status) {
  const safeStatus = clean(status) || "draft";

  if (!VALID_STATUSES.includes(safeStatus)) {
    throw new Error(
      `Invalid care plan status: ${safeStatus}`
    );
  }

  return safeStatus;
}

function mapCarePlanRow(row) {
  if (!row) return null;

  return {
    id: row.id,

    organisationId:
      row.organisation_id,

    participantId:
      row.participant_id,

    clientId:
      row.participant_id,

    status:
      row.status,

    plan:
      row.plan_data &&
      typeof row.plan_data === "object"
        ? row.plan_data
        : {},

    evidenceCount:
      Number(
        row.evidence_count || 0
      ),

    createdBy:
      row.created_by,

    reviewedBy:
      row.reviewed_by,

    approvedBy:
      row.approved_by,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,

    reviewedAt:
      row.reviewed_at,

    approvedAt:
      row.approved_at,
  };
}

/**
 * Load all shared care-plan versions for
 * one participant.
 *
 * RLS determines whether the signed-in user
 * is authorised to see the participant's plan.
 */
export async function loadSharedCarePlanVersions({
  organisationId,
  participantId,
}) {
  if (
    !organisationId ||
    !participantId
  ) {
    return [];
  }

  const { data, error } =
    await supabase
      .from(
        "participant_care_plan_versions"
      )
      .select(`
        id,
        organisation_id,
        participant_id,
        status,
        plan_data,
        evidence_count,
        created_by,
        reviewed_by,
        approved_by,
        created_at,
        updated_at,
        reviewed_at,
        approved_at
      `)
      .eq(
        "organisation_id",
        organisationId
      )
      .eq(
        "participant_id",
        participantId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (error) {
    console.error(
      "Unable to load shared care plans:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load shared care plans."
    );
  }

  return (data || [])
    .map(mapCarePlanRow)
    .filter(Boolean);
}

/**
 * Load the newest care-plan version for
 * one participant.
 */
export async function loadLatestSharedCarePlan({
  organisationId,
  participantId,
}) {
  if (
    !organisationId ||
    !participantId
  ) {
    return null;
  }

  const { data, error } =
    await supabase
      .from(
        "participant_care_plan_versions"
      )
      .select(`
        id,
        organisation_id,
        participant_id,
        status,
        plan_data,
        evidence_count,
        created_by,
        reviewed_by,
        approved_by,
        created_at,
        updated_at,
        reviewed_at,
        approved_at
      `)
      .eq(
        "organisation_id",
        organisationId
      )
      .eq(
        "participant_id",
        participantId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "Unable to load latest shared care plan:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load the latest care plan."
    );
  }

  return mapCarePlanRow(data);
}

/**
 * Create a new shared care-plan version.
 */
export async function createSharedCarePlanVersion({
  organisationId,
  participantId,
  userId,
  status = "draft",
  plan = {},
  evidenceCount = 0,
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

  const safeStatus =
    ensureStatus(status);

  const now =
    new Date().toISOString();

  const payload = {
    organisation_id:
      organisationId,

    participant_id:
      participantId,

    status:
      safeStatus,

    plan_data:
      plan &&
      typeof plan === "object"
        ? plan
        : {},

    evidence_count:
      Number.isFinite(
        Number(evidenceCount)
      )
        ? Number(evidenceCount)
        : 0,

    created_by:
      userId,
  };

  if (
    safeStatus ===
    "reviewed"
  ) {
    payload.reviewed_by =
      userId;

    payload.reviewed_at =
      now;
  }

  if (
    safeStatus ===
    "approved"
  ) {
    payload.reviewed_by =
      userId;

    payload.reviewed_at =
      now;

    payload.approved_by =
      userId;

    payload.approved_at =
      now;
  }

  const { data, error } =
    await supabase
      .from(
        "participant_care_plan_versions"
      )
      .insert(payload)
      .select(`
        id,
        organisation_id,
        participant_id,
        status,
        plan_data,
        evidence_count,
        created_by,
        reviewed_by,
        approved_by,
        created_at,
        updated_at,
        reviewed_at,
        approved_at
      `)
      .single();

  if (error) {
    console.error(
      "Unable to create shared care plan version:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to save the care plan."
    );
  }

  return mapCarePlanRow(data);
}

/**
 * Update an existing shared care-plan version.
 *
 * Formal update permissions are enforced
 * by Supabase RLS.
 */
export async function updateSharedCarePlanVersion({
  carePlanVersionId,
  organisationId,
  userId,
  status,
  plan,
  evidenceCount,
}) {
  if (!carePlanVersionId) {
    throw new Error(
      "Care plan version ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  const updates = {
    updated_at:
      new Date().toISOString(),
  };

  if (
    status !== undefined
  ) {
    const safeStatus =
      ensureStatus(status);

    updates.status =
      safeStatus;

    if (
      safeStatus ===
        "reviewed" &&
      userId
    ) {
      updates.reviewed_by =
        userId;

      updates.reviewed_at =
        new Date().toISOString();
    }

    if (
      safeStatus ===
        "approved" &&
      userId
    ) {
      updates.approved_by =
        userId;

      updates.approved_at =
        new Date().toISOString();

      if (
        !updates.reviewed_by
      ) {
        updates.reviewed_by =
          userId;

        updates.reviewed_at =
          new Date().toISOString();
      }
    }
  }

  if (
    plan !== undefined
  ) {
    updates.plan_data =
      plan &&
      typeof plan ===
        "object"
        ? plan
        : {};
  }

  if (
    evidenceCount !== undefined
  ) {
    updates.evidence_count =
      Number.isFinite(
        Number(evidenceCount)
      )
        ? Number(evidenceCount)
        : 0;
  }

  const { data, error } =
    await supabase
      .from(
        "participant_care_plan_versions"
      )
      .update(updates)
      .eq(
        "id",
        carePlanVersionId
      )
      .eq(
        "organisation_id",
        organisationId
      )
      .select(`
        id,
        organisation_id,
        participant_id,
        status,
        plan_data,
        evidence_count,
        created_by,
        reviewed_by,
        approved_by,
        created_at,
        updated_at,
        reviewed_at,
        approved_at
      `)
      .single();

  if (error) {
    console.error(
      "Unable to update shared care plan:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to update the care plan."
    );
  }

  return mapCarePlanRow(data);
}

/**
 * Convenience function for formally approving
 * an existing care plan version.
 */
export async function approveSharedCarePlanVersion({
  carePlanVersionId,
  organisationId,
  userId,
}) {
  return updateSharedCarePlanVersion({
    carePlanVersionId,
    organisationId,
    userId,
    status: "approved",
  });
}

/**
 * Archive an existing plan version.
 */
export async function archiveSharedCarePlanVersion({
  carePlanVersionId,
  organisationId,
  userId,
}) {
  return updateSharedCarePlanVersion({
    carePlanVersionId,
    organisationId,
    userId,
    status: "archived",
  });
}

/**
 * Delete a care-plan version.
 *
 * RLS currently limits deletion to
 * Provider Admin and Manager.
 */
export async function deleteSharedCarePlanVersion({
  carePlanVersionId,
  organisationId,
}) {
  if (!carePlanVersionId) {
    throw new Error(
      "Care plan version ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  const { error } =
    await supabase
      .from(
        "participant_care_plan_versions"
      )
      .delete()
      .eq(
        "id",
        carePlanVersionId
      )
      .eq(
        "organisation_id",
        organisationId
      );

  if (error) {
    console.error(
      "Unable to delete shared care plan:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to delete the care plan."
    );
  }

  return true;
}

/**
 * Load the newest reviewed or approved plan.
 *
 * Useful later for Staff, Therapy, Medication
 * and support-worker read-only Purpose Plan
 * context.
 */
export async function loadCurrentSharedCarePlan({
  organisationId,
  participantId,
}) {
  if (
    !organisationId ||
    !participantId
  ) {
    return null;
  }

  const { data, error } =
    await supabase
      .from(
        "participant_care_plan_versions"
      )
      .select(`
        id,
        organisation_id,
        participant_id,
        status,
        plan_data,
        evidence_count,
        created_by,
        reviewed_by,
        approved_by,
        created_at,
        updated_at,
        reviewed_at,
        approved_at
      `)
      .eq(
        "organisation_id",
        organisationId
      )
      .eq(
        "participant_id",
        participantId
      )
      .in(
        "status",
        [
          "approved",
          "reviewed",
        ]
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error(
      "Unable to load current shared care plan:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load the current care plan."
    );
  }

  return mapCarePlanRow(data);
}