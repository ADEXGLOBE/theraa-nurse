// src/features/careplans/draftFromInsights.js
import { saveCarePlanVersion } from "../../data/carePlanStore";

export function buildDraftPlanFromInsights(insights, client) {
  if (!insights || !client) return null;

  const shortGoals = [];
  const longGoals = [];
  const risks = [];
  const communication = [];
  const supports = [];
  const legalEthical = [];

  // Goals from signals
  insights.signals.forEach((s) => {
    if (s.level === "high") {
      shortGoals.push(`Address ${s.label.toLowerCase()} immediately.`);
    }
    if (s.level === "medium") {
      longGoals.push(`Monitor and manage ${s.label.toLowerCase()} over time.`);
    }
  });

  if (shortGoals.length === 0) {
    shortGoals.push("Maintain current stability and daily routines.");
  }

  if (longGoals.length === 0) {
    longGoals.push("Maintain independence, safety, and quality of life.");
  }

  // Risks
  insights.signals.forEach((s) => {
    if (s.level === "high" || s.level === "medium") {
      risks.push(s.label);
    }
  });

  if (risks.length === 0) {
    risks.push("General risk of deterioration without ongoing monitoring.");
  }

  // Communication (safe defaults)
  communication.push(
    "Use clear, respectful language and allow time for responses.",
    "Observe and document changes in mood, behaviour, or physical condition."
  );

  // Supports from actions
  insights.actions.forEach((a) => supports.push(a));

  if (supports.length === 0) {
    supports.push("Continue current supports and review regularly.");
  }

  // Legal / ethical
  legalEthical.push(
    "Maintain duty of care at all times.",
    "Respect dignity of risk while ensuring safety.",
    "Maintain privacy and confidentiality.",
    "Follow mandatory reporting obligations where required."
  );

  return {
    title: `Draft Care Plan – ${client.name}`,
    clientId: client.id,
    goalsShort: shortGoals.join("\n"),
    goalsLong: longGoals.join("\n"),
    risks: risks.join("\n"),
    communication: communication.join("\n"),
    supports: supports.join("\n"),
    legalEthical: legalEthical.join("\n"),
    evidenceCount: insights.evidence?.length || 0,
  };
}

export function saveDraftFromInsights({ insights, client }) {
  const draft = buildDraftPlanFromInsights(insights, client);
  if (!draft) return null;

  return saveCarePlanVersion({
    clientId: client.id,
    status: "draft",
    plan: draft,
    evidenceCount: draft.evidenceCount,
  });
}
