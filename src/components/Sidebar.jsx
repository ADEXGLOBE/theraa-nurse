// src/components/Sidebar.jsx
import { useAuth } from "../context/AuthContext";

const navItems = [
  { key: "home", label: "Home" },
  { key: "clients", label: "Clients" },
  { key: "documents", label: "Documents" },
  { key: "insights", label: "Insights" },
  { key: "careplan", label: "Care Plan" },
  { key: "therapy", label: "Therapy" },
  { key: "meds", label: "Medication" },
  { key: "staff", label: "Staff / AI" },
  { key: "vpn", label: "Remote / VPN" },
  { key: "paramedic", label: "Paramedic" },
];

export default function Sidebar({ selectedZone, setSelectedZone }) {
  const { user, signOut } = useAuth();

  return (
    <aside
      style={{
        width: 260,
        minHeight: "100vh",
        borderRight: "1px solid #e5e7eb",
        background: "#ffffff",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
          Theraa Nurse
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          Logged in as
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
          {user?.email || "Unknown user"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {navItems.map((item) => {
          const active = selectedZone === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setSelectedZone(item.key)}
              style={{
                textAlign: "left",
                border: "1px solid #e5e7eb",
                background: active ? "#0f172a" : "#f8fafc",
                color: active ? "#ffffff" : "#334155",
                borderRadius: 12,
                padding: "10px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <button
          onClick={signOut}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 12,
            padding: "10px 12px",
            background: "#b91c1c",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}