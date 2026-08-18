// src/pages/KnowledgeEngine.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  deleteKnowledgeArticle,
  getKnowledgeContext,
  loadKnowledgeArticles,
  saveKnowledgeArticle,
  searchKnowledge,
} from "../data/knowledgeBaseStore";

import {
  loadCarePlanVersions,
} from "../data/carePlanStore";

import {
  extractTextFromPdf,
} from "../features/documents/pdfExtraction";

import {
  loadParticipantSessions,
  groupSessionsByZone,
} from "../services/sessionService";

import {
  useActiveClient,
} from "../context/ActiveClientContext";

import {
  useWorkspace,
} from "../context/WorkspaceContext";

import {
  useAuth,
} from "../context/AuthContext";


/* =========================================================
   FILE SETTINGS
========================================================= */

const MAX_FILE_SIZE_BYTES =
  15 * 1024 * 1024;

const ACCEPTED_FILE_TYPES =
  ".pdf,.txt,.md,.csv,.json,.html,.htm";


const emptyForm = {
  title: "",
  category: "NDIS Practice",
  source: "",
  content: "",

  fileName: "",
  fileType: "",
  fileExtension: "",
  size: 0,

  extractionStatus:
    "manual-entry",

  extractionMessage: "",

  pageCount: null,
  pagesProcessed: null,

  characterCount: 0,
  wasTruncated: false,
};


/* =========================================================
   GENERAL HELPERS
========================================================= */

function safe(value) {
  return value == null
    ? ""
    : String(value);
}


function asArray(value) {
  return Array.isArray(value)
    ? value.filter(Boolean)
    : [];
}


function getExtension(
  fileName = ""
) {
  const normalised =
    String(fileName).toLowerCase();

  const dotIndex =
    normalised.lastIndexOf(".");

  return dotIndex >= 0
    ? normalised.slice(dotIndex)
    : "";
}


function formatFileSize(bytes) {
  if (!bytes) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}


function formatDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}


/* =========================================================
   CARE PLAN
========================================================= */

function getLatestCarePlan(
  participantId,
  ownerId
) {
  if (!participantId) {
    return null;
  }

  try {
    const versions =
      loadCarePlanVersions(
        participantId,
        ownerId
      ) || [];

    return (
      versions[0]?.plan ||
      null
    );
  } catch (error) {
    console.warn(
      "Unable to load care plan for Knowledge Engine:",
      error
    );

    return null;
  }
}


/* =========================================================
   SESSION / EVIDENCE HELPERS
========================================================= */

function describeStaffSession(
  session
) {
  return [
    session.shiftType
      ? `Shift: ${session.shiftType}`
      : "",

    session.mood
      ? `Mood: ${session.mood}`
      : "",

    session.engagement
      ? `Engagement: ${session.engagement}`
      : "",

    session.observations ||
      session.notes
      ? `Observations: ${
          session.observations ||
          session.notes
        }`
      : "",

    session.actionsTaken
      ? `Actions: ${session.actionsTaken}`
      : "",

    session.participantResponse
      ? `Participant response: ${session.participantResponse}`
      : "",

    session.outcome
      ? `Outcome: ${session.outcome}`
      : "",

    session.goalProgress
      ? `Goal progress: ${session.goalProgress}`
      : "",

    session.escalationLevel &&
    session.escalationLevel !==
      "No escalation required"
      ? `Escalation: ${session.escalationLevel}`
      : "",

    session.safeguardingConcern
      ? `Safeguarding concern: ${
          session.safeguardingNotes ||
          "Recorded"
        }`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}


function describeTherapySession(
  session
) {
  return [
    session.discipline
      ? `Discipline: ${session.discipline}`
      : "",

    session.sessionGoal
      ? `Session goal: ${session.sessionGoal}`
      : "",

    session.mood
      ? `Mood: ${session.mood}`
      : "",

    session.participationLevel
      ? `Participation: ${session.participationLevel}`
      : "",

    session.progressSignal
      ? `Progress: ${session.progressSignal}`
      : "",

    asArray(
      session.barriers
    ).length
      ? `Barriers: ${session.barriers.join(
          ", "
        )}`
      : "",

    session.strategiesUsed
      ? `Strategies: ${session.strategiesUsed}`
      : "",

    session.outcome
      ? `Outcome: ${session.outcome}`
      : "",

    session.followUp
      ? `Follow-up: ${session.followUp}`
      : "",

    session.notes
      ? `Notes: ${session.notes}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}


function describeMedicationSession(
  session
) {
  const medicationLines =
    asArray(
      session.medications
    )
      .map((medication) => {
        if (!medication?.name) {
          return "";
        }

        return `${medication.name}${
          medication.dose
            ? ` ${medication.dose}`
            : ""
        } — ${
          medication.status ||
          "Not recorded"
        }`;
      })
      .filter(Boolean);

  return [
    medicationLines.length
      ? `Medication status:\n${medicationLines.join(
          "\n"
        )}`
      : "",

    asArray(
      session.sideEffects
    ).length
      ? `Possible side effects / observations: ${session.sideEffects.join(
          ", "
        )}`
      : "",

    session.prnReason
      ? `PRN reason: ${session.prnReason}`
      : "",

    session.prnOutcome
      ? `PRN outcome: ${session.prnOutcome}`
      : "",

    session.followUpRequired
      ? `Follow-up required: ${
          session.followUpReason ||
          "Yes"
        }`
      : "",

    session.notes
      ? `Medication notes: ${session.notes}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}


function describeGenericSession(
  session
) {
  return (
    session.notes ||
    session.summary ||
    session.outcome ||
    "Participant activity recorded."
  );
}


function describeSession(
  session
) {
  switch (
    session?.zone
  ) {
    case "staff":
      return describeStaffSession(
        session
      );

    case "therapy":
      return describeTherapySession(
        session
      );

    case "meds":
      return describeMedicationSession(
        session
      );

    default:
      return describeGenericSession(
        session
      );
  }
}


function buildParticipantEvidence(
  sessions
) {
  if (
    !sessions?.length
  ) {
    return "";
  }

  return sessions
    .slice(0, 30)
    .map(
      (
        session,
        index
      ) => {
        const zone =
          safe(
            session.zone
          ).toUpperCase();

        return `
EVIDENCE ${index + 1}
Service Area: ${zone}
Date: ${formatDate(
          session.timestamp ||
            session.createdAt
        )}

${describeSession(
  session
)}
`.trim();
      }
    )
    .join(
      "\n\n------------------------------\n\n"
    );
}


/* =========================================================
   AI OUTPUT HELPERS
========================================================= */

function normaliseAiResponse(
  response
) {
  if (!response) {
    return "";
  }

  if (
    typeof response ===
    "string"
  ) {
    return response;
  }

  if (
    typeof response.result ===
    "string"
  ) {
    return response.result;
  }

  if (
    typeof response.text ===
    "string"
  ) {
    return response.text;
  }

  if (
    typeof response.output ===
    "string"
  ) {
    return response.output;
  }

  if (
    response.structured
  ) {
    return JSON.stringify(
      response.structured,
      null,
      2
    );
  }

  return JSON.stringify(
    response,
    null,
    2
  );
}


function EvidenceMetric({
  icon,
  value,
  label,
  active = false,
}) {
  return (
    <div
      style={{
        border:
          active
            ? "1px solid #93c5fd"
            : "1px solid #e5e7eb",

        borderRadius: 14,

        padding: 14,

        background:
          active
            ? "#eff6ff"
            : "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: 20,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          marginTop: 5,
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function KnowledgeEngine() {
  const fileInputRef =
    useRef(null);

  const {
    user,
  } = useAuth();

  const {
    organisationId,
    organisationName,
    roleLabel,
  } = useWorkspace();

  const {
    clients,
    clientsReady,
    activeClientId,
    setActiveClientId,
  } = useActiveClient();


  /* =======================================================
     KNOWLEDGE LIBRARY STATE
  ======================================================= */

  const [
    form,
    setForm,
  ] = useState(
    emptyForm
  );

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    isExtracting,
    setIsExtracting,
  ] = useState(false);


  /* =======================================================
     PARTICIPANT INTELLIGENCE STATE
  ======================================================= */

  const fallbackId =
    clients[0]?.id ||
    "";

  const [
    selectedParticipantId,
    setSelectedParticipantId,
  ] = useState(
    activeClientId ||
      fallbackId
  );

  const [
    sessions,
    setSessions,
  ] = useState([]);

  const [
    sessionsLoading,
    setSessionsLoading,
  ] = useState(false);

  const [
    evidenceError,
    setEvidenceError,
  ] = useState("");

  const [
    manualEvidence,
    setManualEvidence,
  ] = useState("");

  const [
    includeManualEvidence,
    setIncludeManualEvidence,
  ] = useState(false);

  const [
    analysing,
    setAnalysing,
  ] = useState(false);

  const [
    aiResult,
    setAiResult,
  ] = useState("");

  const [
    analysisError,
    setAnalysisError,
  ] = useState("");

  const [
    analysisMeta,
    setAnalysisMeta,
  ] = useState(null);


  /* =======================================================
     KNOWLEDGE LIBRARY DATA
  ======================================================= */

  const articles =
    useMemo(() => {
      void refreshKey;

      return query
        ? searchKnowledge(
            query
          )
        : loadKnowledgeArticles();
    }, [
      query,
      refreshKey,
    ]);


  const allArticles =
    useMemo(() => {
      void refreshKey;

      return loadKnowledgeArticles();
    }, [
      refreshKey,
    ]);


  /* =======================================================
     PARTICIPANT SELECTION
  ======================================================= */

  useEffect(() => {
    if (
      activeClientId &&
      activeClientId !==
        selectedParticipantId
    ) {
      setSelectedParticipantId(
        activeClientId
      );
    }
  }, [
    activeClientId,
    selectedParticipantId,
  ]);


  useEffect(() => {
    if (
      !selectedParticipantId &&
      fallbackId
    ) {
      setSelectedParticipantId(
        fallbackId
      );
    }
  }, [
    fallbackId,
    selectedParticipantId,
  ]);


  useEffect(() => {
    if (
      selectedParticipantId &&
      selectedParticipantId !==
        activeClientId
    ) {
      setActiveClientId(
        selectedParticipantId
      );
    }
  }, [
    selectedParticipantId,
    activeClientId,
    setActiveClientId,
  ]);


  const selectedParticipant =
    useMemo(
      () =>
        clients.find(
          (client) =>
            client.id ===
            selectedParticipantId
        ) || null,
      [
        clients,
        selectedParticipantId,
      ]
    );


  /* =======================================================
     SHARED PARTICIPANT SESSIONS
  ======================================================= */

  const refreshParticipantEvidence =
    useCallback(
      async () => {
        if (
          !organisationId ||
          !selectedParticipantId
        ) {
          setSessions([]);
          return;
        }

        setSessionsLoading(
          true
        );

        setEvidenceError("");

        try {
          const loaded =
            await loadParticipantSessions(
              {
                organisationId,

                participantId:
                  selectedParticipantId,
              }
            );

          setSessions(
            Array.isArray(
              loaded
            )
              ? loaded
              : []
          );
        } catch (error) {
          console.error(
            "Knowledge Engine evidence load failed:",
            error
          );

          setSessions([]);

          setEvidenceError(
            error?.message ||
              "Unable to load participant evidence."
          );
        } finally {
          setSessionsLoading(
            false
          );
        }
      },
      [
        organisationId,
        selectedParticipantId,
      ]
    );


  useEffect(() => {
    void refreshParticipantEvidence();
  }, [
    refreshParticipantEvidence,
  ]);


  /* =======================================================
     CARE PLAN
  ======================================================= */

  const currentPlan =
    useMemo(
      () =>
        getLatestCarePlan(
          selectedParticipantId,
          user?.id
        ),
      [
        selectedParticipantId,
        user?.id,
      ]
    );


  /* =======================================================
     SESSION COUNTS
  ======================================================= */

  const groupedSessions =
    useMemo(
      () =>
        groupSessionsByZone(
          sessions
        ),
      [
        sessions,
      ]
    );


  const therapyCount =
    groupedSessions
      .therapy
      ?.length || 0;

  const staffCount =
    groupedSessions
      .staff
      ?.length || 0;

  const medicationCount =
    groupedSessions
      .meds
      ?.length || 0;

  const paramedicCount =
    groupedSessions
      .paramedic
      ?.length || 0;


  /* =======================================================
     BUILD EVIDENCE
  ======================================================= */

  const automaticEvidence =
    useMemo(
      () =>
        buildParticipantEvidence(
          sessions
        ),
      [
        sessions,
      ]
    );


  const combinedEvidence =
    useMemo(() => {
      const blocks = [];

      if (
        automaticEvidence
      ) {
        blocks.push(
          `SHARED PARTICIPANT RECORDS:\n${automaticEvidence}`
        );
      }

      if (
        includeManualEvidence &&
        manualEvidence.trim()
      ) {
        blocks.push(
          `ADDITIONAL MANUAL EVIDENCE:\n${manualEvidence.trim()}`
        );
      }

      return blocks.join(
        "\n\n========================================\n\n"
      );
    }, [
      automaticEvidence,
      includeManualEvidence,
      manualEvidence,
    ]);


  /* =======================================================
     KNOWLEDGE RETRIEVAL
  ======================================================= */

  const relevantKnowledge =
    useMemo(() => {
      if (
        !combinedEvidence
      ) {
        return getKnowledgeContext();
      }

      return (
        getKnowledgeContext(
          combinedEvidence.slice(
            0,
            5000
          )
        ) ||
        getKnowledgeContext()
      );
    }, [
      combinedEvidence,
      refreshKey,
    ]);


  /* =======================================================
     KNOWLEDGE FILE ACTIONS
  ======================================================= */

  function updateField(
    key,
    value
  ) {
    setForm(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
  }


  function resetForm() {
    setForm(
      emptyForm
    );

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  }


  async function handleFileUpload(
    file
  ) {
    if (!file) {
      return;
    }

    if (
      file.size >
      MAX_FILE_SIZE_BYTES
    ) {
      alert(
        "Please upload a file smaller than 15 MB."
      );

      return;
    }

    const extension =
      getExtension(
        file.name
      );

    const supportedExtensions = [
      ".pdf",
      ".txt",
      ".md",
      ".csv",
      ".json",
      ".html",
      ".htm",
    ];

    if (
      !supportedExtensions.includes(
        extension
      )
    ) {
      alert(
        "Unsupported file type. Upload PDF, TXT, MD, CSV, JSON or HTML."
      );

      return;
    }

    setIsExtracting(
      true
    );

    try {
      let result;

      if (
        file.type ===
          "application/pdf" ||
        extension === ".pdf"
      ) {
        result =
          await extractTextFromPdf(
            file
          );
      } else {
        const text =
          await file.text();

        result = {
          text,

          pageCount: null,
          pagesProcessed:
            null,

          characterCount:
            text.length,

          extractionStatus:
            text
              ? "completed"
              : "no-readable-text",

          wasTruncated:
            false,
        };
      }

      if (!result.text) {
        throw new Error(
          "No readable text was found. The PDF may contain scanned images and require OCR."
        );
      }

      setForm(
        (previous) => ({
          ...previous,

          title:
            previous.title ||
            file.name.replace(
              /\.[^/.]+$/,
              ""
            ),

          source:
            previous.source ||
            file.name,

          content:
            result.text,

          fileName:
            file.name,

          fileType:
            file.type,

          fileExtension:
            extension,

          size:
            file.size,

          extractionStatus:
            result.extractionStatus,

          extractionMessage:
            extension === ".pdf"
              ? `Extracted text from ${
                  result.pagesProcessed ||
                  result.pageCount ||
                  0
                } PDF page(s).`
              : "Text file extracted successfully.",

          pageCount:
            result.pageCount,

          pagesProcessed:
            result.pagesProcessed,

          characterCount:
            result.characterCount,

          wasTruncated:
            result.wasTruncated,
        })
      );
    } catch (error) {
      console.error(
        "Knowledge Engine upload failed:",
        error
      );

      alert(
        `File extraction failed:\n\n${
          error?.message ||
          "Unknown error"
        }`
      );
    } finally {
      setIsExtracting(
        false
      );
    }
  }


  function handleSave() {
    if (
      !form.title.trim()
    ) {
      alert(
        "Please enter a title."
      );

      return;
    }

    if (
      !form.content.trim()
    ) {
      alert(
        "Please paste or upload readable knowledge content."
      );

      return;
    }

    saveKnowledgeArticle(
      form
    );

    resetForm();

    setRefreshKey(
      (key) =>
        key + 1
    );

    alert(
      "Knowledge document saved to the shared Knowledge Library."
    );
  }


  function handleDelete(
    id
  ) {
    if (
      !window.confirm(
        "Delete this knowledge document?"
      )
    ) {
      return;
    }

    deleteKnowledgeArticle(
      id
    );

    setRefreshKey(
      (key) =>
        key + 1
    );
  }


  /* =======================================================
     AI ANALYSIS
  ======================================================= */

  async function analyseParticipant() {
    if (
      !selectedParticipant
    ) {
      alert(
        "Select a participant first."
      );

      return;
    }

    if (
      !combinedEvidence.trim()
    ) {
      alert(
        "No participant evidence is available to analyse."
      );

      return;
    }

    setAnalysing(
      true
    );

    setAnalysisError(
      ""
    );

    setAiResult(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/knowledge-engine",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                participant: {
                  id:
                    selectedParticipant.id,

                  name:
                    selectedParticipant.name,

                  age:
                    selectedParticipant.age,

                  dob:
                    selectedParticipant.dob,

                  gender:
                    selectedParticipant.gender,

                  ndisNumber:
                    selectedParticipant.ndisNumber,

                  notes:
                    selectedParticipant.notes,
                },

                evidence:
                  combinedEvidence,

                knowledge:
                  relevantKnowledge ||
                  "No organisation knowledge was retrieved.",

                currentPlan:
                  currentPlan || {},

                requestType:
                  "participant_intelligence_review",
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        data?.ok === false
      ) {
        throw new Error(
          data?.details ||
            data?.error ||
            "Theraa Nurse AI analysis failed."
        );
      }

      const result =
        normaliseAiResponse(
          data
        );

      setAiResult(
        result
      );

      setAnalysisMeta({
        generatedAt:
          new Date().toISOString(),

        participantName:
          selectedParticipant.name,

        sessionCount:
          sessions.length,

        knowledgeCount:
          allArticles.length,

        carePlanAvailable:
          Boolean(
            currentPlan
          ),
      });
    } catch (error) {
      console.error(
        "Theraa Nurse AI analysis failed:",
        error
      );

      setAnalysisError(
        error?.message ||
          "Unable to analyse participant evidence."
      );
    } finally {
      setAnalysing(
        false
      );
    }
  }


  /* =======================================================
     LOADING STATE
  ======================================================= */

  if (
    !clientsReady
  ) {
    return (
      <div className="zone-page knowledge-page">
        <div className="card premium-card">
          Loading authorised participants...
        </div>
      </div>
    );
  }


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="zone-page knowledge-page">

      {/* ===================================================
          HERO
      =================================================== */}

      <div className="knowledge-hero">

        <div>

          <div className="eyebrow">
            Theraa Nurse Intelligence
          </div>

          <h1>
            Knowledge Engine
          </h1>

          <p>
            Connect participant evidence with
            organisation-wide knowledge and use
            AI-assisted reasoning to support
            professional review, care planning and
            purpose-centred decision making.
          </p>

        </div>


        <div className="knowledge-stat-card">

          <div className="knowledge-stat-number">
            {allArticles.length}
          </div>

          <div className="knowledge-stat-label">
            Knowledge Documents
          </div>

          <small>
            Available to the intelligence engine
          </small>

        </div>

      </div>


      {/* ===================================================
          PARTICIPANT INTELLIGENCE
      =================================================== */}

      <div
        className="card premium-card"
        style={{
          marginBottom: 16,
        }}
      >

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 16,
            flexWrap:
              "wrap",
          }}
        >

          <div>

            <div className="card-title">
              Participant Intelligence Workspace
            </div>

            <div className="card-subtitle">
              Select a participant and Theraa Nurse
              will gather their authorised shared
              support records automatically.
            </div>

          </div>


          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              textAlign:
                "right",
            }}
          >
            {organisationName}
            <br />
            {roleLabel}
          </div>

        </div>


        <label
          style={{
            display: "block",
            marginTop: 18,
          }}
        >

          <span className="section-title-sm">
            Participant
          </span>


          <select
            className="input"
            value={
              selectedParticipantId
            }
            onChange={(event) =>
              setSelectedParticipantId(
                event.target.value
              )
            }
          >

            {!clients.length ? (
              <option value="">
                No authorised participants
              </option>
            ) : (
              clients.map(
                (participant) => (
                  <option
                    key={
                      participant.id
                    }
                    value={
                      participant.id
                    }
                  >
                    {participant.name}

                    {participant.age
                      ? ` (${participant.age})`
                      : ""}
                  </option>
                )
              )
            )}

          </select>

        </label>


        {selectedParticipant ? (

          <div
            style={{
              marginTop: 14,
              padding: 14,
              border:
                "1px solid #e5e7eb",
              borderRadius: 14,
            }}
          >

            <strong>
              {selectedParticipant.name}
            </strong>

            <div
              style={{
                fontSize: 12,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              NDIS:{" "}
              {selectedParticipant.ndisNumber ||
                "Not recorded"}

              {" · "}

              {selectedParticipant.age
                ? `Age ${selectedParticipant.age}`
                : "Age not recorded"}
            </div>

          </div>

        ) : null}


        {evidenceError ? (
          <div
            className="auth-error"
            style={{
              marginTop: 12,
            }}
          >
            {evidenceError}
          </div>
        ) : null}


        {/* EVIDENCE COUNTERS */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
            marginTop: 18,
          }}
        >

          <EvidenceMetric
            icon="📝"
            value={
              staffCount
            }
            label="Staff Notes"
            active={
              staffCount > 0
            }
          />

          <EvidenceMetric
            icon="🧠"
            value={
              therapyCount
            }
            label="Therapy"
            active={
              therapyCount > 0
            }
          />

          <EvidenceMetric
            icon="💊"
            value={
              medicationCount
            }
            label="Medication"
            active={
              medicationCount > 0
            }
          />

          <EvidenceMetric
            icon="🚑"
            value={
              paramedicCount
            }
            label="Paramedic"
            active={
              paramedicCount > 0
            }
          />

          <EvidenceMetric
            icon="🎯"
            value={
              currentPlan
                ? "✓"
                : "—"
            }
            label="Current Plan"
            active={
              Boolean(
                currentPlan
              )
            }
          />

          <EvidenceMetric
            icon="📚"
            value={
              allArticles.length
            }
            label="Knowledge Sources"
            active={
              allArticles.length >
              0
            }
          />

        </div>


        <div
          style={{
            marginTop: 16,
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 12,
            flexWrap:
              "wrap",
          }}
        >

          <div
            style={{
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            {sessionsLoading
              ? "Loading participant evidence..."
              : `${sessions.length} shared participant record${
                  sessions.length === 1
                    ? ""
                    : "s"
                } available for analysis.`}
          </div>


          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              void refreshParticipantEvidence()
            }
            disabled={
              sessionsLoading
            }
          >
            {sessionsLoading
              ? "Refreshing..."
              : "↻ Refresh Evidence"}
          </button>

        </div>


        {/* OPTIONAL MANUAL EVIDENCE */}

        <div
          style={{
            marginTop: 18,
            borderTop:
              "1px solid #e5e7eb",
            paddingTop: 16,
          }}
        >

          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems:
                "center",
              fontSize: 13,
              fontWeight: 700,
            }}
          >

            <input
              type="checkbox"
              checked={
                includeManualEvidence
              }
              onChange={(event) =>
                setIncludeManualEvidence(
                  event.target.checked
                )
              }
            />

            Add supplementary evidence manually

          </label>


          {includeManualEvidence ? (

            <textarea
              className="textarea"
              rows={5}
              value={
                manualEvidence
              }
              onChange={(event) =>
                setManualEvidence(
                  event.target.value
                )
              }
              placeholder="Paste additional participant evidence that is not yet stored in Theraa Nurse..."
              style={{
                marginTop: 10,
              }}
            />

          ) : null}

        </div>


        {/* ANALYSE BUTTON */}

        <button
          type="button"
          className="btn-primary btn-wide"
          onClick={() =>
            void analyseParticipant()
          }
          disabled={
            analysing ||
            sessionsLoading ||
            !selectedParticipant
          }
          style={{
            marginTop: 18,
            fontSize: 15,
            minHeight: 48,
          }}
        >
          {analysing
            ? "🧠 Theraa Nurse is Analysing Participant Evidence..."
            : "🧠 Analyse Participant Evidence"}
        </button>

      </div>


      {/* ===================================================
          AI OUTPUT
      =================================================== */}

      {analysisError ? (
        <div
          className="auth-error"
          style={{
            marginBottom: 16,
          }}
        >
          {analysisError}
        </div>
      ) : null}


      {aiResult ? (

        <div
          className="card premium-card"
          style={{
            marginBottom: 16,
            border:
              "1px solid #bfdbfe",
          }}
        >

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: 14,
              flexWrap:
                "wrap",
            }}
          >

            <div>

              <div className="eyebrow">
                Theraa Nurse AI
              </div>

              <div
                className="card-title"
                style={{
                  fontSize: 22,
                }}
              >
                Participant Intelligence Analysis
              </div>

              <div className="card-subtitle">
                AI-assisted reasoning from authorised
                participant evidence and available
                organisational knowledge.
              </div>

            </div>


            <div
              style={{
                padding:
                  "8px 12px",
                borderRadius:
                  999,
                background:
                  "#ecfdf5",
                color:
                  "#047857",
                fontSize:
                  11,
                fontWeight:
                  800,
              }}
            >
              PROFESSIONAL REVIEW REQUIRED
            </div>

          </div>


          {analysisMeta ? (

            <div
              style={{
                display: "flex",
                gap: 14,
                flexWrap:
                  "wrap",
                marginTop: 16,
                fontSize: 11,
                color: "#6b7280",
              }}
            >

              <span>
                Participant:{" "}
                <strong>
                  {
                    analysisMeta.participantName
                  }
                </strong>
              </span>

              <span>
                Evidence records:{" "}
                <strong>
                  {
                    analysisMeta.sessionCount
                  }
                </strong>
              </span>

              <span>
                Knowledge sources:{" "}
                <strong>
                  {
                    analysisMeta.knowledgeCount
                  }
                </strong>
              </span>

              <span>
                Care plan:{" "}
                <strong>
                  {analysisMeta.carePlanAvailable
                    ? "Available"
                    : "Not available"}
                </strong>
              </span>

            </div>

          ) : null}


          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 14,
              background:
                "#f8fafc",
              border:
                "1px solid #e2e8f0",
            }}
          >

            <pre
              style={{
                whiteSpace:
                  "pre-wrap",
                wordBreak:
                  "break-word",
                fontFamily:
                  "inherit",
                margin: 0,
                fontSize: 13,
                lineHeight: 1.65,
                color:
                  "#1f2937",
              }}
            >
              {aiResult}
            </pre>

          </div>


          <div
            style={{
              marginTop: 16,
              padding: 14,
              background:
                "#fffbeb",
              border:
                "1px solid #fde68a",
              borderRadius: 12,
              fontSize: 12,
              lineHeight: 1.55,
            }}
          >
            <strong>
              Professional oversight:
            </strong>{" "}
            Theraa Nurse provides decision support.
            AI output must be reviewed against the
            participant's current plan, authorised
            records, professional scope and workplace
            procedures before changes are made.
          </div>

        </div>

      ) : null}


      {/* ===================================================
          KNOWLEDGE LIBRARY MANAGEMENT
      =================================================== */}

      <div className="two-column">

        {/* ADD KNOWLEDGE */}

        <div className="card premium-card">

          <div className="card-title">
            Add Knowledge
          </div>

          <div className="card-subtitle">
            Upload organisation-wide care knowledge,
            provider policies, training resources,
            NDIS guidance or practice frameworks.
          </div>


          <div className="knowledge-form-grid">

            <label>

              <span>
                Title
              </span>

              <input
                className="input"
                value={
                  form.title
                }
                onChange={(event) =>
                  updateField(
                    "title",
                    event.target.value
                  )
                }
                placeholder="e.g. CHCLEG001 Work Legally and Ethically"
              />

            </label>


            <label>

              <span>
                Category
              </span>

              <select
                className="input"
                value={
                  form.category
                }
                onChange={(event) =>
                  updateField(
                    "category",
                    event.target.value
                  )
                }
              >

                <option>
                  NDIS Practice
                </option>

                <option>
                  Disability Support
                </option>

                <option>
                  Aged Care
                </option>

                <option>
                  WHS / Manual Handling
                </option>

                <option>
                  Infection Control
                </option>

                <option>
                  Palliative Care
                </option>

                <option>
                  Dementia Support
                </option>

                <option>
                  Psychosocial Recovery
                </option>

                <option>
                  Restrictive Practices
                </option>

                <option>
                  Documentation Standards
                </option>

                <option>
                  Provider Policies
                </option>

                <option>
                  Training Resources
                </option>

                <option>
                  General
                </option>

              </select>

            </label>


            <label className="form-wide">

              <span>
                Source
              </span>

              <input
                className="input"
                value={
                  form.source
                }
                onChange={(event) =>
                  updateField(
                    "source",
                    event.target.value
                  )
                }
                placeholder="e.g. Class PDF, NDIS guide, internal policy"
              />

            </label>


            <label className="form-wide">

              <span>
                Upload PDF or Text File
              </span>

              <input
                ref={
                  fileInputRef
                }
                className="input"
                type="file"
                accept={
                  ACCEPTED_FILE_TYPES
                }
                disabled={
                  isExtracting
                }
                onChange={(event) =>
                  void handleFileUpload(
                    event.target.files?.[
                      0
                    ]
                  )
                }
              />

              <small>
                Supports text-based PDFs and text
                documents. Scanned PDFs will require
                OCR.
              </small>

            </label>


            {isExtracting ? (

              <div className="form-wide evidence-processing">

                <span className="evidence-processing-spinner" />

                Extracting document text...

              </div>

            ) : null}


            {form.extractionMessage ? (

              <div className="form-wide evidence-status-row">

                <span className="evidence-status-pill">
                  {
                    form.extractionMessage
                  }
                </span>

                {form.size ? (
                  <span>
                    {formatFileSize(
                      form.size
                    )}
                  </span>
                ) : null}

              </div>

            ) : null}


            <label className="form-wide">

              <span>
                Knowledge Content
              </span>

              <textarea
                className="textarea knowledge-textarea"
                value={
                  form.content
                }
                onChange={(event) =>
                  updateField(
                    "content",
                    event.target.value
                  )
                }
                placeholder="Extracted PDF text or manually pasted knowledge appears here..."
              />

            </label>

          </div>


          <button
            type="button"
            className="btn-primary btn-wide"
            onClick={
              handleSave
            }
            disabled={
              isExtracting ||
              !form.content.trim()
            }
          >
            Save to Knowledge Library
          </button>

        </div>


        {/* KNOWLEDGE REPOSITORY */}

        <div className="card premium-card">

          <div className="card-title">
            Knowledge Available to the Engine
          </div>

          <div className="card-subtitle">
            These resources are available to support
            Theraa Nurse participant intelligence.
          </div>


          <input
            className="input"
            value={
              query
            }
            onChange={(event) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Search knowledge..."
            style={{
              margin:
                "12px 0",
            }}
          />


          {articles.length ===
          0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                🧠
              </div>

              <div>
                No knowledge documents found.
              </div>

              <small>
                Add your first knowledge document.
              </small>

            </div>

          ) : (

            <div className="knowledge-list">

              {articles.map(
                (item) => (

                  <div
                    key={
                      item.id
                    }
                    className="knowledge-card"
                  >

                    <div>

                      <div className="knowledge-card-title">
                        {item.title}
                      </div>


                      <div className="knowledge-card-meta">
                        {item.category} ·{" "}
                        {item.source ||
                          "No source"}
                      </div>


                      {item.fileExtension ===
                      ".pdf" ? (

                        <div className="evidence-status-row">

                          <span className="evidence-status-pill">
                            PDF extracted
                          </span>

                          {item.pageCount ? (

                            <span>
                              {
                                item.pageCount
                              }{" "}
                              page
                              {item.pageCount ===
                              1
                                ? ""
                                : "s"}
                            </span>

                          ) : null}

                        </div>

                      ) : null}


                      <p>
                        {String(
                          item.content ||
                            ""
                        ).slice(
                          0,
                          180
                        )}

                        {String(
                          item.content ||
                            ""
                        ).length >
                        180
                          ? "..."
                          : ""}
                      </p>

                    </div>


                    <button
                      type="button"
                      className="btn-danger-soft"
                      onClick={() =>
                        handleDelete(
                          item.id
                        )
                      }
                    >
                      Delete
                    </button>

                  </div>

                )
              )}

            </div>

          )}

        </div>

      </div>


      {/* ===================================================
          EVIDENCE / KNOWLEDGE TRANSPARENCY
      =================================================== */}

      <div
        className="two-column"
        style={{
          marginTop: 16,
        }}
      >

        <div className="card premium-card">

          <div className="card-title">
            Evidence Available to AI
          </div>

          <div className="card-subtitle">
            Preview the participant information that
            will be supplied to the intelligence
            engine.
          </div>


          <textarea
            className="textarea knowledge-textarea"
            rows={14}
            readOnly
            value={
              combinedEvidence ||
              "No participant evidence available."
            }
          />

        </div>


        <div className="card premium-card">

          <div className="card-title">
            Knowledge Retrieved
          </div>

          <div className="card-subtitle">
            Organisation knowledge selected as
            context for participant analysis.
          </div>


          <textarea
            className="textarea knowledge-textarea"
            rows={14}
            readOnly
            value={
              relevantKnowledge ||
              "No matching knowledge was retrieved."
            }
          />

        </div>

      </div>

    </div>
  );
}