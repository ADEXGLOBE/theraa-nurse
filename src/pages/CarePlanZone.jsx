import { useEffect, useMemo, useState } from "react";
import { loadClients } from "../data/clientsStore";
import {
  loadCarePlanVersions,
  saveCarePlanVersion,
} from "../data/carePlanStore";
import { generateCarePlanPdf } from "../features/careplans/carePlanPdf";

import {
  listDocumentsForClient,
  buildClientDocumentIntelligence,
} from "../features/documents/documentService";
import {
  buildFindingsFromDocs,
  generateCarePlanDraft,
} from "../features/careplans/carePlanGenerator";
import { loadSessions } from "../data/sessionStore";
import { useAuth } from "../context/AuthContext";

/**
 * CarePlanZone
 * - Multi-client
 * - Version history + select past versions
 * - NDIS-aligned sections
 * - To-Do suggestions: Worker vs Client
 * - Approval workflow
 * - Running Source integration
 * - PDF export
 */


const EMPTY_PLAN = () => ({
  goalsShort: "",
  goalsLong: "",
  risks: "",
  communication: "",
  supports: "",
  legalEthical: "",

  sections: {
    participantDetails: "",
    goalsShort: "",
    goalsLong: "",
    strengths: "",
    functionalNeeds: "",
    healthClinical: "",
    risks: "",
    riskControls: [],
    behaviourSupport: "",
    routinesAndPreferences: "",
    communication: "",
    safeguardsConsent: "",
    monitoringReview: "",
    legalEthical: "",
  },

  todos: { worker: [], client: [] },
  approvals: { approvedWorker: [], approvedClient: [] },

  suggestions: {
    worker: [],
    client: [],
    approvedWorker: [],
    approvedClient: [],
  },

  runningSource: {
    generatedAt: "",
    summary: "",
    themes: {},
    purposeCards: [],
  },

  generatedAt: "",
  clientId: "",
});

function asArray(v) {
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const x of asArray(arr)) {
    const k = String(x).trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function safe(v) {
  return v == null ? "" : String(v);
}

function formatTodoString(todoObj) {
  if (!todoObj) return "";
  const title = safe(todoObj.title).trim();
  const detail = safe(todoObj.detail).trim();
  const frequency = safe(todoObj.frequency).trim();

  if (title && detail && frequency) return `${title} — ${detail} (${frequency})`;
  if (title && detail) return `${title} — ${detail}`;
  if (title && frequency) return `${title} (${frequency})`;
  return title || detail || "";
}

function hydrateTodosAndApprovalsFromSuggestions(planLike) {
  const p = planLike && typeof planLike === "object" ? planLike : {};
  const suggestions = p.suggestions || {};

  const pendingWorker = uniq(asArray(suggestions.worker).map(formatTodoString));
  const pendingClient = uniq(asArray(suggestions.client).map(formatTodoString));

  const approvedWorkerFromRich = uniq(
    asArray(suggestions.approvedWorker).map(formatTodoString)
  );
  const approvedClientFromRich = uniq(
    asArray(suggestions.approvedClient).map(formatTodoString)
  );

  const approvals = p.approvals || {};
  const approvedWorkerLegacy = uniq(asArray(approvals.approvedWorker));
  const approvedClientLegacy = uniq(asArray(approvals.approvedClient));

  return {
    ...p,
    todos: {
      worker: pendingWorker,
      client: pendingClient,
    },
    approvals: {
      approvedWorker: uniq([
        ...approvedWorkerFromRich,
        ...approvedWorkerLegacy,
      ]),
      approvedClient: uniq([
        ...approvedClientFromRich,
        ...approvedClientLegacy,
      ]),
    },
  };
}

function normalizePlan(planLike) {
  const p = planLike && typeof planLike === "object" ? planLike : {};
  const base = EMPTY_PLAN();

  let merged = {
    ...base,
    ...p,
    sections: {
      ...base.sections,
      ...(p.sections || {}),
    },
    todos: {
      worker: uniq(p?.todos?.worker),
      client: uniq(p?.todos?.client),
    },
    approvals: {
      approvedWorker: uniq(p?.approvals?.approvedWorker),
      approvedClient: uniq(p?.approvals?.approvedClient),
    },
    suggestions: {
      worker: asArray(p?.suggestions?.worker),
      client: asArray(p?.suggestions?.client),
      approvedWorker: asArray(p?.suggestions?.approvedWorker),
      approvedClient: asArray(p?.suggestions?.approvedClient),
    },
    runningSource: {
      ...base.runningSource,
      ...(p.runningSource || {}),
    },
  };

  const hasRichPending =
    merged.suggestions.worker.length > 0 || merged.suggestions.client.length > 0;
  const hasEmptyTodos =
    merged.todos.worker.length === 0 && merged.todos.client.length === 0;

  if (hasRichPending && hasEmptyTodos) {
    merged = hydrateTodosAndApprovalsFromSuggestions(merged);
  }

  merged.goalsShort = merged.goalsShort || merged.sections.goalsShort || "";
  merged.goalsLong = merged.goalsLong || merged.sections.goalsLong || "";
  merged.risks = merged.risks || merged.sections.risks || "";
  merged.communication =
    merged.communication || merged.sections.communication || "";
  merged.supports =
    merged.supports || merged.sections.functionalNeeds || merged.supports || "";
  merged.legalEthical =
    merged.legalEthical || merged.sections.legalEthical || "";

  merged.sections.goalsShort =
    merged.sections.goalsShort || merged.goalsShort || "";
  merged.sections.goalsLong =
    merged.sections.goalsLong || merged.goalsLong || "";
  merged.sections.risks = merged.sections.risks || merged.risks || "";
  merged.sections.communication =
    merged.sections.communication || merged.communication || "";
  merged.sections.functionalNeeds =
    merged.sections.functionalNeeds || merged.supports || "";
  merged.sections.legalEthical =
    merged.sections.legalEthical || merged.legalEthical || "";

  return merged;
}

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

function SectionTextarea({ label, value, onChange, rows = 4, placeholder }) {
  return (
    <label className="section-title-sm" style={{ display: "block" }}>
      {label}
      <textarea
        className="textarea"
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ""}
      />
    </label>
  );
}

export default function CarePlanZone() {
  const { user } = useAuth();
  const clients = loadClients(user?.id);
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");

  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [activePlan, setActivePlan] = useState(normalizePlan(EMPTY_PLAN()));

  const [isBuilding, setIsBuilding] = useState(false);
  const [lastBuildInfo, setLastBuildInfo] = useState("");

  const client = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const selectedVersion = useMemo(() => {
    if (!selectedVersionId) return versions?.[0] || null;
    return versions.find((v) => v.id === selectedVersionId) || versions?.[0] || null;
  }, [versions, selectedVersionId]);

  useEffect(() => {
    if (!selectedClientId) return;
    const v = loadCarePlanVersions(selectedClientId, user?.id) || [];
    setVersions(v);

    const initial = normalizePlan(v[0]?.plan || EMPTY_PLAN());
    initial.clientId = selectedClientId;
    setActivePlan(initial);

    setSelectedVersionId(v[0]?.id || "");
  }, [selectedClientId,user?.id]);

  useEffect(() => {
    if (!selectedVersion) return;
    const p = normalizePlan(selectedVersion.plan || EMPTY_PLAN());
    p.clientId = selectedClientId;
    setActivePlan(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId]);

  if (!client) {
    return (
      <div className="card">
        <div className="card-title">Care Plan</div>
        <div className="card-subtitle">No client available. Add a client first.</div>
      </div>
    );
  }

  const latestVersion = versions?.[0] || null;

  const updateSection = (key, value) => {
    setActivePlan((p) => {
      const next = normalizePlan({
        ...p,
        sections: { ...(p.sections || {}), [key]: value },
      });

      if (key === "goalsShort") next.goalsShort = value;
      if (key === "goalsLong") next.goalsLong = value;
      if (key === "risks") next.risks = value;
      if (key === "communication") next.communication = value;
      if (key === "functionalNeeds") next.supports = value;
      if (key === "legalEthical") next.legalEthical = value;

      return next;
    });
  };

  const updateListSection = (key, list) => {
    setActivePlan((p) =>
      normalizePlan({
        ...p,
        sections: { ...(p.sections || {}), [key]: asArray(list) },
      })
    );
  };

  async function buildDraftFromEvidence() {
    setIsBuilding(true);
    setLastBuildInfo("");

    try {
      const docs = await listDocumentsForClient(client.id);
      const documentIntelligence = await buildClientDocumentIntelligence(client.id);

      const sessionsMap = loadSessions(user?.id);
      const recentSessions = (sessionsMap?.[client.id] || []).slice(0, 20);

      const findings = buildFindingsFromDocs(docs || []);

      const draft = generateCarePlanDraft({
        client,
        findings,
        recentSessions,
        existingPlan: activePlan,
        documentIntelligence,
      });

      setActivePlan((prev) => {
        const prevN = normalizePlan(prev);

        let next = normalizePlan({
          ...prevN,
          ...draft,
        });

        next.generatedAt = new Date().toISOString();
        next.clientId = client.id;

        if (draft?.sections && typeof draft.sections === "object") {
          next.sections = { ...next.sections, ...draft.sections };
        }

        if (draft?.goalsShort) next.sections.goalsShort = draft.goalsShort;
        if (draft?.goalsLong) next.sections.goalsLong = draft.goalsLong;
        if (draft?.risks) next.sections.risks = draft.risks;
        if (draft?.communication) next.sections.communication = draft.communication;
        if (draft?.supports) {
          next.sections.functionalNeeds = Array.isArray(draft.supports)
            ? draft.supports.join("\n")
            : draft.supports;
        }
        if (draft?.legalEthical) next.sections.legalEthical = draft.legalEthical;

        next.runningSource = {
          ...(prevN?.runningSource || {}),
          ...(draft?.runningSource || {}),
        };

        next.approvals = {
          approvedWorker: uniq([
            ...(prevN?.approvals?.approvedWorker || []),
            ...(draft?.approvals?.approvedWorker || []),
          ]),
          approvedClient: uniq([
            ...(prevN?.approvals?.approvedClient || []),
            ...(draft?.approvals?.approvedClient || []),
          ]),
        };

        const draftTodosWorker = uniq(asArray(draft?.todos?.worker));
        const draftTodosClient = uniq(asArray(draft?.todos?.client));

        next.suggestions = {
          worker: asArray(draft?.suggestions?.worker || next?.suggestions?.worker),
          client: asArray(draft?.suggestions?.client || next?.suggestions?.client),
          approvedWorker: asArray(
            draft?.suggestions?.approvedWorker || next?.suggestions?.approvedWorker
          ),
          approvedClient: asArray(
            draft?.suggestions?.approvedClient || next?.suggestions?.approvedClient
          ),
        };

        const suggestedWorkerStrings = uniq(asArray(draft?.suggestedWorkerTodos));
        const suggestedClientStrings = uniq(asArray(draft?.suggestedClientTodos));

        let nextTodosWorker = uniq([
          ...draftTodosWorker,
          ...suggestedWorkerStrings,
        ]);

        let nextTodosClient = uniq([
          ...draftTodosClient,
          ...suggestedClientStrings,
        ]);

        if (nextTodosWorker.length === 0 && next.suggestions.worker.length > 0) {
          nextTodosWorker = uniq(next.suggestions.worker.map(formatTodoString));
        }
        if (nextTodosClient.length === 0 && next.suggestions.client.length > 0) {
          nextTodosClient = uniq(next.suggestions.client.map(formatTodoString));
        }

        if (nextTodosWorker.length === 0) nextTodosWorker = uniq(prevN?.todos?.worker);
        if (nextTodosClient.length === 0) nextTodosClient = uniq(prevN?.todos?.client);

        const approvedW = new Set(next.approvals.approvedWorker);
        const approvedC = new Set(next.approvals.approvedClient);

        next.todos = {
          worker: uniq(nextTodosWorker.filter((t) => !approvedW.has(String(t).trim()))),
          client: uniq(nextTodosClient.filter((t) => !approvedC.has(String(t).trim()))),
        };

        next.goalsShort = next.sections.goalsShort || "";
        next.goalsLong = next.sections.goalsLong || "";
        next.risks = next.sections.risks || "";
        next.communication = next.sections.communication || "";
        next.supports = next.sections.functionalNeeds || "";
        next.legalEthical = next.sections.legalEthical || next.legalEthical || "";

        next = normalizePlan(next);
        return next;
      });

      const info = `Built from ${docs?.length || 0} document(s), ${documentIntelligence?.documentCount || 0} analysed source(s), and ${recentSessions.length} recent session(s).`;
      setLastBuildInfo(info);

      alert(
        "Draft refreshed from evidence. Running Source purpose recommendations have been merged into the care plan."
      );
    } catch (e) {
      console.error(e);
      alert("Failed to build draft from evidence. Check console for details.");
    } finally {
      setIsBuilding(false);
    }
  }

  function saveVersion(status) {
    const plan = normalizePlan(activePlan);

    saveCarePlanVersion({
      clientId: client.id,
      status,
      plan,
      evidenceCount: latestVersion?.evidenceCount || 0,
      ownerId: user?.id,
    });

    const v = loadCarePlanVersions(client.id, user?.id) || [];
    setVersions(v);
    setSelectedVersionId(v[0]?.id || "");
    alert(status === "reviewed" ? "Saved as Reviewed." : "Saved as Draft.");
  }

  function downloadPdf() {
    const v = selectedVersion || latestVersion;
    if (!v) {
      alert("No saved version yet. Save Draft or Reviewed first.");
      return;
    }
    generateCarePlanPdf({ client, planVersion: v });
  }

  function approveTodo(type, text) {
    const t = String(text || "").trim();
    if (!t) return;

    setActivePlan((prev) => {
      const p = normalizePlan(prev);

      if (type === "worker") {
        const approvedWorker = uniq([...(p.approvals?.approvedWorker || []), t]);
        const remainingWorker = uniq(
          (p.todos?.worker || []).filter((x) => String(x).trim() !== t)
        );
        return normalizePlan({
          ...p,
          todos: { ...(p.todos || {}), worker: remainingWorker },
          approvals: { ...(p.approvals || {}), approvedWorker },
        });
      }

      const approvedClient = uniq([...(p.approvals?.approvedClient || []), t]);
      const remainingClient = uniq(
        (p.todos?.client || []).filter((x) => String(x).trim() !== t)
      );
      return normalizePlan({
        ...p,
        todos: { ...(p.todos || {}), client: remainingClient },
        approvals: { ...(p.approvals || {}), approvedClient },
      });
    });
  }

  function unapproveTodo(type, text) {
    const t = String(text || "").trim();
    if (!t) return;

    setActivePlan((prev) => {
      const p = normalizePlan(prev);

      if (type === "worker") {
        const approvedWorker = uniq(
          (p.approvals?.approvedWorker || []).filter((x) => String(x).trim() !== t)
        );
        return normalizePlan({
          ...p,
          approvals: { ...(p.approvals || {}), approvedWorker },
        });
      }

      const approvedClient = uniq(
        (p.approvals?.approvedClient || []).filter((x) => String(x).trim() !== t)
      );
      return normalizePlan({
        ...p,
        approvals: { ...(p.approvals || {}), approvedClient },
      });
    });
  }

  const sections = activePlan.sections || {};
  const suggestedWorker = uniq(activePlan?.todos?.worker);
  const suggestedClient = uniq(activePlan?.todos?.client);
  const approvedWorker = uniq(activePlan?.approvals?.approvedWorker);
  const approvedClient = uniq(activePlan?.approvals?.approvedClient);
  const purposeCards = asArray(activePlan?.runningSource?.purposeCards);

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h2>Care Plan</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Sectioned · Versioned · Running Source · Suggestions + Approvals · PDF Export
        </div>
      </div>

      <Card
        title="Client & Versions"
        subtitle="Pick a client, then view/edit the latest care plan version — or open older versions."
        right={
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button className="btn-primary" onClick={() => saveVersion("draft")}>
              💾 Save Draft
            </button>
            <button
              className="btn-primary"
              style={{ background: "#0f766e" }}
              onClick={() => saveVersion("reviewed")}
            >
              ✅ Save Reviewed
            </button>
            <button
              className="btn-primary"
              style={{ background: "#334155" }}
              onClick={downloadPdf}
            >
              📄 Download PDF
            </button>
          </div>
        }
      >
        <div className="two-column">
          <div className="stack">
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
          </div>

          <div className="stack">
            <label className="section-title-sm">
              Version
              <select
                className="input"
                value={selectedVersionId || ""}
                onChange={(e) => setSelectedVersionId(e.target.value)}
              >
                {versions.length === 0 ? <option value="">No versions yet</option> : null}
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.status} · {new Date(v.createdAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn-primary"
                onClick={buildDraftFromEvidence}
                disabled={isBuilding}
              >
                {isBuilding ? "⏳ Building…" : "🧠 Refresh Draft from Docs + Notes"}
              </button>
              {lastBuildInfo ? (
                <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
                  {lastBuildInfo}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {purposeCards.length > 0 ? (
        <Card
          title="Running Source – Purpose Plans"
          subtitle="These are the purpose-based lifestyle recommendations generated from care plans, notes, and other health-related documents."
        >
          <div style={{ display: "grid", gap: 8 }}>
            {purposeCards.map((card) => (
              <div
                key={card.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fafafc",
                }}
              >
                <div style={{ fontWeight: 700 }}>{card.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  Domain: {card.domain} · Frequency: {card.frequency}
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <strong>Why it matters:</strong> {card.whyItMatters}
                </div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  <strong>Participant action:</strong> {card.participantAction}
                </div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  <strong>Worker action:</strong> {card.workerAction}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="two-column" style={{ marginTop: 12 }}>
        <div className="stack">
          <Card
            title="1) Participant Details & Plan Information"
            subtitle="Keep this functional + scope-safe. Avoid unsupported medical claims."
          >
            <SectionTextarea
              label="Participant details"
              value={sections.participantDetails}
              onChange={(v) => updateSection("participantDetails", v)}
              rows={5}
            />
          </Card>

          <Card title="2) Goals (NDIS-aligned)" subtitle="Every support should link back to a goal.">
            <SectionTextarea
              label="Short-term goals"
              value={sections.goalsShort}
              onChange={(v) => updateSection("goalsShort", v)}
              rows={4}
            />
            <SectionTextarea
              label="Long-term goals"
              value={sections.goalsLong}
              onChange={(v) => updateSection("goalsLong", v)}
              rows={4}
            />
          </Card>

          <Card title="3) Strengths, Interests & Abilities" subtitle="Strength-based planning.">
            <SectionTextarea
              label="Strengths & interests"
              value={sections.strengths}
              onChange={(v) => updateSection("strengths", v)}
              rows={4}
            />
            <SectionTextarea
              label="Daily routines & preferences"
              value={sections.routinesAndPreferences}
              onChange={(v) => updateSection("routinesAndPreferences", v)}
              rows={4}
            />
          </Card>

          <Card title="4) Functional Support Needs" subtitle="Supports, frequency, level of assistance.">
            <SectionTextarea
              label="Functional needs & supports"
              value={sections.functionalNeeds}
              onChange={(v) => updateSection("functionalNeeds", v)}
              rows={7}
            />
          </Card>
        </div>

        <div className="stack">
          <Card title="5) Health & Clinical Considerations" subtitle="Only include evidenced information.">
            <SectionTextarea
              label="Health & clinical considerations"
              value={sections.healthClinical}
              onChange={(v) => updateSection("healthClinical", v)}
              rows={5}
            />
          </Card>

          <Card title="6) Risk Assessment & Management" subtitle="Risk = managed participation.">
            <SectionTextarea
              label="Risks, triggers & early warning signs"
              value={sections.risks}
              onChange={(v) => updateSection("risks", v)}
              rows={5}
            />

            <label className="section-title-sm" style={{ display: "block", marginTop: 8 }}>
              Risk controls (one per line)
              <textarea
                className="textarea"
                rows={4}
                value={asArray(sections.riskControls).join("\n")}
                onChange={(e) =>
                  updateListSection(
                    "riskControls",
                    e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
          </Card>

          <Card title="7) Behaviour Support (if applicable)" subtitle="Only if relevant.">
            <SectionTextarea
              label="Behaviour support strategies"
              value={sections.behaviourSupport}
              onChange={(v) => updateSection("behaviourSupport", v)}
              rows={5}
            />
          </Card>

          <Card title="8) Communication, Consent & Safeguards" subtitle="Choice, privacy, who to involve.">
            <SectionTextarea
              label="Communication & decision-making preferences"
              value={sections.communication}
              onChange={(v) => updateSection("communication", v)}
              rows={4}
            />

            <SectionTextarea
              label="Safeguards, privacy & consent"
              value={sections.safeguardsConsent}
              onChange={(v) => updateSection("safeguardsConsent", v)}
              rows={4}
            />
          </Card>

          <Card title="9) Monitoring, Review & Outcomes Tracking" subtitle="Make it a living plan.">
            <SectionTextarea
              label="Monitoring & review"
              value={sections.monitoringReview}
              onChange={(v) => updateSection("monitoringReview", v)}
              rows={5}
            />
          </Card>

          <Card title="10) Legal & Ethical Notes" subtitle="Scope safe.">
            <SectionTextarea
              label="Legal & ethical"
              value={sections.legalEthical}
              onChange={(v) => updateSection("legalEthical", v)}
              rows={4}
            />
          </Card>
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="two-column">
        <div className="stack">
          <Card
            title="Suggested Worker To-Dos (pending approval)"
            subtitle="Approve what staff should actively do."
          >
            {suggestedWorker.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Nothing suggested yet. Click <b>Refresh Draft from Docs + Notes</b>.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {suggestedWorker.map((t) => (
                  <div
                    key={t}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "#111827" }}>{t}</div>
                    <button className="btn-primary" onClick={() => approveTodo("worker", t)}>
                      ✅ Approve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Approved Worker To-Dos (active)"
            subtitle="These are the active support actions."
          >
            {approvedWorker.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No approved worker actions yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {approvedWorker.map((t) => (
                  <div
                    key={t}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                      background: "#ecfeff",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "#111827" }}>{t}</div>
                    <button
                      className="btn-primary"
                      style={{ background: "#b91c1c" }}
                      onClick={() => unapproveTodo("worker", t)}
                    >
                      ↩ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card
            title="Suggested Client To-Dos (pending approval)"
            subtitle="Approve only safe, realistic, agreed participant actions."
          >
            {suggestedClient.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Nothing suggested yet. Click <b>Refresh Draft from Docs + Notes</b>.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {suggestedClient.map((t) => (
                  <div
                    key={t}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "#111827" }}>{t}</div>
                    <button className="btn-primary" onClick={() => approveTodo("client", t)}>
                      ✅ Approve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Approved Client To-Dos (active)"
            subtitle="These are the active participant actions."
          >
            {approvedClient.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                No approved client actions yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {approvedClient.map((t) => (
                  <div
                    key={t}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                      background: "#f0fdf4",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "#111827" }}>{t}</div>
                    <button
                      className="btn-primary"
                      style={{ background: "#b91c1c" }}
                      onClick={() => unapproveTodo("client", t)}
                    >
                      ↩ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}