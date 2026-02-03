// src/pages/CarePlanZone.jsx
import { useEffect, useMemo, useState } from "react";
import { loadClients } from "../data/clientsStore";
import { loadCarePlanVersions, saveCarePlanVersion } from "../data/carePlanStore";
import { generateCarePlanPdf } from "../features/careplans/carePlanPdf";

import { listDocumentsForClient } from "../features/documents/documentService";
import { buildFindingsFromDocs, generateCarePlanDraft } from "../features/careplans/carePlanGenerator";
import { loadSessions } from "../data/sessionStore";

/**
 * CarePlanZone (Sectioned UI)
 * - Works for multi-client
 * - Shows version history + allow selecting past versions
 * - Sectioned care plan editor (NDIS-aligned)
 * - To-Do suggestions: separate Worker vs Client
 * - Approval workflow: move suggestions -> Approved To-Dos
 * - PDF export uses latest saved version (reviewed/draft)
 */

const EMPTY_PLAN = () => ({
  // Legacy flat fields (backward compatible)
  goalsShort: "",
  goalsLong: "",
  risks: "",
  communication: "",
  supports: "",
  legalEthical: "",

  // Structured sections (preferred)
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

  // Suggestions + approvals
  todos: { worker: [], client: [] }, // generated suggestions (not approved)
  approvals: { approvedWorker: [], approvedClient: [] }, // approved items only

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

function normalizePlan(planLike) {
  const p = planLike && typeof planLike === "object" ? planLike : {};
  const base = EMPTY_PLAN();

  const merged = {
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
  };

  // Keep legacy fields in sync (so other screens can still read)
  merged.goalsShort = merged.goalsShort || merged.sections.goalsShort || "";
  merged.goalsLong = merged.goalsLong || merged.sections.goalsLong || "";
  merged.risks = merged.risks || merged.sections.risks || "";
  merged.communication = merged.communication || merged.sections.communication || "";
  merged.supports = merged.supports || merged.sections.functionalNeeds || merged.supports || "";
  merged.legalEthical = merged.legalEthical || merged.sections.legalEthical || "";

  // Also sync structured sections from legacy when missing
  merged.sections.goalsShort = merged.sections.goalsShort || merged.goalsShort || "";
  merged.sections.goalsLong = merged.sections.goalsLong || merged.goalsLong || "";
  merged.sections.risks = merged.sections.risks || merged.risks || "";
  merged.sections.communication = merged.sections.communication || merged.communication || "";
  merged.sections.functionalNeeds = merged.sections.functionalNeeds || merged.supports || "";
  merged.sections.legalEthical = merged.sections.legalEthical || merged.legalEthical || "";

  return merged;
}

function Card({ title, subtitle, children, right }) {
  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
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
  const clients = loadClients();
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");

  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [activePlan, setActivePlan] = useState(normalizePlan(EMPTY_PLAN()));

  const [isBuilding, setIsBuilding] = useState(false);
  const [lastBuildInfo, setLastBuildInfo] = useState("");

  const client = useMemo(() => clients.find((c) => c.id === selectedClientId) || null, [clients, selectedClientId]);

  const selectedVersion = useMemo(() => {
    if (!selectedVersionId) return versions?.[0] || null;
    return versions.find((v) => v.id === selectedVersionId) || versions?.[0] || null;
  }, [versions, selectedVersionId]);

  // Load versions when client changes
  useEffect(() => {
    if (!selectedClientId) return;
    const v = loadCarePlanVersions(selectedClientId) || [];
    setVersions(v);

    const initial = normalizePlan(v[0]?.plan || EMPTY_PLAN());
    initial.clientId = selectedClientId;
    setActivePlan(initial);

    setSelectedVersionId(v[0]?.id || "");
  }, [selectedClientId]);

  // If selecting a different version, load it
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

      // keep legacy fields synced for core keys
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
    setActivePlan((p) => normalizePlan({ ...p, sections: { ...(p.sections || {}), [key]: asArray(list) } }));
  };

  async function buildDraftFromEvidence() {
    setIsBuilding(true);
    setLastBuildInfo("");
    try {
      const docs = await listDocumentsForClient(client.id);
      const sessionsMap = loadSessions();
      const recentSessions = (sessionsMap?.[client.id] || []).slice(0, 20);

      const findings = buildFindingsFromDocs(docs || []);

      const draft = generateCarePlanDraft({
        client,
        findings,
        recentSessions,
      });

      // Merge into our plan structure
      // We keep existing approvals; we refresh suggestions/todos + sections content
      setActivePlan((prev) => {
        const prevN = normalizePlan(prev);
        const next = normalizePlan(prevN);

        next.generatedAt = new Date().toISOString();
        next.clientId = client.id;

        // Map generator output into sections safely (supports both generator shapes)
        // If generator returns sections (preferred)
        if (draft?.sections && typeof draft.sections === "object") {
          next.sections = { ...next.sections, ...draft.sections };
        }

        // If generator returns legacy strings/arrays
        if (draft?.goalsShort) next.sections.goalsShort = draft.goalsShort;
        if (draft?.goalsLong) next.sections.goalsLong = draft.goalsLong;
        if (draft?.risks) next.sections.risks = draft.risks;
        if (draft?.communication) next.sections.communication = draft.communication;
        if (draft?.supports) next.sections.functionalNeeds = Array.isArray(draft.supports)
          ? draft.supports.join("\n")
          : draft.supports;

        // Suggestions wiring (worker + client)
        // generator may provide todos.worker/todos.client OR suggestedWorkerTodos/suggestedClientTodos
        const nextTodosWorker = uniq([
          ...asArray(draft?.todos?.worker),
          ...asArray(draft?.suggestedWorkerTodos),
        ]);
        const nextTodosClient = uniq([
          ...asArray(draft?.todos?.client),
          ...asArray(draft?.suggestedClientTodos),
        ]);

        next.todos = {
          worker: nextTodosWorker,
          client: nextTodosClient,
        };

        // Keep legacy sync
        next.goalsShort = next.sections.goalsShort || "";
        next.goalsLong = next.sections.goalsLong || "";
        next.risks = next.sections.risks || "";
        next.communication = next.sections.communication || "";
        next.supports = next.sections.functionalNeeds || "";
        next.legalEthical = next.sections.legalEthical || next.legalEthical || "";

        return next;
      });

      const info = `Built from ${docs?.length || 0} document(s) + ${recentSessions.length} recent session(s).`;
      setLastBuildInfo(info);
      alert("Draft refreshed from evidence (documents + sessions). Review and approve To-Dos before marking reviewed.");
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
    });

    const v = loadCarePlanVersions(client.id) || [];
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
        const remainingWorker = uniq((p.todos?.worker || []).filter((x) => String(x).trim() !== t));
        return normalizePlan({
          ...p,
          todos: { ...(p.todos || {}), worker: remainingWorker },
          approvals: { ...(p.approvals || {}), approvedWorker },
        });
      }

      const approvedClient = uniq([...(p.approvals?.approvedClient || []), t]);
      const remainingClient = uniq((p.todos?.client || []).filter((x) => String(x).trim() !== t));
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
        const approvedWorker = uniq((p.approvals?.approvedWorker || []).filter((x) => String(x).trim() !== t));
        return normalizePlan({
          ...p,
          approvals: { ...(p.approvals || {}), approvedWorker },
        });
      }

      const approvedClient = uniq((p.approvals?.approvedClient || []).filter((x) => String(x).trim() !== t));
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

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h2>Care Plan</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Sectioned · Versioned · Suggestions + Approvals · PDF Export
        </div>
      </div>

      {/* Top controls */}
      <Card
        title="Client & Versions"
        subtitle="Pick a client, then view/edit the latest care plan version — or open older versions."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn-primary" onClick={() => saveVersion("draft")}>
              💾 Save Draft
            </button>
            <button className="btn-primary" style={{ background: "#0f766e" }} onClick={() => saveVersion("reviewed")}>
              ✅ Save Reviewed
            </button>
            <button className="btn-primary" style={{ background: "#334155" }} onClick={downloadPdf}>
              📄 Download PDF
            </button>
          </div>
        }
      >
        <div className="two-column">
          <div className="stack">
            <label className="section-title-sm">
              Client
              <select className="input" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.age})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ fontSize: 12, color: "#6b7280" }}>
              Tip: If you don’t see a client elsewhere (Therapy/Medication/Staff), it means those zones still point to
              mockClients — we’ll wire them to the real client store next.
            </div>
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
              <button className="btn-primary" onClick={buildDraftFromEvidence} disabled={isBuilding}>
                {isBuilding ? "⏳ Building…" : "🧠 Refresh Draft from Docs + Notes"}
              </button>
              {lastBuildInfo ? (
                <div style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>{lastBuildInfo}</div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {/* SECTIONED EDITOR */}
      <div className="two-column" style={{ marginTop: 12 }}>
        <div className="stack">
          <Card
            title="1) Participant Details & Plan Information"
            subtitle="Keep this functional + scope-safe. Avoid unsupported medical claims."
          >
            <SectionTextarea
              label="Participant details (name, contacts, emergency contact, supports, identifiers)"
              value={sections.participantDetails}
              onChange={(v) => updateSection("participantDetails", v)}
              rows={5}
              placeholder="Example: Client lives with..., main contact..., emergency contact..., preferred providers..., NDIS plan dates..."
            />
          </Card>

          <Card title="2) Goals (NDIS-aligned)" subtitle="Every support should link back to a goal.">
            <SectionTextarea
              label="Short-term goals"
              value={sections.goalsShort}
              onChange={(v) => updateSection("goalsShort", v)}
              rows={4}
              placeholder="Example: Increase independence with meal prep 2x/week..."
            />
            <SectionTextarea
              label="Long-term goals"
              value={sections.goalsLong}
              onChange={(v) => updateSection("goalsLong", v)}
              rows={4}
              placeholder="Example: Improve community participation and emotional regulation..."
            />
          </Card>

          <Card title="3) Strengths, Interests & Abilities" subtitle="NDIS is strengths-based — auditors love this.">
            <SectionTextarea
              label="Strengths & interests"
              value={sections.strengths}
              onChange={(v) => updateSection("strengths", v)}
              rows={4}
              placeholder="Example: Motivated by music, likes walking, responds well to calm routines..."
            />
            <SectionTextarea
              label="Daily routines & preferences"
              value={sections.routinesAndPreferences}
              onChange={(v) => updateSection("routinesAndPreferences", v)}
              rows={4}
              placeholder="Example: Morning routine, sensory preferences, cultural or spiritual preferences..."
            />
          </Card>

          <Card title="4) Functional Support Needs" subtitle="Break down supports by domains; specify frequency + level of support.">
            <SectionTextarea
              label="Functional needs & supports"
              value={sections.functionalNeeds}
              onChange={(v) => updateSection("functionalNeeds", v)}
              rows={7}
              placeholder="Example: Personal care (prompting), community access (2x/week), communication supports..."
            />
          </Card>
        </div>

        <div className="stack">
          <Card title="5) Health & Clinical Considerations" subtitle="Only include what is evidenced in documents/professional reports.">
            <SectionTextarea
              label="Health & clinical considerations"
              value={sections.healthClinical}
              onChange={(v) => updateSection("healthClinical", v)}
              rows={5}
              placeholder="Example: Allergies, mental health considerations, involved clinicians (OT/psych/GP)..."
            />
          </Card>

          <Card title="6) Risk Assessment & Management" subtitle="Risk = managed participation (not avoidance).">
            <SectionTextarea
              label="Risks, triggers & early warning signs"
              value={sections.risks}
              onChange={(v) => updateSection("risks", v)}
              rows={5}
              placeholder="Falls, self-harm, aggression, absconding, choking, etc. Include triggers + early signs."
            />

            <label className="section-title-sm" style={{ display: "block", marginTop: 8 }}>
              Risk controls (one per line)
              <textarea
                className="textarea"
                rows={4}
                value={asArray(sections.riskControls).join("\n")}
                onChange={(e) => updateListSection("riskControls", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
                placeholder="Example: Keep walkways clear; de-escalation script; incident response steps..."
              />
            </label>
          </Card>

          <Card title="7) Behaviour Support (if applicable)" subtitle="Only if relevant; restrictive practices require formal authorisation.">
            <SectionTextarea
              label="Behaviour support strategies"
              value={sections.behaviourSupport}
              onChange={(v) => updateSection("behaviourSupport", v)}
              rows={5}
              placeholder="PBS strategies, what works/doesn’t, trauma-informed approach, escalation steps..."
            />
          </Card>

          <Card title="8) Communication, Consent & Safeguards" subtitle="Choice & control, privacy, who to involve in decisions.">
            <SectionTextarea
              label="Communication & decision-making preferences"
              value={sections.communication}
              onChange={(v) => updateSection("communication", v)}
              rows={4}
              placeholder="Preferred communication style, capacity considerations, supported decision-making..."
            />

            <SectionTextarea
              label="Safeguards, privacy & consent"
              value={sections.safeguardsConsent}
              onChange={(v) => updateSection("safeguardsConsent", v)}
              rows={4}
              placeholder="Consent to share info, nominee/guardian details, privacy preferences..."
            />
          </Card>

          <Card title="9) Monitoring, Review & Outcomes Tracking" subtitle="Turn this into a living plan: weekly review + evidence sources.">
            <SectionTextarea
              label="Monitoring & review"
              value={sections.monitoringReview}
              onChange={(v) => updateSection("monitoringReview", v)}
              rows={5}
              placeholder="How progress is tracked, review frequency, success indicators, evidence sources..."
            />
          </Card>

          <Card title="10) Legal & Ethical Notes" subtitle="Scope safe. Document consent, rights, and duty-of-care boundaries.">
            <SectionTextarea
              label="Legal & ethical"
              value={sections.legalEthical}
              onChange={(v) => updateSection("legalEthical", v)}
              rows={4}
              placeholder="Confidentiality, duty of care, escalation rules, consent boundaries..."
            />
          </Card>
        </div>
      </div>

      {/* Suggestions + approval workflow */}
      <div style={{ marginTop: 12 }} className="two-column">
        <div className="stack">
          <Card
            title="Suggested Worker To-Dos (pending approval)"
            subtitle="These are generated from documents/notes. Approve what you want staff to actually do."
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
            subtitle="These are the actions support workers should follow. Share via PDF for approvals/email."
          >
            {approvedWorker.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>No approved worker actions yet.</div>
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
                    <button className="btn-primary" style={{ background: "#b91c1c" }} onClick={() => unapproveTodo("worker", t)}>
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
            subtitle="These are participant-facing suggestions. Only approve what is safe, realistic, and agreed."
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
            subtitle="These are participant actions to support goals. Share via PDF and confirm consent."
          >
            {approvedClient.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280" }}>No approved client actions yet.</div>
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
                    <button className="btn-primary" style={{ background: "#b91c1c" }} onClick={() => unapproveTodo("client", t)}>
                      ↩ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Footer helper */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">How approvals work (simple)</div>
        <div className="card-subtitle">
          Suggestions are generated from documents + notes. You approve the ones you want to become “active”. Then you
          Save Draft/Reviewed and export the PDF for email approvals or verbal confirmation.
        </div>
        <ul style={{ marginTop: 8, color: "#4b5563", fontSize: 13, paddingLeft: 18 }}>
          <li>
            Click <b>Refresh Draft from Docs + Notes</b> → populates suggested To-Dos (Worker + Client).
          </li>
          <li>
            Click <b>Approve</b> on an item → it moves into Approved To-Dos.
          </li>
          <li>
            Click <b>Save Reviewed</b> → locks a clean version (auditor/provider friendly).
          </li>
          <li>
            Click <b>Download PDF</b> → share for sign-off (email / provider / participant / auditor).
          </li>
        </ul>
      </div>
    </div>
  );
}
