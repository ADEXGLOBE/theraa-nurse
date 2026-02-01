// src/components/Sidebar.jsx
import mockZones from "../data/mockZones";
import { useActiveClient } from "../context/ActiveClientContext";

export default function Sidebar({ selectedZone, setSelectedZone }) {
  const { clients, activeClientId, setActiveClientId, activeClient } =
    useActiveClient();

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-header">
          <div className="sidebar-logo">TN</div>
          <div>
            <div style={{ fontWeight: 700 }}>Theraa Nurse v1.0</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              Service delivery optimisation MVP
            </div>
            {activeClient ? (
              <div style={{ fontSize: 11, color: "#111827", marginTop: 6 }}>
                Active: <b>{activeClient.name}</b>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sidebar-zones">
          <div className="sidebar-zones-title">Zones</div>
          {mockZones.map((z) => (
            <button
              key={z.id}
              className={
                "sidebar-zone-button" + (selectedZone === z.id ? " active" : "")
              }
              onClick={() => setSelectedZone(z.id)}
            >
              <div>{z.label}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{z.subtitle}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="sidebar-clients-title">Clients</div>
        {(!clients || clients.length === 0) && (
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            No clients yet — add on Clients page.
          </div>
        )}

        {clients?.map((c) => (
          <button
            key={c.id}
            className="sidebar-client-card"
            style={{
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              border:
                c.id === activeClientId ? "1px solid #2563eb" : "1px solid #e5e7eb",
              background: c.id === activeClientId ? "#eff6ff" : "white",
            }}
            onClick={() => setActiveClientId(c.id)}
            title="Set as active client"
          >
            <div style={{ fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {c.age} yrs · {c.primaryZone || "—"}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
