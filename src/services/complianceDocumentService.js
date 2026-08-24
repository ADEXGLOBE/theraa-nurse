// src/services/complianceDocumentService.js

import { supabase } from "./supabaseClient";

const BUCKET =
  "workforce-compliance";

const MAX_FILE_SIZE_BYTES =
  15 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];


function clean(value) {
  return String(value ?? "").trim();
}


function safeFileName(
  fileName = "document"
) {
  return String(fileName)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}


function buildStoragePath({
  organisationId,
  userId,
  file,
}) {
  const timestamp =
    Date.now();

  const random =
    Math.random()
      .toString(16)
      .slice(2);

  const name =
    safeFileName(
      file?.name ||
        "document"
    );

  return [
    organisationId,
    userId,
    `${timestamp}-${random}-${name}`,
  ].join("/");
}


function mapDocumentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id:
      row.id,

    organisationId:
      row.organisation_id,

    userId:
      row.user_id,

    documentType:
      row.document_type,

    documentName:
      row.document_name,

    referenceNumber:
      row.reference_number || "",

    issueDate:
      row.issue_date,

    expiryDate:
      row.expiry_date,

    storagePath:
      row.storage_path,

    originalFileName:
      row.original_file_name || "",

    mimeType:
      row.mime_type || "",

    fileSize:
      Number(
        row.file_size || 0
      ),

    notes:
      row.notes || "",

    verificationStatus:
      row.verification_status,

    verifiedBy:
      row.verified_by,

    verifiedAt:
      row.verified_at,

    rejectionReason:
      row.rejection_reason || "",

    uploadedBy:
      row.uploaded_by,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


/* =========================================================
   LIST DOCUMENTS
========================================================= */

export async function listComplianceDocuments({
  organisationId,
  userId = null,
} = {}) {
  if (!organisationId) {
    return [];
  }

  let query =
    supabase
      .from(
        "workforce_compliance_documents"
      )
      .select(`
        id,
        organisation_id,
        user_id,
        document_type,
        document_name,
        reference_number,
        issue_date,
        expiry_date,
        storage_path,
        original_file_name,
        mime_type,
        file_size,
        notes,
        verification_status,
        verified_by,
        verified_at,
        rejection_reason,
        uploaded_by,
        created_at,
        updated_at
      `)
      .eq(
        "organisation_id",
        organisationId
      );

  if (userId) {
    query =
      query.eq(
        "user_id",
        userId
      );
  }

  const {
    data,
    error,
  } =
    await query
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      );

  if (error) {
    console.error(
      "Unable to load compliance documents:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load compliance documents."
    );
  }

  return (
    data || []
  )
    .map(
      mapDocumentRow
    )
    .filter(Boolean);
}


/* =========================================================
   UPLOAD DOCUMENT
========================================================= */

export async function uploadComplianceDocument({
  organisationId,

  userId,

  uploadedBy,

  documentType,

  documentName,

  referenceNumber = "",

  issueDate = null,

  expiryDate = null,

  notes = "",

  file,
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  if (!userId) {
    throw new Error(
      "Professional user ID is required."
    );
  }

  if (!uploadedBy) {
    throw new Error(
      "Signed-in user ID is required."
    );
  }

  if (!clean(documentType)) {
    throw new Error(
      "Document type is required."
    );
  }

  if (!clean(documentName)) {
    throw new Error(
      "Document name is required."
    );
  }

  if (!file) {
    throw new Error(
      "Select a compliance document to upload."
    );
  }

  if (
    file.size >
    MAX_FILE_SIZE_BYTES
  ) {
    throw new Error(
      "The compliance document must be 15 MB or smaller."
    );
  }

  if (
    !ALLOWED_TYPES.includes(
      file.type
    )
  ) {
    throw new Error(
      "Upload a PDF, JPEG, PNG or WebP file."
    );
  }


  const storagePath =
    buildStoragePath({
      organisationId,
      userId,
      file,
    });


  /*
   * Step 1:
   * upload private binary file.
   */
  const {
    error:
      uploadError,
  } =
    await supabase.storage
      .from(
        BUCKET
      )
      .upload(
        storagePath,
        file,
        {
          cacheControl:
            "3600",

          upsert:
            false,

          contentType:
            file.type,
        }
      );


  if (uploadError) {
    console.error(
      "Unable to upload compliance file:",
      uploadError
    );

    throw new Error(
      uploadError.message ||
        "The compliance file could not be uploaded."
    );
  }


  /*
   * Step 2:
   * create metadata record.
   *
   * If this fails, remove the uploaded
   * binary so we do not leave an orphan.
   */
  const {
    data,
    error:
      databaseError,
  } =
    await supabase
      .from(
        "workforce_compliance_documents"
      )
      .insert({
        organisation_id:
          organisationId,

        user_id:
          userId,

        document_type:
          clean(
            documentType
          ),

        document_name:
          clean(
            documentName
          ),

        reference_number:
          clean(
            referenceNumber
          ) || null,

        issue_date:
          issueDate || null,

        expiry_date:
          expiryDate || null,

        storage_path:
          storagePath,

        original_file_name:
          file.name || "",

        mime_type:
          file.type || "",

        file_size:
          file.size || 0,

        notes:
          clean(
            notes
          ) || null,

        verification_status:
          "pending",

        uploaded_by:
          uploadedBy,
      })
      .select(`
        id,
        organisation_id,
        user_id,
        document_type,
        document_name,
        reference_number,
        issue_date,
        expiry_date,
        storage_path,
        original_file_name,
        mime_type,
        file_size,
        notes,
        verification_status,
        verified_by,
        verified_at,
        rejection_reason,
        uploaded_by,
        created_at,
        updated_at
      `)
      .single();


  if (databaseError) {
    console.error(
      "Unable to save compliance document metadata:",
      databaseError
    );

    await supabase.storage
      .from(
        BUCKET
      )
      .remove([
        storagePath,
      ]);

    throw new Error(
      databaseError.message ||
        "The compliance document record could not be saved."
    );
  }


  return mapDocumentRow(
    data
  );
}


/* =========================================================
   PRIVATE VIEWING URL
========================================================= */

export async function createComplianceDocumentSignedUrl({
  storagePath,
  expiresIn = 300,
}) {
  if (!storagePath) {
    throw new Error(
      "Storage path is required."
    );
  }

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(
        BUCKET
      )
      .createSignedUrl(
        storagePath,
        expiresIn
      );


  if (error) {
    console.error(
      "Unable to create compliance document link:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to open the compliance document."
    );
  }

  return (
    data?.signedUrl ||
    null
  );
}


/* =========================================================
   VERIFY DOCUMENT
========================================================= */

export async function verifyComplianceDocument({
  documentId,
  organisationId,
  verifiedBy,
}) {
  if (!documentId) {
    throw new Error(
      "Compliance document ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  if (!verifiedBy) {
    throw new Error(
      "Verifying user ID is required."
    );
  }


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "workforce_compliance_documents"
      )
      .update({
        verification_status:
          "verified",

        verified_by:
          verifiedBy,

        verified_at:
          new Date().toISOString(),

        rejection_reason:
          null,
      })
      .eq(
        "id",
        documentId
      )
      .eq(
        "organisation_id",
        organisationId
      )
      .select(`
        id,
        organisation_id,
        user_id,
        document_type,
        document_name,
        reference_number,
        issue_date,
        expiry_date,
        storage_path,
        original_file_name,
        mime_type,
        file_size,
        notes,
        verification_status,
        verified_by,
        verified_at,
        rejection_reason,
        uploaded_by,
        created_at,
        updated_at
      `)
      .single();


  if (error) {
    console.error(
      "Unable to verify compliance document:",
      error
    );

    throw new Error(
      error.message ||
        "The compliance document could not be verified."
    );
  }


  return mapDocumentRow(
    data
  );
}


/* =========================================================
   REJECT DOCUMENT
========================================================= */

export async function rejectComplianceDocument({
  documentId,
  organisationId,
  verifiedBy,
  reason,
}) {
  if (!documentId) {
    throw new Error(
      "Compliance document ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }

  if (!verifiedBy) {
    throw new Error(
      "Reviewing user ID is required."
    );
  }

  if (!clean(reason)) {
    throw new Error(
      "Enter a rejection reason."
    );
  }


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "workforce_compliance_documents"
      )
      .update({
        verification_status:
          "rejected",

        verified_by:
          verifiedBy,

        verified_at:
          new Date().toISOString(),

        rejection_reason:
          clean(
            reason
          ),
      })
      .eq(
        "id",
        documentId
      )
      .eq(
        "organisation_id",
        organisationId
      )
      .select(`
        id,
        organisation_id,
        user_id,
        document_type,
        document_name,
        reference_number,
        issue_date,
        expiry_date,
        storage_path,
        original_file_name,
        mime_type,
        file_size,
        notes,
        verification_status,
        verified_by,
        verified_at,
        rejection_reason,
        uploaded_by,
        created_at,
        updated_at
      `)
      .single();


  if (error) {
    console.error(
      "Unable to reject compliance document:",
      error
    );

    throw new Error(
      error.message ||
        "The compliance document could not be rejected."
    );
  }


  return mapDocumentRow(
    data
  );
}


/* =========================================================
   RESET DOCUMENT FOR REVIEW
========================================================= */

export async function resetComplianceDocumentReview({
  documentId,
  organisationId,
}) {
  if (!documentId) {
    throw new Error(
      "Compliance document ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "workforce_compliance_documents"
      )
      .update({
        verification_status:
          "pending",

        verified_by:
          null,

        verified_at:
          null,

        rejection_reason:
          null,
      })
      .eq(
        "id",
        documentId
      )
      .eq(
        "organisation_id",
        organisationId
      )
      .select(`
        id,
        organisation_id,
        user_id,
        document_type,
        document_name,
        reference_number,
        issue_date,
        expiry_date,
        storage_path,
        original_file_name,
        mime_type,
        file_size,
        notes,
        verification_status,
        verified_by,
        verified_at,
        rejection_reason,
        uploaded_by,
        created_at,
        updated_at
      `)
      .single();


  if (error) {
    console.error(
      "Unable to reset compliance document:",
      error
    );

    throw new Error(
      error.message ||
        "The compliance document could not be reset."
    );
  }


  return mapDocumentRow(
    data
  );
}


/* =========================================================
   DELETE DOCUMENT
========================================================= */

export async function deleteComplianceDocument({
  documentId,
  organisationId,
  storagePath,
}) {
  if (!documentId) {
    throw new Error(
      "Compliance document ID is required."
    );
  }

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }


  /*
   * Remove the database row first.
   *
   * RLS determines whether the user
   * has permission.
   */
  const {
    error:
      databaseError,
  } =
    await supabase
      .from(
        "workforce_compliance_documents"
      )
      .delete()
      .eq(
        "id",
        documentId
      )
      .eq(
        "organisation_id",
        organisationId
      );


  if (databaseError) {
    console.error(
      "Unable to delete compliance document record:",
      databaseError
    );

    throw new Error(
      databaseError.message ||
        "The compliance document could not be deleted."
    );
  }


  /*
   * Then remove the private binary.
   */
  if (storagePath) {
    const {
      error:
        storageError,
    } =
      await supabase.storage
        .from(
          BUCKET
        )
        .remove([
          storagePath,
        ]);

    if (storageError) {
      console.error(
        "Compliance metadata was deleted but the stored file could not be removed:",
        storageError
      );
    }
  }


  return true;
}


/* =========================================================
   EXPIRY HELPERS
========================================================= */

export function getComplianceExpiryState(
  expiryDate
) {
  if (!expiryDate) {
    return {
      state:
        "no_expiry",

      label:
        "No Expiry",

      daysRemaining:
        null,
    };
  }


  const expiry =
    new Date(
      `${expiryDate}T23:59:59`
    );


  if (
    Number.isNaN(
      expiry.getTime()
    )
  ) {
    return {
      state:
        "unknown",

      label:
        "Unknown",

      daysRemaining:
        null,
    };
  }


  const diff =
    expiry.getTime() -
    Date.now();


  const daysRemaining =
    Math.ceil(
      diff /
        (
          1000 *
          60 *
          60 *
          24
        )
    );


  if (
    daysRemaining < 0
  ) {
    return {
      state:
        "expired",

      label:
        "Expired",

      daysRemaining,
    };
  }


  if (
    daysRemaining <= 30
  ) {
    return {
      state:
        "expiring",

      label:
        "Expiring Soon",

      daysRemaining,
    };
  }


  return {
    state:
      "valid",

    label:
      "Current",

    daysRemaining,
  };
}