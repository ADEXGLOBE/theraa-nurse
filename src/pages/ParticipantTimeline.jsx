// src/pages/ParticipantTimeline.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../context/AuthContext";
import { useActiveClient } from "../context/ActiveClientContext";
import { useWorkspace } from "../context/WorkspaceContext";

import { listDocumentsForClient } from "../features/documents/documentService";
import { loadCarePlanVersions } from "../data/carePlanStore";

import {
  loadParticipantSessions,
} from "../services/sessionService";


/* =========================================================
   HELPERS
========================================================= */

function safe(value) {
  return value == null ? "" : String(value);
}


function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}


function formatDate(value) {
  if (!value) return "Unknown date";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }

    return date.toLocaleString();
  } catch {
    return "Unknown date";
  }
}


function getEventTimestamp(item) {
  return (
    item?.timestamp ||
    item?.createdAt ||
    item?.created_at ||
    item?.date ||
    null
  );
}


function getZoneDetails(zone) {
  switch (zone) {
    case "therapy":
      return {
        icon: "🧠",
        label: "Therapy",
        className: "therapy",
      };

    case "meds":
      return {
        icon: "💊",
        label: "Medication",
        className: "medication",
      };

    case "staff":
      return {
        icon: "📝",
        label: "Staff Note",
        className: "staff",
      };

    case "paramedic":
      return {
        icon: "🚑",
        label: "Paramedic",
        className: "paramedic",
      };

    case "vpn":
      return {
        icon: "🔐",
        label: "Remote Support",
        className: "remote",
      };

    default:
      return {
        icon: "📋",
        label: zone
          ? safe(zone)
              .replace(/_/g, " ")
              .replace(/\b\w/g, (letter) => letter.toUpperCase())
          : "Session",
        className: "general",
      };
  }
}


function getMedicationSummary(session) {
  const medications = asArray(session?.medications);

  if (!medications.length) {
    return session?.notes || "Medication support check recorded.";
  }

  const summary = medications
    .filter((medication) => medication?.name)
    .slice(0, 4)
    .map((medication) => {
      const dose = medication?.dose
        ? ` ${medication.dose}`
        : "";

      const status = medication?.status
        ? ` — ${medication.status}`
        : "";

      return `${medication.name}${dose}${status}`;
    });

  return summary.join(" • ");
}


function getTherapySummary(session) {
  const parts = [];

  if (session?.sessionType) {
    parts.push(session.sessionType);
  }

  if (session?.mood) {
    parts.push(`Mood: ${session.mood}`);
  }

  if (session?.engagement) {
    parts.push(`Engagement: ${session.engagement}`);
  }

  if (session?.notes) {
    parts.push(session.notes);
  }

  return parts.length
    ? parts.join(" • ")
    : "Therapy or support session recorded.";
}


function getStaffSummary(session) {
  const parts = [];

  if (session?.notes) {
    parts.push(session.notes);
  }

  if (session?.safeguardingConcern) {
    parts.push("Safeguarding concern raised");
  }

  const completedTasks = Object.entries(session?.tasks || {})
    .filter(([, value]) => Boolean(value))
    .length;

  if (completedTasks) {
    parts.push(`${completedTasks} shift check(s) completed`);
  }

  return parts.length
    ? parts.join(" • ")
    : "Staff support entry recorded.";
}


function getParamedicSummary(session) {
  const parts = [];

  if (session?.reason) {
    parts.push(session.reason);
  }

  if (session?.assessment) {
    parts.push(session.assessment);
  }

  if (session?.outcome) {
    parts.push(`Outcome: ${session.outcome}`);
  }

  if (session?.notes) {
    parts.push(session.notes);
  }

  return parts.length
    ? parts.join(" • ")
    : "Paramedic or urgent health support entry recorded.";
}


function getRemoteSummary(session) {
  return (
    session?.notes ||
    session?.summary ||
    "Remote support activity recorded."
  );
}


function getSessionDescription(session) {
  switch (session?.zone) {
    case "meds":
      return getMedicationSummary(session);

    case "therapy":
      return getTherapySummary(session);

    case "staff":
      return getStaffSummary(session);

    case "paramedic":
      return getParamedicSummary(session);

    case "vpn":
      return getRemoteSummary(session);

    default:
      return (
        session?.notes ||
        session?.summary ||
        "Participant support activity recorded."
      );
  }
}


function getSessionFlags(session) {
  const flags = [];

  if (
    session?.followUpRequired ||
    session?.followUp
  ) {
    flags.push({
      label: "Follow-up",
      level: "warning",
    });
  }

  if (session?.safeguardingConcern) {
    flags.push({
      label: "Safeguarding",
      level: "danger",
    });
  }

  const medicationIssues = asArray(session?.medications).filter(
    (medication) =>
      ["Refused", "Missed", "Withheld"].includes(
        medication?.status
      )
  );

  if (medicationIssues.length) {
    flags.push({
      label: `${medicationIssues.length} medication issue${
        medicationIssues.length === 1 ? "" : "s"
      }`,
      level: "danger",
    });
  }

  return flags;
}


/* =========================================================
   UI COMPONENTS
========================================================= */

function TimelineBadge({
  children,
  level = "neutral",
}) {
  return (
    <span
      className={`timeline-badge-pro timeline-badge-${level}`}
    >
      {children}
    </span>
  );
}


function TimelineItem({
  item,
  currentUserId,
}) {
  return (
    <div
      className={`timeline-item-pro timeline-item-${item.className || "general"}`}
    >
      <div className="timeline-dot-pro">
        {item.icon}
      </div>

      <div className="timeline-content-pro">
        <div className="timeline-item-header-pro">
          <div>
            <div className="timeline-title-pro">
              {item.title}
            </div>

            <div className="timeline-meta-pro">
              {formatDate(item.date)}
            </div>
          </div>

          <TimelineBadge>
            {item.category}
          </TimelineBadge>
        </div>

        <p>{item.description}</p>

        {item.flags?.length ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 8,
            }}
          >
            {item.flags.map((flag, index) => (
              <TimelineBadge
                key={`${flag.label}-${index}`}
                level={flag.level}
              >
                {flag.label}
              </TimelineBadge>
            ))}
          </div>
        ) : null}

        {item.createdBy ? (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            Recorded by:{" "}
            <strong>
              {item.createdBy === currentUserId
                ? "You"
                : "Authorised team member"}
            </strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function MetricCard({
  icon,
  value,
  label,
}) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        minHeight: 115,
      }}
    >
      <div
        style={{
          fontSize: 22,
          marginBottom: 8,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}


/* =========================================================
   MAIN PAGE
========================================================= */

export default function ParticipantTimeline() {
  const { user } = useAuth();

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

  const fallbackId = clients[0]?.id || "";

  const [
    selectedClientId,
    setSelectedClientId,
  ] = useState(
    activeClientId || fallbackId
  );

  const [
    documents,
    setDocuments,
  ] = useState([]);

  const [
    sharedSessions,
    setSharedSessions,
  ] = useState([]);

  const [
    loadingSessions,
    setLoadingSessions,
  ] = useState(false);

  const [
    loadingDocuments,
    setLoadingDocuments,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState("all");


  /* =========================================================
     PARTICIPANT SELECTION
  ========================================================= */

  useEffect(() => {
    if (
      activeClientId &&
      activeClientId !== selectedClientId
    ) {
      setSelectedClientId(activeClientId);
    }
  }, [
    activeClientId,
    selectedClientId,
  ]);


  useEffect(() => {
    if (
      !selectedClientId &&
      fallbackId
    ) {
      setSelectedClientId(fallbackId);
    }
  }, [
    fallbackId,
    selectedClientId,
  ]);


  useEffect(() => {
    if (
      selectedClientId &&
      selectedClientId !== activeClientId
    ) {
      setActiveClientId(selectedClientId);
    }
  }, [
    selectedClientId,
    activeClientId,
    setActiveClientId,
  ]);


  const selectedClient = useMemo(
    () =>
      clients.find(
        (client) =>
          client.id === selectedClientId
      ) || null,
    [
      clients,
      selectedClientId,
    ]
  );


  /* =========================================================
     SHARED SUPABASE SESSIONS
  ========================================================= */

  const refreshSessions = useCallback(
    async () => {
      if (
        !organisationId ||
        !selectedClientId
      ) {
        setSharedSessions([]);
        return;
      }

      setLoadingSessions(true);
      setErrorMessage("");

      try {
        const sessions =
          await loadParticipantSessions({
            organisationId,
            participantId: selectedClientId,
          });

        setSharedSessions(
          Array.isArray(sessions)
            ? sessions
            : []
        );
      } catch (error) {
        console.error(
          "Unable to load participant timeline sessions:",
          error
        );

        setSharedSessions([]);

        setErrorMessage(
          error?.message ||
            "Unable to load shared participant activity."
        );
      } finally {
        setLoadingSessions(false);
      }
    },
    [
      organisationId,
      selectedClientId,
    ]
  );


  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);


  /* =========================================================
     DOCUMENTS

     Documents remain on the existing document architecture
     for now. They can be migrated to the organisation-wide
     Supabase architecture separately.
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadDocs() {
      if (!selectedClientId) {
        setDocuments([]);
        return;
      }

      setLoadingDocuments(true);

      try {
        const docs =
          await listDocumentsForClient(
            selectedClientId
          );

        if (!cancelled) {
          setDocuments(
            Array.isArray(docs)
              ? docs
              : []
          );
        }
      } catch (error) {
        console.error(
          "Unable to load participant documents:",
          error
        );

        if (!cancelled) {
          setDocuments([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingDocuments(false);
        }
      }
    }

    void loadDocs();

    return () => {
      cancelled = true;
    };
  }, [selectedClientId]);


  /* =========================================================
     CARE PLAN

     Care plans remain on the current carePlanStore until
     the shared Care Plan V3 migration.
  ========================================================= */

  const carePlans = useMemo(() => {
    if (
      !selectedClientId ||
      !user?.id
    ) {
      return [];
    }

    try {
      return (
        loadCarePlanVersions(
          selectedClientId,
          user.id
        ) || []
      );
    } catch (error) {
      console.warn(
        "Unable to load care plans for timeline:",
        error
      );

      return [];
    }
  }, [
    selectedClientId,
    user?.id,
  ]);


  /* =========================================================
     BUILD TIMELINE
  ========================================================= */

  const timeline = useMemo(() => {
    if (!selectedClient) {
      return [];
    }


    const documentEvents =
      documents.map((doc) => ({
        id:
          doc.id ||
          `document-${doc.createdAt}`,

        type: "document",

        category: "Document",

        className: "document",

        icon: "📄",

        title:
          doc.name ||
          doc.filename ||
          doc.title ||
          "Document uploaded",

        description:
          "Participant evidence was added to the participant record.",

        date:
          doc.createdAt ||
          doc.created_at ||
          doc.uploadedAt,

        flags: [],
      }));


    const sessionEvents =
      sharedSessions.map(
        (session, index) => {
          const zone =
            getZoneDetails(
              session?.zone
            );

          return {
            id:
              session?.id ||
              `session-${index}`,

            type:
              session?.zone ||
              "session",

            category:
              zone.label,

            className:
              zone.className,

            icon:
              zone.icon,

            title:
              `${zone.label} entry`,

            description:
              getSessionDescription(
                session
              ),

            date:
              getEventTimestamp(
                session
              ),

            createdBy:
              session?.createdBy ||
              session?.created_by ||
              null,

            flags:
              getSessionFlags(
                session
              ),
          };
        }
      );


    const planEvents =
      carePlans.map(
        (version, index) => ({
          id:
            version.id ||
            `careplan-${index}`,

          type: "careplan",

          category: "Care Plan",

          className: "careplan",

          icon:
            version.status ===
            "reviewed"
              ? "✅"
              : "🎯",

          title:
            version.status ===
            "reviewed"
              ? "Care plan reviewed"
              : "Care plan version saved",

          description:
            version.status ===
            "reviewed"
              ? "A purpose-centred care plan review was recorded."
              : "A purpose-centred care plan version was saved.",

          date:
            version.createdAt,

          flags:
            version.status
              ? [
                  {
                    label:
                      version.status,
                    level:
                      version.status ===
                      "reviewed"
                        ? "good"
                        : "neutral",
                  },
                ]
              : [],
        })
      );


    return [
      ...documentEvents,
      ...sessionEvents,
      ...planEvents,
    ].sort(
      (a, b) =>
        new Date(
          b.date || 0
        ).getTime() -
        new Date(
          a.date || 0
        ).getTime()
    );
  }, [
    selectedClient,
    documents,
    sharedSessions,
    carePlans,
  ]);


  /* =========================================================
     COUNTS
  ========================================================= */

  const counts = useMemo(() => {
    return {
      total:
        timeline.length,

      therapy:
        sharedSessions.filter(
          (session) =>
            session.zone ===
            "therapy"
        ).length,

      medication:
        sharedSessions.filter(
          (session) =>
            session.zone ===
            "meds"
        ).length,

      staff:
        sharedSessions.filter(
          (session) =>
            session.zone ===
            "staff"
        ).length,

      paramedic:
        sharedSessions.filter(
          (session) =>
            session.zone ===
            "paramedic"
        ).length,

      documents:
        documents.length,

      carePlans:
        carePlans.length,
    };
  }, [
    timeline,
    sharedSessions,
    documents,
    carePlans,
  ]);


  /* =========================================================
     FILTERING
  ========================================================= */

  const filteredTimeline =
    useMemo(() => {
      if (filter === "all") {
        return timeline;
      }

      return timeline.filter(
        (item) =>
          item.type === filter
      );
    }, [
      timeline,
      filter,
    ]);


  const filters = [
    {
      value: "all",
      label: "All Activity",
      count: counts.total,
    },

    {
      value: "therapy",
      label: "Therapy",
      count: counts.therapy,
    },

    {
      value: "meds",
      label: "Medication",
      count: counts.medication,
    },

    {
      value: "staff",
      label: "Staff",
      count: counts.staff,
    },

    {
      value: "paramedic",
      label: "Paramedic",
      count: counts.paramedic,
    },

    {
      value: "document",
      label: "Documents",
      count: counts.documents,
    },

    {
      value: "careplan",
      label: "Care Plans",
      count: counts.carePlans,
    },
  ];


  /* =========================================================
     LOADING / EMPTY ACCESS
  ========================================================= */

  if (!clientsReady) {
    return (
      <div className="zone-page timeline-page-pro">
        <div className="card premium-card">
          <div className="card-title">
            Participant Timeline
          </div>

          <div className="card-subtitle">
            Loading authorised participants...
          </div>
        </div>
      </div>
    );
  }


  if (!clients.length) {
    return (
      <div className="zone-page timeline-page-pro">
        <div className="card premium-card">
          <div className="empty-state">
            <div className="empty-icon">
              👥
            </div>

            <div>
              No participant access
            </div>

            <small>
              Ask your manager or coordinator to
              assign you to a participant.
            </small>
          </div>
        </div>
      </div>
    );
  }


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="zone-page timeline-page-pro">

      <div className="timeline-hero-pro">

        <div>

          <div className="eyebrow">
            Shared Participant Story
          </div>

          <h1>
            Intelligence Timeline
          </h1>

          <p>
            View authorised participant support
            activity across Therapy, Medication,
            Staff Notes, Paramedic, documents and
            care planning in one chronological
            record.
          </p>

          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            Workspace:{" "}
            <strong>
              {organisationName ||
                "Provider workspace"}
            </strong>

            {" · "}

            Signed in as:{" "}
            <strong>
              {roleLabel ||
                "Workspace member"}
            </strong>
          </div>

        </div>


        <div className="timeline-stat-card-pro">

          <div className="timeline-stat-number-pro">
            {timeline.length}
          </div>

          <div className="timeline-stat-label-pro">
            Timeline Events
          </div>

          <small>
            {selectedClient?.name ||
              "No participant selected"}
          </small>

        </div>

      </div>


      {errorMessage ? (
        <div
          className="auth-error"
          style={{
            marginBottom: 16,
          }}
        >
          {errorMessage}
        </div>
      ) : null}


      <div className="card premium-card">

        <div className="card-title">
          Select Participant
        </div>

        <div className="card-subtitle">
          The timeline only displays participants
          you are authorised to access.
        </div>

        <select
          className="input"
          value={
            selectedClientId
          }
          onChange={(event) =>
            setSelectedClientId(
              event.target.value
            )
          }
        >

          {clients.map(
            (client) => (
              <option
                key={
                  client.id
                }
                value={
                  client.id
                }
              >
                {client.name}

                {client.age
                  ? ` (${client.age})`
                  : ""}
              </option>
            )
          )}

        </select>

      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(145px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >

        <MetricCard
          icon="🧠"
          value={
            counts.therapy
          }
          label="Therapy Entries"
        />


        <MetricCard
          icon="💊"
          value={
            counts.medication
          }
          label="Medication Checks"
        />


        <MetricCard
          icon="📝"
          value={
            counts.staff
          }
          label="Staff Notes"
        />


        <MetricCard
          icon="🚑"
          value={
            counts.paramedic
          }
          label="Paramedic Entries"
        />


        <MetricCard
          icon="📄"
          value={
            counts.documents
          }
          label="Documents"
        />


        <MetricCard
          icon="🎯"
          value={
            counts.carePlans
          }
          label="Care Plans"
        />

      </div>


      <div
        className="card premium-card"
        style={{
          marginTop: 16,
        }}
      >

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >

          <div>

            <div className="card-title">
              Shared Participant Timeline
            </div>

            <div className="card-subtitle">
              A chronological view of authorised
              activity across the participant's
              care team.
            </div>

          </div>


          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              void refreshSessions()
            }
            disabled={
              loadingSessions
            }
          >
            {loadingSessions
              ? "Refreshing…"
              : "↻ Refresh Timeline"}
          </button>

        </div>


        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 18,
            marginBottom: 20,
          }}
        >

          {filters.map(
            (item) => (

              <button
                key={
                  item.value
                }
                type="button"
                onClick={() =>
                  setFilter(
                    item.value
                  )
                }
                style={{
                  border:
                    filter ===
                    item.value
                      ? "1px solid #111827"
                      : "1px solid #d1d5db",

                  background:
                    filter ===
                    item.value
                      ? "#111827"
                      : "#ffffff",

                  color:
                    filter ===
                    item.value
                      ? "#ffffff"
                      : "#374151",

                  borderRadius:
                    999,

                  padding:
                    "7px 12px",

                  fontSize:
                    12,

                  fontWeight:
                    700,

                  cursor:
                    "pointer",
                }}
              >

                {item.label}{" "}
                ({item.count})

              </button>

            )
          )}

        </div>


        {loadingSessions ||
        loadingDocuments ? (

          <div className="empty-state">

            <div className="empty-icon">
              ⏳
            </div>

            <div>
              Loading participant story...
            </div>

            <small>
              Retrieving authorised shared
              participant activity.
            </small>

          </div>

        ) : filteredTimeline.length ===
          0 ? (

          <div className="empty-state">

            <div className="empty-icon">
              🕒
            </div>

            <div>
              No timeline events found.
            </div>

            <small>
              No activity is available for this
              participant and filter yet.
            </small>

          </div>

        ) : (

          <div className="timeline-list-pro">

            {filteredTimeline.map(
              (item) => (

                <TimelineItem
                  key={
                    item.id
                  }
                  item={
                    item
                  }
                  currentUserId={
                    user?.id
                  }
                />

              )
            )}

          </div>

        )}

      </div>

    </div>
  );
}