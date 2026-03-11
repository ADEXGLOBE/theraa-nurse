// src/features/careplans/carePlanGenerator.js
// UPDATED: outputs BOTH {todos, approvals} (strings) and {suggestions} (objects)
// so your UI always shows To-Dos.

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}
function lower(text) {
  return (text || "").toLowerCase();
}
function findAny(text, keywords = []) {
  const t = lower(text);
  return keywords.some((k) => t.includes(lower(k)));
}
function extractListByKeywords(text, keywords) {
  const t = lower(text || "");
  const hits = [];
  for (const k of keywords) if (t.includes(lower(k))) hits.push(k);
  return [...new Set(hits)];
}
function makeRiskLevel(risks) {
  const high = ["falls", "shortness of breath", "chest pain", "suicid", "wandering", "abscond", "self-harm"];
  if (risks.some((r) => high.some((h) => lower(r).includes(h)))) return "High";
  if (risks.length >= 2) return "Medium";
  return risks.length ? "Low" : "Unknown";
}
function uid(prefix = "todo") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}
function safeArray(x) {
  return Array.isArray(x) ? x : [];
}
function uniqByKey(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    if (seen.has(k)) continue;
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

// -------- Findings --------
export function buildFindingsFromDocs(docs = []) {
  const combined = normalize(
    safeArray(docs)
      .map((d) => [d.textContent, d.extractedText].filter(Boolean).join("\n"))
      .filter(Boolean)
      .join("\n\n")
  );

  const risks = [];
  if (findAny(combined, ["fall", "falls", "slipped", "unsteady"])) risks.push("Falls risk");
  if (findAny(combined, ["shortness of breath", "sob", "breathless"])) risks.push("Breathing difficulty");
  if (findAny(combined, ["swelling", "oedema", "edema", "fluid retention"])) risks.push("Fluid retention / swelling");
  if (findAny(combined, ["refused medication", "missed dose", "did not take medication"])) risks.push("Medication non-adherence");
  if (findAny(combined, ["agitated", "aggression", "escalation"])) risks.push("Behaviour escalation");
  if (findAny(combined, ["low mood", "depressed", "hopeless", "anxiety", "panic"])) risks.push("Distress / anxiety indicators");
  if (findAny(combined, ["wandering", "abscond"])) risks.push("Wandering / absconding risk");
  if (findAny(combined, ["choking", "aspiration", "swallow"])) risks.push("Swallowing / choking risk");
  if (findAny(combined, ["self harm", "self-harm", "suicid"])) risks.push("Self-harm / suicide risk indicators");

  const goals = [];
  if (findAny(combined, ["goal:", "goals:", "aim:", "objective:", "plan goal"])) goals.push("Confirm and align with NDIS stated goals");
  if (findAny(combined, ["walk", "mobility", "exercise", "physio"])) goals.push("Maintain/improve mobility and physical health");
  if (findAny(combined, ["independent", "independence", "self-care"])) goals.push("Increase independence / active support");
  if (findAny(combined, ["routine", "structure", "predictable"])) goals.push("Maintain stable routines and daily structure");
  if (findAny(combined, ["social", "community", "participation"])) goals.push("Increase community participation and social engagement");
  if (findAny(combined, ["work", "study", "productivity", "employment"])) goals.push("Improve productivity and vocational participation");

  const preferences = [];
  if (findAny(combined, ["prefers", "likes", "responds well", "music", "calm"])) {
    preferences.push("Responds well to calming activities (e.g., music / quiet walks)");
  }
  if (findAny(combined, ["shorter activities", "gets tired", "fatigue"])) {
    preferences.push("Prefers shorter activities with planned rest breaks");
  }
  if (findAny(combined, ["predictable", "routine"])) {
    preferences.push("Prefers predictable routine and clear communication");
  }

  const medsFlags = [];
  if (findAny(combined, ["medication", "mar", "dose", "tablet"])) medsFlags.push("Medication support referenced");
  if (findAny(combined, ["refused", "missed"])) medsFlags.push("Potential missed/refused medication mentioned");

  const triggers = extractListByKeywords(combined, [
    "noise", "change in routine", "new environment", "overstimulation", "sensory", "crowds", "conflict",
  ]).map((t) => `Trigger mentioned: ${t}`);

  const uniq = (a) => [...new Set(a.filter(Boolean))];

  return {
    combinedText: combined,
    goals: uniq(goals),
    risks: uniq(risks),
    preferences: uniq(preferences),
    medsFlags: uniq(medsFlags),
    triggers: uniq(triggers),
    riskLevel: makeRiskLevel(uniq(risks)),
  };
}

// -------- Suggestions Objects (rich) --------
function makeTodo({ who, title, detail, frequency, reason, source }) {
  const key = `${who}|${title || ""}|${detail || ""}|${frequency || ""}|${reason || ""}`.trim();
  return {
    id: uid(who),
    key,
    who, // worker | client
    status: "pending",
    title: title || "",
    detail: detail || "",
    frequency: frequency || "",
    reason: reason || "",
    source: source || "docs",
    createdAt: new Date().toISOString(),
  };
}

function toUiString(todoObj) {
  const t = todoObj || {};
  const bits = [
    t.title,
    t.detail,
    t.frequency ? `(${t.frequency})` : "",
  ].filter(Boolean);
  return bits.join(" — ");
}

function generateWorkerTodos(findings) {
  const t = [];
  const risks = safeArray(findings?.risks);
  const triggers = safeArray(findings?.triggers);
  const medsFlags = safeArray(findings?.medsFlags);
  const prefs = safeArray(findings?.preferences);

  t.push(makeTodo({
    who: "worker",
    title: "Follow person-centred, strengths-based support",
    detail: "Use active support (do-with, not do-for). Offer choices and document what works.",
    frequency: "Every shift",
    reason: "NDIS-aligned practice (choice, control, dignity).",
  }));

  if (risks.some((r) => lower(r).includes("falls"))) {
    t.push(makeTodo({
      who: "worker",
      title: "Falls prevention routine",
      detail: "Check trip hazards, encourage safe footwear, supervise transfers if needed, document mobility changes.",
      frequency: "Every shift",
      reason: "Falls risk mentioned in evidence.",
    }));
  }

  if (risks.some((r) => lower(r).includes("distress") || lower(r).includes("anxiety"))) {
    t.push(makeTodo({
      who: "worker",
      title: "Monitor distress/anxiety signs early",
      detail: "Watch cues (restlessness, withdrawal). Use calming strategies and record triggers and responses.",
      frequency: "Daily / each interaction",
      reason: "Distress/anxiety indicators referenced.",
    }));
  }

  if (triggers.length) {
    t.push(makeTodo({
      who: "worker",
      title: "Track triggers and what helps",
      detail: `Log triggers and effective supports. Current mentions: ${triggers.join(", ")}`,
      frequency: "Each session",
      reason: "Triggers detected from evidence.",
    }));
  }

  if (prefs.some((p) => lower(p).includes("calming"))) {
    t.push(makeTodo({
      who: "worker",
      title: "Use calming activities proactively",
      detail: "Offer preferred calming supports before escalation (music, quiet walk, reduced stimulation).",
      frequency: "Daily",
      reason: "Preferences indicate calming strategies help.",
    }));
  }

  if (medsFlags.length) {
    t.push(makeTodo({
      who: "worker",
      title: "Medication prompting documentation",
      detail: "If role includes prompting: document refusals/missed doses and follow policy (no clinical overreach).",
      frequency: "As applicable",
      reason: medsFlags.join("; "),
    }));
  }

  t.push(makeTodo({
    who: "worker",
    title: "Write NDIS-ready progress notes",
    detail: "Use who/what/when/how/outcome. Link supports delivered to goals and functional outcomes.",
    frequency: "Every shift",
    reason: "Evidence-based documentation supports plan reviews.",
  }));

  return uniqByKey(t, (x) => x.key);
}

function generateClientTodos(findings) {
  const t = [];
  const risks = safeArray(findings?.risks);
  const goals = safeArray(findings?.goals);
  const prefs = safeArray(findings?.preferences);

  t.push(makeTodo({
    who: "client",
    title: "Daily wellbeing routine",
    detail: "Maintain routine: sleep, hydration, meals, and light activity (as tolerated).",
    frequency: "Daily",
    reason: "Supports stability and functional outcomes.",
  }));

  if (goals.some((g) => lower(g).includes("mobility")) || risks.some((r) => lower(r).includes("falls"))) {
    t.push(makeTodo({
      who: "client",
      title: "Gentle movement plan",
      detail: "With clinician/OT guidance: walking/stretching/light exercise. Start small and track response.",
      frequency: "3–5x/week",
      reason: "Mobility/falls themes appear in evidence.",
    }));
  }

  if (risks.some((r) => lower(r).includes("distress") || lower(r).includes("anxiety"))) {
    t.push(makeTodo({
      who: "client",
      title: "Stress regulation practice",
      detail: "Breathing, grounding (5-4-3-2-1), scheduled calming breaks. Share what helps.",
      frequency: "Daily / as needed",
      reason: "Distress/anxiety indicators referenced.",
    }));
  }

  if (goals.some((g) => lower(g).includes("community") || lower(g).includes("social"))) {
    t.push(makeTodo({
      who: "client",
      title: "Community participation goal",
      detail: "Choose one enjoyable activity (group/class). Build up gradually and review weekly.",
      frequency: "Weekly",
      reason: "Participation goal mentioned.",
    }));
  }

  if (prefs.some((p) => lower(p).includes("calming"))) {
    t.push(makeTodo({
      who: "client",
      title: "Calming activity routine",
      detail: "Use preferred calming activities proactively (music, quiet walks), especially before stressful tasks.",
      frequency: "Daily",
      reason: "Preferences indicate calming supports are effective.",
    }));
  }

  return uniqByKey(t, (x) => x.key);
}

// -------- Public Generator (outputs BOTH schemas) --------
export function generateCarePlanDraft({ client, findings, recentSessions = [], existingPlan = null }) {
  const clientName = client?.name || "Client";

  const shortGoals = safeArray(findings?.goals).slice(0, 3);
  const longGoals = safeArray(findings?.goals).slice(3);
  const risks = safeArray(findings?.risks);
  const prefs = safeArray(findings?.preferences);
  const triggers = safeArray(findings?.triggers);

  const goalsShortText =
    joinBullets(shortGoals) || "- Confirm client short-term goals\n- Maintain stable routines and wellbeing";

  const goalsLongText =
    joinBullets(longGoals) || "- Build independence and participation over time\n- Improve confidence and self-management";

  const risksText =
    joinBullets([
      ...(risks.length ? risks : ["Identify and document risks (falls, behaviours, medication, etc.)"]),
      ...(triggers.length ? [`Triggers to monitor: ${triggers.join(", ")}`] : []),
      `Overall risk level (auto): ${findings?.riskLevel || "Unknown"}`,
    ]);

  const communicationText =
    joinBullets([
      "Use clear, respectful language and allow time for responses.",
      ...(prefs.length ? [`Preferences: ${prefs.join("; ")}`] : []),
      "Support decision-making and document consent and choices.",
    ]);

  const supportsText =
    joinBullets([
      "Provide person-centred, strengths-based support aligned to goals.",
      "Support routines, wellbeing and safe participation.",
      `Recent sessions used for trends: ${recentSessions?.length || 0}`,
    ]);

  const legalEthicalText =
    joinBullets([
      "Maintain duty of care at all times.",
      "Respect dignity of risk and supported choice.",
      "Maintain privacy and confidentiality.",
      "Escalate safety concerns according to organisational policy; call 000 in emergencies.",
    ]);

  const workerObjs = generateWorkerTodos(findings);
  const clientObjs = generateClientTodos(findings);

  // Convert to your UI strings so To-Dos ALWAYS show
  const workerStrings = workerObjs.map(toUiString).filter(Boolean);
  const clientStrings = clientObjs.map(toUiString).filter(Boolean);

  // Preserve approvals if they already exist in existingPlan (supports both schemas)
  const prevApprovedWorker =
    safeArray(existingPlan?.approvals?.approvedWorker) ||
    safeArray(existingPlan?.suggestions?.approvedWorker).map(toUiString);

  const prevApprovedClient =
    safeArray(existingPlan?.approvals?.approvedClient) ||
    safeArray(existingPlan?.suggestions?.approvedClient).map(toUiString);

  return {
    title: `Care Plan Draft — ${clientName}`,
    generatedAt: new Date().toISOString(),
    clientId: client?.id || "",

    // legacy fields
    goalsShort: goalsShortText,
    goalsLong: goalsLongText,
    risks: risksText,
    communication: communicationText,
    supports: supportsText,
    legalEthical: legalEthicalText,

    // structured sections (preferred)
    sections: {
      participantDetails: "",
      goalsShort: goalsShortText,
      goalsLong: goalsLongText,
      strengths: "",
      functionalNeeds: supportsText,
      healthClinical: "",
      risks: risksText,
      riskControls: [],
      behaviourSupport: "",
      routinesAndPreferences: "",
      communication: communicationText,
      safeguardsConsent: "",
      monitoringReview: "",
      legalEthical: legalEthicalText,
    },

    // ✅ UI schema
    todos: { worker: workerStrings, client: clientStrings },
    approvals: { approvedWorker: prevApprovedWorker, approvedClient: prevApprovedClient },

    // ✅ rich schema retained
    suggestions: {
      worker: workerObjs,
      client: clientObjs,
      approvedWorker: [], // store objects later if you choose
      approvedClient: [],
    },
  };
}