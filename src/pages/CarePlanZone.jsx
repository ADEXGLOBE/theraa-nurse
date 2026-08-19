import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveClient } from "../context/ActiveClientContext";
import { useWorkspace } from "../context/WorkspaceContext";
import {
  createSharedCarePlanVersion,
  loadSharedCarePlanVersions,
} from "../services/carePlanService";
import { generateCarePlanPdf } from "../features/careplans/carePlanPdf";

import {
  listDocumentsForClient,
  buildClientDocumentIntelligence,
} from "../features/documents/documentService";
import {
  buildFindingsFromDocs,
  generateCarePlanDraft,
} from "../features/careplans/carePlanGenerator";
import { loadParticipantSessions } from "../services/sessionService";
import { useAuth } from "../context/AuthContext";
import { buildDraftFromEvidence } from "../engines/careEngine";
import { getKnowledgeContext } from "../data/knowledgeBaseStore";

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

  ai: {
    confidence: {},
    missingEvidence: [],
    evidenceUsed: [],
    escalationReferrals: [],
    lastEnhancedAt: "",
    model: "",
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

function cleanText(value) {
  return safe(value).replace(/\r\n/g, "\n").trim();
}

function appendSectionText(existing, incoming, heading = "") {
  const current = cleanText(existing);
  const addition = cleanText(incoming);

  if (!addition) return current;

  const block = heading ? `${heading}\n${addition}` : addition;

  // Prevent the exact same AI block being added repeatedly.
  if (current.includes(block)) return current;

  return [current, block].filter(Boolean).join("\n\n");
}

function formatStringList(items, emptyValue = "") {
  const values = uniq(asArray(items));
  return values.length ? values.map((item) => `• ${item}`).join("\n") : emptyValue;
}

function normalisePurposeCards(cards) {
  return asArray(cards)
    .map((card, index) => ({
      id: card?.id || `ai-purpose-${Date.now()}-${index}`,
      title: cleanText(card?.title) || `Purpose activity ${index + 1}`,
      domain: cleanText(card?.domain) || "General",
      frequency: cleanText(card?.frequency) || "As planned",
      whyItMatters: cleanText(card?.whyItMatters),
      participantAction: cleanText(card?.participantAction),
      workerAction: cleanText(card?.workerAction),
      source: "Theraa Nurse Knowledge Engine",
    }))
    .filter((card) =>
      Boolean(
        card.title ||
          card.whyItMatters ||
          card.participantAction ||
          card.workerAction
      )
    );
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
      purposeCards: asArray(
        p?.runningSource?.purposeCards || base.runningSource.purposeCards
      ),
    },
    ai: {
      ...base.ai,
      ...(p.ai || {}),
      confidence:
        p?.ai?.confidence && typeof p.ai.confidence === "object"
          ? p.ai.confidence
          : {},
      missingEvidence: uniq(p?.ai?.missingEvidence),
      evidenceUsed: uniq(p?.ai?.evidenceUsed),
      escalationReferrals: uniq(p?.ai?.escalationReferrals),
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
    <div className="card careplan-section-card">
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

function SectionTextarea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  disabled = false,
}) {
  return (
    <label className="section-title-sm" style={{ display: "block" }}>
      {label}
      <textarea
        className="textarea"
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ""}
        disabled={disabled}
      />
    </label>
  );
}

export default function CarePlanZone() {
  const { user } = useAuth();

  const {
    organisationId,
    organisationName,
    role,
    roleLabel,
  } = useWorkspace();

  const {
    clients,
    clientsReady,
    activeClientId,
    setActiveClientId,
  } = useActiveClient();

  const fallbackId = clients[0]?.id || "";

  /*
   * V3 participant-selection rule:
   * ActiveClientContext is the single source of truth.
   */
  const selectedClientId =
    activeClientId || fallbackId;

  const carePlanRequestRef = useRef(0);

  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [activePlan, setActivePlan] = useState(normalizePlan(EMPTY_PLAN()));
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [lastBuildInfo, setLastBuildInfo] = useState("");
  const [knowledgeOutput, setKnowledgeOutput] = useState("");

  const canCreatePlan = [
    "provider_admin",
    "manager",
    "support_coordinator",
    "nurse",
    "allied_health",
  ].includes(role);

  const canReviewPlan = [
    "provider_admin",
    "manager",
    "support_coordinator",
  ].includes(role);

  useEffect(() => {
    if (!activeClientId && fallbackId) {
      setActiveClientId(fallbackId);
    }
  }, [
    activeClientId,
    fallbackId,
    setActiveClientId,
  ]);

  /*
   * Clear participant-specific state immediately when the
   * active participant changes and invalidate older requests.
   */
  useEffect(() => {
    carePlanRequestRef.current += 1;
    setVersions([]);
    setSelectedVersionId("");
    setActivePlan(normalizePlan({
      ...EMPTY_PLAN(),
      clientId: selectedClientId,
    }));
    setVersionError("");
    setLastBuildInfo("");
    setKnowledgeOutput("");
  }, [selectedClientId]);

  const client = useMemo(
    () =>
      clients.find(
        (candidate) =>
          candidate.id === selectedClientId
      ) || null,
    [
      clients,
      selectedClientId,
    ]
  );

  const selectedVersion = useMemo(() => {
    if (!selectedVersionId) {
      return versions?.[0] || null;
    }

    return (
      versions.find(
        (version) =>
          version.id === selectedVersionId
      ) ||
      versions?.[0] ||
      null
    );
  }, [
    versions,
    selectedVersionId,
  ]);

  const refreshCarePlanVersions = useCallback(
    async ({
      preferVersionId = "",
    } = {}) => {
      const participantId =
        selectedClientId;

      if (
        !organisationId ||
        !participantId
      ) {
        setVersions([]);
        setSelectedVersionId("");
        setVersionsLoading(false);
        return [];
      }

      const requestId =
        ++carePlanRequestRef.current;

      setVersionsLoading(true);
      setVersionError("");

      try {
        const loaded =
          await loadSharedCarePlanVersions({
            organisationId,
            participantId,
          });

        if (
          requestId !==
          carePlanRequestRef.current
        ) {
          return [];
        }

        const safeVersions =
          Array.isArray(loaded)
            ? loaded
            : [];

        setVersions(safeVersions);

        const preferred =
          preferVersionId &&
          safeVersions.some(
            (version) =>
              version.id === preferVersionId
          )
            ? preferVersionId
            : safeVersions[0]?.id || "";

        setSelectedVersionId(preferred);

        const selected =
          safeVersions.find(
            (version) =>
              version.id === preferred
          ) ||
          safeVersions[0] ||
          null;

        const nextPlan =
          normalizePlan(
            selected?.plan ||
              EMPTY_PLAN()
          );

        nextPlan.clientId =
          participantId;

        setActivePlan(nextPlan);

        return safeVersions;
      } catch (error) {
        if (
          requestId !==
          carePlanRequestRef.current
        ) {
          return [];
        }

        console.error(
          "Unable to load shared care plans:",
          error
        );

        setVersions([]);
        setSelectedVersionId("");
        setVersionError(
          error?.message ||
            "Unable to load the shared care plan."
        );

        const empty =
          normalizePlan(
            EMPTY_PLAN()
          );

        empty.clientId =
          participantId;

        setActivePlan(empty);

        return [];
      } finally {
        if (
          requestId ===
          carePlanRequestRef.current
        ) {
          setVersionsLoading(false);
        }
      }
    },
    [
      organisationId,
      selectedClientId,
    ]
  );

  useEffect(() => {
    void refreshCarePlanVersions();
  }, [refreshCarePlanVersions]);

  useEffect(() => {
    if (!selectedVersion) {
      return;
    }

    const plan =
      normalizePlan(
        selectedVersion.plan ||
          EMPTY_PLAN()
      );

    plan.clientId =
      selectedClientId;

    setActivePlan(plan);
  }, [
    selectedVersion,
    selectedClientId,
  ]);

  if (!clientsReady) {
    return (
      <div className="card">
        <div className="card-title">Care Plan</div>
        <div className="card-subtitle">
          Loading authorised participants...
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="card">
        <div className="card-title">Care Plan</div>
        <div className="card-subtitle">No authorised participant is available.</div>
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

  async function buildFromAllEvidence() {
    setIsBuilding(true);
    setLastBuildInfo("");

    try {
      const docs = await listDocumentsForClient(client.id);
      const documentIntelligence = await buildClientDocumentIntelligence(client.id);

      const sharedSessions =
        await loadParticipantSessions({
          organisationId,
          participantId: client.id,
        });

      const recentSessions =
        (sharedSessions || []).slice(0, 20);

      const findings = buildFindingsFromDocs(docs || []);

      const baseDraft = generateCarePlanDraft({
        client,
        findings,
        recentSessions,
        existingPlan: activePlan,
        documentIntelligence,
      });

      const engineDraft = buildDraftFromEvidence({
        documentIntelligence,
        recentSessions,
        existingPlan: activePlan,
      });

      setActivePlan((prev) => {
        const prevN = normalizePlan(prev);

        let next = normalizePlan({
          ...prevN,
          ...baseDraft,
        });

        next.generatedAt = new Date().toISOString();
        next.clientId = client.id;

        if (baseDraft?.sections && typeof baseDraft.sections === "object") {
          next.sections = { ...next.sections, ...baseDraft.sections };
        }

        if (baseDraft?.goalsShort) next.sections.goalsShort = baseDraft.goalsShort;
        if (baseDraft?.goalsLong) next.sections.goalsLong = baseDraft.goalsLong;
        if (baseDraft?.risks) next.sections.risks = baseDraft.risks;
        if (baseDraft?.communication) next.sections.communication = baseDraft.communication;
        if (baseDraft?.supports) {
          next.sections.functionalNeeds = Array.isArray(baseDraft.supports)
            ? baseDraft.supports.join("\n")
            : baseDraft.supports;
        }
        if (baseDraft?.legalEthical) {
          next.sections.legalEthical = baseDraft.legalEthical;
        }

        if (engineDraft?.sections) {
          next.sections = {
            ...next.sections,
            ...(engineDraft.sections.participantDetails
              ? { participantDetails: engineDraft.sections.participantDetails }
              : {}),
            ...(engineDraft.sections.strengths
              ? { strengths: engineDraft.sections.strengths }
              : {}),
            ...(engineDraft.sections.functionalNeeds
              ? { functionalNeeds: engineDraft.sections.functionalNeeds }
              : {}),
            ...(engineDraft.sections.healthClinical
              ? { healthClinical: engineDraft.sections.healthClinical }
              : {}),
            ...(engineDraft.sections.monitoringReview
              ? { monitoringReview: engineDraft.sections.monitoringReview }
              : {}),
            ...(engineDraft.sections.behaviourSupport
              ? { behaviourSupport: engineDraft.sections.behaviourSupport }
              : {}),
            ...(engineDraft.sections.safeguardsConsent
              ? { safeguardsConsent: engineDraft.sections.safeguardsConsent }
              : {}),
            ...(engineDraft.sections.goalsShort
              ? { goalsShort: engineDraft.sections.goalsShort }
              : {}),
            ...(engineDraft.sections.goalsLong
              ? { goalsLong: engineDraft.sections.goalsLong }
              : {}),
            ...(engineDraft.sections.risks
              ? { risks: engineDraft.sections.risks }
              : {}),
            ...(engineDraft.sections.communication
              ? { communication: engineDraft.sections.communication }
              : {}),
            ...(engineDraft.sections.legalEthical
              ? { legalEthical: engineDraft.sections.legalEthical }
              : {}),
          };
        }

        next.runningSource = {
          ...(prevN?.runningSource || {}),
          ...(baseDraft?.runningSource || {}),
          ...(engineDraft?.runningSource || {}),
        };

        next.approvals = {
          approvedWorker: uniq([
            ...(prevN?.approvals?.approvedWorker || []),
            ...(baseDraft?.approvals?.approvedWorker || []),
          ]),
          approvedClient: uniq([
            ...(prevN?.approvals?.approvedClient || []),
            ...(baseDraft?.approvals?.approvedClient || []),
          ]),
        };

        const draftTodosWorker = uniq(asArray(baseDraft?.todos?.worker));
        const draftTodosClient = uniq(asArray(baseDraft?.todos?.client));
        const engineTodosWorker = uniq(asArray(engineDraft?.todos?.worker));
        const engineTodosClient = uniq(asArray(engineDraft?.todos?.client));

        next.suggestions = {
          worker: asArray(
            baseDraft?.suggestions?.worker || next?.suggestions?.worker
          ),
          client: asArray(
            baseDraft?.suggestions?.client || next?.suggestions?.client
          ),
          approvedWorker: asArray(
            baseDraft?.suggestions?.approvedWorker ||
              next?.suggestions?.approvedWorker
          ),
          approvedClient: asArray(
            baseDraft?.suggestions?.approvedClient ||
              next?.suggestions?.approvedClient
          ),
        };

        const suggestedWorkerStrings = uniq(asArray(baseDraft?.suggestedWorkerTodos));
        const suggestedClientStrings = uniq(asArray(baseDraft?.suggestedClientTodos));

        let nextTodosWorker = uniq([
          ...draftTodosWorker,
          ...engineTodosWorker,
          ...suggestedWorkerStrings,
        ]);

        let nextTodosClient = uniq([
          ...draftTodosClient,
          ...engineTodosClient,
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

        return normalizePlan(next);
      });

      const info = `Built from ${docs?.length || 0} document(s), ${
        documentIntelligence?.documentCount || 0
      } analysed source(s), and ${recentSessions.length} recent session(s).`;
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
async function enhanceWithKnowledgeEngine() {
  setIsEnhancing(true);

  try {
    const docs = await listDocumentsForClient(client.id, user?.id);

    const documentIntelligence = await buildClientDocumentIntelligence(
      client.id,
      user?.id
    );

    const sharedSessions =
      await loadParticipantSessions({
        organisationId,
        participantId: client.id,
      });

    const recentSessions =
      (sharedSessions || []).slice(0, 30);

    const evidence = [
      `Participant: ${client.name || "Unknown"} (${client.age || "age unknown"})`,
      "",
      "Current Shared Draft Care Plan:",
      JSON.stringify(activePlan, null, 2),
      "",
      "Recent Shared Multidisciplinary Sessions:",
      JSON.stringify(recentSessions, null, 2),
      "",
      "Participant Document Evidence:",
      documentIntelligence?.combinedText ||
        documentIntelligence?.text ||
        "No extracted document text found.",
    ].join("\n");

    const knowledgeQuery = [
      client?.name,
      client?.notes,
      activePlan?.sections?.risks,
      activePlan?.sections?.goalsShort,
      activePlan?.sections?.goalsLong,
      activePlan?.sections?.functionalNeeds,
      activePlan?.sections?.healthClinical,
      activePlan?.sections?.behaviourSupport,
      activePlan?.sections?.communication,
    ]
      .filter(Boolean)
      .join(" ");

    const knowledge =
      getKnowledgeContext(knowledgeQuery) || getKnowledgeContext();

    const res = await fetch("/api/knowledge-engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant: client,
        evidence,
        knowledge,
        currentPlan: activePlan,
        requestType: "enhance_care_plan",
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data?.details ||
          data?.error ||
          data?.fix ||
          "Knowledge Engine request failed."
      );
    }

    const structured = data?.structured;

    if (!structured || typeof structured !== "object") {
      throw new Error(
        "The Knowledge Engine did not return structured care-plan data. Redeploy the updated API and try again."
      );
    }

    const result = data?.result || JSON.stringify(structured, null, 2);
    setKnowledgeOutput(result);

    setActivePlan((prev) => {
      const p = normalizePlan(prev);
      const nextSections = { ...(p.sections || {}) };

      nextSections.participantDetails = appendSectionText(
        nextSections.participantDetails,
        [structured.participantSummary, structured.participantDetails]
          .map(cleanText)
          .filter(Boolean)
          .join("\n\n"),
        "Theraa Nurse AI — Participant summary"
      );

      nextSections.strengths = appendSectionText(
        nextSections.strengths,
        structured.strengthsAndPreferences,
        "Theraa Nurse AI — Strengths, interests and preferences"
      );

      nextSections.routinesAndPreferences = appendSectionText(
        nextSections.routinesAndPreferences,
        structured.strengthsAndPreferences,
        "Theraa Nurse AI — Routines and preferences to confirm"
      );

      nextSections.goalsShort = appendSectionText(
        nextSections.goalsShort,
        structured.purposeCentredGoals,
        "Theraa Nurse AI — Purpose-centred goals"
      );

      nextSections.communication = appendSectionText(
        nextSections.communication,
        structured.communicationNeeds,
        "Theraa Nurse AI — Communication and decision-making"
      );

      nextSections.functionalNeeds = appendSectionText(
        nextSections.functionalNeeds,
        structured.functionalSupports,
        "Theraa Nurse AI — Functional supports"
      );

      nextSections.healthClinical = appendSectionText(
        nextSections.healthClinical,
        structured.healthClinical,
        "Theraa Nurse AI — Health and clinical considerations"
      );

      nextSections.behaviourSupport = appendSectionText(
        nextSections.behaviourSupport,
        structured.behaviourSupport,
        "Theraa Nurse AI — Behaviour support considerations"
      );

      nextSections.risks = appendSectionText(
        nextSections.risks,
        structured.risks,
        "Theraa Nurse AI — Evidence-based risks"
      );

      nextSections.riskControls = uniq([
        ...(nextSections.riskControls || []),
        ...asArray(structured.escalationReferrals).map(
          (item) => `Escalation/referral: ${item}`
        ),
      ]);

      nextSections.safeguardsConsent = appendSectionText(
        nextSections.safeguardsConsent,
        structured.legalEthical,
        "Theraa Nurse AI — Consent, safeguards and rights"
      );

      const monitoringBlocks = [
        cleanText(structured.monitoringReview),
        asArray(structured.escalationReferrals).length
          ? `Escalation and referral suggestions:\n${formatStringList(
              structured.escalationReferrals
            )}`
          : "",
        asArray(structured.missingEvidence).length
          ? `Missing evidence to obtain or confirm:\n${formatStringList(
              structured.missingEvidence
            )}`
          : "",
        `Evidence reviewed: ${docs.length} participant document(s) and ${recentSessions.length} shared session record(s).`,
      ]
        .filter(Boolean)
        .join("\n\n");

      nextSections.monitoringReview = appendSectionText(
        nextSections.monitoringReview,
        monitoringBlocks,
        "Theraa Nurse AI — Monitoring, review and evidence gaps"
      );

      nextSections.legalEthical = appendSectionText(
        nextSections.legalEthical,
        [
          cleanText(structured.legalEthical),
          "AI-assisted recommendations must be reviewed by an authorised coordinator, supervisor, clinician or other relevant professional before implementation.",
        ]
          .filter(Boolean)
          .join("\n\n"),
        "Theraa Nurse AI — Legal, ethical and scope note"
      );

      const workerActions = uniq(structured.supportWorkerActions);
      const coordinatorActions = uniq(
        asArray(structured.supportCoordinatorActions).map(
          (item) => `[Coordinator] ${item}`
        )
      );

      const pendingWorkerActions = uniq([
        ...(p.todos?.worker || []),
        ...workerActions,
        ...coordinatorActions,
      ]).filter(
        (item) =>
          !new Set(p.approvals?.approvedWorker || []).has(String(item).trim())
      );

      const purposeCards = normalisePurposeCards(structured.purposePlan);
      const mergedPurposeCards = [
        ...(p.runningSource?.purposeCards || []),
        ...purposeCards,
      ].filter((card, index, all) => {
        const key = `${card.title}|${card.domain}|${card.participantAction}`;
        return (
          all.findIndex(
            (candidate) =>
              `${candidate.title}|${candidate.domain}|${candidate.participantAction}` ===
              key
          ) === index
        );
      });

      const next = normalizePlan({
        ...p,
        sections: nextSections,
        todos: {
          ...(p.todos || {}),
          worker: pendingWorkerActions,
          client: uniq(p.todos?.client),
        },
        runningSource: {
          ...(p.runningSource || {}),
          generatedAt: new Date().toISOString(),
          summary:
            cleanText(structured.participantSummary) ||
            p.runningSource?.summary ||
            "",
          purposeCards: mergedPurposeCards,
        },
        ai: {
          ...(p.ai || {}),
          confidence:
            structured.confidence && typeof structured.confidence === "object"
              ? structured.confidence
              : {},
          missingEvidence: uniq(structured.missingEvidence),
          evidenceUsed: uniq(structured.evidenceUsed),
          escalationReferrals: uniq(structured.escalationReferrals),
          lastEnhancedAt: new Date().toISOString(),
          model: data?.meta?.model || "",
        },
        generatedAt: new Date().toISOString(),
        clientId: client.id,
      });

      next.goalsShort = next.sections.goalsShort || "";
      next.goalsLong = next.sections.goalsLong || "";
      next.risks = next.sections.risks || "";
      next.communication = next.sections.communication || "";
      next.supports = next.sections.functionalNeeds || "";
      next.legalEthical = next.sections.legalEthical || "";

      return next;
    });

    alert(
      "Knowledge Engine enhancement completed. Recommendations were distributed into the appropriate Purpose Plan sections and remain pending professional review."
    );
  } catch (error) {
    console.error("========== KNOWLEDGE ENGINE ERROR ==========");
    console.error(error);

    alert(
      `Knowledge Engine Error:

${
        error?.message || "Unknown error"
      }

Check the Vercel deployment, API credit, document size and browser console for details.`
    );
  } finally {
    setIsEnhancing(false);
  }
}

  async function saveVersion(status) {
    if (!organisationId) {
      alert("No provider workspace is active.");
      return;
    }

    if (!client?.id) {
      alert("Select a participant first.");
      return;
    }

    if (!user?.id) {
      alert("You must be signed in to save a care plan.");
      return;
    }

    if (!canCreatePlan) {
      alert(
        "Your current workspace role is read-only for care-plan creation."
      );
      return;
    }

    if (
      ["reviewed", "approved"].includes(status) &&
      !canReviewPlan
    ) {
      alert(
        "Only a Provider Admin, Manager or Support Coordinator can formally review or approve a care plan."
      );
      return;
    }

    setIsSavingVersion(true);
    setVersionError("");

    try {
      const plan =
        normalizePlan(activePlan);

      plan.clientId =
        client.id;

      const created =
        await createSharedCarePlanVersion({
          organisationId,
          participantId:
            client.id,
          userId:
            user.id,
          status,
          plan,
          evidenceCount:
            latestVersion?.evidenceCount ||
            0,
        });

      await refreshCarePlanVersions({
        preferVersionId:
          created?.id || "",
      });

      const message =
        status === "approved"
          ? "Shared care plan saved as Approved."
          : status === "reviewed"
          ? "Shared care plan saved as Reviewed."
          : "Shared care plan saved as Draft.";

      alert(message);
    } catch (error) {
      console.error(
        "Unable to save shared care-plan version:",
        error
      );

      setVersionError(
        error?.message ||
          "Unable to save the shared care plan."
      );

      alert(
        error?.message ||
          "Unable to save the shared care plan."
      );
    } finally {
      setIsSavingVersion(false);
    }
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
  const aiConfidence = activePlan?.ai?.confidence || {};
  const aiMissingEvidence = uniq(activePlan?.ai?.missingEvidence);
  const aiEvidenceUsed = uniq(activePlan?.ai?.evidenceUsed);
  const aiEscalations = uniq(activePlan?.ai?.escalationReferrals);
  const overallConfidence = Number(aiConfidence?.overall || 0);

  return (
  <div className="zone-page careplan-pro-page">
    <div className="careplan-hero">
      <div>
        <div className="eyebrow">Purpose Plans</div>
        <h1>Care Plan Builder</h1>
        <p>
          Generate, review and optimise purpose-centred care plans from participant
          evidence, shared session notes, documents and Theraa Nurse intelligence.
        </p>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
          Workspace: <strong>{organisationName || "Provider workspace"}</strong>
          {" · "}
          Role: <strong>{roleLabel || "Workspace member"}</strong>
        </div>
      </div>

      <div className="careplan-hero-card">
        <div className="careplan-score">
          {purposeCards.length > 0 ? `${Math.min(100, 60 + purposeCards.length * 10)}%` : "—"}
        </div>
        <div className="careplan-score-label">Purpose Readiness</div>
        <small>
          {versions.length} version{versions.length === 1 ? "" : "s"} ·{" "}
          {approvedWorker.length + approvedClient.length} approved action
          {approvedWorker.length + approvedClient.length === 1 ? "" : "s"}
        </small>
      </div>
    </div>

      {versionError ? (
        <div className="auth-error" style={{ marginBottom: 12 }}>
          {versionError}
        </div>
      ) : null}

      <Card
        title="Participant & Shared Versions"
        subtitle="Select an authorised participant, then review shared organisation care-plan versions."
        right={
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="btn-primary"
              onClick={() => void saveVersion("draft")}
              disabled={isSavingVersion || !canCreatePlan}
            >
              {isSavingVersion ? "Saving…" : "💾 Save Draft"}
            </button>
            <button
              className="btn-primary"
              style={{ background: "#0f766e" }}
              onClick={() => void saveVersion("reviewed")}
              disabled={isSavingVersion || !canReviewPlan}
            >
              ✅ Save Reviewed
            </button>
            <button
              className="btn-primary"
              style={{ background: "#166534" }}
              onClick={() => void saveVersion("approved")}
              disabled={isSavingVersion || !canReviewPlan}
            >
              🛡️ Save Approved
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
              Participant
              <select
                className="input"
                value={selectedClientId}
                onChange={(e) =>
                  setActiveClientId(e.target.value)
                }
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
                {versionsLoading ? <option value="">Loading shared versions…</option> : versions.length === 0 ? <option value="">No shared versions yet</option> : null}
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
                onClick={buildFromAllEvidence}
                disabled={isBuilding || versionsLoading || !canCreatePlan}
              >
                {isBuilding ? "⏳ Building…" : "🧠 Refresh Draft from Docs + Notes"}
              </button>

              <button
                className="btn-primary"
                style={{ background: "#6d28d9" }}
                onClick={enhanceWithKnowledgeEngine}
                disabled={isEnhancing || versionsLoading || !canCreatePlan}
              >
                {isEnhancing ? "⏳ Enhancing…" : "🤖 Enhance with Knowledge Engine"}
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

      {activePlan?.ai?.lastEnhancedAt ? (
        <Card
          title="AI Enhancement Summary"
          subtitle="Structured Knowledge Engine output has been distributed across this Purpose Plan. Review every section before saving as Reviewed."
          right={
            <div
              style={{
                borderRadius: 999,
                padding: "7px 12px",
                background:
                  overallConfidence >= 80
                    ? "#dcfce7"
                    : overallConfidence >= 60
                      ? "#fef3c7"
                      : "#fee2e2",
                color:
                  overallConfidence >= 80
                    ? "#166534"
                    : overallConfidence >= 60
                      ? "#92400e"
                      : "#991b1b",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              Confidence: {overallConfidence || "—"}%
            </div>
          }
        >
          <div className="two-column">
            <div>
              <div className="section-title-sm">Evidence used</div>
              {aiEvidenceUsed.length ? (
                <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  {aiEvidenceUsed.map((item) => (
                    <li key={item} style={{ marginBottom: 5, fontSize: 13 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
                  No evidence list was returned.
                </div>
              )}
            </div>

            <div>
              <div className="section-title-sm">Missing evidence / escalation</div>
              {aiMissingEvidence.length === 0 && aiEscalations.length === 0 ? (
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
                  No additional evidence gaps or escalation items were returned.
                </div>
              ) : (
                <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  {aiMissingEvidence.map((item) => (
                    <li key={`missing-${item}`} style={{ marginBottom: 5, fontSize: 13 }}>
                      Missing: {item}
                    </li>
                  ))}
                  {aiEscalations.map((item) => (
                    <li key={`escalation-${item}`} style={{ marginBottom: 5, fontSize: 13 }}>
                      Escalation: {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {knowledgeOutput ? (
        <Card
          title="Theraa Nurse Knowledge Engine Output"
          subtitle="LLM-enhanced care-plan recommendations using participant evidence and the global care knowledge library."
        >
          <pre className="knowledge-preview-output">{knowledgeOutput}</pre>
        </Card>
      ) : null}

      {purposeCards.length > 0 ? (
        <Card
          title="Running Source – Purpose Plans"
          subtitle="Purpose-based lifestyle recommendations generated from care plans, notes, and other health-related documents."
        >
          <div style={{ display: "grid", gap: 8 }}>
            {purposeCards.map((card, index) => (
              <div key={card.id || `${card.title}-${index}`} className="purpose-card-pro">
                <div className="purpose-card-title">{card.title}</div>
                <div className="purpose-card-meta">
                  Domain: {card.domain || "General"} · Frequency: {card.frequency || "As planned"}
                </div>
                <div className="purpose-card-body">
                  <div>
                    <strong>Why it matters:</strong> {card.whyItMatters || "—"}
                  </div>
                  <div>
                    <strong>Participant action:</strong> {card.participantAction || "—"}
                  </div>
                  <div>
                    <strong>Worker action:</strong> {card.workerAction || "—"}
                  </div>
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
              disabled={!canCreatePlan}
            />
          </Card>

          <Card title="2) Goals (NDIS-aligned)" subtitle="Every support should link back to a goal.">
            <SectionTextarea
              label="Short-term goals"
              value={sections.goalsShort}
              onChange={(v) => updateSection("goalsShort", v)}
              rows={4}
              disabled={!canCreatePlan}
            />
            <SectionTextarea
              label="Long-term goals"
              value={sections.goalsLong}
              onChange={(v) => updateSection("goalsLong", v)}
              rows={4}
              disabled={!canCreatePlan}
            />
          </Card>

          <Card title="3) Strengths, Interests & Abilities" subtitle="Strength-based planning.">
            <SectionTextarea
              label="Strengths & interests"
              value={sections.strengths}
              onChange={(v) => updateSection("strengths", v)}
              rows={4}
              disabled={!canCreatePlan}
            />
            <SectionTextarea
              label="Daily routines & preferences"
              value={sections.routinesAndPreferences}
              onChange={(v) => updateSection("routinesAndPreferences", v)}
              rows={4}
              disabled={!canCreatePlan}
            />
          </Card>

          <Card title="4) Functional Support Needs" subtitle="Supports, frequency, level of assistance.">
            <SectionTextarea
              label="Functional needs & supports"
              value={sections.functionalNeeds}
              onChange={(v) => updateSection("functionalNeeds", v)}
              rows={7}
              disabled={!canCreatePlan}
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
              disabled={!canCreatePlan}
            />
          </Card>

          <Card title="6) Risk Assessment & Management" subtitle="Risk = managed participation.">
            <SectionTextarea
              label="Risks, triggers & early warning signs"
              value={sections.risks}
              onChange={(v) => updateSection("risks", v)}
              rows={5}
              disabled={!canCreatePlan}
            />

            <label className="section-title-sm" style={{ display: "block", marginTop: 8 }}>
              Risk controls (one per line)
              <textarea
                className="textarea"
                rows={4}
                value={asArray(sections.riskControls).join("\n")}
                disabled={!canCreatePlan}
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
              disabled={!canCreatePlan}
            />
          </Card>

          <Card title="8) Communication, Consent & Safeguards" subtitle="Choice, privacy, who to involve.">
            <SectionTextarea
              label="Communication & decision-making preferences"
              value={sections.communication}
              onChange={(v) => updateSection("communication", v)}
              rows={4}
              disabled={!canCreatePlan}
            />

            <SectionTextarea
              label="Safeguards, privacy & consent"
              value={sections.safeguardsConsent}
              onChange={(v) => updateSection("safeguardsConsent", v)}
              rows={4}
              disabled={!canCreatePlan}
            />
          </Card>

          <Card title="9) Monitoring, Review & Outcomes Tracking" subtitle="Make it a living plan.">
            <SectionTextarea
              label="Monitoring & review"
              value={sections.monitoringReview}
              onChange={(v) => updateSection("monitoringReview", v)}
              rows={5}
              disabled={!canCreatePlan}
            />
          </Card>

          <Card title="10) Legal & Ethical Notes" subtitle="Scope safe.">
            <SectionTextarea
              label="Legal & ethical"
              value={sections.legalEthical}
              onChange={(v) => updateSection("legalEthical", v)}
              rows={4}
              disabled={!canCreatePlan}
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
                    <button className="btn-primary" disabled={!canReviewPlan} onClick={() => approveTodo("worker", t)}>
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
                      disabled={!canReviewPlan}
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
                    <button className="btn-primary" disabled={!canReviewPlan} onClick={() => approveTodo("client", t)}>
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
                      disabled={!canReviewPlan}
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