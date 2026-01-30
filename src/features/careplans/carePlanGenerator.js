// src/features/careplans/carePlanGenerator.js

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function hasAny(text, keywords = []) {
  const t = (text || "").toLowerCase();
  return keywords.some((k) => t.includes(k));
}

function findLines(text, patterns = [], limit = 10) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const hits = [];
  for (const line of lines) {
    if (patterns.some((p) => p.test(line))) hits.push(line);
    if (hits.length >= limit) break;
  }
  return hits;
}

function bullets(lines, fallback) {
  if (!lines || lines.length === 0) return fallback;
  return lines.map((l) => `• ${l}`).join("\n");
}

function makeRiskLevel(risks) {
  const high = ["falls", "shortness of breath", "chest pain", "suicid", "wandering", "self-harm"];
  if (risks.some((r) => high.some((h) => r.toLowerCase().includes(h)))) return "High";
  if (risks.length >= 2) return "Medium";
  return risks.length ? "Low" : "Unknown";
}

/**
 * Build findings from documents (textContent + extractedText)
 */
export function buildFindingsFromDocs(docs = []) {
  const combined = normalize(
    (docs || [])
      .map((d) => [d.textContent, d.extractedText].filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n")
  );

  const risks = [];
  if (hasAny(combined, ["fall", "falls", "slipped", "unsteady"])) risks.push("Falls risk");
  if (hasAny(combined, ["shortness of breath", "sob", "breathless"])) risks.push("Breathing difficulty");
  if (hasAny(combined, ["swelling", "oedema", "fluid retention"])) risks.push("Fluid retention / swelling");
  if (hasAny(combined, ["refused medication", "missed dose", "did not take medication"])) risks.push("Medication non-adherence");
  if (hasAny(combined, ["agitated", "aggression", "escalation"])) risks.push("Behaviour escalation");
  if (hasAny(combined, ["low mood", "depressed", "hopeless", "anxiety"])) risks.push("Mental health distress risk");
  if (hasAny(combined, ["wandering", "abscond"])) risks.push("Wandering / absconding risk");
  if (hasAny(combined, ["choking", "aspiration", "swallow"])) risks.push("Swallowing / choking risk");

  const goals = [];
  if (hasAny(combined, ["goal:", "goals:", "aim:", "objective:"])) goals.push("Goals mentioned in notes (review & confirm)");
  if (hasAny(combined, ["walk", "mobility", "exercise"])) goals.push("Maintain/improve mobility");
  if (hasAny(combined, ["hydration", "fluids", "drink"])) goals.push("Hydration support");
  if (hasAny(combined, ["independent", "independence"])) goals.push("Increase independence / active support");
  if (hasAny(combined, ["routine", "structure", "predictable"])) goals.push("Maintain predictable routines");
  if (hasAny(combined, ["community", "social", "participation"])) goals.push("Increase community participation / social inclusion");

  const preferences = [];
  if (hasAny(combined, ["prefers", "likes", "responds well", "calm music", "music"])) {
    preferences.push("Responds well to calming activities (e.g., music / quiet walks)");
  }
  if (hasAny(combined, ["shorter activities", "gets tired", "fatigue"])) {
    preferences.push("Prefers short activities with rest breaks");
  }
  if (hasAny(combined, ["predictable", "routine"])) {
    preferences.push("Prefers predictable routine and clear communication");
  }

  const medsFlags = [];
  if (hasAny(combined, ["medication", "mar", "dose", "tablet"])) medsFlags.push("Medication support referenced");
  if (hasAny(combined, ["refused", "missed"])) medsFlags.push("Potential missed/refused medication mentioned");

  // Evidence-based line pulls
  const goalsLines = findLines(combined, [/goal/i, /aim/i, /objective/i, /would like/i, /wants to/i], 8);
  const risksLines = findLines(combined, [/fall/i, /risk/i, /incident/i, /aggress/i, /self harm|suicid/i, /wander|abscond/i], 10);
  const commLines = findLines(combined, [/communicat/i, /prefers/i, /simple language/i, /visual/i, /processing time/i], 8);
  const routineLines = findLines(combined, [/routine/i, /morning/i, /evening/i, /sleep/i], 8);

  return {
    combinedText: combined,
    goals: [...new Set(goals)],
    risks: [...new Set(risks)],
    preferences: [...new Set(preferences)],
    medsFlags: [...new Set(medsFlags)],
    riskLevel: makeRiskLevel([...new Set(risks)]),

    // Evidence lines
    goalsLines,
    risksLines,
    commLines,
    routineLines,
  };
}

/**
 * Generate a safe NDIS-aligned draft
 * Returns:
 * - planUi: fits your CarePlanZone fields
 * - structured: 12-section plan (for PDF and future UI)
 */
export function generateCarePlanDraft({ client, findings, recentSessions = [], evidenceCount = 0 }) {
  const clientName = client?.name || "Client";

  const uiPlan = {
    goalsShort: findings?.goalsLines?.length
      ? bullets(findings.goalsLines, "• Confirm participant short-term goals")
      : bullets(findings?.goals || [], "• Confirm participant short-term goals"),
    goalsLong: bullets(
      [
        "Maintain independence and participation aligned to NDIS goals.",
        "Support stable routines and gradual skill development (active support).",
      ],
      "• Confirm participant long-term goals"
    ),
    risks: findings?.risksLines?.length
      ? bullets(findings.risksLines, "• Identify risks and controls (falls, behaviour, health changes)")
      : bullets(findings?.risks || [], "• Identify risks and controls (falls, behaviour, health changes)"),
    communication: findings?.commLines?.length
      ? bullets(findings.commLines, "• Use clear respectful communication; confirm preferences")
      : "• Use clear, respectful communication\n• Allow processing time\n• Confirm understanding",
    supports: bullets(
      [
        "Use person-centred, strengths-based practice and active support (do-with, not do-for).",
        "Support ADLs and routines as required (prompting/partial/full assistance as appropriate).",
        "Document supports delivered and outcomes each shift/session.",
      ],
      "• Map supports to participant goals"
    ),
    legalEthical: [
      "• Maintain privacy/confidentiality and consent for sharing information.",
      "• Duty of care + dignity of risk: support participation with managed risks.",
      "• Mandatory reporting if abuse/neglect/exploitation indicators exist (per policy).",
      "• Restrictive practices only if authorised and documented (if applicable).",
    ].join("\n"),

    meta: {
      generatedAt: new Date().toISOString(),
      evidenceCount,
      clientId: client?.id || "",
    },
  };

  const structured = {
    participantDetailsPlanInfo: [
      `Name: ${clientName}`,
      `Age/DOB: ${client?.age ?? ""}`,
      "NDIS number: (add)",
      "Address/contact: (add)",
      "Emergency contact: (add)",
      "Plan start/review dates: (add)",
      "Support coordinator/provider: (add)",
    ].join("\n"),
    participantGoals: bullets(findings?.goalsLines || findings?.goals || [], "• Add goals from NDIS plan (participant’s words)"),
    strengthsInterests: bullets(findings?.preferences || [], "• Add strengths, interests, motivators (strength-based)"),
    functionalSupportNeeds: "• Personal care (shower/dress/groom): (add)\n• Mobility/transfers: (add)\n• Communication: (add)\n• Community access: (add)\n• Behaviour/cognitive: (add)",
    healthClinicalConsiderations:
      "• Include ONLY relevant info sourced from professionals.\n• Medication overview: name + purpose only (no prescribing).\n• Allied health involvement: OT/Psych/Physio/GP (add).",
    riskAssessmentManagement: bullets(findings?.risksLines || findings?.risks || [], "• Add risks + triggers + prevention + response steps"),
    behaviourSupportIfApplicable:
      "• If behaviours of concern exist: PBS strategies, what works/doesn’t, trauma-informed supports.\n• Restrictive practices only if authorised and documented.",
    dailyRoutinesSchedule: bullets(findings?.routineLines || [], "• Add morning/day/evening routines and variations"),
    communicationDecisionMakingPreferences: bullets(findings?.commLines || [], "• Add decision-making preferences + who to involve"),
    safeguardsPrivacyConsent:
      "• Consent for information sharing: (add)\n• Privacy preferences: (add)\n• Nominee/guardian: (add)\n• Advocacy supports: (add)",
    monitoringReviewOutcomes:
      `• Track progress via session notes, observations, and reports.\n• Review frequency: (e.g., fortnightly/monthly).\n• Evidence sources: ${evidenceCount} documents + ${recentSessions.length} sessions.`,
    signaturesAcknowledgements:
      "Participant/rep signature: __________________  Date: ________\nProvider signature: _________________________  Date: ________",
  };

  return {
    planUi: uiPlan,
    structured,
    title: `Care Plan Draft — ${clientName}`,
  };
}
