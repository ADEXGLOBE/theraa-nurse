// src/features/safety/abuseDetectionEngine.js
// Scope-safe: flags concerns based on notes/sessions/observations.
// Not a diagnosis tool. Always requires human judgement.

function lower(s) {
  return (s || "").toLowerCase();
}

function includesAny(text, arr) {
  const t = lower(text);
  return arr.some((k) => t.includes(lower(k)));
}

export function detectSafeguardingConcerns({ client, sessions = [], notesText = "" }) {
  const text = [
    notesText,
    ...sessions.map((s) => `${s.title || ""}\n${s.body || s.note || ""}\n${s.outcome || ""}`),
  ].join("\n\n");

  const flags = [];

  // Physical abuse indicators
  if (includesAny(text, ["bruise", "bruising", "marks", "injury", "hit", "pushed", "rough", "unexplained"])) {
    flags.push({
      type: "physical",
      severity: "medium",
      summary: "Possible physical harm indicators mentioned (e.g., bruising/marks/injury).",
      recommendedAction:
        "Document objectively, inform supervisor, follow organisation safeguarding policy. If immediate danger call 000.",
    });
  }

  // Psychological/emotional abuse indicators
  if (includesAny(text, ["yelling", "shouting", "threat", "intimidat", "afraid", "fear", "humiliat", "angry carer"])) {
    flags.push({
      type: "psychological",
      severity: "medium",
      summary: "Possible emotional/psychological abuse indicators mentioned (fear, intimidation, yelling).",
      recommendedAction:
        "Provide reassurance, document behaviour objectively, escalate to supervisor for review and client safety planning.",
    });
  }

  // Financial abuse indicators
  if (includesAny(text, ["missing money", "no funds", "insufficient funds", "bank account", "atm", "withdraw", "cash gone"])) {
    flags.push({
      type: "financial",
      severity: "high",
      summary: "Possible financial irregularity indicators mentioned (e.g., insufficient funds/unexpected withdrawals).",
      recommendedAction:
        "Do not accuse anyone. Document, escalate to supervisor, safeguard the client’s choices and follow reporting policy.",
    });
  }

  // Neglect indicators
  if (includesAny(text, ["refuse shower", "poor hygiene", "not eating", "dehydrated", "left alone", "soiled", "neglect"])) {
    flags.push({
      type: "neglect",
      severity: "medium",
      summary: "Possible neglect/self-neglect indicators mentioned (nutrition/hygiene refusal or unmet needs).",
      recommendedAction:
        "Offer support choices, monitor, document, escalate if deterioration or risk increases.",
    });
  }

  // Self-harm / suicide risk language (escalation)
  if (includesAny(text, ["self-harm", "suicid", "kill myself", "end it"])) {
    flags.push({
      type: "self-harm-risk",
      severity: "critical",
      summary: "Self-harm/suicide risk language detected in notes.",
      recommendedAction:
        "Follow organisation crisis pathway immediately. If imminent risk, call 000. Inform supervisor urgently.",
    });
  }

  return {
    clientId: client?.id || "",
    clientName: client?.name || "",
    generatedAt: new Date().toISOString(),
    flags,
    hasConcerns: flags.length > 0,
  };
}