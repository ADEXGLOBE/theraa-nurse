// src/pages/ParamedicZone.jsx
import { useEffect, useMemo, useState } from "react";
import { loadSessions, saveSessions } from "../data/sessionStore";
import { loadClients } from "../data/clientsStore";
import { useActiveClient } from "../context/ActiveClientContext";
import ClientSelectorBar from "../components/ClientSelectorBar";

export default function ParamedicZone() {
  const { activeClientId } = useActiveClient();
  const clients = useMemo(() => loadClients(), []);
  const fallbackId = clients[0]?.id || "";

  const [selectedClientId, setSelectedClientId] = useState(activeClientId || fallbackId);
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

  useEffect(() => {
    if (activeClientId) setSelectedClientId(activeClientId);
  }, [activeClientId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const updateVital = (key, value) => setVitals((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!selectedClientId) return alert("Select a client first.");
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

  if (!clients.length) {
    return (
      <div className="card">
        <div className="card-title">Paramedic View</div>
        <div className="card-subtitle">No clients found. Add a client in Clients first.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramedic View</h1>
          <p className="page-subtitle">
            Capture callout type, scene safety, vitals and SBAR handover in one place.
          </p>
          {selectedClient && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              Client: <strong>{selectedClient.name}</strong> ({selectedClient.age} yrs)
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Paramedic & Triage Support
        </div>
      </div>

      <ClientSelectorBar />

      <div className="two-column">
        <div className="stack">
          <div className="card">
            <div className="card-title">Callout & client</div>
            <div className="card-subtitle">Select the client and reason emergency support is involved.</div>

            <label className="block-label">
              Client
              <select className="input" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.age})
                  </option>
                ))}
              </select>
            </label>

            <label className="block-label">
              Callout type
              <select className="input" value={calloutType} onChange={(e) => setCalloutType(e.target.value)}>
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
            <div className="card-subtitle">Record hazards that impact paramedic safety or require extra resources.</div>
            <textarea
              className="textarea"
              rows={4}
              value={sceneSafety}
              onChange={(e) => setSceneSafety(e.target.value)}
              placeholder="Aggressive behaviour, unsafe environment, drugs/alcohol, pets, etc..."
            />
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title">Vitals snapshot</div>
            <div className="card-subtitle">Use what is reasonable for your role.</div>
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
            <div className="card-subtitle">Situation, Background, Assessment, Recommendation.</div>
            <textarea
              className="textarea"
              rows={5}
              value={handover}
              onChange={(e) => setHandover(e.target.value)}
              placeholder="S: ... B: ... A: ... R: ..."
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
