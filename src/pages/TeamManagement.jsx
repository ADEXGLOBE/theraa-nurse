// src/pages/TeamManagement.jsx
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";

import {
  TEAM_ROLES,
  buildInvitationLink,
  cancelTeamInvitation,
  createTeamInvitation,
  getTeamRoleLabel,
  listOrganisationInvitations,
  listOrganisationMembers,
} from "../services/teamService";

import RosterBoard from "../features/workforce/RosterBoard";
import CompliancePanel from "../features/workforce/CompliancePanel";
import ReminderPanel from "../features/workforce/ReminderPanel";

const EMPTY_FORM = {
  fullName: "",
  email: "",
  role: "support_worker",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function TeamStat({
  icon,
  label,
  value,
}) {
  return (
    <div className="team-stat-card">
      <div className="team-stat-icon">
        {icon}
      </div>

      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function TeamManagement() {
  const { user } = useAuth();

  const {
    organisationId,
    organisationName,
    role,
    roleLabel,
  } = useWorkspace();

  const [members, setMembers] =
    useState([]);

  const [invitations, setInvitations] =
    useState([]);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [activeTab, setActiveTab] =
    useState("team");

  const canInvite = [
    "provider_admin",
    "manager",
    "support_coordinator",
  ].includes(role);

  async function refreshTeam() {
    if (!organisationId) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const [
        loadedMembers,
        loadedInvitations,
      ] = await Promise.all([
        listOrganisationMembers(
          organisationId
        ),
        listOrganisationInvitations(
          organisationId
        ),
      ]);

      setMembers(loadedMembers);
      setInvitations(
        loadedInvitations
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Team information could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshTeam();
  }, [organisationId]);

  const pendingInvitations =
    useMemo(
      () =>
        invitations.filter(
          (invitation) =>
            invitation.status ===
            "pending"
        ),
      [invitations]
    );

  const acceptedInvitations =
    useMemo(
      () =>
        invitations.filter(
          (invitation) =>
            invitation.status ===
            "accepted"
        ),
      [invitations]
    );

  function updateField(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function handleCreateInvitation(
    event
  ) {
    event.preventDefault();

    setSaving(true);
    setErrorMsg("");
    setMessage("");

    try {
      const invitation =
        await createTeamInvitation({
          organisationId,
          invitedBy: user?.id,
          ...form,
        });

      const link =
        buildInvitationLink(
          invitation.token
        );

      await navigator.clipboard.writeText(
        link
      );

      setForm(EMPTY_FORM);

      setMessage(
        "Invitation created. The secure invitation link has been copied to your clipboard."
      );

      await refreshTeam();
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Invitation could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyInvitation(
    token
  ) {
    try {
      const link =
        buildInvitationLink(token);

      await navigator.clipboard.writeText(
        link
      );

      setMessage(
        "Invitation link copied."
      );
    } catch {
      setErrorMsg(
        "The invitation link could not be copied."
      );
    }
  }

  async function handleCancelInvitation(
    invitationId
  ) {
    if (
      !window.confirm(
        "Cancel this invitation?"
      )
    ) {
      return;
    }

    try {
      await cancelTeamInvitation(
        invitationId
      );

      setMessage(
        "Invitation cancelled."
      );

      await refreshTeam();
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Invitation could not be cancelled."
      );
    }
  }

  return (
    <div className="zone-page team-page">
      <header className="team-hero">
        <div>
          <div className="eyebrow">
            Organisation Management
          </div>

          <h1>Workforce & Care Delivery</h1>

          <p>
            Manage your team, roster care delivery,
            monitor workforce compliance and coordinate
            professional reminders from one provider workspace.
          </p>

          <div className="team-workspace-name">
            {organisationName}
          </div>
        </div>

        <div className="team-current-access">
          <span>Your access</span>
          <strong>{roleLabel}</strong>
          <small>
            {user?.email}
          </small>
        </div>
      </header>

      <section
        className="card premium-card"
        style={{
          marginBottom: 16,
          padding: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {[
            { id: "team", label: "👥 Team" },
            { id: "roster", label: "📅 Roster" },
            { id: "compliance", label: "🪪 Compliance" },
            { id: "reminders", label: "🔔 Reminders" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={
                activeTab === tab.id
                  ? "role-btn active"
                  : "role-btn"
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "team" ? (
        <>
      <section className="team-stat-grid">
        <TeamStat
          icon="👥"
          label="Active Members"
          value={members.filter(
            (member) =>
              member.status === "active"
          ).length}
        />

        <TeamStat
          icon="✉️"
          label="Pending Invitations"
          value={
            pendingInvitations.length
          }
        />

        <TeamStat
          icon="✅"
          label="Accepted Invitations"
          value={
            acceptedInvitations.length
          }
        />

        <TeamStat
          icon="🏢"
          label="Organisation"
          value="1"
        />
      </section>

      <div className="team-main-grid">
        <div className="team-main-column">
          <section className="card premium-card">
            <div className="card-title">
              Invite Team Member
            </div>

            <div className="card-subtitle">
              The invited person creates
              their own password. Never share
              your Provider Admin login.
            </div>

            {!canInvite ? (
              <div className="team-warning">
                Your role cannot create team
                invitations.
              </div>
            ) : (
              <form
                className="team-invite-form"
                onSubmit={
                  handleCreateInvitation
                }
              >
                <label>
                  <span>Full name</span>

                  <input
                    className="input"
                    value={form.fullName}
                    onChange={(event) =>
                      updateField(
                        "fullName",
                        event.target.value
                      )
                    }
                    placeholder="e.g. James Walker"
                  />
                </label>

                <label>
                  <span>Email</span>

                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target.value
                      )
                    }
                    placeholder="worker@email.com"
                  />
                </label>

                <label>
                  <span>Organisation role</span>

                  <select
                    className="input"
                    value={form.role}
                    onChange={(event) =>
                      updateField(
                        "role",
                        event.target.value
                      )
                    }
                  >
                    {TEAM_ROLES.map(
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

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Creating invitation…"
                    : "Create Invitation"}
                </button>
              </form>
            )}

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
          </section>

          <section className="card premium-card">
            <div className="card-title">
              Pending Invitations
            </div>

            <div className="card-subtitle">
              Copy the invitation link and send
              it privately to the intended team
              member.
            </div>

            {loading ? (
              <div className="empty-state">
                Loading invitations…
              </div>
            ) : pendingInvitations.length ===
              0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ✉️
                </div>

                <div>
                  No pending invitations.
                </div>
              </div>
            ) : (
              <div className="team-list">
                {pendingInvitations.map(
                  (invitation) => (
                    <article
                      className="team-member-card"
                      key={invitation.id}
                    >
                      <div className="team-member-avatar">
                        {invitation.full_name
                          ?.charAt(0)
                          ?.toUpperCase() ||
                          "T"}
                      </div>

                      <div className="team-member-info">
                        <strong>
                          {
                            invitation.full_name
                          }
                        </strong>

                        <span>
                          {invitation.email}
                        </span>

                        <small>
                          {getTeamRoleLabel(
                            invitation.role
                          )}{" "}
                          · Expires{" "}
                          {formatDate(
                            invitation.expires_at
                          )}
                        </small>
                      </div>

                      <div className="team-card-actions">
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopyInvitation(
                              invitation.token
                            )
                          }
                        >
                          Copy Link
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            void handleCancelInvitation(
                              invitation.id
                            )
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="team-side-column">
          <section className="card premium-card">
            <div className="card-title">
              Organisation Members
            </div>

            <div className="card-subtitle">
              Active accounts currently linked
              to this provider workspace.
            </div>

            {members.length === 0 ? (
              <div className="empty-state">
                No members found.
              </div>
            ) : (
              <div className="team-list">
                {members.map(
                  (member) => (
                    <article
                      className="team-member-card compact"
                      key={member.id}
                    >
                      <div className="team-member-avatar">
                        {member.role
                          ?.charAt(0)
                          ?.toUpperCase() ||
                          "M"}
                      </div>

                      <div className="team-member-info">
                        <strong>
                          {getTeamRoleLabel(
                            member.role
                          )}
                        </strong>

                        <span>
                          User:{" "}
                          {member.user_id.slice(
                            0,
                            8
                          )}
                          …
                        </span>

                        <small>
                          {member.status} · Joined{" "}
                          {formatDate(
                            member.created_at
                          )}
                        </small>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>

          <section className="card premium-card">
            <div className="card-title">
              Invitation Process
            </div>

            <ol className="team-process-list">
              <li>
                Enter the team member’s name,
                email and role.
              </li>

              <li>
                Create and copy their invitation
                link.
              </li>

              <li>
                Send the link privately to the
                intended person.
              </li>

              <li>
                They create their own password.
              </li>

              <li>
                Theraa Nurse automatically adds
                them to this organisation.
              </li>
            </ol>
          </section>
        </aside>
      </div>
        </>
      ) : null}

      {activeTab === "roster" ? (
        <RosterBoard />
      ) : null}

      {activeTab === "compliance" ? (
  <CompliancePanel />
) : null}


     {activeTab === "reminders" ? (
  <ReminderPanel />
) : null}
    
    </div>
  );
}