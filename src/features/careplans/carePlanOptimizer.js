// src/features/careplans/carePlanOptimizer.js
// "Care Plan Optimisation AI" (rules-based for now; LLM-ready later).
// Improves section completeness, links supports to goals, and ensures scope-safe language.

const safe = (v) => (v == null ? "" : String(v)).trim();

function ensureText(current, fallback) {
  return safe(current) ? current : fallback;
}

export function optimiseCarePlan({
  client,
  plan,
  findings,
  adlSummary,
}) {
  const sections = { ...(plan?.sections || {}) };

  // Ensure core sections exist with NDIS-friendly structure
  sections.participantDetails = ensureText(
    sections.participantDetails,
    `Participant: ${client?.name || "—"}\nLiving situation: —\nKey contacts: —\nCommunication needs: —\nNDIS plan dates: —`
  );

  sections.goalsShort = ensureText(
    sections.goalsShort,
    plan?.goalsShort || "- Increase independence in daily routines\n- Maintain stable wellbeing and participation"
  );

  sections.goalsLong = ensureText(
    sections.goalsLong,
    plan?.goalsLong || "- Build capacity for community participation\n- Improve confidence and self-management over time"
  );

  sections.strengths = ensureText(
    sections.strengths,
    "Strengths/interests observed: — (add what the person enjoys and what works well)."
  );

  sections.functionalNeeds = ensureText(
    sections.functionalNeeds,
    plan?.supports || "Functional supports: — (include frequency + level of support)."
  );

  sections.healthClinical = ensureText(
    sections.healthClinical,
    "Health/clinical considerations: Include only evidence from reports/clinicians. Avoid unsupported medical claims."
  );

  sections.risks = ensureText(
    sections.risks,
    plan?.risks || "Risks/early warning signs: —\nRisk controls: —"
  );

  sections.communication = ensureText(
    sections.communication,
    plan?.communication || "Communication preferences: clear language, allow time, support decision-making and consent."
  );

  sections.monitoringReview = ensureText(
    sections.monitoringReview,
    `Review schedule: weekly mini-review + monthly summary.\nEvidence sources: session notes, incidents, ADL progress, goal-linked outcomes.\nCurrent functional level: ${adlSummary?.level || "—"}`
  );

  sections.legalEthical = ensureText(
    sections.legalEthical,
    plan?.legalEthical ||
      "Duty of care, dignity of risk, consent, privacy/confidentiality. Escalate concerns per policy; call 000 for emergencies."
  );

  // Add a small “NDIS outcome” framing into supports if missing
  if (!safe(sections.functionalNeeds).toLowerCase().includes("outcome")) {
    sections.functionalNeeds = `${sections.functionalNeeds}\n\nOutcomes focus: supports should link to goals and demonstrate functional progress (what changed for the participant).`;
  }

  // Optionally integrate findings quickly
  const risks = findings?.risks || [];
  if (Array.isArray(risks) && risks.length && !safe(sections.risks).includes("Auto")) {
    sections.risks = `${sections.risks}\n\nAuto-detected risks from evidence: ${risks.join(", ")}.`;
  }

  return { ...plan, sections };
}