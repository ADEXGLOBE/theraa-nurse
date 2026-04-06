// src/features/documents/documentService.js

import {
  idbDelete,
  idbGetAll,
  idbGetAllByIndex,
  idbPut,
} from "./idb";

import { extractDocumentIntelligence } from "../../engines/documentIntelligence";

/* -------------------------------------------
   Utilities
-------------------------------------------- */

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notifyDocumentsChanged(clientId) {
  try {
    window.dispatchEvent(
      new CustomEvent("tn:documents-changed", { detail: { clientId } })
    );
  } catch (err) {
    console.warn("Could not dispatch tn:documents-changed event", err);
  }
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function uniq(v = []) {
  return [...new Set(safeArray(v).filter(Boolean).map((x) => String(x).trim()).filter(Boolean))];
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

  const intelligence = extractDocumentIntelligence({
    text: textContent || "",
    fileName: fileName || title || "",
    explicitType: docType || "",
  });

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
    extractedText: textContent || "",
    extractedAt: textContent ? createdAt : "",
    extractionMethod: textContent ? "manual_text" : "",
    ocrConfidence: null,

    // Intelligence fields
    docCategory: intelligence.category,
    sectionMap: intelligence.sectionMap,

    derivedGoals: intelligence.derivedGoals,
    derivedRisks: intelligence.derivedRisks,
    derivedSupports: intelligence.derivedSupports,
    derivedTriggers: intelligence.derivedTriggers,
    derivedCommunication: intelligence.derivedCommunication,
    derivedHealthClinical: intelligence.derivedHealthClinical,
    derivedStrengths: intelligence.derivedStrengths,
    derivedBehaviourSupport: intelligence.derivedBehaviourSupport,
    derivedLegalEthical: intelligence.derivedLegalEthical,
    derivedRoutines: intelligence.derivedRoutines,
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

  const intelligence = extractDocumentIntelligence({
    text: safeText,
    fileName: found.fileName || found.title || "",
    explicitType: found.docType || "",
  });

  const updated = {
    ...found,
    extractedText: safeText,
    extractedAt: new Date().toISOString(),
    extractionMethod: meta.extractionMethod || found.extractionMethod || "",
    ocrConfidence:
      typeof meta.ocrConfidence === "number"
        ? meta.ocrConfidence
        : found.ocrConfidence ?? null,

    docCategory: intelligence.category,
    sectionMap: intelligence.sectionMap,

    derivedGoals: uniq(intelligence.derivedGoals),
    derivedRisks: uniq(intelligence.derivedRisks),
    derivedSupports: uniq(intelligence.derivedSupports),
    derivedTriggers: uniq(intelligence.derivedTriggers),
    derivedCommunication: uniq(intelligence.derivedCommunication),
    derivedHealthClinical: uniq(intelligence.derivedHealthClinical),
    derivedStrengths: uniq(intelligence.derivedStrengths),
    derivedBehaviourSupport: uniq(intelligence.derivedBehaviourSupport),
    derivedLegalEthical: uniq(intelligence.derivedLegalEthical),
    derivedRoutines: uniq(intelligence.derivedRoutines),
  };

  await idbPut("documents", updated);
  notifyDocumentsChanged(updated.clientId);
  return updated;
}

/* -------------------------------------------
   Aggregate intelligence across a client
-------------------------------------------- */

export async function buildClientDocumentIntelligence(clientId) {
  const docs = await listDocumentsForClient(clientId);

  const bucket = {
    participantDetails: [],
    goals: [],
    strengths: [],
    functionalNeeds: [],
    healthClinical: [],
    risks: [],
    triggers: [],
    communication: [],
    behaviourSupport: [],
    legalEthical: [],
    routinesAndPreferences: [],
  };

  for (const d of docs) {
    bucket.participantDetails.push(...safeArray(d?.sectionMap?.participantDetails));
    bucket.goals.push(...safeArray(d?.derivedGoals));
    bucket.strengths.push(...safeArray(d?.derivedStrengths));
    bucket.functionalNeeds.push(...safeArray(d?.derivedSupports));
    bucket.healthClinical.push(...safeArray(d?.derivedHealthClinical));
    bucket.risks.push(...safeArray(d?.derivedRisks));
    bucket.triggers.push(...safeArray(d?.derivedTriggers));
    bucket.communication.push(...safeArray(d?.derivedCommunication));
    bucket.behaviourSupport.push(...safeArray(d?.derivedBehaviourSupport));
    bucket.legalEthical.push(...safeArray(d?.derivedLegalEthical));
    bucket.routinesAndPreferences.push(...safeArray(d?.derivedRoutines));
  }

  return {
    participantDetails: uniq(bucket.participantDetails),
    goals: uniq(bucket.goals),
    strengths: uniq(bucket.strengths),
    functionalNeeds: uniq(bucket.functionalNeeds),
    healthClinical: uniq(bucket.healthClinical),
    risks: uniq(bucket.risks),
    triggers: uniq(bucket.triggers),
    communication: uniq(bucket.communication),
    behaviourSupport: uniq(bucket.behaviourSupport),
    legalEthical: uniq(bucket.legalEthical),
    routinesAndPreferences: uniq(bucket.routinesAndPreferences),
    documentCount: docs.length,
  };
}