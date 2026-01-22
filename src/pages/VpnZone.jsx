import { useState } from "react";
import { loadSessions, saveSessions } from "../data/sessionStore";
import mockClients from "../data/mockClients";

export default function VpnZone() {
  const [selectedClientId, setSelectedClientId] = useState(mockClients[0].id);
  const [remoteType, setRemoteType] = useState("");
  const [participants, setParticipants] = useState("");
  const [summary, setSummary] = useState("");

  const selectedClient = mockClients.find((c) => c.id === selectedClientId);

  const handleSaveRemote = () => {
    const all = loadSessions();
    const timestamp = new Date().toISOString();

    const payload = {
      timestamp,
      clientId: selectedClientId,
      zone: "vpn",
      remoteType,
      participants,
      summary,
    };

    const updated = {
      ...all,
      [selectedClientId]: [
        payload,
        ...(all[selectedClientId] || []),
      ],
    };

    saveSessions(updated);
    alert("Remote session logged.");
    setRemoteType("");
    setParticipants("");
    setSummary("");
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">VPN / Remote Zone</h1>
          <p className="page-subtitle">
            Conceptual view of your remote access idea — family, telehealth and
            paramedics can all have visibility over recent sessions for safer care.
          </p>
          {selectedClient && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              Client: <strong>{selectedClient.name}</strong> (
              {selectedClient.age} yrs)
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Remote & Family Portal
          <br />
          Linked concept: VPN / remote segment in Packet Tracer.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Log a remote interaction</div>
        <div className="card-subtitle">
          This could be a family video call, telehealth appointment or external care
          coordination.
        </div>

        <label className="section-title-sm">
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

        <label className="section-title-sm">
          Remote session type
          <select
            className="input"
            value={remoteType}
            onChange={(e) => setRemoteType(e.target.value)}
          >
            <option value="">Select…</option>
            <option value="familyCall">Family / friend video call</option>
            <option value="telehealth">Telehealth with GP / specialist</option>
            <option value="caseMeeting">Case conference / care meeting</option>
          </select>
        </label>

        <label className="section-title-sm">
          Who joined?
          <input
            className="input"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="Example: Daughter on Zoom, GP, OT, support worker..."
          />
        </label>

        <label className="section-title-sm">
          Summary
          <textarea
            className="textarea"
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Key outcomes, follow-up actions, changes to support plan..."
          />
        </label>

        <button
          type="button"
          className="btn-primary"
          onClick={handleSaveRemote}
        >
          💾 Save remote interaction
        </button>
      </div>
    </div>
  );
}
