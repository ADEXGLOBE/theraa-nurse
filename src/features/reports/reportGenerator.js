// src/features/reports/reportGenerator.js

import {
  toSessionsByZoneChartData,
  toMoodChartData,
  toRiskChartData,
  toPurposeDomainChartData,
  toTopTodoChartData,
} from "./chartTransformers";

function safe(v) {
  return v == null ? "" : String(v);
}

function monthKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function inMonth(dateIso, key) {
  const d = new Date(dateIso);
  return monthKey(d) === key;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function generateMonthlyNdisReport({
  client,
  month = monthKey(new Date()),
  sessions = [],
  carePlanVersion,
  documentCount = 0,
}) {
  const monthSessions = safeArray(sessions).filter((s) =>
    inMonth(s.timestamp || s.createdAt || new Date().toISOString(), month)
  );

  const plan = carePlanVersion?.plan || {};
  const sections = plan?.sections || {};
  const runningSource = plan?.runningSource || {};
  const purposeCards = safeArray(runningSource?.purposeCards);

  const approvedWorker = safeArray(plan?.approvals?.approvedWorker);
  const approvedClient = safeArray(plan?.approvals?.approvedClient);

  const chartData = {
    sessionsByZone: toSessionsByZoneChartData(monthSessions),
    moodDistribution: toMoodChartData(monthSessions),
    riskProfile: toRiskChartData(plan),
    purposeDomains: toPurposeDomainChartData(purposeCards),
    todoApprovals: toTopTodoChartData(plan),
  };

  return {
    id: `monthly-${client?.id || "client"}-${month}`,
    generatedAt: new Date().toISOString(),
    reportPeriod: month,
    participant: {
      id: safe(client?.id),
      name: safe(client?.name),
      age: safe(client?.age),
    },
    carePlan: {
      versionId: safe(carePlanVersion?.id),
      status: safe(carePlanVersion?.status),
      generatedAt: safe(plan?.generatedAt || carePlanVersion?.createdAt),
    },
    summary: {
      totalSessions: monthSessions.length,
      documentCount,
      approvedWorkerTodos: approvedWorker.length,
      approvedClientTodos: approvedClient.length,
      purposePlansGenerated: purposeCards.length,
    },
    goals: {
      shortTerm: safe(sections?.goalsShort || plan?.goalsShort),
      longTerm: safe(sections?.goalsLong || plan?.goalsLong),
    },
    supportsAndOutcomes: {
      functionalNeeds: safe(sections?.functionalNeeds || plan?.supports),
      communication: safe(sections?.communication || plan?.communication),
      monitoringReview: safe(sections?.monitoringReview),
    },
    risksAndSafeguards: {
      risks: safe(sections?.risks || plan?.risks),
      riskControls: safeArray(sections?.riskControls),
      behaviourSupport: safe(sections?.behaviourSupport),
      legalEthical: safe(sections?.legalEthical || plan?.legalEthical),
    },
    purposeEnhancement: {
      summary: safe(runningSource?.summary),
      purposeCards,
    },
    chartData,
  };
}

export function exportMonthlySummaryText(report) {
  const lines = [];

  lines.push("THERAA NURSE – MONTHLY SUMMARY");
  lines.push("");
  lines.push(`Participant: ${safe(report?.participant?.name)}`);
  lines.push(`Age: ${safe(report?.participant?.age)}`);
  lines.push(`Period: ${safe(report?.reportPeriod)}`);
  lines.push(`Generated: ${safe(report?.generatedAt)}`);
  lines.push("");

  lines.push("SUMMARY");
  lines.push(`- Sessions this month: ${safe(report?.summary?.totalSessions)}`);
  lines.push(`- Documents analysed: ${safe(report?.summary?.documentCount)}`);
  lines.push(`- Approved worker to-dos: ${safe(report?.summary?.approvedWorkerTodos)}`);
  lines.push(`- Approved client to-dos: ${safe(report?.summary?.approvedClientTodos)}`);
  lines.push(`- Purpose plans generated: ${safe(report?.summary?.purposePlansGenerated)}`);
  lines.push("");

  lines.push("SHORT-TERM GOALS");
  lines.push(safe(report?.goals?.shortTerm) || "—");
  lines.push("");

  lines.push("LONG-TERM GOALS");
  lines.push(safe(report?.goals?.longTerm) || "—");
  lines.push("");

  lines.push("FUNCTIONAL SUPPORT NEEDS");
  lines.push(safe(report?.supportsAndOutcomes?.functionalNeeds) || "—");
  lines.push("");

  lines.push("COMMUNICATION");
  lines.push(safe(report?.supportsAndOutcomes?.communication) || "—");
  lines.push("");

  lines.push("RISKS");
  lines.push(safe(report?.risksAndSafeguards?.risks) || "—");
  lines.push("");

  lines.push("MONITORING & REVIEW");
  lines.push(safe(report?.supportsAndOutcomes?.monitoringReview) || "—");
  lines.push("");

  lines.push("PURPOSE ENHANCEMENT");
  lines.push(safe(report?.purposeEnhancement?.summary) || "—");

  safeArray(report?.purposeEnhancement?.purposeCards).forEach((card, idx) => {
    lines.push("");
    lines.push(`${idx + 1}. ${safe(card?.title)}`);
    lines.push(`   Domain: ${safe(card?.domain)}`);
    lines.push(`   Why it matters: ${safe(card?.whyItMatters)}`);
    lines.push(`   Participant action: ${safe(card?.participantAction)}`);
    lines.push(`   Worker action: ${safe(card?.workerAction)}`);
    lines.push(`   Frequency: ${safe(card?.frequency)}`);
  });

  return lines.join("\n");
}

export function downloadMonthlySummary(report) {
  const text = exportMonthlySummaryText(report);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `TheraaNurse-MonthlySummary-${report?.participant?.name || "Client"}-${report?.reportPeriod || "month"}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}