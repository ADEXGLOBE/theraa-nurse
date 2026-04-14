// src/pages/VpnZone.jsx
import { useEffect, useMemo, useState } from "react";
import { loadSessions, saveSessions } from "../data/sessionStore";
import { loadClients } from "../data/clientsStore";
import { useActiveClient } from "../context/ActiveClientContext";
import ClientSelectorBar from "../components/ClientSelectorBar";
import { useAuth } from "../context/AuthContext";

export default function VpnZone() {
  const { user } = useAuth();
  const { activeClientId } = useActiveClient();
  const clients = useMemo(() => loadClients(user?.id), [user?.id]);
  const fallbackId = clients[0]?.id || "";

  const [selectedClientId, setSelectedClientId] = useState(activeClientId || fallbackId);
  const [remoteType, setRemoteType] = useState("");
  const [participants, setParticipants] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (activeClientId) setSelectedClientId(activeClientId);
  }, [activeClientId]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const handleSaveRemote = () => {
    if (!selectedClientId) return alert("Select a client first.");
    const all = loadSessions(user?.id);
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
      [selectedClientId]: [payload, ...(all[selectedClientId] || [])],
    };

    saveSessions(updated, user?.id);
    alert("Remote session logged.");
    setRemoteType("");
    setParticipants("");
    setSummary("");
  };

  if (!clients.length) {
    return (
      <div className="card">
        <div className="card-title">VPN / Remote Zone</div>
        <div className="card-subtitle">No clients found. Add a client in Clients first.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">VPN / Remote Zone</h1>
          <p className="page-subtitle">
            Log family calls, telehealth, case conferences — builds safer continuity of care.
          </p>
          {selectedClient && (
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>
              Client: <strong>{selectedClient.name}</strong> ({selectedClient.age} yrs)
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Remote & Family Portal
        </div>
      </div>

      <ClientSelectorBar />

      <div className="card">
        <div className="card-title">Log a remote interaction</div>
        <div className="card-subtitle">Family call, telehealth, or care coordination session.</div>

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

        <label className="section-title-sm">
          Remote session type
          <select className="input" value={remoteType} onChange={(e) => setRemoteType(e.target.value)}>
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
            placeholder="Example: daughter on Zoom, GP, OT, SW..."
          />
        </label>

        <label className="section-title-sm">
          Summary
          <textarea
            className="textarea"
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Outcomes, follow-ups, changes to support plan..."
          />
        </label>

        <button type="button" className="btn-primary" onClick={handleSaveRemote}>
          💾 Save remote interaction
        </button>
      </div>
    </div>
  );
}
