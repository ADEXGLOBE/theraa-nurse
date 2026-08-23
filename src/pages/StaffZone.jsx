// src/pages/StaffZone.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  loadCurrentSharedCarePlan,
} from "../services/carePlanService";

import {
  useActiveClient,
} from "../context/ActiveClientContext";

import {
  useAuth,
} from "../context/AuthContext";

import {
  useWorkspace,
} from "../context/WorkspaceContext";

import {
  createParticipantSession,
  deleteParticipantSession,
  loadParticipantSessions,
} from "../services/sessionService";

const MOOD_OPTIONS = [
  "Calm",
  "Content",
  "Happy",
  "Flat",
  "Sad",
  "Anxious",
  "Irritable",
  "Agitated",
  "Withdrawn",
];

const ENGAGEMENT_OPTIONS = [
  "Highly engaged",
  "Engaged",
  "Partially engaged",
  "Minimal engagement",
  "Declined support",
  "Not assessed",
];

const SUPPORT_AREAS = [
  "Personal care",
  "Meal preparation",
  "Medication prompting",
  "Community access",
  "Domestic assistance",
  "Transport",
  "Communication support",
  "Emotional support",
  "Behaviour support",
  "Mobility assistance",
  "Appointment support",
  "Skill development",
];

const OUTCOME_OPTIONS = [
  "Goal progressed",
  "Goal maintained",
  "No material change",
  "Barrier identified",
  "Support declined",
  "Further review required",
];

const ESCALATION_LEVELS = [
  "No escalation required",
  "Monitor and document",
  "Notify coordinator",
  "Notify supervisor",
  "Clinical review required",
  "Urgent escalation",
];

const INITIAL_TASKS = {
  reviewedHistory: false,
  checkedEnvironment: false,
  checkedAssistiveTech: false,
  escalationPlanKnown: false,
  confirmedConsent: false,
  reviewedGoals: false,
};

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

function formatDateTime(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}

function daysAgo(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() -
        date.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );
}

function getStaffSessions(
  allSessions,
  clientId
) {
  return asArray(
    allSessions?.[clientId]
  ).filter(
    (session) =>
      session?.zone === "staff"
  );
}

function getCrossZoneSessions(
  allSessions,
  clientId
) {
  return asArray(
    allSessions?.[clientId]
  ).filter((session) =>
    [
      "therapy",
      "meds",
      "paramedic",
      "staff",
      "vpn",
    ].includes(session?.zone)
  );
}

function getEscalationLevel(value) {
  if (
    value ===
      "Urgent escalation" ||
    value ===
      "Clinical review required"
  ) {
    return "danger";
  }

  if (
    value ===
      "Notify coordinator" ||
    value ===
      "Notify supervisor" ||
    value ===
      "Monitor and document"
  ) {
    return "warning";
  }

  return "good";
}

function StaffMetric({
  icon,
  label,
  value,
  detail,
  level = "neutral",
}) {
  return (
    <article
      className={`staff-metric staff-metric-${level}`}
    >
      <div className="staff-metric-icon">
        {icon}
      </div>

      <div className="staff-metric-value">
        {value}
      </div>

      <div className="staff-metric-label">
        {label}
      </div>

      {detail ? (
        <div className="staff-metric-detail">
          {detail}
        </div>
      ) : null}
    </article>
  );
}

function StaffCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}) {
  return (
    <section
      className={`card staff-v2-card ${className}`}
    >
      <div className="staff-card-header">
        <div>
          <div className="card-title">
            {title}
          </div>

          {subtitle ? (
            <div className="card-subtitle">
              {subtitle}
            </div>
          ) : null}
        </div>

        {right ? (
          <div>{right}</div>
        ) : null}
      </div>

      <div className="staff-card-body">
        {children}
      </div>
    </section>
  );
}

function StatusBadge({
  level = "neutral",
  children,
}) {
  return (
    <span
      className={`staff-status staff-status-${level}`}
    >
      {children}
    </span>
  );
}

function EmptyState({
  icon = "📝",
  title,
  description,
}) {
  return (
    <div className="staff-empty-state">
      <div className="staff-empty-icon">
        {icon}
      </div>

      <strong>{title}</strong>

      <span>{description}</span>
    </div>
  );
}

export default function StaffZone() {
  const { user } = useAuth();

  const {
    organisationId,
    organisationName,
    role,
    roleLabel,
  } = useWorkspace();

  const {
    clients,
    activeClientId,
    setActiveClientId,
    clientsReady,
  } = useActiveClient();

  const fallbackId =
    clients[0]?.id || "";

  /*
   * V3 participant-selection rule:
   * ActiveClientContext is the single source of truth.
   *
   * Do not keep a second selectedClientId state here.
   * Doing so creates a two-way synchronisation loop when
   * switching participants across Theraa Nurse.
   */
  const selectedClientId =
    activeClientId || fallbackId;

  /*
   * Each participant-history request receives a sequence
   * number. If an older request resolves after the user has
   * already selected somebody else, its result is ignored.
   */
  const sessionRequestRef =
    useRef(0);

  const carePlanRequestRef =
    useRef(0);

  const [
    allSessions,
    setAllSessions,
  ] = useState({});

  const [
    sessionsLoading,
    setSessionsLoading,
  ] = useState(false);

  const [
    sessionError,
    setSessionError,
  ] = useState("");

  const [
    carePlan,
    setCarePlan,
  ] = useState(null);

  const [
    carePlanLoading,
    setCarePlanLoading,
  ] = useState(false);

  const [
    carePlanError,
    setCarePlanError,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [
    deletingSessionId,
    setDeletingSessionId,
  ] = useState("");

  const [tasks, setTasks] =
    useState(INITIAL_TASKS);

  const [shiftType, setShiftType] =
    useState("Day shift");

  const [mood, setMood] =
    useState("");

  const [
    engagement,
    setEngagement,
  ] = useState("");

  const [
    supportAreas,
    setSupportAreas,
  ] = useState([]);

  const [
    observations,
    setObservations,
  ] = useState("");

  const [
    actionsTaken,
    setActionsTaken,
  ] = useState("");

  const [
    participantResponse,
    setParticipantResponse,
  ] = useState("");

  const [outcome, setOutcome] =
    useState("");

  const [
    goalProgress,
    setGoalProgress,
  ] = useState("");

  const [handover, setHandover] =
    useState("");

  const [
    escalationLevel,
    setEscalationLevel,
  ] = useState(
    "No escalation required"
  );

  const [
    escalationNotes,
    setEscalationNotes,
  ] = useState("");

  const [
    safeguardingConcern,
    setSafeguardingConcern,
  ] = useState(false);

  const [
    safeguardingNotes,
    setSafeguardingNotes,
  ] = useState("");

  /*
   * Provider Admin / Manager can remove
   * any session that RLS permits.
   *
   * Other users only receive a delete
   * button for entries they authored.
   */
  const canManageAllSessions = [
    "provider_admin",
    "manager",
  ].includes(role);

  /*
   * Initialise the global active participant only when no
   * participant is currently selected.
   */
  useEffect(() => {
    if (
      !activeClientId &&
      fallbackId
    ) {
      setActiveClientId(
        fallbackId
      );
    }
  }, [
    activeClientId,
    fallbackId,
    setActiveClientId,
  ]);

  /*
   * When the participant changes:
   * - invalidate any in-flight history request
   * - clear the old participant's visible history
   * - clear transient errors
   * - reset the unsaved Staff Note draft
   *
   * This prevents notes started for one participant from
   * being accidentally saved against another participant.
   */
  useEffect(() => {
    sessionRequestRef.current += 1;
    carePlanRequestRef.current += 1;

    setAllSessions({});
    setSessionError("");

    setCarePlan(null);
    setCarePlanError("");

    resetForm();
  }, [selectedClientId]);

  const refreshSessions =
    useCallback(async () => {
      const participantId =
        selectedClientId;

      if (
        !organisationId ||
        !participantId
      ) {
        setAllSessions({});
        setSessionsLoading(false);
        return;
      }

      const requestId =
        ++sessionRequestRef.current;

      setSessionsLoading(true);
      setSessionError("");

      try {
        const sessions =
          await loadParticipantSessions({
            organisationId,
            participantId,
          });

        /*
         * Ignore a late response belonging to a participant
         * who is no longer active.
         */
        if (
          requestId !==
          sessionRequestRef.current
        ) {
          return;
        }

        /*
         * Keep the old V2 map shape so existing reporting
         * and cross-zone calculations continue to work.
         */
        setAllSessions({
          [participantId]:
            sessions,
        });
      } catch (error) {
        /*
         * If the user has already moved to another
         * participant, do not surface an obsolete request
         * failure in the current participant's UI.
         */
        if (
          requestId !==
          sessionRequestRef.current
        ) {
          return;
        }

        console.error(
          "Unable to refresh Staff Notes:",
          error
        );

        setAllSessions({
          [participantId]: [],
        });

        setSessionError(
          error?.message ||
            "Unable to load shared participant sessions."
        );
      } finally {
        /*
         * Only the currently valid request is allowed to
         * control the loading indicator.
         */
        if (
          requestId ===
          sessionRequestRef.current
        ) {
          setSessionsLoading(false);
        }
      }
    }, [
      organisationId,
      selectedClientId,
    ]);

  /*
   * Fetch the active participant's shared history once per
   * participant/workspace change.
   */
  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  /*
   * Load the participant's current reviewed or approved
   * Purpose Plan from the shared Supabase workspace.
   *
   * The request guard prevents an older participant's plan
   * from appearing after a rapid participant switch.
   */
  const refreshCarePlan =
    useCallback(async () => {
      const participantId =
        selectedClientId;

      const requestId =
        ++carePlanRequestRef.current;

      if (
        !organisationId ||
        !participantId
      ) {
        if (
          requestId ===
          carePlanRequestRef.current
        ) {
          setCarePlan(null);
          setCarePlanLoading(false);
          setCarePlanError("");
        }

        return;
      }

      setCarePlanLoading(true);
      setCarePlanError("");

      try {
        const currentPlan =
          await loadCurrentSharedCarePlan({
            organisationId,
            participantId,
          });

        if (
          requestId !==
          carePlanRequestRef.current
        ) {
          return;
        }

        setCarePlan(
          currentPlan?.plan || null
        );
      } catch (error) {
        if (
          requestId !==
          carePlanRequestRef.current
        ) {
          return;
        }

        console.error(
          "Unable to load shared Staff Purpose Plan context:",
          error
        );

        setCarePlan(null);

        setCarePlanError(
          error?.message ||
            "Unable to load the participant Purpose Plan."
        );
      } finally {
        if (
          requestId ===
          carePlanRequestRef.current
        ) {
          setCarePlanLoading(false);
        }
      }
    }, [
      organisationId,
      selectedClientId,
    ]);

  useEffect(() => {
    void refreshCarePlan();
  }, [refreshCarePlan]);

  const selectedClient =
    useMemo(
      () =>
        clients.find(
          (client) =>
            client.id ===
            selectedClientId
        ) || null,
      [
        clients,
        selectedClientId,
      ]
    );

  const staffSessions =
    useMemo(
      () =>
        getStaffSessions(
          allSessions,
          selectedClientId
        ),
      [
        allSessions,
        selectedClientId,
      ]
    );

  const crossZoneSessions =
    useMemo(
      () =>
        getCrossZoneSessions(
          allSessions,
          selectedClientId
        ),
      [
        allSessions,
        selectedClientId,
      ]
    );

  const recentStaffSessions =
    staffSessions.slice(0, 8);

  const latestStaffEntry =
    staffSessions[0] || null;

  const latestEntryDays =
    daysAgo(
      latestStaffEntry?.timestamp ||
        latestStaffEntry?.createdAt
    );

  const safeguardingCount =
    staffSessions.filter(
      (session) =>
        session.safeguardingConcern
    ).length;

  const escalationCount =
    staffSessions.filter(
      (session) =>
        session.escalationLevel &&
        session.escalationLevel !==
          "No escalation required"
    ).length;

  const completedTaskCount =
    Object.values(tasks).filter(
      Boolean
    ).length;

  const planSections =
    carePlan?.sections || {};

  const currentGoals = [
    safe(
      planSections.goalsShort
    ),
    safe(
      planSections.goalsLong
    ),
  ]
    .filter((value) =>
      value.trim()
    )
    .join("\n\n");

  const communicationContext =
    safe(
      planSections.communication
    ).trim();

  const supportContext =
    safe(
      planSections.functionalNeeds
    ).trim();

  const riskContext =
    safe(
      planSections.risks ||
        carePlan?.risks
    ).trim();

  const behaviourContext =
    safe(
      planSections.behaviourSupport
    ).trim();

  function toggleTask(key) {
    setTasks((previous) => ({
      ...previous,
      [key]:
        !previous[key],
    }));
  }

  function toggleSupportArea(
    area
  ) {
    setSupportAreas(
      (previous) =>
        previous.includes(area)
          ? previous.filter(
              (item) =>
                item !== area
            )
          : [
              ...previous,
              area,
            ]
    );
  }

  function resetForm() {
    setTasks(INITIAL_TASKS);

    setShiftType(
      "Day shift"
    );

    setMood("");
    setEngagement("");
    setSupportAreas([]);

    setObservations("");
    setActionsTaken("");
    setParticipantResponse("");

    setOutcome("");
    setGoalProgress("");
    setHandover("");

    setEscalationLevel(
      "No escalation required"
    );

    setEscalationNotes("");

    setSafeguardingConcern(
      false
    );

    setSafeguardingNotes("");
  }

  async function handleSaveStaffEntry() {
    if (!selectedClientId) {
      alert(
        "Select a participant first."
      );

      return;
    }

    if (
      !organisationId
    ) {
      alert(
        "No provider workspace is active."
      );

      return;
    }

    if (
      !observations.trim() &&
      !actionsTaken.trim() &&
      !handover.trim() &&
      !safeguardingConcern
    ) {
      alert(
        "Please record an observation, action, handover note or safeguarding concern."
      );

      return;
    }

    if (
      safeguardingConcern &&
      !safeguardingNotes.trim()
    ) {
      alert(
        "Please describe the safeguarding concern and actions taken."
      );

      return;
    }

    const timestamp =
      new Date().toISOString();

    const payload = {
      timestamp,

      zone: "staff",

      shiftType,

      tasks: {
        ...tasks,
      },

      mood,
      engagement,

      supportAreas: [
        ...supportAreas,
      ],

      observations:
        observations.trim(),

      actionsTaken:
        actionsTaken.trim(),

      participantResponse:
        participantResponse.trim(),

      outcome,

      goalProgress:
        goalProgress.trim(),

      handover:
        handover.trim(),

      escalationLevel,

      escalationNotes:
        escalationNotes.trim(),

      safeguardingConcern,

      safeguardingNotes:
        safeguardingNotes.trim(),

      /*
       * Keep old reports compatible.
       */
      notes:
        observations.trim(),
    };

    setSaving(true);
    setSessionError("");

    try {
      await createParticipantSession({
        organisationId,

        participantId:
          selectedClientId,

        userId:
          user?.id,

        zone: "staff",

        sessionData:
          payload,
      });

      await refreshSessions();

      resetForm();

      alert(
        "Staff entry saved to the shared participant record."
      );
    } catch (error) {
      console.error(
        "Unable to save Staff Note:",
        error
      );

      setSessionError(
        error?.message ||
          "Staff entry could not be saved."
      );

      alert(
        error?.message ||
          "Staff entry could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry(
    entry
  ) {
    if (!entry?.id) {
      return;
    }

    const canDelete =
      canManageAllSessions ||
      entry.createdBy ===
        user?.id;

    if (!canDelete) {
      alert(
        "You cannot delete a staff entry created by another team member."
      );

      return;
    }

    if (
      !window.confirm(
        "Delete this staff entry?"
      )
    ) {
      return;
    }

    setDeletingSessionId(
      entry.id
    );

    setSessionError("");

    try {
      await deleteParticipantSession({
        sessionId:
          entry.id,

        organisationId,
      });

      await refreshSessions();
    } catch (error) {
      console.error(
        "Unable to delete Staff Note:",
        error
      );

      setSessionError(
        error?.message ||
          "Staff entry could not be deleted."
      );

      alert(
        error?.message ||
          "Staff entry could not be deleted."
      );
    } finally {
      setDeletingSessionId("");
    }
  }

  function generateHandoverSummary() {
    const parts = [
      `Participant: ${
        selectedClient?.name ||
        "Participant"
      }`,

      `Shift: ${shiftType}`,

      mood
        ? `Presentation: ${mood}`
        : "",

      engagement
        ? `Engagement: ${engagement}`
        : "",

      supportAreas.length
        ? `Support provided: ${supportAreas.join(
            ", "
          )}`
        : "",

      observations.trim()
        ? `Observations: ${observations.trim()}`
        : "",

      actionsTaken.trim()
        ? `Actions taken: ${actionsTaken.trim()}`
        : "",

      participantResponse.trim()
        ? `Participant response: ${participantResponse.trim()}`
        : "",

      outcome
        ? `Outcome: ${outcome}`
        : "",

      escalationLevel !==
      "No escalation required"
        ? `Escalation: ${escalationLevel}${
            escalationNotes.trim()
              ? ` – ${escalationNotes.trim()}`
              : ""
          }`
        : "",

      safeguardingConcern
        ? `Safeguarding concern: ${
            safeguardingNotes.trim() ||
            "Concern recorded"
          }`
        : "",
    ].filter(Boolean);

    setHandover(
      parts.join("\n")
    );
  }

  if (
    !clientsReady
  ) {
    return (
      <div className="zone-page">
        <EmptyState
          icon="⏳"
          title="Loading participants"
          description="Checking your authorised participant access."
        />
      </div>
    );
  }

  if (!clients.length) {
    return (
      <div className="zone-page">
        <EmptyState
          icon="👥"
          title="No participant available"
          description="Ask your coordinator or manager to assign participant access."
        />
      </div>
    );
  }

  return (
    <div className="zone-page staff-v2-page">
      <header className="staff-v2-hero">
        <div>
          <div className="eyebrow">
            Workforce Documentation
          </div>

          <h1>
            Staff Notes & Shift Handover
          </h1>

          <p>
            Record objective observations,
            support provided, participant
            responses, outcomes, escalation
            actions and safeguarding concerns
            in a structured participant-centred
            format.
          </p>

          <div className="staff-hero-client">
            <div className="staff-client-avatar">
              {safe(
                selectedClient?.name
              )
                .charAt(0)
                .toUpperCase() ||
                "P"}
            </div>

            <div>
              <strong>
                {selectedClient?.name}
              </strong>

              <span>
                {selectedClient?.age
                  ? `Age ${selectedClient.age}`
                  : "Age not recorded"}
              </span>

              <small>
                NDIS:{" "}
                {selectedClient?.ndisNumber ||
                  "Not recorded"}
              </small>
            </div>
          </div>
        </div>

        <div className="staff-compliance-card">
          <div className="staff-compliance-icon">
            📝
          </div>

          <strong>
            Shared and accountable documentation
          </strong>

          <p>
            {organisationName}
            <br />
            {roleLabel} ·{" "}
            {user?.email}
          </p>
        </div>
      </header>

      {sessionError ? (
        <div
          className="auth-error"
          style={{
            marginBottom: 14,
          }}
        >
          {sessionError}
        </div>
      ) : null}

      {carePlanError ? (
        <div
          className="auth-error"
          style={{
            marginBottom: 14,
          }}
        >
          {carePlanError}
        </div>
      ) : null}

      <section className="staff-metric-grid">
        <StaffMetric
          icon="📝"
          label="Staff Entries"
          value={
            staffSessions.length
          }
          detail={
            sessionsLoading
              ? "Refreshing shared history…"
              : latestEntryDays ==
                null
              ? "No entries recorded"
              : latestEntryDays ===
                0
              ? "Latest entry today"
              : `Latest entry ${latestEntryDays}d ago`
          }
          level={
            staffSessions.length >
            0
              ? "good"
              : "neutral"
          }
        />

        <StaffMetric
          icon="✅"
          label="Shift Readiness"
          value={`${completedTaskCount}/6`}
          detail="Current pre-shift checks completed"
          level={
            completedTaskCount >=
            5
              ? "good"
              : completedTaskCount >=
                3
              ? "warning"
              : "neutral"
          }
        />

        <StaffMetric
          icon="⚠️"
          label="Escalations"
          value={
            escalationCount
          }
          detail="Shared entries requiring review"
          level={
            escalationCount > 0
              ? "warning"
              : "good"
          }
        />

        <StaffMetric
          icon="🛡️"
          label="Safeguarding"
          value={
            safeguardingCount
          }
          detail="Shared concerns recorded"
          level={
            safeguardingCount > 0
              ? "danger"
              : "good"
          }
        />

        <StaffMetric
          icon="🎯"
          label="Plan Connection"
          value={
            currentGoals
              ? "Connected"
              : "Missing"
          }
          detail={
            carePlanLoading
              ? "Loading shared Purpose Plan…"
              : currentGoals
              ? "Shared participant goals available"
              : "No reviewed or approved Purpose Plan"
          }
          level={
            currentGoals
              ? "good"
              : "warning"
          }
        />
      </section>

      <div className="staff-v2-main-grid">
        <div className="staff-v2-primary">
          <StaffCard
            title="Record Staff Progress Note"
            subtitle="Separate observations, actions, participant response and outcomes."
            right={
              <StatusBadge level="neutral">
                Shared entry
              </StatusBadge>
            }
          >
            <div className="staff-form-grid">
              <label>
                <span>
                  Participant
                </span>

                <select
                  className="input"
                  value={
                    selectedClientId
                  }
                  onChange={(
                    event
                  ) =>
                    setActiveClientId(
                      event.target
                        .value
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
                        {
                          client.name
                        }
                        {client.age
                          ? ` (${client.age})`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  Shift or visit type
                </span>

                <select
                  className="input"
                  value={shiftType}
                  onChange={(
                    event
                  ) =>
                    setShiftType(
                      event.target
                        .value
                    )
                  }
                >
                  <option>
                    Morning shift
                  </option>
                  <option>
                    Day shift
                  </option>
                  <option>
                    Evening shift
                  </option>
                  <option>
                    Night shift
                  </option>
                  <option>
                    Home visit
                  </option>
                  <option>
                    Community access
                  </option>
                  <option>
                    Appointment support
                  </option>
                  <option>
                    Other
                  </option>
                </select>
              </label>
            </div>

            <div className="staff-form-section">
              <div className="staff-form-section-title">
                Pre-shift checklist
              </div>

              <div className="staff-check-grid">
                {[
                  {
                    key:
                      "reviewedHistory",
                    label:
                      "Reviewed recent notes and red flags",
                  },
                  {
                    key:
                      "checkedEnvironment",
                    label:
                      "Checked environment for hazards",
                  },
                  {
                    key:
                      "checkedAssistiveTech",
                    label:
                      "Confirmed assistive technology",
                  },
                  {
                    key:
                      "escalationPlanKnown",
                    label:
                      "Reviewed escalation procedures",
                  },
                  {
                    key:
                      "confirmedConsent",
                    label:
                      "Confirmed consent and preferences",
                  },
                  {
                    key:
                      "reviewedGoals",
                    label:
                      "Reviewed participant goals",
                  },
                ].map(
                  (item) => (
                    <label
                      key={
                        item.key
                      }
                      className={
                        tasks[
                          item.key
                        ]
                          ? "staff-check-option selected"
                          : "staff-check-option"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          tasks[
                            item.key
                          ]
                        }
                        onChange={() =>
                          toggleTask(
                            item.key
                          )
                        }
                      />

                      <span>
                        {
                          item.label
                        }
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>

            <div className="staff-form-section">
              <div className="staff-form-section-title">
                Mood and engagement
              </div>

              <div className="staff-presentation-grid">
                <label>
                  <span>
                    Mood or presentation
                  </span>

                  <select
                    className="input"
                    value={mood}
                    onChange={(
                      event
                    ) =>
                      setMood(
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      Select mood
                    </option>

                    {MOOD_OPTIONS.map(
                      (option) => (
                        <option
                          key={
                            option
                          }
                        >
                          {
                            option
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  <span>
                    Engagement level
                  </span>

                  <select
                    className="input"
                    value={
                      engagement
                    }
                    onChange={(
                      event
                    ) =>
                      setEngagement(
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      Select engagement
                    </option>

                    {ENGAGEMENT_OPTIONS.map(
                      (option) => (
                        <option
                          key={
                            option
                          }
                        >
                          {
                            option
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>
            </div>

            <div className="staff-form-section">
              <div className="staff-form-section-title">
                Support areas provided
              </div>

              <div className="staff-support-grid">
                {SUPPORT_AREAS.map(
                  (area) => (
                    <button
                      type="button"
                      key={area}
                      className={
                        supportAreas.includes(
                          area
                        )
                          ? "staff-support-pill active"
                          : "staff-support-pill"
                      }
                      onClick={() =>
                        toggleSupportArea(
                          area
                        )
                      }
                    >
                      {area}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="staff-form-grid">
              <label className="staff-form-wide">
                <span>
                  Objective observations
                </span>

                <textarea
                  className="textarea"
                  rows={5}
                  value={
                    observations
                  }
                  onChange={(
                    event
                  ) =>
                    setObservations(
                      event.target
                        .value
                    )
                  }
                  placeholder="Describe what you directly observed: presentation, routine, appetite, mobility, communication, behaviour or environmental changes..."
                />
              </label>

              <label>
                <span>
                  Actions and support provided
                </span>

                <textarea
                  className="textarea"
                  rows={4}
                  value={
                    actionsTaken
                  }
                  onChange={(
                    event
                  ) =>
                    setActionsTaken(
                      event.target
                        .value
                    )
                  }
                  placeholder="What assistance, prompting or strategies were provided?"
                />
              </label>

              <label>
                <span>
                  Participant response
                </span>

                <textarea
                  className="textarea"
                  rows={4}
                  value={
                    participantResponse
                  }
                  onChange={(
                    event
                  ) =>
                    setParticipantResponse(
                      event.target
                        .value
                    )
                  }
                  placeholder="How did the participant respond, communicate or exercise choice?"
                />
              </label>

              <label>
                <span>
                  Outcome
                </span>

                <select
                  className="input"
                  value={outcome}
                  onChange={(
                    event
                  ) =>
                    setOutcome(
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    Select outcome
                  </option>

                  {OUTCOME_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option
                        }
                      >
                        {option}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  Escalation level
                </span>

                <select
                  className="input"
                  value={
                    escalationLevel
                  }
                  onChange={(
                    event
                  ) =>
                    setEscalationLevel(
                      event.target
                        .value
                    )
                  }
                >
                  {ESCALATION_LEVELS.map(
                    (option) => (
                      <option
                        key={
                          option
                        }
                      >
                        {option}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="staff-form-wide">
                <span>
                  Goal progress
                </span>

                <textarea
                  className="textarea"
                  rows={3}
                  value={
                    goalProgress
                  }
                  onChange={(
                    event
                  ) =>
                    setGoalProgress(
                      event.target
                        .value
                    )
                  }
                  placeholder="Explain how today’s support contributed to, maintained or affected participant goals..."
                />
              </label>

              {escalationLevel !==
              "No escalation required" ? (
                <label className="staff-form-wide">
                  <span>
                    Escalation details and actions
                  </span>

                  <textarea
                    className="textarea"
                    rows={3}
                    value={
                      escalationNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setEscalationNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Record who was notified, when, why and what instructions were received..."
                  />
                </label>
              ) : null}
            </div>

            <div
              className={
                safeguardingConcern
                  ? "staff-safeguarding-panel active"
                  : "staff-safeguarding-panel"
              }
            >
              <label className="staff-safeguarding-toggle">
                <input
                  type="checkbox"
                  checked={
                    safeguardingConcern
                  }
                  onChange={(
                    event
                  ) =>
                    setSafeguardingConcern(
                      event.target
                        .checked
                    )
                  }
                />

                <span>
                  Raise a safeguarding
                  concern involving
                  possible abuse, neglect,
                  exploitation or
                  inappropriate conduct
                </span>
              </label>

              {safeguardingConcern ? (
                <textarea
                  className="textarea"
                  rows={4}
                  value={
                    safeguardingNotes
                  }
                  onChange={(
                    event
                  ) =>
                    setSafeguardingNotes(
                      event.target
                        .value
                    )
                  }
                  placeholder="Record factual indicators, immediate safety actions, who was notified and the reporting procedure followed..."
                />
              ) : null}
            </div>

            <div className="staff-handover-section">
              <div className="staff-handover-heading">
                <div>
                  <strong>
                    Shift handover
                  </strong>

                  <span>
                    Summarise what the
                    next worker or
                    coordinator needs to
                    know.
                  </span>
                </div>

                <button
                  type="button"
                  className="staff-secondary-button"
                  onClick={
                    generateHandoverSummary
                  }
                >
                  Generate from note
                </button>
              </div>

              <textarea
                className="textarea"
                rows={6}
                value={handover}
                onChange={(
                  event
                ) =>
                  setHandover(
                    event.target
                      .value
                  )
                }
                placeholder="Important changes, unfinished actions, risks, appointments and follow-up..."
              />
            </div>

            <div className="staff-form-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  void handleSaveStaffEntry()
                }
                disabled={saving}
              >
                {saving
                  ? "Saving Shared Entry…"
                  : "💾 Save Shared Staff Entry"}
              </button>

              <button
                type="button"
                className="staff-secondary-button"
                onClick={
                  resetForm
                }
                disabled={saving}
              >
                Clear Form
              </button>
            </div>
          </StaffCard>

          <StaffCard
            title="Recent Staff Note Timeline"
            subtitle="Shared observations, outcomes, escalation and handover history for this participant."
            right={
              <StatusBadge
                level={
                  staffSessions.length
                    ? "good"
                    : "neutral"
                }
              >
                {
                  staffSessions.length
                }{" "}
                total
              </StatusBadge>
            }
          >
            {sessionsLoading ? (
              <EmptyState
                icon="⏳"
                title="Loading shared history"
                description="Retrieving authorised participant entries from Theraa Nurse."
              />
            ) : recentStaffSessions.length ===
              0 ? (
              <EmptyState
                icon="📝"
                title="No staff entries recorded"
                description="Save the first shared staff progress note above."
              />
            ) : (
              <div className="staff-entry-list">
                {recentStaffSessions.map(
                  (
                    entry,
                    index
                  ) => {
                    const canDeleteEntry =
                      canManageAllSessions ||
                      entry.createdBy ===
                        user?.id;

                    return (
                      <article
                        className="staff-entry-card"
                        key={
                          entry.id ||
                          `${entry.timestamp}-${index}`
                        }
                      >
                        <div className="staff-entry-heading">
                          <div>
                            <strong>
                              {entry.shiftType ||
                                "Staff progress note"}
                            </strong>

                            <span>
                              {formatDateTime(
                                entry.timestamp ||
                                  entry.createdAt
                              )}
                            </span>

                            {entry.createdBy ? (
                              <small>
                                Recorded by:{" "}
                                {entry.createdBy ===
                                user?.id
                                  ? "You"
                                  : "Authorised team member"}
                              </small>
                            ) : null}
                          </div>

                          <StatusBadge
                            level={
                              entry.safeguardingConcern
                                ? "danger"
                                : getEscalationLevel(
                                    entry.escalationLevel
                                  )
                            }
                          >
                            {entry.safeguardingConcern
                              ? "Safeguarding"
                              : entry.escalationLevel ||
                                "Recorded"}
                          </StatusBadge>
                        </div>

                        <div className="staff-entry-meta">
                          {entry.mood ? (
                            <span>
                              Mood:{" "}
                              {
                                entry.mood
                              }
                            </span>
                          ) : null}

                          {entry.engagement ? (
                            <span>
                              Engagement:{" "}
                              {
                                entry.engagement
                              }
                            </span>
                          ) : null}

                          {entry.outcome ? (
                            <span>
                              Outcome:{" "}
                              {
                                entry.outcome
                              }
                            </span>
                          ) : null}
                        </div>

                        {entry.observations ||
                        entry.notes ? (
                          <div className="staff-entry-block">
                            <b>
                              Observations
                            </b>

                            <p>
                              {entry.observations ||
                                entry.notes}
                            </p>
                          </div>
                        ) : null}

                        {entry.actionsTaken ? (
                          <div className="staff-entry-block">
                            <b>
                              Actions taken
                            </b>

                            <p>
                              {
                                entry.actionsTaken
                              }
                            </p>
                          </div>
                        ) : null}

                        {entry.participantResponse ? (
                          <div className="staff-entry-block">
                            <b>
                              Participant
                              response
                            </b>

                            <p>
                              {
                                entry.participantResponse
                              }
                            </p>
                          </div>
                        ) : null}

                        {entry.goalProgress ? (
                          <div className="staff-entry-block">
                            <b>
                              Goal progress
                            </b>

                            <p>
                              {
                                entry.goalProgress
                              }
                            </p>
                          </div>
                        ) : null}

                        {entry.handover ? (
                          <div className="staff-entry-block">
                            <b>
                              Handover
                            </b>

                            <p>
                              {
                                entry.handover
                              }
                            </p>
                          </div>
                        ) : null}

                        {entry.safeguardingConcern ? (
                          <div className="staff-entry-safeguarding">
                            <strong>
                              Safeguarding
                              concern
                            </strong>

                            <p>
                              {entry.safeguardingNotes ||
                                "Concern recorded"}
                            </p>
                          </div>
                        ) : null}

                        <div className="staff-entry-footer">
                          <span>
                            {asArray(
                              entry.supportAreas
                            ).length
                              ? `${
                                  entry
                                    .supportAreas
                                    .length
                                } support area${
                                  entry
                                    .supportAreas
                                    .length ===
                                  1
                                    ? ""
                                    : "s"
                                }`
                              : "Support areas not recorded"}
                          </span>

                          {canDeleteEntry ? (
                            <button
                              type="button"
                              disabled={
                                deletingSessionId ===
                                entry.id
                              }
                              onClick={() =>
                                void handleDeleteEntry(
                                  entry
                                )
                              }
                            >
                              {deletingSessionId ===
                              entry.id
                                ? "Deleting…"
                                : "Delete"}
                            </button>
                          ) : (
                            <small>
                              Shared record
                            </small>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </StaffCard>
        </div>

        <aside className="staff-v2-secondary">
          <StaffCard
            title="Purpose Plan Context"
            subtitle="Current reviewed or approved shared participant information relevant to daily support."
            right={
              <StatusBadge
                level={
                  carePlanLoading
                    ? "neutral"
                    : carePlan
                    ? "good"
                    : "neutral"
                }
              >
                {carePlanLoading
                  ? "Loading…"
                  : carePlan
                  ? "Shared plan"
                  : "No current plan"}
              </StatusBadge>
            }
          >
            <div className="staff-plan-block">
              <span>
                Current goals
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : currentGoals ||
                    "No reviewed or approved participant goals are recorded."}
              </p>
            </div>

            <div className="staff-plan-block">
              <span>
                Communication strategies
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : communicationContext ||
                    "No communication strategies are recorded in the current shared Purpose Plan."}
              </p>
            </div>

            <div className="staff-plan-block">
              <span>
                Functional supports
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : supportContext ||
                    "No functional support information is recorded in the current shared Purpose Plan."}
              </p>
            </div>

            <div className="staff-plan-block">
              <span>
                Risks and safeguards
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : riskContext ||
                    "No risk information is recorded in the current shared Purpose Plan."}
              </p>
            </div>

            <div className="staff-plan-block">
              <span>
                Behaviour support
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : behaviourContext ||
                    "No behaviour support information is recorded in the current shared Purpose Plan."}
              </p>
            </div>
          </StaffCard>

          <StaffCard
            title="Documentation Standard"
            subtitle="Prompts for clear and defensible progress notes."
          >
            <div className="staff-guidance-list">
              <div>
                <span>1</span>

                <p>
                  Record what you directly
                  observed, heard or did.
                </p>
              </div>

              <div>
                <span>2</span>

                <p>
                  Separate facts from
                  opinions, assumptions and
                  interpretation.
                </p>
              </div>

              <div>
                <span>3</span>

                <p>
                  Explain how support
                  related to the
                  participant’s goals,
                  choices and needs.
                </p>
              </div>

              <div>
                <span>4</span>

                <p>
                  Record escalation,
                  reporting and follow-up
                  actions clearly.
                </p>
              </div>
            </div>
          </StaffCard>

          <StaffCard
            title="Cross-Service Signals"
            subtitle="Related shared participant activity across Theraa Nurse."
          >
            <div className="staff-signal-list">
              {[
                {
                  zone:
                    "therapy",
                  label:
                    "Therapy",
                  icon: "🧠",
                },
                {
                  zone: "meds",
                  label:
                    "Medication",
                  icon: "💊",
                },
                {
                  zone:
                    "paramedic",
                  label:
                    "Paramedic",
                  icon: "🚑",
                },
                {
                  zone: "vpn",
                  label:
                    "Remote Support",
                  icon: "🔐",
                },
              ].map(
                (item) => {
                  const count =
                    crossZoneSessions.filter(
                      (
                        session
                      ) =>
                        session.zone ===
                        item.zone
                    ).length;

                  return (
                    <div
                      key={
                        item.zone
                      }
                    >
                      <span>
                        {item.icon}
                      </span>

                      <div>
                        <strong>
                          {
                            item.label
                          }
                        </strong>

                        <small>
                          {count} entr
                          {count ===
                          1
                            ? "y"
                            : "ies"}{" "}
                          recorded
                        </small>
                      </div>

                      <b>
                        {count}
                      </b>
                    </div>
                  );
                }
              )}
            </div>
          </StaffCard>
        </aside>
      </div>
    </div>
  );
}