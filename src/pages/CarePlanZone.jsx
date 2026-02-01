// src/pages/CarePlanZone.jsx
import { useEffect, useMemo, useState } from "react";
import { loadCarePlanVersions, saveCarePlanVersion } from "../data/carePlanStore";
import { generateCarePlanPdf } from "../features/careplans/carePlanPdf";
import ClientSelectorBar from "../components/ClientSelectorBar";
import { useActiveClient } from "../context/ActiveClientContext";

export default function CarePlanZone() {
  const { clients, activeClientId, activeClient } = useActiveClient();

  const [selectedClientId, setSelectedClientId] = useState(activeClientId || "");
  const [versions, setVersions] = useState([]);
  const [activePlan, setActivePlan] = useState(null);

  useEffect(() => {
    // sync local selector with global active client
    if (activeClientId && activeClientId !== selectedClientId) {
      setSelectedClientId(activeClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClientId]);

  useEffect(() => {
    if (!selectedClientId) return;

    const v = loadCarePlanVersions(selectedClientId) || [];
    setVersions(v);

    const initialPlan =
      v[0]?.plan || {
        goalsShort: "",
        goalsLong: "",
        risks: "",
        communication: "",
        supports: "",
        legalEthical: "",

        // ✅ To-Do approvals
        todoSuggestions: [],
        approvedTodos: [],
      };

    // safety: ensure fields exist
    setActivePlan({
      ...initialPlan,
      todoSuggestions: Array.isArray(initialPlan.todoSuggestions) ? initialPlan.todoSuggestions : [],
      approvedTodos: Array.isArray(initialPlan.approvedTodos) ? initialPlan.approvedTodos : [],
    });
  }, [selectedClientId]);

  const client = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  if (!client) {
    return (
      <div className="card">
        <div className="card-title">Care Plan</div>
        <div className="card-subtitle">No client selected.</div>
      </div>
    );
  }

  const latestVersion = versions?.[0] || null;

  const updateField = (field, value) => {
    setActivePlan((p) => ({ ...(p || {}), [field]: value }));
  };

  function approveTodo(todo) {
    setActivePlan((p) => {
      const approved = new Set(p.approvedTodos || []);
      approved.add(todo);
      return { ...p, approvedTodos: Array.from(approved) };
    });
  }

  function removeApproved(todo) {
    setActivePlan((p) => ({
      ...p,
      approvedTodos: (p.approvedTodos || []).filter((x) => x !== todo),
    }));
  }

  function saveReviewed() {
    if (!activePlan) return;

    saveCarePlanVersion({
      clientId: client.id,
      status: "reviewed",
      plan: activePlan,
      evidenceCount: latestVersion?.evidenceCount || 0,
    });

    alert("Care plan saved as reviewed.");

    const v = loadCarePlanVersions(client.id) || [];
    setVersions(v);
    setActivePlan(v[0]?.plan || activePlan);
  }

  function downloadPdf() {
    const versionToExport = latestVersion
      ? latestVersion
      : saveCarePlanVersion({
          clientId: client.id,
          status: "draft",
          plan: activePlan,
          evidenceCount: 0,
        });

    generateCarePlanPdf({
      client,
      planVersion: versionToExport,
    });
  }

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h2 style={{ margin: 0 }}>Care Plan</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Versioned · Evidence-bound · Reviewable · To-Do approvals
        </div>
      </div>

      <ClientSelectorBar
        right={
          <button className="primary" onClick={saveReviewed}>
            💾 Save as Reviewed
          </button>
        }
      />

      {activePlan && (
        <div className="two-column" style={{ marginTop: 12 }}>
          <div className="stack">
            <div className="card">
              <div className="card-title">Short-term goals</div>
              <textarea
                rows={4}
                value={activePlan.goalsShort || ""}
                onChange={(e) => updateField("goalsShort", e.target.value)}
              />
            </div>

            <div className="card">
              <div className="card-title">Long-term goals</div>
              <textarea
                rows={4}
                value={activePlan.goalsLong || ""}
                onChange={(e) => updateField("goalsLong", e.target.value)}
              />
            </div>

            <div className="card">
              <div className="card-title">Risks</div>
              <textarea
                rows={3}
                value={activePlan.risks || ""}
                onChange={(e) => updateField("risks", e.target.value)}
              />
            </div>

            <div className="card">
              <div className="card-title">Suggested worker To-Dos (requires approval)</div>
              <div className="card-subtitle">
                These are AI-generated suggestions. Click approve to add to the care plan as “Approved To-Dos”.
              </div>

              {(!activePlan.todoSuggestions || activePlan.todoSuggestions.length === 0) ? (
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  No suggestions found yet. (Next: wire suggestions from Insights/Docs automatically.)
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {activePlan.todoSuggestions.map((t, idx) => (
                    <div key={idx} className="doc-row" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 13 }}>{t}</div>
                      <button onClick={() => approveTodo(t)}>Approve</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10 }}>
                <div className="card-title" style={{ fontSize: 14 }}>
                  Approved To-Dos (what workers should follow)
                </div>

                {(!activePlan.approvedTodos || activePlan.approvedTodos.length === 0) ? (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    No approved To-Dos yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {activePlan.approvedTodos.map((t, idx) => (
                      <div key={idx} className="doc-row" style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontSize: 13 }}>{t}</div>
                        <button onClick={() => removeApproved(t)}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="primary"
                style={{ marginTop: 10, background: "#0f766e" }}
                onClick={downloadPdf}
              >
                📄 Download Care Plan (PDF)
              </button>
            </div>
          </div>

          <div className="stack">
            <div className="card">
              <div className="card-title">Communication</div>
              <textarea
                rows={3}
                value={activePlan.communication || ""}
                onChange={(e) => updateField("communication", e.target.value)}
              />
            </div>

            <div className="card">
              <div className="card-title">Supports</div>
              <textarea
                rows={3}
                value={activePlan.supports || ""}
                onChange={(e) => updateField("supports", e.target.value)}
              />
            </div>

            <div className="card">
              <div className="card-title">Legal & ethical</div>
              <textarea
                rows={3}
                value={activePlan.legalEthical || ""}
                onChange={(e) => updateField("legalEthical", e.target.value)}
              />
              {latestVersion ? (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
                  Latest version: {latestVersion.status} · {new Date(latestVersion.createdAt).toLocaleString()}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
                  No versions saved yet.
                </div>
              )}
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                Client: <b>{activeClient?.name}</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
