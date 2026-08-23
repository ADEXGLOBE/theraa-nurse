// src/features/workforce/RosterBoard.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useActiveClient } from "../../context/ActiveClientContext";

import {
  getTeamRoleLabel,
  listOrganisationInvitations,
  listOrganisationMembers,
} from "../../services/teamService";

import {
  createRosterShift,
  deleteRosterShift,
  getRosterStatusLabel,
  listRosterShifts,
  updateRosterShiftStatus,
} from "../../services/rosterService";


const EMPTY_SHIFT = {
  participantId: "",
  staffUserId: "",
  serviceType: "Support Shift",
  shiftDate: "",
  startTime: "09:00",
  endTime: "10:00",
  location: "",
  notes: "",
};


const SERVICE_TYPES = [
  "Support Shift",
  "Community Access",
  "Personal Care",
  "Medication Support",
  "Therapy Support",
  "Transport",
  "Domestic Assistance",
  "Social & Community Participation",
  "Clinical Support",
  "Telehealth / Remote Support",
  "Case Conference",
  "Other",
];


function toDateInput(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function startOfWeek(value = new Date()) {
  const date =
    value instanceof Date
      ? new Date(value)
      : new Date(value);

  date.setHours(0, 0, 0, 0);

  const day =
    date.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  date.setDate(
    date.getDate() + difference
  );

  return date;
}


function addDays(date, days) {
  const next =
    new Date(date);

  next.setDate(
    next.getDate() + days
  );

  return next;
}


function formatDayHeading(date) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      weekday: "short",
      day: "numeric",
      month: "short",
    }
  ).format(date);
}


function formatWeekRange(start) {
  const end =
    addDays(start, 6);

  const startLabel =
    new Intl.DateTimeFormat(
      undefined,
      {
        day: "numeric",
        month: "short",
      }
    ).format(start);

  const endLabel =
    new Intl.DateTimeFormat(
      undefined,
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    ).format(end);

  return `${startLabel} – ${endLabel}`;
}


function formatTime(value) {
  if (!value) {
    return "—";
  }

  const parts =
    String(value).split(":");

  const hours =
    Number(parts[0]);

  const minutes =
    Number(parts[1] || 0);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return value;
  }

  const date =
    new Date();

  date.setHours(
    hours,
    minutes,
    0,
    0
  );

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}


function shortId(value) {
  if (!value) {
    return "Unknown";
  }

  return `${String(value).slice(
    0,
    8
  )}…`;
}


function statusClass(status) {
  switch (status) {
    case "completed":
      return "roster-status-completed";

    case "in_progress":
      return "roster-status-progress";

    case "cancelled":
      return "roster-status-cancelled";

    case "draft":
      return "roster-status-draft";

    default:
      return "roster-status-scheduled";
  }
}


function RosterStat({
  icon,
  value,
  label,
}) {
  return (
    <div className="team-stat-card">
      <div className="team-stat-icon">
        {icon}
      </div>

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>
    </div>
  );
}


export default function RosterBoard() {
  const {
    user,
  } = useAuth();

  const {
    organisationId,
    role,
  } = useWorkspace();

  const {
    clients,
    clientsReady,
    activeClientId,
  } = useActiveClient();


  const [
    weekStart,
    setWeekStart,
  ] = useState(
    startOfWeek(new Date())
  );


  const [
    members,
    setMembers,
  ] = useState([]);


  const [
    invitations,
    setInvitations,
  ] = useState([]);


  const [
    shifts,
    setShifts,
  ] = useState([]);


  const [
    form,
    setForm,
  ] = useState(() => ({
    ...EMPTY_SHIFT,

    participantId:
      activeClientId || "",

    shiftDate:
      toDateInput(
        new Date()
      ),
  }));


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  const canManageRoster =
    [
      "provider_admin",
      "manager",
      "support_coordinator",
    ].includes(role);


  const weekEnd =
    useMemo(
      () =>
        addDays(
          weekStart,
          6
        ),
      [weekStart]
    );


  const weekDays =
    useMemo(
      () =>
        Array.from(
          { length: 7 },
          (_, index) =>
            addDays(
              weekStart,
              index
            )
        ),
      [weekStart]
    );


  const activeMembers =
    useMemo(
      () =>
        members.filter(
          (member) =>
            member.status ===
            "active"
        ),
      [members]
    );


  /*
   * Resolve names from accepted invitations.
   *
   * organisation_members currently stores the
   * authoritative user ID and role.
   *
   * Accepted invitation records give us a useful
   * display name/email where available.
   */
  const memberDirectory =
    useMemo(() => {
      const directory =
        new Map();

      invitations.forEach(
        (invitation) => {
          if (
            invitation.status !==
              "accepted" ||
            !invitation.accepted_by
          ) {
            return;
          }

          directory.set(
            invitation.accepted_by,
            {
              fullName:
                invitation.full_name ||
                "",

              email:
                invitation.email ||
                "",
            }
          );
        }
      );

      return directory;
    }, [
      invitations,
    ]);


  const getMemberDisplayName =
    useCallback(
      (userId) => {
        if (!userId) {
          return "Unassigned";
        }

        const member =
          activeMembers.find(
            (item) =>
              item.user_id === userId
          );

        const invitation =
          memberDirectory.get(
            userId
          );

        if (
          invitation?.fullName
        ) {
          return invitation.fullName;
        }

        if (
          userId === user?.id
        ) {
          return "You";
        }

        if (member?.role) {
          return `${getTeamRoleLabel(
            member.role
          )} · ${shortId(
            userId
          )}`;
        }

        return shortId(
          userId
        );
      },
      [
        activeMembers,
        memberDirectory,
        user?.id,
      ]
    );


  const getMemberSecondary =
    useCallback(
      (userId) => {
        const member =
          activeMembers.find(
            (item) =>
              item.user_id === userId
          );

        const invitation =
          memberDirectory.get(
            userId
          );

        const roleLabel =
          member?.role
            ? getTeamRoleLabel(
                member.role
              )
            : "Workspace Member";

        if (
          invitation?.email
        ) {
          return `${roleLabel} · ${invitation.email}`;
        }

        return roleLabel;
      },
      [
        activeMembers,
        memberDirectory,
      ]
    );


  const getParticipantName =
    useCallback(
      (participantId) => {
        if (!participantId) {
          return "No participant";
        }

        return (
          clients.find(
            (client) =>
              client.id ===
              participantId
          )?.name ||
          "Unknown participant"
        );
      },
      [
        clients,
      ]
    );


  const refreshRoster =
    useCallback(
      async () => {
        if (!organisationId) {
          setShifts([]);
          return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
          const [
            loadedShifts,
            loadedMembers,
            loadedInvitations,
          ] =
            await Promise.all([
              listRosterShifts({
                organisationId,

                startDate:
                  toDateInput(
                    weekStart
                  ),

                endDate:
                  toDateInput(
                    weekEnd
                  ),
              }),

              listOrganisationMembers(
                organisationId
              ),

              listOrganisationInvitations(
                organisationId
              ),
            ]);

          setShifts(
            Array.isArray(
              loadedShifts
            )
              ? loadedShifts
              : []
          );

          setMembers(
            Array.isArray(
              loadedMembers
            )
              ? loadedMembers
              : []
          );

          setInvitations(
            Array.isArray(
              loadedInvitations
            )
              ? loadedInvitations
              : []
          );
        } catch (error) {
          console.error(
            "Unable to load roster:",
            error
          );

          setErrorMessage(
            error?.message ||
              "The roster could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        organisationId,
        weekStart,
        weekEnd,
      ]
    );


  useEffect(() => {
    void refreshRoster();
  }, [
    refreshRoster,
  ]);


  useEffect(() => {
    if (
      activeClientId &&
      !form.participantId
    ) {
      setForm(
        (previous) => ({
          ...previous,

          participantId:
            activeClientId,
        })
      );
    }
  }, [
    activeClientId,
    form.participantId,
  ]);


  function updateForm(
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
    setForm({
      ...EMPTY_SHIFT,

      participantId:
        activeClientId ||
        clients[0]?.id ||
        "",

      shiftDate:
        toDateInput(
          new Date()
        ),
    });
  }


  async function handleCreateShift(
    event
  ) {
    event.preventDefault();

    if (!canManageRoster) {
      setErrorMessage(
        "Your current workspace role cannot create roster shifts."
      );

      return;
    }

    if (!form.participantId) {
      setErrorMessage(
        "Select a participant."
      );

      return;
    }

    if (!form.staffUserId) {
      setErrorMessage(
        "Assign a team member."
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createRosterShift({
        organisationId,

        participantId:
          form.participantId,

        staffUserId:
          form.staffUserId,

        serviceType:
          form.serviceType,

        shiftDate:
          form.shiftDate,

        startTime:
          form.startTime,

        endTime:
          form.endTime,

        location:
          form.location,

        notes:
          form.notes,

        status:
          "scheduled",

        createdBy:
          user?.id,
      });

      setSuccessMessage(
        "Shift scheduled successfully."
      );

      resetForm();

      await refreshRoster();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "The shift could not be created."
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleStatusChange(
    shift,
    nextStatus
  ) {
    const isAssignedUser =
      shift.staffUserId ===
      user?.id;

    if (
      !canManageRoster &&
      !isAssignedUser
    ) {
      setErrorMessage(
        "You can only update shifts assigned to you."
      );

      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateRosterShiftStatus({
        shiftId:
          shift.id,

        organisationId,

        status:
          nextStatus,
      });

      setSuccessMessage(
        `Shift marked ${getRosterStatusLabel(
          nextStatus
        )}.`
      );

      await refreshRoster();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "The shift could not be updated."
      );
    }
  }


  async function handleDeleteShift(
    shift
  ) {
    if (!canManageRoster) {
      setErrorMessage(
        "Your current workspace role cannot delete roster shifts."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete the ${shift.serviceType} shift for ${getParticipantName(
          shift.participantId
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteRosterShift({
        shiftId:
          shift.id,

        organisationId,
      });

      setSuccessMessage(
        "Shift deleted."
      );

      await refreshRoster();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "The shift could not be deleted."
      );
    }
  }


  const shiftsByDate =
    useMemo(() => {
      const map =
        new Map();

      weekDays.forEach(
        (date) => {
          map.set(
            toDateInput(date),
            []
          );
        }
      );

      shifts.forEach(
        (shift) => {
          if (
            !map.has(
              shift.shiftDate
            )
          ) {
            map.set(
              shift.shiftDate,
              []
            );
          }

          map
            .get(
              shift.shiftDate
            )
            .push(
              shift
            );
        }
      );

      return map;
    }, [
      shifts,
      weekDays,
    ]);


  const scheduledCount =
    shifts.filter(
      (shift) =>
        shift.status ===
        "scheduled"
    ).length;


  const completedCount =
    shifts.filter(
      (shift) =>
        shift.status ===
        "completed"
    ).length;


  const inProgressCount =
    shifts.filter(
      (shift) =>
        shift.status ===
        "in_progress"
    ).length;


  const unassignedCount =
    shifts.filter(
      (shift) =>
        !shift.staffUserId
    ).length;


  function previousWeek() {
    setWeekStart(
      (current) =>
        addDays(
          current,
          -7
        )
    );
  }


  function nextWeek() {
    setWeekStart(
      (current) =>
        addDays(
          current,
          7
        )
    );
  }


  function currentWeek() {
    setWeekStart(
      startOfWeek(
        new Date()
      )
    );
  }


  return (
    <div className="workforce-roster">
      <section className="team-stat-grid">
        <RosterStat
          icon="📅"
          label="Shifts This Week"
          value={shifts.length}
        />

        <RosterStat
          icon="🕒"
          label="Scheduled"
          value={
            scheduledCount
          }
        />

        <RosterStat
          icon="▶️"
          label="In Progress"
          value={
            inProgressCount
          }
        />

        <RosterStat
          icon="✅"
          label="Completed"
          value={
            completedCount
          }
        />

        {unassignedCount >
        0 ? (
          <RosterStat
            icon="⚠️"
            label="Unassigned"
            value={
              unassignedCount
            }
          />
        ) : null}
      </section>


      {errorMessage ? (
        <div className="auth-error">
          {errorMessage}
        </div>
      ) : null}


      {successMessage ? (
        <div className="auth-success">
          {successMessage}
        </div>
      ) : null}


      <div className="team-main-grid">
        <div className="team-main-column">
          <section className="card premium-card">
            <div className="section-heading-row">
              <div>
                <div className="card-title">
                  Weekly Roster
                </div>

                <div className="card-subtitle">
                  {formatWeekRange(
                    weekStart
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={
                    previousWeek
                  }
                >
                  ← Previous
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={
                    currentWeek
                  }
                >
                  This Week
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={
                    nextWeek
                  }
                >
                  Next →
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    void refreshRoster()
                  }
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? "Refreshing…"
                    : "↻ Refresh"}
                </button>
              </div>
            </div>


            {loading &&
            shifts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ⏳
                </div>

                <div>
                  Loading roster…
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                {weekDays.map(
                  (date) => {
                    const dateKey =
                      toDateInput(
                        date
                      );

                    const dayShifts =
                      shiftsByDate.get(
                        dateKey
                      ) || [];

                    return (
                      <section
                        key={
                          dateKey
                        }
                        className="card"
                        style={{
                          padding: 14,
                        }}
                      >
                        <div
                          className="section-heading-row"
                        >
                          <div>
                            <strong>
                              {formatDayHeading(
                                date
                              )}
                            </strong>

                            <div className="card-subtitle">
                              {
                                dayShifts.length
                              }{" "}
                              shift
                              {dayShifts.length ===
                              1
                                ? ""
                                : "s"}
                            </div>
                          </div>
                        </div>


                        {dayShifts.length ===
                        0 ? (
                          <div
                            className="empty-state"
                            style={{
                              padding:
                                "16px 0",
                            }}
                          >
                            No shifts
                            scheduled.
                          </div>
                        ) : (
                          <div
                            style={{
                              display:
                                "grid",
                              gap: 10,
                              marginTop:
                                10,
                            }}
                          >
                            {dayShifts.map(
                              (
                                shift
                              ) => (
                                <article
                                  key={
                                    shift.id
                                  }
                                  className="team-member-card"
                                >
                                  <div className="team-member-avatar">
                                    {getParticipantName(
                                      shift.participantId
                                    )
                                      .charAt(
                                        0
                                      )
                                      .toUpperCase()}
                                  </div>

                                  <div className="team-member-info">
                                    <strong>
                                      {formatTime(
                                        shift.startTime
                                      )}
                                      {" – "}
                                      {formatTime(
                                        shift.endTime
                                      )}
                                      {" · "}
                                      {
                                        shift.serviceType
                                      }
                                    </strong>

                                    <span>
                                      {getParticipantName(
                                        shift.participantId
                                      )}
                                    </span>

                                    <small>
                                      {getMemberDisplayName(
                                        shift.staffUserId
                                      )}
                                      {" · "}
                                      {getMemberSecondary(
                                        shift.staffUserId
                                      )}
                                    </small>

                                    {shift.location ? (
                                      <small>
                                        📍{" "}
                                        {
                                          shift.location
                                        }
                                      </small>
                                    ) : null}

                                    {shift.notes ? (
                                      <small>
                                        {
                                          shift.notes
                                        }
                                      </small>
                                    ) : null}
                                  </div>

                                  <div
                                    className="team-card-actions"
                                    style={{
                                      alignItems:
                                        "flex-end",
                                    }}
                                  >
                                    <span
                                      className={
                                        statusClass(
                                          shift.status
                                        )
                                      }
                                      style={{
                                        fontSize:
                                          12,
                                        fontWeight:
                                          700,
                                      }}
                                    >
                                      {getRosterStatusLabel(
                                        shift.status
                                      )}
                                    </span>

                                    {(canManageRoster ||
                                      shift.staffUserId ===
                                        user?.id) &&
                                    shift.status ===
                                      "scheduled" ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleStatusChange(
                                            shift,
                                            "in_progress"
                                          )
                                        }
                                      >
                                        Start
                                      </button>
                                    ) : null}

                                    {(canManageRoster ||
                                      shift.staffUserId ===
                                        user?.id) &&
                                    shift.status ===
                                      "in_progress" ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleStatusChange(
                                            shift,
                                            "completed"
                                          )
                                        }
                                      >
                                        Complete
                                      </button>
                                    ) : null}

                                    {canManageRoster &&
                                    ![
                                      "completed",
                                      "cancelled",
                                    ].includes(
                                      shift.status
                                    ) ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleStatusChange(
                                            shift,
                                            "cancelled"
                                          )
                                        }
                                      >
                                        Cancel
                                      </button>
                                    ) : null}

                                    {canManageRoster ? (
                                      <button
                                        type="button"
                                        className="danger"
                                        onClick={() =>
                                          void handleDeleteShift(
                                            shift
                                          )
                                        }
                                      >
                                        Delete
                                      </button>
                                    ) : null}
                                  </div>
                                </article>
                              )
                            )}
                          </div>
                        )}
                      </section>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>


        <aside className="team-side-column">
          <section className="card premium-card">
            <div className="card-title">
              Schedule Shift
            </div>

            <div className="card-subtitle">
              Assign an authorised
              professional to a participant
              and service.
            </div>


            {!canManageRoster ? (
              <div className="team-warning">
                Your workspace role can
                view the roster, but cannot
                create or delete shifts.
              </div>
            ) : (
              <form
                onSubmit={
                  handleCreateShift
                }
                style={{
                  display: "grid",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <label>
                  <span>
                    Participant
                  </span>

                  <select
                    className="input"
                    value={
                      form.participantId
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "participantId",
                        event.target
                          .value
                      )
                    }
                    disabled={
                      !clientsReady
                    }
                  >
                    <option value="">
                      Select participant
                    </option>

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
                    Assigned Professional
                  </span>

                  <select
                    className="input"
                    value={
                      form.staffUserId
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "staffUserId",
                        event.target
                          .value
                      )
                    }
                  >
                    <option value="">
                      Select team member
                    </option>

                    {activeMembers.map(
                      (member) => (
                        <option
                          key={
                            member.id
                          }
                          value={
                            member.user_id
                          }
                        >
                          {getMemberDisplayName(
                            member.user_id
                          )}
                          {" — "}
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
                    Service Type
                  </span>

                  <select
                    className="input"
                    value={
                      form.serviceType
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "serviceType",
                        event.target
                          .value
                      )
                    }
                  >
                    {SERVICE_TYPES.map(
                      (service) => (
                        <option
                          key={
                            service
                          }
                          value={
                            service
                          }
                        >
                          {service}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label>
                  <span>
                    Date
                  </span>

                  <input
                    type="date"
                    className="input"
                    value={
                      form.shiftDate
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "shiftDate",
                        event.target
                          .value
                      )
                    }
                  />
                </label>


                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <label>
                    <span>
                      Start
                    </span>

                    <input
                      type="time"
                      className="input"
                      value={
                        form.startTime
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "startTime",
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Finish
                    </span>

                    <input
                      type="time"
                      className="input"
                      value={
                        form.endTime
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "endTime",
                          event.target
                            .value
                        )
                      }
                    />
                  </label>
                </div>


                <label>
                  <span>
                    Location
                  </span>

                  <input
                    className="input"
                    value={
                      form.location
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "location",
                        event.target
                          .value
                      )
                    }
                    placeholder="Participant home, community, clinic..."
                  />
                </label>


                <label>
                  <span>
                    Shift Instructions
                  </span>

                  <textarea
                    className="textarea"
                    rows={4}
                    value={
                      form.notes
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "notes",
                        event.target
                          .value
                      )
                    }
                    placeholder="Purpose Plan priorities, support tasks, documentation required, risks to monitor..."
                  />
                </label>


                <button
                  type="submit"
                  className="btn-primary"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Scheduling…"
                    : "📅 Schedule Shift"}
                </button>
              </form>
            )}
          </section>


          <section className="card premium-card">
            <div className="card-title">
              Roster Workflow
            </div>

            <div className="card-subtitle">
              This will become the bridge
              between workforce scheduling
              and participant care delivery.
            </div>

            <ol className="team-process-list">
              <li>
                Assign the participant and
                appropriate professional.
              </li>

              <li>
                Specify the service, date,
                time and location.
              </li>

              <li>
                Provide shift-specific
                instructions and support
                priorities.
              </li>

              <li>
                Worker starts and completes
                the scheduled shift.
              </li>

              <li>
                Theraa Nurse will later
                connect completion to required
                Staff Notes, handover and
                participant evidence.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}