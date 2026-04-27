export function buildDraftFromEvidence({
  documentIntelligence = [],
  recentSessions = [],
  existingPlan = {},
}) {
  const insights = extractInsights(documentIntelligence, recentSessions);

  return {
    sections: {
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
function extractInsights(docs, sessions) {
  const allText = [
    ...docs.map(d => d.text || ""),
    ...sessions.map(s => s.notes || ""),
  ].join(" ").toLowerCase();

  return {
    mood: detectMood(allText),
    risks: detectRiskKeywords(allText),
    preferences: detectPreferences(allText),
    engagement: sessions.length,
  };
}

function detectMood(text) {
  if (text.includes("agitated") || text.includes("angry")) return "agitated";
  if (text.includes("sad") || text.includes("withdrawn")) return "low";
  if (text.includes("happy") || text.includes("engaged")) return "positive";
  return "neutral";
}

function detectRiskKeywords(text) {
  const risks = [];
  if (text.includes("fall")) risks.push("Falls Risk");
  if (text.includes("missed medication")) risks.push("Medication Risk");
  if (text.includes("confused")) risks.push("Cognitive Decline");
  return risks;
}

function detectPreferences(text) {
  const prefs = [];
  if (text.includes("music")) prefs.push("Music");
  if (text.includes("walking")) prefs.push("Walking");
  if (text.includes("family")) prefs.push("Family Interaction");
  return prefs;
}

/* -------------------------------
   🎯 GENERATION LOGIC
--------------------------------*/

function generateSummary(insights) {
  return `Client shows ${insights.mood} mood with ${insights.engagement} recent engagements.`;
}

function detectRisks(insights) {
  return insights.risks.length ? insights.risks : ["No major risks identified"];
}

function generateGoals(insights) {
  return [
    `Improve emotional stability (${insights.mood})`,
    "Increase engagement in daily activities",
    "Maintain cognitive function",
  ];
}

function generateInterventions(insights) {
  return [
    "Daily structured routine",
    "Guided social interaction",
    insights.mood === "low" ? "Mood support therapy" : "Engagement reinforcement",
  ];
}

/* -------------------------------
   🌟 PURPOSE ENGINE (YOUR CORE USP)
--------------------------------*/

function generatePurposePlan(insights) {
  const base = [
    {
      title: "Morning Activation",
      action: "Light stretching + greeting routine",
    },
    {
      title: "Midday Engagement",
      action: insights.preferences.includes("Music")
        ? "Music-based activity session"
        : "Cognitive stimulation activity",
    },
    {
      title: "Evening Reflection",
      action: "Calm conversation + journaling",
    },
  ];

  return base;
}

/* -------------------------------
   📋 TASKS
--------------------------------*/

function generateTodos(insights) {
  return [
    "Monitor mood daily",
    "Record engagement level",
    "Update care plan weekly",
  ];
}