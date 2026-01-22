import { useState } from "react";
import { loadSessions, saveSessions } from "../data/sessionStore";
import mockClients from "../data/mockClients";

export default function ParamedicZone() {
  const [selectedClientId, setSelectedClientId] = useState(mockClients[0].id);
  const [calloutType, setCalloutType] = useState("");
  const [sceneSafety, setSceneSafety] = useState("");
  const [handover, setHandover] = useState("");
  const [vitals, setVitals] = useState({
    bpSystolic: "",
    bpDiastolic: "",
    hr: "",
    rr: "",
    spo2: "",
    temp: "",
  });

  const selectedClient = mockClients.find((c) => c.id === selectedClientId);

  const handleSave = () => {
    const all = loadSessions();
    const payload = {
      timestamp: new Date().toISOString(),
      clientId: selectedClientId,
      zone: "paramedic",
      calloutType,
      sceneSafety,
      handover,
      vitals,
    };
    const updated = {
      ...all,
      [selectedClientId]: [payload, ...(all[selectedClientId] || [])],
    };
    saveSessions(updated);
    alert("Paramedic session saved!");
  };

  const updateVital = (key, value) => {
    setVitals((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramedic View</h1>
          <p className="page-subtitle">
            Rapid response dashboard for ambulance and urgent callouts. Capture callout
            type, scene safety, vitals and SBAR handover in one place.
          </p>
          {selectedClient && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              Client: <strong>{selectedClient.name}</strong> (
              {selectedClient.age} yrs)
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Paramedic & Triage Support
          <br />
          Future: sync this with live alerts from Therapy / Medication Zones.
        </div>
      </div>

      <div className="two-column">
        {/* LEFT: Client + scene safety */}
        <div className="stack">
          <div className="card">
            <div className="card-title">Callout & client</div>
            <div className="card-subtitle">
              Select the client and describe why emergency support is involved.
            </div>

            <label className="block-label">
              Client
              <select
                className="input"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                {mockClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.age})
                  </option>
                ))}
              </select>
            </label>

            <label className="block-label">
              Callout type
              <select
                className="input"
                value={calloutType}
                onChange={(e) => setCalloutType(e.target.value)}
              >
                <option value="">Select…</option>
                <option value="mh-crisis">Mental health crisis</option>
                <option value="behavioural">Behavioural escalation</option>
                <option value="medication">Medication issue / overdose</option>
                <option value="falls">Fall / injury</option>
                <option value="medical">Medical deterioration</option>
                <option value="welfare">Welfare check</option>
              </select>
            </label>
          </div>

          <div className="card">
            <div className="card-title">Scene safety / hazards</div>
            <div className="card-subtitle">
              Record anything that might impact paramedic safety or require additional
              resources.
            </div>
            <textarea
              className="textarea"
              rows={4}
              value={sceneSafety}
              onChange={(e) => setSceneSafety(e.target.value)}
              placeholder="Weapons, aggressive behaviour, drugs/alcohol, unsafe environment, pets, multiple people on scene..."
            />
          </div>
        </div>

        {/* RIGHT: Vitals + SBAR */}
        <div className="stack">
          <div className="card">
            <div className="card-title">Vitals snapshot</div>
            <div className="card-subtitle">
              Basic observations to support triage. Use what is reasonable for your
              role; paramedics can extend this once on scene.
            </div>
            <div className="grid-2">
              {[
                { key: "bpSystolic", label: "BP systolic" },
                { key: "bpDiastolic", label: "BP diastolic" },
                { key: "hr", label: "Heart rate (bpm)" },
                { key: "rr", label: "Respiratory rate" },
                { key: "spo2", label: "SpO₂ (%)" },
                { key: "temp", label: "Temperature (°C)" },
              ].map((v) => (
                <label key={v.key} className="section-title-sm">
                  {v.label}
                  <input
                    className="input"
                    type="number"
                    value={vitals[v.key]}
                    onChange={(e) => updateVital(v.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">SBAR handover</div>
            <div className="card-subtitle">
              Situation, Background, Assessment, Recommendation — write it as if you are
              handing over directly to paramedics or ED.
            </div>
            <textarea
              className="textarea"
              rows={5}
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
              placeholder="S: Reason for callout...  B: Relevant history (e.g. autism, MS, dementia, diabetes)...  A: What you see now...  R: What you are asking paramedics / ED to do..."
            />

            <button className="btn-primary" onClick={handleSave}>
              💾 Save paramedic session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
