// src/pages/ParamedicZone.jsx

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "../context/AuthContext";

import {
  useWorkspace,
} from "../context/WorkspaceContext";

import {
  useActiveClient,
} from "../context/ActiveClientContext";

import ClientSelectorBar from "../components/ClientSelectorBar";

import {
  createParticipantSession,
} from "../services/sessionService";


const EMPTY_VITALS = {
  bpSystolic: "",
  bpDiastolic: "",
  hr: "",
  rr: "",
  spo2: "",
  temp: "",
};


function clean(value) {
  return String(
    value ?? ""
  ).trim();
}


function validateVitals(vitals) {
  const warnings = [];

  const systolic =
    Number(vitals.bpSystolic);

  const diastolic =
    Number(vitals.bpDiastolic);

  const hr =
    Number(vitals.hr);

  const rr =
    Number(vitals.rr);

  const spo2 =
    Number(vitals.spo2);

  const temp =
    Number(vitals.temp);


  /*
   * These are documentation prompts only.
   * They do not make clinical decisions.
   */

  if (
    vitals.bpSystolic &&
    (
      !Number.isFinite(systolic) ||
      systolic <= 0
    )
  ) {
    warnings.push(
      "Check systolic blood pressure."
    );
  }

  if (
    vitals.bpDiastolic &&
    (
      !Number.isFinite(diastolic) ||
      diastolic <= 0
    )
  ) {
    warnings.push(
      "Check diastolic blood pressure."
    );
  }

  if (
    vitals.hr &&
    (
      !Number.isFinite(hr) ||
      hr <= 0
    )
  ) {
    warnings.push(
      "Check heart rate."
    );
  }

  if (
    vitals.rr &&
    (
      !Number.isFinite(rr) ||
      rr <= 0
    )
  ) {
    warnings.push(
      "Check respiratory rate."
    );
  }

  if (
    vitals.spo2 &&
    (
      !Number.isFinite(spo2) ||
      spo2 < 0 ||
      spo2 > 100
    )
  ) {
    warnings.push(
      "SpO₂ must be between 0 and 100."
    );
  }

  if (
    vitals.temp &&
    (
      !Number.isFinite(temp) ||
      temp <= 0
    )
  ) {
    warnings.push(
      "Check recorded temperature."
    );
  }

  return warnings;
}


export default function ParamedicZone() {
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
    clientsError,
    activeClientId,
    setActiveClientId,
  } = useActiveClient();


  const fallbackId =
    clients[0]?.id || "";


  /*
   * ActiveClientContext is the single participant
   * selection source across Theraa Nurse V3.
   */
  const selectedClientId =
    activeClientId ||
    fallbackId;


  const [
    calloutType,
    setCalloutType,
  ] = useState("");


  const [
    sceneSafety,
    setSceneSafety,
  ] = useState("");


  const [
    handover,
    setHandover,
  ] = useState("");


  const [
    vitals,
    setVitals,
  ] = useState({
    ...EMPTY_VITALS,
  });


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    saveError,
    setSaveError,
  ] = useState("");


  const [
    saveSuccess,
    setSaveSuccess,
  ] = useState("");


  /*
   * Establish the first authorised participant if
   * ActiveClientContext does not already have one.
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
   * Never carry a paramedic form from Participant A
   * into Participant B.
   */
  useEffect(() => {
    setCalloutType("");
    setSceneSafety("");
    setHandover("");

    setVitals({
      ...EMPTY_VITALS,
    });

    setSaveError("");
    setSaveSuccess("");
  }, [
    selectedClientId,
  ]);


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


  function updateVital(
    key,
    value
  ) {
    setVitals(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );
  }


  function resetForm() {
    setCalloutType("");
    setSceneSafety("");
    setHandover("");

    setVitals({
      ...EMPTY_VITALS,
    });
  }


  async function handleSave() {
    if (!organisationId) {
      alert(
        "No provider workspace is active."
      );

      return;
    }


    if (!selectedClientId) {
      alert(
        "Select a participant first."
      );

      return;
    }


    if (!user?.id) {
      alert(
        "You must be signed in to save a paramedic session."
      );

      return;
    }


    if (!clean(calloutType)) {
      alert(
        "Select a callout type."
      );

      return;
    }


    if (!clean(handover)) {
      alert(
        "Enter the SBAR handover before saving."
      );

      return;
    }


    const vitalWarnings =
      validateVitals(
        vitals
      );


    if (
      vitalWarnings.length >
      0
    ) {
      alert(
        vitalWarnings.join(
          "\n"
        )
      );

      return;
    }


    setSaving(true);
    setSaveError("");
    setSaveSuccess("");


    try {
      const sessionData = {
        timestamp:
          new Date().toISOString(),

        sessionType:
          "Paramedic / Emergency Support",

        calloutType,

        sceneSafety:
          clean(sceneSafety),

        handover:
          clean(handover),

        vitals: {
          bpSystolic:
            clean(
              vitals.bpSystolic
            ),

          bpDiastolic:
            clean(
              vitals.bpDiastolic
            ),

          hr:
            clean(
              vitals.hr
            ),

          rr:
            clean(
              vitals.rr
            ),

          spo2:
            clean(
              vitals.spo2
            ),

          temp:
            clean(
              vitals.temp
            ),
        },

        participantSnapshot: {
          name:
            selectedClient?.name ||
            "",

          age:
            selectedClient?.age ||
            "",

          ndisNumber:
            selectedClient?.ndisNumber ||
            "",
        },

        /*
         * Useful later for Timeline,
         * Knowledge Engine and reporting.
         */
        documentationType:
          "paramedic",

        sharedEntry:
          true,
      };


      await createParticipantSession({
        organisationId,

        participantId:
          selectedClientId,

        userId:
          user.id,

        zone:
          "paramedic",

        sessionData,
      });


      setSaveSuccess(
        "Paramedic session saved to the shared participant record."
      );


      resetForm();


      alert(
        "Paramedic session saved!"
      );
    } catch (error) {
      console.error(
        "Unable to save shared paramedic session:",
        error
      );


      const message =
        error?.message ||
        "Unable to save the paramedic session.";


      setSaveError(
        message
      );


      alert(
        message
      );
    } finally {
      setSaving(false);
    }
  }


  if (!clientsReady) {
    return (
      <div className="card">
        <div className="card-title">
          Paramedic View
        </div>

        <div className="card-subtitle">
          Loading authorised participants...
        </div>
      </div>
    );
  }


  if (
    clientsError
  ) {
    return (
      <div className="card">
        <div className="card-title">
          Paramedic View
        </div>

        <div className="auth-error">
          {clientsError}
        </div>
      </div>
    );
  }


  if (!clients.length) {
    return (
      <div className="card">
        <div className="card-title">
          Paramedic View
        </div>

        <div className="card-subtitle">
          No authorised participants are currently
          available in this workspace.
        </div>

        <small>
          Ask a Provider Admin or coordinator to create
          or assign participant access.
        </small>
      </div>
    );
  }


  return (
    <div className="zone-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            Emergency & Clinical Documentation
          </div>

          <h1 className="page-title">
            Paramedic View
          </h1>

          <p className="page-subtitle">
            Capture callout type, scene safety, vitals
            and SBAR handover in the participant's
            shared Theraa Nurse record.
          </p>


          {selectedClient ? (
            <div
              style={{
                fontSize: 12,
                color: "#4b5563",
                marginTop: 4,
              }}
            >
              Participant:{" "}
              <strong>
                {selectedClient.name}
              </strong>

              {selectedClient.age
                ? ` (${selectedClient.age} yrs)`
                : ""}
            </div>
          ) : null}
        </div>


        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            textAlign: "right",
          }}
        >
          <div>
            Theraa Nurse · Paramedic & Triage Support
          </div>

          <strong>
            {organisationName ||
              "Provider workspace"}
          </strong>

          <div>
            {roleLabel ||
              "Workspace Member"}
          </div>
        </div>
      </div>


      <ClientSelectorBar />


      {saveError ? (
        <div
          className="auth-error"
          style={{
            marginBottom: 14,
          }}
        >
          {saveError}
        </div>
      ) : null}


      {saveSuccess ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 12,
            background:
              "rgba(16, 185, 129, 0.08)",
          }}
        >
          ✅ {saveSuccess}
        </div>
      ) : null}


      <div className="two-column">
        <div className="stack">

          {/* =====================================================
              CALLOUT
          ====================================================== */}

          <div className="card">
            <div className="card-title">
              Callout & Participant
            </div>

            <div className="card-subtitle">
              Select the participant and record why
              emergency support is involved.
            </div>


            <label className="block-label">
              Participant

              <select
                className="input"
                value={
                  selectedClientId
                }
                onChange={(
                  event
                ) =>
                  setActiveClientId(
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
            </label>


            <label className="block-label">
              Callout type

              <select
                className="input"
                value={
                  calloutType
                }
                onChange={(
                  event
                ) =>
                  setCalloutType(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Select…
                </option>

                <option value="mh-crisis">
                  Mental health crisis
                </option>

                <option value="behavioural">
                  Behavioural escalation
                </option>

                <option value="medication">
                  Medication issue / overdose
                </option>

                <option value="falls">
                  Fall / injury
                </option>

                <option value="medical">
                  Medical deterioration
                </option>

                <option value="welfare">
                  Welfare check
                </option>
              </select>
            </label>
          </div>


          {/* =====================================================
              SCENE SAFETY
          ====================================================== */}

          <div className="card">
            <div className="card-title">
              Scene Safety / Hazards
            </div>

            <div className="card-subtitle">
              Record observed environmental or behavioural
              hazards relevant to emergency response.
            </div>


            <textarea
              className="textarea"
              rows={5}
              value={
                sceneSafety
              }
              onChange={(
                event
              ) =>
                setSceneSafety(
                  event.target.value
                )
              }
              placeholder="Example: aggressive behaviour, unsafe environment, drugs/alcohol, pets, access issues or other hazards..."
            />
          </div>
        </div>


        <div className="stack">

          {/* =====================================================
              VITALS
          ====================================================== */}

          <div className="card">
            <div className="card-title">
              Vitals Snapshot
            </div>

            <div className="card-subtitle">
              Record observations obtained within your
              role, scope and organisational procedure.
            </div>


            <div className="grid-2">
              {[
                {
                  key:
                    "bpSystolic",
                  label:
                    "BP systolic",
                },
                {
                  key:
                    "bpDiastolic",
                  label:
                    "BP diastolic",
                },
                {
                  key:
                    "hr",
                  label:
                    "Heart rate (bpm)",
                },
                {
                  key:
                    "rr",
                  label:
                    "Respiratory rate",
                },
                {
                  key:
                    "spo2",
                  label:
                    "SpO₂ (%)",
                },
                {
                  key:
                    "temp",
                  label:
                    "Temperature (°C)",
                },
              ].map(
                (vital) => (
                  <label
                    key={
                      vital.key
                    }
                    className="section-title-sm"
                  >
                    {vital.label}

                    <input
                      className="input"
                      type="number"
                      value={
                        vitals[
                          vital.key
                        ]
                      }
                      onChange={(
                        event
                      ) =>
                        updateVital(
                          vital.key,
                          event
                            .target
                            .value
                        )
                      }
                    />
                  </label>
                )
              )}
            </div>
          </div>


          {/* =====================================================
              SBAR
          ====================================================== */}

          <div className="card">
            <div className="card-title">
              SBAR Handover
            </div>

            <div className="card-subtitle">
              Record Situation, Background, Assessment
              and Recommendation clearly for handover.
            </div>


            <textarea
              className="textarea"
              rows={7}
              value={
                handover
              }
              onChange={(
                event
              ) =>
                setHandover(
                  event.target.value
                )
              }
              placeholder={
                "S: Situation...\n\n" +
                "B: Background...\n\n" +
                "A: Assessment...\n\n" +
                "R: Recommendation..."
              }
            />


            <button
              type="button"
              className="btn-primary"
              onClick={
                handleSave
              }
              disabled={
                saving
              }
            >
              {saving
                ? "Saving shared session…"
                : "💾 Save Shared Paramedic Session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}