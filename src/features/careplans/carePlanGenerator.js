// src/features/careplans/carePlanGenerator.js

/* -------------------------------------------------------
   Theraa Nurse Care Plan Generator (Docs → Findings → Plan)
   - Safe MVP: rules + structured suggestions
   - Preserves approvals when regenerating
-------------------------------------------------------- */

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
  for (const k of keywords) {
    if (t.includes(lower(k))) hits.push(k);
  }
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

  // Keep approvals from existing
  next.suggestions.approvedWorker = safeArray(existing.suggestions.approvedWorker);
  next.suggestions.approvedClient = safeArray(existing.suggestions.approvedClient);

  // Merge pending suggestions (existing pending + generated pending), but dedupe
  const mergedWorker = uniqByKey(
    [...safeArray(existing.suggestions.worker), ...safeArray(next.suggestions.worker)],
    (x) => x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`
  );

  const mergedClient = uniqByKey(
    [...safeArray(existing.suggestions.client), ...safeArray(next.suggestions.client)],
    (x) => x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`
  );

  // Also: do not suggest items that are already approved
  const approvedWorkerKeys = new Set(
    safeArray(next.suggestions.approvedWorker).map((x) => x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`)
  );
  const approvedClientKeys = new Set(
    safeArray(next.suggestions.approvedClient).map((x) => x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`)
  );

  next.suggestions.worker = mergedWorker.filter((x) => !approvedWorkerKeys.has(x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`));
  next.suggestions.client = mergedClient.filter((x) => !approvedClientKeys.has(x?.key || `${x?.title || ""}|${x?.detail || ""}|${x?.frequency || ""}`));

  return next;
}

/* -------------------------------------------------------
   Findings from docs (existing + improved)
-------------------------------------------------------- */

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
    "noise",
    "change in routine",
    "new environment",
    "overstimulation",
    "sensory",
    "crowds",
    "conflict",
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

/* -------------------------------------------------------
   Suggestions generator (Worker + Client)
-------------------------------------------------------- */

function makeTodo({ who, title, detail, frequency, reason, source }) {
  const key = `${who}|${title || ""}|${detail || ""}|${frequency || ""}|${reason || ""}`.trim();
  return {
    id: uid(who),
    key, // stable-ish dedupe key
    who, // "worker" | "client"
    status: "pending",
    title: title || "",
    detail: detail || "",
    frequency: frequency || "",
    reason: reason || "",
    source: source || "docs",
    createdAt: new Date().toISOString(),
  };
}

function generateWorkerTodos(findings) {
  const t = [];
  const risks = safeArray(findings?.risks);
  const prefs = safeArray(findings?.preferences);
  const triggers = safeArray(findings?.triggers);
  const medsFlags = safeArray(findings?.medsFlags);

  // Core worker governance
  t.push(
    makeTodo({
      who: "worker",
      title: "Follow person-centred, strengths-based support",
      detail: "Use active support (do-with, not do-for). Offer choices and document what works.",
      frequency: "Every shift",
      reason: "NDIS-aligned practice (choice, control, dignity).",
    })
  );

  // Risks
  if (risks.some((r) => lower(r).includes("falls"))) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Falls prevention routine",
        detail: "Check environment for trip hazards, encourage safe footwear, supervise transfers if needed, document mobility changes.",
        frequency: "Every shift",
        reason: "Falls risk mentioned in documentation.",
      })
    );
  }

  if (risks.some((r) => lower(r).includes("distress") || lower(r).includes("anxiety"))) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Monitor distress / anxiety signs early",
        detail: "Watch for early cues (restlessness, withdrawal, agitation). Use calming strategies and record triggers and responses.",
        frequency: "Daily / Each interaction",
        reason: "Distress/anxiety indicators referenced.",
      })
    );
  }

  if (risks.some((r) => lower(r).includes("behaviour"))) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Use de-escalation and low-arousal approach",
        detail: "Keep voice calm, reduce stimulation, offer space, avoid power struggles. Escalate if safety risk increases.",
        frequency: "As needed",
        reason: "Behaviour escalation risk referenced.",
      })
    );
  }

  if (risks.some((r) => lower(r).includes("abscond") || lower(r).includes("wandering"))) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Wandering / absconding mitigation",
        detail: "Confirm supervision plan, check exits, use safe check-ins, document time/places of wandering if observed.",
        frequency: "Every shift",
        reason: "Wandering/absconding indicators referenced.",
      })
    );
  }

  if (risks.some((r) => lower(r).includes("self-harm") || lower(r).includes("suicide"))) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Escalation plan for self-harm risk",
        detail: "Follow organisational escalation pathway. If imminent risk: call 000. Record observations factually.",
        frequency: "As needed",
        reason: "Self-harm/suicide risk indicators referenced.",
      })
    );
  }

  // Triggers
  if (triggers.length > 0) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Track triggers and what helps",
        detail: `Log triggers and effective supports. Current trigger mentions: ${triggers.join(", ")}`,
        frequency: "Every session",
        reason: "Triggers were detected from notes/reports.",
      })
    );
  }

  // Preferences
  if (prefs.some((p) => lower(p).includes("calming"))) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Use calming activities proactively",
        detail: "Offer preferred calming supports before stress escalates (music, quiet walk, reduced stimulation).",
        frequency: "Daily",
        reason: "Client responds well to calming activities.",
      })
    );
  }

  // Medication flags
  if (medsFlags.length > 0) {
    t.push(
      makeTodo({
        who: "worker",
        title: "Medication prompting documentation",
        detail: "If your role includes prompting: document refusals/missed doses and follow-up per policy (no clinical overreach).",
        frequency: "As applicable",
        reason: medsFlags.join("; "),
      })
    );
  }

  // Evidence quality (NDIS)
  t.push(
    makeTodo({
      who: "worker",
      title: "Write NDIS-ready progress notes",
      detail: "Use who/what/when/how/outcome. Link supports delivered to goals and functional outcomes.",
      frequency: "Every shift",
      reason: "NDIS expects evidence-based, goal-linked documentation.",
    })
  );

  return uniqByKey(t, (x) => x.key);
}

function generateClientTodos(findings) {
  const t = [];
  const risks = safeArray(findings?.risks);
  const goals = safeArray(findings?.goals);
  const prefs = safeArray(findings?.preferences);

  // General wellbeing (safe, non-clinical)
  t.push(
    makeTodo({
      who: "client",
      title: "Daily wellbeing routine",
      detail: "Maintain a simple daily routine: sleep, hydration, meals, and light activity (as tolerated).",
      frequency: "Daily",
      reason: "Supports stability and functional outcomes.",
    })
  );

  // Mobility goal
  if (goals.some((g) => lower(g).includes("mobility")) || risks.some((r) => lower(r).includes("falls"))) {
    t.push(
      makeTodo({
        who: "client",
        title: "Gentle movement / exercise plan",
        detail: "With clinician/OT guidance: walking, stretching or light exercise. Start small and track how you feel.",
        frequency: "3–5x per week",
        reason: "Mobility/falls themes appear in documentation.",
      })
    );
  }

  // Distress/anxiety
  if (risks.some((r) => lower(r).includes("distress") || lower(r).includes("anxiety"))) {
    t.push(
      makeTodo({
        who: "client",
        title: "Stress regulation practice",
        detail: "Try breathing exercises, grounding (5-4-3-2-1), and schedule calming breaks. Share what helps.",
        frequency: "Daily / As needed",
        reason: "Distress/anxiety indicators referenced.",
      })
    );
  }

  // Routine/structure
  if (goals.some((g) => lower(g).includes("routine")) || prefs.some((p) => lower(p).includes("routine"))) {
    t.push(
      makeTodo({
        who: "client",
        title: "Structured weekly plan",
        detail: "Use a weekly schedule (wake time, activities, rest, appointments). Keep changes gradual.",
        frequency: "Weekly review",
        reason: "Documentation suggests routine/structure supports functioning.",
      })
    );
  }

  // Productivity/vocational
  if (goals.some((g) => lower(g).includes("productivity") || lower(g).includes("vocational"))) {
    t.push(
      makeTodo({
        who: "client",
        title: "Productivity coaching support",
        detail: "Consider a monthly session with a coach (work readiness / executive functioning / life coach) to build planning skills.",
        frequency: "Monthly",
        reason: "Work/productivity participation mentioned.",
      })
    );
  }

  // Social participation
  if (goals.some((g) => lower(g).includes("community") || lower(g).includes("social"))) {
    t.push(
      makeTodo({
        who: "client",
        title: "Community participation goal",
        detail: "Choose one community activity you enjoy (group, class, volunteering) and build up gradually.",
        frequency: "Weekly",
        reason: "Community/social participation goal mentioned.",
      })
    );
  }

  // Calm preference
  if (prefs.some((p) => lower(p).includes("calming"))) {
    t.push(
      makeTodo({
        who: "client",
        title: "Calming activity routine",
        detail: "Use your preferred calming activities (music, quiet walks) proactively—especially before stressful tasks.",
        frequency: "Daily",
        reason: "Preferences suggest calming supports are effective.",
      })
    );
  }

  return uniqByKey(t, (x) => x.key);
}

/* -------------------------------------------------------
   Plan draft generator (used by CarePlanZone)
-------------------------------------------------------- */

export function generateCarePlanDraft({ client, findings, recentSessions = [], existingPlan = null }) {
  const existing = ensureSuggestionsShape(existingPlan || {});
  const clientName = client?.name || "Client";

  // Build text blocks for editable fields (simple MVP UI fields)
  const shortGoals = safeArray(findings?.goals).slice(0, 3);
  const longGoals = safeArray(findings?.goals).slice(3);

  const risks = safeArray(findings?.risks);
  const prefs = safeArray(findings?.preferences);
  const triggers = safeArray(findings?.triggers);

  const goalsShortText =
    joinBullets(shortGoals) ||
    existing.goalsShort ||
    "- Confirm client’s short-term goals (NDIS aligned)\n- Maintain stability and daily routines";

  const goalsLongText =
    joinBullets(longGoals) ||
    existing.goalsLong ||
    "- Improve independence and community participation over time\n- Maintain emotional regulation and wellbeing";

  const risksText =
    joinBullets([
      ...(risks.length ? risks : ["Identify and document risks (falls, behaviours, medication, etc.)"]),
      ...(triggers.length ? [`Triggers to monitor: ${triggers.join(", ")}`] : []),
      `Overall risk level (auto): ${findings?.riskLevel || "Unknown"}`,
    ]) || existing.risks;

  const communicationText =
    existing.communication ||
    joinBullets([
      "Use clear, respectful language and allow time for responses.",
      ...(prefs.length ? [`Preferences: ${prefs.join("; ")}`] : []),
      "Support decision-making and document consent and choices.",
    ]);

  const supportsText =
    existing.supports ||
    joinBullets([
      "Provide person-centred, strengths-based support aligned to NDIS goals.",
      "Support routines, wellbeing, and safe participation in the community.",
      "Document supports delivered and outcomes (functional progress).",
      recentSessions?.length
        ? `Recent sessions recorded: ${recentSessions.length}. Review for trends and update plan accordingly.`
        : "Begin consistent session logging to strengthen evidence and outcome tracking.",
    ]);

  const legalEthicalText =
    existing.legalEthical ||
    joinBullets([
      "Maintain duty of care at all times.",
      "Respect dignity of risk and supported choice.",
      "Maintain privacy and confidentiality (NDIS practice standards).",
      "Escalate safety concerns according to organisational policy; call 000 in emergencies.",
    ]);

  // Generate pending suggestions from findings
  const newWorker = generateWorkerTodos(findings);
  const newClient = generateClientTodos(findings);

  // Create draft plan
  const draft = ensureSuggestionsShape({
    title: `Care Plan Draft — ${clientName}`,
    generatedAt: new Date().toISOString(),
    clientId: client?.id || "",

    // Editable UI fields
    goalsShort: goalsShortText,
    goalsLong: goalsLongText,
    risks: risksText,
    communication: communicationText,
    supports: supportsText,
    legalEthical: legalEthicalText,

    // Suggestions payload
    suggestionsGeneratedAt: new Date().toISOString(),
    suggestions: {
      worker: newWorker,
      client: newClient,
      // approvals preserved via merge below
      approvedWorker: [],
      approvedClient: [],
    },
  });

  // Merge, preserving approvals + avoiding duplicates
  const merged = mergeSuggestionsPreservingApprovals(existing, draft);

  return merged;
}
