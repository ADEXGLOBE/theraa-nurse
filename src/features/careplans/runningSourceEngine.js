// src/features/careplans/runningSourceEngine.js

function safe(v) {
  return v == null ? "" : String(v);
}

function lower(v) {
  return safe(v).toLowerCase();
}

function uniq(arr = []) {
  return [...new Set((arr || []).filter(Boolean).map((x) => safe(x).trim()).filter(Boolean))];
}

function hasAny(text, keywords = []) {
  const t = lower(text);
  return keywords.some((k) => t.includes(lower(k)));
}

function joinText(parts = []) {
  return parts
    .flat()
    .filter(Boolean)
    .map((x) => safe(x))
    .join("\n");
}

function makePlanText(lines = []) {
  return uniq(lines).map((x) => `- ${x}`).join("\n");
}

function makePurposeCard({
  domain,
  title,
  whyItMatters,
  participantAction,
  workerAction,
  frequency = "Weekly",
  source = "running_source",
}) {
  return {
    id: `${domain}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`,
    domain,
    title,
    whyItMatters,
    participantAction,
    workerAction,
    frequency,
    source,
  };
}

function detectThemesFromText(text = "") {
  const t = lower(text);

  return {
    likesMusic: hasAny(t, ["music", "song", "sing", "choir", "radio"]),
    likesGardening: hasAny(t, ["garden", "gardening", "plants"]),
    likesReading: hasAny(t, ["book", "library", "reading", "read"]),
    likesCooking: hasAny(t, ["cook", "cooking", "kitchen", "meal prep"]),
    likesChurch: hasAny(t, ["church", "prayer", "faith", "religious", "catholic", "spiritual"]),
    likesCommunity: hasAny(t, ["community", "group", "volunteer", "club", "outing", "social"]),
    productivityGoal: hasAny(t, ["productivity", "work", "vocational", "employment", "study"]),
    distress: hasAny(t, ["anxious", "anxiety", "distress", "low mood", "depressed", "withdrawn"]),
    behaviourRisk: hasAny(t, ["agitated", "aggression", "escalation", "behaviour"]),
    fallsRisk: hasAny(t, ["fall", "falls", "walker", "mobility", "unsteady"]),
    swallowingRisk: hasAny(t, ["dysphagia", "choking", "swallow"]),
    isolation: hasAny(t, ["isolated", "withdrawn", "lonely", "alone", "does not socialise"]),
    routineNeed: hasAny(t, ["routine", "predictable", "structure", "same time"]),
    spiritualIdentity: hasAny(t, ["church", "faith", "religious", "prayer", "catholic"]),
  };
}

function generatePurposePlans(themes) {
  const cards = [];

  // Routine / stability
  cards.push(
    makePurposeCard({
      domain: "routine",
      title: "Build a meaningful weekly structure",
      whyItMatters:
        "A consistent routine reduces stress, supports memory, and gives the participant a sense of control and daily purpose.",
      participantAction:
        "Follow a simple weekly plan with regular wake times, meals, activity blocks, and rest periods.",
      workerAction:
        "Support the participant to follow a visible routine board and gently prepare them for transitions.",
      frequency: "Daily",
    })
  );

  // Social / community
  if (themes.likesCommunity || themes.isolation) {
    cards.push(
      makePurposeCard({
        domain: "social",
        title: "Rebuild safe social connection",
        whyItMatters:
          "Regular connection can reduce loneliness, support mood, and restore a sense of belonging.",
        participantAction:
          "Attend one suitable community, family, or small-group activity each week.",
        workerAction:
          "Help identify a low-stress social opportunity and support attendance or participation.",
        frequency: "Weekly",
      })
    );
  }

  // Music
  if (themes.likesMusic) {
    cards.push(
      makePurposeCard({
        domain: "joy",
        title: "Music-based purpose routine",
        whyItMatters:
          "Music can trigger positive memories, reduce distress, and create pleasure and identity.",
        participantAction:
          "Listen to a favourite playlist, radio program, or sing-along session at a regular time.",
        workerAction:
          "Create and use a personalised music routine during calm periods or before distress escalates.",
        frequency: "3–5 times weekly",
      })
    );
  }

  // Gardening
  if (themes.likesGardening) {
    cards.push(
      makePurposeCard({
        domain: "contribution",
        title: "Gardening and plant care role",
        whyItMatters:
          "Light gardening can support wellbeing, routine, movement, and a sense of responsibility.",
        participantAction:
          "Water plants, check leaves, or participate in simple gardening tasks.",
        workerAction:
          "Set up safe gardening tasks matched to ability and reinforce the participant’s role in caring for plants.",
        frequency: "Weekly",
      })
    );
  }

  // Reading / library
  if (themes.likesReading) {
    cards.push(
      makePurposeCard({
        domain: "cognitive",
        title: "Reading and reminiscence habit",
        whyItMatters:
          "Reading or being read to can support cognition, calm, and personal identity.",
        participantAction:
          "Read, browse, or listen to familiar books, magazines, or articles.",
        workerAction:
          "Provide suitable reading material and use it as a prompt for reminiscence and conversation.",
        frequency: "Weekly",
      })
    );
  }

  // Cooking / meal identity
  if (themes.likesCooking) {
    cards.push(
      makePurposeCard({
        domain: "independence",
        title: "Safe kitchen participation",
        whyItMatters:
          "Involvement in meal-related tasks can support independence and personal identity.",
        participantAction:
          "Take part in simple food-related choices or preparation steps within safe limits.",
        workerAction:
          "Offer structured, supervised meal tasks such as choosing ingredients, stirring, or setting up.",
        frequency: "Weekly",
      })
    );
  }

  // Spiritual / cultural purpose
  if (themes.likesChurch || themes.spiritualIdentity) {
    cards.push(
      makePurposeCard({
        domain: "spiritual",
        title: "Spiritual identity support plan",
        whyItMatters:
          "Spiritual connection can restore comfort, identity, hope, and emotional grounding.",
        participantAction:
          "Participate in prayer, religious services, devotion time, or faith-based reflection if desired.",
        workerAction:
          "Support access to spiritual routines, visits, recordings, or community links aligned with preference.",
        frequency: "Weekly",
      })
    );
  }

  // Movement / mobility
  if (themes.fallsRisk) {
    cards.push(
      makePurposeCard({
        domain: "wellbeing",
        title: "Gentle movement with purpose",
        whyItMatters:
          "Safe movement can support function, confidence, and reduce further decline.",
        participantAction:
          "Take part in guided walking, chair exercises, or mobility practice suited to current ability.",
        workerAction:
          "Prompt and support safe mobility practice and document tolerance, confidence, and changes.",
        frequency: "Daily / as tolerated",
      })
    );
  }

  // Distress / low mood
  if (themes.distress) {
    cards.push(
      makePurposeCard({
        domain: "emotional",
        title: "Calm-and-purpose regulation plan",
        whyItMatters:
          "Meaningful calming activities reduce distress and help the participant reconnect with what matters to them.",
        participantAction:
          "Use a preferred calming activity when distressed, such as music, quiet time, prayer, walking, or conversation.",
        workerAction:
          "Recognise early distress signs and redirect toward a preferred grounding activity linked to identity and strengths.",
        frequency: "Daily / as needed",
      })
    );
  }

  // Productivity / life-building
  if (themes.productivityGoal) {
    cards.push(
      makePurposeCard({
        domain: "growth",
        title: "Productivity and life-direction support",
        whyItMatters:
          "Small purposeful goals can improve confidence, motivation, and future direction.",
        participantAction:
          "Set one small weekly goal related to study, work readiness, planning, or self-management.",
        workerAction:
          "Review progress weekly and help break long-term aspirations into achievable tasks.",
        frequency: "Weekly",
      })
    );
  }

  // Swallowing support
  if (themes.swallowingRisk) {
    cards.push(
      makePurposeCard({
        domain: "nutrition",
        title: "Safe mealtime confidence plan",
        whyItMatters:
          "Comfortable and safe mealtimes protect health and help preserve enjoyment of eating.",
        participantAction:
          "Follow recommended mealtime pacing and positioning strategies.",
        workerAction:
          "Support safe meal setup and escalate swallowing concerns according to plan and clinical advice.",
        frequency: "Every meal",
      })
    );
  }

  return uniq(cards.map((x) => JSON.stringify(x))).map((x) => JSON.parse(x));
}

function toPendingTodoStrings(cards = []) {
  const worker = [];
  const client = [];

  cards.forEach((c) => {
    if (c.workerAction) {
      worker.push(`${c.title} — ${c.workerAction} (${c.frequency})`);
    }
    if (c.participantAction) {
      client.push(`${c.title} — ${c.participantAction} (${c.frequency})`);
    }
  });

  return {
    worker: uniq(worker),
    client: uniq(client),
  };
}

export function buildRunningSourcePlan({
  client,
  findings,
  existingPlan,
  recentSessions = [],
  documentIntelligence = null,
}) {
  const combinedText = joinText([
    findings?.combinedText || "",
    recentSessions.map((s) => s.notes || s.summary || s.handover || "").join("\n"),
    documentIntelligence
      ? [
          ...(documentIntelligence.participantDetails || []),
          ...(documentIntelligence.goals || []),
          ...(documentIntelligence.strengths || []),
          ...(documentIntelligence.functionalNeeds || []),
          ...(documentIntelligence.healthClinical || []),
          ...(documentIntelligence.risks || []),
          ...(documentIntelligence.triggers || []),
          ...(documentIntelligence.communication || []),
          ...(documentIntelligence.behaviourSupport || []),
          ...(documentIntelligence.legalEthical || []),
          ...(documentIntelligence.routinesAndPreferences || []),
        ].join("\n")
      : "",
  ]);

  const themes = detectThemesFromText(combinedText);
  const purposeCards = generatePurposePlans(themes);

  const purposeLines = purposeCards.map(
    (c) => `${c.title}: ${c.whyItMatters}`
  );

  const workerClientTodos = toPendingTodoStrings(purposeCards);

  const currentSections = existingPlan?.sections || {};

  const strengthenedSections = {
    participantDetails: makePlanText([
      ...(documentIntelligence?.participantDetails || []),
      currentSections.participantDetails || "",
      client?.name ? `Participant name: ${client.name}` : "",
      client?.age ? `Age: ${client.age}` : "",
    ]),

    goalsShort: makePlanText([
      ...(documentIntelligence?.goals || []),
      currentSections.goalsShort || "",
      "Maintain a meaningful daily routine with clear supports and preferred activities.",
    ]),

    goalsLong: makePlanText([
      currentSections.goalsLong || "",
      "Improve quality of life through purpose-based, person-centred supports.",
      "Support independence, identity, and social or community participation where safe and appropriate.",
    ]),

    strengths: makePlanText([
      ...(documentIntelligence?.strengths || []),
      currentSections.strengths || "",
      "Build on existing interests, routines, memories, and preferred roles.",
    ]),

    functionalNeeds: makePlanText([
      ...(documentIntelligence?.functionalNeeds || []),
      currentSections.functionalNeeds || "",
      "Support should combine safety, dignity, and active participation rather than task-only care.",
    ]),

    healthClinical: makePlanText([
      ...(documentIntelligence?.healthClinical || []),
      currentSections.healthClinical || "",
    ]),

    risks: makePlanText([
      ...(documentIntelligence?.risks || []),
      ...(findings?.risks || []),
      currentSections.risks || "",
      findings?.riskLevel ? `Overall risk level: ${findings.riskLevel}` : "",
    ]),

    riskControls: uniq([
      ...(currentSections.riskControls || []),
      ...(documentIntelligence?.triggers || []).length
        ? [`Monitor identified triggers and document effective responses.`]
        : [],
      themes.distress
        ? `Use early emotional regulation strategies before escalation.`
        : "",
      themes.fallsRisk
        ? `Support safe mobility and document mobility changes.`
        : "",
      themes.swallowingRisk
        ? `Follow safe meal and swallowing precautions and escalate concerns.`
        : "",
    ]),

    behaviourSupport: makePlanText([
      ...(documentIntelligence?.behaviourSupport || []),
      currentSections.behaviourSupport || "",
      themes.behaviourRisk
        ? "Use low-arousal communication, reassurance, redirection, and calm environmental supports."
        : "",
    ]),

    routinesAndPreferences: makePlanText([
      ...(documentIntelligence?.routinesAndPreferences || []),
      currentSections.routinesAndPreferences || "",
      ...purposeLines,
    ]),

    communication: makePlanText([
      ...(documentIntelligence?.communication || []),
      currentSections.communication || "",
      "Use calm, respectful, strengths-based communication and allow processing time.",
    ]),

    safeguardsConsent: makePlanText([
      ...(documentIntelligence?.legalEthical || []),
      currentSections.safeguardsConsent || "",
      "Purpose-based activities should be discussed, consented to where required, and reviewed for suitability.",
    ]),

    monitoringReview: makePlanText([
      currentSections.monitoringReview || "",
      "Review purpose-based routines weekly and update based on mood, participation, distress, and outcomes.",
      "Track what activities increase engagement, calm, motivation, and quality of life.",
    ]),

    legalEthical: makePlanText([
      currentSections.legalEthical || "",
      "All purpose-based recommendations require worker judgement, client choice, and provider approval where needed.",
      "Supports must remain within role scope and follow privacy, dignity, and duty-of-care requirements.",
    ]),
  };

  return {
    runningSource: {
      generatedAt: new Date().toISOString(),
      summary:
        "Theraa Nurse running source generated a purpose-enhanced care plan from care plans, notes, and health-related documents.",
      themes,
      purposeCards,
    },
    sections: strengthenedSections,
    todos: workerClientTodos,
  };
}