// src/features/documents/documentService.js

import { supabase } from "../../services/supabaseClient";
import { extractTextFromPdf } from "./pdfExtraction";

const SUPPORTED_TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".html",
  ".htm",
];

const MAX_FILE_SIZE_BYTES =
  15 * 1024 * 1024;


/* =========================================================
   BASIC HELPERS
========================================================= */

function clean(value) {
  return String(value ?? "").trim();
}

function getExtension(fileName = "") {
  const normalised =
    String(fileName).toLowerCase();

  const dotIndex =
    normalised.lastIndexOf(".");

  return dotIndex >= 0
    ? normalised.slice(dotIndex)
    : "";
}

function isPdfFile(file) {
  return (
    file?.type === "application/pdf" ||
    getExtension(file?.name) === ".pdf"
  );
}

function isSupportedTextFile(file) {
  const extension =
    getExtension(file?.name);

  return (
    String(file?.type || "")
      .startsWith("text/") ||
    SUPPORTED_TEXT_EXTENSIONS.includes(
      extension
    )
  );
}


/* =========================================================
   FILE TEXT EXTRACTION
========================================================= */

async function extractTextFromFile(file) {
  if (!file) {
    return {
      text: "",
      pageCount: null,
      pagesProcessed: null,
      characterCount: 0,
      extractionStatus:
        "manual-entry",
      extractionMessage: "",
      wasTruncated: false,
    };
  }

  if (
    file.size >
    MAX_FILE_SIZE_BYTES
  ) {
    throw new Error(
      "This file is larger than 15 MB. Please upload a smaller file."
    );
  }

  /*
   * PDF extraction.
   *
   * Keep your existing PDF extraction
   * implementation unchanged.
   */
  if (isPdfFile(file)) {
    const pdfResult =
      await extractTextFromPdf(file);

    return {
      ...pdfResult,

      extractionMessage:
        pdfResult.extractionStatus ===
        "completed"
          ? `Extracted text from ${pdfResult.pagesProcessed} PDF page(s).`
          : "No readable text was found. The PDF may contain scanned images and require OCR.",
    };
  }

  /*
   * Plain-text-compatible documents.
   */
  if (
    isSupportedTextFile(file)
  ) {
    const text =
      await file.text();

    return {
      text,

      pageCount:
        null,

      pagesProcessed:
        null,

      characterCount:
        text.length,

      extractionStatus:
        text
          ? "completed"
          : "no-readable-text",

      extractionMessage:
        text
          ? "Text file extracted successfully."
          : "No readable text was found in the file.",

      wasTruncated:
        false,
    };
  }

  throw new Error(
    "This file type is not supported yet. Upload a PDF, TXT, MD, CSV, JSON or HTML file."
  );
}


/* =========================================================
   DATABASE ROW MAPPING
========================================================= */

function mapDocumentRow(row) {
  if (!row) {
    return null;
  }

  return {
    /*
     * Database UUID is now authoritative.
     */
    id:
      row.id,

    organisationId:
      row.organisation_id,

    participantId:
      row.participant_id,

    /*
     * Keep clientId for compatibility
     * with existing Theraa Nurse pages.
     */
    clientId:
      row.participant_id,

    createdBy:
      row.created_by,

    /*
     * Keep ownerId temporarily so older
     * UI code does not immediately break.
     *
     * It no longer means the document
     * belongs privately to this user.
     */
    ownerId:
      row.created_by,

    title:
      row.title,

    name:
      row.title,

    category:
      row.category,

    fileName:
      row.file_name || "",

    fileType:
      row.file_type || "",

    fileExtension:
      row.file_extension || "",

    size:
      Number(
        row.file_size || 0
      ),

    originalFileStored:
      Boolean(
        row.original_file_stored
      ),

    /*
     * Keep all three aliases because
     * existing pages use different ones.
     */
    text:
      row.extracted_text || "",

    extractedText:
      row.extracted_text || "",

    textContent:
      row.extracted_text || "",

    extractionStatus:
      row.extraction_status,

    extractionMessage:
      row.extraction_message || "",

    pageCount:
      row.page_count,

    pagesProcessed:
      row.pages_processed,

    characterCount:
      row.character_count || 0,

    wasTruncated:
      Boolean(
        row.was_truncated
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


/* =========================================================
   SAVE PARTICIPANT DOCUMENT
========================================================= */

/**
 * Save participant evidence into the shared
 * provider workspace.
 *
 * Preferred V3 call:
 *
 * saveDocumentForClient({
 *   organisationId,
 *   participantId,
 *   userId,
 *   title,
 *   category,
 *   file,
 *   textContent,
 * })
 *
 * clientId and ownerId remain accepted temporarily
 * to make the migration safer.
 */
export async function saveDocumentForClient({
  organisationId,

  participantId,
  clientId,

  userId,
  ownerId,

  title,
  category,
  file,
  textContent,
}) {
  const resolvedParticipantId =
    participantId ||
    clientId;

  const resolvedUserId =
    userId ||
    ownerId;

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required to save shared participant evidence."
    );
  }

  if (
    !resolvedParticipantId
  ) {
    throw new Error(
      "Participant ID is required."
    );
  }

  if (!resolvedUserId) {
    throw new Error(
      "Signed-in user ID is required."
    );
  }

  const manualText =
    clean(textContent);

  let extractionResult = {
    text:
      manualText,

    pageCount:
      null,

    pagesProcessed:
      null,

    characterCount:
      manualText.length,

    extractionStatus:
      manualText
        ? "manual-entry"
        : "pending",

    extractionMessage:
      manualText
        ? "Manual document text was supplied."
        : "",

    wasTruncated:
      false,
  };


  /*
   * If a file is supplied:
   *
   * 1. extract its text
   * 2. preserve additional manual notes
   * 3. combine both into one evidence record
   */
  if (file) {
    const fileResult =
      await extractTextFromFile(
        file
      );

    const combinedText = [
      fileResult.text,

      manualText
        ? `--- Additional Manual Notes ---\n${manualText}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    extractionResult = {
      ...fileResult,

      text:
        combinedText,

      characterCount:
        combinedText.length,
    };
  }


  if (
    !extractionResult.text
  ) {
    throw new Error(
      extractionResult.extractionMessage ||
        "No readable document text was found."
    );
  }


  /*
   * For now we store:
   *
   * - document metadata
   * - extracted text
   * - extraction information
   *
   * The original binary file will move
   * to Supabase Storage in a later phase.
   */
  const insertPayload = {
    organisation_id:
      organisationId,

    participant_id:
      resolvedParticipantId,

    created_by:
      resolvedUserId,

    title:
      clean(title) ||
      file?.name ||
      "Untitled document",

    category:
      clean(category) ||
      "General",

    file_name:
      file?.name || "",

    file_type:
      file?.type || "",

    file_extension:
      getExtension(
        file?.name
      ),

    file_size:
      file?.size || 0,

    original_file_stored:
      false,

    extracted_text:
      extractionResult.text,

    extraction_status:
      extractionResult.extractionStatus,

    extraction_message:
      extractionResult.extractionMessage ||
      "",

    page_count:
      extractionResult.pageCount,

    pages_processed:
      extractionResult.pagesProcessed,

    character_count:
      extractionResult.characterCount ||
      extractionResult.text.length,

    was_truncated:
      Boolean(
        extractionResult.wasTruncated
      ),
  };


  const {
    data,
    error,
  } = await supabase
    .from(
      "participant_documents"
    )
    .insert(
      insertPayload
    )
    .select(`
      id,
      organisation_id,
      participant_id,
      created_by,
      title,
      category,
      file_name,
      file_type,
      file_extension,
      file_size,
      original_file_stored,
      extracted_text,
      extraction_status,
      extraction_message,
      page_count,
      pages_processed,
      character_count,
      was_truncated,
      created_at,
      updated_at
    `)
    .single();


  if (error) {
    console.error(
      "Unable to save shared participant document:",
      error
    );

    throw new Error(
      error.message ||
        "The participant document could not be saved."
    );
  }


  return mapDocumentRow(
    data
  );
}


/* =========================================================
   LIST PARTICIPANT DOCUMENTS
========================================================= */

/**
 * Load the shared evidence for one participant.
 *
 * RLS decides whether the signed-in user
 * has access to the organisation's records.
 *
 * The second positional argument is intentionally
 * retained for compatibility with older calls:
 *
 * listDocumentsForClient(clientId, ownerId)
 *
 * ownerId is no longer used as an ownership filter.
 */
export async function listDocumentsForClient(
  participantId,
  _legacyOwnerId = null
) {
  if (!participantId) {
    return [];
  }


  const {
    data,
    error,
  } = await supabase
    .from(
      "participant_documents"
    )
    .select(`
      id,
      organisation_id,
      participant_id,
      created_by,
      title,
      category,
      file_name,
      file_type,
      file_extension,
      file_size,
      original_file_stored,
      extracted_text,
      extraction_status,
      extraction_message,
      page_count,
      pages_processed,
      character_count,
      was_truncated,
      created_at,
      updated_at
    `)
    .eq(
      "participant_id",
      participantId
    )
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    );


  if (error) {
    console.error(
      "Unable to load shared participant documents:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to load participant documents."
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
   DOCUMENT INTELLIGENCE
========================================================= */

export async function buildClientDocumentIntelligence(
  participantId,
  legacyOwnerId = null
) {
  const docs =
    await listDocumentsForClient(
      participantId,
      legacyOwnerId
    );


  const readableDocs =
    docs.filter(
      (doc) =>
        clean(
          doc.textContent ||
            doc.extractedText ||
            doc.text ||
            ""
        )
    );


  const combinedText =
    readableDocs
      .map(
        (doc) => {
          const title =
            doc.title ||
            doc.fileName ||
            "Untitled document";

          const category =
            doc.category ||
            "General";

          const content =
            doc.textContent ||
            doc.extractedText ||
            doc.text ||
            "";

          return [
            `DOCUMENT: ${title}`,
            `CATEGORY: ${category}`,
            `SOURCE FILE: ${
              doc.fileName ||
              "Manual entry"
            }`,
            content,
          ].join("\n");
        }
      )
      .join(
        "\n\n==============================\n\n"
      );


  return {
    participantId,

    clientId:
      participantId,

    documentCount:
      docs.length,

    readableDocumentCount:
      readableDocs.length,

    documents:
      docs,

    combinedText,

    text:
      combinedText,
  };
}


/* =========================================================
   DELETE PARTICIPANT DOCUMENT
========================================================= */

/**
 * Delete a shared document.
 *
 * Database RLS decides whether the current
 * user is authorised.
 *
 * legacyOwnerId is intentionally ignored.
 */
export async function deleteDocument(
  documentId,
  _legacyOwnerId = null
) {
  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }


  const {
    error,
  } = await supabase
    .from(
      "participant_documents"
    )
    .delete()
    .eq(
      "id",
      documentId
    );


  if (error) {
    console.error(
      "Unable to delete shared participant document:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to delete the participant document."
    );
  }


  return true;
}