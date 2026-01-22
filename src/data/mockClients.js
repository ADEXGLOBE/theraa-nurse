// src/data/mockClients.js
// Canonical client source for Theraa Nurse v1
// (Merged from former src/data/clients.js)

// Zone keys used across the app (standardised)
const ZONES = {
  THERAPY: "THERAPY",
  MEDS: "MEDS",
  STAFF: "STAFF",
  VPN: "VPN",
  PARAMEDIC: "PARAMEDIC",
};

// Helper: create a robust client shape with safe defaults
function makeClient({
  id,
  name,
  age,
  primaryZone,
  diagnoses = [],
  keyRisks = [],
  lastSession = "",
  moodSummary = "",
}) {
  return {
    id,
    name,
    age,
    primaryZone,

    // Rich clinical/service context (used for optimisation + care plans)
    diagnoses,
    keyRisks,
    lastSession,
    moodSummary,
  };
}

const mockClients = [
  // ✅ MERGED: Frank (from clients.js, keeps same id)
  makeClient({
    id: "frank",
    name: "Frank",
    age: 79,
    primaryZone: ZONES.THERAPY,
    diagnoses: ["Osteoporosis", "Chronic kidney disease", "Hyperthyroidism"],
    keyRisks: ["Falls risk", "Memory changes"],
    lastSession: "Music therapy – yesterday afternoon",
    moodSummary: "Responds well to calm music and walks.",
  }),

  // ✅ Existing client in v1 (Jason) — add safe defaults now (we’ll enrich later via documents)
  makeClient({
    id: "jason",
    name: "Jason",
    age: 22,
    primaryZone: ZONES.THERAPY,
    diagnoses: [],
    keyRisks: [],
    lastSession: "",
    moodSummary: "",
  }),

  // ✅ Existing client in v1 (Margaret) — add safe defaults now
  makeClient({
    id: "margaret",
    name: "Margaret",
    age: 86,
    primaryZone: ZONES.MEDS,
    diagnoses: [],
    keyRisks: [],
    lastSession: "",
    moodSummary: "",
  }),

  // ✅ MERGED: Audrey (from clients.js)
  makeClient({
    id: "audrey",
    name: "Audrey",
    age: 83,
    primaryZone: ZONES.MEDS,
    diagnoses: ["Possible heart failure", "Fluid retention"],
    keyRisks: ["Shortness of breath", "Swelling"],
    lastSession: "Nurse medication round – this morning",
    moodSummary: "Gets tired easily, prefers shorter activities.",
  }),

  // ✅ MERGED: Oliver (from clients.js)
  makeClient({
    id: "oliver",
    name: "Oliver",
    age: 51,
    primaryZone: ZONES.THERAPY,
    diagnoses: ["GI symptoms", "History of depression", "Hearing impairment"],
    keyRisks: ["Weight loss", "Low mood"],
    lastSession: "1:1 support conversation – two days ago",
    moodSummary:
      "Feels more settled after clear communication and short walks.",
  }),

  // ✅ MERGED: Emma (from clients.js)
  makeClient({
    id: "emma",
    name: "Emma",
    age: 35,
    primaryZone: ZONES.STAFF,
    diagnoses: ["Psychosocial disability", "Diabetes risk"],
    keyRisks: ["Mood fluctuations", "Lifestyle factors"],
    lastSession: "Health coaching call – last week",
    moodSummary: "Needs regular check-ins and lifestyle support.",
  }),

  // ✅ MERGED: Remote NDIS client (from clients.js)
  makeClient({
    id: "remote-client",
    name: "Lena (Remote NDIS Client)",
    age: 28,
    primaryZone: ZONES.VPN,
    diagnoses: ["Autism Spectrum", "Sensory overload"],
    keyRisks: ["Anxiety in new environments"],
    lastSession: "Video call – this morning",
    moodSummary: "Prefers remote sessions with predictable routines.",
  }),
];

export default mockClients;
