// api/knowledge-engine.js
import OpenAI from "openai";

const carePlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    participantSummary: {
      type: "string",
      description:
        "A concise, evidence-grounded summary of the participant, their current circumstances, strengths, preferences and support context.",
    },

    participantDetails: {
      type: "string",
      description:
        "Relevant participant profile and plan information supported by the supplied evidence.",
    },

    strengthsAndPreferences: {
      type: "string",
      description:
        "Participant strengths, interests, preferences, capabilities, relationships and protective factors.",
    },

    purposeCentredGoals: {
      type: "string",
      description:
        "Practical short-term and long-term goals connected to the participant's own purpose, preferences, independence and community participation.",
    },

    communicationNeeds: {
      type: "string",
      description:
        "Communication preferences, communication supports, decision-making assistance and accessible communication strategies.",
    },

    functionalSupports: {
      type: "string",
      description:
        "Daily living, mobility, personal care, community access, routine, prompting and independence-building supports.",
    },

    healthClinical: {
      type: "string",
      description:
        "Only evidenced health, medication, allied health and clinical considerations. Do not diagnose or prescribe.",
    },

    behaviourSupport: {
      type: "string",
      description:
        "Evidenced behaviours, triggers, proactive strategies, de-escalation approaches and positive behaviour supports.",
    },

    risks: {
      type: "string",
      description:
        "Evidence-based risks, warning signs, protective measures and appropriate escalation requirements.",
    },

    supportWorkerActions: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Clear, practical and scope-safe actions for support workers.",
    },

    supportCoordinatorActions: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Actions for the support coordinator, including review, referrals, coordination, evidence gathering and follow-up.",
    },

    purposePlan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
          },
          domain: {
            type: "string",
          },
          frequency: {
            type: "string",
          },
          whyItMatters: {
            type: "string",
          },
          participantAction: {
            type: "string",
          },
          workerAction: {
            type: "string",
          },
        },
        required: [
          "title",
          "domain",
          "frequency",
          "whyItMatters",
          "participantAction",
          "workerAction",
        ],
      },
      description:
        "Meaningful activities and routines connected to the participant's identity, interests, goals and daily purpose.",
    },

    monitoringReview: {
      type: "string",
      description:
        "What should be monitored, how outcomes should be recorded, indicators of progress, and suggested review considerations.",
    },

    legalEthical: {
      type: "string",
      description:
        "Relevant privacy, consent, dignity of risk, duty of care, restrictive practice, safeguarding and scope-of-role considerations.",
    },

    escalationReferrals: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Matters that may require escalation, specialist review or referral to an authorised professional.",
    },

    evidenceUsed: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Specific supplied evidence or knowledge sources relied on for the recommendations.",
    },

    missingEvidence: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Important missing documents, assessments or information that would strengthen the plan.",
    },

    confidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        overall: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },
        participantDetails: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },
        goals: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },
        functionalSupports: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },
        healthClinical: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },
        behaviourSupport: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },
        risks: {
          type: "integer",
          minimum: 0,
          maximum: 100,
        },
      },
      required: [
        "overall",
        "participantDetails",
        "goals",
        "functionalSupports",
        "healthClinical",
        "behaviourSupport",
        "risks",
      ],
    },
  },

  required: [
    "participantSummary",
    "participantDetails",
    "strengthsAndPreferences",
    "purposeCentredGoals",
    "communicationNeeds",
    "functionalSupports",
    "healthClinical",
    "behaviourSupport",
    "risks",
    "supportWorkerActions",
    "supportCoordinatorActions",
    "purposePlan",
    "monitoringReview",
    "legalEthical",
    "escalationReferrals",
    "evidenceUsed",
    "missingEvidence",
    "confidence",
  ],
};

function buildLegacyText(structured) {
  return [
    "1. Participant Summary",
    structured.participantSummary,

    "\n2. Participant Details",
    structured.participantDetails,

    "\n3. Strengths and Preferences",
    structured.strengthsAndPreferences,

    "\n4. Purpose-Centred Goals",
    structured.purposeCentredGoals,

    "\n5. Communication Needs",
    structured.communicationNeeds,

    "\n6. Functional Supports",
    structured.functionalSupports,

    "\n7. Health and Clinical Considerations",
    structured.healthClinical,

    "\n8. Behaviour Support",
    structured.behaviourSupport,

    "\n9. Evidence-Based Risks",
    structured.risks,

    "\n10. Support Worker Actions",
    ...(structured.supportWorkerActions || []).map(
      (item) => `- ${item}`
    ),

    "\n11. Support Coordinator Actions",
    ...(structured.supportCoordinatorActions || []).map(
      (item) => `- ${item}`
    ),

    "\n12. Monitoring and Review",
    structured.monitoringReview,

    "\n13. Legal and Ethical Considerations",
    structured.legalEthical,

    "\n14. Escalation and Referral Suggestions",
    ...(structured.escalationReferrals || []).map(
      (item) => `- ${item}`
    ),

    "\n15. Evidence Used",
    ...(structured.evidenceUsed || []).map(
      (item) => `- ${item}`
    ),

    "\n16. Missing Evidence",
    ...(structured.missingEvidence || []).map(
      (item) => `- ${item}`
    ),
  ]
    .filter((value) => value !== null && value !== undefined)
    .join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      ok: false,
      error: "Method not allowed.",
      expected: "POST",
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY is missing on the server.",
        fix:
          "Add OPENAI_API_KEY in Vercel Environment Variables and redeploy.",
      });
    }

    const openai = new OpenAI({
      apiKey,
    });

    const {
      participant = {},
      evidence = "",
      knowledge = "",
      currentPlan = {},
      requestType = "enhance_care_plan",
    } = req.body || {};

    const response = await openai.responses.create({
      model: "gpt-4o-mini",

      text: {
        format: {
          type: "json_schema",
          name: "theraa_nurse_structured_care_plan",
          description:
            "A structured, evidence-grounded and purpose-centred support plan enhancement.",
          strict: true,
          schema: carePlanSchema,
        },
      },

      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `
You are the Theraa Nurse Knowledge Engine.

You support Australian NDIS, disability, aged care and support coordination workflows.

CORE PRINCIPLES

1. Purpose-centred
Recommendations must connect support to what matters to the participant, including identity, relationships, independence, community participation, interests, routines and meaningful daily life.

2. Evidence-grounded
Use only the participant profile, participant evidence, existing plan and structured knowledge supplied in this request.

3. Scope-safe
Do not diagnose, prescribe, alter medication, claim clinical certainty or replace an authorised health professional.

4. Explainable
Do not invent facts. Clearly identify missing evidence and reduce confidence when supporting information is incomplete.

5. Rights-based
Respect dignity, privacy, consent, choice, control, autonomy, dignity of risk, safeguarding and least-restrictive practice.

6. Practical
Recommendations must be usable by support workers and support coordinators.

7. Professional review
All generated content remains a draft and must be reviewed by an authorised human professional before use.

STRUCTURED OUTPUT RULES

- Return every required field.
- Use an empty string or empty array where no supported information exists.
- Keep risks evidence-based.
- Separate support-worker actions from support-coordinator actions.
- Do not place all recommendations into Monitoring and Review.
- Distribute information according to the meaning of each schema field.
- Confidence scores must reflect the strength and completeness of the supplied evidence.
`.trim(),
            },
          ],
        },

        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
REQUEST TYPE:
${requestType}

PARTICIPANT PROFILE:
${JSON.stringify(participant, null, 2)}

CURRENT PURPOSE PLAN:
${JSON.stringify(currentPlan, null, 2)}

PARTICIPANT EVIDENCE:
${
  evidence ||
  "No participant-specific evidence was supplied."
}

GLOBAL STRUCTURED CARE KNOWLEDGE:
${
  knowledge ||
  "No organisation-wide structured care knowledge was supplied."
}

Generate a structured, purpose-centred plan enhancement using only the supplied material.
`.trim(),
            },
          ],
        },
      ],
    });

    const outputText = response.output_text || "";

    if (!outputText) {
      return res.status(502).json({
        ok: false,
        error: "The Knowledge Engine returned no output.",
      });
    }

    let structured;

    try {
      structured = JSON.parse(outputText);
    } catch (parseError) {
      console.error(
        "Knowledge Engine JSON parse error:",
        parseError
      );

      return res.status(502).json({
        ok: false,
        error:
          "The Knowledge Engine returned an unreadable structured response.",
        details:
          parseError?.message || String(parseError),
        rawOutput: outputText,
      });
    }

    const legacyResult = buildLegacyText(structured);

    return res.status(200).json({
      ok: true,

      // New structured response used by CarePlanZone V2.
      structured,

      // Backward compatibility for the current frontend.
      result: legacyResult,

      meta: {
        responseId: response.id || null,
        model: "gpt-4o-mini",
        requestType,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Knowledge Engine API error:", error);

    return res.status(500).json({
      ok: false,
      error: "Knowledge Engine failed.",
      details: error?.message || String(error),
      name: error?.name || "UnknownError",
      status: error?.status || null,
      code: error?.code || null,
    });
  }
}