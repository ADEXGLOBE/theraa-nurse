// src/features/careplans/carePlanGenerator.js

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
  const high = ["falls", "shortness of breath", "chest pain", "suicid", "wandering"];
  if (risks.some((r) => high.some((h) => r.toLowerCase().includes(h)))) return "High";
  if (risks.length >= 2) return "Medium";
  return risks.length ? "Low" : "Unknown";
}

/**
 * Reads documents extracted text and produces safe, conservative "findings".
 * NOTE: We keep this very careful: functional language, not medical overreach.
 */
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
  if (findAny(combined, ["work", "study", "productivity", "focus"])) goals.push("Improve productivity and participation");

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

  return {
    combinedText: combined,
    goals: [...new Set(goals)],
    risks: [...new Set(risks)],
    preferences: [...new Set(preferences)],
    medsFlags: [...new Set(medsFlags)],
    triggers: [...new Set(triggers)],
    riskLevel: makeRiskLevel([...new Set(risks)]),
  };
}

/**
 * Suggestion objects are approval-gated.
 * - type: "worker_action" | "client_action"
 * - approvalStatus: "pending" | "approved" | "rejected"
 */
function makeSuggestion({ type, title, detail, frequency = "", evidenceRef = "" }) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    title,
    detail,
    frequency,
    evidenceRef,
    approvalStatus: "pending",
    approvedBy: "",
    approvedAt: "",
    notes: "",
  };
}

function buildWorkerSuggestions(findings) {
  const suggestions = [];

  // universal worker actions
  suggestions.push(
    makeSuggestion({
      type: "worker_action",
      title: "Document each shift (progress note)",
      detail:
        "Record what happened, what supports were provided, what worked, outcomes, and any changes. Escalate per policy if risk increases.",
      frequency: "Every shift",
    })
  );

  suggestions.push(
    makeSuggestion({
      type: "worker_action",
      title: "Maintain routine and active support",
      detail:
        "Use strengths-based, person-centred support. Maintain predictable routine and use ‘do-with’ approaches to build independence.",
      frequency: "Daily",
    })
  );

  const r = (findings?.risks || []).join(" ").toLowerCase();

  if (r.includes("falls")) {
    suggestions.push(
      makeSuggestion({
        type: "worker_action",
        title: "Falls prevention check",
        detail:
          "Check environment for hazards (clutter, loose rugs). Encourage safe mobility and report concerns. Ensure assistive devices are available and used appropriately.",
        frequency: "Start of shift + as needed",
      })
    );
  }

  if (r.includes("medication")) {
    suggestions.push(
      makeSuggestion({
        type: "worker_action",
        title: "Medication prompting and refusal pathway",
        detail:
          "Prompt medication only as authorised (no administration unless qualified). Document refusals/missed prompts and escalate to supervisor/clinician per protocol.",
        frequency: "As scheduled",
      })
    );
  }

  if (r.includes("mental health")) {
    suggestions.push(
      makeSuggestion({
        type: "worker_action",
        title: "Mental health safety monitoring",
        detail:
          "Monitor early warning signs, offer calm space/de-escalation supports, and escalate immediately if risk to self/others is suspected.",
        frequency: "Ongoing",
      })
    );
  }

  if (r.includes("behaviour")) {
    suggestions.push(
      makeSuggestion({
        type: "worker_action",
        title: "Behaviour support (low arousal)",
        detail:
          "Use low-arousal communication, reduce triggers, document antecedents/triggers and what strategies helped.",
        frequency: "As needed",
      })
    );
  }

  if (r.includes("wandering")) {
    suggestions.push(
      makeSuggestion({
        type: "worker_action",
        title: "Wandering risk plan check",
        detail:
          "Confirm safety plan, increase supervision during transitions, document incidents and notify coordinator/provider.",
        frequency: "Daily + transitions",
      })
    );
  }

  return suggestions;
}

function buildClientActionSuggestions(findings, client) {
  const suggestions = [];
  const name = client?.name || "Client";
  const combined = (findings?.combinedText || "").toLowerCase();
  const risks = (findings?.risks || []).join(" ").toLowerCase();
  const goals = (findings?.goals || []).join(" ").toLowerCase();

  // safe, general wellbeing suggestions (not medical advice; they are "discuss with provider")
  suggestions.push(
    makeSuggestion({
      type: "client_action",
      title: `${name} to follow a simple weekly routine plan`,
      detail:
        "Agree on a simple routine (wake/sleep, meals, activities). Use a planner or phone reminders. Review monthly with support coordinator.",
      frequency: "Weekly plan + monthly review",
    })
  );

  if (goals.includes("mobility") || risks.includes("falls") || combined.includes("exercise")) {
    suggestions.push(
      makeSuggestion({
        type: "client_action",
        title: `${name} to start gentle exercise / movement routine`,
        detail:
          "Discuss an appropriate exercise plan with an allied health professional (e.g., physio/OT). Start with short daily walks or approved exercises to support mobility and wellbeing.",
        frequency: "Daily (as approved)",
      })
    );
  }

  if (goals.includes("productivity") || combined.includes("work") || combined.includes("study") || combined.includes("focus")) {
    suggestions.push(
      makeSuggestion({
        type: "client_action",
        title: `${name} to build productivity supports`,
        detail:
          "Consider a monthly session with a lifestyle coach or business coach (if goals include work/study). Use a weekly goal tracker (sleep, activity, tasks).",
        frequency: "Monthly coaching + weekly tracking",
      })
    );
  }

  if (risks.includes("mental health") || combined.includes("anxiety") || combined.includes("low mood")) {
    suggestions.push(
      makeSuggestion({
        type: "client_action",
        title: `${name} to engage in wellbeing supports`,
        detail:
          "Discuss wellbeing supports with clinician/provider: coping strategies, routine, social participation. If symptoms worsen or safety concerns arise, escalate immediately via the care team/000.",
        frequency: "Weekly supports + as needed",
      })
    );
  }

  if (combined.includes("sleep") || combined.includes("fatigue") || combined.includes("tired")) {
    suggestions.push(
      makeSuggestion({
        type: "client_action",
        title: `${name} to improve sleep hygiene`,
        detail:
          "Agree on a consistent bedtime routine (reduce screens late, calming activity). Review effectiveness with provider and adjust as needed.",
        frequency: "Nightly routine",
      })
    );
  }

  if (combined.includes("diet") || combined.includes("nutrition") || combined.includes("weight") || combined.includes("appetite")) {
    suggestions.push(
      makeSuggestion({
        type: "client_action",
        title: `${name} to follow nutrition support plan`,
        detail:
          "Discuss nutrition plan with GP/dietitian if relevant. Track meals/hydration and note barriers (sensory, fatigue, routine).",
        frequency: "Daily tracking + monthly review",
      })
    );
  }

  // keep it practical and safe
  suggestions.push(
    makeSuggestion({
      type: "client_action",
      title: `${name} to increase social participation`,
      detail:
        "Plan at least one community/social activity per week (as tolerated). Build confidence gradually and log what felt supportive or stressful.",
      frequency: "Weekly",
    })
  );

  return suggestions;
}

/**
 * Generates a draft care plan object with approval-gated suggestions.
 * This is still MVP: conservative + functional + safe language.
 */
export function generateCarePlanDraft({ client, findings, recentSessions = [] }) {
  const clientName = client?.name || "Client";
  const diagnoses = client?.diagnoses?.length ? client.diagnoses.join(", ") : "Not provided";
  const keyRisks = client?.keyRisks?.length ? client.keyRisks.join(", ") : "Not provided";

  const workerSuggestions = buildWorkerSuggestions(findings);
  const clientActionSuggestions = buildClientActionSuggestions(findings, client);

  return {
    title: `Care Plan Draft — ${clientName}`,
    generatedAt: new Date().toISOString(),
    clientId: client?.id || "",

    // ✅ Approval-gated suggestions:
    suggestions: {
      worker: workerSuggestions,
      client: clientActionSuggestions,
    },

    // ✅ Approved actions become operational:
    approved: {
      worker: [], // array of suggestion ids
      client: [], // array of suggestion ids
    },

    // ✅ Approval request metadata (for PDF + emailing workflow)
    approval: {
      status: "pending", // pending | approved | partially_approved
      requestedAt: new Date().toISOString(),
      requestedBy: "", // coordinator name (optional)
      approvedBy: "",
      approvedAt: "",
      notes: "Share this PDF for approvals. Approved items must be recorded and versioned.",
    },

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
        "Person-centred, strengths-based practice and active support.",
        "Maintain privacy/confidentiality; document supports and outcomes.",
        "Support routine and preferences; use clear communication.",
      ],

      routinesAndPreferences: findings?.preferences?.length
        ? findings.preferences
        : ["Confirm preferred routines, motivators, and calming strategies"],

      risksAndControls: [
        ...(findings?.risks?.length ? findings.risks : ["Identify and document risks (falls, medication, behaviours, etc.)"]),
        "Follow risk controls; escalate changes of condition per organisational policy.",
      ],

      medicationSupport: findings?.medsFlags?.length
        ? findings.medsFlags.concat(["Document prompting/support, refusals, and escalation actions"])
        : ["If medication support is required: follow MAR/med chart, document prompting/refusal, escalate issues."],

      escalationPathway: [
        "Escalate immediately for: injury after fall, shortness of breath, chest pain, severe escalation, suspected abuse/neglect.",
        "Report to supervisor/clinical lead according to policy; document actions taken.",
      ],

      documentationRequirements: [
        "Progress notes every shift (who/what/when/how/outcome).",
        "Incident report for falls/near misses/med refusal/adverse reactions.",
        "Update care plan when needs/risks change; record approvals and version changes.",
      ],

      recentSessionSignals: recentSessions?.length
        ? [`Recent sessions recorded: ${recentSessions.length}. Review for trends in mood/risks/adherence.`]
        : ["No app sessions found yet; rely on documents and begin logging sessions consistently."],
    },
  };
}
