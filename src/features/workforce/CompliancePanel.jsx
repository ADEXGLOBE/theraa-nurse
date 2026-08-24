// src/features/workforce/CompliancePanel.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";

import {
  getTeamRoleLabel,
  listOrganisationInvitations,
  listOrganisationMembers,
} from "../../services/teamService";

import {
  calculateComplianceStatus,
  createStaffCompliance,
  deleteStaffCompliance,
  getComplianceStatusLabel,
  listStaffCompliance,
  updateStaffCompliance,
  verifyStaffCompliance,
} from "../../services/complianceService";

import ComplianceDocumentUpload from "./ComplianceDocumentUpload";
import ComplianceDocumentRegister from "./ComplianceDocumentRegister";
import ComplianceGapPanel from "./ComplianceGapPanel";


const EMPTY_FORM = {
  staffUserId: "",
  requirementType: "NDIS Worker Screening",
  documentName: "",
  documentReference: "",
  issuedDate: "",
  expiryDate: "",
  notes: "",
};


const REQUIREMENT_TYPES = [
  "NDIS Worker Screening",
  "Police Check",
  "Working With Children Check",
  "First Aid",
  "CPR",
  "Medication Assistance",
  "Manual Handling",
  "Behaviour Support Training",
  "Infection Control",
  "Professional Registration",
  "Qualification",
  "Insurance",
  "Other",
];


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
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


function daysRemaining(expiryDate) {
  if (!expiryDate) {
    return null;
  }

  const expiry =
    new Date(
      `${expiryDate}T23:59:59`
    );

  if (
    Number.isNaN(
      expiry.getTime()
    )
  ) {
    return null;
  }

  return Math.ceil(
    (
      expiry.getTime() -
      Date.now()
    ) /
      (
        1000 *
        60 *
        60 *
        24
      )
  );
}


function complianceClass(status) {
  switch (status) {
    case "valid":
      return "roster-status-completed";

    case "expiring":
      return "roster-status-progress";

    case "expired":
      return "roster-status-cancelled";

    case "not_required":
      return "roster-status-draft";

    default:
      return "roster-status-scheduled";
  }
}


function ComplianceStat({
  icon,
  label,
  value,
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


export default function CompliancePanel() {
  const { user } =
    useAuth();

  const {
    organisationId,
    role,
  } = useWorkspace();


  const [
    members,
    setMembers,
  ] = useState([]);


  const [
    invitations,
    setInvitations,
  ] = useState([]);


  const [
    records,
    setRecords,
  ] = useState([]);


  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM
  );


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


  const [
    documentRefreshKey,
    setDocumentRefreshKey,
  ] = useState(0);


  const canManageCompliance =
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


  const getMemberDisplayName =
    useCallback(
      (userId) => {
        if (!userId) {
          return "Unknown team member";
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


  const refreshCompliance =
    useCallback(
      async () => {
        if (!organisationId) {
          setRecords([]);
          return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
          const [
            loadedRecords,
            loadedMembers,
            loadedInvitations,
          ] =
            await Promise.all([
              listStaffCompliance({
                organisationId,
              }),

              listOrganisationMembers(
                organisationId
              ),

              listOrganisationInvitations(
                organisationId
              ),
            ]);

          setRecords(
            Array.isArray(
              loadedRecords
            )
              ? loadedRecords
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
            "Unable to load workforce compliance:",
            error
          );

          setErrorMessage(
            error?.message ||
              "Compliance records could not be loaded."
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
    void refreshCompliance();
  }, [
    refreshCompliance,
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
    setForm(
      EMPTY_FORM
    );
  }


  async function handleCreateRecord(
    event
  ) {
    event.preventDefault();

    if (!canManageCompliance) {
      setErrorMessage(
        "Your workspace role cannot create compliance records."
      );

      return;
    }

    if (
      !form.staffUserId
    ) {
      setErrorMessage(
        "Select a team member."
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const status =
        form.expiryDate
          ? calculateComplianceStatus(
              form.expiryDate
            )
          : "pending";

      await createStaffCompliance({
        organisationId,

        staffUserId:
          form.staffUserId,

        requirementType:
          form.requirementType,

        documentName:
          form.documentName,

        documentReference:
          form.documentReference,

        issuedDate:
          form.issuedDate ||
          null,

        expiryDate:
          form.expiryDate ||
          null,

        status,

        notes:
          form.notes,

        createdBy:
          user?.id,
      });

      setSuccessMessage(
        "Compliance record added."
      );

      resetForm();

      await refreshCompliance();

      setDocumentRefreshKey(
        (current) =>
          current + 1
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Compliance record could not be created."
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleVerify(
    record
  ) {
    if (!canManageCompliance) {
      setErrorMessage(
        "Your workspace role cannot verify compliance records."
      );

      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await verifyStaffCompliance({
        complianceId:
          record.id,

        organisationId,

        verifiedBy:
          user?.id,
      });

      setSuccessMessage(
        "Compliance record verified."
      );

      await refreshCompliance();

      setDocumentRefreshKey(
        (current) =>
          current + 1
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Compliance record could not be verified."
      );
    }
  }


  async function handleRefreshStatus(
    record
  ) {
    if (!record.expiryDate) {
      return;
    }

    const nextStatus =
      calculateComplianceStatus(
        record.expiryDate
      );

    if (
      nextStatus ===
      record.status
    ) {
      return;
    }

    try {
      await updateStaffCompliance({
        complianceId:
          record.id,

        organisationId,

        changes: {
          status:
            nextStatus,
        },
      });

      await refreshCompliance();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Compliance status could not be updated."
      );
    }
  }


  async function handleDelete(
    record
  ) {
    if (!canManageCompliance) {
      setErrorMessage(
        "Your workspace role cannot delete compliance records."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${record.requirementType} for ${getMemberDisplayName(
          record.staffUserId
        )}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteStaffCompliance({
        complianceId:
          record.id,

        organisationId,
      });

      setSuccessMessage(
        "Compliance record deleted."
      );

      await refreshCompliance();

      setDocumentRefreshKey(
        (current) =>
          current + 1
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "Compliance record could not be deleted."
      );
    }
  }


  useEffect(() => {
    records.forEach(
      (record) => {
        if (
          record.expiryDate
        ) {
          void handleRefreshStatus(
            record
          );
        }
      }
    );
  }, []);


  const validCount =
    records.filter(
      (record) =>
        record.status ===
        "valid"
    ).length;


  const expiringCount =
    records.filter(
      (record) =>
        record.status ===
        "expiring"
    ).length;


  const expiredCount =
    records.filter(
      (record) =>
        record.status ===
        "expired"
    ).length;


  const pendingCount =
    records.filter(
      (record) =>
        record.status ===
        "pending"
    ).length;


  function handleComplianceDocumentUploaded() {
    setDocumentRefreshKey(
      (current) =>
        current + 1
    );
  }


  return (
    <div className="workforce-compliance">
      <section className="team-stat-grid">
        <ComplianceStat
          icon="✅"
          label="Valid"
          value={
            validCount
          }
        />

        <ComplianceStat
          icon="⏳"
          label="Expiring"
          value={
            expiringCount
          }
        />

        <ComplianceStat
          icon="⚠️"
          label="Expired"
          value={
            expiredCount
          }
        />

        <ComplianceStat
          icon="📋"
          label="Pending"
          value={
            pendingCount
          }
        />
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
                  Workforce Compliance Register
                </div>

                <div className="card-subtitle">
                  Monitor workforce requirements,
                  professional documents and expiry dates.
                </div>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  void refreshCompliance()
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


            {loading &&
            records.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ⏳
                </div>

                <div>
                  Loading compliance records…
                </div>
              </div>
            ) : records.length ===
              0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  🪪
                </div>

                <div>
                  No compliance records yet.
                </div>

                <small>
                  Add the first workforce requirement using the form.
                </small>
              </div>
            ) : (
              <div
                className="team-list"
                style={{
                  marginTop: 16,
                }}
              >
                {records.map(
                  (record) => {
                    const remaining =
                      daysRemaining(
                        record.expiryDate
                      );

                    return (
                      <article
                        className="team-member-card"
                        key={
                          record.id
                        }
                      >
                        <div className="team-member-avatar">
                          🪪
                        </div>

                        <div className="team-member-info">
                          <strong>
                            {
                              record.requirementType
                            }
                          </strong>

                          <span>
                            {getMemberDisplayName(
                              record.staffUserId
                            )}
                          </span>

                          <small>
                            {getMemberSecondary(
                              record.staffUserId
                            )}
                          </small>

                          {record.documentName ? (
                            <small>
                              Document:{" "}
                              {
                                record.documentName
                              }
                            </small>
                          ) : null}

                          {record.documentReference ? (
                            <small>
                              Reference:{" "}
                              {
                                record.documentReference
                              }
                            </small>
                          ) : null}

                          <small>
                            Issued:{" "}
                            {formatDate(
                              record.issuedDate
                            )}
                            {" · "}
                            Expires:{" "}
                            {formatDate(
                              record.expiryDate
                            )}
                          </small>

                          {remaining !==
                          null ? (
                            <small>
                              {remaining <
                              0
                                ? `Expired ${Math.abs(
                                    remaining
                                  )} day(s) ago`
                                : `${remaining} day(s) remaining`}
                            </small>
                          ) : null}

                          {record.notes ? (
                            <small>
                              {record.notes}
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
                              complianceClass(
                                record.status
                              )
                            }
                            style={{
                              fontSize:
                                12,
                              fontWeight:
                                700,
                            }}
                          >
                            {getComplianceStatusLabel(
                              record.status
                            )}
                          </span>

                          <span
                            style={{
                              fontSize:
                                12,
                              color:
                                record.verified
                                  ? "#047857"
                                  : "#6b7280",
                            }}
                          >
                            {record.verified
                              ? "✓ Verified"
                              : "Not verified"}
                          </span>

                          {canManageCompliance &&
                          !record.verified ? (
                            <button
                              type="button"
                              onClick={() =>
                                void handleVerify(
                                  record
                                )
                              }
                            >
                              Verify
                            </button>
                          ) : null}

                          {canManageCompliance ? (
                            <button
                              type="button"
                              className="danger"
                              onClick={() =>
                                void handleDelete(
                                  record
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
              Add Compliance Requirement
            </div>

            <div className="card-subtitle">
              Record qualifications, screening,
              registration and workforce credentials.
            </div>


            {!canManageCompliance ? (
              <div className="team-warning">
                Your workspace role can view compliance
                records, but cannot create or verify them.
              </div>
            ) : (
              <form
                onSubmit={
                  handleCreateRecord
                }
                style={{
                  display: "grid",
                  gap: 12,
                  marginTop: 16,
                }}
              >
                <label>
                  <span>
                    Team Member
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
                    Requirement
                  </span>

                  <select
                    className="input"
                    value={
                      form.requirementType
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "requirementType",
                        event.target
                          .value
                      )
                    }
                  >
                    {REQUIREMENT_TYPES.map(
                      (
                        requirement
                      ) => (
                        <option
                          key={
                            requirement
                          }
                          value={
                            requirement
                          }
                        >
                          {requirement}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label>
                  <span>
                    Document Name
                  </span>

                  <input
                    className="input"
                    value={
                      form.documentName
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "documentName",
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. HLTAID011 First Aid Certificate"
                  />
                </label>


                <label>
                  <span>
                    Reference / Registration Number
                  </span>

                  <input
                    className="input"
                    value={
                      form.documentReference
                    }
                    onChange={(
                      event
                    ) =>
                      updateForm(
                        "documentReference",
                        event.target
                          .value
                      )
                    }
                    placeholder="Certificate or registration reference"
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
                      Issued
                    </span>

                    <input
                      type="date"
                      className="input"
                      value={
                        form.issuedDate
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "issuedDate",
                          event.target
                            .value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Expiry
                    </span>

                    <input
                      type="date"
                      className="input"
                      value={
                        form.expiryDate
                      }
                      onChange={(
                        event
                      ) =>
                        updateForm(
                          "expiryDate",
                          event.target
                            .value
                        )
                      }
                    />
                  </label>
                </div>


                <label>
                  <span>
                    Notes
                  </span>

                  <textarea
                    className="textarea"
                    rows={3}
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
                    placeholder="Restrictions, verification notes or follow-up requirements..."
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
                    ? "Saving…"
                    : "🪪 Add Requirement"}
                </button>
              </form>
            )}
          </section>


          <section className="card premium-card">
            <div className="card-title">
              Compliance Intelligence
            </div>

            <div className="card-subtitle">
              Theraa Nurse can later use these records
              when rostering staff for specific services.
            </div>

            <ol className="team-process-list">
              <li>
                Track each professional's required
                credentials and qualifications.
              </li>

              <li>
                Surface documents approaching expiry.
              </li>

              <li>
                Verify records after organisational review.
              </li>

              <li>
                Generate reminder tasks before expiry.
              </li>

              <li>
                Warn roster managers when a relevant
                credential may be missing or expired.
              </li>
            </ol>
          </section>
        </aside>
      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(320px, 0.8fr) minmax(0, 1.8fr)",
          gap: 16,
          alignItems: "start",
          marginTop: 16,
          width: "100%",
        }}
      >
        <div
          style={{
            minWidth: 0,
          }}
        >
          <ComplianceDocumentUpload
            onUploaded={
              handleComplianceDocumentUploaded
            }
          />
        </div>

        <div
          style={{
            minWidth: 0,
            width: "100%",
          }}
        >
          <ComplianceDocumentRegister
            refreshKey={
              documentRefreshKey
            }
          />
        </div>
      </div>


      <div
        style={{
          marginTop: 16,
        }}
      >
        <ComplianceGapPanel
          refreshKey={
            documentRefreshKey
          }
        />
      </div>
    </div>
  );
}