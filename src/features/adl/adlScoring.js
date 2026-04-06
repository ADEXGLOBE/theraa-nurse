// src/features/adl/adlScoring.js

// ADL scoring system
// 0 = Independent
// 1 = Prompting
// 2 = Partial Assist
// 3 = Full Assist

export const ADL_ITEMS = [
  "Bathing",
  "Dressing",
  "Toileting",
  "Eating",
  "Mobility/Transfers",
  "Continence",
];

export const IADL_ITEMS = [
  "Meal preparation",
  "Shopping",
  "Housework",
  "Medication management",
  "Transport/community access",
  "Money/banking",
  "Communication/technology",
];

// create blank ADL profile
export function createEmptyAdlProfile() {
  const scores = {};
  [...ADL_ITEMS, ...IADL_ITEMS].forEach((k) => (scores[k] = 0));

  return {
    scores,
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

// calculate ADL summary
export function computeAdlSummary(profile) {

  const scores = profile?.scores || {};
  const allKeys = [...ADL_ITEMS, ...IADL_ITEMS];

  let total = 0;
  let max = allKeys.length * 3;

  const breakdown = allKeys.map((k) => {

    const v = Number(scores[k] ?? 0);
    total += v;

    return {
      item: k,
      score: v,
    };

  });

  // Lower score = more independence
  let level = "Mostly Independent";

  if (total >= max * 0.66) {
    level = "High Support Needs";
  } else if (total >= max * 0.33) {
    level = "Moderate Support Needs";
  }

  return {
    totalScore: total,
    maxScore: max,
    level,
    breakdown,
  };
}


// ------------------------------
// ADL TREND ANALYSIS
// ------------------------------

export function calculateAdlTrend(history = []) {

  if (history.length < 2) {
    return {
      trend: "stable",
      change: 0,
    };
  }

  const first = history[0]?.totalScore || 0;
  const last = history[history.length - 1]?.totalScore || 0;

  const change = last - first;

  if (change > 3) {
    return { trend: "declining", change };
  }

  if (change < -3) {
    return { trend: "improving", change };
  }

  return { trend: "stable", change };

}


// ------------------------------
// RISK DETECTION
// ------------------------------

export function detectAdlRisk(summary) {

  if (!summary) return "unknown";

  if (summary.level === "High Support Needs") {
    return "high";
  }

  if (summary.level === "Moderate Support Needs") {
    return "medium";
  }

  return "low";
}


// ------------------------------
// AUTO SCORE FROM SESSION NOTES
// ------------------------------

export function inferAdlFromSession(note = "") {

  const lower = note.toLowerCase();

  const profile = createEmptyAdlProfile();

  if (lower.includes("assist with shower") || lower.includes("assist with bathing")) {
    profile.scores["Bathing"] = 2;
  }

  if (lower.includes("assist with dressing")) {
    profile.scores["Dressing"] = 2;
  }

  if (lower.includes("assist with toileting")) {
    profile.scores["Toileting"] = 2;
  }

  if (lower.includes("mobility support") || lower.includes("walker")) {
    profile.scores["Mobility/Transfers"] = 2;
  }

  if (lower.includes("meal preparation")) {
    profile.scores["Meal preparation"] = 1;
  }

  return profile;
}