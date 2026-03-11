// src/features/adl/adlScoring.js
// Simple ADL/IADL scoring model: 0=Independent, 1=Prompting, 2=Partial assist, 3=Full assist.
// You can later map to WHODAS / other frameworks if needed.

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

export function createEmptyAdlProfile() {
  const scores = {};
  [...ADL_ITEMS, ...IADL_ITEMS].forEach((k) => (scores[k] = 0));
  return { scores, notes: "" };
}

export function computeAdlSummary(profile) {
  const scores = profile?.scores || {};
  const allKeys = [...ADL_ITEMS, ...IADL_ITEMS];

  let total = 0;
  let max = allKeys.length * 3;

  const breakdown = allKeys.map((k) => {
    const v = Number(scores[k] ?? 0);
    total += v;
    return { item: k, score: v };
  });

  // Lower is more independent
  let level = "Mostly Independent";
  if (total >= max * 0.66) level = "High Support Needs";
  else if (total >= max * 0.33) level = "Moderate Support Needs";

  return {
    totalScore: total,
    maxScore: max,
    level,
    breakdown,
  };
}