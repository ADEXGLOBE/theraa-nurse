// src/pages/ClientInsights.jsx
import { useEffect, useMemo, useState } from "react";
import { loadClients } from "../data/clientsStore";
import { loadSessions } from "../data/sessionStore";
import { loadCarePlanVersions } from "../data/carePlanStore";
import { buildClientDocumentIntelligence } from "../features/documents/documentService";
import {
  generateMonthlyNdisReport,
  downloadMonthlySummary,
} from "../features/reports/reportGenerator";
import { useAuth } from "../context/AuthContext";

function safe(value) {
  return value == null ? "" : String(value);
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clamp(value, min = 0, max = 100) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
}

function currentMonthKey() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function daysAgo(isoDate) {
  if (!isoDate) return null;

  const date = new Date(isoDate);

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
}

function countWords(value) {
  return safe(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getSessionDate(session) {
  return (
    session?.createdAt ||
    session?.date ||
    session?.sessionDate ||
    session?.timestamp ||
    null
  );
}

function getSessionMood(session) {
  return (
    session?.mood ||
    session?.engagement ||
    session?.moodLevel ||
    session?.status ||
    "Not recorded"
  );
}

function getSessionZone(session) {
  return (
    session?.zone ||
    session?.type ||
    session?.category ||
    session?.serviceType ||
    "General"
  );
}

function groupCounts(items, getLabel) {
  const map = new Map();

  items.forEach((item) => {
    const label = safe(getLabel(item)).trim() || "Not recorded";
    map.set(label, (map.get(label) || 0) + 1);
  });

  return [...map.entries()]
    .map(([label, value]) => ({
      label,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

function getRiskLevel(plan) {
  const text = [
    plan?.sections?.risks,
    plan?.risks,
    plan?.sections?.riskControls,
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    text.includes("high risk") ||
    text.includes("immediate") ||
    text.includes("critical") ||
    text.includes("emergency")
  ) {
    return "high";
  }

  if (
    text.includes("medium risk") ||
    text.includes("moderate") ||
    text.includes("monitor") ||
    text.includes("warning")
  ) {
    return "medium";
  }

  return text.trim() ? "low" : "unknown";
}

function getAiData(plan) {
  return (
    plan?.aiEnhancement ||
    plan?.knowledgeEngine ||
    plan?.structuredEnhancement ||
    plan?.ai ||
    {}
  );
}

function getConfidence(plan) {
  const aiData = getAiData(plan);

  return (
    aiData?.confidence ||
    plan?.confidence ||
    plan?.aiConfidence ||
    {}
  );
}

function getMissingEvidence(plan) {
  const aiData = getAiData(plan);

  return asArray(
    aiData?.missingEvidence ||
      plan?.missingEvidence ||
      plan?.aiMissingEvidence
  );
}

function getEvidenceUsed(plan) {
  const aiData = getAiData(plan);

  return asArray(
    aiData?.evidenceUsed ||
      plan?.evidenceUsed ||
      plan?.aiEvidenceUsed
  );
}

function getEscalations(plan) {
  const aiData = getAiData(plan);

  return asArray(
    aiData?.escalationReferrals ||
      aiData?.escalations ||
      plan?.escalationReferrals
  );
}

function calculateSectionCompleteness(plan) {
  const sections = plan?.sections || {};

  const values = [
    sections.participantDetails,
    sections.goalsShort,
    sections.goalsLong,
    sections.strengths,
    sections.functionalNeeds,
    sections.healthClinical,
    sections.risks,
    sections.behaviourSupport,
    sections.routinesAndPreferences,
    sections.communication,
    sections.safeguardsConsent,
    sections.monitoringReview,
    sections.legalEthical,
  ];

  const completed = values.filter(
    (value) => safe(value).trim().length >= 10
  ).length;

  return Math.round((completed / values.length) * 100);
}

function calculatePurposeReadiness(plan) {
  const purposeCards = asArray(
    plan?.runningSource?.purposeCards
  );

  const approvedActions =
    asArray(plan?.approvals?.approvedWorker).length +
    asArray(plan?.approvals?.approvedClient).length;

  const hasGoals =
    safe(plan?.sections?.goalsShort).trim() ||
    safe(plan?.sections?.goalsLong).trim();

  let score = 20;

  if (hasGoals) score += 20;
  score += Math.min(30, purposeCards.length * 10);
  score += Math.min(20, approvedActions * 5);

  if (
    safe(plan?.sections?.monitoringReview).trim()
  ) {
    score += 10;
  }

  return clamp(score);
}

function calculateEvidenceStrength({
  documentCount,
  sessionCount,
  evidenceUsedCount,
}) {
  let score = 0;

  score += Math.min(45, documentCount * 12);
  score += Math.min(30, sessionCount * 5);
  score += Math.min(25, evidenceUsedCount * 5);

  return clamp(score);
}

function Card({
  title,
  subtitle,
  children,
  right,
  className = "",
}) {
  return (
    <section
      className={`card insights-v2-card ${className}`}
    >
      <div className="insights-card-heading">
        <div>
          <div className="card-title">{title}</div>

          {subtitle ? (
            <div className="card-subtitle">
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? (
          <div className="insights-card-right">
            {right}
          </div>
        ) : null}
      </div>

      <div className="insights-card-body">
        {children}
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  progress,
  status = "neutral",
}) {
  return (
    <article
      className={`insights-metric-card insights-status-${status}`}
    >
      <div className="insights-metric-top">
        <div className="insights-metric-icon">
          {icon}
        </div>

        <div className="insights-metric-status-dot" />
      </div>

      <div className="insights-metric-value">
        {value}
      </div>

      <div className="insights-metric-label">
        {label}
      </div>

      {detail ? (
        <div className="insights-metric-detail">
          {detail}
        </div>
      ) : null}

      {typeof progress === "number" ? (
        <div className="insights-progress-track">
          <div
            className="insights-progress-value"
            style={{
              width: `${clamp(progress)}%`,
            }}
          />
        </div>
      ) : null}
    </article>
  );
}

function StatusBadge({ level = "neutral", children }) {
  return (
    <span
      className={`insights-status-badge insights-status-badge-${level}`}
    >
      {children}
    </span>
  );
}

function ProgressRow({
  label,
  value,
  detail,
  level = "neutral",
}) {
  return (
    <div className="insights-progress-row">
      <div className="insights-progress-row-heading">
        <div>
          <strong>{label}</strong>

          {detail ? <small>{detail}</small> : null}
        </div>

        <span>{clamp(value)}%</span>
      </div>

      <div className="insights-progress-track">
        <div
          className={`insights-progress-value insights-progress-${level}`}
          style={{
            width: `${clamp(value)}%`,
          }}
        />
      </div>
    </div>
  );
}

function BarList({ title, data = [] }) {
  const max = Math.max(
    ...data.map((item) => Number(item.value) || 0),
    1
  );

  return (
    <div className="insights-bar-block">
      <div className="insights-bar-title">
        {title}
      </div>

      {data.length === 0 ? (
        <div className="insights-muted">
          No data recorded yet.
        </div>
      ) : (
        <div className="insights-bar-list">
          {data.slice(0, 6).map((row) => (
            <div
              key={`${title}-${row.label}`}
              className="insights-bar-row"
            >
              <div className="insights-bar-meta">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>

              <div className="insights-bar-track">
                <div
                  className="insights-bar-value"
                  style={{
                    width: `${
                      (Number(row.value) / max) * 100
                    }%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon = "📊",
  title,
  description,
}) {
  return (
    <div className="insights-empty">
      <div className="insights-empty-icon">
        {icon}
      </div>

      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export default function ClientInsights() {
  const { user } = useAuth();

  const clients = useMemo(
    () => loadClients(user?.id),
    [user?.id]
  );

  const [selectedClientId, setSelectedClientId] =
    useState("");

  const [
    documentIntelligence,
    setDocumentIntelligence,
  ] = useState(null);

  const [isLoadingEvidence, setIsLoadingEvidence] =
    useState(false);

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }

    if (clients.length === 0) {
      setSelectedClientId("");
    }
  }, [clients, selectedClientId]);

  const client = useMemo(
    () =>
      clients.find(
        (item) => item.id === selectedClientId
      ) || null,
    [clients, selectedClientId]
  );

  const sessionsMap = useMemo(
    () => loadSessions(user?.id) || {},
    [user?.id]
  );

  const sessions = useMemo(
    () =>
      selectedClientId
        ? sessionsMap?.[selectedClientId] || []
        : [],
    [sessionsMap, selectedClientId]
  );

  const versions = useMemo(() => {
    if (!selectedClientId) return [];

    return (
      loadCarePlanVersions(
        selectedClientId,
        user?.id
      ) || []
    );
  }, [selectedClientId, user?.id]);

  const latestVersion = versions[0] || null;
  const plan = latestVersion?.plan || {};
  const sections = plan?.sections || {};

  useEffect(() => {
    let mounted = true;

    async function loadEvidence() {
      if (!selectedClientId) {
        setDocumentIntelligence(null);
        return;
      }

      setIsLoadingEvidence(true);

      try {
        const data =
          await buildClientDocumentIntelligence(
            selectedClientId,
            user?.id
          );

        if (mounted) {
          setDocumentIntelligence(data);
        }
      } catch (error) {
        console.error(
          "Unable to load document intelligence:",
          error
        );

        if (mounted) {
          setDocumentIntelligence(null);
        }
      } finally {
        if (mounted) {
          setIsLoadingEvidence(false);
        }
      }
    }

    void loadEvidence();

    return () => {
      mounted = false;
    };
  }, [selectedClientId, user?.id]);

  if (!client) {
    return (
      <div className="zone-page">
        <EmptyState
          icon="👥"
          title="No participant available"
          description="Add a participant before opening Insights."
        />
      </div>
    );
  }

  const report = generateMonthlyNdisReport({
    client,
    month: currentMonthKey(),
    sessions,
    carePlanVersion: latestVersion,
    documentCount:
      documentIntelligence?.documentCount || 0,
  });

  const purposeCards = asArray(
    plan?.runningSource?.purposeCards
  );

  const confidence = getConfidence(plan);
  const missingEvidence = getMissingEvidence(plan);
  const evidenceUsed = getEvidenceUsed(plan);
  const escalations = getEscalations(plan);

  const overallConfidence = clamp(
    confidence?.overall ||
      confidence?.carePlan ||
      confidence?.overallConfidence ||
      0
  );

  const sectionCompleteness =
    calculateSectionCompleteness(plan);

  const purposeReadiness =
    calculatePurposeReadiness(plan);

  const evidenceStrength =
    calculateEvidenceStrength({
      documentCount:
        documentIntelligence?.documentCount || 0,
      sessionCount: sessions.length,
      evidenceUsedCount: evidenceUsed.length,
    });

  const riskLevel = getRiskLevel(plan);

  const riskScore =
    riskLevel === "high"
      ? 90
      : riskLevel === "medium"
      ? 65
      : riskLevel === "low"
      ? 30
      : 0;

  const approvedWorker = asArray(
    plan?.approvals?.approvedWorker
  );

  const approvedClient = asArray(
    plan?.approvals?.approvedClient
  );

  const pendingWorker = asArray(
    plan?.todos?.worker
  );

  const pendingClient = asArray(
    plan?.todos?.client
  );

  const latestSessionDate = sessions
    .map(getSessionDate)
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b).getTime() -
        new Date(a).getTime()
    )[0];

  const lastSessionDays = daysAgo(latestSessionDate);
  const lastPlanDays = daysAgo(
    latestVersion?.createdAt ||
      plan?.updatedAt ||
      plan?.generatedAt
  );

  const sessionsByZone = groupCounts(
    sessions,
    getSessionZone
  );

  const moodDistribution = groupCounts(
    sessions,
    getSessionMood
  );

  const purposeDomains = groupCounts(
    purposeCards,
    (card) => card?.domain || "General"
  );

  const todoApprovals = [
    {
      label: "Approved worker actions",
      value: approvedWorker.length,
    },
    {
      label: "Approved participant actions",
      value: approvedClient.length,
    },
    {
      label: "Pending worker actions",
      value: pendingWorker.length,
    },
    {
      label: "Pending participant actions",
      value: pendingClient.length,
    },
  ];

  const coordinatorAlerts = [];

  if (!latestVersion) {
    coordinatorAlerts.push({
      level: "high",
      title: "No saved care plan",
      detail:
        "Generate and save a purpose-centred plan for this participant.",
    });
  }

  if (
    latestVersion &&
    latestVersion.status !== "reviewed"
  ) {
    coordinatorAlerts.push({
      level: "medium",
      title: "Care plan awaiting review",
      detail:
        "The latest version is still marked as a draft.",
    });
  }

  if (
    (documentIntelligence?.documentCount || 0) === 0
  ) {
    coordinatorAlerts.push({
      level: "medium",
      title: "No participant evidence",
      detail:
        "Upload assessments, plans or progress documents.",
    });
  }

  if (missingEvidence.length > 0) {
    coordinatorAlerts.push({
      level: "medium",
      title: `${missingEvidence.length} evidence gap${
        missingEvidence.length === 1 ? "" : "s"
      }`,
      detail: missingEvidence[0],
    });
  }

  if (riskLevel === "high") {
    coordinatorAlerts.push({
      level: "high",
      title: "High-risk language detected",
      detail:
        "Review the risk assessment and escalation requirements.",
    });
  }

  if (
    lastSessionDays != null &&
    lastSessionDays > 14
  ) {
    coordinatorAlerts.push({
      level: "medium",
      title: "Limited recent session evidence",
      detail: `The latest recorded session was ${lastSessionDays} days ago.`,
    });
  }

  if (escalations.length > 0) {
    coordinatorAlerts.push({
      level: "high",
      title: `${escalations.length} escalation or referral item${
        escalations.length === 1 ? "" : "s"
      }`,
      detail: escalations[0],
    });
  }

  if (coordinatorAlerts.length === 0) {
    coordinatorAlerts.push({
      level: "low",
      title: "No immediate review alerts",
      detail:
        "Continue monitoring goals, risks and participant outcomes.",
    });
  }

  return (
    <div className="zone-page insights-v2-page">
      <header className="insights-v2-hero">
        <div className="insights-v2-hero-content">
          <div className="eyebrow">
            Participant Intelligence
          </div>

          <h1>Insights & Outcomes</h1>

          <p>
            Review evidence strength, purpose readiness,
            risks, activity, AI confidence and actions
            requiring coordinator attention.
          </p>

          <div className="insights-hero-actions">
            <label className="insights-client-picker">
              <span>Participant</span>

              <select
                value={selectedClientId}
                onChange={(event) =>
                  setSelectedClientId(
                    event.target.value
                  )
                }
              >
                {clients.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                    {item.age
                      ? ` (${item.age})`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn-primary insights-export-button"
              onClick={() =>
                downloadMonthlySummary(report)
              }
            >
              📥 Export Monthly Summary
            </button>
          </div>
        </div>

        <div className="insights-hero-profile">
          <div className="insights-profile-avatar">
            {safe(client.name)
              .charAt(0)
              .toUpperCase() || "P"}
          </div>

          <div>
            <strong>{client.name}</strong>

            <span>
              {client.age
                ? `Age ${client.age}`
                : "Age not recorded"}
            </span>

            <small>
              NDIS: {client.ndisNumber || "Not recorded"}
            </small>
          </div>

          <StatusBadge
            level={
              latestVersion?.status === "reviewed"
                ? "low"
                : "medium"
            }
          >
            {latestVersion?.status === "reviewed"
              ? "Plan reviewed"
              : "Plan needs review"}
          </StatusBadge>
        </div>
      </header>

      <section className="insights-metric-grid">
        <MetricCard
          icon="🎯"
          label="Purpose Readiness"
          value={`${purposeReadiness}%`}
          detail={`${purposeCards.length} purpose plan${
            purposeCards.length === 1 ? "" : "s"
          }`}
          progress={purposeReadiness}
          status={
            purposeReadiness >= 75
              ? "good"
              : purposeReadiness >= 45
              ? "warning"
              : "danger"
          }
        />

        <MetricCard
          icon="📄"
          label="Evidence Strength"
          value={`${evidenceStrength}%`}
          detail={`${
            documentIntelligence?.documentCount || 0
          } documents · ${sessions.length} sessions`}
          progress={evidenceStrength}
          status={
            evidenceStrength >= 70
              ? "good"
              : evidenceStrength >= 40
              ? "warning"
              : "danger"
          }
        />

        <MetricCard
          icon="🤖"
          label="AI Confidence"
          value={
            overallConfidence
              ? `${overallConfidence}%`
              : "—"
          }
          detail={
            overallConfidence
              ? "Structured Knowledge Engine output"
              : "Run Knowledge Engine enhancement"
          }
          progress={overallConfidence}
          status={
            overallConfidence >= 75
              ? "good"
              : overallConfidence >= 45
              ? "warning"
              : "neutral"
          }
        />

        <MetricCard
          icon="⚠️"
          label="Risk Signal"
          value={
            riskLevel === "unknown"
              ? "Not assessed"
              : riskLevel.toUpperCase()
          }
          detail={
            safe(sections.risks).trim()
              ? `${countWords(
                  sections.risks
                )} words of risk evidence`
              : "Risk information is missing"
          }
          progress={riskScore}
          status={
            riskLevel === "high"
              ? "danger"
              : riskLevel === "medium"
              ? "warning"
              : riskLevel === "low"
              ? "good"
              : "neutral"
          }
        />

        <MetricCard
          icon="✅"
          label="Plan Completeness"
          value={`${sectionCompleteness}%`}
          detail={`Latest plan ${
            lastPlanDays == null
              ? "not saved"
              : `updated ${lastPlanDays}d ago`
          }`}
          progress={sectionCompleteness}
          status={
            sectionCompleteness >= 80
              ? "good"
              : sectionCompleteness >= 50
              ? "warning"
              : "danger"
          }
        />

        <MetricCard
          icon="📝"
          label="Active Actions"
          value={
            approvedWorker.length +
            approvedClient.length
          }
          detail={`${
            pendingWorker.length +
            pendingClient.length
          } awaiting approval`}
          status={
            approvedWorker.length +
              approvedClient.length >
            0
              ? "good"
              : "neutral"
          }
        />
      </section>

      <div className="insights-v2-main-grid">
        <div className="insights-v2-primary">
          <Card
            title="Coordinator Attention"
            subtitle="Priority items identified from the latest participant evidence."
            right={
              <StatusBadge
                level={
                  coordinatorAlerts.some(
                    (item) => item.level === "high"
                  )
                    ? "high"
                    : coordinatorAlerts.some(
                        (item) =>
                          item.level === "medium"
                      )
                    ? "medium"
                    : "low"
                }
              >
                {coordinatorAlerts.length} item
                {coordinatorAlerts.length === 1
                  ? ""
                  : "s"}
              </StatusBadge>
            }
          >
            <div className="insights-alert-list">
              {coordinatorAlerts.map(
                (alert, index) => (
                  <article
                    key={`${alert.title}-${index}`}
                    className={`insights-alert insights-alert-${alert.level}`}
                  >
                    <div className="insights-alert-icon">
                      {alert.level === "high"
                        ? "!"
                        : alert.level === "medium"
                        ? "•"
                        : "✓"}
                    </div>

                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.detail}</p>
                    </div>
                  </article>
                )
              )}
            </div>
          </Card>

          <Card
            title="Care Plan Intelligence"
            subtitle="Completeness and confidence across key care-plan domains."
          >
            <div className="insights-progress-list">
              <ProgressRow
                label="Participant details"
                value={
                  confidence?.participantDetails ||
                  (safe(
                    sections.participantDetails
                  ).trim()
                    ? 75
                    : 0)
                }
                detail="Profile and current support context"
                level="purple"
              />

              <ProgressRow
                label="Goals"
                value={
                  confidence?.goals ||
                  (safe(sections.goalsShort).trim() ||
                  safe(sections.goalsLong).trim()
                    ? 75
                    : 0)
                }
                detail="Purpose-centred short and long-term goals"
                level="blue"
              />

              <ProgressRow
                label="Functional supports"
                value={
                  confidence?.functionalSupports ||
                  (safe(
                    sections.functionalNeeds
                  ).trim()
                    ? 75
                    : 0)
                }
                detail="Daily support needs and independence"
                level="teal"
              />

              <ProgressRow
                label="Health and clinical"
                value={
                  confidence?.healthClinical ||
                  (safe(
                    sections.healthClinical
                  ).trim()
                    ? 70
                    : 0)
                }
                detail="Evidence-supported clinical considerations"
                level="green"
              />

              <ProgressRow
                label="Behaviour support"
                value={
                  confidence?.behaviourSupport ||
                  (safe(
                    sections.behaviourSupport
                  ).trim()
                    ? 65
                    : 0)
                }
                detail="Triggers and proactive support strategies"
                level="orange"
              />

              <ProgressRow
                label="Risk assessment"
                value={
                  confidence?.risks ||
                  (safe(sections.risks).trim()
                    ? 70
                    : 0)
                }
                detail="Risks, controls and escalation"
                level="red"
              />
            </div>
          </Card>

          <Card
            title="Goals & Purpose Snapshot"
            subtitle="The participant’s current purpose-centred direction."
          >
            <div className="insights-goal-grid">
              <article>
                <span>Short-term goals</span>
                <p>
                  {sections.goalsShort ||
                    report?.goals?.shortTerm ||
                    "No short-term goals recorded."}
                </p>
              </article>

              <article>
                <span>Long-term goals</span>
                <p>
                  {sections.goalsLong ||
                    report?.goals?.longTerm ||
                    "No long-term goals recorded."}
                </p>
              </article>
            </div>

            {purposeCards.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="No purpose plans generated"
                description="Refresh the Purpose Plan from documents and notes."
              />
            ) : (
              <div className="insights-purpose-grid">
                {purposeCards
                  .slice(0, 6)
                  .map((card, index) => (
                    <article
                      key={
                        card.id ||
                        `${card.title}-${index}`
                      }
                      className="insights-purpose-card"
                    >
                      <div className="insights-purpose-card-top">
                        <span>
                          {card.domain || "Purpose"}
                        </span>

                        <small>
                          {card.frequency ||
                            "As planned"}
                        </small>
                      </div>

                      <strong>
                        {card.title ||
                          "Purpose activity"}
                      </strong>

                      <p>
                        {card.whyItMatters ||
                          "Meaningful participant activity."}
                      </p>
                    </article>
                  ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="insights-v2-secondary">
          <Card
            title="Monthly Activity"
            subtitle="Current reporting month."
          >
            <div className="insights-summary-list">
              <div>
                <span>Sessions</span>
                <strong>
                  {report?.summary?.totalSessions ??
                    sessions.length}
                </strong>
              </div>

              <div>
                <span>Documents</span>
                <strong>
                  {documentIntelligence?.documentCount ||
                    0}
                </strong>
              </div>

              <div>
                <span>Purpose plans</span>
                <strong>
                  {purposeCards.length}
                </strong>
              </div>

              <div>
                <span>Approved actions</span>
                <strong>
                  {approvedWorker.length +
                    approvedClient.length}
                </strong>
              </div>

              <div>
                <span>Last session</span>
                <strong>
                  {lastSessionDays == null
                    ? "—"
                    : lastSessionDays === 0
                    ? "Today"
                    : `${lastSessionDays}d ago`}
                </strong>
              </div>

              <div>
                <span>Engagement</span>
                <strong>
                  {report?.summary
                    ?.engagementSignal || "—"}
                </strong>
              </div>
            </div>
          </Card>

          <Card
            title="Evidence Gaps"
            subtitle="Information that may strengthen the plan."
          >
            {missingEvidence.length === 0 ? (
              <div className="insights-positive-state">
                <span>✓</span>

                <div>
                  <strong>
                    No AI evidence gaps recorded
                  </strong>

                  <p>
                    Continue reviewing participant
                    evidence for currency.
                  </p>
                </div>
              </div>
            ) : (
              <div className="insights-compact-list">
                {missingEvidence.map(
                  (item, index) => (
                    <div key={`${item}-${index}`}>
                      <span>{index + 1}</span>
                      <p>{item}</p>
                    </div>
                  )
                )}
              </div>
            )}
          </Card>

          <Card
            title="Evidence Used"
            subtitle="Sources recorded by the Knowledge Engine."
          >
            {evidenceUsed.length === 0 ? (
              <div className="insights-muted">
                Run Knowledge Engine enhancement to
                record evidence sources.
              </div>
            ) : (
              <div className="insights-compact-list">
                {evidenceUsed
                  .slice(0, 8)
                  .map((item, index) => (
                    <div key={`${item}-${index}`}>
                      <span>✓</span>
                      <p>{item}</p>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          <Card
            title="Escalation & Referral"
            subtitle="Items requiring authorised review."
          >
            {escalations.length === 0 ? (
              <div className="insights-muted">
                No escalation or referral suggestions
                recorded.
              </div>
            ) : (
              <div className="insights-compact-list insights-escalation-list">
                {escalations.map((item, index) => (
                  <div key={`${item}-${index}`}>
                    <span>!</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>

      <div className="insights-chart-grid">
        <Card
          title="Sessions by Service Area"
          subtitle="Distribution of participant contact and support."
        >
          <BarList
            title="Service activity"
            data={
              sessionsByZone.length
                ? sessionsByZone
                : report?.chartData
                    ?.sessionsByZone || []
            }
          />
        </Card>

        <Card
          title="Mood & Engagement"
          subtitle="Signals recorded across participant sessions."
        >
          <BarList
            title="Recorded mood"
            data={
              moodDistribution.length
                ? moodDistribution
                : report?.chartData
                    ?.moodDistribution || []
            }
          />
        </Card>

        <Card
          title="Purpose Domains"
          subtitle="Areas represented in the participant’s purpose plans."
        >
          <BarList
            title="Purpose activity"
            data={
              purposeDomains.length
                ? purposeDomains
                : report?.chartData
                    ?.purposeDomains || []
            }
          />
        </Card>

        <Card
          title="Action Status"
          subtitle="Approved and pending support actions."
        >
          <BarList
            title="Action workflow"
            data={todoApprovals}
          />
        </Card>
      </div>

      {isLoadingEvidence ? (
        <div className="insights-loading">
          <span className="evidence-processing-spinner" />
          Refreshing participant evidence intelligence…
        </div>
      ) : null}
    </div>
  );
}