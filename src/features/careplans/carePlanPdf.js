// src/features/careplans/carePlanPdf.js
import jsPDF from "jspdf";

/**
 * Professional PDF export for Theraa Nurse care plans:
 * - Bigger fonts
 * - Sectioned layout
 * - Word wrapping
 * - Page breaks
 * - Supports legacy flat-plan fields AND structured plan.sections
 */

export function generateCarePlanPdf({ client, planVersion }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Page / layout constants
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const maxWidth = pageWidth - marginX * 2;

  let y = 14;

  const safe = (v) => (v == null ? "" : String(v));

  const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

const toText = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter(Boolean).map(String).join("\n");
  if (typeof v === "object") return "";
  return String(v);
};

  const newPageIfNeeded = (required = 8) => {
    if (y + required > pageHeight - 14) {
      doc.addPage();
      y = 14;
    }
  };

  const hr = () => {
    newPageIfNeeded(6);
    doc.setDrawColor(220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
  };

  const title = (text) => {
    newPageIfNeeded(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(text, marginX, y);
    y += 10;
  };

  const subTitle = (text) => {
    newPageIfNeeded(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(text, marginX, y);
    y += 7;
  };

  const heading = (text) => {
    newPageIfNeeded(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(text, marginX, y);
    y += 7;
  };

const paragraph = (text, fontSize = 11, lineGap = 5.2) => {
  const t = toText(text).trim() || "—";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);

  const lines = doc.splitTextToSize(t, maxWidth);
  for (const line of lines) {
    newPageIfNeeded(lineGap);
    doc.text(line, marginX, y);
    y += lineGap;
  }
  y += 1;
};


const bulletList = (items = [], fontSize = 11, lineGap = 5.2) => {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return paragraph("—", fontSize, lineGap);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);

  const indent = 4;

  for (const item of arr) {
    const t = safe(item).trim();
    if (!t) continue;

    const wrapped = doc.splitTextToSize(t, maxWidth - indent);
    wrapped.forEach((line, idx) => {
      newPageIfNeeded(lineGap);
      const prefix = idx === 0 ? "• " : "  ";
      doc.text(prefix + line, marginX, y);
      y += lineGap;
    });
    y += 1;
  }
  y += 1;
};


  // Helpers to support both "legacy" and "structured" plans
  const plan = planVersion?.plan || {};
  const sections = plan?.sections || {};

const getLegacyOrSection = (legacyKey, sectionKey) => {
  if (isNonEmptyString(plan?.[legacyKey])) return plan[legacyKey];
  if (isNonEmptyString(sections?.[sectionKey])) return sections[sectionKey];
  return "";
};

  const getArray = (maybeArray, fallback = []) => {
    if (Array.isArray(maybeArray)) return maybeArray.filter(Boolean);
    return fallback;
  };

  const createdAt = planVersion?.createdAt
    ? new Date(planVersion.createdAt).toLocaleString()
    : new Date().toLocaleString();

  // ---- Header ----
  title("Theraa Nurse — Care Plan");
  subTitle("Versioned · Evidence-bound · Reviewable");
  hr();

  // ---- Client identity ----
  heading("Participant Details & Plan Information");
  paragraph(`Client: ${safe(client?.name) || "—"}`);
  paragraph(`Age: ${safe(client?.age) || "—"}`);
  paragraph(`Client ID: ${safe(client?.id) || "—"}`);
  paragraph(`Plan status: ${safe(planVersion?.status) || "draft"}`);
  paragraph(`Created: ${createdAt}`);
  paragraph(`Evidence items used: ${safe(planVersion?.evidenceCount ?? 0)}`);

  // Optional: if you later add NDIS fields into client record
  if (client?.ndisNumber || client?.dob || client?.planStart || client?.planReviewDue) {
    hr();
    heading("NDIS & Plan Identifiers");
    if (client?.ndisNumber) paragraph(`NDIS Number: ${safe(client.ndisNumber)}`);
    if (client?.dob) paragraph(`DOB: ${safe(client.dob)}`);
    if (client?.planStart) paragraph(`Plan start date: ${safe(client.planStart)}`);
    if (client?.planReviewDue) paragraph(`Plan review due: ${safe(client.planReviewDue)}`);
  }

  hr();

  // ---- Goals ----
  heading("Participant Goals (NDIS-aligned)");
  subTitle("Short-term goals");
  paragraph(getLegacyOrSection("goalsShort", "goalsShort"));

  subTitle("Long-term goals");
  paragraph(getLegacyOrSection("goalsLong", "goalsLong"));

  hr();

  // ---- Strengths / preferences ----
  heading("Current Abilities, Strengths & Interests");
  paragraph(sections?.strengths || plan?.strengths || "—");

  heading("Daily Routines & Preferences");
  paragraph(sections?.routinesAndPreferences || plan?.routinesAndPreferences || "—");

  hr();

  // ---- Functional needs ----
  heading("Functional Support Needs");
  paragraph(sections?.functionalNeeds || plan?.functionalNeeds || plan?.supports || "—");

  hr();

  // ---- Clinical / health ----
  heading("Health & Clinical Considerations (scope-safe)");
  paragraph(sections?.healthClinical || plan?.healthClinical || "—");

  hr();

  // ---- Risks ----
  heading("Risk Assessment & Management Strategies");
  paragraph(getLegacyOrSection("risks", "risks"));

  // If you have structured risks list:
  if (Array.isArray(sections?.riskControls) && sections.riskControls.length) {
    subTitle("Risk controls");
    bulletList(sections.riskControls);
  }

  hr();

  // ---- Behaviour support ----
  heading("Behaviour Support (if applicable)");
  paragraph(sections?.behaviourSupport || plan?.behaviourSupport || "—");

  hr();

  // ---- Communication + consent ----
  heading("Communication & Decision-Making Preferences");
  paragraph(getLegacyOrSection("communication", "communication"));

  heading("Safeguards, Privacy & Consent");
  paragraph(sections?.safeguardsConsent || plan?.safeguardsConsent || "—");

  hr();

  // ---- Monitoring ----
  heading("Monitoring, Review & Outcomes Tracking");
  paragraph(sections?.monitoringReview || plan?.monitoringReview || "—");

  hr();

  // ---- To-Dos + approvals ----
  heading("To-Do / Suggestions (subject to approval)");

  const todos = plan?.todos || {};
  const clientTodos = getArray(todos?.client);
  const workerTodos = getArray(todos?.worker);

  subTitle("Client to-dos (participant actions)");
  bulletList(clientTodos.length ? clientTodos : ["No client suggestions generated yet."]);

  subTitle("Worker to-dos (support actions)");
  bulletList(workerTodos.length ? workerTodos : ["No worker suggestions generated yet."]);

  // Approval summary (if present)
  const approvals = plan?.approvals || {};
  const approvedClient = getArray(approvals?.approvedClient);
  const approvedWorker = getArray(approvals?.approvedWorker);

  if (approvedClient.length || approvedWorker.length) {
    hr();
    heading("Approved To-Dos (active)");
    subTitle("Approved client to-dos");
    bulletList(approvedClient.length ? approvedClient : ["—"]);

    subTitle("Approved worker to-dos");
    bulletList(approvedWorker.length ? approvedWorker : ["—"]);
  }

  hr();

  // ---- Sign-off ----
  heading("Signatures & Acknowledgements");
  paragraph("Participant / Representative: ________________________________");
  paragraph("Provider / Coordinator: ______________________________________");
  paragraph("Date: ______________________");

  const fileName = `TheraaNurse-CarePlan-${(client?.name || "Client").replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}
