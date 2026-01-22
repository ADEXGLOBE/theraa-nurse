// src/features/insights/insightsService.js
import { listDocumentsForClient } from "../documents/documentService";
import { loadCarePlanVersions } from "../../data/carePlanStore";

function daysSince(iso) {
  try {
    const d = new Date(iso);
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function normText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function pickEvidenceText(doc) {
  // Prefer extractedText (OCR / pdf-text) then pasted textContent
  const a = doc?.extractedText || "";
  const b = doc?.textContent || "";
  return (a && a.trim().length > 0 ? a : b) || "";
}

function detectSignalsFromText(textRaw) {
  const t = normText(textRaw);

  const has = (re) => re.test(t);

  const signals = [];

  // Mental health / behaviour
  if (has(/\b(suicid|self[- ]?harm|harm myself|kill myself)\b/)) {
    signals.push({ id: "mh_selfharm", level: "high", label: "Self-harm / suicide language detected" });
  }
  if (has(/\b(agitat|aggress|violent|threaten|abscond|elop)\b/)) {
    signals.push({ id: "behaviour_escalation", level: "high", label: "Behaviour escalation risk indicators" });
  }
  if (has(/\b(anxious|panic|fearful|distress|crying)\b/)) {
    signals.push({ id: "mh_distress", level: "medium", label: "Distress / anxiety indicators" });
  }

  // Falls / mobility
  if (has(/\b(fall|fell|slip|trip)\b/)) {
    signals.push({ id: "falls", level: "high", label: "Possible fall / slip / trip mentioned" });
  }
  if (has(/\b(unsteady|dizz|weak|mobility aid|walker|wheelchair)\b/)) {
    signals.push({ id: "mobility", level: "medium", label: "Mobility / balance concern mentioned" });
  }

  // Medication
  if (has(/\b(refus(ed|al)|declin(ed|e) medication|miss(ed|ing) dose)\b/)) {
    signals.push({ id: "med_refusal", level: "high", label: "Medication refusal / missed dose" });
  }
  if (has(/\b(side effect|adverse|reaction|allerg)\b/)) {
    signals.push({ id: "med_reaction", level: "high", label: "Possible medication adverse reaction" });
  }

  // Nutrition / hydration
  if (has(/\b(not eat|no appetite|poor intake|skipp(ed)? meal|weight loss)\b/)) {
    signals.push({ id: "nutrition", level: "medium", label: "Nutrition intake concern" });
  }
  if (has(/\b(dehydrat|dry mouth|not drink|poor fluid)\b/)) {
    signals.push({ id: "hydration", level: "medium", label: "Hydration concern" });
  }

  // Pain / sleep
  if (has(/\b(pain|ache|sore|hurt)\b/)) {
    signals.push({ id: "pain", level: "medium", label: "Pain mentioned" });
  }
  if (has(/\b(poor sleep|insomnia|awake at night|nightmare)\b/)) {
    signals.push({ id: "sleep", level: "low", label: "Sleep disturbance mentioned" });
  }

  // Skin / infection
  if (has(/\b(wound|ulcer|pressure area|pressure injury|rash|broken skin)\b/)) {
    signals.push({ id: "skin", level: "high", label: "Skin integrity / wound risk" });
  }
  if (has(/\b(fever|infection|pus|redness|swelling|warm to touch)\b/)) {
    signals.push({ id: "infection", level: "high", label: "Possible infection indicators" });
  }

  // Continence
  if (has(/\b(incontinen|wet|soiled|toilet accident)\b/)) {
    signals.push({ id: "continence", level: "low", label: "Continence / toileting issue mentioned" });
  }

  return signals;
}

function mergeSignals(signals) {
  // Deduplicate by id keeping highest level
  const rank = { high: 3, medium: 2, low: 1 };
  const map = new Map();
  for (const s of signals) {
    const prev = map.get(s.id);
    if (!prev || rank[s.level] > rank[prev.level]) map.set(s.id, s);
  }
  // Sort high -> low
  return Array.from(map.values()).sort((a, b) => rank[b.level] - rank[a.level]);
}

function computeOverallRisk({ hasReviewedPlan, recentSignals, staleDays }) {
  // Simple, explainable rules (safe MVP)
  if (!hasReviewedPlan) return "high";
  if (recentSignals.some((s) => s.level === "high")) return "high";
  if (typeof staleDays === "number" && staleDays >= 7) return "medium";
  if (recentSignals.some((s) => s.level === "medium")) return "medium";
  return "low";
}

export async function buildClientInsights(clientId, opts = {}) {
  const lookbackDays = typeof opts.lookbackDays === "number" ? opts.lookbackDays : 14;

  const docs = await listDocumentsForClient(clientId);
  const versions = loadCarePlanVersions(clientId);
  const latest = versions[0] || null;
  const hasReviewedPlan = latest?.status === "reviewed";

  const recentDocs = (docs || []).filter((d) => {
    const age = daysSince(d.createdAt);
    return age === null ? true : age <= lookbackDays;
  });

  const staleDays = docs?.[0]?.createdAt ? daysSince(docs[0].createdAt) : null;

  // Extract signals from recent evidence
  const allSignals = [];
  const evidence = [];

  for (const d of recentDocs) {
    const txt = pickEvidenceText(d);
    const sigs = detectSignalsFromText(txt);

    if (sigs.length > 0) {
      evidence.push({
        docId: d.id,
        title: d.title || "Untitled",
        docType: d.docType || "other",
        createdAt: d.createdAt,
        extractionMethod: d.extractionMethod || "",
        ocrConfidence: typeof d.ocrConfidence === "number" ? d.ocrConfidence : null,
        matched: sigs.map((x) => x.label),
      });
    }

    allSignals.push(...sigs);
  }

  const mergedSignals = mergeSignals(allSignals);

  // Gaps (service optimisation = gaps + actions)
  const gaps = [];
  if (!hasReviewedPlan) gaps.push({ id: "plan_review", severity: "high", label: "No reviewed care plan yet" });
  if (!docs || docs.length === 0) gaps.push({ id: "no_docs", severity: "high", label: "No evidence submitted yet" });
  if (typeof staleDays === "number" && staleDays >= 7)
    gaps.push({ id: "stale_docs", severity: "medium", label: `No recent evidence in ${staleDays} days` });

  const lowConfidence = (recentDocs || []).some((d) => typeof d.ocrConfidence === "number" && d.ocrConfidence < 60);
  if (lowConfidence)
    gaps.push({ id: "low_ocr", severity: "medium", label: "Some OCR confidence is low — review text accuracy" });

  const overallRisk = computeOverallRisk({
    hasReviewedPlan,
    recentSignals: mergedSignals,
    staleDays,
  });

  // Suggested actions (safe and explainable)
  const actions = [];
  if (!hasReviewedPlan) actions.push("Create and review a baseline care plan version for this client.");
  if (mergedSignals.some((s) => s.id === "med_refusal"))
    actions.push("Check medication refusal details and follow organisational escalation procedure.");
  if (mergedSignals.some((s) => s.id === "falls"))
    actions.push("Confirm falls risk controls (environment, mobility aids, supervision, OT review if applicable).");
  if (mergedSignals.some((s) => s.id === "behaviour_escalation"))
    actions.push("Confirm behaviour triggers and de-escalation steps; review BSP if available.");
  if (gaps.some((g) => g.id === "stale_docs"))
    actions.push("Request a fresh shift/session note to update current status.");

  return {
    clientId,
    lookbackDays,
    overallRisk,
    hasReviewedPlan,
    lastEvidenceAt: docs?.[0]?.createdAt || null,
    signals: mergedSignals,
    gaps,
    actions,
    evidence,
  };
}
