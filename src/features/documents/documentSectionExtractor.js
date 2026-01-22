// src/features/documents/documentSectionExtractor.js

function extractByKeywords(text, keywords) {
  const lines = text.split(/\n+/);
  return lines.filter((l) =>
    keywords.some((k) => l.toLowerCase().includes(k))
  );
}

export function extractSections(text = "") {
  const clean = text.replace(/\r/g, "");

  return {
    diagnoses: extractByKeywords(clean, [
      "diagnosis",
      "diagnostic impression",
      "clinical impression",
    ]),

    risks: extractByKeywords(clean, [
      "risk",
      "safety",
      "falls",
      "self-harm",
      "aggression",
      "crisis",
    ]),

    goals: extractByKeywords(clean, [
      "goal",
      "aim",
      "objective",
      "outcome",
    ]),

    triggers: extractByKeywords(clean, [
      "trigger",
      "stress",
      "overwhelm",
      "anxiety",
    ]),

    communication: extractByKeywords(clean, [
      "communication",
      "engage",
      "approach",
      "interaction",
    ]),

    supports: extractByKeywords(clean, [
      "support",
      "therapy",
      "intervention",
      "assistance",
    ]),

    recommendations: extractByKeywords(clean, [
      "recommend",
      "should",
      "plan",
      "review",
    ]),
  };
}
