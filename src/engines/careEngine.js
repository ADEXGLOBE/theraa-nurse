// src/features/careplans/careEngine.js

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
      value.text,
      value.notes,
      value.textContent,
      value.extractedText,
      value.summary,
      value.content,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return String(value);
}

export function buildDraftFromEvidence({
  documentIntelligence = [],
  recentSessions = [],
  existingPlan = {},
} = {}) {
  const docs = safeArray(documentIntelligence);
  const sessions = safeArray(recentSessions);
  const plan = existingPlan || {};

  const insights = extractInsights(docs, sessions);

  return {
    sections: {
      ...(plan.sections || {}),
      summary: generateSummary(insights),
      risks: detectRisks(insights),
      goals: generateGoals(insights),
      interventions: generateInterventions(insights),
      purposePlan: generatePurposePlan(insights),
    },
    todos: generateTodos(insights),
  };
}

/* -------------------------------
   🧩 INSIGHT EXTRACTION
--------------------------------*/
function extractInsights(docs = [], sessions = []) {
  const docsText = safeArray(docs).map((d) => safeText(d));
  const sessionsText = safeArray(sessions).map((s) => safeText(s));

  const allText = [...docsText, ...sessionsText].join(" ").toLowerCase();

  return {
    mood: detectMood(allText),
    risks: detectRiskKeywords(allText),
    preferences: detectPreferences(allText),
    engagement: safeArray(sessions).length,
  };
}

function detectMood(text = "") {
  if (text.includes("agitated") || text.includes("angry")) return "agitated";
  if (text.includes("sad") || text.includes("withdrawn")) return "low";
  if (text.includes("happy") || text.includes("engaged")) return "positive";
  return "neutral";
}

function detectRiskKeywords(text = "") {
  const risks = [];

  if (text.includes("fall")) risks.push("Falls Risk");
  if (text.includes("missed medication")) risks.push("Medication Risk");
  if (text.includes("confused")) risks.push("Cognitive Decline");
  if (text.includes("isolated")) risks.push("Social Isolation");
  if (text.includes("anxious") || text.includes("anxiety")) risks.push("Anxiety / Distress");
  if (text.includes("refused")) risks.push("Refusal / Engagement Risk");

  return risks;
}

function detectPreferences(text = "") {
  const prefs = [];

  if (text.includes("music")) prefs.push("Music");
  if (text.includes("walking")) prefs.push("Walking");
  if (text.includes("family")) prefs.push("Family Interaction");
  if (text.includes("art")) prefs.push("Art");
  if (text.includes("animals")) prefs.push("Animals");
  if (text.includes("community")) prefs.push("Community Participation");
  if (text.includes("football") || text.includes("afl")) prefs.push("Sport");

  return prefs;
}

/* -------------------------------
   🎯 GENERATION LOGIC
--------------------------------*/
function generateSummary(insights) {
  return `Client shows ${insights.mood} mood with ${insights.engagement} recent recorded engagement(s).`;
}

function detectRisks(insights) {
  return safeArray(insights.risks).length
    ? safeArray(insights.risks)
    : ["No major risks identified"];
}

function generateGoals(insights) {
  return [
    `Improve emotional stability and wellbeing (${insights.mood})`,
    "Increase engagement in daily and meaningful activities",
    "Maintain independence, participation, and cognitive function",
  ];
}

function generateInterventions(insights) {
  return [
    "Use a structured daily routine",
    "Provide guided social interaction and active support",
    insights.mood === "low"
      ? "Introduce mood-supporting activities and monitor emotional wellbeing"
      : "Reinforce engagement through preferred activities",
  ];
}

/* -------------------------------
   🌟 PURPOSE ENGINE
--------------------------------*/
function generatePurposePlan(insights) {
  const preferences = safeArray(insights.preferences);

  return [
    {
      title: "Morning Activation",
      action: "Light stretching, greeting routine, and daily orientation.",
    },
    {
      title: "Midday Engagement",
      action: preferences.includes("Music")
        ? "Music-based activity session."
        : preferences.includes("Art")
        ? "Art-based creative activity."
        : preferences.includes("Animals")
        ? "Animal-related learning or community activity."
        : "Cognitive stimulation or meaningful participation activity.",
    },
    {
      title: "Evening Reflection",
      action: "Calm conversation, reflection, and preparation for next day.",
    },
  ];
}

/* -------------------------------
   📋 TASKS
--------------------------------*/
function generateTodos(insights) {
  return {
    worker: [
      "Monitor mood daily",
      "Record engagement level",
      "Document barriers and successful supports",
      "Update care plan weekly",
    ],
    client: [
      "Participate in one meaningful activity",
      "Communicate preferences where possible",
      "Follow agreed daily routine",
    ],
  };
}