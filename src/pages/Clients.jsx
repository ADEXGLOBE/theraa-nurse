// src/pages/Clients.jsx
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { useActiveClient } from "../context/ActiveClientContext";

import {
  createParticipant,
  deleteParticipant,
} from "../services/patientAccessService";

import {
  PARTICIPANT_PERMISSION_LEVELS,
  assignParticipant,
  getOrganisationTeam,
  getPermissionLabel,
  listParticipantAssignments,
  removeParticipantAssignment,
  updateParticipantAssignment,
} from "../services/participantAssignmentService";

import {
  getTeamRoleLabel,
} from "../services/teamService";

const emptyForm = {
  name: "",
  age: "",
  dob: "",
  gender: "",
  ndisNumber: "",
  contactNumber: "",
  emergencyContact: "",
  address: "",
  notes: "",
};

function labelText(field) {
  const labels = {
    name: "Participant Name",
    age: "Age",
    dob: "Date of Birth",
    gender: "Gender",
    ndisNumber: "NDIS Number",
    contactNumber: "Contact Number",
    emergencyContact: "Emergency Contact",
    address: "Address",
    notes: "Support Notes",
  };

  return labels[field] || field;
}

function ParticipantCard({
  client,
  selected,
  onSelect,
  onDelete,
  canDelete,
}) {
  return (
    <button
      type="button"
      className={
        selected
          ? "participant-card-pro participant-card-selected"
          : "participant-card-pro"
      }
      onClick={() =>
        onSelect(client.id)
      }
    >
      <div className="participant-card-top">
        <div className="participant-card-avatar">
          {client.name
            ?.charAt(0)
            ?.toUpperCase() || "P"}
        </div>

        <div>
          <div className="participant-card-name">
            {client.name}
          </div>

          <div className="participant-card-status">
            Active Participant
          </div>
        </div>
      </div>

      <div className="participant-card-grid">
        <div>
          <span>Age</span>
          <strong>
            {client.age || "—"}
          </strong>
        </div>

        <div>
          <span>Gender</span>
          <strong>
            {client.gender || "—"}
          </strong>
        </div>

        <div>
          <span>NDIS</span>
          <strong>
            {client.ndisNumber || "—"}
          </strong>
        </div>

        <div>
          <span>Contact</span>
          <strong>
            {client.contactNumber ||
              "—"}
          </strong>
        </div>
      </div>

      {client.notes ? (
        <div className="participant-card-notes">
          <strong>Support Notes</strong>
          <p>{client.notes}</p>
        </div>
      ) : null}

      <div className="participant-card-footer">
        <small>
          Last updated:{" "}
          {client.updatedAt
            ? new Date(
                client.updatedAt
              ).toLocaleString()
            : "—"}
        </small>

        {canDelete ? (
          <button
            type="button"
            className="btn-danger-soft"
            onClick={(event) => {
              event.stopPropagation();

              onDelete(client.id);
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </button>
  );
}

export default function Clients() {
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
    refreshClients,
    clientsReady,
  } = useActiveClient();

  const [form, setForm] =
    useState(emptyForm);

  const [team, setTeam] =
    useState([]);

  const [assignments, setAssignments] =
    useState([]);

  const [selectedTeamMemberId, setSelectedTeamMemberId] =
    useState("");

  const [permissionLevel, setPermissionLevel] =
    useState("contributor");

  const [loadingAssignments, setLoadingAssignments] =
    useState(false);

  const [savingParticipant, setSavingParticipant] =
    useState(false);

  const [savingAssignment, setSavingAssignment] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState("");

  const [message, setMessage] =
    useState("");

  const canCreateParticipant = [
    "provider_admin",
    "manager",
    "support_coordinator",
  ].includes(role);

  const canManageAssignments = [
    "provider_admin",
    "manager",
    "support_coordinator",
  ].includes(role);

  const canDeleteParticipant = [
    "provider_admin",
    "manager",
  ].includes(role);

  const selectedParticipant =
    useMemo(
      () =>
        clients.find(
          (client) =>
            client.id === activeClientId
        ) || null,
      [clients, activeClientId]
    );

  const assignmentRows =
    useMemo(() => {
      return assignments.map(
        (assignment) => {
          const member =
            team.find(
              (person) =>
                person.userId ===
                assignment.user_id
            ) || null;

          return {
            ...assignment,
            member,
          };
        }
      );
    }, [assignments, team]);

  const assignedUserIds =
    useMemo(
      () =>
        new Set(
          assignments.map(
            (assignment) =>
              assignment.user_id
          )
        ),
      [assignments]
    );

  const availableTeam =
    useMemo(
      () =>
        team.filter(
          (member) =>
            member.status ===
              "active" &&
            !assignedUserIds.has(
              member.userId
            )
        ),
      [team, assignedUserIds]
    );

  useEffect(() => {
    if (!canManageAssignments) {
      setTeam([]);
      return;
    }

    let cancelled = false;

    async function loadTeam() {
      try {
        const rows =
          await getOrganisationTeam(
            organisationId
          );

        if (!cancelled) {
          setTeam(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(
            error?.message ||
              "Unable to load organisation team."
          );
        }
      }
    }

    if (organisationId) {
      void loadTeam();
    }

    return () => {
      cancelled = true;
    };
  }, [
    organisationId,
    canManageAssignments,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      if (
        !activeClientId ||
        !canManageAssignments
      ) {
        setAssignments([]);
        return;
      }

      setLoadingAssignments(true);

      try {
        const rows =
          await listParticipantAssignments(
            {
              participantId:
                activeClientId,
              organisationId,
            }
          );

        if (!cancelled) {
          setAssignments(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(
            error?.message ||
              "Unable to load participant access."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAssignments(
            false
          );
        }
      }
    }

    void loadAssignments();

    return () => {
      cancelled = true;
    };
  }, [
    activeClientId,
    organisationId,
    canManageAssignments,
  ]);

  useEffect(() => {
    if (
      availableTeam.length &&
      !availableTeam.some(
        (member) =>
          member.userId ===
          selectedTeamMemberId
      )
    ) {
      setSelectedTeamMemberId(
        availableTeam[0].userId
      );
    }

    if (!availableTeam.length) {
      setSelectedTeamMemberId("");
    }
  }, [
    availableTeam,
    selectedTeamMemberId,
  ]);

  function clearMessages() {
    setErrorMsg("");
    setMessage("");
  }

  function updateField(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function handleAddParticipant() {
    clearMessages();

    if (!canCreateParticipant) {
      setErrorMsg(
        "Your role cannot create participants."
      );
      return;
    }

    if (!form.name.trim()) {
      setErrorMsg(
        "Participant name is required."
      );
      return;
    }

    setSavingParticipant(true);

    try {
      const created =
        await createParticipant({
          organisationId,
          userId: user?.id,
          participant: form,
        });

      setForm(emptyForm);

      await refreshClients();

      setActiveClientId(created.id);

      setMessage(
        `${created.name} was added to ${organisationName}.`
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Participant could not be added."
      );
    } finally {
      setSavingParticipant(false);
    }
  }

  async function handleDeleteParticipant(
    participantId
  ) {
    if (!canDeleteParticipant) {
      return;
    }

    const participant =
      clients.find(
        (client) =>
          client.id === participantId
      );

    const confirmed =
      window.confirm(
        `Delete ${
          participant?.name ||
          "this participant"
        }?\n\nThis will also remove linked assignments and shared participant records.`
      );

    if (!confirmed) return;

    clearMessages();

    try {
      await deleteParticipant({
        participantId,
        organisationId,
      });

      await refreshClients();

      setMessage(
        "Participant deleted."
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Participant could not be deleted."
      );
    }
  }

  async function refreshAssignments() {
    if (!activeClientId) {
      setAssignments([]);
      return;
    }

    const rows =
      await listParticipantAssignments({
        participantId:
          activeClientId,
        organisationId,
      });

    setAssignments(rows);
  }

  async function handleAssignMember() {
    if (
      !activeClientId ||
      !selectedTeamMemberId
    ) {
      return;
    }

    clearMessages();
    setSavingAssignment(true);

    try {
      await assignParticipant({
        organisationId,
        participantId:
          activeClientId,
        teamMemberId:
          selectedTeamMemberId,
        assignedBy: user?.id,
        permissionLevel,
      });

      await refreshAssignments();

      const member =
        team.find(
          (item) =>
            item.userId ===
            selectedTeamMemberId
        );

      setMessage(
        `${
          member?.fullName ||
          "Team member"
        } now has access to ${
          selectedParticipant?.name ||
          "this participant"
        }.`
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Participant access could not be assigned."
      );
    } finally {
      setSavingAssignment(false);
    }
  }

  async function handlePermissionChange(
    assignmentId,
    nextPermission
  ) {
    clearMessages();

    try {
      await updateParticipantAssignment({
        assignmentId,
        permissionLevel:
          nextPermission,
      });

      await refreshAssignments();

      setMessage(
        "Participant permission updated."
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Permission could not be updated."
      );
    }
  }

  async function handleRemoveAssignment(
    assignment
  ) {
    const member =
      team.find(
        (item) =>
          item.userId ===
          assignment.user_id
      );

    if (
      !window.confirm(
        `Remove ${
          member?.fullName ||
          "this team member"
        } from ${
          selectedParticipant?.name ||
          "this participant"
        }?`
      )
    ) {
      return;
    }

    clearMessages();

    try {
      await removeParticipantAssignment(
        assignment.id
      );

      await refreshAssignments();

      setMessage(
        "Participant access removed."
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Participant access could not be removed."
      );
    }
  }

  return (
    <div className="zone-page participants-page">
      <div className="participants-hero">
        <div>
          <div className="eyebrow">
            Shared Participant Management
          </div>

          <h1>Participants</h1>

          <p>
            Create organisation-owned
            participant records and control
            exactly which authorised team
            members can access them.
          </p>

          <div className="participant-workspace-badge">
            {organisationName} ·{" "}
            {roleLabel}
          </div>
        </div>

        <div className="participants-count-card">
          <div className="count-number">
            {clients.length}
          </div>

          <div className="count-label">
            Participants
          </div>

          <small>
            Available to this workspace
          </small>
        </div>
      </div>

      {errorMsg ? (
        <div className="auth-error">
          {errorMsg}
        </div>
      ) : null}

      {message ? (
        <div className="auth-success">
          {message}
        </div>
      ) : null}

      <div className="participants-v3-grid">
        <div className="participants-v3-left">
          {canCreateParticipant ? (
            <section className="card premium-card">
              <div className="card-title">
                Add Participant
              </div>

              <div className="card-subtitle">
                This record belongs to{" "}
                {organisationName}, not an
                individual staff account.
              </div>

              <div className="form-grid-pro">
                {Object.keys(
                  emptyForm
                ).map((field) => (
                  <label
                    key={field}
                    className={
                      field ===
                        "notes" ||
                      field ===
                        "address"
                        ? "form-wide"
                        : ""
                    }
                  >
                    <span>
                      {labelText(field)}
                    </span>

                    {field ===
                      "notes" ||
                    field ===
                      "address" ? (
                      <textarea
                        className="textarea"
                        rows={
                          field === "notes"
                            ? 4
                            : 3
                        }
                        value={
                          form[field]
                        }
                        onChange={(
                          event
                        ) =>
                          updateField(
                            field,
                            event.target
                              .value
                          )
                        }
                      />
                    ) : (
                      <input
                        className="input"
                        type={
                          field === "dob"
                            ? "date"
                            : "text"
                        }
                        value={
                          form[field]
                        }
                        onChange={(
                          event
                        ) =>
                          updateField(
                            field,
                            event.target
                              .value
                          )
                        }
                      />
                    )}
                  </label>
                ))}
              </div>

              <button
                type="button"
                className="btn-primary btn-wide"
                onClick={() =>
                  void handleAddParticipant()
                }
                disabled={
                  savingParticipant
                }
              >
                {savingParticipant
                  ? "Saving Participant…"
                  : "Save Shared Participant"}
              </button>
            </section>
          ) : null}

          <section className="card premium-card">
            <div className="section-heading-row">
              <div>
                <div className="card-title">
                  Workspace Participants
                </div>

                <div className="card-subtitle">
                  {role ===
                    "provider_admin" ||
                  role === "manager"
                    ? "You have organisation-wide participant visibility."
                    : "Only participants assigned to your account appear here."}
                </div>
              </div>
            </div>

            {!clientsReady ? (
              <div className="empty-state">
                Loading participants…
              </div>
            ) : clients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  👥
                </div>

                <div>
                  No shared participants
                  available.
                </div>

                <small>
                  {canCreateParticipant
                    ? "Add your first participant above."
                    : "Ask your coordinator or manager to assign participant access."}
                </small>
              </div>
            ) : (
              <div className="participant-card-list">
                {clients.map(
                  (client) => (
                    <ParticipantCard
                      key={client.id}
                      client={client}
                      selected={
                        activeClientId ===
                        client.id
                      }
                      onSelect={
                        setActiveClientId
                      }
                      onDelete={
                        handleDeleteParticipant
                      }
                      canDelete={
                        canDeleteParticipant
                      }
                    />
                  )
                )}
              </div>
            )}
          </section>
        </div>

        {canManageAssignments ? (
          <aside className="participants-v3-right">
            <section className="card premium-card participant-access-card">
              <div className="card-title">
                Participant Access
              </div>

              <div className="card-subtitle">
                Assign workers,
                coordinators, nurses and
                allied-health staff.
              </div>

              {!selectedParticipant ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    🔐
                  </div>

                  <div>
                    Select a participant.
                  </div>
                </div>
              ) : (
                <>
                  <div className="participant-access-person">
                    <div className="participant-card-avatar">
                      {selectedParticipant.name
                        ?.charAt(0)
                        ?.toUpperCase() ||
                        "P"}
                    </div>

                    <div>
                      <strong>
                        {
                          selectedParticipant.name
                        }
                      </strong>

                      <span>
                        Configure authorised
                        team access
                      </span>
                    </div>
                  </div>

                  <div className="participant-assignment-form">
                    <label>
                      <span>
                        Team member
                      </span>

                      <select
                        className="input"
                        value={
                          selectedTeamMemberId
                        }
                        onChange={(
                          event
                        ) =>
                          setSelectedTeamMemberId(
                            event.target
                              .value
                          )
                        }
                        disabled={
                          !availableTeam.length
                        }
                      >
                        {!availableTeam.length ? (
                          <option value="">
                            All active team
                            members are assigned
                          </option>
                        ) : null}

                        {availableTeam.map(
                          (member) => (
                            <option
                              key={
                                member.userId
                              }
                              value={
                                member.userId
                              }
                            >
                              {
                                member.fullName
                              }{" "}
                              —{" "}
                              {getTeamRoleLabel(
                                member.role
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      <span>
                        Permission
                      </span>

                      <select
                        className="input"
                        value={
                          permissionLevel
                        }
                        onChange={(
                          event
                        ) =>
                          setPermissionLevel(
                            event.target
                              .value
                          )
                        }
                      >
                        {PARTICIPANT_PERMISSION_LEVELS.map(
                          (item) => (
                            <option
                              key={
                                item.value
                              }
                              value={
                                item.value
                              }
                            >
                              {
                                item.label
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <button
                      type="button"
                      className="btn-primary"
                      disabled={
                        !selectedTeamMemberId ||
                        savingAssignment
                      }
                      onClick={() =>
                        void handleAssignMember()
                      }
                    >
                      {savingAssignment
                        ? "Assigning…"
                        : "Assign Team Member"}
                    </button>
                  </div>

                  <div className="participant-assignment-heading">
                    Assigned Team
                  </div>

                  {loadingAssignments ? (
                    <div className="empty-state">
                      Loading access…
                    </div>
                  ) : assignmentRows.length ===
                    0 ? (
                    <div className="empty-state compact">
                      No staff assignments yet.
                    </div>
                  ) : (
                    <div className="participant-assignment-list">
                      {assignmentRows.map(
                        (assignment) => (
                          <article
                            className="participant-assignment-row"
                            key={
                              assignment.id
                            }
                          >
                            <div className="participant-assignment-avatar">
                              {assignment.member
                                ?.fullName
                                ?.charAt(0)
                                ?.toUpperCase() ||
                                "T"}
                            </div>

                            <div className="participant-assignment-main">
                              <strong>
                                {assignment
                                  .member
                                  ?.fullName ||
                                  "Team Member"}
                              </strong>

                              <span>
                                {getTeamRoleLabel(
                                  assignment
                                    .member
                                    ?.role
                                )}
                              </span>

                              <small>
                                {assignment
                                  .member
                                  ?.email ||
                                  ""}
                              </small>
                            </div>

                            <select
                              className="participant-permission-select"
                              value={
                                assignment.permission_level ||
                                "contributor"
                              }
                              onChange={(
                                event
                              ) =>
                                void handlePermissionChange(
                                  assignment.id,
                                  event.target
                                    .value
                                )
                              }
                            >
                              {PARTICIPANT_PERMISSION_LEVELS.map(
                                (
                                  item
                                ) => (
                                  <option
                                    key={
                                      item.value
                                    }
                                    value={
                                      item.value
                                    }
                                  >
                                    {
                                      item.label
                                    }
                                  </option>
                                )
                              )}
                            </select>

                            <button
                              type="button"
                              className="btn-danger-soft"
                              onClick={() =>
                                void handleRemoveAssignment(
                                  assignment
                                )
                              }
                            >
                              Remove
                            </button>
                          </article>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="card premium-card">
              <div className="card-title">
                Access Levels
              </div>

              <div className="participant-permission-guide">
                {PARTICIPANT_PERMISSION_LEVELS.map(
                  (item) => (
                    <div key={item.value}>
                      <strong>
                        {item.label}
                      </strong>

                      <span>
                        {
                          item.description
                        }
                      </span>
                    </div>
                  )
                )}
              </div>
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}