import mockClients from "../data/mockClients";
import mockZones from "../data/mockZones";
import { loadClients } from "../data/clientsStore";

export default function Sidebar({ selectedZone, setSelectedZone }) {
  // Prefer real clients from clientsStore; fallback to mockClients
  const real = (() => {
    try {
      const c = loadClients();
      return c && c.length > 0 ? c : null;
    } catch {
      return null;
    }
  })();

  const clients = real || mockClients;

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-header">
          <div className="sidebar-logo">TN</div>
          <div>
            <div style={{ fontWeight: 700 }}>Theraa Nurse v1.0</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              Service delivery optimisation
            </div>
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
        <div className="sidebar-clients-title">Active clients</div>
        {clients.map((c) => (
          <div key={c.id} className="sidebar-client-card">
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {c.age} yrs · {c.primaryZone}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
