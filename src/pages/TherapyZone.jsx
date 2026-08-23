// src/pages/TherapyZone.jsx

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

import ClientSelectorBar from "../components/ClientSelectorBar";

import {
  createParticipantSession,
  deleteParticipantSession,
  loadParticipantSessions,
} from "../services/sessionService";


const BODY_SYSTEMS = [
  "Respiratory",
  "Cardiovascular / circulation",
  "Gastrointestinal / digestion",
  "Musculoskeletal / mobility",
  "Neurological / cognition",
  "Skin / integumentary",
];


const MOOD_STATES = [
  "Calm",
  "Content",
  "Happy",
  "Flat",
  "Sad",
  "Anxious",
  "Irritable",
  "Agitated",
];


const THERAPY_DISCIPLINES = [
  "Occupational Therapy",
  "Physiotherapy",
  "Speech Pathology",
  "Psychology",
  "Behaviour Support",
  "Exercise Physiology",
  "Social Work",
  "Other",
];


const PROGRESS_SIGNALS = [
  "Improving",
  "Stable",
  "Variable",
  "Declining",
  "Not assessed",
];


const PARTICIPATION_LEVELS = [
  "Independent",
  "Minimal prompting",
  "Moderate assistance",
  "High assistance",
  "Unable / declined",
];


const BARRIER_OPTIONS = [
  "Pain or discomfort",
  "Fatigue",
  "Anxiety",
  "Communication difficulty",
  "Mobility limitation",
  "Environmental barrier",
  "Low motivation",
  "Behavioural escalation",
  "No significant barrier",
];


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


function daysAgo(isoDate) {
  if (!isoDate) return null;

  const date = new Date(isoDate);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (
        Date.now() -
        date.getTime()
      ) /
        (
          1000 *
          60 *
          60 *
          24
        )
    )
  );
}


function formatDateTime(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Date unavailable";
  }

  return date.toLocaleString();
}


function getTherapySessions(
  allSessions,
  clientId
) {
  return asArray(
    allSessions?.[
      clientId
    ]
  ).filter(
    (session) =>
      (
        session?.zone ||
        "therapy"
      ) ===
      "therapy"
  );
}


function getCrossZoneSessions(
  allSessions,
  clientId
) {
  return asArray(
    allSessions?.[
      clientId
    ]
  ).filter((session) =>
    [
      "therapy",
      "meds",
      "paramedic",
      "staff",
      "vpn",
    ].includes(
      session?.zone ||
        "therapy"
    )
  );
}


function getMostCommonValue(
  items,
  getter
) {
  const counts = {};

  items.forEach(
    (item) => {
      const value = safe(
        getter(item)
      ).trim();

      if (!value) return;

      counts[value] =
        (
          counts[value] ||
          0
        ) + 1;
    }
  );

  return (
    Object.entries(counts)
      .sort(
        (a, b) =>
          b[1] - a[1]
      )?.[0]?.[0] ||
    "—"
  );
}


function calculateTherapyReadiness({
  plan,
  sessions,
}) {
  let score = 20;

  const sections =
    plan?.sections || {};

  if (
    safe(
      sections.goalsShort ||
        plan?.goalsShort
    ).trim()
  ) {
    score += 15;
  }

  if (
    safe(
      sections.goalsLong ||
        plan?.goalsLong
    ).trim()
  ) {
    score += 15;
  }

  if (
    safe(
      sections.functionalNeeds ||
        plan?.supports
    ).trim()
  ) {
    score += 15;
  }

  if (
    safe(
      sections.healthClinical
    ).trim()
  ) {
    score += 10;
  }

  if (
    safe(
      sections.risks ||
        plan?.risks
    ).trim()
  ) {
    score += 10;
  }

  if (
    sessions.length > 0
  ) {
    score += Math.min(
      15,
      sessions.length * 3
    );
  }

  return Math.min(
    100,
    score
  );
}


function TherapyMetric({
  icon,
  label,
  value,
  detail,
  level = "neutral",
}) {
  return (
    <article
      className={`therapy-metric therapy-metric-${level}`}
    >
      <div className="therapy-metric-icon">
        {icon}
      </div>

      <div className="therapy-metric-value">
        {value}
      </div>

      <div className="therapy-metric-label">
        {label}
      </div>

      {detail ? (
        <div className="therapy-metric-detail">
          {detail}
        </div>
      ) : null}
    </article>
  );
}


function TherapyCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}) {
  return (
    <section
      className={`card therapy-v2-card ${className}`}
    >
      <div className="therapy-card-header">
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

      <div className="therapy-card-body">
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
      className={`therapy-status therapy-status-${level}`}
    >
      {children}
    </span>
  );
}


function EmptyState({
  icon = "🧠",
  title,
  description,
}) {
  return (
    <div className="therapy-empty-state">
      <div className="therapy-empty-icon">
        {icon}
      </div>

      <strong>
        {title}
      </strong>

      <span>
        {description}
      </span>
    </div>
  );
}


export default function TherapyZone() {
  const {
    user,
  } = useAuth();

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
   * V3 participant selection rule:
   * ActiveClientContext is the single source of truth.
   * Therapy must not maintain a second local participant ID,
   * otherwise the two states can fight each other and cause
   * repeated refreshes / visual twitching.
   */
  const selectedClientId =
    activeClientId || fallbackId;

  /*
   * Used to ignore stale Supabase responses when the user
   * switches participants quickly.
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
    latestPlan,
    setLatestPlan,
  ] = useState(null);


  const [
    carePlanLoading,
    setCarePlanLoading,
  ] = useState(false);


  const [
    carePlanError,
    setCarePlanError,
  ] = useState("");


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    deletingSessionId,
    setDeletingSessionId,
  ] = useState("");


  const [
    therapyDiscipline,
    setTherapyDiscipline,
  ] = useState(
    "Occupational Therapy"
  );


  const [
    sessionGoal,
    setSessionGoal,
  ] = useState("");


  const [
    checkedSystems,
    setCheckedSystems,
  ] = useState([]);


  const [
    mood,
    setMood,
  ] = useState("");


  const [
    participationLevel,
    setParticipationLevel,
  ] = useState("");


  const [
    progressSignal,
    setProgressSignal,
  ] = useState(
    "Not assessed"
  );


  const [
    barriers,
    setBarriers,
  ] = useState([]);


  const [
    strategiesUsed,
    setStrategiesUsed,
  ] = useState("");


  const [
    outcome,
    setOutcome,
  ] = useState("");


  const [
    followUp,
    setFollowUp,
  ] = useState("");


  const [
    notes,
    setNotes,
  ] = useState("");


  const [
    reportText,
    setReportText,
  ] = useState("");


  const [
    reportRange,
    setReportRange,
  ] = useState(
    "today"
  );


  const [
    showReport,
    setShowReport,
  ] = useState(false);


  const canManageAllSessions =
    [
      "provider_admin",
      "manager",
    ].includes(role);


  /*
   * Initialise / repair the global active participant once.
   * This is one-way only: the global context owns selection.
   */
  useEffect(() => {
    if (!fallbackId) {
      return;
    }

    const activeParticipantExists =
      clients.some(
        (client) =>
          client.id === activeClientId
      );

    if (!activeParticipantExists) {
      setActiveClientId(
        fallbackId
      );
    }
  }, [
    activeClientId,
    clients,
    fallbackId,
    setActiveClientId,
  ]);


  /*
   * Load shared Supabase sessions.
   *
   * This includes Staff Notes,
   * Therapy, Medication, etc.,
   * so Cross-Service Signals work.
   */
  const refreshSessions =
    useCallback(
      async () => {
        const requestId =
          ++sessionRequestRef.current;

        const participantId =
          selectedClientId;

        if (
          !organisationId ||
          !participantId
        ) {
          if (
            requestId ===
            sessionRequestRef.current
          ) {
            setAllSessions({});
            setSessionsLoading(false);
          }

          return;
        }

        /*
         * Clear the previous participant's data immediately so
         * the header / metrics never display mixed participant
         * information while the new request is loading.
         */
        setAllSessions({});
        setSessionsLoading(true);
        setSessionError("");

        try {
          const sessions =
            await loadParticipantSessions(
              {
                organisationId,
                participantId,
              }
            );

          /*
           * The user may have selected another participant while
           * this request was in flight. Ignore stale responses.
           */
          if (
            requestId !==
            sessionRequestRef.current
          ) {
            return;
          }

          setAllSessions({
            [participantId]:
              sessions,
          });
        } catch (error) {
          if (
            requestId !==
            sessionRequestRef.current
          ) {
            return;
          }

          console.error(
            "Unable to load shared Therapy sessions:",
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
          if (
            requestId ===
            sessionRequestRef.current
          ) {
            setSessionsLoading(false);
          }
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


  /*
   * Clear participant-specific Purpose Plan state immediately
   * when selection changes. This prevents mixed participant
   * information while the next Supabase request is in flight.
   */
  useEffect(() => {
    carePlanRequestRef.current += 1;
    setLatestPlan(null);
    setCarePlanError("");
  }, [selectedClientId]);


  /*
   * Load the participant's current reviewed or approved
   * Purpose Plan from the shared Supabase workspace.
   *
   * The request guard ignores stale responses if the user
   * switches participants quickly.
   */
  const refreshCarePlan =
    useCallback(
      async () => {
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
            setLatestPlan(null);
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

          setLatestPlan(
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
            "Unable to load shared Therapy Purpose Plan context:",
            error
          );

          setLatestPlan(null);

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
      },
      [
        organisationId,
        selectedClientId,
      ]
    );


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


  const therapySessions =
    useMemo(
      () =>
        getTherapySessions(
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


  const recentTherapySessions =
    therapySessions.slice(
      0,
      8
    );


  const mostRecentTherapy =
    therapySessions[0] ||
    null;


  const lastTherapyDays =
    daysAgo(
      mostRecentTherapy
        ?.timestamp ||
        mostRecentTherapy
          ?.createdAt
    );


  const dominantMood =
    getMostCommonValue(
      therapySessions.slice(
        0,
        10
      ),
      (session) =>
        session?.mood
    );


  const dominantProgress =
    getMostCommonValue(
      therapySessions.slice(
        0,
        10
      ),
      (session) =>
        session?.progressSignal
    );


  const therapyReadiness =
    calculateTherapyReadiness({
      plan: latestPlan,
      sessions:
        therapySessions,
    });


  const planSections =
    latestPlan?.sections ||
    {};


  const therapyGoals =
    safe(
      planSections.goalsShort ||
        latestPlan?.goalsShort
    ).trim() ||
    safe(
      planSections.goalsLong ||
        latestPlan?.goalsLong
    ).trim();


  const functionalSupports =
    safe(
      planSections.functionalNeeds ||
        latestPlan?.supports
    ).trim();


  const clinicalConsiderations =
    safe(
      planSections.healthClinical
    ).trim();


  const planRisks =
    safe(
      planSections.risks ||
        latestPlan?.risks
    ).trim();


  function toggleSystem(
    system
  ) {
    setCheckedSystems(
      (previous) =>
        previous.includes(
          system
        )
          ? previous.filter(
              (item) =>
                item !== system
            )
          : [
              ...previous,
              system,
            ]
    );
  }


  function toggleBarrier(
    barrier
  ) {
    setBarriers(
      (previous) =>
        previous.includes(
          barrier
        )
          ? previous.filter(
              (item) =>
                item !==
                barrier
            )
          : [
              ...previous,
              barrier,
            ]
    );
  }


  function resetSessionForm() {
    setTherapyDiscipline(
      "Occupational Therapy"
    );

    setSessionGoal("");

    setCheckedSystems(
      []
    );

    setMood("");

    setParticipationLevel(
      ""
    );

    setProgressSignal(
      "Not assessed"
    );

    setBarriers([]);

    setStrategiesUsed(
      ""
    );

    setOutcome("");

    setFollowUp("");

    setNotes("");
  }


  async function handleSaveTherapySession() {
    if (
      !selectedClientId
    ) {
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
      !user?.id
    ) {
      alert(
        "You must be signed in to save a therapy session."
      );

      return;
    }


    if (
      !notes.trim() &&
      !outcome.trim() &&
      !sessionGoal.trim()
    ) {
      alert(
        "Please record a session goal, outcome or progress note before saving."
      );

      return;
    }


    const timestamp =
      new Date().toISOString();


    const payload = {
      timestamp,

      zone:
        "therapy",

      discipline:
        therapyDiscipline,

      sessionGoal:
        sessionGoal.trim(),

      bodySystems: [
        ...checkedSystems,
      ],

      mood,

      participationLevel,

      progressSignal,

      barriers: [
        ...barriers,
      ],

      strategiesUsed:
        strategiesUsed.trim(),

      outcome:
        outcome.trim(),

      followUp:
        followUp.trim(),

      notes:
        notes.trim(),
    };


    setSaving(true);

    setSessionError("");


    try {
      await createParticipantSession(
        {
          organisationId,

          participantId:
            selectedClientId,

          userId:
            user.id,

          zone:
            "therapy",

          sessionData:
            payload,
        }
      );


      await refreshSessions();


      resetSessionForm();


      alert(
        "Therapy session saved to the shared participant record."
      );
    } catch (error) {
      console.error(
        "Unable to save shared Therapy session:",
        error
      );


      setSessionError(
        error?.message ||
          "Unable to save therapy session."
      );


      alert(
        error?.message ||
          "Unable to save therapy session."
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleDeleteTherapySession(
    session
  ) {
    if (
      !session?.id
    ) {
      return;
    }


    const canDelete =
      canManageAllSessions ||
      session.createdBy ===
        user?.id;


    if (!canDelete) {
      alert(
        "You cannot delete a therapy session created by another team member."
      );

      return;
    }


    if (
      !window.confirm(
        "Delete this therapy session?"
      )
    ) {
      return;
    }


    setDeletingSessionId(
      session.id
    );

    setSessionError("");


    try {
      await deleteParticipantSession(
        {
          sessionId:
            session.id,

          organisationId,
        }
      );


      await refreshSessions();
    } catch (error) {
      console.error(
        "Unable to delete shared Therapy session:",
        error
      );


      setSessionError(
        error?.message ||
          "Unable to delete therapy session."
      );


      alert(
        error?.message ||
          "Unable to delete therapy session."
      );
    } finally {
      setDeletingSessionId(
        ""
      );
    }
  }


  function handleGenerateReport() {
    const now =
      new Date();


    const inRange = (
      iso
    ) => {
      if (!iso) {
        return false;
      }


      const date =
        new Date(iso);


      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return false;
      }


      if (
        reportRange ===
        "today"
      ) {
        return (
          date.toDateString() ===
          now.toDateString()
        );
      }


      const differenceDays =
        (
          now.getTime() -
          date.getTime()
        ) /
        (
          1000 *
          60 *
          60 *
          24
        );


      return (
        differenceDays <= 7
      );
    };


    const rangedSessions =
      crossZoneSessions.filter(
        (session) =>
          inRange(
            session.timestamp ||
              session.createdAt
          )
      );


    const rangedTherapy =
      rangedSessions.filter(
        (session) =>
          session.zone ===
          "therapy"
      );


    const rangedMedication =
      rangedSessions.filter(
        (session) =>
          session.zone ===
          "meds"
      );


    const rangedParamedic =
      rangedSessions.filter(
        (session) =>
          session.zone ===
          "paramedic"
      );


    const rangedStaff =
      rangedSessions.filter(
        (session) =>
          session.zone ===
          "staff"
      );


    const rangedRemote =
      rangedSessions.filter(
        (session) =>
          session.zone ===
          "vpn"
      );


    const lines = [];


    lines.push(
      `Theraa Nurse Therapy & Participant Support Report – ${
        selectedClient
          ?.name ||
        "Participant"
      }`
    );


    lines.push(
      `Organisation: ${
        organisationName ||
        "Theraa Nurse Workspace"
      }`
    );


    lines.push(
      `Range: ${
        reportRange ===
        "today"
          ? `Today (${now.toLocaleDateString()})`
          : `Last 7 days ending ${now.toLocaleDateString()}`
      }`
    );


    lines.push("");


    lines.push(
      "1. Therapy Overview"
    );


    if (
      rangedTherapy.length ===
      0
    ) {
      lines.push(
        "- No therapy sessions recorded for this period."
      );
    } else {
      lines.push(
        `- Therapy sessions: ${rangedTherapy.length}.`
      );


      lines.push(
        `- Most common mood: ${getMostCommonValue(
          rangedTherapy,
          (session) =>
            session.mood
        )}.`
      );


      lines.push(
        `- Most common progress signal: ${getMostCommonValue(
          rangedTherapy,
          (session) =>
            session.progressSignal
        )}.`
      );


      const latest =
        rangedTherapy[0];


      if (
        latest.discipline
      ) {
        lines.push(
          `- Latest discipline: ${latest.discipline}.`
        );
      }


      if (
        latest.sessionGoal
      ) {
        lines.push(
          `- Latest session goal: ${latest.sessionGoal}`
        );
      }


      if (
        latest.outcome
      ) {
        lines.push(
          `- Latest outcome: ${latest.outcome}`
        );
      }


      if (
        latest.followUp
      ) {
        lines.push(
          `- Follow-up: ${latest.followUp}`
        );
      }
    }


    lines.push("");


    lines.push(
      "2. Cross-Service Activity"
    );


    lines.push(
      `- Medication entries: ${rangedMedication.length}.`
    );


    lines.push(
      `- Paramedic entries: ${rangedParamedic.length}.`
    );


    lines.push(
      `- Staff-note entries: ${rangedStaff.length}.`
    );


    lines.push(
      `- Remote-support entries: ${rangedRemote.length}.`
    );


    lines.push("");


    lines.push(
      "3. Purpose Plan Snapshot"
    );


    if (
      therapyGoals
    ) {
      lines.push(
        "Goals:"
      );

      lines.push(
        therapyGoals
      );
    } else {
      lines.push(
        "- No current therapy-related goals were found."
      );
    }


    if (
      functionalSupports
    ) {
      lines.push("");

      lines.push(
        "Functional supports:"
      );

      lines.push(
        functionalSupports
      );
    }


    if (
      clinicalConsiderations
    ) {
      lines.push("");

      lines.push(
        "Health and clinical considerations:"
      );

      lines.push(
        clinicalConsiderations
      );
    }


    if (
      planRisks
    ) {
      lines.push("");

      lines.push(
        "Risks and safety considerations:"
      );

      lines.push(
        planRisks
      );
    }


    lines.push("");

    lines.push(
      "4. Review Note"
    );


    lines.push(
      "- This report is an operational summary and must be reviewed by an authorised professional before clinical or service decisions are made."
    );


    setReportText(
      lines.join("\n")
    );


    setShowReport(true);
  }


  function handleDownloadReport() {
    if (
      !reportText.trim()
    ) {
      alert(
        "Generate a report first."
      );

      return;
    }


    const blob =
      new Blob(
        [reportText],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const anchor =
      document.createElement(
        "a"
      );


    const clientName =
      (
        selectedClient?.name ||
        "participant"
      ).replace(
        /\s+/g,
        "_"
      );


    anchor.href =
      url;


    anchor.download =
      `theraa-nurse-therapy_${clientName}_${reportRange}.txt`;


    document.body.appendChild(
      anchor
    );


    anchor.click();


    document.body.removeChild(
      anchor
    );


    URL.revokeObjectURL(
      url
    );
  }


  if (!clientsReady) {
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
    <div className="zone-page therapy-v2-page">

      <header className="therapy-v2-hero">

        <div>

          <div className="eyebrow">
            Allied Health Workspace
          </div>


          <h1>
            Therapy & Functional Outcomes
          </h1>


          <p>
            Record therapy-related observations,
            participant engagement, functional
            outcomes, barriers and follow-up
            actions while keeping every session
            connected to the participant’s
            shared support record.
          </p>


          <div className="therapy-hero-client">

            <div className="therapy-client-avatar">
              {safe(
                selectedClient
                  ?.name
              )
                .charAt(0)
                .toUpperCase() ||
                "P"}
            </div>


            <div>

              <strong>
                {selectedClient
                  ?.name}
              </strong>


              <span>
                {selectedClient
                  ?.age
                  ? `Age ${selectedClient.age}`
                  : "Age not recorded"}
              </span>


              <small>
                NDIS:{" "}
                {selectedClient
                  ?.ndisNumber ||
                  "Not recorded"}
              </small>

            </div>

          </div>

        </div>


        <div className="therapy-readiness-card">

          <div className="therapy-readiness-value">
            {therapyReadiness}%
          </div>


          <div className="therapy-readiness-label">
            Therapy Readiness
          </div>


          <small>
            {therapySessions.length}{" "}
            shared therapy session
            {therapySessions.length ===
            1
              ? ""
              : "s"}{" "}
            recorded
          </small>


          <div
            style={{
              marginTop: 10,
              fontSize: 10,
              opacity: 0.8,
            }}
          >
            {roleLabel} ·{" "}
            {organisationName}
          </div>

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


      <ClientSelectorBar
        right={
          <div className="therapy-selector-hint">
            Active participant changes across all tabs.
          </div>
        }
      />


      <section className="therapy-metric-grid">

        <TherapyMetric
          icon="🧠"
          label="Therapy Sessions"
          value={
            therapySessions.length
          }
          detail={
            sessionsLoading
              ? "Refreshing shared sessions…"
              : lastTherapyDays ==
                null
              ? "No session recorded"
              : lastTherapyDays ===
                0
              ? "Latest session today"
              : `Latest session ${lastTherapyDays}d ago`
          }
          level={
            therapySessions.length >
            0
              ? "good"
              : "neutral"
          }
        />


        <TherapyMetric
          icon="🙂"
          label="Mood Signal"
          value={
            dominantMood
          }
          detail="Most common recent presentation"
          level={
            [
              "Calm",
              "Content",
              "Happy",
            ].includes(
              dominantMood
            )
              ? "good"
              : [
                  "Anxious",
                  "Irritable",
                  "Agitated",
                  "Sad",
                ].includes(
                  dominantMood
                )
              ? "warning"
              : "neutral"
          }
        />


        <TherapyMetric
          icon="📈"
          label="Progress Signal"
          value={
            dominantProgress
          }
          detail="Based on recent shared therapy entries"
          level={
            dominantProgress ===
            "Improving"
              ? "good"
              : dominantProgress ===
                "Declining"
              ? "danger"
              : dominantProgress ===
                "Variable"
              ? "warning"
              : "neutral"
          }
        />


        <TherapyMetric
          icon="🎯"
          label="Purpose Plan"
          value={
            carePlanLoading
              ? "Loading"
              : therapyGoals
              ? "Connected"
              : "Missing"
          }
          detail={
            carePlanLoading
              ? "Loading shared Purpose Plan…"
              : therapyGoals
              ? "Shared therapy goals available"
              : "No reviewed or approved Purpose Plan"
          }
          level={
            therapyGoals
              ? "good"
              : "warning"
          }
        />


        <TherapyMetric
          icon="⚠️"
          label="Risk Context"
          value={
            planRisks
              ? "Available"
              : "Not recorded"
          }
          detail={
            planRisks
              ? "Plan risks available for review"
              : "Risk evidence may be incomplete"
          }
          level={
            planRisks
              ? "good"
              : "warning"
          }
        />

      </section>


      <div className="therapy-v2-main-grid">

        <div className="therapy-v2-primary">

          <TherapyCard
            title="Record Therapy Session"
            subtitle="Document the participant’s engagement, intervention and outcome."
            right={
              <StatusBadge level="neutral">
                Shared entry
              </StatusBadge>
            }
          >

            <div className="therapy-form-grid">

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
                  Therapy discipline
                </span>

                <select
                  className="input"
                  value={
                    therapyDiscipline
                  }
                  onChange={(
                    event
                  ) =>
                    setTherapyDiscipline(
                      event.target
                        .value
                    )
                  }
                >

                  {THERAPY_DISCIPLINES.map(
                    (
                      discipline
                    ) => (
                      <option
                        key={
                          discipline
                        }
                      >
                        {discipline}
                      </option>
                    )
                  )}

                </select>
              </label>


              <label className="therapy-form-wide">
                <span>
                  Session goal or purpose
                </span>

                <input
                  className="input"
                  value={
                    sessionGoal
                  }
                  onChange={(
                    event
                  ) =>
                    setSessionGoal(
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. Improve safe mobility and confidence during community access"
                />
              </label>


              <label>
                <span>
                  Participation level
                </span>

                <select
                  className="input"
                  value={
                    participationLevel
                  }
                  onChange={(
                    event
                  ) =>
                    setParticipationLevel(
                      event.target
                        .value
                    )
                  }
                >

                  <option value="">
                    Select participation level
                  </option>


                  {PARTICIPATION_LEVELS.map(
                    (
                      level
                    ) => (
                      <option
                        key={
                          level
                        }
                      >
                        {level}
                      </option>
                    )
                  )}

                </select>
              </label>


              <label>
                <span>
                  Progress signal
                </span>

                <select
                  className="input"
                  value={
                    progressSignal
                  }
                  onChange={(
                    event
                  ) =>
                    setProgressSignal(
                      event.target
                        .value
                    )
                  }
                >

                  {PROGRESS_SIGNALS.map(
                    (
                      signal
                    ) => (
                      <option
                        key={
                          signal
                        }
                      >
                        {signal}
                      </option>
                    )
                  )}

                </select>
              </label>

            </div>


            <div className="therapy-form-section">

              <div className="therapy-form-section-title">
                Mood and presentation
              </div>


              <div className="therapy-pill-group">

                {MOOD_STATES.map(
                  (state) => (
                    <button
                      key={
                        state
                      }
                      type="button"
                      className={
                        mood ===
                        state
                          ? "therapy-pill therapy-pill-active"
                          : "therapy-pill"
                      }
                      onClick={() =>
                        setMood(
                          state
                        )
                      }
                    >
                      {state}
                    </button>
                  )
                )}

              </div>

            </div>


            <div className="therapy-form-section">

              <div className="therapy-form-section-title">
                Body systems observed
              </div>


              <div className="therapy-check-grid">

                {BODY_SYSTEMS.map(
                  (system) => (
                    <label
                      key={
                        system
                      }
                      className={
                        checkedSystems.includes(
                          system
                        )
                          ? "therapy-check-option selected"
                          : "therapy-check-option"
                      }
                    >

                      <input
                        type="checkbox"
                        checked={
                          checkedSystems.includes(
                            system
                          )
                        }
                        onChange={() =>
                          toggleSystem(
                            system
                          )
                        }
                      />


                      <span>
                        {system}
                      </span>

                    </label>
                  )
                )}

              </div>

            </div>


            <div className="therapy-form-section">

              <div className="therapy-form-section-title">
                Barriers observed
              </div>


              <div className="therapy-check-grid">

                {BARRIER_OPTIONS.map(
                  (
                    barrier
                  ) => (
                    <label
                      key={
                        barrier
                      }
                      className={
                        barriers.includes(
                          barrier
                        )
                          ? "therapy-check-option selected"
                          : "therapy-check-option"
                      }
                    >

                      <input
                        type="checkbox"
                        checked={
                          barriers.includes(
                            barrier
                          )
                        }
                        onChange={() =>
                          toggleBarrier(
                            barrier
                          )
                        }
                      />


                      <span>
                        {barrier}
                      </span>

                    </label>
                  )
                )}

              </div>

            </div>


            <div className="therapy-form-grid">

              <label className="therapy-form-wide">

                <span>
                  Strategies or interventions used
                </span>


                <textarea
                  className="textarea"
                  rows={4}
                  value={
                    strategiesUsed
                  }
                  onChange={(
                    event
                  ) =>
                    setStrategiesUsed(
                      event.target
                        .value
                    )
                  }
                  placeholder="Describe prompts, exercises, assistive technology, communication strategies or environmental adjustments..."
                />

              </label>


              <label className="therapy-form-wide">

                <span>
                  Outcome observed
                </span>


                <textarea
                  className="textarea"
                  rows={4}
                  value={
                    outcome
                  }
                  onChange={(
                    event
                  ) =>
                    setOutcome(
                      event.target
                        .value
                    )
                  }
                  placeholder="What changed, improved, remained difficult or requires review?"
                />

              </label>


              <label className="therapy-form-wide">

                <span>
                  Follow-up actions
                </span>


                <textarea
                  className="textarea"
                  rows={3}
                  value={
                    followUp
                  }
                  onChange={(
                    event
                  ) =>
                    setFollowUp(
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. OT review, equipment check, continue strategy, notify coordinator..."
                />

              </label>


              <label className="therapy-form-wide">

                <span>
                  Additional progress notes
                </span>


                <textarea
                  className="textarea"
                  rows={5}
                  value={
                    notes
                  }
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target
                        .value
                    )
                  }
                  placeholder="Record objective, factual and participant-centred notes..."
                />

              </label>

            </div>


            <div className="therapy-form-actions">

              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  void handleSaveTherapySession()
                }
                disabled={
                  saving
                }
              >
                {saving
                  ? "Saving Shared Session…"
                  : "💾 Save Shared Therapy Session"}
              </button>


              <button
                type="button"
                className="therapy-secondary-button"
                onClick={
                  resetSessionForm
                }
                disabled={
                  saving
                }
              >
                Clear Form
              </button>

            </div>

          </TherapyCard>


          <TherapyCard
            title="Recent Therapy Sessions"
            subtitle="Review shared outcomes, barriers and follow-up actions."
            right={
              <StatusBadge
                level={
                  therapySessions.length >
                  0
                    ? "low"
                    : "neutral"
                }
              >
                {
                  therapySessions.length
                }{" "}
                total
              </StatusBadge>
            }
          >

            {sessionsLoading ? (

              <EmptyState
                icon="⏳"
                title="Loading shared therapy history"
                description="Retrieving authorised participant sessions."
              />

            ) : recentTherapySessions.length ===
              0 ? (

              <EmptyState
                icon="🧠"
                title="No therapy sessions recorded"
                description="Record the first shared therapy session using the form above."
              />

            ) : (

              <div className="therapy-session-list">

                {recentTherapySessions.map(
                  (
                    session,
                    index
                  ) => {

                    const canDeleteSession =
                      canManageAllSessions ||
                      session.createdBy ===
                        user?.id;


                    return (
                      <article
                        className="therapy-session-card"
                        key={
                          session.id ||
                          `${session.timestamp}-${index}`
                        }
                      >

                        <div className="therapy-session-timeline">
                          <span />
                        </div>


                        <div className="therapy-session-content">

                          <div className="therapy-session-heading">

                            <div>

                              <strong>
                                {session.discipline ||
                                  "Therapy session"}
                              </strong>


                              <span>
                                {formatDateTime(
                                  session.timestamp ||
                                    session.createdAt
                                )}
                              </span>


                              {session.createdBy ? (
                                <small>
                                  Recorded by:{" "}
                                  {session.createdBy ===
                                  user?.id
                                    ? "You"
                                    : "Authorised team member"}
                                </small>
                              ) : null}

                            </div>


                            <StatusBadge
                              level={
                                session.progressSignal ===
                                "Improving"
                                  ? "low"
                                  : session.progressSignal ===
                                    "Declining"
                                  ? "high"
                                  : session.progressSignal ===
                                    "Variable"
                                  ? "medium"
                                  : "neutral"
                              }
                            >
                              {session.progressSignal ||
                                "Not assessed"}
                            </StatusBadge>

                          </div>


                          <div className="therapy-session-meta">

                            {session.mood ? (
                              <span>
                                Mood:{" "}
                                {
                                  session.mood
                                }
                              </span>
                            ) : null}


                            {session.participationLevel ? (
                              <span>
                                Participation:{" "}
                                {
                                  session.participationLevel
                                }
                              </span>
                            ) : null}


                            {asArray(
                              session.bodySystems
                            ).length ? (
                              <span>
                                Systems:{" "}
                                {session.bodySystems.join(
                                  ", "
                                )}
                              </span>
                            ) : null}

                          </div>


                          {session.sessionGoal ? (
                            <div className="therapy-session-block">
                              <b>
                                Goal
                              </b>

                              <p>
                                {
                                  session.sessionGoal
                                }
                              </p>
                            </div>
                          ) : null}


                          {session.strategiesUsed ? (
                            <div className="therapy-session-block">
                              <b>
                                Strategies / interventions
                              </b>

                              <p>
                                {
                                  session.strategiesUsed
                                }
                              </p>
                            </div>
                          ) : null}


                          {session.outcome ? (
                            <div className="therapy-session-block">
                              <b>
                                Outcome
                              </b>

                              <p>
                                {
                                  session.outcome
                                }
                              </p>
                            </div>
                          ) : null}


                          {session.followUp ? (
                            <div className="therapy-session-block">
                              <b>
                                Follow-up
                              </b>

                              <p>
                                {
                                  session.followUp
                                }
                              </p>
                            </div>
                          ) : null}


                          {session.notes ? (
                            <div className="therapy-session-block">
                              <b>
                                Progress notes
                              </b>

                              <p>
                                {
                                  session.notes
                                }
                              </p>
                            </div>
                          ) : null}


                          <div className="therapy-session-footer">

                            <span>
                              {asArray(
                                session.barriers
                              ).length
                                ? `${
                                    session
                                      .barriers
                                      .length
                                  } barrier${
                                    session
                                      .barriers
                                      .length ===
                                    1
                                      ? ""
                                      : "s"
                                  } recorded`
                                : "No barriers recorded"}
                            </span>


                            {canDeleteSession ? (
                              <button
                                type="button"
                                disabled={
                                  deletingSessionId ===
                                  session.id
                                }
                                onClick={() =>
                                  void handleDeleteTherapySession(
                                    session
                                  )
                                }
                              >
                                {deletingSessionId ===
                                session.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </button>
                            ) : (
                              <small>
                                Shared record
                              </small>
                            )}

                          </div>

                        </div>

                      </article>
                    );
                  }
                )}

              </div>

            )}

          </TherapyCard>

        </div>


        <aside className="therapy-v2-secondary">

          <TherapyCard
            title="Purpose Plan Connection"
            subtitle="Current reviewed or approved shared plan information relevant to therapy."
            right={
              <StatusBadge
                level={
                  carePlanLoading
                    ? "neutral"
                    : latestPlan
                    ? "low"
                    : "neutral"
                }
              >
                {carePlanLoading
                  ? "Loading…"
                  : latestPlan
                  ? "Shared plan"
                  : "No current plan"}
              </StatusBadge>
            }
          >

            <div className="therapy-plan-block">
              <span>
                Goals
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : therapyGoals ||
                    "No reviewed or approved therapy goals are recorded."}
              </p>
            </div>


            <div className="therapy-plan-block">
              <span>
                Functional supports
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : functionalSupports ||
                    "No functional supports are recorded in the current shared Purpose Plan."}
              </p>
            </div>


            <div className="therapy-plan-block">
              <span>
                Health and clinical
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : clinicalConsiderations ||
                    "No health or clinical considerations are recorded in the current shared Purpose Plan."}
              </p>
            </div>


            <div className="therapy-plan-block">
              <span>
                Risks and safeguards
              </span>

              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : planRisks ||
                    "No risks or safeguards are recorded in the current shared Purpose Plan."}
              </p>
            </div>

          </TherapyCard>


          <TherapyCard
            title="Clinical & Safety Lens"
            subtitle="Prompts for safe, scope-aware documentation."
          >

            <div className="therapy-guidance-list">

              <div>
                <span>1</span>

                <p>
                  Record objective observations rather than unsupported diagnoses.
                </p>
              </div>


              <div>
                <span>2</span>

                <p>
                  Escalate new pain, falls, breathing changes or neurological concerns.
                </p>
              </div>


              <div>
                <span>3</span>

                <p>
                  Confirm assistive technology is safe, available and used as directed.
                </p>
              </div>


              <div>
                <span>4</span>

                <p>
                  Link each strategy to participant goals, choice and meaningful outcomes.
                </p>
              </div>

            </div>

          </TherapyCard>


          <TherapyCard
            title="Cross-Service Signals"
            subtitle="Recent shared activity recorded in other Theraa Nurse zones."
          >

            <div className="therapy-signal-list">

              {[
                "meds",
                "paramedic",
                "staff",
                "vpn",
              ].map(
                (zone) => {

                  const count =
                    crossZoneSessions.filter(
                      (
                        session
                      ) =>
                        session.zone ===
                        zone
                    ).length;


                  const labels = {
                    meds:
                      "Medication",

                    paramedic:
                      "Paramedic",

                    staff:
                      "Staff Notes",

                    vpn:
                      "Remote Support",
                  };


                  const icons = {
                    meds: "💊",
                    paramedic:
                      "🚑",
                    staff: "📝",
                    vpn: "🔐",
                  };


                  return (
                    <div
                      key={
                        zone
                      }
                    >

                      <span>
                        {icons[zone]}
                      </span>


                      <div>

                        <strong>
                          {
                            labels[
                              zone
                            ]
                          }
                        </strong>


                        <small>
                          {count} entr
                          {count === 1
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

          </TherapyCard>


          <TherapyCard
            title="Therapy Report"
            subtitle="Generate a combined therapy and participant-support summary."
          >

            <label className="therapy-report-field">

              <span>
                Date range
              </span>


              <select
                className="input"
                value={
                  reportRange
                }
                onChange={(
                  event
                ) =>
                  setReportRange(
                    event.target
                      .value
                  )
                }
              >

                <option value="today">
                  Today
                </option>

                <option value="last7">
                  Last 7 days
                </option>

              </select>

            </label>


            <div className="therapy-report-actions">

              <button
                type="button"
                className="btn-primary"
                onClick={
                  handleGenerateReport
                }
              >
                📝 Generate
              </button>


              <button
                type="button"
                className="therapy-secondary-button"
                onClick={
                  handleDownloadReport
                }
              >
                Download
              </button>

            </div>

          </TherapyCard>

        </aside>

      </div>


      {showReport ? (

        <TherapyCard
          title={`Generated Report – ${selectedClient?.name}`}
          subtitle="Review the report before downloading or sharing it."
          className="therapy-report-output-card"
          right={
            <button
              type="button"
              className="therapy-close-button"
              onClick={() =>
                setShowReport(
                  false
                )
              }
            >
              Close
            </button>
          }
        >

          <textarea
            className="textarea therapy-report-output"
            rows={18}
            value={
              reportText
            }
            readOnly
          />

        </TherapyCard>

      ) : null}

    </div>
  );
}