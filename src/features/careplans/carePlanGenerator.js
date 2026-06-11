// src/features/careplans/carePlanGenerator.js

import { buildRunningSourcePlan } from "./runningSourceEngine";

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function lower(text) {
  return String(text || "").toLowerCase();
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function safeText(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return [
      value.textContent,
      value.extractedText,
      value.text,
      value.notes,
      value.summary,
      value.content,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

function findAny(text, keywords = []) {
  const t = lower(text);
  return safeArray(keywords).some((k) => t.includes(lower(k)));
}

function extractListByKeywords(text, keywords) {
  const t = lower(text || "");
  const hits = [];

  for (const k of safeArray(keywords)) {
    if (t.includes(lower(k))) hits.push(k);
  }

  return [...new Set(hits)];
}

function makeRiskLevel(risks) {
  const safeRisks = safeArray(risks);

  const high = [
    "falls",
    "shortness of breath",
    "chest pain",
    "suicid",
    "wandering",
    "abscond",
    "self-harm",
    "choking",
  ];

  if (safeRisks.some((r) => high.some((h) => lower(r).includes(h)))) {
    return "High";
  }

  if (safeRisks.length >= 2) return "Medium";
  return safeRisks.length ? "Low" : "Unknown";
}

function uid(prefix = "todo") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function uniq(arr = []) {
  return [
    ...new Set(
      safeArray(arr)
        .filter(Boolean)
        .map((x) => String(x).trim())
        .filter(Boolean)
    ),
  ];
}

function uniqByKey(items, keyFn) {
  const seen = new Set();
  const out = [];

  for (const it of safeArray(items)) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }

  return out;
}

function joinBullets(arr = []) {
  const a = safeArray(arr).filter(Boolean);
  if (a.length === 0) return "";
  return a.map((x) => `- ${x}`).join("\n");
}

function ensureSuggestionsShape(plan) {
  const p = plan || {};
  const s = p.suggestions || {};

  return {
    ...p,
    suggestions: {
      worker: safeArray(s.worker),
      client: safeArray(s.client),
      approvedWorker: safeArray(s.approvedWorker),
      approvedClient: safeArray(s.approvedClient),
    },
  };
}

function mergeSuggestionsPreservingApprovals(existingPlan, generated) {
  const existing = ensureSuggestionsShape(existingPlan);
  const next = ensureSuggestionsShape(generated);

  next.suggestions.approvedWorker = safeArray(
    existing.suggestions.approvedWorker
  );
  next.suggestions.approvedClient = safeArray(existing.suggestions.approvedClient);

  const mergedWorker = uniqByKey(
    [...safeArray(existing.suggestions.worker), ...safeArray(next.suggestions.worker)],
    (x) => x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`
  );

  const mergedClient = uniqByKey(
    [...safeArray(existing.suggestions.client), ...safeArray(next.suggestions.client)],
    (x) => x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`
  );

  const approvedWorkerKeys = new Set(
    safeArray(next.suggestions.approvedWorker).map(
      (x) => x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`
    )
  );

  const approvedClientKeys = new Set(
    safeArray(next.suggestions.approvedClient).map(
      (x) => x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`
    )
  );

  next.suggestions.worker = mergedWorker.filter(
    (x) =>
      !approvedWorkerKeys.has(
        x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`
      )
  );

  next.suggestions.client = mergedClient.filter(
    (x) =>
      !approvedClientKeys.has(
        x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`
      )
  );

  return next;
}

/* -------------------------------------------------------
   Findings from docs
-------------------------------------------------------- */
export function buildFindingsFromDocs(docs = []) {
  const combined = normalize(
    safeArray(docs)
      .map((d) => safeText(d))
      .filter(Boolean)
      .join("\n\n")
  );

  const risks = [];

  if (findAny(combined, ["fall", "falls", "slipped", "unsteady"])) {
    risks.push("Falls risk");
  }

  if (findAny(combined, ["shortness of breath", "sob", "breathless"])) {
    risks.push("Breathing difficulty");
  }

  if (findAny(combined, ["swelling", "oedema", "edema", "fluid retention"])) {
    risks.push("Fluid retention / swelling");
  }

  if (findAny(combined, ["refused medication", "missed dose", "did not take medication"])) {
    risks.push("Medication non-adherence");
  }

  if (findAny(combined, ["agitated", "aggression", "escalation"])) {
    risks.push("Behaviour escalation");
  }

  if (findAny(combined, ["low mood", "depressed", "hopeless", "anxiety", "panic"])) {
    risks.push("Distress / anxiety indicators");
  }

  if (findAny(combined, ["wandering", "abscond"])) {
    risks.push("Wandering / absconding risk");
  }

  if (findAny(combined, ["choking", "aspiration", "swallow", "dysphagia"])) {
    risks.push("Swallowing / choking risk");
  }

  if (findAny(combined, ["self harm", "self-harm", "suicid"])) {
    risks.push("Self-harm / suicide risk indicators");
  }

  const goals = [];

  if (findAny(combined, ["goal:", "goals:", "aim:", "objective:", "plan goal"])) {
    goals.push("Confirm and align with stated goals");
  }

  if (findAny(combined, ["walk", "mobility", "exercise", "physio"])) {
    goals.push("Maintain/improve mobility and physical health");
  }

  if (findAny(combined, ["independent", "independence", "self-care"])) {
    goals.push("Increase independence / active support");
  }

  if (findAny(combined, ["routine", "structure", "predictable"])) {
    goals.push("Maintain stable routines and daily structure");
  }

  if (findAny(combined, ["social", "community", "participation"])) {
    goals.push("Increase community participation and social engagement");
  }

  if (findAny(combined, ["work", "study", "productivity", "employment"])) {
    goals.push("Improve productivity and vocational participation");
  }

  const preferences = [];

  if (findAny(combined, ["prefers", "likes", "responds well", "music", "calm"])) {
    preferences.push("Responds well to calming or preferred activities");
  }

  if (findAny(combined, ["shorter activities", "gets tired", "fatigue"])) {
    preferences.push("Prefers shorter activities with planned rest breaks");
  }

  if (findAny(combined, ["predictable", "routine"])) {
    preferences.push("Prefers predictable routine and clear communication");
  }

  const medsFlags = [];

  if (findAny(combined, ["medication", "mar", "dose", "tablet"])) {
    medsFlags.push("Medication support referenced");
  }

  if (findAny(combined, ["refused", "missed"])) {
    medsFlags.push("Potential missed/refused medication mentioned");
  }

  const triggers = extractListByKeywords(combined, [
    "noise",
    "change in routine",
    "new environment",
    "overstimulation",
    "sensory",
    "crowds",
    "conflict",
  ]).map((t) => `Trigger mentioned: ${t}`);

  const uniqueRisks = uniq(risks);

  return {
    combinedText: combined,
    goals: uniq(goals),
    risks: uniqueRisks,
    preferences: uniq(preferences),
    medsFlags: uniq(medsFlags),
    triggers: uniq(triggers),
    riskLevel: makeRiskLevel(uniqueRisks),
  };
}

/* -------------------------------------------------------
   Suggestion object helpers
-------------------------------------------------------- */
function makeTodo({ who, title, detail, frequency, reason, source }) {
  const key = `${who}|${title || ""}|${detail || ""}|${frequency || ""}|${
    reason || ""
  }`.trim();

  return {
    id: uid(who),
    key,
    who,
    status: "pending",
    title: title || "",
    detail: detail || "",
    frequency: frequency || "",
    reason: reason || "",
    source: source || "generator",
    createdAt: new Date().toISOString(),
  };
}

function generateWorkerTodos(findings) {
  const t = [];
  const risks = safeArray(findings?.risks);
  const prefs = safeArray(findings?.preferences);
  const triggers = safeArray(findings?.triggers);
  const medsFlags = safeArray(findings?.medsFlags);

  t.push(
    makeTodo({
      who: "worker",
      title: "Provide person-centred support",
      detail:
        "Use active support and document what works, what does not, and what improves participation.",
      frequency: "Every shift",
      reason: "Core Theraa Nurse support standard.",
      source: "theraa_nurse",
    })
  );

  if (risks.some((r) => lower(r).includes("falls"))) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Falls prevention routine",
        detail:
          "Check hazards, support safe footwear and mobility, and document changes in balance or confidence.",
        frequency: "Every shift",
        reason: "Falls risk identified.",
        source: "theraa_nurse",
      })
    );
  }

  if (risks.some((r) => lower(r).includes("distress") || lower(r).includes("anxiety"))) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Track distress signs and calming responses",
        detail:
          "Notice early cues and redirect to a preferred calming or meaningful activity.",
        frequency: "Daily / each interaction",
        reason: "Distress indicators identified.",
        source: "theraa_nurse",
      })
    );
  }

  if (triggers.length > 0) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Document triggers and successful supports",
        detail: `Track what increases distress and what helps. Trigger signals found: ${triggers.join(
          ", "
        )}`,
        frequency: "Every session",
        reason: "Triggers extracted from documents or notes.",
        source: "theraa_nurse",
      })
    );
  }

  if (prefs.length > 0) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Use strengths and preferences proactively",
        detail:
          "Build supports around the participant’s existing interests, strengths, and familiar routines.",
        frequency: "Weekly review",
        reason: "Preference and strengths signals found.",
        source: "theraa_nurse",
      })
    );
  }

  if (medsFlags.length > 0) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Record medication prompting and concerns",
        detail:
          "Document prompting, refusals, side effects, and escalation actions within role scope.",
        frequency: "As applicable",
        reason: medsFlags.join("; "),
        source: "theraa_nurse",
      })
    );
  }

  return uniqByKey(t, (x) => x.key);
}

function generateClientTodos(findings) {
  const t = [];
  const goals = safeArray(findings?.goals);
  const risks = safeArray(findings?.risks);

  t.push(
    makeTodo({
      who: "client",
      title: "Follow a meaningful daily structure",
      detail:
        "Use a simple routine that includes meals, rest, movement, and one enjoyable activity.",
      frequency: "Daily",
      reason: "Supports purpose and stability.",
      source: "theraa_nurse",
    })
  );

  if (goals.some((g) => lower(g).includes("community") || lower(g).includes("social"))) {
    t.push(
      makeTodo({
        who: "client",
        title: "Weekly community or social participation",
        detail: "Take part in one safe, enjoyable social or community activity.",
        frequency: "Weekly",
        reason: "Social participation goal identified.",
        source: "theraa_nurse",
      })
    );
  }

  if (
    goals.some((g) => lower(g).includes("mobility")) ||
    risks.some((r) => lower(r).includes("falls"))
  ) {
    t.push(
      makeTodo({
        who: "client",
        title: "Gentle movement routine",
        detail:
          "Engage in supported walking, stretching, or movement activity suited to ability.",
        frequency: "3–5 times weekly",
        reason: "Mobility / falls theme identified.",
        source: "theraa_nurse",
      })
    );
  }

  if (goals.some((g) => lower(g).includes("productivity") || lower(g).includes("vocational"))) {
    t.push(
      makeTodo({
        who: "client",
        title: "Build one future-focused habit",
        detail:
          "Work on one simple weekly goal related to productivity, life planning, or routine ownership.",
        frequency: "Weekly",
        reason: "Future-direction goal identified.",
        source: "theraa_nurse",
      })
    );
  }

  return uniqByKey(t, (x) => x.key);
}

/* -------------------------------------------------------
   Main generator
-------------------------------------------------------- */
export function generateCarePlanDraft({
  client,
  findings,
  recentSessions = [],
  existingPlan = null,
  documentIntelligence = [],
} = {}) {
  const existing = ensureSuggestionsShape(existingPlan || {});
  const clientName = client?.name || "Client";

  const safeFindings = findings || {};
  const safeSessions = safeArray(recentSessions);
  const safeDocs = safeArray(documentIntelligence);

  const shortGoals = safeArray(safeFindings.goals).slice(0, 3);
  const longGoals = safeArray(safeFindings.goals).slice(3);
  const risks = safeArray(safeFindings.risks);
  const prefs = safeArray(safeFindings.preferences);
  const triggers = safeArray(safeFindings.triggers);

  const goalsShortText =
    joinBullets(shortGoals) ||
    existing.goalsShort ||
    "- Confirm short-term goals\n- Maintain daily routine and wellbeing";

  const goalsLongText =
    joinBullets(longGoals) ||
    existing.goalsLong ||
    "- Improve independence and meaningful participation over time";

  const risksText =
    joinBullets([
      ...(risks.length ? risks : ["Identify and document current risks and supports"]),
      ...(triggers.length ? [`Triggers to monitor: ${triggers.join(", ")}`] : []),
      `Overall risk level: ${safeFindings.riskLevel || "Unknown"}`,
    ]) || existing.risks;

  const communicationText =
    existing.communication ||
    joinBullets([
      "Use clear, respectful language and allow time for processing.",
      ...(prefs.length ? [`Preferences: ${prefs.join("; ")}`] : []),
      "Support decision-making and document choices and consent.",
    ]);

  const supportsText =
    existing.supports ||
    joinBullets([
      "Provide person-centred, strengths-based support.",
      "Support routines, purpose, wellbeing, and safe participation.",
      "Document supports delivered and outcomes.",
      safeSessions.length
        ? `Recent sessions available: ${safeSessions.length}. Review for trends.`
        : "Begin consistent session logging to strengthen evidence.",
    ]);

  const legalEthicalText =
    existing.legalEthical ||
    joinBullets([
      "Maintain duty of care at all times.",
      "Respect dignity, choice, privacy, and role boundaries.",
      "Escalate safety concerns according to policy.",
    ]);

  const baseWorker = generateWorkerTodos(safeFindings);
  const baseClient = generateClientTodos(safeFindings);

  const runningSource =
    buildRunningSourcePlan({
      client,
      findings: safeFindings,
      existingPlan: existing,
      recentSessions: safeSessions,
      documentIntelligence: safeDocs,
    }) || {};

  const pendingTodoStrings = {
    worker: uniq(safeArray(runningSource?.todos?.worker)),
    client: uniq(safeArray(runningSource?.todos?.client)),
  };

  const generated = ensureSuggestionsShape({
    title: `Draft Care Plan — ${clientName}`,
    generatedAt: new Date().toISOString(),
    clientId: client?.id || "",

    goalsShort: goalsShortText,
    goalsLong: goalsLongText,
    risks: risksText,
    communication: communicationText,
    supports: supportsText,
    legalEthical: legalEthicalText,

    sections: {
      ...(existing.sections || {}),
      ...(runningSource.sections || {}),
      goalsShort: runningSource?.sections?.goalsShort || goalsShortText,
      goalsLong: runningSource?.sections?.goalsLong || goalsLongText,
      risks: runningSource?.sections?.risks || risksText,
      communication: runningSource?.sections?.communication || communicationText,
      legalEthical: runningSource?.sections?.legalEthical || legalEthicalText,
    },

    runningSource: runningSource.runningSource || {},
    todos: pendingTodoStrings,

    suggestionsGeneratedAt: new Date().toISOString(),
    suggestions: {
      worker: baseWorker,
      client: baseClient,
      approvedWorker: [],
      approvedClient: [],
    },
  });

  return mergeSuggestionsPreservingApprovals(existing, generated);
}