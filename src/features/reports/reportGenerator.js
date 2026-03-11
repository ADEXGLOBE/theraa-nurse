// src/features/reports/reportGenerator.js
// Monthly NDIS-style report (scope-safe, outcomes focused).
// Inputs: client, sessions, incidents, carePlanVersion, adlSummary.

const safe = (v) => (v == null ? "" : String(v));

function monthKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function inMonth(dateIso, key) {
  const d = new Date(dateIso);
  return monthKey(d) === key;
}

export function generateMonthlyNdisReport({
  client,
  month = monthKey(new Date()),
  sessions = [],
  incidents = [],
  carePlanVersion,
  adlSummary,
}) {
  const monthSessions = sessions.filter((s) => inMonth(s.createdAt || s.date || new Date().toISOString(), month));
  const monthIncidents = incidents.filter((i) => inMonth(i.createdAt || new Date().toISOString(), month));

  const plan = carePlanVersion?.plan || {};
  const sections = plan.sections || {};

  // Outcome framing: what supports were delivered + what changed
  const supportDeliverySummary = monthSessions.length
    ? `Supports delivered across ${monthSessions.length} session(s). Sessions recorded with outcomes and observations.`
    : "No sessions recorded for the month yet (add session notes to strengthen evidence).";

  const riskSummary = monthIncidents.length
    ? `There were ${monthIncidents.length} incident(s)/concern(s) documented this month. Follow-up actions recorded.`
    : "No incidents documented this month.";

  const goals = {
    shortTerm: safe(sections.goalsShort || plan.goalsShort),
    longTerm: safe(sections.goalsLong || plan.goalsLong),
  };

  return {
    id: `rpt-${month}-${client?.id || "client"}`,
    generatedAt: new Date().toISOString(),
    reportPeriod: month,

    participant: {
      id: safe(client?.id),
      name: safe(client?.name),
      age: safe(client?.age),
    },

    planReference: {
      versionId: safe(carePlanVersion?.id),
      status: safe(carePlanVersion?.status),
      createdAt: safe(carePlanVersion?.createdAt),
    },

    goals,

    functionalStatus: {
      adlLevel: safe(adlSummary?.level),
      totalScore: adlSummary?.totalScore ?? null,
      maxScore: adlSummary?.maxScore ?? null,
      notes: "Lower score indicates higher independence. Track change over time.",
    },

    supportsDelivered: supportDeliverySummary,

    progressNotesHighlights: monthSessions.slice(0, 6).map((s) => ({
      date: safe(s.createdAt || s.date),
      summary: safe(s.title || s.summary || "Session recorded"),
      outcome: safe(s.outcome || s.body || s.note || ""),
    })),

    incidentsAndSafeguarding: {
      summary: riskSummary,
      incidents: monthIncidents.map((i) => ({
        date: safe(i.createdAt),
        type: safe(i?.incident?.type || i.type),
        summary: safe(i?.incident?.summary || i.summary),
        escalation: safe(i?.incident?.escalation || i.escalation),
      })),
    },

    recommendationsNextMonth: [
      "Continue consistent session logging with goal-linked outcomes.",
      "Review and update risk controls if triggers or incidents increase.",
      "Confirm participant consent and preferences for any plan changes.",
    ],

    complianceNote:
      "This report is generated to assist documentation and does not replace provider policy, clinical judgement, or audit requirements. Ensure consent and privacy requirements are met before sharing.",
  };
}