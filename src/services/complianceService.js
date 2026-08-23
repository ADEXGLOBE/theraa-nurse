// src/services/complianceService.js

import { supabase } from "./supabaseClient";

const VALID_STATUSES = [
  "pending",
  "valid",
  "expiring",
  "expired",
  "not_required",
];

function clean(value) {
  return String(value ?? "").trim();
}

function mapComplianceRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    organisationId: row.organisation_id,
    staffUserId: row.staff_user_id,
    requirementType: row.requirement_type,
    documentName: row.document_name || "",
    documentReference: row.document_reference || "",
    issuedDate: row.issued_date,
    expiryDate: row.expiry_date,
    status: row.status,
    verified: Boolean(row.verified),
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    notes: row.notes || "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listStaffCompliance({
  organisationId,
  staffUserId = null,
} = {}) {
  if (!organisationId) return [];

  let query = supabase
    .from("staff_compliance")
    .select(`
      id,
      organisation_id,
      staff_user_id,
      requirement_type,
      document_name,
      document_reference,
      issued_date,
      expiry_date,
      status,
      verified,
      verified_by,
      verified_at,
      notes,
      created_by,
      created_at,
      updated_at
    `)
    .eq("organisation_id", organisationId);

  if (staffUserId) {
    query = query.eq("staff_user_id", staffUserId);
  }

  const { data, error } = await query
    .order("expiry_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load staff compliance:", error);

    throw new Error(
      error.message ||
        "Unable to load staff compliance records."
    );
  }

  return (data || [])
    .map(mapComplianceRow)
    .filter(Boolean);
}

export async function createStaffCompliance({
  organisationId,
  staffUserId,
  requirementType,
  documentName = "",
  documentReference = "",
  issuedDate = null,
  expiryDate = null,
  status = "pending",
  notes = "",
  createdBy,
}) {
  if (!organisationId) {
    throw new Error("Organisation ID is required.");
  }

  if (!staffUserId) {
    throw new Error("Staff user ID is required.");
  }

  if (!clean(requirementType)) {
    throw new Error("Compliance requirement type is required.");
  }

  if (!createdBy) {
    throw new Error("Signed-in user ID is required.");
  }

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid compliance status.");
  }

  const { data, error } = await supabase
    .from("staff_compliance")
    .insert({
      organisation_id: organisationId,
      staff_user_id: staffUserId,
      requirement_type: clean(requirementType),
      document_name: clean(documentName),
      document_reference: clean(documentReference),
      issued_date: issuedDate || null,
      expiry_date: expiryDate || null,
      status,
      notes: clean(notes),
      created_by: createdBy,
    })
    .select(`
      id,
      organisation_id,
      staff_user_id,
      requirement_type,
      document_name,
      document_reference,
      issued_date,
      expiry_date,
      status,
      verified,
      verified_by,
      verified_at,
      notes,
      created_by,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    console.error("Unable to create staff compliance:", error);

    throw new Error(
      error.message ||
        "Unable to create staff compliance record."
    );
  }

  return mapComplianceRow(data);
}

export async function updateStaffCompliance({
  complianceId,
  organisationId,
  changes = {},
}) {
  if (!complianceId) {
    throw new Error("Compliance record ID is required.");
  }

  if (!organisationId) {
    throw new Error("Organisation ID is required.");
  }

  const payload = {};

  if ("requirementType" in changes) {
    payload.requirement_type = clean(changes.requirementType);
  }

  if ("documentName" in changes) {
    payload.document_name = clean(changes.documentName);
  }

  if ("documentReference" in changes) {
    payload.document_reference = clean(
      changes.documentReference
    );
  }

  if ("issuedDate" in changes) {
    payload.issued_date = changes.issuedDate || null;
  }

  if ("expiryDate" in changes) {
    payload.expiry_date = changes.expiryDate || null;
  }

  if ("status" in changes) {
    if (!VALID_STATUSES.includes(changes.status)) {
      throw new Error("Invalid compliance status.");
    }

    payload.status = changes.status;
  }

  if ("verified" in changes) {
    payload.verified = Boolean(changes.verified);
  }

  if ("verifiedBy" in changes) {
    payload.verified_by = changes.verifiedBy || null;
  }

  if ("verifiedAt" in changes) {
    payload.verified_at = changes.verifiedAt || null;
  }

  if ("notes" in changes) {
    payload.notes = clean(changes.notes);
  }

  const { data, error } = await supabase
    .from("staff_compliance")
    .update(payload)
    .eq("id", complianceId)
    .eq("organisation_id", organisationId)
    .select(`
      id,
      organisation_id,
      staff_user_id,
      requirement_type,
      document_name,
      document_reference,
      issued_date,
      expiry_date,
      status,
      verified,
      verified_by,
      verified_at,
      notes,
      created_by,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    console.error("Unable to update staff compliance:", error);

    throw new Error(
      error.message ||
        "Unable to update staff compliance record."
    );
  }

  return mapComplianceRow(data);
}

export async function verifyStaffCompliance({
  complianceId,
  organisationId,
  verifiedBy,
}) {
  if (!verifiedBy) {
    throw new Error("Verifying user ID is required.");
  }

  return updateStaffCompliance({
    complianceId,
    organisationId,
    changes: {
      verified: true,
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    },
  });
}

export async function deleteStaffCompliance({
  complianceId,
  organisationId,
}) {
  if (!complianceId) {
    throw new Error("Compliance record ID is required.");
  }

  if (!organisationId) {
    throw new Error("Organisation ID is required.");
  }

  const { error } = await supabase
    .from("staff_compliance")
    .delete()
    .eq("id", complianceId)
    .eq("organisation_id", organisationId);

  if (error) {
    console.error("Unable to delete staff compliance:", error);

    throw new Error(
      error.message ||
        "Unable to delete staff compliance record."
    );
  }

  return true;
}

export function getComplianceStatusLabel(status) {
  const labels = {
    pending: "Pending",
    valid: "Valid",
    expiring: "Expiring",
    expired: "Expired",
    not_required: "Not Required",
  };

  return labels[status] || "Unknown";
}

export function calculateComplianceStatus(expiryDate) {
  if (!expiryDate) return "pending";

  const expiry = new Date(`${expiryDate}T23:59:59`);
  const now = new Date();

  if (Number.isNaN(expiry.getTime())) {
    return "pending";
  }

  if (expiry.getTime() < now.getTime()) {
    return "expired";
  }

  const diffMs = expiry.getTime() - now.getTime();

  const daysRemaining =
    diffMs / (1000 * 60 * 60 * 24);

  if (daysRemaining <= 30) {
    return "expiring";
  }

  return "valid";
}