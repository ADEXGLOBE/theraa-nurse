// src/features/careplans/carePlanPdf.js
import jsPDF from "jspdf";

/**
 * Care Plan PDF Export
 * - Wraps long text safely
 * - Auto page breaks
 * - Includes approval workflow + To-Do/Suggestions (worker + client)
 *
 * Expected data shapes:
 * planVersion = { status, createdAt, evidenceCount, plan: { ... } }
 * planVersion.plan may be either:
 *  A) legacy fields: goalsShort, goalsLong, risks, communication, supports, legalEthical
 *  B) new generator structure: title, sections{}, approval{}, suggestions{}
 */
export function generateCarePlanPdf({ client, planVersion }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Layout constants
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const topY = 14;
  const bottomMargin = 14;
  const lineGap = 5;

  let y = topY;

  const ensureSpace = (needed = 10) => {
    if (y + needed > pageHeight - bottomMargin) {
      doc.addPage();
      y = topY;
    }
  };

  const hr = () => {
    ensureSpace(6);
    doc.setDrawColor(220);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
  };

  const write = (text = "", opts = {}) => {
    const {
      fontSize = 11,
      style = "normal",
      indent = 0,
      spacing = lineGap,
      maxWidth = pageWidth - marginX * 2 - indent,
    } = opts;

    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);

    const safe = String(text ?? "—");
    const lines = doc.splitTextToSize(safe, maxWidth);

    lines.forEach((ln) => {
      ensureSpace(6);
      doc.text(ln, marginX + indent, y);
      y += spacing;
    });
  };

  const heading = (title) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, marginX, y);
    y += 7;
  };

  const subheading = (title) => {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, marginX, y);
    y += 6;
  };

  // Helpers to read plan fields whether legacy or new structure
  const plan = planVersion?.plan || {};
  const approval = plan.approval || null;
  const suggestions = plan.suggestions || null;
  const sections = plan.sections || null;

  const getLegacyOrNew = (legacyKey, newPath) => {
    // newPath can be like sections.risksAndControls -> array or string
    if (plan?.[legacyKey] != null && plan?.[legacyKey] !== "") return plan[legacyKey];

    if (!newPath) return "—";
    const parts = newPath.split(".");
    let curr = plan;
    for (const p of parts) {
      curr = curr?.[p];
      if (curr == null) break;
    }
    if (curr == null) return "—";
    return curr;
  };

  const asText = (val) => {
    if (Array.isArray(val)) return val.length ? val.map((v) => `• ${v}`).join("\n") : "—";
    if (typeof val === "object" && val) return JSON.stringify(val, null, 2);
    const s = String(val ?? "—");
    return s.trim() ? s : "—";
  };

  const statusBadge = (s) => {
    const up = String(s || "").toUpperCase();
    if (!up) return "—";
    return up;
  };

  // ---------- Header ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Theraa Nurse – Care Plan", marginX, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  write(`Client: ${client?.name || "—"}`, { fontSize: 11, spacing: 5 });
  write(`Age: ${client?.age ?? "—"}`, { fontSize: 11, spacing: 5 });
  write(`Client ID: ${client?.id || "—"}`, { fontSize: 11, spacing: 5 });
  write(`Plan status: ${planVersion?.status || "draft"}`, { fontSize: 11, spacing: 5 });
  write(`Created: ${planVersion?.createdAt ? new Date(planVersion.createdAt).toLocaleString() : "—"}`, {
    fontSize: 11,
    spacing: 5,
  });
  write(`Evidence items used: ${planVersion?.evidenceCount || 0}`, { fontSize: 11, spacing: 5 });

  hr();

  // ---------- Approval block ----------
  heading("Approval & Sign-off");
  if (approval) {
    write(`Approval status: ${statusBadge(approval.status || "pending")}`, { style: "bold" });
    write(`Requested at: ${approval.requestedAt ? new Date(approval.requestedAt).toLocaleString() : "—"}`);
    write(`Requested by: ${approval.requestedBy || "—"}`);
    write(`Approved by: ${approval.approvedBy || "—"}`);
    write(`Approved at: ${approval.approvedAt ? new Date(approval.approvedAt).toLocaleString() : "—"}`);
    write(`Notes: ${approval.notes || "—"}`);
  } else {
    write(
      "This care plan includes draft suggestions that must be approved by the participant and/or provider before implementation.",
      { fontSize: 11 }
    );
    write("Approval status: PENDING (MVP)", { style: "bold" });
  }

  write("");
  write("Sign-off (manual):", { style: "bold" });
  write("Participant / Guardian: ____________________________   Date: ____/____/______");
  write("Provider / Clinician: _____________________________   Date: ____/____/______");
  write("Support Coordinator: ______________________________   Date: ____/____/______");

  hr();

  // ---------- Core plan sections ----------
  heading("Plan Summary");

  // If you have new generator structure, we can print richer detail.
  // If not, we fall back to your legacy text blocks.
  const shortGoals = getLegacyOrNew("goalsShort", "sections.goals");
  const longGoals = getLegacyOrNew("goalsLong", null);
  const risks = getLegacyOrNew("risks", "sections.risksAndControls");
  const comms = getLegacyOrNew("communication", "sections.routinesAndPreferences");
  const supports = getLegacyOrNew("supports", "sections.supports");
  const legal = getLegacyOrNew("legalEthical", "sections.documentationRequirements");

  subheading("Short-term goals");
  write(asText(shortGoals));

  write("");
  subheading("Long-term goals");
  write(asText(longGoals));

  write("");
  subheading("Risks & safety considerations");
  write(asText(risks));

  write("");
  subheading("Communication / preferences");
  write(asText(comms));

  write("");
  subheading("Supports");
  write(asText(supports));

  write("");
  subheading("Legal & ethical notes");
  write(asText(legal));

  hr();

  // ---------- To-Do / Suggestions ----------
  heading("To-Do / Suggestions (Approval Required)");

  const printSuggestionList = (title, list) => {
    subheading(title);
    if (!Array.isArray(list) || list.length === 0) {
      write("—");
      return;
    }

    list.forEach((sug, idx) => {
      ensureSpace(18);

      const sTitle = sug?.title || `Suggestion ${idx + 1}`;
      const sType = sug?.type || "";
      const sFreq = sug?.frequency ? `Frequency: ${sug.frequency}` : "";
      const sStatus = statusBadge(sug?.approvalStatus || "pending");
      const sDetail = sug?.detail || "—";
      const sEvidence = sug?.evidenceRef ? `Evidence: ${sug.evidenceRef}` : "";

      write(`${idx + 1}. ${sTitle}`, { style: "bold" });
      write(`Status: ${sStatus}${sType ? `  ·  Type: ${sType}` : ""}`, { indent: 4 });
      if (sFreq) write(sFreq, { indent: 4 });
      if (sEvidence) write(sEvidence, { indent: 4 });
      write(`Detail: ${sDetail}`, { indent: 4 });
      write("");
    });
  };

  if (suggestions && (suggestions.worker || suggestions.client)) {
    printSuggestionList("A) Support Worker / Care Team Actions", suggestions.worker || []);
    write("");
    printSuggestionList("B) Client Actions (Goals / Lifestyle / Participation)", suggestions.client || []);
  } else {
    write(
      "No suggestions found in this plan version. (Tip: regenerate the care plan using the updated generator so suggestions are included.)"
    );
  }

  hr();

  // ---------- Footer note ----------
  write(
    "Important: This document is a care planning support tool. Implement only approved actions and follow organisational policies, scope of practice, and NDIS requirements."
  );
  write("Versioning: Each update should be saved as a new plan version with approvals recorded.");

  // Save
  const safeName = (client?.name || "Client").replace(/\s+/g, "_");
  doc.save(`TheraaNurse-CarePlan-${safeName}.pdf`);
}
