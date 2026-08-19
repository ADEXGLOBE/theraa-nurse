// src/pages/MedicationZone.jsx

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


const INITIAL_MEDICATIONS = [
  {
    id: "med-sertraline",
    name: "Sertraline",
    dose: "50 mg",
    route: "Oral",
    frequency: "Morning",
    type: "Regular",
    status: "Not recorded",
  },
  {
    id: "med-metformin",
    name: "Metformin",
    dose: "500 mg",
    route: "Oral",
    frequency: "Twice daily",
    type: "Regular",
    status: "Not recorded",
  },
  {
    id: "med-paracetamol",
    name: "Paracetamol",
    dose: "1 g",
    route: "Oral",
    frequency: "As required",
    type: "PRN",
    status: "Not required",
  },
];


const MEDICATION_STATUSES = [
  "Not recorded",
  "Taken",
  "Prompted",
  "Self-administered",
  "Refused",
  "Missed",
  "Withheld",
  "Not required",
];


const ROUTES = [
  "Oral",
  "Topical",
  "Inhaled",
  "Eye",
  "Ear",
  "Nasal",
  "Injection",
  "Other",
];


const MEDICATION_TYPES = [
  "Regular",
  "PRN",
  "Short course",
  "Supplement",
  "Other",
];


const SIDE_EFFECT_OPTIONS = [
  "Dizziness",
  "Drowsiness",
  "Nausea",
  "Vomiting",
  "Headache",
  "Constipation",
  "Diarrhoea",
  "Skin reaction",
  "Behaviour or mood change",
  "No side effects observed",
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


function uid(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(16)
    .slice(2)}`;
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


function daysAgo(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

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


function getMedicationSessions(
  allSessions,
  clientId
) {
  return asArray(
    allSessions?.[
      clientId
    ]
  ).filter(
    (session) =>
      session?.zone ===
      "meds"
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
      session?.zone
    )
  );
}



function getStatusLevel(status) {
  switch (status) {
    case "Taken":
    case "Prompted":
    case "Self-administered":
    case "Not required":
      return "good";

    case "Refused":
    case "Missed":
    case "Withheld":
      return "danger";

    default:
      return "neutral";
  }
}


function MedicationMetric({
  icon,
  label,
  value,
  detail,
  level = "neutral",
}) {
  return (
    <article
      className={`medication-metric medication-metric-${level}`}
    >
      <div className="medication-metric-icon">
        {icon}
      </div>

      <div className="medication-metric-value">
        {value}
      </div>

      <div className="medication-metric-label">
        {label}
      </div>

      {detail ? (
        <div className="medication-metric-detail">
          {detail}
        </div>
      ) : null}
    </article>
  );
}


function MedicationCard({
  title,
  subtitle,
  right,
  children,
  className = "",
}) {
  return (
    <section
      className={`card medication-v2-card ${className}`}
    >
      <div className="medication-card-header">
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

      <div className="medication-card-body">
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
      className={`medication-status medication-status-${level}`}
    >
      {children}
    </span>
  );
}


function EmptyState({
  icon = "💊",
  title,
  description,
}) {
  return (
    <div className="medication-empty-state">
      <div className="medication-empty-icon">
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


export default function MedicationZone() {
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


  const selectedClientId =
    activeClientId ||
    fallbackId;


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


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    deletingSessionId,
    setDeletingSessionId,
  ] = useState("");


  const [
    medications,
    setMedications,
  ] = useState(
    INITIAL_MEDICATIONS
  );


  const [
    newMedication,
    setNewMedication,
  ] = useState({
    name: "",
    dose: "",
    route: "Oral",
    frequency: "",
    type: "Regular",
  });


  const [
    allergies,
    setAllergies,
  ] = useState("");


  const [
    sideEffects,
    setSideEffects,
  ] = useState([]);


  const [
    prnReason,
    setPrnReason,
  ] = useState("");


  const [
    prnOutcome,
    setPrnOutcome,
  ] = useState("");


  const [
    followUpRequired,
    setFollowUpRequired,
  ] = useState(false);


  const [
    followUpReason,
    setFollowUpReason,
  ] = useState("");


  const [
    prescriberContacted,
    setPrescriberContacted,
  ] = useState(false);


  const [
    pharmacyContacted,
    setPharmacyContacted,
  ] = useState(false);


  const [
    notes,
    setNotes,
  ] = useState("");


  const canManageAllSessions =
    [
      "provider_admin",
      "manager",
    ].includes(role);


  /*
   * ActiveClientContext is the single source of truth
   * for participant selection across Theraa Nurse.
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
   * Clear participant-specific, unsaved medication data
   * immediately when the active participant changes.
   * This prevents one participant's draft from being
   * accidentally saved against another participant.
   */
  useEffect(() => {
    carePlanRequestRef.current += 1;

    setCarePlan(null);
    setCarePlanError("");

    setAllSessions(
      selectedClientId
        ? {
            [selectedClientId]: [],
          }
        : {}
    );

    setSessionError("");

    setMedications(
      INITIAL_MEDICATIONS.map(
        (medication) => ({
          ...medication,
        })
      )
    );

    setNewMedication({
      name: "",
      dose: "",
      route: "Oral",
      frequency: "",
      type: "Regular",
    });

    setAllergies("");
    setSideEffects([]);
    setPrnReason("");
    setPrnOutcome("");
    setFollowUpRequired(false);
    setFollowUpReason("");
    setPrescriberContacted(false);
    setPharmacyContacted(false);
    setNotes("");
  }, [selectedClientId]);


  /*
   * Load the complete shared participant
   * history so cross-service signals work.
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

        setSessionsLoading(
          true
        );

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
           * Ignore stale responses. If the user switches
           * participants before this request finishes, only
           * the newest request is allowed to update the UI.
           */
          if (
            requestId !==
            sessionRequestRef.current
          ) {
            return;
          }

          setAllSessions({
            [participantId]:
              Array.isArray(sessions)
                ? sessions
                : [],
          });
        } catch (error) {
          if (
            requestId !==
            sessionRequestRef.current
          ) {
            return;
          }

          console.error(
            "Unable to load shared medication sessions:",
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
            setSessionsLoading(
              false
            );
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
   * Load the participant's current reviewed or approved
   * Purpose Plan from the shared Supabase workspace.
   *
   * A separate request guard prevents a stale plan response
   * from appearing after the user switches participants.
   */
  const refreshCarePlan =
    useCallback(
      async () => {
        const requestId =
          ++carePlanRequestRef.current;

        const participantId =
          selectedClientId;

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
            "Unable to load shared medication Purpose Plan context:",
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



  const medicationSessions =
    useMemo(
      () =>
        getMedicationSessions(
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


  const recentMedicationSessions =
    medicationSessions.slice(
      0,
      8
    );


  const latestMedicationSession =
    medicationSessions[0] ||
    null;


  const latestSessionDays =
    daysAgo(
      latestMedicationSession
        ?.timestamp ||
        latestMedicationSession
          ?.createdAt
    );


  const planSections =
    carePlan?.sections || {};


  const healthContext =
    safe(
      planSections.healthClinical
    ).trim();


  const medicationRiskContext =
    safe(
      planSections.risks ||
        carePlan?.risks
    ).trim();


  const safeguardsContext =
    safe(
      planSections.safeguardsConsent
    ).trim();


  const currentTakenCount =
    medications.filter(
      (medication) =>
        medication.status ===
          "Taken" ||
        medication.status ===
          "Self-administered" ||
        medication.status ===
          "Prompted"
    ).length;


  const currentIssueCount =
    medications.filter(
      (medication) =>
        medication.status ===
          "Refused" ||
        medication.status ===
          "Missed" ||
        medication.status ===
          "Withheld"
    ).length;


  const historicalFollowUps =
    medicationSessions.filter(
      (session) =>
        session.followUpRequired ||
        session.followUp
    ).length;


  function updateMedication(
    id,
    key,
    value
  ) {
    setMedications(
      (previous) =>
        previous.map(
          (medication) =>
            medication.id ===
            id
              ? {
                  ...medication,
                  [key]:
                    value,
                }
              : medication
        )
    );
  }


  function removeMedication(
    id
  ) {
    setMedications(
      (previous) =>
        previous.filter(
          (medication) =>
            medication.id !==
            id
        )
    );
  }


  function addMedication() {
    if (
      !newMedication.name.trim()
    ) {
      alert(
        "Enter the medication name."
      );

      return;
    }

    setMedications(
      (previous) => [
        ...previous,
        {
          id: uid("med"),

          name:
            newMedication.name.trim(),

          dose:
            newMedication.dose.trim(),

          route:
            newMedication.route,

          frequency:
            newMedication.frequency.trim(),

          type:
            newMedication.type,

          status:
            newMedication.type ===
            "PRN"
              ? "Not required"
              : "Not recorded",
        },
      ]
    );

    setNewMedication({
      name: "",
      dose: "",
      route: "Oral",
      frequency: "",
      type: "Regular",
    });
  }


  function toggleSideEffect(
    sideEffect
  ) {
    setSideEffects(
      (previous) =>
        previous.includes(
          sideEffect
        )
          ? previous.filter(
              (item) =>
                item !==
                sideEffect
            )
          : [
              ...previous,
              sideEffect,
            ]
    );
  }


  function resetMedicationCheck() {
    setMedications(
      (previous) =>
        previous.map(
          (medication) => ({
            ...medication,

            status:
              medication.type ===
              "PRN"
                ? "Not required"
                : "Not recorded",
          })
        )
    );

    setAllergies("");

    setSideEffects([]);

    setPrnReason("");

    setPrnOutcome("");

    setFollowUpRequired(
      false
    );

    setFollowUpReason("");

    setPrescriberContacted(
      false
    );

    setPharmacyContacted(
      false
    );

    setNotes("");
  }


  async function handleSaveMedicationSession() {
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


    if (!user?.id) {
      alert(
        "You must be signed in to save a medication check."
      );

      return;
    }


    const hasRecordedStatus =
      medications.some(
        (medication) =>
          medication.status !==
          "Not recorded"
      );


    if (
      !hasRecordedStatus &&
      !notes.trim() &&
      !followUpRequired
    ) {
      alert(
        "Record at least one medication status, note or follow-up concern."
      );

      return;
    }


    if (
      followUpRequired &&
      !followUpReason.trim()
    ) {
      alert(
        "Please record the reason for the medication follow-up."
      );

      return;
    }


    const timestamp =
      new Date().toISOString();


    const payload = {
      timestamp,

      zone: "meds",

      medications:
        medications.map(
          (medication) => ({
            ...medication,
          })
        ),

      allergies:
        allergies.trim(),

      sideEffects: [
        ...sideEffects,
      ],

      prnReason:
        prnReason.trim(),

      prnOutcome:
        prnOutcome.trim(),

      followUp:
        followUpRequired,

      followUpRequired,

      followUpReason:
        followUpReason.trim(),

      prescriberContacted,

      pharmacyContacted,

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
            "meds",

          sessionData:
            payload,
        }
      );


      await refreshSessions();


      resetMedicationCheck();


      alert(
        "Medication check saved to the shared participant record."
      );
    } catch (error) {
      console.error(
        "Unable to save shared medication check:",
        error
      );


      setSessionError(
        error?.message ||
          "Unable to save medication check."
      );


      alert(
        error?.message ||
          "Unable to save medication check."
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleDeleteSession(
    session
  ) {
    if (!session?.id) {
      return;
    }


    const canDelete =
      canManageAllSessions ||
      session.createdBy ===
        user?.id;


    if (!canDelete) {
      alert(
        "You cannot delete a medication check created by another team member."
      );

      return;
    }


    if (
      !window.confirm(
        "Delete this medication check?"
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
        "Unable to delete shared medication check:",
        error
      );


      setSessionError(
        error?.message ||
          "Unable to delete medication check."
      );


      alert(
        error?.message ||
          "Unable to delete medication check."
      );
    } finally {
      setDeletingSessionId(
        ""
      );
    }
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
    <div className="zone-page medication-v2-page">

      <header className="medication-v2-hero">

        <div>

          <div className="eyebrow">
            Medication & Safety
          </div>


          <h1>
            Medication Support Workspace
          </h1>


          <p>
            Record medication prompting,
            adherence, refusals, PRN outcomes,
            possible side effects and follow-up
            actions while remaining within the
            worker or professional’s authorised
            scope and the participant’s medication
            plan.
          </p>


          <div className="medication-hero-client">

            <div className="medication-client-avatar">
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


        <div className="medication-safety-card">

          <div className="medication-safety-icon">
            🛡️
          </div>


          <strong>
            Scope-safe medication support
          </strong>


          <p>
            Theraa Nurse records observations and
            support actions. It does not prescribe,
            alter doses or replace an authorised
            medication chart.
          </p>


          <small
            style={{
              display: "block",
              marginTop: 10,
            }}
          >
            {roleLabel} ·{" "}
            {organisationName}
          </small>

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


      <section className="medication-metric-grid">

        <MedicationMetric
          icon="💊"
          label="Current Medications"
          value={
            medications.length
          }
          detail={`${
            medications.filter(
              (medication) =>
                medication.type ===
                "PRN"
            ).length
          } PRN medication(s)`}
          level="neutral"
        />


        <MedicationMetric
          icon="✅"
          label="Recorded as Taken"
          value={
            currentTakenCount
          }
          detail="Taken, prompted or self-administered"
          level={
            currentTakenCount >
            0
              ? "good"
              : "neutral"
          }
        />


        <MedicationMetric
          icon="⚠️"
          label="Current Issues"
          value={
            currentIssueCount
          }
          detail="Refused, missed or withheld"
          level={
            currentIssueCount >
            0
              ? "danger"
              : "good"
          }
        />


        <MedicationMetric
          icon="📋"
          label="Medication Checks"
          value={
            medicationSessions.length
          }
          detail={
            sessionsLoading
              ? "Refreshing shared history…"
              : latestSessionDays ==
                null
              ? "No checks recorded"
              : latestSessionDays ===
                0
              ? "Latest check today"
              : `Latest check ${latestSessionDays}d ago`
          }
          level={
            medicationSessions.length >
            0
              ? "good"
              : "neutral"
          }
        />


        <MedicationMetric
          icon="🔔"
          label="Follow-Up History"
          value={
            historicalFollowUps
          }
          detail="Previous shared checks requiring review"
          level={
            historicalFollowUps >
            0
              ? "warning"
              : "good"
          }
        />

      </section>


      <div className="medication-v2-main-grid">

        <div className="medication-v2-primary">


          <MedicationCard
            title="Medication Check"
            subtitle="Record the support provided and the observed outcome for each listed medication."
            right={
              <StatusBadge level="neutral">
                Shared check
              </StatusBadge>
            }
          >

            <label className="medication-participant-field">

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


            <div className="medication-table-wrapper">

              <table className="medication-table">

                <thead>

                  <tr>
                    <th>
                      Medication
                    </th>

                    <th>
                      Dose
                    </th>

                    <th>
                      Route
                    </th>

                    <th>
                      Frequency
                    </th>

                    <th>
                      Type
                    </th>

                    <th>
                      Status
                    </th>

                    <th />
                  </tr>

                </thead>


                <tbody>

                  {medications.map(
                    (
                      medication
                    ) => (

                      <tr
                        key={
                          medication.id
                        }
                      >

                        <td>

                          <input
                            className="medication-table-input"
                            value={
                              medication.name
                            }
                            onChange={(
                              event
                            ) =>
                              updateMedication(
                                medication.id,
                                "name",
                                event.target
                                  .value
                              )
                            }
                          />

                        </td>


                        <td>

                          <input
                            className="medication-table-input"
                            value={
                              medication.dose
                            }
                            onChange={(
                              event
                            ) =>
                              updateMedication(
                                medication.id,
                                "dose",
                                event.target
                                  .value
                              )
                            }
                          />

                        </td>


                        <td>

                          <select
                            className="medication-table-input"
                            value={
                              medication.route
                            }
                            onChange={(
                              event
                            ) =>
                              updateMedication(
                                medication.id,
                                "route",
                                event.target
                                  .value
                              )
                            }
                          >

                            {ROUTES.map(
                              (
                                route
                              ) => (
                                <option
                                  key={
                                    route
                                  }
                                >
                                  {
                                    route
                                  }
                                </option>
                              )
                            )}

                          </select>

                        </td>


                        <td>

                          <input
                            className="medication-table-input"
                            value={
                              medication.frequency
                            }
                            onChange={(
                              event
                            ) =>
                              updateMedication(
                                medication.id,
                                "frequency",
                                event.target
                                  .value
                              )
                            }
                          />

                        </td>


                        <td>

                          <select
                            className="medication-table-input"
                            value={
                              medication.type
                            }
                            onChange={(
                              event
                            ) =>
                              updateMedication(
                                medication.id,
                                "type",
                                event.target
                                  .value
                              )
                            }
                          >

                            {MEDICATION_TYPES.map(
                              (
                                type
                              ) => (
                                <option
                                  key={
                                    type
                                  }
                                >
                                  {
                                    type
                                  }
                                </option>
                              )
                            )}

                          </select>

                        </td>


                        <td>

                          <select
                            className={`medication-status-select medication-status-select-${getStatusLevel(
                              medication.status
                            )}`}
                            value={
                              medication.status
                            }
                            onChange={(
                              event
                            ) =>
                              updateMedication(
                                medication.id,
                                "status",
                                event.target
                                  .value
                              )
                            }
                          >

                            {MEDICATION_STATUSES.map(
                              (
                                status
                              ) => (
                                <option
                                  key={
                                    status
                                  }
                                >
                                  {
                                    status
                                  }
                                </option>
                              )
                            )}

                          </select>

                        </td>


                        <td>

                          <button
                            type="button"
                            className="medication-remove-button"
                            onClick={() =>
                              removeMedication(
                                medication.id
                              )
                            }
                            aria-label={`Remove ${medication.name}`}
                          >
                            ×
                          </button>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>


            <div className="medication-add-panel">

              <div className="medication-add-heading">
                Add medication to this check
              </div>


              <div className="medication-add-grid">

                <input
                  className="input"
                  value={
                    newMedication.name
                  }
                  onChange={(
                    event
                  ) =>
                    setNewMedication(
                      (
                        previous
                      ) => ({
                        ...previous,

                        name:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Medication name"
                />


                <input
                  className="input"
                  value={
                    newMedication.dose
                  }
                  onChange={(
                    event
                  ) =>
                    setNewMedication(
                      (
                        previous
                      ) => ({
                        ...previous,

                        dose:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Dose"
                />


                <select
                  className="input"
                  value={
                    newMedication.route
                  }
                  onChange={(
                    event
                  ) =>
                    setNewMedication(
                      (
                        previous
                      ) => ({
                        ...previous,

                        route:
                          event.target
                            .value,
                      })
                    )
                  }
                >

                  {ROUTES.map(
                    (
                      route
                    ) => (
                      <option
                        key={
                          route
                        }
                      >
                        {route}
                      </option>
                    )
                  )}

                </select>


                <input
                  className="input"
                  value={
                    newMedication.frequency
                  }
                  onChange={(
                    event
                  ) =>
                    setNewMedication(
                      (
                        previous
                      ) => ({
                        ...previous,

                        frequency:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Frequency"
                />


                <select
                  className="input"
                  value={
                    newMedication.type
                  }
                  onChange={(
                    event
                  ) =>
                    setNewMedication(
                      (
                        previous
                      ) => ({
                        ...previous,

                        type:
                          event.target
                            .value,
                      })
                    )
                  }
                >

                  {MEDICATION_TYPES.map(
                    (
                      type
                    ) => (
                      <option
                        key={
                          type
                        }
                      >
                        {type}
                      </option>
                    )
                  )}

                </select>


                <button
                  type="button"
                  className="btn-primary"
                  onClick={
                    addMedication
                  }
                >
                  Add Medication
                </button>

              </div>

            </div>

          </MedicationCard>


          <MedicationCard
            title="Observation & Follow-Up"
            subtitle="Record possible side effects, refusals, PRN outcomes and escalation actions."
          >

            <div className="medication-form-grid">

              <label className="medication-form-wide">

                <span>
                  Known allergies or sensitivities
                </span>


                <input
                  className="input"
                  value={
                    allergies
                  }
                  onChange={(
                    event
                  ) =>
                    setAllergies(
                      event.target
                        .value
                    )
                  }
                  placeholder="Record only confirmed information from authorised records"
                />

              </label>

            </div>


            <div className="medication-form-section">

              <div className="medication-form-section-title">
                Possible side effects or changes observed
              </div>


              <div className="medication-check-grid">

                {SIDE_EFFECT_OPTIONS.map(
                  (
                    sideEffect
                  ) => (

                    <label
                      key={
                        sideEffect
                      }
                      className={
                        sideEffects.includes(
                          sideEffect
                        )
                          ? "medication-check-option selected"
                          : "medication-check-option"
                      }
                    >

                      <input
                        type="checkbox"
                        checked={
                          sideEffects.includes(
                            sideEffect
                          )
                        }
                        onChange={() =>
                          toggleSideEffect(
                            sideEffect
                          )
                        }
                      />


                      <span>
                        {sideEffect}
                      </span>

                    </label>

                  )
                )}

              </div>

            </div>


            <div className="medication-form-grid">

              <label>

                <span>
                  PRN reason
                </span>


                <textarea
                  className="textarea"
                  rows={3}
                  value={
                    prnReason
                  }
                  onChange={(
                    event
                  ) =>
                    setPrnReason(
                      event.target
                        .value
                    )
                  }
                  placeholder="Why was PRN support considered or provided?"
                />

              </label>


              <label>

                <span>
                  PRN outcome
                </span>


                <textarea
                  className="textarea"
                  rows={3}
                  value={
                    prnOutcome
                  }
                  onChange={(
                    event
                  ) =>
                    setPrnOutcome(
                      event.target
                        .value
                    )
                  }
                  placeholder="What outcome was observed and recorded?"
                />

              </label>


              <label className="medication-form-wide">

                <span>
                  Medication notes
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
                  placeholder="Record objective observations, refusals, missed doses, behaviour changes and actions taken..."
                />

              </label>

            </div>


            <div className="medication-followup-panel">

              <label className="medication-followup-toggle">

                <input
                  type="checkbox"
                  checked={
                    followUpRequired
                  }
                  onChange={(
                    event
                  ) =>
                    setFollowUpRequired(
                      event.target
                        .checked
                    )
                  }
                />


                <span>
                  Flag this medication check for
                  coordinator or authorised
                  professional review
                </span>

              </label>


              {followUpRequired ? (

                <>

                  <textarea
                    className="textarea"
                    rows={3}
                    value={
                      followUpReason
                    }
                    onChange={(
                      event
                    ) =>
                      setFollowUpReason(
                        event.target
                          .value
                      )
                    }
                    placeholder="Explain the concern and the follow-up required..."
                  />


                  <div className="medication-contact-options">

                    <label>

                      <input
                        type="checkbox"
                        checked={
                          prescriberContacted
                        }
                        onChange={(
                          event
                        ) =>
                          setPrescriberContacted(
                            event.target
                              .checked
                          )
                        }
                      />

                      Prescriber or authorised clinician contacted

                    </label>


                    <label>

                      <input
                        type="checkbox"
                        checked={
                          pharmacyContacted
                        }
                        onChange={(
                          event
                        ) =>
                          setPharmacyContacted(
                            event.target
                              .checked
                          )
                        }
                      />

                      Pharmacy contacted

                    </label>

                  </div>

                </>

              ) : null}

            </div>


            <div className="medication-form-actions">

              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  void handleSaveMedicationSession()
                }
                disabled={
                  saving
                }
              >
                {saving
                  ? "Saving Shared Check…"
                  : "💾 Save Shared Medication Check"}
              </button>


              <button
                type="button"
                className="medication-secondary-button"
                onClick={
                  resetMedicationCheck
                }
                disabled={
                  saving
                }
              >
                Clear Check
              </button>

            </div>

          </MedicationCard>


          <MedicationCard
            title="Recent Medication Timeline"
            subtitle="Review shared adherence, concerns and follow-up history."
            right={
              <StatusBadge
                level={
                  medicationSessions.length >
                  0
                    ? "good"
                    : "neutral"
                }
              >
                {
                  medicationSessions.length
                }{" "}
                total
              </StatusBadge>
            }
          >

            {sessionsLoading ? (

              <EmptyState
                icon="⏳"
                title="Loading medication history"
                description="Retrieving authorised shared participant medication records."
              />

            ) : recentMedicationSessions.length ===
              0 ? (

              <EmptyState
                icon="💊"
                title="No medication checks recorded"
                description="Save the first shared medication-support check using the form above."
              />

            ) : (

              <div className="medication-session-list">

                {recentMedicationSessions.map(
                  (
                    session,
                    index
                  ) => {

                    const recordedMeds =
                      asArray(
                        session.medications
                      );


                    const issueMeds =
                      recordedMeds.filter(
                        (
                          medication
                        ) =>
                          [
                            "Refused",
                            "Missed",
                            "Withheld",
                          ].includes(
                            medication.status
                          )
                      );


                    const canDeleteSession =
                      canManageAllSessions ||
                      session.createdBy ===
                        user?.id;


                    return (

                      <article
                        className="medication-session-card"
                        key={
                          session.id ||
                          `${session.timestamp}-${index}`
                        }
                      >

                        <div className="medication-session-heading">

                          <div>

                            <strong>
                              Medication Check
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
                              issueMeds.length >
                              0
                                ? "danger"
                                : session.followUpRequired ||
                                  session.followUp
                                ? "warning"
                                : "good"
                            }
                          >
                            {issueMeds.length >
                            0
                              ? `${issueMeds.length} issue${
                                  issueMeds.length ===
                                  1
                                    ? ""
                                    : "s"
                                }`
                              : session.followUpRequired ||
                                session.followUp
                              ? "Follow-up"
                              : "Recorded"}
                          </StatusBadge>

                        </div>


                        <div className="medication-session-med-list">

                          {recordedMeds.map(
                            (
                              medication
                            ) => (

                              <div
                                key={
                                  medication.id ||
                                  `${medication.name}-${medication.dose}`
                                }
                              >

                                <span>
                                  {
                                    medication.name
                                  }

                                  {medication.dose
                                    ? ` ${medication.dose}`
                                    : ""}
                                </span>


                                <StatusBadge
                                  level={getStatusLevel(
                                    medication.status
                                  )}
                                >
                                  {medication.status ||
                                    "Not recorded"}
                                </StatusBadge>

                              </div>

                            )
                          )}

                        </div>


                        {session.allergies ? (
                          <div className="medication-session-block">

                            <b>
                              Allergies / sensitivities
                            </b>

                            <p>
                              {
                                session.allergies
                              }
                            </p>

                          </div>
                        ) : null}


                        {asArray(
                          session.sideEffects
                        ).length ? (

                          <div className="medication-session-block">

                            <b>
                              Observations
                            </b>


                            <p>
                              {session.sideEffects.join(
                                ", "
                              )}
                            </p>

                          </div>

                        ) : null}


                        {session.prnReason ? (

                          <div className="medication-session-block">

                            <b>
                              PRN reason
                            </b>

                            <p>
                              {
                                session.prnReason
                              }
                            </p>

                          </div>

                        ) : null}


                        {session.prnOutcome ? (

                          <div className="medication-session-block">

                            <b>
                              PRN outcome
                            </b>

                            <p>
                              {
                                session.prnOutcome
                              }
                            </p>

                          </div>

                        ) : null}


                        {session.followUpReason ? (

                          <div className="medication-session-block">

                            <b>
                              Follow-up reason
                            </b>


                            <p>
                              {
                                session.followUpReason
                              }
                            </p>

                          </div>

                        ) : null}


                        {session.notes ? (

                          <div className="medication-session-block">

                            <b>
                              Notes
                            </b>

                            <p>
                              {
                                session.notes
                              }
                            </p>

                          </div>

                        ) : null}


                        <div className="medication-session-footer">

                          <span>
                            {session.prescriberContacted
                              ? "Clinician contacted"
                              : session.pharmacyContacted
                              ? "Pharmacy contacted"
                              : "No contact recorded"}
                          </span>


                          {canDeleteSession ? (

                            <button
                              type="button"
                              disabled={
                                deletingSessionId ===
                                session.id
                              }
                              onClick={() =>
                                void handleDeleteSession(
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

                      </article>

                    );
                  }
                )}

              </div>

            )}

          </MedicationCard>

        </div>


        <aside className="medication-v2-secondary">


          <MedicationCard
            title="Purpose Plan Medication Context"
            subtitle="Relevant information from the participant's current reviewed or approved shared Purpose Plan."
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

            <div className="medication-plan-block">

              <span>
                Health and clinical considerations
              </span>


              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : healthContext ||
                    "No reviewed or approved health or clinical medication context is recorded."}
              </p>

            </div>


            <div className="medication-plan-block">

              <span>
                Risks and warning signs
              </span>


              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : medicationRiskContext ||
                    "No medication-related risk information is recorded in the current shared Purpose Plan."}
              </p>

            </div>


            <div className="medication-plan-block">

              <span>
                Consent and safeguards
              </span>


              <p>
                {carePlanLoading
                  ? "Loading shared Purpose Plan context…"
                  : safeguardsContext ||
                    "No consent or safeguard information is recorded in the current shared Purpose Plan."}
              </p>

            </div>

          </MedicationCard>


          <MedicationCard
            title="Medication Safety Checks"
            subtitle="Prompts for safe support and documentation."
          >

            <div className="medication-guidance-list">

              <div>

                <span>
                  1
                </span>

                <p>
                  Confirm the medication against the
                  authorised chart or provider record.
                </p>

              </div>


              <div>

                <span>
                  2
                </span>

                <p>
                  Never alter a dose, time, route or
                  medication instruction without proper
                  authority.
                </p>

              </div>


              <div>

                <span>
                  3
                </span>

                <p>
                  Record refusals, missed medication,
                  possible side effects and actions taken.
                </p>

              </div>


              <div>

                <span>
                  4
                </span>

                <p>
                  Escalate urgent reactions, unexpected
                  deterioration or medication errors
                  according to workplace procedures.
                </p>

              </div>

            </div>

          </MedicationCard>


          <MedicationCard
            title="Cross-Service Signals"
            subtitle="Related shared participant activity across Theraa Nurse."
          >

            <div className="medication-signal-list">

              {[
                {
                  zone:
                    "therapy",

                  label:
                    "Therapy",

                  icon:
                    "🧠",
                },
                {
                  zone:
                    "paramedic",

                  label:
                    "Paramedic",

                  icon:
                    "🚑",
                },
                {
                  zone:
                    "staff",

                  label:
                    "Staff Notes",

                  icon:
                    "📝",
                },
                {
                  zone:
                    "vpn",

                  label:
                    "Remote Support",

                  icon:
                    "🔐",
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

          </MedicationCard>

        </aside>

      </div>

    </div>
  );
}