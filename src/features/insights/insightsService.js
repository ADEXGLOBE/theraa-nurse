// src/features/insights/insightsService.js

import {
  listDocumentsForClient,
} from "../documents/documentService";

import {
  loadSharedCarePlanVersions,
} from "../../services/carePlanService";

function daysSince(iso) {
  try {
    const d = new Date(iso);

    return Math.floor(
      (Date.now() - d.getTime()) /
        (1000 * 60 * 60 * 24)
    );
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
  const extracted =
    doc?.extractedText || "";

  const pasted =
    doc?.textContent || "";

  return (
    (extracted &&
    extracted.trim().length > 0
      ? extracted
      : pasted) || ""
  );
}

function detectSignalsFromText(
  textRaw
) {
  const t = normText(textRaw);

  const has = (re) =>
    re.test(t);

  const signals = [];

  // Mental health / behaviour
  if (
    has(
      /\b(suicid|self[- ]?harm|harm myself|kill myself)\b/
    )
  ) {
    signals.push({
      id: "mh_selfharm",
      level: "high",
      label:
        "Self-harm / suicide language detected",
    });
  }

  if (
    has(
      /\b(agitat|aggress|violent|threaten|abscond|elop)\b/
    )
  ) {
    signals.push({
      id:
        "behaviour_escalation",
      level:
        "high",
      label:
        "Behaviour escalation risk indicators",
    });
  }

  if (
    has(
      /\b(anxious|panic|fearful|distress|crying)\b/
    )
  ) {
    signals.push({
      id: "mh_distress",
      level: "medium",
      label:
        "Distress / anxiety indicators",
    });
  }

  // Falls / mobility
  if (
    has(
      /\b(fall|fell|slip|trip)\b/
    )
  ) {
    signals.push({
      id: "falls",
      level: "high",
      label:
        "Possible fall / slip / trip mentioned",
    });
  }

  if (
    has(
      /\b(unsteady|dizz|weak|mobility aid|walker|wheelchair)\b/
    )
  ) {
    signals.push({
      id: "mobility",
      level: "medium",
      label:
        "Mobility / balance concern mentioned",
    });
  }

  // Medication
  if (
    has(
      /\b(refus(ed|al)|declin(ed|e) medication|miss(ed|ing) dose)\b/
    )
  ) {
    signals.push({
      id: "med_refusal",
      level: "high",
      label:
        "Medication refusal / missed dose",
    });
  }

  if (
    has(
      /\b(side effect|adverse|reaction|allerg)\b/
    )
  ) {
    signals.push({
      id: "med_reaction",
      level: "high",
      label:
        "Possible medication adverse reaction",
    });
  }

  // Nutrition / hydration
  if (
    has(
      /\b(not eat|no appetite|poor intake|skipp(ed)? meal|weight loss)\b/
    )
  ) {
    signals.push({
      id: "nutrition",
      level: "medium",
      label:
        "Nutrition intake concern",
    });
  }

  if (
    has(
      /\b(dehydrat|dry mouth|not drink|poor fluid)\b/
    )
  ) {
    signals.push({
      id: "hydration",
      level: "medium",
      label:
        "Hydration concern",
    });
  }

  // Pain / sleep
  if (
    has(
      /\b(pain|ache|sore|hurt)\b/
    )
  ) {
    signals.push({
      id: "pain",
      level: "medium",
      label: "Pain mentioned",
    });
  }

  if (
    has(
      /\b(poor sleep|insomnia|awake at night|nightmare)\b/
    )
  ) {
    signals.push({
      id: "sleep",
      level: "low",
      label:
        "Sleep disturbance mentioned",
    });
  }

  // Skin / infection
  if (
    has(
      /\b(wound|ulcer|pressure area|pressure injury|rash|broken skin)\b/
    )
  ) {
    signals.push({
      id: "skin",
      level: "high",
      label:
        "Skin integrity / wound risk",
    });
  }

  if (
    has(
      /\b(fever|infection|pus|redness|swelling|warm to touch)\b/
    )
  ) {
    signals.push({
      id: "infection",
      level: "high",
      label:
        "Possible infection indicators",
    });
  }

  // Continence
  if (
    has(
      /\b(incontinen|wet|soiled|toilet accident)\b/
    )
  ) {
    signals.push({
      id: "continence",
      level: "low",
      label:
        "Continence / toileting issue mentioned",
    });
  }

  return signals;
}

function mergeSignals(
  signals
) {
  const rank = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const map =
    new Map();

  for (const signal of signals) {
    const previous =
      map.get(signal.id);

    if (
      !previous ||
      rank[signal.level] >
        rank[previous.level]
    ) {
      map.set(
        signal.id,
        signal
      );
    }
  }

  return Array.from(
    map.values()
  ).sort(
    (a, b) =>
      rank[b.level] -
      rank[a.level]
  );
}

function computeOverallRisk({
  hasReviewedPlan,
  recentSignals,
  staleDays,
}) {
  if (!hasReviewedPlan) {
    return "high";
  }

  if (
    recentSignals.some(
      (signal) =>
        signal.level ===
        "high"
    )
  ) {
    return "high";
  }

  if (
    typeof staleDays ===
      "number" &&
    staleDays >= 7
  ) {
    return "medium";
  }

  if (
    recentSignals.some(
      (signal) =>
        signal.level ===
        "medium"
    )
  ) {
    return "medium";
  }

  return "low";
}

function chooseCurrentPlan(
  versions = []
) {
  const safeVersions =
    Array.isArray(versions)
      ? versions
      : [];

  const approved =
    safeVersions.find(
      (version) =>
        version?.status ===
        "approved"
    );

  if (approved) {
    return approved;
  }

  const reviewed =
    safeVersions.find(
      (version) =>
        version?.status ===
        "reviewed"
    );

  if (reviewed) {
    return reviewed;
  }

  return (
    safeVersions[0] ||
    null
  );
}

/**
 * Build participant insights using:
 * - participant documents
 * - shared organisation Purpose Plan versions
 *
 * organisationId is now required so Insights read the same
 * shared Purpose Plan as the rest of Theraa Nurse V3.
 */
export async function buildClientInsights(
  clientId,
  opts = {}
) {
  if (!clientId) {
    throw new Error(
      "Participant ID is required."
    );
  }

  const organisationId =
    opts.organisationId;

  if (!organisationId) {
    throw new Error(
      "Organisation ID is required to build shared participant insights."
    );
  }

  const lookbackDays =
    typeof opts.lookbackDays ===
      "number"
      ? opts.lookbackDays
      : 14;

  /*
   * Load documents and shared Purpose Plan in parallel.
   */
  const [
    docs,
    versions,
  ] = await Promise.all([
    listDocumentsForClient(
      clientId
    ),

    loadSharedCarePlanVersions({
      organisationId,
      participantId:
        clientId,
    }),
  ]);

  const currentPlanVersion =
    chooseCurrentPlan(
      versions
    );

  /*
   * Consider Reviewed or Approved plans professionally
   * validated for insight-readiness.
   */
  const hasReviewedPlan =
    currentPlanVersion?.status ===
      "reviewed" ||
    currentPlanVersion?.status ===
      "approved";

  const recentDocs =
    (docs || []).filter(
      (document) => {
        const age =
          daysSince(
            document.createdAt
          );

        return age === null
          ? true
          : age <=
              lookbackDays;
      }
    );

  const staleDays =
    docs?.[0]?.createdAt
      ? daysSince(
          docs[0].createdAt
        )
      : null;

  const allSignals = [];
  const evidence = [];

  for (
    const document of
    recentDocs
  ) {
    const text =
      pickEvidenceText(
        document
      );

    const signals =
      detectSignalsFromText(
        text
      );

    if (
      signals.length > 0
    ) {
      evidence.push({
        docId:
          document.id,

        title:
          document.title ||
          "Untitled",

        docType:
          document.docType ||
          "other",

        createdAt:
          document.createdAt,

        extractionMethod:
          document.extractionMethod ||
          "",

        ocrConfidence:
          typeof document.ocrConfidence ===
          "number"
            ? document.ocrConfidence
            : null,

        matched:
          signals.map(
            (signal) =>
              signal.label
          ),
      });
    }

    allSignals.push(
      ...signals
    );
  }

  const mergedSignals =
    mergeSignals(
      allSignals
    );

  /*
   * Gaps:
   * service optimisation =
   * identified gap + explainable action.
   */
  const gaps = [];

  if (!hasReviewedPlan) {
    gaps.push({
      id: "plan_review",
      severity:
        "high",
      label:
        "No reviewed or approved Purpose Plan yet",
    });
  }

  if (
    !docs ||
    docs.length === 0
  ) {
    gaps.push({
      id: "no_docs",
      severity:
        "high",
      label:
        "No evidence submitted yet",
    });
  }

  if (
    typeof staleDays ===
      "number" &&
    staleDays >= 7
  ) {
    gaps.push({
      id: "stale_docs",
      severity:
        "medium",
      label:
        `No recent evidence in ${staleDays} days`,
    });
  }

  const lowConfidence =
    (recentDocs || []).some(
      (document) =>
        typeof document.ocrConfidence ===
          "number" &&
        document.ocrConfidence <
          60
    );

  if (lowConfidence) {
    gaps.push({
      id: "low_ocr",
      severity:
        "medium",
      label:
        "Some OCR confidence is low — review text accuracy",
    });
  }

  const overallRisk =
    computeOverallRisk({
      hasReviewedPlan,
      recentSignals:
        mergedSignals,
      staleDays,
    });

  /*
   * Suggested actions.
   */
  const actions = [];

  if (!hasReviewedPlan) {
    actions.push(
      "Create and professionally review a baseline shared Purpose Plan for this participant."
    );
  }

  if (
    mergedSignals.some(
      (signal) =>
        signal.id ===
        "med_refusal"
    )
  ) {
    actions.push(
      "Check medication refusal details and follow organisational escalation procedure."
    );
  }

  if (
    mergedSignals.some(
      (signal) =>
        signal.id ===
        "falls"
    )
  ) {
    actions.push(
      "Confirm falls risk controls including environment, mobility aids, supervision and appropriate allied-health review."
    );
  }

  if (
    mergedSignals.some(
      (signal) =>
        signal.id ===
        "behaviour_escalation"
    )
  ) {
    actions.push(
      "Confirm behaviour triggers and de-escalation steps and review relevant behaviour support information where available."
    );
  }

  if (
    gaps.some(
      (gap) =>
        gap.id ===
        "stale_docs"
    )
  ) {
    actions.push(
      "Request a fresh shift or session note to update the participant's current status."
    );
  }

  return {
    clientId,

    participantId:
      clientId,

    organisationId,

    lookbackDays,

    overallRisk,

    hasReviewedPlan,

    currentPlanStatus:
      currentPlanVersion?.status ||
      null,

    currentPlanVersionId:
      currentPlanVersion?.id ||
      null,

    currentPlan:
      currentPlanVersion?.plan ||
      null,

    lastEvidenceAt:
      docs?.[0]?.createdAt ||
      null,

    signals:
      mergedSignals,

    gaps,

    actions,

    evidence,
  };
}