import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
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
  const styles = {
    high: "risk-high",
    medium: "risk-medium",
    low: "risk-low",
  };

  return (
    <span className={`risk-badge ${styles[level] || "risk-low"}`}>
      {String(level || "low").toUpperCase()}
    </span>
  );
}

function MetricCard({ title, value, subtitle, icon }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <div className="metric-value">{value}</div>
        <div className="metric-title">{title}</div>
        {subtitle ? <div className="metric-subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}

export default function HomeDashboard() {
  const { user } = useAuth();

  const [role, setRole] = useState("coordinator");
  const [clients, setClients] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  useEffect(() => {
    if (!user?.id) {
      setClients([]);
      setSelectedClientId("");
      return;
    }

    const loaded = loadClients(user.id);
    setClients(loaded);

    if (loaded.length > 0) {
      setSelectedClientId((current) =>
        loaded.some((c) => c.id === current) ? current : loaded[0].id
      );
    } else {
      setSelectedClientId("");
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function build() {
      const rows = await Promise.all(
        clients.map(async (c) => {
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

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const workerPlan = useMemo(() => {
    if (!selectedClient?.id) return null;
    const versions = loadCarePlanVersions(selectedClient.id);
    return versions.find((v) => v.status === "reviewed") || versions[0] || null;
  }, [selectedClient?.id]);

  const totalDocuments = summaries.reduce((sum, c) => sum + (c.docCount || 0), 0);
  const reviewedPlans = summaries.filter((c) => c.hasReviewedPlan).length;
  const highRisk = summaries.filter((c) => c.riskLevel === "high").length;

  const purposeScore =
    summaries.length === 0
      ? 0
      : Math.round(((reviewedPlans + Math.max(0, summaries.length - highRisk)) / (summaries.length * 2)) * 100);

  return (
    <div className="zone-page dashboard-page">
      <div className="hero-panel">
        <div>
          <div className="eyebrow">Theraa Nurse</div>
          <h1>Purpose-Centred Support Dashboard</h1>
          <p>
            Manage participants, monitor care-plan readiness, and guide daily
            support actions from one professional workspace.
          </p>
        </div>

        <div className="hero-user-card">
          <div className="avatar-circle">
            {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <div className="hero-user-label">Logged in as</div>
            <div className="hero-user-email">{user?.email || "Not logged in"}</div>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard
          icon="👥"
          title="Participants"
          value={clients.length}
          subtitle="Owned by this account"
        />
        <MetricCard
          icon="📄"
          title="Documents"
          value={totalDocuments}
          subtitle="Uploaded evidence"
        />
        <MetricCard
          icon="✅"
          title="Reviewed Plans"
          value={reviewedPlans}
          subtitle="Ready for support delivery"
        />
        <MetricCard
          icon="🌟"
          title="Purpose Score"
          value={`${purposeScore}%`}
          subtitle="Participation readiness"
        />
      </div>

      <div className="role-switch-card">
        <div>
          <div className="card-title">Choose working mode</div>
          <div className="card-subtitle">
            Coordinator mode gives a multi-participant overview. Worker mode gives a single-shift focus.
          </div>
        </div>

        <div className="role-buttons">
          <button
            type="button"
            className={role === "coordinator" ? "role-btn active" : "role-btn"}
            onClick={() => setRole("coordinator")}
          >
            Care Coordinator
          </button>

          <button
            type="button"
            className={role === "worker" ? "role-btn active" : "role-btn"}
            onClick={() => setRole("worker")}
          >
            Support Worker
          </button>
        </div>
      </div>

      {role === "coordinator" && (
        <div className="card premium-card">
          <div className="section-heading-row">
            <div>
              <div className="card-title">My participants today</div>
              <div className="card-subtitle">
                Review documentation readiness, risk level, and care-plan status.
              </div>
            </div>
          </div>

          {summaries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <div>No participants found for this account.</div>
              <small>Add participants in the Participants page.</small>
            </div>
          ) : (
            <div className="participant-list">
              {summaries.map((c) => (
                <div key={c.id} className="participant-row">
                  <div className="participant-avatar">
                    {c.name?.charAt(0)?.toUpperCase() || "P"}
                  </div>

                  <div className="participant-main">
                    <div className="participant-name">
                      {c.name} {c.age ? `(${c.age})` : ""}
                    </div>
                    <div className="participant-meta">
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

      {role === "worker" && (
        <div className="card premium-card">
          <div className="card-title">Today’s shift focus</div>
          <div className="card-subtitle">
            Select a participant and follow their latest support priorities.
          </div>

          {clients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div>No participants found for this account.</div>
              <small>Add a participant first.</small>
            </div>
          ) : (
            <>
              <label className="label">Participant</label>
              <select
                className="input"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.age ? `(${c.age})` : ""}
                  </option>
                ))}
              </select>

              {!workerPlan ? (
                <div className="notice-box">
                  No care plan available yet for this participant.
                </div>
              ) : (
                <div className="worker-focus-grid">
                  <div className="focus-box">
                    <h4>Shift Priorities</h4>
                    <ul>
                      <li>Follow latest care-plan priorities</li>
                      <li>Watch for risk triggers and mood changes</li>
                      <li>Document what happened, action taken, and outcome</li>
                    </ul>
                  </div>

                  <div className="focus-box">
                    <h4>Risks to Watch</h4>
                    <p>
                      {workerPlan.plan?.risks ||
                        workerPlan.plan?.sections?.risks ||
                        "No specific risks listed."}
                    </p>
                  </div>

                  <div className="focus-box full">
                    <h4>Before End of Shift</h4>
                    <p>
                      Document mood or behaviour changes, incidents, refusals,
                      engagement level, escalation triggers, supports provided,
                      and participant outcomes.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}