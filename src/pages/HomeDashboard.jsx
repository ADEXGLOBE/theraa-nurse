// src/pages/HomeDashboard.jsx
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useActiveClient } from "../context/ActiveClientContext";

import { listDocumentsForClient } from "../features/documents/documentService";
import { loadCarePlanVersions } from "../data/carePlanStore";

function daysAgo(iso) {
  if (!iso) return null;

  try {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return Math.max(
      0,
      Math.floor(
        (Date.now() - date.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
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
    <span
      className={`risk-badge ${
        styles[level] || "risk-low"
      }`}
    >
      {String(level || "low").toUpperCase()}
    </span>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>

      <div>
        <div className="metric-value">{value}</div>
        <div className="metric-title">{title}</div>

        {subtitle ? (
          <div className="metric-subtitle">
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WorkspaceIdentityCard({
  email,
  displayName,
  roleLabel,
  organisationName,
}) {
  const initial =
    displayName?.charAt(0)?.toUpperCase() ||
    email?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <div className="dashboard-account-card">
      <div className="dashboard-account-avatar">
        {initial}
      </div>

      <div className="dashboard-account-details">
        <span className="dashboard-account-label">
          Logged in as
        </span>

        <strong className="dashboard-account-email">
          {email || "Unknown user"}
        </strong>

        <div className="dashboard-account-role">
          {roleLabel || "Workspace Member"}
        </div>

        <small className="dashboard-account-workspace">
          {organisationName ||
            "No provider workspace loaded"}
        </small>
      </div>
    </div>
  );
}

export default function HomeDashboard() {
  const { user, userDisplayName } = useAuth();

  const {
    organisationId,
    organisationName,
    role: workspaceRole,
    roleLabel,
  } = useWorkspace();

  const {
    clients,
    activeClientId,
    setActiveClientId,
    clientsReady,
    clientsError,
  } = useActiveClient();

  /*
   * workingMode controls how the dashboard is presented.
   * It is NOT the signed-in user's Supabase role.
   */
  const [workingMode, setWorkingMode] =
    useState("coordinator");

  const [summaries, setSummaries] = useState([]);
  const [summaryLoading, setSummaryLoading] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function buildSummaries() {
      if (!clients.length) {
        setSummaries([]);
        return;
      }

      setSummaryLoading(true);

      try {
        const rows = await Promise.all(
          clients.map(async (client) => {
            /*
             * Documents and plans still use the current
             * local stores during the migration phase.
             * ownerId is retained so existing prototype
             * records continue to load.
             */
            const docs =
              await listDocumentsForClient(
                client.id,
                user?.id
              );

            const versions =
              loadCarePlanVersions(
                client.id,
                user?.id
              ) || [];

            const latest = versions[0] || null;
            const hasReviewedPlan =
              latest?.status === "reviewed";

            const lastDocAt =
              docs?.[0]?.createdAt || null;

            const docCount = docs?.length || 0;

            let riskLevel = "low";

            if (!hasReviewedPlan) {
              riskLevel = "high";
            } else if (
              lastDocAt &&
              daysAgo(lastDocAt) <= 1
            ) {
              riskLevel = "medium";
            }

            return {
              ...client,
              docCount,
              lastDocAt,
              hasReviewedPlan,
              riskLevel,
            };
          })
        );

        if (!cancelled) {
          setSummaries(rows);
        }
      } catch (error) {
        console.error(
          "Unable to build dashboard summaries:",
          error
        );

        if (!cancelled) {
          setSummaries(
            clients.map((client) => ({
              ...client,
              docCount: 0,
              lastDocAt: null,
              hasReviewedPlan: false,
              riskLevel: "high",
            }))
          );
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    }

    void buildSummaries();

    return () => {
      cancelled = true;
    };
  }, [clients, user?.id]);

  const selectedClient = useMemo(
    () =>
      clients.find(
        (client) =>
          client.id === activeClientId
      ) || null,
    [clients, activeClientId]
  );

  const workerPlan = useMemo(() => {
    if (!selectedClient?.id) {
      return null;
    }

    const versions =
      loadCarePlanVersions(
        selectedClient.id,
        user?.id
      ) || [];

    return (
      versions.find(
        (version) =>
          version.status === "reviewed"
      ) ||
      versions[0] ||
      null
    );
  }, [selectedClient?.id, user?.id]);

  const totalDocuments = summaries.reduce(
    (sum, client) =>
      sum + (client.docCount || 0),
    0
  );

  const reviewedPlans = summaries.filter(
    (client) => client.hasReviewedPlan
  ).length;

  const highRisk = summaries.filter(
    (client) =>
      client.riskLevel === "high"
  ).length;

  const purposeScore =
    summaries.length === 0
      ? 0
      : Math.round(
          ((reviewedPlans +
            Math.max(
              0,
              summaries.length - highRisk
            )) /
            (summaries.length * 2)) *
            100
        );

  return (
    <div className="zone-page dashboard-page">
      <div className="hero-panel">
        <div>
          <div className="eyebrow">
            Theraa Nurse
          </div>

          <h1>
            Purpose-Centred Support Dashboard
          </h1>

          <p>
            Manage participants, monitor care-plan
            readiness, and guide daily support actions
            from one professional workspace.
          </p>
        </div>

        <WorkspaceIdentityCard
          email={user?.email}
          displayName={userDisplayName}
          roleLabel={roleLabel}
          organisationName={organisationName}
        />
      </div>

      <div className="workspace-identity-strip">
        <div>
          <span>Provider workspace</span>
          <strong>
            {organisationName ||
              "No workspace loaded"}
          </strong>
        </div>

        <div>
          <span>Signed-in role</span>
          <strong>
            {roleLabel || "Workspace Member"}
          </strong>
        </div>

        <div>
          <span>Workspace access</span>
          <strong>
            {organisationId
              ? "Connected"
              : "Not connected"}
          </strong>
        </div>

        <div>
          <span>Participant access</span>
          <strong>
            {clients.length} authorised
          </strong>
        </div>
      </div>

      {clientsError ? (
        <div className="dashboard-access-error">
          <strong>
            Participant access could not be loaded
          </strong>

          <span>{clientsError}</span>
        </div>
      ) : null}

      <div className="metric-grid">
        <MetricCard
          icon="👥"
          title="Participants"
          value={clients.length}
          subtitle="Authorised in this workspace"
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
          <div className="card-title">
            Choose dashboard view
          </div>

          <div className="card-subtitle">
            Your signed-in database role is{" "}
            <strong>
              {roleLabel || workspaceRole}
            </strong>
            . These buttons only change how this
            dashboard is displayed.
          </div>
        </div>

        <div className="role-buttons">
          <button
            type="button"
            className={
              workingMode === "coordinator"
                ? "role-btn active"
                : "role-btn"
            }
            onClick={() =>
              setWorkingMode("coordinator")
            }
          >
            Coordinator View
          </button>

          <button
            type="button"
            className={
              workingMode === "worker"
                ? "role-btn active"
                : "role-btn"
            }
            onClick={() =>
              setWorkingMode("worker")
            }
          >
            Worker View
          </button>
        </div>
      </div>

      {workingMode === "coordinator" ? (
        <div className="card premium-card">
          <div className="section-heading-row">
            <div>
              <div className="card-title">
                My participants today
              </div>

              <div className="card-subtitle">
                Review documentation readiness, risk
                level, and care-plan status.
              </div>
            </div>

            {summaryLoading ? (
              <span className="dashboard-loading-label">
                Refreshing…
              </span>
            ) : null}
          </div>

          {!clientsReady ? (
            <div className="empty-state">
              <div className="empty-icon">
                ⏳
              </div>

              <div>
                Loading authorised participants…
              </div>
            </div>
          ) : summaries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                👥
              </div>

              <div>
                No shared participants are currently
                available.
              </div>

              <small>
                A Provider Admin or coordinator must
                create or assign a participant in this
                workspace.
              </small>
            </div>
          ) : (
            <div className="participant-list">
              {summaries.map((client) => (
                <button
                  type="button"
                  key={client.id}
                  className={
                    activeClientId === client.id
                      ? "participant-row participant-row-active"
                      : "participant-row"
                  }
                  onClick={() =>
                    setActiveClientId(client.id)
                  }
                >
                  <div className="participant-avatar">
                    {client.name
                      ?.charAt(0)
                      ?.toUpperCase() || "P"}
                  </div>

                  <div className="participant-main">
                    <div className="participant-name">
                      {client.name}{" "}
                      {client.age
                        ? `(${client.age})`
                        : ""}
                    </div>

                    <div className="participant-meta">
                      Docs: {client.docCount} ·{" "}
                      {client.lastDocAt
                        ? `Last update ${daysAgo(
                            client.lastDocAt
                          )}d ago`
                        : "No documents"}{" "}
                      · Plan:{" "}
                      {client.hasReviewedPlan
                        ? "Reviewed"
                        : "Needs review"}
                    </div>

                    {client.permissionLevel ? (
                      <div className="participant-permission">
                        Access:{" "}
                        {client.permissionLevel}
                      </div>
                    ) : null}
                  </div>

                  <RiskBadge
                    level={client.riskLevel}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {workingMode === "worker" ? (
        <div className="card premium-card">
          <div className="card-title">
            Today’s shift focus
          </div>

          <div className="card-subtitle">
            Select an authorised participant and
            follow their latest support priorities.
          </div>

          {!clientsReady ? (
            <div className="empty-state">
              <div className="empty-icon">
                ⏳
              </div>

              <div>
                Loading authorised participants…
              </div>
            </div>
          ) : clients.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                📋
              </div>

              <div>
                No participants are assigned to this
                account.
              </div>

              <small>
                Ask a coordinator or Provider Admin to
                assign participant access.
              </small>
            </div>
          ) : (
            <>
              <label className="label">
                Participant
              </label>

              <select
                className="input"
                value={activeClientId}
                onChange={(event) =>
                  setActiveClientId(
                    event.target.value
                  )
                }
              >
                {clients.map((client) => (
                  <option
                    key={client.id}
                    value={client.id}
                  >
                    {client.name}{" "}
                    {client.age
                      ? `(${client.age})`
                      : ""}
                  </option>
                ))}
              </select>

              {selectedClient ? (
                <div className="worker-identity-row">
                  <span>
                    Current participant
                  </span>

                  <strong>
                    {selectedClient.name}
                  </strong>

                  {selectedClient.permissionLevel ? (
                    <small>
                      Permission:{" "}
                      {
                        selectedClient.permissionLevel
                      }
                    </small>
                  ) : null}
                </div>
              ) : null}

              {!workerPlan ? (
                <div className="notice-box">
                  No saved care plan is currently
                  available for this participant.
                </div>
              ) : (
                <div className="worker-focus-grid">
                  <div className="focus-box">
                    <h4>Shift Priorities</h4>

                    <ul>
                      <li>
                        Follow the latest approved
                        care-plan priorities.
                      </li>

                      <li>
                        Watch for risk triggers and
                        changes in presentation.
                      </li>

                      <li>
                        Record what happened, support
                        provided and the outcome.
                      </li>
                    </ul>
                  </div>

                  <div className="focus-box">
                    <h4>Risks to Watch</h4>

                    <p>
                      {workerPlan.plan?.risks ||
                        workerPlan.plan?.sections
                          ?.risks ||
                        "No specific risks listed."}
                    </p>
                  </div>

                  <div className="focus-box full">
                    <h4>Before End of Shift</h4>

                    <p>
                      Document mood or behaviour
                      changes, incidents, refusals,
                      engagement, escalation triggers,
                      supports provided and participant
                      outcomes.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}