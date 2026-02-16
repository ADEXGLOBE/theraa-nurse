// src/features/reports/reportGenerator.js

/* -------------------------------------------------------
   Theraa Nurse - Report Generator (NDIS-style)
   Supports: weekly, monthly, quarterly, custom date ranges

   Input data sources (Theraa Nurse):
   - client: { id, name, age, ndisNumber? }
   - planVersion: { status, createdAt, plan: { goalsShort, goalsLong, supports, risks, approvals, todos, suggestions } }
   - sessions: array of session notes (recommended structure below)
   - incidents: optional array (falls, behaviour, medication issues, hazards)
-------------------------------------------------------- */

function safe(v) {
  return v == null ? "" : String(v);
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function toDate(x) {
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

function inRange(dateIso, start, end) {
  const d = toDate(dateIso);
  if (!d) return false;
  return d >= start && d <= end;
}

function stripBullets(text) {
  const t = safe(text);
  return t
    .split("\n")
    .map((l) => l.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);
}

function summarizeSessions(sessions) {
  // Expected session structure:
  // { id, createdAt, workerName?, deliveredSupports?, goalLinks?, adlIadl?, outcome?, risksObserved?, notes? }
  const total = sessions.length;

  const outcomes = [];
  const risksObserved = [];
  const supports = [];
  const goalLinks = [];

  for (const s of sessions) {
    if (s?.outcome) outcomes.push(s.outcome);
    safeArray(s?.risksObserved).forEach((r) => risksObserved.push(r));
    safeArray(s?.deliveredSupports).forEach((x) => supports.push(x));
    safeArray(s?.goalLinks).forEach((g) => goalLinks.push(g));
  }

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  return {
    total,
    outcomes: uniq(outcomes),
    risksObserved: uniq(risksObserved),
    deliveredSupports: uniq(supports),
    goalLinks: uniq(goalLinks),
  };
}

function buildReportTitle(cadence, start, end, client) {
  const s = start.toLocaleDateString();
  const e = end.toLocaleDateString();
  return `NDIS Progress Report (${cadence}) — ${safe(client?.name) || "Participant"} — ${s} to ${e}`;
}

export function generateNdisReport({
  cadence = "monthly", // weekly | monthly | quarterly | custom
  startDate,           // ISO string or Date
  endDate,             // ISO string or Date
  client,
  planVersion,
  sessions = [],
  incidents = [],
}) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  const plan = planVersion?.plan || {};
  const approvals = plan?.approvals || planVersion?.plan?.approvals || {};
  const approvedWorker = safeArray(approvals?.approvedWorker);
  const approvedClient = safeArray(approvals?.approvedClient);

  const goalsShort = stripBullets(plan?.goalsShort);
  const goalsLong = stripBullets(plan?.goalsLong);
  const risks = stripBullets(plan?.risks);
  const supportsPlanned = stripBullets(plan?.supports);

  const sessionsInPeriod = safeArray(sessions).filter((s) => inRange(s?.createdAt, start, end));
  const incidentsInPeriod = safeArray(incidents).filter((i) => inRange(i?.createdAt, start, end));

  const sessionSummary = summarizeSessions(sessionsInPeriod);

  // NDIS-style sections (simple, compliant, evidence-focused)
  const report = {
    meta: {
      title: buildReportTitle(cadence, start, end, client),
      cadence,
      generatedAt: new Date().toISOString(),
      period: { start: start.toISOString(), end: end.toISOString() },
    },

    participant: {
      name: safe(client?.name),
      age: safe(client?.age),
      participantId: safe(client?.id),
      ndisNumber: safe(client?.ndisNumber),
    },

    planContext: {
      planStatus: safe(planVersion?.status || "draft"),
      planCreatedAt: safe(planVersion?.createdAt),
      evidenceCount: planVersion?.evidenceCount ?? null,
    },

    goals: {
      shortTerm: goalsShort.length ? goalsShort : ["—"],
      longTerm: goalsLong.length ? goalsLong : ["—"],
    },

    supportsPlanned: supportsPlanned.length ? supportsPlanned : ["—"],

    approvedActions: {
      supportWorker: approvedWorker.length ? approvedWorker : ["—"],
      participant: approvedClient.length ? approvedClient : ["—"],
    },

    supportsDelivered: {
      summary: sessionSummary.deliveredSupports.length ? sessionSummary.deliveredSupports : ["—"],
      totalSessionsLogged: sessionSummary.total,
    },

    outcomes: {
      summary: sessionSummary.outcomes.length ? sessionSummary.outcomes : ["—"],
      linkedGoalsMentioned: sessionSummary.goalLinks.length ? sessionSummary.goalLinks : ["—"],
    },

    risksAndIncidents: {
      baselineRisksFromPlan: risks.length ? risks : ["—"],
      risksObservedDuringPeriod: sessionSummary.risksObserved.length ? sessionSummary.risksObserved : ["—"],
      incidents: incidentsInPeriod.length
        ? incidentsInPeriod.map((i) => ({
            createdAt: i.createdAt,
            type: i.type || "incident",
            description: i.description || "",
            actionTaken: i.actionTaken || "",
          }))
        : [],
    },

    barriersAndNotes: {
      barriers: ["—"], // you can auto-fill later from sessions if you tag barriers
      notes: "This report summarises supports delivered and observed outcomes during the period. It supports (but does not replace) professional judgement and organisational reporting requirements.",
    },

    recommendations: {
      nextPeriod: [
        "Continue consistent session logging linked to goals and functional outcomes.",
        "Review approved to-dos and update actions based on observed progress and risks.",
      ],
    },

    signOff: {
      preparedBy: "Theraa Nurse (Draft)",
      coordinatorName: "",
      organisation: "",
      date: new Date().toLocaleDateString(),
    },
  };

  return report;
}

/**
 * Optional helper: converts report JSON into a clean plain-text template
 * you can paste into a portal or later feed into PDF export.
 */
export function renderNdisReportText(report) {
  const r = report || {};
  const lines = [];

  const add = (t = "") => lines.push(t);

  add(r?.meta?.title || "NDIS Progress Report");
  add(`Generated: ${safe(r?.meta?.generatedAt)}`);
  add("");

  add("PARTICIPANT DETAILS");
  add(`Name: ${safe(r?.participant?.name)}`);
  add(`Age: ${safe(r?.participant?.age)}`);
  add(`Participant ID: ${safe(r?.participant?.participantId)}`);
  if (r?.participant?.ndisNumber) add(`NDIS Number: ${safe(r?.participant?.ndisNumber)}`);
  add("");

  add("GOALS (Short-term)");
  (r?.goals?.shortTerm || []).forEach((g) => add(`- ${g}`));
  add("");

  add("GOALS (Long-term)");
  (r?.goals?.longTerm || []).forEach((g) => add(`- ${g}`));
  add("");

  add("SUPPORTS PLANNED");
  (r?.supportsPlanned || []).forEach((s) => add(`- ${s}`));
  add("");

  add("APPROVED ACTIONS — Support Worker");
  (r?.approvedActions?.supportWorker || []).forEach((a) => add(`- ${a}`));
  add("");

  add("APPROVED ACTIONS — Participant");
  (r?.approvedActions?.participant || []).forEach((a) => add(`- ${a}`));
  add("");

  add("SUPPORTS DELIVERED (Summary)");
  add(`Total sessions logged: ${safe(r?.supportsDelivered?.totalSessionsLogged)}`);
  (r?.supportsDelivered?.summary || []).forEach((s) => add(`- ${s}`));
  add("");

  add("OUTCOMES (Summary)");
  (r?.outcomes?.summary || []).forEach((o) => add(`- ${o}`));
  add("");

  add("RISK & INCIDENTS");
  add("Baseline risks (from plan):");
  (r?.risksAndIncidents?.baselineRisksFromPlan || []).forEach((x) => add(`- ${x}`));
  add("Risks observed (during period):");
  (r?.risksAndIncidents?.risksObservedDuringPeriod || []).forEach((x) => add(`- ${x}`));

  const incidents = r?.risksAndIncidents?.incidents || [];
  if (incidents.length) {
    add("Incidents:");
    incidents.forEach((i) => {
      add(`- ${safe(i.createdAt)} | ${safe(i.type)} | ${safe(i.description)} | Action: ${safe(i.actionTaken)}`);
    });
  } else {
    add("Incidents: None reported.");
  }

  add("");
  add("RECOMMENDATIONS (Next Period)");
  (r?.recommendations?.nextPeriod || []).forEach((x) => add(`- ${x}`));
  add("");

  add("SIGN-OFF");
  add(`Prepared by: ${safe(r?.signOff?.preparedBy)}`);
  add(`Coordinator: ${safe(r?.signOff?.coordinatorName)}`);
  add(`Organisation: ${safe(r?.signOff?.organisation)}`);
  add(`Date: ${safe(r?.signOff?.date)}`);

  return lines.join("\n");
}
