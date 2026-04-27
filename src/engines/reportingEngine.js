function asArray(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

function safe(v) {
  return v == null ? "" : String(v);
}

function lower(v) {
  return safe(v).toLowerCase();
}

function toChartRows(mapObj = {}) {
  return Object.entries(mapObj)
    .map(([label, value]) => ({ label, value: Number(value) || 0 }))
    .filter((row) => row.value > 0);
}

export function getMonthKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function filterSessionsByMonth(sessions = [], monthKey = getMonthKey()) {
  return asArray(sessions).filter((session) => {
    const rawDate = session.timestamp || session.createdAt || session.date;
    if (!rawDate) return false;

    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return false;

    return getMonthKey(d) === monthKey;
  });
}

export function calculateSessionsByZone(sessions = []) {
  const map = {};

  asArray(sessions).forEach((session) => {
    const zone = session.zone || session.sessionType || "General";
    map[zone] = (map[zone] || 0) + 1;
  });

  return toChartRows(map);
}

export function calculateMoodDistribution(sessions = []) {
  const map = {
    Positive: 0,
    Neutral: 0,
    Low: 0,
    Agitated: 0,
  };

  asArray(sessions).forEach((session) => {
    const mood = lower(session.mood || session.presentation || "");

    if (
      mood.includes("happy") ||
      mood.includes("positive") ||
      mood.includes("engaged") ||
      mood.includes("calm") ||
      mood.includes("content")
    ) {
      map.Positive += 1;
    } else if (
      mood.includes("sad") ||
      mood.includes("low") ||
      mood.includes("withdrawn") ||
      mood.includes("flat") ||
      mood.includes("depressed")
    ) {
      map.Low += 1;
    } else if (
      mood.includes("agitated") ||
      mood.includes("angry") ||
      mood.includes("distress") ||
      mood.includes("irritable")
    ) {
      map.Agitated += 1;
    } else {
      map.Neutral += 1;
    }
  });

  return toChartRows(map);
}

export function calculateRiskProfile(plan = {}, documentIntelligence = null) {
  const map = {};

  const riskText = [
    plan?.sections?.risks,
    plan?.risks,
    plan?.sections?.behaviourSupport,
    plan?.sections?.healthClinical,
    ...asArray(documentIntelligence?.risks),
    ...asArray(documentIntelligence?.triggers),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const riskGroups = {
    "Falls / mobility": ["fall", "falls", "mobility", "unsteady", "walker", "transfer"],
    "Medication": ["medication", "missed dose", "dose", "tablet", "refused medication"],
    "Distress / mood": ["anxiety", "distress", "low mood", "depressed", "withdrawn", "sad"],
    "Behaviour escalation": ["agitated", "aggression", "behaviour", "escalation", "irritable"],
    "Cognition / memory": ["confused", "memory", "disoriented", "cognitive", "dementia"],
    "Nutrition / hydration": ["nutrition", "hydration", "dehydration", "malnutrition", "appetite"],
    "Wandering / absconding": ["wandering", "abscond", "exit seeking"],
    "Swallowing / choking": ["dysphagia", "choking", "swallow", "aspiration"],
    "Safeguarding": ["abuse", "neglect", "exploitation", "safeguarding", "bruise"],
  };

  Object.entries(riskGroups).forEach(([label, keywords]) => {
    const detected = keywords.some((keyword) => riskText.includes(keyword));
    if (detected) map[label] = 1;
  });

  return toChartRows(map);
}

export function calculatePurposeDomains(plan = {}) {
  const map = {};
  const purposeCards = asArray(plan?.runningSource?.purposeCards);

  purposeCards.forEach((card) => {
    const domain = card.domain || "General";
    map[domain] = (map[domain] || 0) + 1;
  });

  return toChartRows(map);
}

export function calculateTodoApprovals(plan = {}) {
  const approvals = plan?.approvals || {};

  return toChartRows({
    "Worker approved": asArray(approvals.approvedWorker).length,
    "Client approved": asArray(approvals.approvedClient).length,
    "Worker pending": asArray(plan?.todos?.worker).length,
    "Client pending": asArray(plan?.todos?.client).length,
  });
}

export function calculateEngagementSignal(sessions = []) {
  const count = asArray(sessions).length;

  if (count >= 12) return "High";
  if (count >= 5) return "Moderate";
  if (count >= 1) return "Low";
  return "No recent session evidence";
}

export function calculateMonthlyOutcomeSummary({
  sessions = [],
  plan = {},
  documentIntelligence = null,
}) {
  const purposeCards = asArray(plan?.runningSource?.purposeCards);
  const approvedWorker = asArray(plan?.approvals?.approvedWorker);
  const approvedClient = asArray(plan?.approvals?.approvedClient);

  const risks = calculateRiskProfile(plan, documentIntelligence);
  const mood = calculateMoodDistribution(sessions);
  const sessionsByZone = calculateSessionsByZone(sessions);

  return {
    totalSessions: asArray(sessions).length,
    engagementSignal: calculateEngagementSignal(sessions),
    purposePlansGenerated: purposeCards.length,
    approvedWorkerTodos: approvedWorker.length,
    approvedClientTodos: approvedClient.length,
    riskCount: risks.length,
    moodCount: mood.length,
    sessionZoneCount: sessionsByZone.length,
  };
}

export function generateMonthlyReportObject({
  client,
  month,
  sessions = [],
  carePlanVersion = null,
  documentIntelligence = null,
  documentCount = 0,
}) {
  const plan = carePlanVersion?.plan || {};
  const monthSessions = filterSessionsByMonth(sessions, month);
  const purposeCards = asArray(plan?.runningSource?.purposeCards);

  const summary = calculateMonthlyOutcomeSummary({
    sessions: monthSessions,
    plan,
    documentIntelligence,
  });

  return {
    client: {
      id: client?.id || "",
      name: client?.name || "Unknown",
      age: client?.age || "",
      ndisNumber: client?.ndisNumber || "",
    },

    period: {
      month: month || getMonthKey(),
      generatedAt: new Date().toISOString(),
    },

    carePlan: {
      versionId: carePlanVersion?.id || "",
      status: carePlanVersion?.status || "unsaved",
      createdAt: carePlanVersion?.createdAt || "",
    },

    summary: {
      ...summary,
      documentCount,
    },

    goals: {
      shortTerm: plan?.sections?.goalsShort || plan?.goalsShort || "",
      longTerm: plan?.sections?.goalsLong || plan?.goalsLong || "",
    },

    carePlanSections: {
      strengths: plan?.sections?.strengths || "",
      functionalNeeds: plan?.sections?.functionalNeeds || plan?.supports || "",
      healthClinical: plan?.sections?.healthClinical || "",
      risks: plan?.sections?.risks || plan?.risks || "",
      behaviourSupport: plan?.sections?.behaviourSupport || "",
      communication: plan?.sections?.communication || plan?.communication || "",
      safeguardsConsent: plan?.sections?.safeguardsConsent || "",
      monitoringReview: plan?.sections?.monitoringReview || "",
      legalEthical: plan?.sections?.legalEthical || plan?.legalEthical || "",
    },

    approvals: {
      worker: asArray(plan?.approvals?.approvedWorker),
      client: asArray(plan?.approvals?.approvedClient),
      pendingWorker: asArray(plan?.todos?.worker),
      pendingClient: asArray(plan?.todos?.client),
    },

    runningSource: {
      summary: plan?.runningSource?.summary || "",
      generatedAt: plan?.runningSource?.generatedAt || "",
      themes: plan?.runningSource?.themes || {},
      purposeCards,
    },

    chartData: {
      sessionsByZone: calculateSessionsByZone(monthSessions),
      moodDistribution: calculateMoodDistribution(monthSessions),
      riskProfile: calculateRiskProfile(plan, documentIntelligence),
      purposeDomains: calculatePurposeDomains(plan),
      todoApprovals: calculateTodoApprovals(plan),
    },

    raw: {
      sessions: monthSessions,
      carePlanVersion,
      documentIntelligence,
    },
  };
}

export function generateMonthlyReportText(report) {
  const lines = [];

  lines.push("THERAA NURSE – MONTHLY NDIS-STYLE SUMMARY");
  lines.push("");
  lines.push(`Client: ${report?.client?.name || "Unknown"}`);
  lines.push(`Age: ${report?.client?.age || "—"}`);
  lines.push(`NDIS Number: ${report?.client?.ndisNumber || "—"}`);
  lines.push(`Month: ${report?.period?.month || "—"}`);
  lines.push(`Generated: ${report?.period?.generatedAt || new Date().toISOString()}`);
  lines.push("");

  lines.push("1. Monthly Overview");
  lines.push(`- Sessions recorded: ${report?.summary?.totalSessions || 0}`);
  lines.push(`- Documents analysed: ${report?.summary?.documentCount || 0}`);
  lines.push(`- Engagement signal: ${report?.summary?.engagementSignal || "—"}`);
  lines.push(`- Purpose plans generated: ${report?.summary?.purposePlansGenerated || 0}`);
  lines.push(`- Approved worker actions: ${report?.summary?.approvedWorkerTodos || 0}`);
  lines.push(`- Approved client actions: ${report?.summary?.approvedClientTodos || 0}`);
  lines.push("");

  lines.push("2. Short-Term Goals");
  lines.push(report?.goals?.shortTerm || "—");
  lines.push("");

  lines.push("3. Long-Term Goals");
  lines.push(report?.goals?.longTerm || "—");
  lines.push("");

  lines.push("4. Functional Support Needs");
  lines.push(report?.carePlanSections?.functionalNeeds || "—");
  lines.push("");

  lines.push("5. Risks & Safeguards");
  lines.push(report?.carePlanSections?.risks || "—");
  lines.push("");

  lines.push("6. Communication Strategies");
  lines.push(report?.carePlanSections?.communication || "—");
  lines.push("");

  lines.push("7. Monitoring & Review");
  lines.push(report?.carePlanSections?.monitoringReview || "—");
  lines.push("");

  lines.push("8. Running Source Purpose Summary");
  lines.push(report?.runningSource?.summary || "—");
  lines.push("");

  lines.push("9. Purpose-Based Lifestyle Plans");
  const purposeCards = asArray(report?.runningSource?.purposeCards);
  if (purposeCards.length === 0) {
    lines.push("—");
  } else {
    purposeCards.forEach((card, index) => {
      lines.push(`${index + 1}. ${card.title || "Purpose plan"}`);
      lines.push(`   Domain: ${card.domain || "General"}`);
      lines.push(`   Frequency: ${card.frequency || "As planned"}`);
      lines.push(`   Why it matters: ${card.whyItMatters || "—"}`);
      lines.push(`   Participant action: ${card.participantAction || "—"}`);
      lines.push(`   Worker action: ${card.workerAction || "—"}`);
      lines.push("");
    });
  }

  lines.push("10. Approved Worker Actions");
  const workerActions = asArray(report?.approvals?.worker);
  if (workerActions.length === 0) {
    lines.push("—");
  } else {
    workerActions.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("");

  lines.push("11. Approved Client Actions");
  const clientActions = asArray(report?.approvals?.client);
  if (clientActions.length === 0) {
    lines.push("—");
  } else {
    clientActions.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("");

  lines.push("12. Legal / Scope Note");
  lines.push(
    "Theraa Nurse supports evidence-based care planning and reporting. It does not replace professional judgement, clinical assessment, organisational policy, or emergency escalation requirements."
  );

  return lines.join("\n");
}

export function downloadReportTextFile(report) {
  if (!report) return;
  
  const text = generateMonthlyReportText(report);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const safeName = safe(report?.client?.name || "Client").replace(/\s+/g, "_");
  const month = safe(report?.period?.month || "month");

  const a = document.createElement("a");
  a.href = url;
  a.download = `TheraaNurse-MonthlyReport-${safeName}-${month}.txt`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}