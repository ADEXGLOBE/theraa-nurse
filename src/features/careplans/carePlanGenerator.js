// src/features/careplans/carePlanGenerator.js

// Very safe MVP: rule-based extraction from text
// Later we can upgrade to smarter NLP + OCR outputs.
function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function findAny(text, keywords = []) {
  const t = (text || "").toLowerCase();
  return keywords.some((k) => t.includes(k));
}

function extractListByKeywords(text, keywords) {
  const t = (text || "").toLowerCase();
  const hits = [];
  for (const k of keywords) {
    if (t.includes(k.toLowerCase())) hits.push(k);
  }
  return [...new Set(hits)];
}

function makeRiskLevel(risks) {
  // Simple heuristic
  const high = ["falls", "shortness of breath", "chest pain", "suicid", "wandering"];
  if (risks.some((r) => high.some((h) => r.toLowerCase().includes(h)))) return "High";
  if (risks.length >= 2) return "Medium";
  return risks.length ? "Low" : "Unknown";
}

export function buildFindingsFromDocs(docs = []) {
  const combined = normalize(
    docs
      .map((d) => [d.textContent, d.extractedText].filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n")
  );

  const risks = [];
  if (findAny(combined, ["fall", "falls", "slipped", "unsteady"])) risks.push("Falls risk");
  if (findAny(combined, ["shortness of breath", "sob", "breathless"])) risks.push("Breathing difficulty");
  if (findAny(combined, ["swelling", "oedema", "fluid retention"])) risks.push("Fluid retention / swelling");
  if (findAny(combined, ["refused medication", "missed dose", "did not take medication"])) risks.push("Medication non-adherence");
  if (findAny(combined, ["agitated", "aggression", "escalation"])) risks.push("Behaviour escalation");
  if (findAny(combined, ["low mood", "depressed", "hopeless", "anxiety"])) risks.push("Mental health risk");
  if (findAny(combined, ["wandering", "abscond"])) risks.push("Wandering / absconding risk");
  if (findAny(combined, ["choking", "aspiration"])) risks.push("Swallowing / choking risk");

  const goals = [];
  if (findAny(combined, ["goal:", "goals:", "aim:", "objective:"])) goals.push("Goals mentioned in notes (review & confirm)");
  if (findAny(combined, ["walk", "mobility", "exercise"])) goals.push("Maintain/improve mobility");
  if (findAny(combined, ["hydration", "fluids", "drink"])) goals.push("Hydration support");
  if (findAny(combined, ["independent", "independence"])) goals.push("Increase independence / active support");
  if (findAny(combined, ["routine", "structure", "predictable"])) goals.push("Maintain predictable routines");

  const preferences = [];
  if (findAny(combined, ["prefers", "likes", "responds well", "calm music", "music therapy"])) {
    preferences.push("Responds well to calming activities (e.g., music / quiet walks)");
  }
  if (findAny(combined, ["shorter activities", "gets tired"])) {
    preferences.push("Prefers short activities with rest breaks");
  }
  if (findAny(combined, ["predictable", "routine"])) {
    preferences.push("Prefers predictable routine and clear communication");
  }

  const medsFlags = [];
  if (findAny(combined, ["medication", "mar", "dose", "tablet"])) medsFlags.push("Medication support referenced");
  if (findAny(combined, ["refused", "missed"])) medsFlags.push("Potential missed/refused medication mentioned");

  const triggers = extractListByKeywords(combined, [
    "noise",
    "change in routine",
    "new environment",
    "overstimulation",
    "sensory",
  ]).map((t) => `Trigger mentioned: ${t}`);

  const findings = {
    combinedText: combined,
    goals: [...new Set(goals)],
    risks: [...new Set(risks)],
    preferences: [...new Set(preferences)],
    medsFlags: [...new Set(medsFlags)],
    triggers: [...new Set(triggers)],
    riskLevel: makeRiskLevel([...new Set(risks)]),
  };

  return findings;
}

export function generateCarePlanDraft({ client, findings, recentSessions = [] }) {
  const clientName = client?.name || "Client";
  const diagnoses = client?.diagnoses?.length ? client.diagnoses.join(", ") : "Not provided";
  const keyRisks = client?.keyRisks?.length ? client.keyRisks.join(", ") : "Not provided";

  const plan = {
    title: `Care Plan Draft — ${clientName}`,
    generatedAt: new Date().toISOString(),
    clientId: client?.id || "",
    sections: {
      clientSummary: {
        clientName,
        age: client?.age ?? "",
        diagnoses,
        baselineRisks: keyRisks,
        riskLevel: findings?.riskLevel || "Unknown",
      },
      goals: findings?.goals?.length ? findings.goals : ["Confirm client goals and preferred outcomes"],
      supports: [
        "Use person-centred, strengths-based practice and active support (do-with, not do-for).",
        "Maintain privacy/confidentiality; document support delivered and outcomes.",
        "Support routines and preferences; use clear communication.",
      ],
      routinesAndPreferences: findings?.preferences?.length ? findings.preferences : ["Confirm preferred routines and activities"],
      risksAndControls: [
        ...(findings?.risks?.length ? findings.risks : ["Identify and document risks (falls, medication, behaviours, etc.)"]),
        "Complete and follow risk controls; escalate changes of condition per policy.",
      ],
      medicationSupport: findings?.medsFlags?.length
        ? findings.medsFlags.concat(["Document medication prompting/support, refusals, and escalation actions"])
        : ["If medication support is required: follow MAR/med chart, document prompting/refusal, escalate issues."],
      escalationPathway: [
        "Escalate immediately for: falls with injury, shortness of breath, chest pain, severe behaviour escalation, suspected abuse/neglect.",
        "Report to supervisor/clinical lead according to organisation policy; document actions taken.",
      ],
      documentationRequirements: [
        "Progress notes every shift (who/what/when/how/outcome).",
        "Incident report for falls/near misses/medication refusal/adverse reactions.",
        "Update care plan when needs/risks change; record approvals and version changes.",
      ],
      recentSessionSignals: recentSessions?.length
        ? [
            `Recent sessions recorded: ${recentSessions.length}. Review for trends in mood/risks/adherence.`,
          ]
        : ["No app sessions found yet; rely on documents and begin logging sessions consistently."],
    },
  };

  return plan;
}
