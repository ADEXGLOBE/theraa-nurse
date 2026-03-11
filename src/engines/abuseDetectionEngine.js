const ABUSE_KEYWORDS = [
  "bruise",
  "hit",
  "hurt",
  "angry carer",
  "afraid",
  "threat",
  "yelled",
  "force",
  "rough",
  "unsafe",
  "injury",
  "fear",
  "assault"
];

export function detectAbuseSignals(text) {
  if (!text) return [];

  const lower = text.toLowerCase();

  const matches = ABUSE_KEYWORDS.filter(word =>
    lower.includes(word)
  );

  if (matches.length === 0) return [];

  return [{
    level: "HIGH",
    type: "Potential Abuse Indicator",
    triggers: matches,
    recommendation:
      "Immediate review required. Follow incident reporting procedure."
  }];
}