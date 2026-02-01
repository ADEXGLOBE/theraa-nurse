// src/components/ClientSelectorBar.jsx
import { useActiveClient } from "../context/ActiveClientContext";

export default function ClientSelectorBar({ right = null }) {
  const { clients, activeClientId, setActiveClientId, activeClient } =
    useActiveClient();

  if (!clients || clients.length === 0) {
    return (
      <div className="card">
        <div className="card-title">No clients</div>
        <div className="card-subtitle">
          Go to Clients and add your first client.
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ minWidth: 240 }}>
        <div className="label">Active client</div>
        <select
          value={activeClientId}
          onChange={(e) => setActiveClientId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.age})
            </option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Current: <b>{activeClient?.name || "—"}</b>
      </div>

      <div style={{ marginLeft: "auto" }}>{right}</div>
    </div>
  );
}
