// src/engines/documentIntelligence.js

function safe(v) {
  return v == null ? "" : String(v);
}

function lower(v) {
  return safe(v).toLowerCase();
}

function normalizeText(text) {
  return safe(text).replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function hasAny(text, keywords = []) {
  const t = lower(text);
  return keywords.some((k) => t.includes(lower(k)));
}

function uniq(arr = []) {
  return [...new Set(arr.filter(Boolean).map((x) => safe(x).trim()).filter(Boolean))];
}

function extractLinesByKeywords(text, keywords = []) {
  const lines = normalizeText(text).split("\n");
  return uniq(
    lines.filter((line) => hasAny(line, keywords)).map((line) => line.trim())
  );
}

function classifyDocument(text = "", fileName = "", explicitType = "") {
  const joined = `${lower(text)} ${lower(fileName)} ${lower(explicitType)}`;

  if (hasAny(joined, ["behaviour support plan", "bsp", "pbs", "restrictive practice"])) {
    return "behaviour_support_plan";
  }

  if (hasAny(joined, ["incident report", "incident", "injury", "bruise", "fall"])) {
    return "incident_report";
  }

  if (hasAny(joined, ["care plan", "support plan", "individualised plan"])) {
    return "care_plan";
  }

  if (hasAny(joined, ["ndis", "participant goals", "funding", "plan review"])) {
    return "ndis_plan";
  }

  if (hasAny(joined, ["psychology", "psychological", "clinical report", "mental health"])) {
    return "psychological_report";
  }

  if (hasAny(joined, ["medication", "mar", "dose", "tablet"])) {
    return "medication_document";
  }

  return "general_document";
}

export function extractDocumentIntelligence({
  text = "",
  fileName = "",
  explicitType = "",
}) {
  const raw = normalizeText(text);
  const t = lower(raw);

  const category = classifyDocument(raw, fileName, explicitType);

  const goals = [];
  const risks = [];
  const triggers = [];
  const supports = [];
  const communication = [];
  const healthClinical = [];
  const strengths = [];
  const legalEthical = [];
  const behaviourSupport = [];
  const routines = [];
  const participantDetails = [];

  // Participant details
  participantDetails.push(
    ...extractLinesByKeywords(raw, [
      "participant",
      "client",
      "ndis number",
      "dob",
      "date of birth",
      "emergency contact",
      "guardian",
      "nominee",
      "address",
      "phone",
    ])
  );

  // Goals
  if (hasAny(t, ["goal", "goals", "objective", "desired outcome"])) {
    goals.push(
      ...extractLinesByKeywords(raw, ["goal", "goals", "objective", "desired outcome"])
    );
  }
  if (hasAny(t, ["independence", "self-care", "community participation", "capacity building"])) {
    goals.push(
      ...extractLinesByKeywords(raw, [
        "independence",
        "self-care",
        "community participation",
        "capacity building",
      ])
    );
  }

  // Risks
  if (hasAny(t, ["fall", "falls", "bruise", "injury"])) {
    risks.push("Falls / injury risk");
  }
  if (hasAny(t, ["choking", "aspiration", "swallow", "dysphagia"])) {
    risks.push("Swallowing / choking risk");
  }
  if (hasAny(t, ["aggression", "behaviour", "escalation", "violence"])) {
    risks.push("Behaviour escalation risk");
  }
  if (hasAny(t, ["abscond", "wandering", "wander"])) {
    risks.push("Wandering / absconding risk");
  }
  if (hasAny(t, ["self-harm", "suicid"])) {
    risks.push("Self-harm / suicide risk");
  }
  if (hasAny(t, ["medication refusal", "missed dose", "non-adherence"])) {
    risks.push("Medication non-adherence risk");
  }

  risks.push(
    ...extractLinesByKeywords(raw, [
      "risk",
      "falls risk",
      "choking",
      "swallow",
      "aggression",
      "self-harm",
      "wandering",
      "abscond",
      "behaviour of concern",
    ])
  );

  // Triggers
  triggers.push(
    ...extractLinesByKeywords(raw, [
      "trigger",
      "triggers",
      "noise",
      "change in routine",
      "overstimulation",
      "crowds",
      "conflict",
      "new environment",
      "sensory",
    ])
  );

  // Supports
  supports.push(
    ...extractLinesByKeywords(raw, [
      "support",
      "prompting",
      "supervision",
      "partial assist",
      "full assist",
      "community access",
      "personal care",
      "meal preparation",
      "mobility",
      "transport",
      "medication prompting",
    ])
  );

  // Communication
  communication.push(
    ...extractLinesByKeywords(raw, [
      "communication",
      "preferred communication",
      "simple language",
      "visual cue",
      "allow time",
      "reassure",
      "calm tone",
    ])
  );

  // Health / clinical
  healthClinical.push(
    ...extractLinesByKeywords(raw, [
      "diagnosis",
      "allergy",
      "allergies",
      "gp",
      "ot",
      "physio",
      "psychologist",
      "psychiatrist",
      "medication",
      "arthritis",
      "dementia",
      "parkinson",
      "stroke",
      "mental health",
    ])
  );

  // Strengths
  strengths.push(
    ...extractLinesByKeywords(raw, [
      "strength",
      "strengths",
      "likes",
      "enjoys",
      "interests",
      "hobbies",
      "responds well",
      "calming activity",
      "music",
      "gardening",
      "reading",
    ])
  );

  // Behaviour support
  behaviourSupport.push(
    ...extractLinesByKeywords(raw, [
      "pbs",
      "behaviour support",
      "de-escalation",
      "low arousal",
      "redirection",
      "validation",
      "reminiscence",
      "reassurance",
      "restrictive practice",
    ])
  );

  // Legal / consent / safeguarding
  legalEthical.push(
    ...extractLinesByKeywords(raw, [
      "consent",
      "privacy",
      "confidentiality",
      "guardian",
      "nominee",
      "reportable",
      "abuse",
      "neglect",
      "mandatory reporting",
      "dignity of risk",
    ])
  );

  // Routines
  routines.push(
    ...extractLinesByKeywords(raw, [
      "morning routine",
      "breakfast",
      "lunch",
      "evening",
      "routine",
      "daily routine",
      "weekend",
      "church",
      "library",
      "gardening",
    ])
  );

  // Section map for downstream care-plan generation
  const sectionMap = {
    participantDetails: uniq(participantDetails),
    goals: uniq(goals),
    strengths: uniq(strengths),
    functionalNeeds: uniq(supports),
    healthClinical: uniq(healthClinical),
    risks: uniq(risks),
    triggers: uniq(triggers),
    communication: uniq(communication),
    behaviourSupport: uniq(behaviourSupport),
    legalEthical: uniq(legalEthical),
    routinesAndPreferences: uniq(routines),
  };

  return {
    category,
    sectionMap,
    derivedGoals: sectionMap.goals,
    derivedRisks: sectionMap.risks,
    derivedSupports: sectionMap.functionalNeeds,
    derivedTriggers: sectionMap.triggers,
    derivedCommunication: sectionMap.communication,
    derivedHealthClinical: sectionMap.healthClinical,
    derivedStrengths: sectionMap.strengths,
    derivedBehaviourSupport: sectionMap.behaviourSupport,
    derivedLegalEthical: sectionMap.legalEthical,
    derivedRoutines: sectionMap.routinesAndPreferences,
  };
}