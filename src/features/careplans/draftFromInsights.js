// src/features/careplans/draftFromInsights.js

import {
  createSharedCarePlanVersion,
} from "../../services/carePlanService";

export function buildDraftPlanFromInsights(
  insights,
  client
) {
  if (!insights || !client) {
    return null;
  }

  const shortGoals = [];
  const longGoals = [];
  const risks = [];
  const communication = [];
  const supports = [];
  const legalEthical = [];

  /*
   * Goals from intelligence signals.
   */
  (insights.signals || []).forEach(
    (signal) => {
      if (
        signal?.level === "high"
      ) {
        shortGoals.push(
          `Address ${String(
            signal.label || "identified issue"
          ).toLowerCase()} immediately.`
        );
      }

      if (
        signal?.level === "medium"
      ) {
        longGoals.push(
          `Monitor and manage ${String(
            signal.label || "identified issue"
          ).toLowerCase()} over time.`
        );
      }
    }
  );

  if (shortGoals.length === 0) {
    shortGoals.push(
      "Maintain current stability and daily routines."
    );
  }

  if (longGoals.length === 0) {
    longGoals.push(
      "Maintain independence, safety, and quality of life."
    );
  }

  /*
   * Risks from medium/high signals.
   */
  (insights.signals || []).forEach(
    (signal) => {
      if (
        signal?.level === "high" ||
        signal?.level === "medium"
      ) {
        risks.push(
          signal.label ||
            "Identified support risk"
        );
      }
    }
  );

  if (risks.length === 0) {
    risks.push(
      "General risk of deterioration without ongoing monitoring."
    );
  }

  /*
   * Communication defaults.
   */
  communication.push(
    "Use clear, respectful language and allow time for responses.",
    "Observe and document changes in mood, behaviour, or physical condition."
  );

  /*
   * Supports from recommended actions.
   */
  (insights.actions || []).forEach(
    (action) => {
      if (action) {
        supports.push(action);
      }
    }
  );

  if (supports.length === 0) {
    supports.push(
      "Continue current supports and review regularly."
    );
  }

  /*
   * Legal / ethical reminders.
   */
  legalEthical.push(
    "Maintain duty of care at all times.",
    "Respect dignity of risk while ensuring safety.",
    "Maintain privacy and confidentiality.",
    "Follow mandatory reporting obligations where required."
  );

  const evidenceCount =
    Array.isArray(insights.evidence)
      ? insights.evidence.length
      : 0;

  /*
   * Match the newer Purpose Plan structure while
   * preserving the old top-level fields for compatibility.
   */
  return {
    title:
      `Draft Care Plan – ${
        client.name ||
        "Participant"
      }`,

    clientId:
      client.id,

    participantId:
      client.id,

    goalsShort:
      shortGoals.join("\n"),

    goalsLong:
      longGoals.join("\n"),

    risks:
      risks.join("\n"),

    communication:
      communication.join("\n"),

    supports:
      supports.join("\n"),

    legalEthical:
      legalEthical.join("\n"),

    evidenceCount,

    sections: {
      participantSummary:
        `Draft generated from Theraa Nurse participant insights for ${
          client.name ||
          "the participant"
        }.`,

      strengthsPreferences:
        "",

      goalsShort:
        shortGoals.join("\n"),

      goalsLong:
        longGoals.join("\n"),

      communication:
        communication.join("\n"),

      functionalNeeds:
        supports.join("\n"),

      healthClinical:
        "",

      behaviourSupport:
        "",

      risks:
        risks.join("\n"),

      safeguards:
        legalEthical.join("\n"),

      monitoring:
        `Draft generated from ${evidenceCount} evidence item${
          evidenceCount === 1
            ? ""
            : "s"
        }. Professional review is required before implementation.`,
    },
  };
}


/**
 * Save an Insights-generated draft into the
 * organisation's shared Supabase Purpose Plan history.
 *
 * NOTE:
 * This function is now asynchronous.
 */
export async function saveDraftFromInsights({
  insights,
  client,
  organisationId,
  userId,
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required to save a shared Purpose Plan draft."
    );
  }

  if (!userId) {
    throw new Error(
      "Signed-in user ID is required to save a shared Purpose Plan draft."
    );
  }

  if (!client?.id) {
    throw new Error(
      "Participant is required to save a Purpose Plan draft."
    );
  }

  const draft =
    buildDraftPlanFromInsights(
      insights,
      client
    );

  if (!draft) {
    return null;
  }

  return createSharedCarePlanVersion({
    organisationId,

    participantId:
      client.id,

    userId,

    status:
      "draft",

    plan:
      draft,

    evidenceCount:
      draft.evidenceCount || 0,
  });
}