import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is missing on the server.",
        fix: "Check Vercel Environment Variables and redeploy.",
      });
    }

    const openai = new OpenAI({ apiKey });

    const {
      participant = {},
      evidence = "",
      knowledge = "",
      currentPlan = {},
      requestType = "enhance_care_plan",
    } = req.body || {};

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `
You are Theraa Nurse Knowledge Engine.

Generate safe, practical, purpose-centred, NDIS-friendly support recommendations.
Do not diagnose, prescribe, or replace clinicians.

REQUEST TYPE:
${requestType}

PARTICIPANT PROFILE:
${JSON.stringify(participant, null, 2)}

CURRENT CARE PLAN:
${JSON.stringify(currentPlan, null, 2)}

PARTICIPANT EVIDENCE:
${evidence || "No participant evidence supplied."}

GLOBAL STRUCTURED CARE KNOWLEDGE:
${knowledge || "No structured care knowledge supplied."}

Return:
1. Participant Summary
2. Evidence-Based Risks
3. Purpose-Centred Goals
4. Support Worker Actions
5. Support Coordinator Actions
6. Knowledge Base Considerations
7. Escalation / Referral Suggestions
8. Evidence Used
`,
    });

    return res.status(200).json({
      result: response.output_text || "No output returned.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Knowledge Engine failed.",
      details: error?.message || String(error),
    });
  }
}