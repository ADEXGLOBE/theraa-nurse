import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { participant, evidence = "", knowledge = "", requestType = "care_plan" } = req.body || {};

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are Theraa Nurse Knowledge Engine. Generate safe, purpose-centred, NDIS-aligned support coordination recommendations. Do not diagnose. Do not give medical instructions. Recommend escalation to qualified professionals where needed.",
        },
        {
          role: "user",
          content: `
Participant:
${JSON.stringify(participant || {}, null, 2)}

Participant Evidence:
${evidence}

Structured Care Knowledge:
${knowledge}

Request Type:
${requestType}

Return:
1. Participant summary
2. Key risks
3. Purpose-centred goals
4. Support worker actions
5. Support coordinator actions
6. Escalation/referral suggestions
7. Evidence used
`,
        },
      ],
    });

    return res.status(200).json({
      result: response.output_text || "",
    });
  } catch (error) {
    console.error("Knowledge Engine error:", error);
    return res.status(500).json({ error: "Knowledge Engine failed." });
  }
}