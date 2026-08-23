// src/pages/VpnZone.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useActiveClient,
} from "../context/ActiveClientContext";

import {
  useWorkspace,
} from "../context/WorkspaceContext";

import {
  useAuth,
} from "../context/AuthContext";

import ClientSelectorBar from "../components/ClientSelectorBar";

import {
  createParticipantSession,
  loadSessionsByZone,
} from "../services/sessionService";


export default function VpnZone() {
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

  const fallbackId =
    clients[0]?.id || "";

  const selectedClientId =
    activeClientId || fallbackId;

  const sessionRequestRef =
    useRef(0);

  const [
    remoteType,
    setRemoteType,
  ] = useState("");

  const [
    participants,
    setParticipants,
  ] = useState("");

  const [
    summary,
    setSummary,
  ] = useState("");

  const [
    remoteSessions,
    setRemoteSessions,
  ] = useState([]);

  const [
    loadingSessions,
    setLoadingSessions,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


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


  useEffect(() => {
    /*
     * Invalidate any request belonging
     * to the previous participant.
     */
    sessionRequestRef.current += 1;

    setRemoteSessions([]);
    setErrorMessage("");

    setRemoteType("");
    setParticipants("");
    setSummary("");
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


  const refreshRemoteSessions =
    useCallback(
      async () => {
        if (
          !organisationId ||
          !selectedClientId
        ) {
          setRemoteSessions([]);
          setLoadingSessions(false);
          return;
        }

        const requestId =
          ++sessionRequestRef.current;

        setLoadingSessions(true);
        setErrorMessage("");

        try {
          const loaded =
            await loadSessionsByZone({
              organisationId,

              participantId:
                selectedClientId,

              zone:
                "vpn",
            });

          /*
           * Ignore responses belonging
           * to an older participant.
           */
          if (
            requestId !==
            sessionRequestRef.current
          ) {
            return;
          }

          setRemoteSessions(
            Array.isArray(loaded)
              ? loaded
              : []
          );
        } catch (error) {
          if (
            requestId !==
            sessionRequestRef.current
          ) {
            return;
          }

          console.error(
            "Unable to load Remote Support sessions:",
            error
          );

          setRemoteSessions([]);

          setErrorMessage(
            error?.message ||
              "Unable to load Remote Support sessions."
          );
        } finally {
          if (
            requestId ===
            sessionRequestRef.current
          ) {
            setLoadingSessions(false);
          }
        }
      },
      [
        organisationId,
        selectedClientId,
      ]
    );


  useEffect(() => {
    void refreshRemoteSessions();
  }, [
    refreshRemoteSessions,
  ]);


  async function handleSaveRemote() {
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
        "You must be signed in to save a Remote Support interaction."
      );
      return;
    }

    if (!remoteType) {
      alert(
        "Select a remote session type."
      );
      return;
    }

    if (!summary.trim()) {
      alert(
        "Enter a short session summary."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const created =
        await createParticipantSession({
          organisationId,

          participantId:
            selectedClientId,

          userId:
            user.id,

          zone:
            "vpn",

          sessionData: {
            timestamp:
              new Date().toISOString(),

            remoteType,

            participants:
              participants.trim(),

            summary:
              summary.trim(),

            sessionType:
              "remote_support",

            professionalRole:
              roleLabel ||
              "Workspace Member",

            organisationName:
              organisationName ||
              "",
          },
        });

      /*
       * Immediately place the new
       * shared session at the top.
       */
      setRemoteSessions(
        (current) => [
          created,
          ...current,
        ]
      );

      setRemoteType("");
      setParticipants("");
      setSummary("");

      alert(
        "Remote Support interaction saved to the shared participant record."
      );
    } catch (error) {
      console.error(
        "Unable to save Remote Support interaction:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to save Remote Support interaction."
      );

      alert(
        error?.message ||
          "Unable to save Remote Support interaction."
      );
    } finally {
      setSaving(false);
    }
  }


  if (!clientsReady) {
    return (
      <div className="card">
        <div className="card-title">
          Remote Support
        </div>

        <div className="card-subtitle">
          Loading authorised participants...
        </div>
      </div>
    );
  }


  if (!clients.length) {
    return (
      <div className="card">
        <div className="card-title">
          Remote Support
        </div>

        <div className="card-subtitle">
          No authorised participants are currently available.
        </div>
      </div>
    );
  }


  return (
    <div className="zone-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Remote Support & Virtual Care
          </h1>

          <p className="page-subtitle">
            Record family calls, telehealth,
            case conferences and remote
            coordination as part of the shared
            participant record.
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
            Theraa Nurse · Remote Support
          </div>

          <div>
            {organisationName ||
              "Provider workspace"}
          </div>

          <div>
            {roleLabel ||
              "Workspace Member"}
          </div>
        </div>
      </div>


      <ClientSelectorBar />


      {errorMessage ? (
        <div
          className="auth-error"
          style={{
            marginBottom: 14,
          }}
        >
          {errorMessage}
        </div>
      ) : null}


      <div className="card">
        <div className="card-title">
          Log a Remote Interaction
        </div>

        <div className="card-subtitle">
          Family call, telehealth, case
          conference or remote care
          coordination session.
        </div>


        <label className="section-title-sm">
          Participant

          <select
            className="input"
            value={
              selectedClientId
            }
            onChange={(event) =>
              setActiveClientId(
                event.target.value
              )
            }
          >
            {clients.map(
              (client) => (
                <option
                  key={client.id}
                  value={client.id}
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


        <label className="section-title-sm">
          Remote session type

          <select
            className="input"
            value={remoteType}
            onChange={(event) =>
              setRemoteType(
                event.target.value
              )
            }
          >
            <option value="">
              Select…
            </option>

            <option value="familyCall">
              Family / friend video call
            </option>

            <option value="telehealth">
              Telehealth with GP / specialist
            </option>

            <option value="caseMeeting">
              Case conference / care meeting
            </option>

            <option value="remoteCheckIn">
              Remote participant check-in
            </option>

            <option value="providerCoordination">
              Provider coordination
            </option>
          </select>
        </label>


        <label className="section-title-sm">
          Who joined?

          <input
            className="input"
            value={participants}
            onChange={(event) =>
              setParticipants(
                event.target.value
              )
            }
            placeholder="Example: participant, daughter, GP, OT, Support Coordinator..."
          />
        </label>


        <label className="section-title-sm">
          Summary

          <textarea
            className="textarea"
            rows={5}
            value={summary}
            onChange={(event) =>
              setSummary(
                event.target.value
              )
            }
            placeholder="Record the purpose of the interaction, key observations, decisions, participant response, follow-up actions and any changes requiring team review..."
          />
        </label>


        <button
          type="button"
          className="btn-primary"
          onClick={
            handleSaveRemote
          }
          disabled={saving}
        >
          {saving
            ? "Saving shared interaction..."
            : "💾 Save Remote Interaction"}
        </button>
      </div>


      <div
        className="card"
        style={{
          marginTop: 16,
        }}
      >
        <div className="section-heading-row">
          <div>
            <div className="card-title">
              Recent Remote Support History
            </div>

            <div className="card-subtitle">
              Shared remote interactions
              recorded for{" "}
              {selectedClient?.name ||
                "this participant"}.
            </div>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              void refreshRemoteSessions()
            }
            disabled={loadingSessions}
          >
            {loadingSessions
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>
        </div>


        {loadingSessions &&
        remoteSessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              ⏳
            </div>

            <div>
              Loading shared Remote Support
              history...
            </div>
          </div>
        ) : remoteSessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              🔐
            </div>

            <div>
              No Remote Support interactions
              recorded yet.
            </div>

            <small>
              Save the first shared remote
              interaction above.
            </small>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {remoteSessions.map(
              (session) => (
                <div
                  key={session.id}
                  className="card"
                  style={{
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 16,
                    }}
                  >
                    <div>
                      <strong>
                        {session.remoteType ||
                          session.sessionType ||
                          "Remote interaction"}
                      </strong>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginTop: 4,
                        }}
                      >
                        {session.createdAt ||
                        session.timestamp
                          ? new Date(
                              session.createdAt ||
                                session.timestamp
                            ).toLocaleString()
                          : "Date not recorded"}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      Shared
                    </span>
                  </div>


                  {session.participants ? (
                    <div
                      style={{
                        marginTop: 10,
                      }}
                    >
                      <strong>
                        Participants
                      </strong>

                      <p>
                        {
                          session.participants
                        }
                      </p>
                    </div>
                  ) : null}


                  <div
                    style={{
                      marginTop: 10,
                    }}
                  >
                    <strong>
                      Summary
                    </strong>

                    <p>
                      {session.summary ||
                        "No summary recorded."}
                    </p>
                  </div>


                  {session.professionalRole ? (
                    <small>
                      Recorded by role:{" "}
                      {
                        session.professionalRole
                      }
                    </small>
                  ) : null}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}