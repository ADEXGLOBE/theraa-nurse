// src/pages/CarePlanZone.jsx
import { useEffect, useMemo, useState } from "react";
import { loadClients } from "../data/clientsStore";
import { loadCarePlanVersions, saveCarePlanVersion } from "../data/carePlanStore";
import { generateCarePlanPdf } from "../features/careplans/carePlanPdf";

// Docs → Findings → Suggestions
import { listDocumentsForClient } from "../features/documents/documentService";
import { buildFindingsFromDocs, generateCarePlanDraft } from "../features/careplans/carePlanGenerator";

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

function ensureSuggestionsShape(plan) {
  const p = plan || {};
  const s = p.suggestions || {};
  return {
    ...p,
    suggestions: {
      worker: safeArray(s.worker),
      client: safeArray(s.client),
      approvedWorker: safeArray(s.approvedWorker),
      approvedClient: safeArray(s.approvedClient),
    },
  };
}

export default function CarePlanZone() {
  const clients = loadClients();

  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");
  const [versions, setVersions] = useState([]);
  const [activePlan, setActivePlan] = useState(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [docsCount, setDocsCount] = useState(0);
  const [lastSuggestionUpdateAt, setLastSuggestionUpdateAt] = useState("");

  const client = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  async function refreshDocsCount() {
    if (!selectedClientId) return;
    try {
      const docs = await listDocumentsForClient(selectedClientId);
      setDocsCount((docs || []).length);
    } catch {
      setDocsCount(0);
    }
  }

  // Load plan versions + active plan when client changes
  useEffect(() => {
    if (!selectedClientId) return;

    const v = loadCarePlanVersions(selectedClientId) || [];
    setVersions(v);

    const initialPlan = ensureSuggestionsShape(
      v[0]?.plan || {
        // Legacy fields (kept for compatibility with your UI)
        goalsShort: "",
        goalsLong: "",
        risks: "",
        communication: "",
        supports: "",
        legalEthical: "",
        // New suggestions structure
        suggestions: {
          worker: [],
          client: [],
          approvedWorker: [],
          approvedClient: [],
        },
      }
    );

    setActivePlan(initialPlan);
    setLastSuggestionUpdateAt(v[0]?.plan?.suggestionsGeneratedAt || initialPlan.suggestionsGeneratedAt || "");
    refreshDocsCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  // Listen for doc changes (uploads/OCR)
  useEffect(() => {
    const handler = (e) => {
      const cid = e?.detail?.clientId;
      if (cid && cid === selectedClientId) {
        refreshDocsCount();
      }
    };
    window.addEventListener("tn:documents-changed", handler);
    return () => window.removeEventListener("tn:documents-changed", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

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
    setActivePlan((p) => ensureSuggestionsShape({ ...(p || {}), [field]: value }));
  };

  function saveReviewed(planOverride = null) {
    const toSave = ensureSuggestionsShape(planOverride || activePlan);
    if (!toSave) return;

    saveCarePlanVersion({
      clientId: client.id,
      status: "reviewed",
      plan: toSave,
      evidenceCount: latestVersion?.evidenceCount || 0,
    });

    const v = loadCarePlanVersions(client.id) || [];
    setVersions(v);
    setActivePlan(ensureSuggestionsShape(v[0]?.plan || toSave));
    setLastSuggestionUpdateAt(v[0]?.plan?.suggestionsGeneratedAt || toSave.suggestionsGeneratedAt || "");

    alert("Care plan saved as reviewed.");
  }

  function downloadPdf() {
    if (!latestVersion) {
      alert("No saved version yet. Click 'Save as Reviewed' first, then download.");
      return;
    }

    generateCarePlanPdf({
      client,
      planVersion: latestVersion,
    });
  }

  async function generateSuggestionsFromDocs() {
    setIsGenerating(true);
    try {
      const docs = await listDocumentsForClient(client.id);
      setDocsCount((docs || []).length);

      const findings = buildFindingsFromDocs(docs || []);

      // Preserve user edits + approvals by passing existingPlan
      const draft = generateCarePlanDraft({
        client,
        findings,
        recentSessions: [],
        existingPlan: activePlan,
      });

      const merged = ensureSuggestionsShape({
        ...activePlan,
        ...draft,
      });

      setActivePlan(merged);
      setLastSuggestionUpdateAt(merged.suggestionsGeneratedAt || new Date().toISOString());

      alert("Suggestions generated from client documents. Review and approve as needed.");
    } catch (e) {
      console.error(e);
      alert("Could not generate suggestions. Check documents and try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function approveTodo(kind, todoId) {
    // kind: "worker" | "client"
    setActivePlan((prev) => {
      const p = ensureSuggestionsShape(prev);
      const s = { ...(p.suggestions || {}) };

      const pendingList = safeArray(s[kind]);
      const item = pendingList.find((x) => x.id === todoId);
      if (!item) return p;

      const approvedKey = kind === "worker" ? "approvedWorker" : "approvedClient";
      const approvedList = safeArray(s[approvedKey]);

      if (approvedList.some((x) => x.id === item.id)) return p;

      const approvedItem = {
        ...item,
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: "Coordinator", // MVP: replace later with auth/user profile
      };

      s[kind] = pendingList.filter((x) => x.id !== todoId);
      s[approvedKey] = [approvedItem, ...approvedList];

      return ensureSuggestionsShape({ ...p, suggestions: s });
    });
  }

  function rejectTodo(kind, todoId) {
    setActivePlan((prev) => {
      const p = ensureSuggestionsShape(prev);
      const s = { ...(p.suggestions || {}) };
      s[kind] = safeArray(s[kind]).filter((x) => x.id !== todoId);
      return ensureSuggestionsShape({ ...p, suggestions: s });
    });
  }

  function unapproveTodo(kind, todoId) {
    setActivePlan((prev) => {
      const p = ensureSuggestionsShape(prev);
      const s = { ...(p.suggestions || {}) };

      const approvedKey = kind === "worker" ? "approvedWorker" : "approvedClient";
      const approvedList = safeArray(s[approvedKey]);
      const removed = approvedList.find((x) => x.id === todoId);
      if (!removed) return p;

      const backToPending = {
        ...removed,
        status: "pending",
        approvedAt: "",
        approvedBy: "",
      };

      s[approvedKey] = approvedList.filter((x) => x.id !== todoId);
      s[kind] = [backToPending, ...safeArray(s[kind])];

      return ensureSuggestionsShape({ ...p, suggestions: s });
    });
  }

  function renderTodoCard(item, actions) {
    return (
      <div
        key={item.id}
        style={{
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: "10px 12px",
          background: "white",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>{item.title || "To-Do"}</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {item.frequency ? `Freq: ${item.frequency}` : ""}
          </div>
        </div>

        {item.detail ? (
          <div style={{ marginTop: 6, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>
            {item.detail}
          </div>
        ) : null}

        {item.reason ? (
          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", whiteSpace: "pre-wrap" }}>
            <b>Evidence:</b> {item.reason}
          </div>
        ) : null}

        {(item.approvedAt || item.approvedBy) && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
            {item.approvedBy ? <span><b>Approved by:</b> {item.approvedBy} </span> : null}
            {item.approvedAt ? <span>· <b>Approved at:</b> {new Date(item.approvedAt).toLocaleString()}</span> : null}
          </div>
        )}

        {actions ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {actions}
          </div>
        ) : null}
      </div>
    );
  }

  const suggestions = ensureSuggestionsShape(activePlan).suggestions;

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h2>Care Plan</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>Versioned · Evidence-bound · Reviewable</div>
      </div>

      <div className="card">
        <label>
          <div className="label">Client</div>
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.age})
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Docs on file: <b>{docsCount}</b>
          </div>
          {lastSuggestionUpdateAt ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Last suggestions update: <b>{new Date(lastSuggestionUpdateAt).toLocaleString()}</b>
            </div>
          ) : null}
        </div>

        {latestVersion ? (
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            Latest version: {latestVersion.status} · {new Date(latestVersion.createdAt).toLocaleString()}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
            No versions yet — fill the plan and click <b>Save as Reviewed</b>.
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button className="primary" onClick={generateSuggestionsFromDocs} disabled={isGenerating}>
            {isGenerating ? "⏳ Generating…" : "✨ Generate suggestions from Docs"}
          </button>

          <button className="primary" style={{ background: "#0f766e" }} onClick={() => saveReviewed()}>
            💾 Save as Reviewed
          </button>

          <button
            className="primary"
            style={{
              marginTop: 0,
              background: "#0f766e",
              opacity: latestVersion ? 1 : 0.6,
              cursor: latestVersion ? "pointer" : "not-allowed",
            }}
            disabled={!latestVersion}
            onClick={downloadPdf}
            title={!latestVersion ? "Save a version first" : "Download PDF"}
          >
            📄 Download Care Plan (PDF)
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
          Governance note: Suggestions are **draft recommendations**. Only **Approved To-Dos** should be followed by workers/clients.
        </div>
      </div>

      {activePlan && (
        <>
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
              </div>
            </div>
          </div>

          {/* Suggestions + approvals */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-title">To-Do / Suggestions</div>
            <div className="card-subtitle">
              AI-generated suggestions split into Worker & Client actions. Approve to include them as operational To-Dos.
            </div>

            <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
              {/* Suggested Worker */}
              <div>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Suggested Worker To-Dos (requires approval)</div>
                {suggestions.worker.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    No worker suggestions found yet. Click <b>Generate suggestions from Docs</b>.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {suggestions.worker.map((item) =>
                      renderTodoCard(item, [
                        <button key="approve" className="btn-primary" onClick={() => approveTodo("worker", item.id)}>
                          ✅ Approve
                        </button>,
                        <button
                          key="reject"
                          className="btn-primary"
                          style={{ background: "#4b5563" }}
                          onClick={() => rejectTodo("worker", item.id)}
                        >
                          ✖ Remove
                        </button>,
                      ])
                    )}
                  </div>
                )}
              </div>

              {/* Suggested Client */}
              <div>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Suggested Client To-Dos (requires approval)</div>
                {suggestions.client.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    No client suggestions found yet. Click <b>Generate suggestions from Docs</b>.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {suggestions.client.map((item) =>
                      renderTodoCard(item, [
                        <button key="approve" className="btn-primary" onClick={() => approveTodo("client", item.id)}>
                          ✅ Approve
                        </button>,
                        <button
                          key="reject"
                          className="btn-primary"
                          style={{ background: "#4b5563" }}
                          onClick={() => rejectTodo("client", item.id)}
                        >
                          ✖ Remove
                        </button>,
                      ])
                    )}
                  </div>
                )}
              </div>

              {/* Approved Worker */}
              <div>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Approved Worker To-Dos (what workers should follow)</div>
                {suggestions.approvedWorker.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>No approved Worker To-Dos yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {suggestions.approvedWorker.map((item) =>
                      renderTodoCard(item, [
                        <button
                          key="unapprove"
                          className="btn-primary"
                          style={{ background: "#b91c1c" }}
                          onClick={() => unapproveTodo("worker", item.id)}
                          title="Move back to suggested"
                        >
                          ↩ Unapprove
                        </button>,
                      ])
                    )}
                  </div>
                )}
              </div>

              {/* Approved Client */}
              <div>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Approved Client To-Dos (what the client should start doing)</div>
                {suggestions.approvedClient.length === 0 ? (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>No approved Client To-Dos yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {suggestions.approvedClient.map((item) =>
                      renderTodoCard(item, [
                        <button
                          key="unapprove"
                          className="btn-primary"
                          style={{ background: "#b91c1c" }}
                          onClick={() => unapproveTodo("client", item.id)}
                          title="Move back to suggested"
                        >
                          ↩ Unapprove
                        </button>,
                      ])
                    )}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Tip: After approving To-Dos, click <b>Save as Reviewed</b> so approvals are stored and included in the PDF.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="primary" style={{ background: "#0f766e" }} onClick={() => saveReviewed(activePlan)}>
                  💾 Save approvals into care plan
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
