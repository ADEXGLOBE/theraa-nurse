// src/pages/MedicationZone.jsx
import { useEffect, useMemo, useState } from "react";
import { loadSessions, saveSessions } from "../data/sessionStore";
import { loadClients } from "../data/clientsStore";
import { useActiveClient } from "../context/ActiveClientContext";
import ClientSelectorBar from "../components/ClientSelectorBar";
import { useAuth } from "../context/AuthContext";

const INITIAL_MEDS = [
  { id: 1, name: "Sertraline 50mg mane", taken: false },
  { id: 2, name: "Metformin 500mg bd", taken: false },
  { id: 3, name: "Panadol 1g prn", taken: false },
];

export default function MedicationZone() {
  const { user } = useAuth();
  const { activeClientId } = useActiveClient();
  const clients = useMemo(() => loadClients(user?.id), [user?.id]);
  const fallbackId = clients[0]?.id || "";

  const [selectedClientId, setSelectedClientId] = useState(activeClientId || fallbackId);
  const [medications, setMedications] = useState(INITIAL_MEDS);
  const [followUp, setFollowUp] = useState(false);
  const [notes, setNotes] = useState("");
  const [allSessions, setAllSessions] = useState({});

  useEffect(() => {
    if (activeClientId) setSelectedClientId(activeClientId);
  }, [activeClientId]);

  useEffect(() => {
    setAllSessions(loadSessions(user?.id));
  }, [user?.id]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const toggleTaken = (id) => {
    setMedications((prev) => prev.map((m) => (m.id === id ? { ...m, taken: !m.taken } : m)));
  };

  const handleSaveMedicationSession = () => {
    if (!selectedClientId) return alert("Select a client first.");
    const timestamp = new Date().toISOString();

    const payload = {
      timestamp,
      clientId: selectedClientId,
      zone: "meds",
      medications,
      followUp,
      notes,
    };

    const updated = {
      ...allSessions,
      [selectedClientId]: [payload, ...(allSessions[selectedClientId] || [])],
    };

    setAllSessions(updated);
    saveSessions(updated, user?.id);
    alert("Medication check saved.");

    setMedications((prev) => prev.map((m) => ({ ...m, taken: false })));
    setFollowUp(false);
    setNotes("");
  };

  if (!clients.length) {
    return (
      <div className="card">
        <div className="card-title">Medication Zone</div>
        <div className="card-subtitle">No clients found. Add a client in Clients first.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Medication Zone</h1>
          <p className="page-subtitle">
            Quick medication overview. Support workers can record prompting/adherence. (No administration unless qualified.)
          </p>
          {selectedClient && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              Client: <strong>{selectedClient.name}</strong> ({selectedClient.age} yrs)
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Medication & Safety
        </div>
      </div>

      <ClientSelectorBar />

      <div className="card">
        <div className="card-title">Select client</div>
        <div className="card-subtitle">Choose who this medication check is for.</div>
        <label className="section-title-sm">
          Client
          <select className="input" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.age})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="two-column">
        <div className="card">
          <div className="card-title">Regular medications</div>
          <div className="card-subtitle">
            Tick what has been taken this shift/day. This is not a full chart; it supports patterns and handover.
          </div>

          <ul style={{ listStyle: "none", paddingLeft: 0, fontSize: 13 }}>
            {medications.map((m) => (
              <li
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                }}
              >
                <span>{m.name}</span>
                <label style={{ fontSize: 12, display: "flex", gap: 6 }}>
                  <input type="checkbox" checked={m.taken} onChange={() => toggleTaken(m.id)} />
                  Taken
                </label>
              </li>
            ))}
          </ul>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginTop: 8 }}>
            <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} />
            Flag medication issue for follow-up / prescriber review
          </label>
        </div>

        <div className="card">
          <div className="card-title">Medication notes</div>
          <div className="card-subtitle">Include side effects, refusals, missed doses, behaviour changes, concerns.</div>
          <textarea
            className="textarea"
            rows={7}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: refused morning dose; will retry after breakfast; dizziness noted; GP review booked..."
          />

          <button type="button" className="btn-primary" onClick={handleSaveMedicationSession}>
            💾 Save medication check
          </button>
        </div>
      </div>
    </div>
  );
}
