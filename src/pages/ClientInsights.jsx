import { useEffect, useMemo, useState } from "react";
import { loadClients } from "../data/clientsStore";
import { buildClientInsights } from "../features/insights/insightsService";
import { saveDraftFromInsights } from "../features/careplans/draftFromInsights";

function fmt(iso) {
  try {
    return iso ? new Date(iso).toLocaleString() : "—";
  } catch {
    return iso || "—";
  }
}

function RiskPill({ level }) {
  const map = { high: "#b91c1c", medium: "#f59e0b", low: "#065f46" };
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        background: map[level] || "#6b7280",
        color: "#fff",
        fontWeight: 700,
      }}
    >
      {String(level || "low").toUpperCase()}
    </span>
  );
}

export default function ClientInsights() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [lookbackDays, setLookbackDays] = useState(14);

  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const loaded = loadClients();
    setClients(loaded);
    if (loaded.length > 0) setSelectedClientId(loaded[0].id);
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  async function refresh() {
    if (!selectedClientId) return;
    setLoading(true);
    setErr("");
    try {
      const res = await buildClientInsights(selectedClientId, {
        lookbackDays,
      });
      setInsights(res);
    } catch (e) {
      console.error(e);
      setErr("Failed to build insights.");
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedClientId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId, lookbackDays]);

  if (!clients.length) {
    return (
      <div className="card">
        <div className="card-title">Client Insights</div>
        <div className="card-subtitle">No clients found.</div>
      </div>
    );
  }

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h2>Client Insights</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Evidence-based signals, gaps and actions
        </div>
      </div>

      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px", gap: 12 }}>
          <label>
            <div className="label">Client</div>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.age})
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="label">Lookback (days)</div>
            <input
              type="number"
              min={3}
              max={60}
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Number(e.target.value || 14))}
            />
          </label>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="primary" onClick={refresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        {err && <div style={{ color: "#b91c1c", marginTop: 8 }}>{err}</div>}
      </div>

      {insights && (
        <>
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div className="card-title">
                  {selectedClient.name}
                </div>
                <div className="card-subtitle">
                  Last evidence: {fmt(insights.lastEvidenceAt)} · Plan reviewed:{" "}
                  {insights.hasReviewedPlan ? "Yes" : "No"}
                </div>
              </div>
              <RiskPill level={insights.overallRisk} />
            </div>
          </div>

          <div className="two-column" style={{ marginTop: 12 }}>
            <div className="stack">
              <div className="card">
                <div className="card-title">Signals</div>
                {insights.signals.length === 0 ? (
                  <div className="muted">No signals detected.</div>
                ) : (
                  insights.signals.map((s) => (
                    <div key={s.id} className="doc-row">
                      <div>{s.label}</div>
                      <RiskPill level={s.level} />
                    </div>
                  ))
                )}
              </div>

              <div className="card">
                <div className="card-title">Gaps</div>
                {insights.gaps.length === 0 ? (
                  <div className="muted">No gaps detected.</div>
                ) : (
                  insights.gaps.map((g) => (
                    <div key={g.id} className="doc-row">
                      <div>{g.label}</div>
                      <RiskPill level={g.severity} />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="stack">
              <div className="card">
                <div className="card-title">Suggested Actions</div>
                <ol>
                  {insights.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>

                <button
                  className="primary"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    saveDraftFromInsights({
                      insights,
                      client: selectedClient,
                    });
                    alert("Draft care plan created. Review it in Care Plan.");
                  }}
                >
                  📝 Generate Draft Care Plan
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
