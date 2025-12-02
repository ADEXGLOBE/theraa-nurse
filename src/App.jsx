import React, { useState, useEffect } from "react";

const STORAGE_KEY = "theraaNurseSessions_v2";

// ------- Helpers for localStorage -------
function loadSessions() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Failed to load sessions", e);
    return {};
  }
}

function saveSessionsToStorage(sessions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save sessions", e);
  }
}

// ------- Mock data (can later come from API) -------
const mockClients = [
  {
    id: "frank",
    name: "Frank",
    age: 79,
    primaryZone: "THERAPY",
    baselineNotes: "Responds well to calm music, slow walks and clear explanations.",
  },
  {
    id: "may",
    name: "May",
    age: 68,
    primaryZone: "MEDICATION",
    baselineNotes: "Recently adjusted antidepressant dose. Monitor mood & sleep.",
  },
];

const zones = [
  { id: "therapy", label: "Therapy Zone", subtitle: "Sessions, engagement & mood" },
  { id: "meds", label: "Medication Zone", subtitle: "Meds, schedules & adherence" },
  { id: "staff", label: "Staff / AI Zone", subtitle: "Notes, prompts & workflows" },
  { id: "vpn", label: "VPN / Remote Zone", subtitle: "Family calls & remote access" },
  { id: "paramedic", label: "Paramedic View", subtitle: "On-scene triage & handover" },
];

const bodySystems = [
  "Respiratory",
  "Cardiovascular / circulation",
  "Gastrointestinal / digestive",
  "Genitourinary (kidneys, bladder)",
  "Endocrine (diabetes, hormones)",
  "Musculoskeletal & mobility",
  "Neurological / cognition",
  "Integumentary (skin, hair, nails)",
  "Sensory vision, hearing, smell, taste, touch",
  "Immune / lymphatic",
  "Reproductive",
];

const moodStates = [
  "Calm",
  "Content",
  "Happy",
  "Flat",
  "Sad",
  "Anxious",
  "Irritable",
  "Agitated",
  "Confused",
];

const riskFlags = [
  "Suicidal thoughts",
  "Self-harm risk",
  "Aggression / violence",
  "Falls risk",
  "Medication concern",
  "Rapid deterioration",
];

const defaultVitals = {
  bpSystolic: "",
  bpDiastolic: "",
  hr: "",
  rr: "",
  spo2: "",
  temp: "",
};

function App() {
  const [selectedZone, setSelectedZone] = useState("therapy");
  const [selectedClientId, setSelectedClientId] = useState(mockClients[0].id);
  const [tab, setTab] = useState("overview");

  // session state
  const [checkedSystems, setCheckedSystems] = useState([]);
  const [selectedMood, setSelectedMood] = useState("");
  const [todayNotes, setTodayNotes] = useState("");
  const [medications, setMedications] = useState([
    { id: 1, name: "Sertraline 50mg mane", taken: false },
    { id: 2, name: "Vitamin D 1000IU mane", taken: false },
    { id: 3, name: "Paracetamol 1g prn", taken: false },
  ]);
  const [followUpFlag, setFollowUpFlag] = useState(false);
  const [vitals, setVitals] = useState(defaultVitals);
  const [calloutType, setCalloutType] = useState("");
  const [sceneSafetyNotes, setSceneSafetyNotes] = useState("");
  const [handoverSummary, setHandoverSummary] = useState("");

  // All stored sessions: { [clientId]: [sessionObjects...] }
  const [allSessions, setAllSessions] = useState({});

  // Load sessions on mount
  useEffect(() => {
    setAllSessions(loadSessions());
  }, []);

  const selectedClient = mockClients.find(c => c.id === selectedClientId);

  const clientSessions = allSessions[selectedClientId] || [];

  // --- Handlers ---

  const toggleBodySystem = (system) => {
    setCheckedSystems(prev =>
      prev.includes(system)
        ? prev.filter(s => s !== system)
        : [...prev, system]
    );
  };

  const toggleMedicationTaken = (id) => {
    setMedications(prev =>
      prev.map(m =>
        m.id === id ? { ...m, taken: !m.taken } : m
      )
    );
  };

  const handleVitalsChange = (field, value) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const resetSessionForm = () => {
    setCheckedSystems([]);
    setSelectedMood("");
    setTodayNotes("");
    setMedications(meds =>
      meds.map(m => ({ ...m, taken: false }))
    );
    setFollowUpFlag(false);
    setVitals(defaultVitals);
    setCalloutType("");
    setSceneSafetyNotes("");
    setHandoverSummary("");
  };

  const handleSaveSession = () => {
    const timestamp = new Date().toISOString();

    const session = {
      timestamp,
      clientId: selectedClientId,
      checkedSystems,
      selectedMood,
      todayNotes,
      medications: medications.map(m => ({ ...m })),
      followUpFlag,
      vitals: { ...vitals },
      calloutType,
      sceneSafetyNotes,
      handoverSummary,
    };

    const updated = {
      ...allSessions,
      [selectedClientId]: [session, ...(allSessions[selectedClientId] || [])],
    };

    setAllSessions(updated);
    saveSessionsToStorage(updated);
    resetSessionForm();

    alert("Session saved for " + selectedClient.name);
  };

  const handlePrintReport = () => {
    // Simple first version: browser print (can be replaced by proper PDF generator)
    window.print();
  };

  // --- Render bits ---

  const renderSidebar = () => (
    <aside
      style={{
        width: "260px",
        padding: "1.5rem",
        borderRight: "1px solid #e2e8f0",
        background: "#f9fafb",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: "1.5rem" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "999px",
            background: "#111827",
            color: "#f9fafb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            marginRight: 8,
          }}
        >
          TN
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Theraa Nurse v1.0 (Web)</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Packet Tracer concept reimagined as a client experience dashboard.
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        Zones
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {zones.map(z => (
          <button
            key={z.id}
            onClick={() => setSelectedZone(z.id)}
            style={{
              textAlign: "left",
              padding: "0.75rem 0.9rem",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background: selectedZone === z.id ? "#111827" : "#e5e7eb",
              color: selectedZone === z.id ? "#f9fafb" : "#111827",
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600 }}>{z.label}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{z.subtitle}</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: "2rem" }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
          Active clients
        </div>
        {mockClients.map(c => (
          <button
            key={c.id}
            onClick={() => {
              setSelectedClientId(c.id);
              setTab("overview");
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "0.5rem 0.75rem",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              background: selectedClientId === c.id ? "#dbeafe" : "transparent",
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {c.age} yrs · Primary: {c.primaryZone}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );

  const renderTherapyZone = () => (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Therapy Zone</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
            Sessions, engagement & mood – aligned to Recognise Healthy Body Systems (SUCQ).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSaveSession}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: 999,
              border: "none",
              background: "#111827",
              color: "white",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Save session
          </button>
          <button
            onClick={handlePrintReport}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              background: "white",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Export / print shift report
          </button>
        </div>
      </header>

      <section
        style={{
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: "1rem 1.2rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
          Client
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              {selectedClient.name} ({selectedClient.age})
            </div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Primary zone: {selectedClient.primaryZone}
            </div>
            <p style={{ fontSize: 13, color: "#4b5563", marginTop: 6 }}>
              {selectedClient.baselineNotes}
            </p>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
            Theraa Nurse · SUCQ-aligned mental health support
            <br />
            Use this screen for daily community / facility check-ins or paramedic welfare checks.
          </div>
        </div>

        {/* Tabs */}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          {["overview", "history", "notes"].map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                background: tab === key ? "#111827" : "#e5e7eb",
                color: tab === key ? "#f9fafb" : "#111827",
                textTransform: "capitalize",
              }}
            >
              {key}
            </button>
          ))}
        </div>
      </section>

      {tab === "overview" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.3fr)",
            gap: 16,
          }}
        >
          {/* Left column: Body systems + mood + notes */}
          <div
            style={{
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              padding: "1rem 1.2rem",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Body systems check (SUCQ)</h3>
            <p style={{ fontSize: 12, color: "#6b7280" }}>
              Tick what you observed this shift for your Recognise healthy body systems
              evidence. Use this for paramedic welfare checks, community reviews and
              facility rounds.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 4,
                marginTop: 8,
              }}
            >
              {bodySystems.map(system => (
                <label
                  key={system}
                  style={{
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checkedSystems.includes(system)}
                    onChange={() => toggleBodySystem(system)}
                  />
                  {system}
                </label>
              ))}
            </div>
          </div>

          {/* Right column: Mood, vitals & risk */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                padding: "0.9rem 1rem",
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Today&apos;s presentation</h3>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                Quick triage tags for mood / mental state. Pick the strongest presentation.
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {moodStates.map(mood => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setSelectedMood(mood)}
                    style={{
                      padding: "0.3rem 0.7rem",
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      background:
                        selectedMood === mood ? "#111827" : "#e5e7eb",
                      color:
                        selectedMood === mood ? "#f9fafb" : "#111827",
                    }}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                padding: "0.9rem 1rem",
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Vitals snapshot</h3>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                Optional for community staff; critical for paramedics and urgent reviews.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <label style={{ fontSize: 12 }}>
                  BP (systolic)
                  <input
                    type="number"
                    value={vitals.bpSystolic}
                    onChange={e => handleVitalsChange("bpSystolic", e.target.value)}
                    style={{ width: "100%", marginTop: 2 }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  BP (diastolic)
                  <input
                    type="number"
                    value={vitals.bpDiastolic}
                    onChange={e => handleVitalsChange("bpDiastolic", e.target.value)}
                    style={{ width: "100%", marginTop: 2 }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  HR (bpm)
                  <input
                    type="number"
                    value={vitals.hr}
                    onChange={e => handleVitalsChange("hr", e.target.value)}
                    style={{ width: "100%", marginTop: 2 }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  RR (breaths/min)
                  <input
                    type="number"
                    value={vitals.rr}
                    onChange={e => handleVitalsChange("rr", e.target.value)}
                    style={{ width: "100%", marginTop: 2 }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  SpO₂ (%)
                  <input
                    type="number"
                    value={vitals.spo2}
                    onChange={e => handleVitalsChange("spo2", e.target.value)}
                    style={{ width: "100%", marginTop: 2 }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Temp (°C)
                  <input
                    type="number"
                    value={vitals.temp}
                    onChange={e => handleVitalsChange("temp", e.target.value)}
                    style={{ width: "100%", marginTop: 2 }}
                  />
                </label>
              </div>
            </div>

            <div
              style={{
                borderRadius: 16,
                border: "1px solid #fee2e2",
                background: "#fef2f2",
                padding: "0.9rem 1rem",
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: 15 }}>Risk flags</h3>
              <p style={{ fontSize: 12, color: "#b91c1c", marginBottom: 6 }}>
                Tick any immediate risks. Use this when phoning triage, paramedics or ED.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 4,
                }}
              >
                {riskFlags.map(flag => (
                  <label
                    key={flag}
                    style={{
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      // simple hack: reuse checkedSystems for risk as well, or extend later
                      checked={checkedSystems.includes(flag)}
                      onChange={() => toggleBodySystem(flag)}
                    />
                    {flag}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Full-width below in layout */}
        </div>
      )}

      {tab === "overview" && (
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.4fr)",
            gap: 16,
          }}
        >
          {/* Medications + follow-up */}
          <div
            style={{
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              padding: "1rem 1.2rem",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Medication checks</h3>
            <p style={{ fontSize: 12, color: "#6b7280" }}>
              Confirm regular meds and document adherence. Paramedics can quickly
              see critical regular medications and missed doses.
            </p>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {medications.map(m => (
                <li
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.35rem 0",
                    fontSize: 13,
                  }}
                >
                  <span>{m.name}</span>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={m.taken}
                      onChange={() => toggleMedicationTaken(m.id)}
                    />
                    Taken this shift
                  </label>
                </li>
              ))}
            </ul>
            <label
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={followUpFlag}
                onChange={e => setFollowUpFlag(e.target.checked)}
              />
              Flag medication issue for follow-up / prescriber review
            </label>
          </div>

          {/* Session notes */}
          <div
            style={{
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              padding: "1rem 1.2rem",
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Session / callout notes</h3>
            <textarea
              rows={7}
              value={todayNotes}
              onChange={e => setTodayNotes(e.target.value)}
              placeholder="Briefly summarise the interaction. What helped, what didn’t, any triggers, safety concerns, family updates, etc."
              style={{
                width: "100%",
                resize: "vertical",
                fontSize: 13,
                padding: 8,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}

      {tab === "history" && (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: "1rem 1.2rem",
            marginTop: 8,
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Session history</h3>
          <p style={{ fontSize: 12, color: "#6b7280" }}>
            Recent sessions for {selectedClient.name}. Use this for trends, SUCQ evidence
            and paramedic handover.
          </p>
          {clientSessions.length === 0 && (
            <p style={{ fontSize: 13 }}>No sessions saved yet for this client.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {clientSessions.map((s, idx) => (
              <div
                key={idx}
                style={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  padding: "0.75rem 0.9rem",
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {new Date(s.timestamp).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Mood: {s.selectedMood || "Not set"}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 4 }}>
                  Body systems:{" "}
                  {s.checkedSystems && s.checkedSystems.length > 0
                    ? s.checkedSystems.join(", ")
                    : "None recorded"}
                </div>
                {s.vitals && (
                  <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 4 }}>
                    Vitals:
                    {" "}
                    {s.vitals.bpSystolic && s.vitals.bpDiastolic
                      ? `BP ${s.vitals.bpSystolic}/${s.vitals.bpDiastolic} `
                      : ""}
                    {s.vitals.hr && `HR ${s.vitals.hr} `}
                    {s.vitals.rr && `RR ${s.vitals.rr} `}
                    {s.vitals.spo2 && `SpO₂ ${s.vitals.spo2}% `}
                    {s.vitals.temp && `Temp ${s.vitals.temp}°C`}
                  </div>
                )}
                {s.todayNotes && (
                  <div style={{ fontSize: 12, marginBottom: 4 }}>
                    Notes: {s.todayNotes}
                  </div>
                )}
                {s.followUpFlag && (
                  <div style={{ fontSize: 12, color: "#b91c1c" }}>
                    ⚠ Medication follow-up required
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "notes" && (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: "1rem 1.2rem",
            marginTop: 8,
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Clinical notebook (client-specific)</h3>
          <p style={{ fontSize: 12, color: "#6b7280" }}>
            Use this area for longer-term observations, goals and care-planning ideas.
            (This could later sync with a proper care-plan system.)
          </p>
          <textarea
            rows={10}
            placeholder="E.g. Build gradual exposure plan for community walks; music playlist that client prefers; early warning signs; family contact preferences..."
            style={{
              width: "100%",
              resize: "vertical",
              fontSize: 13,
              padding: 8,
              boxSizing: "border-box",
            }}
          />
        </div>
      )}
    </div>
  );

  const renderMedicationZone = () => (
    <div>
      <h2>Medication Zone</h2>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        Meds, schedules & adherence. Built so support workers, nurses and paramedics
        can all quickly see what the regular plan is.
      </p>
      <ul style={{ fontSize: 13 }}>
        {medications.map(m => (
          <li key={m.id}>
            {m.name} –{" "}
            <strong>{m.taken ? "Taken this shift" : "Not yet recorded"}</strong>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: "#6b7280" }}>
        (Later: this screen can become a full medication chart with times, prescriber,
        allergies and interaction warnings.)
      </p>
    </div>
  );

  const renderStaffZone = () => (
    <div>
      <h2>Staff / AI Zone</h2>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        Shift prompts, workflow checklists and AI-style suggestions for paramedics and
        support staff.
      </p>
      <ol style={{ fontSize: 13 }}>
        <li>Start of shift: review last 3 sessions in History tab.</li>
        <li>Identify any red flags or recent deterioration.</li>
        <li>Plan today&apos;s check-in – what is the minimum safe assessment?</li>
        <li>During visit: capture SUCQ body systems and mood tags.</li>
        <li>End of shift: save session and escalate any risk flags.</li>
      </ol>
      <p style={{ fontSize: 12, color: "#6b7280" }}>
        (Later: this area can surface automated suggestions based on patterns in mood,
        vitals and medication adherence.)
      </p>
    </div>
  );

  const renderVPNZone = () => (
    <div>
      <h2>VPN / Remote Zone</h2>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        Simulated remote access / family portal, mirroring your Packet Tracer VPN
        segment.
      </p>
      <ul style={{ fontSize: 13 }}>
        <li>Family video check-in booked for Friday 4pm.</li>
        <li>GP remote review scheduled next week.</li>
        <li>Paramedic service can access last 3 sessions when callout is active.</li>
      </ul>
      <p style={{ fontSize: 12, color: "#6b7280" }}>
        (Later: connect this to a real backend and WebRTC / telehealth services.)
      </p>
    </div>
  );

  const renderParamedicView = () => (
    <div>
      <h2>Paramedic View – On-scene triage & handover</h2>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        A compressed view of the most important information for ambulance crews and
        rapid response teams.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1.2fr)",
          gap: 16,
          marginTop: 8,
        }}
      >
        <div
          style={{
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: "1rem 1.2rem",
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 15 }}>
            1. Callout type & scene safety
          </h3>
          <label style={{ fontSize: 13 }}>
            Callout type
            <select
              value={calloutType}
              onChange={e => setCalloutType(e.target.value)}
              style={{
                display: "block",
                marginTop: 4,
                width: "100%",
                padding: 6,
                fontSize: 13,
              }}
            >
              <option value="">Select…</option>
              <option value="mentalHealthCrisis">Mental health crisis</option>
              <option value="behaviouralEscalation">
                Behavioural escalation / aggression
              </option>
              <option value="medicationIssue">
                Medication issue / overdose / missed meds
              </option>
              <option value="fallsInjury">Fall / injury</option>
              <option value="medicalDeterioration">Medical deterioration</option>
              <option value="welfareCheck">Welfare check</option>
            </select>
          </label>

          <label style={{ fontSize: 13, display: "block", marginTop: 8 }}>
            Scene safety / hazards
            <textarea
              rows={5}
              value={sceneSafetyNotes}
              onChange={e => setSceneSafetyNotes(e.target.value)}
              placeholder="E.g. Weapons, animals, other people present, drug use, environmental risks..."
              style={{
                width: "100%",
                marginTop: 4,
                padding: 6,
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </label>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            padding: "1rem 1.2rem",
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: 15 }}>2. Handover summary</h3>
          <p style={{ fontSize: 12, color: "#6b7280" }}>
            SBAR-style summary (Situation, Background, Assessment, Recommendation).
          </p>
          <textarea
            rows={8}
            value={handoverSummary}
            onChange={e => setHandoverSummary(e.target.value)}
            placeholder="S: Reason for callout. B: Relevant history & meds. A: What you see now (include mood, risks, vitals). R: What you are asking paramedics / ED to do."
            style={{
              width: "100%",
              marginTop: 4,
              padding: 6,
              fontSize: 13,
              resize: "vertical",
            }}
          />
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            This will be saved when you click <strong>Save session</strong> and will
            appear in the client&apos;s history.
          </p>
        </div>
      </div>
    </div>
  );

  const renderMain = () => {
    switch (selectedZone) {
      case "therapy":
        return renderTherapyZone();
      case "meds":
        return renderMedicationZone();
      case "staff":
        return renderStaffZone();
      case "vpn":
        return renderVPNZone();
      case "paramedic":
        return renderParamedicView();
      default:
        return renderTherapyZone();
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        background: "#f3f4f6",
        color: "#111827",
      }}
    >
      {renderSidebar()}
      <main
        style={{
          flex: 1,
          padding: "1.5rem 1.75rem",
          boxSizing: "border-box",
        }}
      >
        {renderMain()}
      </main>
    </div>
  );
}

export default App;
