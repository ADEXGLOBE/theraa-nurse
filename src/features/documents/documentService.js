// src/features/documents/documentService.js
import { idbDelete, idbGetAll, idbGetAllByIndex, idbPut } from "./idb";
import { classifyDocument } from "./documentClassifier";
import { extractSections } from "./documentSectionExtractor";

/* -------------------------------------------
   Utilities
-------------------------------------------- */

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notifyDocumentsChanged(clientId) {
  try {
    window.dispatchEvent(new CustomEvent("tn:documents-changed", { detail: { clientId } }));
  } catch {}
}

/* -------------------------------------------
   Document Types (UI-facing)
-------------------------------------------- */

export const DOC_TYPES = [
  { id: "session_note", label: "Session / Shift Note" },
  { id: "incident_report", label: "Incident Report" },
  { id: "psychological_report", label: "Psychological / Clinical Report" },
  { id: "behaviour_support_plan", label: "Behaviour Support Plan (BSP)" },
  { id: "ndis_plan", label: "NDIS Plan" },
  { id: "risk_assessment", label: "Risk Assessment" },
  { id: "medication_document", label: "Medication / MAR" },
  { id: "general_clinical_document", label: "General Clinical Document" },
];

/* -------------------------------------------
   Create
-------------------------------------------- */

export async function addDocument({
  clientId,
  authorRole,
  authorName,
  docType,
  title,
  textContent,
  fileBlob,
  fileName,
  fileType,
  fileSize,
}) {
  const createdAt = new Date().toISOString();

  const record = {
    id: uid(),
    clientId,

    authorRole: authorRole || "worker",
    authorName: authorName || "",

    docType: docType || "session_note",
    title: title || "",
    textContent: textContent || "",
    createdAt,

    fileBlob: fileBlob || null,
    fileName: fileName || "",
    fileType: fileType || "",
    fileSize: fileSize || 0,

    // Extraction fields
    extractedText: "",
    extractedAt: "",

    extractionMethod: "",
    ocrConfidence: null,

    // Structured intelligence (always exists)
    docCategory: "general_clinical_document",
    sectionMap: {},
    derivedGoals: [],
    derivedRisks: [],
    derivedSupports: [],
    derivedTriggers: [],
    derivedRecommendations: [],
  };

  await idbPut("documents", record);
  notifyDocumentsChanged(clientId);
  return record;
}

/* -------------------------------------------
   Delete
-------------------------------------------- */

export async function deleteDocument(id) {
  const docs = await idbGetAll("documents");
  const found = docs?.find((d) => d.id === id);
  await idbDelete("documents", id);
  if (found?.clientId) notifyDocumentsChanged(found.clientId);
}

/**
 * ✅ Delete ALL documents for a client (cascade helper for deleteClientFull)
 */
export async function deleteAllDocumentsForClient(clientId) {
  if (!clientId) return false;
  const docs = await listDocumentsForClient(clientId);
  for (const d of docs) {
    await idbDelete("documents", d.id);
  }
  notifyDocumentsChanged(clientId);
  return true;
}

/* -------------------------------------------
   Queries
-------------------------------------------- */

export async function listAllDocuments() {
  const docs = await idbGetAll("documents");
  return (docs || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listDocumentsForClient(clientId) {
  const docs = await idbGetAllByIndex("documents", "by_clientId", clientId);
  return (docs || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/* -------------------------------------------
   Attach Extracted / OCR Text
-------------------------------------------- */

export async function attachExtractedText(docId, extractedText, meta = {}) {
  const docs = await listAllDocuments();
  const found = docs.find((d) => d.id === docId);
  if (!found) return null;

  const safeText = extractedText || "";

  // Classification (broad)
  const docCategory = classifyDocument(safeText, found.fileName || found.title || "");

  // Section extraction
  const sectionMap = extractSections(safeText);

  const updated = {
    ...found,
    extractedText: safeText,
    extractedAt: new Date().toISOString(),
    extractionMethod: meta.extractionMethod || found.extractionMethod || "",
    ocrConfidence: typeof meta.ocrConfidence === "number" ? meta.ocrConfidence : found.ocrConfidence ?? null,

    // ✅ Always-populated structured fields
    docCategory,
    sectionMap,
    derivedGoals: sectionMap.goals || [],
    derivedRisks: sectionMap.risks || [],
    derivedSupports: sectionMap.supports || [],
    derivedTriggers: sectionMap.triggers || [],
    derivedRecommendations: sectionMap.recommendations || [],
  };

  await idbPut("documents", updated);
  notifyDocumentsChanged(updated.clientId);
  return updated;
}
