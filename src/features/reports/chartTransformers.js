// src/features/reports/chartTransformers.js

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function lower(v) {
  return String(v || "").toLowerCase();
}

export function toSessionsByZoneChartData(sessions = []) {
  const counts = {};
  safeArray(sessions).forEach((s) => {
    const zone = s.zone || "unknown";
    counts[zone] = (counts[zone] || 0) + 1;
  });

  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

export function toMoodChartData(sessions = []) {
  const counts = {};
  safeArray(sessions).forEach((s) => {
    const mood = s.mood || "Not set";
    counts[mood] = (counts[mood] || 0) + 1;
  });

  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

export function toRiskChartData(plan = {}) {
  const risksText = lower(plan?.sections?.risks || plan?.risks || "");
  const map = {
    Falls: ["fall", "falls", "unsteady", "mobility"],
    Behaviour: ["aggression", "behaviour", "agitated", "escalation"],
    Distress: ["anxiety", "distress", "depressed", "withdrawn", "low mood"],
    Medication: ["medication", "dose", "refused medication", "missed dose"],
    Swallowing: ["choking", "swallow", "dysphagia", "aspiration"],
    Wandering: ["wandering", "abscond"],
  };

  return Object.entries(map).map(([label, terms]) => {
    const value = terms.some((t) => risksText.includes(t)) ? 1 : 0;
    return { label, value };
  });
}

export function toPurposeDomainChartData(purposeCards = []) {
  const counts = {};
  safeArray(purposeCards).forEach((card) => {
    const domain = card.domain || "other";
    counts[domain] = (counts[domain] || 0) + 1;
  });

  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

export function toTopTodoChartData(plan = {}) {
  const worker = safeArray(plan?.approvals?.approvedWorker);
  const client = safeArray(plan?.approvals?.approvedClient);

  return [
    { label: "Approved Worker To-Dos", value: worker.length },
    { label: "Approved Client To-Dos", value: client.length },
  ];
}