import { useEffect, useState } from "react";
import { loadClients } from "../data/clientsStore";
import { listDocumentsForClient } from "../features/documents/documentService";
import { loadCarePlanVersions } from "../data/carePlanStore";

function daysAgo(iso) {
  try {
    const d = new Date(iso);
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

function RiskBadge({ level }) {
  const map = { high: "#b91c1c", medium: "#f59e0b", low: "#065f46" };
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        background: map[level] || "#6b7280",
        color: "#fff",
        fontWeight: 600,
      }}
    >
      {String(level || "low").toUpperCase()}
    </span>
  );
}

export default function HomeDashboard() {
  const [role, setRole] = useState("coordinator"); // coordinator | worker
  const [clients, setClients] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  // Load clients
  useEffect(() => {
    const loaded = loadClients();
    setClients(loaded);
    if (loaded.length > 0) setSelectedClientId(loaded[0].id);
  }, []);

  // Build multi-client summaries (async)
  useEffect(() => {
    let cancelled = false;

    async function build() {
      const rows = await Promise.all(
        (clients || []).map(async (c) => {
          const docs = await listDocumentsForClient(c.id);
          const versions = loadCarePlanVersions(c.id);
          const latest = versions[0] || null;

          const hasReviewedPlan = latest?.status === "reviewed";
          const lastDocAt = docs?.[0]?.createdAt || null;
          const docCount = docs?.length || 0;

          let riskLevel = "low";
          if (!hasReviewedPlan) riskLevel = "high";
          else if (lastDocAt && daysAgo(lastDocAt) <= 1) riskLevel = "medium";

          return {
            ...c,
            docCount,
            lastDocAt,
            hasReviewedPlan,
            riskLevel,
          };
        })
      );

      if (!cancelled) setSummaries(rows);
    }

    if (clients.length > 0) build();
    else setSummaries([]);

    return () => {
      cancelled = true;
    };
  }, [clients]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  const workerPlan = selectedClient
    ? loadCarePlanVersions(selectedClient.id).find((v) => v.status === "reviewed") ||
      loadCarePlanVersions(selectedClient.id)[0] ||
      null
    : null;

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h2 style={{ margin: 0 }}>Home Dashboard</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Role-aware daily optimisation overview
        </div>
      </div>

      {/* Role toggle */}
      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className={role === "coordinator" ? "pill pill-active" : "pill"}
            onClick={() => setRole("coordinator")}
          >
            Care Coordinator
          </button>
          <button
            className={role === "worker" ? "pill pill-active" : "pill"}
            onClick={() => setRole("worker")}
          >
            Support Worker
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          Coordinator = multi-client overview. Worker = single-client shift focus.
        </div>
      </div>

      {/* Coordinator View */}
      {role === "coordinator" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">My clients today</div>
          {summaries.length === 0 ? (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              No clients found. Add clients in the Clients page.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {summaries.map((c) => (
                <div key={c.id} className="doc-row" style={{ alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {c.name} ({c.age})
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Docs: {c.docCount} ·{" "}
                      {c.lastDocAt ? `Last update ${daysAgo(c.lastDocAt)}d ago` : "No documents"} ·{" "}
                      Plan: {c.hasReviewedPlan ? "Reviewed" : "Needs review"}
                    </div>
                  </div>
                  <RiskBadge level={c.riskLevel} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Worker View */}
      {role === "worker" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">Today’s shift focus</div>

          <label className="label">Client</label>
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.age})
              </option>
            ))}
          </select>

          {!workerPlan ? (
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              No care plan available yet for this client.
            </div>
          ) : (
            <>
              <ul style={{ marginTop: 10 }}>
                <li>Follow the latest care plan priorities</li>
                <li>Watch for risk triggers and mood changes</li>
                <li>Document clearly (what happened + what you did + outcome)</li>
              </ul>

              <div style={{ marginTop: 10 }}>
                <b>Risks to watch:</b>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
                  {workerPlan.plan?.risks || "No specific risks listed."}
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                <b>Before end of shift, document:</b>
                <div>
                  Mood/behaviour changes, incidents, refusals, engagement level, escalation triggers, supports provided.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
