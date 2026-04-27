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

function Card({ title, subtitle, children, right }) {
  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div className="card-title">{title}</div>
          {subtitle ? <div className="card-subtitle">{subtitle}</div> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function BarList({ title, data = [] }) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {data.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6b7280" }}>No data yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {data.map((row) => (
            <div key={row.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 4,
                }}
              >
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 10,
                  background: "#e5e7eb",
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(row.value / max) * 100}%`,
                    height: "100%",
                    background: "#2563eb",
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

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ClientInsights() {
  const { user } = useAuth();
  const clients = useMemo(() => loadClients(user?.id), [user?.id]);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [documentIntelligence, setDocumentIntelligence] = useState(null);

  useEffect(() => {
    if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
    if (clients.length === 0) {
      setSelectedClientId("");
    }
  }, [clients, selectedClientId]);

  const client = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const sessionsMap = loadSessions(user?.id);
  const sessions = useMemo(
    () => (selectedClientId ? sessionsMap?.[selectedClientId] || [] : []),
    [sessionsMap, selectedClientId]
  );

  const latestVersion = useMemo(() => {
    if (!selectedClientId) return null;
    const versions = loadCarePlanVersions(selectedClientId, user?.id) || [];
    return versions[0] || null;
  }, [selectedClientId, user?.id]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!selectedClientId) {
        setDocumentIntelligence(null);
        return;
      }
      const data = await buildClientDocumentIntelligence(selectedClientId);
      if (mounted) setDocumentIntelligence(data);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [selectedClientId]);

  if (!client) {
    return (
      <div className="card">
        <div className="card-title">Client Insights</div>
        <div className="card-subtitle">No client available.</div>
      </div>
    );
  }

  const report = generateMonthlyNdisReport({
    client,
    month: currentMonthKey(),
    sessions,
    carePlanVersion: latestVersion,
    documentCount: documentIntelligence?.documentCount || 0,
  });

  const purposeCards = latestVersion?.plan?.runningSource?.purposeCards || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Client Insights</h1>
          <p className="page-subtitle">
            Visual overview of sessions, risks, purpose-based planning, and monthly report outputs.
          </p>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          Theraa Nurse · Insights & Outcomes Dashboard
        </div>
      </div>

      <Card
        title="Client Selection"
        subtitle="Choose a participant to view insights."
        right={
          <button className="btn-primary" onClick={() => downloadMonthlySummary(report)}>
            📥 Export Monthly Summary
          </button>
        }
      >
        <label className="section-title-sm">
          Client
          <select
            className="input"
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
      </Card>

      <div className="two-column" style={{ marginTop: 12 }}>
        <div className="stack">
          <Card title="Monthly Summary" subtitle="Current month overview.">
            <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
              <div><strong>Sessions:</strong> {report.summary.totalSessions}</div>
              <div><strong>Documents analysed:</strong> {report.summary.documentCount}</div>
              <div><strong>Approved worker to-dos:</strong> {report.summary.approvedWorkerTodos}</div>
              <div><strong>Approved client to-dos:</strong> {report.summary.approvedClientTodos}</div>
              <div><strong>Purpose plans generated:</strong> {report.summary.purposePlansGenerated}</div>
              <div><strong>Overall engagement signal:</strong> {report.summary.engagementSignal}</div>
            </div>
          </Card>

          <Card title="Goals Snapshot" subtitle="Pulled from latest care plan.">
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
              <strong>Short-term goals</strong>
              <div style={{ marginTop: 6 }}>{report.goals.shortTerm || "—"}</div>
              <div style={{ marginTop: 12 }}><strong>Long-term goals</strong></div>
              <div style={{ marginTop: 6 }}>{report.goals.longTerm || "—"}</div>
            </div>
          </Card>

          <Card title="Document Intelligence Snapshot" subtitle="Aggregated extracted evidence.">
            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <div><strong>Goals found:</strong> {documentIntelligence?.goals?.length || 0}</div>
              <div><strong>Risks found:</strong> {documentIntelligence?.risks?.length || 0}</div>
              <div><strong>Supports found:</strong> {documentIntelligence?.functionalNeeds?.length || 0}</div>
              <div><strong>Triggers found:</strong> {documentIntelligence?.triggers?.length || 0}</div>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Charts" subtitle="Chart-ready insight blocks.">
            <div style={{ display: "grid", gap: 16 }}>
              <BarList title="Sessions by Zone" data={report.chartData.sessionsByZone} />
              <BarList title="Mood Distribution" data={report.chartData.moodDistribution} />
              <BarList title="Risk Profile" data={report.chartData.riskProfile} />
              <BarList title="Purpose Domains" data={report.chartData.purposeDomains} />
              <BarList title="Approved To-Do Counts" data={report.chartData.todoApprovals} />
            </div>
          </Card>
        </div>
      </div>

      <Card
        title="Purpose Plans"
        subtitle="Purpose-based recommendations generated by Running Source."
      >
        {purposeCards.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            No purpose plans generated yet. Refresh the care plan draft from evidence first.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {purposeCards.map((card, index) => (
              <div
                key={card.id || `${card.title}-${index}`}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 700 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  {card.domain || "General"} · {card.frequency || "As planned"}
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  {card.whyItMatters || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}