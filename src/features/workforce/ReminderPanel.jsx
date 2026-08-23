// src/features/workforce/ReminderPanel.jsx

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
  completeWorkforceReminder,
  createWorkforceReminder,
  deleteWorkforceReminder,
  getReminderPriorityLabel,
  getReminderTypeLabel,
  listWorkforceReminders,
  reopenWorkforceReminder,
  startWorkforceReminder,
} from "../../services/reminderService";


const REMINDER_TYPES = [
  {
    value: "compliance",
    label: "Credential / Compliance",
  },
  {
    value: "professional_document",
    label: "Professional Document Required",
  },
  {
    value: "participant_review",
    label: "Participant Review",
  },
  {
    value: "care_plan_review",
    label: "Purpose Plan Review",
  },
  {
    value: "shift_documentation",
    label: "Shift Documentation",
  },
  {
    value: "medication",
    label: "Medication Follow-up",
  },
  {
    value: "clinical",
    label: "Clinical Follow-up",
  },
  {
    value: "general",
    label: "General / Other",
  },
];


const PRIORITIES = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "high",
    label: "High",
  },
  {
    value: "urgent",
    label: "Urgent",
  },
];


const PROFESSIONAL_TYPES = [
  "Support Worker",
  "Support Coordinator",
  "Nurse",
  "Occupational Therapist",
  "Physiotherapist",
  "Psychologist",
  "Behaviour Support Practitioner",
  "Speech Pathologist",
  "General Practitioner",
  "Specialist",
  "Allied Health",
  "Manager",
  "Provider Admin",
  "Other",
];


function getToday() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
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


function getDueState(reminder) {
  if (
    reminder.status ===
    "completed"
  ) {
    return "completed";
  }

  if (
    reminder.status ===
    "cancelled"
  ) {
    return "cancelled";
  }

  if (!reminder.dueDate) {
    return reminder.status ===
      "in_progress"
      ? "in_progress"
      : "scheduled";
  }

  const today = getToday();

  if (
    reminder.dueDate < today
  ) {
    return "overdue";
  }

  if (
    reminder.dueDate === today
  ) {
    return "due_today";
  }

  if (
    reminder.status ===
    "in_progress"
  ) {
    return "in_progress";
  }

  return "scheduled";
}


function dueStateLabel(state) {
  switch (state) {
    case "overdue":
      return "Overdue";

    case "due_today":
      return "Due Today";

    case "in_progress":
      return "In Progress";

    case "completed":
      return "Completed";

    case "cancelled":
      return "Cancelled";

    default:
      return "Scheduled";
  }
}


function dueStateStyle(state) {
  const backgrounds = {
    overdue: "#fee2e2",
    due_today: "#fef3c7",
    in_progress: "#dbeafe",
    completed: "#dcfce7",
    cancelled: "#f3f4f6",
    scheduled: "#e0f2fe",
  };

  return {
    padding: "5px 9px",
    borderRadius: 999,

    background:
      backgrounds[state] ||
      backgrounds.scheduled,

    fontSize: 11,
    fontWeight: 700,
  };
}


function ReminderStat({
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


export default function ReminderPanel() {
  const {
    user,
  } = useAuth();

  const {
    organisationId,
    role,
  } = useWorkspace();

  const {
    clients,
    activeClientId,
  } = useActiveClient();


  const [
    members,
    setMembers,
  ] = useState([]);


  const [
    invitations,
    setInvitations,
  ] = useState([]);


  const [
    reminders,
    setReminders,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  const [
    success,
    setSuccess,
  ] = useState("");


  const [
    filter,
    setFilter,
  ] = useState("open");


  const [
    form,
    setForm,
  ] = useState({
    title: "",

    reminderType:
      "professional_document",

    professionalType: "",

    participantId:
      activeClientId || "",

    assignedUserId: "",

    dueDate:
      getToday(),

    priority:
      "medium",

    description: "",
  });


  const canManage =
    [
      "provider_admin",
      "manager",
      "support_coordinator",
    ].includes(role);


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


  const participantMap =
    useMemo(() => {
      const map =
        new Map();

      (clients || []).forEach(
        (client) => {
          map.set(
            client.id,
            client
          );
        }
      );

      return map;
    }, [
      clients,
    ]);


  const getMemberDisplayName =
    useCallback(
      (userId) => {
        if (!userId) {
          return "Unassigned";
        }

        if (
          userId === user?.id
        ) {
          return "You";
        }

        const member =
          activeMembers.find(
            (item) =>
              item.user_id ===
              userId
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
          invitation?.email
        ) {
          return invitation.email;
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


  const getParticipantName =
    useCallback(
      (participantId) => {
        if (!participantId) {
          return "General / workforce";
        }

        return (
          participantMap.get(
            participantId
          )?.name ||
          "Participant"
        );
      },
      [
        participantMap,
      ]
    );


  const refreshReminders =
    useCallback(
      async () => {
        if (!organisationId) {
          setReminders([]);
          setMembers([]);
          setInvitations([]);
          return;
        }

        setLoading(true);
        setError("");

        try {
          const [
            loadedReminders,
            loadedMembers,
            loadedInvitations,
          ] =
            await Promise.all([
              listWorkforceReminders({
                organisationId,
              }),

              listOrganisationMembers(
                organisationId
              ),

              listOrganisationInvitations(
                organisationId
              ),
            ]);

          setReminders(
            Array.isArray(
              loadedReminders
            )
              ? loadedReminders
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
        } catch (loadError) {
          console.error(
            "Unable to load workforce reminders:",
            loadError
          );

          setError(
            loadError?.message ||
              "Workforce reminders could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        organisationId,
      ]
    );


  useEffect(() => {
    void refreshReminders();
  }, [
    refreshReminders,
  ]);


  useEffect(() => {
    if (
      activeClientId &&
      !form.participantId
    ) {
      setForm(
        (current) => ({
          ...current,

          participantId:
            activeClientId,
        })
      );
    }
  }, [
    activeClientId,
    form.participantId,
  ]);


  const stats =
    useMemo(() => {
      const result = {
        scheduled: 0,
        dueToday: 0,
        overdue: 0,
        inProgress: 0,
        completed: 0,
      };

      reminders.forEach(
        (reminder) => {
          const state =
            getDueState(
              reminder
            );

          if (
            state ===
            "completed"
          ) {
            result.completed += 1;
          } else if (
            state ===
            "overdue"
          ) {
            result.overdue += 1;
          } else if (
            state ===
            "due_today"
          ) {
            result.dueToday += 1;
          } else if (
            state ===
            "in_progress"
          ) {
            result.inProgress += 1;
          } else if (
            state !==
            "cancelled"
          ) {
            result.scheduled += 1;
          }
        }
      );

      return result;
    }, [
      reminders,
    ]);


  const visibleReminders =
    useMemo(() => {
      const filtered =
        reminders.filter(
          (reminder) => {
            const state =
              getDueState(
                reminder
              );

            if (
              filter === "all"
            ) {
              return true;
            }

            if (
              filter ===
              "completed"
            ) {
              return (
                state ===
                "completed"
              );
            }

            if (
              filter ===
              "overdue"
            ) {
              return (
                state ===
                "overdue"
              );
            }

            if (
              filter ===
              "today"
            ) {
              return (
                state ===
                "due_today"
              );
            }

            if (
              filter ===
              "in_progress"
            ) {
              return (
                state ===
                "in_progress"
              );
            }

            return ![
              "completed",
              "cancelled",
            ].includes(
              state
            );
          }
        );

      return [
        ...filtered,
      ].sort(
        (a, b) => {
          const dateA =
            a.dueDate ||
            "9999-12-31";

          const dateB =
            b.dueDate ||
            "9999-12-31";

          return (
            dateA.localeCompare(
              dateB
            ) ||
            String(
              b.createdAt ||
                ""
            ).localeCompare(
              String(
                a.createdAt ||
                  ""
              )
            )
          );
        }
      );
    }, [
      reminders,
      filter,
    ]);


  function updateForm(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,

        [field]:
          value,
      })
    );
  }


  function resetForm() {
    setForm({
      title: "",

      reminderType:
        "professional_document",

      professionalType: "",

      participantId:
        activeClientId || "",

      assignedUserId: "",

      dueDate:
        getToday(),

      priority:
        "medium",

      description: "",
    });
  }


  async function handleCreateReminder(
    event
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!canManage) {
      setError(
        "Your role does not have permission to create workforce reminders."
      );

      return;
    }

    if (!form.title.trim()) {
      setError(
        "Enter a reminder title."
      );

      return;
    }

    setSaving(true);

    try {
      await createWorkforceReminder({
        organisationId,

        participantId:
          form.participantId ||
          null,

        assignedUserId:
          form.assignedUserId ||
          null,

        title:
          form.title,

        description:
          form.description,

        reminderType:
          form.reminderType,

        professionalType:
          form.professionalType,

        dueDate:
          form.dueDate ||
          null,

        priority:
          form.priority,

        createdBy:
          user?.id,
      });

      setSuccess(
        "Reminder created successfully."
      );

      resetForm();

      await refreshReminders();
    } catch (createError) {
      setError(
        createError?.message ||
          "The reminder could not be created."
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleStart(
    reminder
  ) {
    setError("");
    setSuccess("");

    try {
      await startWorkforceReminder({
        reminderId:
          reminder.id,

        organisationId,
      });

      setSuccess(
        "Reminder marked in progress."
      );

      await refreshReminders();
    } catch (updateError) {
      setError(
        updateError?.message ||
          "The reminder could not be updated."
      );
    }
  }


  async function handleComplete(
    reminder
  ) {
    setError("");
    setSuccess("");

    try {
      await completeWorkforceReminder({
        reminderId:
          reminder.id,

        organisationId,
      });

      setSuccess(
        "Reminder marked as completed."
      );

      await refreshReminders();
    } catch (updateError) {
      setError(
        updateError?.message ||
          "The reminder could not be completed."
      );
    }
  }


  async function handleReopen(
    reminder
  ) {
    setError("");
    setSuccess("");

    try {
      await reopenWorkforceReminder({
        reminderId:
          reminder.id,

        organisationId,
      });

      setSuccess(
        "Reminder reopened."
      );

      await refreshReminders();
    } catch (updateError) {
      setError(
        updateError?.message ||
          "The reminder could not be reopened."
      );
    }
  }


  async function handleDelete(
    reminder
  ) {
    if (!canManage) {
      setError(
        "Your role does not have permission to delete reminders."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${reminder.title}"?`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await deleteWorkforceReminder({
        reminderId:
          reminder.id,

        organisationId,
      });

      setSuccess(
        "Reminder deleted."
      );

      await refreshReminders();
    } catch (deleteError) {
      setError(
        deleteError?.message ||
          "The reminder could not be deleted."
      );
    }
  }


  return (
    <div className="workforce-reminders">
      <section className="team-stat-grid">
        <ReminderStat
          icon="🕒"
          value={stats.scheduled}
          label="Scheduled"
        />

        <ReminderStat
          icon="🔔"
          value={stats.dueToday}
          label="Due Today"
        />

        <ReminderStat
          icon="⚠️"
          value={stats.overdue}
          label="Overdue"
        />

        <ReminderStat
          icon="▶️"
          value={stats.inProgress}
          label="In Progress"
        />

        <ReminderStat
          icon="✅"
          value={stats.completed}
          label="Completed"
        />
      </section>


      {error ? (
        <div className="auth-error">
          {error}
        </div>
      ) : null}


      {success ? (
        <div className="auth-success">
          {success}
        </div>
      ) : null}


      <div className="team-main-grid">
        <div className="team-main-column">
          <section className="card premium-card">
            <div className="section-heading-row">
              <div>
                <div className="card-title">
                  Reminder Register
                </div>

                <div className="card-subtitle">
                  Shared professional and participant
                  reminders for this provider workspace.
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  void refreshReminders()
                }
                disabled={loading}
              >
                {loading
                  ? "Refreshing…"
                  : "↻ Refresh"}
              </button>
            </div>


            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 14,
                marginBottom: 16,
              }}
            >
              {[
                ["open", "Open"],
                ["today", "Due Today"],
                ["overdue", "Overdue"],
                ["in_progress", "In Progress"],
                ["completed", "Completed"],
                ["all", "All"],
              ].map(
                ([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      filter === id
                        ? "btn-primary"
                        : "btn-secondary"
                    }
                    onClick={() =>
                      setFilter(id)
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>


            {loading &&
            reminders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ⏳
                </div>

                <div>
                  Loading reminders…
                </div>
              </div>
            ) : visibleReminders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  🔔
                </div>

                <div>
                  No reminders in this view.
                </div>

                <small>
                  Create a reminder to track workforce
                  or participant responsibilities.
                </small>
              </div>
            ) : (
              <div
                className="team-list"
                style={{
                  marginTop: 12,
                }}
              >
                {visibleReminders.map(
                  (reminder) => {
                    const dueState =
                      getDueState(
                        reminder
                      );

                    return (
                      <article
                        key={reminder.id}
                        className="team-member-card"
                      >
                        <div className="team-member-avatar">
                          🔔
                        </div>

                        <div className="team-member-info">
                          <strong>
                            {reminder.title}
                          </strong>

                          <span>
                            {getReminderTypeLabel(
                              reminder.reminderType
                            )}
                            {" · "}
                            {getReminderPriorityLabel(
                              reminder.priority
                            )}
                          </span>

                          <small>
                            Participant:{" "}
                            {getParticipantName(
                              reminder.participantId
                            )}
                          </small>

                          <small>
                            Assigned:{" "}
                            {getMemberDisplayName(
                              reminder.assignedUserId
                            )}
                          </small>

                          {reminder.professionalType ? (
                            <small>
                              Professional:{" "}
                              {
                                reminder.professionalType
                              }
                            </small>
                          ) : null}

                          <small>
                            Due:{" "}
                            {formatDate(
                              reminder.dueDate
                            )}
                          </small>

                          {reminder.description ? (
                            <small>
                              {reminder.description}
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
                            style={
                              dueStateStyle(
                                dueState
                              )
                            }
                          >
                            {dueStateLabel(
                              dueState
                            )}
                          </span>

                          {reminder.status ===
                          "open" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleStart(
                                  reminder
                                )
                              }
                            >
                              Start
                            </button>
                          ) : null}

                          {reminder.status !==
                            "completed" &&
                          reminder.status !==
                            "cancelled" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleComplete(
                                  reminder
                                )
                              }
                            >
                              Complete
                            </button>
                          ) : null}

                          {reminder.status ===
                          "completed" ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleReopen(
                                  reminder
                                )
                              }
                            >
                              Reopen
                            </button>
                          ) : null}

                          {canManage ? (
                            <button
                              type="button"
                              className="danger"
                              onClick={() =>
                                void handleDelete(
                                  reminder
                                )
                              }
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </article>
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
              Create Reminder
            </div>

            <div className="card-subtitle">
              Prompt professionals about documents,
              reviews and care responsibilities.
            </div>


            {!canManage ? (
              <div className="team-warning">
                Your workspace role can view and action
                reminders, but cannot create or delete them.
              </div>
            ) : (
              <form
                onSubmit={
                  handleCreateReminder
                }
                style={{
                  display: "grid",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <label>
                  <span>
                    Reminder Title
                  </span>

                  <input
                    className="input"
                    value={form.title}
                    onChange={(event) =>
                      updateForm(
                        "title",
                        event.target.value
                      )
                    }
                    placeholder="e.g. OT functional assessment required"
                  />
                </label>


                <label>
                  <span>
                    Reminder Type
                  </span>

                  <select
                    className="input"
                    value={
                      form.reminderType
                    }
                    onChange={(event) =>
                      updateForm(
                        "reminderType",
                        event.target.value
                      )
                    }
                  >
                    {REMINDER_TYPES.map(
                      (item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label>
                  <span>
                    Professional Type
                  </span>

                  <select
                    className="input"
                    value={
                      form.professionalType
                    }
                    onChange={(event) =>
                      updateForm(
                        "professionalType",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Not specified
                    </option>

                    {PROFESSIONAL_TYPES.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label>
                  <span>
                    Participant
                  </span>

                  <select
                    className="input"
                    value={
                      form.participantId
                    }
                    onChange={(event) =>
                      updateForm(
                        "participantId",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      General / workforce
                    </option>

                    {(clients || []).map(
                      (client) => (
                        <option
                          key={client.id}
                          value={client.id}
                        >
                          {client.name}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label>
                  <span>
                    Assign To
                  </span>

                  <select
                    className="input"
                    value={
                      form.assignedUserId
                    }
                    onChange={(event) =>
                      updateForm(
                        "assignedUserId",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {activeMembers.map(
                      (member) => (
                        <option
                          key={member.id}
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
                    Due Date
                  </span>

                  <input
                    type="date"
                    className="input"
                    value={form.dueDate}
                    onChange={(event) =>
                      updateForm(
                        "dueDate",
                        event.target.value
                      )
                    }
                  />
                </label>


                <label>
                  <span>
                    Priority
                  </span>

                  <select
                    className="input"
                    value={
                      form.priority
                    }
                    onChange={(event) =>
                      updateForm(
                        "priority",
                        event.target.value
                      )
                    }
                  >
                    {PRIORITIES.map(
                      (item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label>
                  <span>
                    Instructions / Description
                  </span>

                  <textarea
                    className="textarea"
                    rows={4}
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      updateForm(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Obtain updated OT functional assessment and upload it before the next Purpose Plan review."
                  />
                </label>


                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Creating…"
                    : "🔔 Create Reminder"}
                </button>
              </form>
            )}
          </section>


          <section className="card premium-card">
            <div className="card-title">
              Shared Reminder Workflow
            </div>

            <div className="card-subtitle">
              Reminders now belong to the provider
              workspace rather than one browser.
            </div>

            <ol className="team-process-list">
              <li>
                Manager creates a participant or workforce reminder.
              </li>

              <li>
                Assign it to the relevant professional.
              </li>

              <li>
                The professional can mark the task in progress.
              </li>

              <li>
                Completion is written back to the shared provider record.
              </li>

              <li>
                Future automation can generate reminders from roster,
                compliance and participant evidence.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}