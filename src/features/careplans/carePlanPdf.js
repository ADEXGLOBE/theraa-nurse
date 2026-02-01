// src/features/careplans/carePlanPdf.js
import jsPDF from "jspdf";

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

export function generateCarePlanPdf({ client, planVersion }) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = 15;

  const marginX = 14;
  const maxWidth = pageWidth - marginX * 2;

  const ensurePage = (needed = 8) => {
    if (y + needed > pageHeight - 12) {
      doc.addPage();
      y = 15;
    }
  };

  const line = (text, fontSize = 11, gap = 6) => {
    ensurePage(gap + 2);
    doc.setFontSize(fontSize);
    doc.text(String(text || "—"), marginX, y);
    y += gap;
  };

  const block = (text, fontSize = 11, gap = 6) => {
    const content = String(text || "—");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(content, maxWidth);
    for (const l of lines) {
      ensurePage(gap + 2);
      doc.text(l, marginX, y);
      y += gap;
    }
  };

  const heading = (text) => {
    y += 2;
    ensurePage(10);
    doc.setFontSize(13);
    doc.text(String(text), marginX, y);
    y += 7;
  };

  const subheading = (text) => {
    ensurePage(8);
    doc.setFontSize(12);
    doc.text(String(text), marginX, y);
    y += 6;
  };

  const bullet = (text) => {
    const prefix = "• ";
    const content = String(text || "—");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(prefix + content, maxWidth);
    for (const l of lines) {
      ensurePage(6 + 2);
      doc.text(l, marginX, y);
      y += 6;
    }
  };

  const plan = planVersion?.plan || {};
  const suggestions = plan?.suggestions || {};
  const suggestedWorker = safeArray(suggestions.worker);
  const suggestedClient = safeArray(suggestions.client);
  const approvedWorker = safeArray(suggestions.approvedWorker);
  const approvedClient = safeArray(suggestions.approvedClient);

  // Title
  doc.setFontSize(16);
  line("Theraa Nurse – Care Plan", 16, 8);

  doc.setFontSize(11);
  y += 2;

  // Header fields
  line(`Client: ${client?.name || "—"}`);
  line(`Age: ${client?.age ?? "—"}`);
  line(`Client ID: ${client?.id || "—"}`);
  line(`Plan status: ${planVersion?.status || "—"}`);
  line(`Created: ${formatDate(planVersion?.createdAt) || "—"}`);
  line(`Evidence items used: ${planVersion?.evidenceCount || 0}`);

  if (plan?.suggestionsGeneratedAt) {
    line(`Suggestions generated: ${formatDate(plan.suggestionsGeneratedAt)}`);
  }

  y += 4;

  // Core plan sections
  heading("Short-term goals");
  block(plan.goalsShort || "—");

  y += 2;
  heading("Long-term goals");
  block(plan.goalsLong || "—");

  y += 2;
  heading("Risks & safety considerations");
  block(plan.risks || "—");

  y += 2;
  heading("Communication strategies");
  block(plan.communication || "—");

  y += 2;
  heading("Supports");
  block(plan.supports || "—");

  y += 2;
  heading("Legal & ethical notes");
  block(plan.legalEthical || "—");

  // To-Dos Section
  y += 4;
  heading("To-Do / Suggestions (Approval Required)");

  // Suggested Worker
  subheading("Suggested Worker To-Dos (requires approval)");
  if (suggestedWorker.length === 0) {
    block("— None —");
  } else {
    suggestedWorker.forEach((t, idx) => {
      bullet(`${idx + 1}. ${t.title || "To-Do"}`);
      if (t.frequency) bullet(`Frequency: ${t.frequency}`);
      if (t.detail) bullet(`Details: ${t.detail}`);
      if (t.reason) bullet(`Evidence: ${t.reason}`);
      y += 2;
    });
  }

  // Suggested Client
  subheading("Suggested Client To-Dos (requires approval)");
  if (suggestedClient.length === 0) {
    block("— None —");
  } else {
    suggestedClient.forEach((t, idx) => {
      bullet(`${idx + 1}. ${t.title || "To-Do"}`);
      if (t.frequency) bullet(`Frequency: ${t.frequency}`);
      if (t.detail) bullet(`Details: ${t.detail}`);
      if (t.reason) bullet(`Evidence: ${t.reason}`);
      y += 2;
    });
  }

  // Approved Worker
  y += 2;
  heading("Approved To-Dos (Operational)");

  subheading("Approved Worker To-Dos (what workers should follow)");
  if (approvedWorker.length === 0) {
    block("— None approved yet —");
  } else {
    approvedWorker.forEach((t, idx) => {
      bullet(`${idx + 1}. ${t.title || "To-Do"}`);
      if (t.frequency) bullet(`Frequency: ${t.frequency}`);
      if (t.detail) bullet(`Details: ${t.detail}`);
      if (t.reason) bullet(`Evidence: ${t.reason}`);
      if (t.approvedBy || t.approvedAt) {
        bullet(
          `Approved: ${t.approvedBy ? `by ${t.approvedBy}` : ""}${t.approvedAt ? ` at ${formatDate(t.approvedAt)}` : ""}`.trim()
        );
      }
      y += 2;
    });
  }

  // Approved Client
  subheading("Approved Client To-Dos (what the client should start doing)");
  if (approvedClient.length === 0) {
    block("— None approved yet —");
  } else {
    approvedClient.forEach((t, idx) => {
      bullet(`${idx + 1}. ${t.title || "To-Do"}`);
      if (t.frequency) bullet(`Frequency: ${t.frequency}`);
      if (t.detail) bullet(`Details: ${t.detail}`);
      if (t.reason) bullet(`Evidence: ${t.reason}`);
      if (t.approvedBy || t.approvedAt) {
        bullet(
          `Approved: ${t.approvedBy ? `by ${t.approvedBy}` : ""}${t.approvedAt ? ` at ${formatDate(t.approvedAt)}` : ""}`.trim()
        );
      }
      y += 2;
    });
  }

  y += 2;
  block(
    "Approval workflow note: Suggested To-Dos are recommendations only. Workers/clients should follow Approved To-Dos after coordinator/authorised approval. For external approvals, export this PDF and email it for sign-off."
  );

  doc.save(`TheraaNurse-CarePlan-${(client?.name || "Client").replace(/\s+/g, "_")}.pdf`);
}
