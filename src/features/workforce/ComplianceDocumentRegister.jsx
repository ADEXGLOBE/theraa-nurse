// src/features/workforce/ComplianceDocumentRegister.jsx

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
  createComplianceDocumentSignedUrl,
  deleteComplianceDocument,
  getComplianceExpiryState,
  listComplianceDocuments,
  rejectComplianceDocument,
  resetComplianceDocumentReview,
  verifyComplianceDocument,
} from "../../services/complianceDocumentService";


function shortId(value) {
  if (!value) {
    return "Unknown";
  }

  return `${String(value).slice(0, 8)}…`;
}


function formatDate(value) {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
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


function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}


function formatFileSize(bytes) {
  const size = Number(bytes || 0);

  if (!size) {
    return "Unknown size";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(
    size /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}


function verificationLabel(status) {
  switch (status) {
    case "verified":
      return "Verified";

    case "rejected":
      return "Rejected";

    default:
      return "Pending Review";
  }
}


function verificationStyle(status) {
  const backgrounds = {
    pending: "#fef3c7",
    verified: "#dcfce7",
    rejected: "#fee2e2",
  };

  return {
    padding: "5px 9px",
    borderRadius: 999,

    background:
      backgrounds[status] ||
      backgrounds.pending,

    fontSize: 11,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
  };
}


function expiryStyle(state) {
  const backgrounds = {
    valid: "#dcfce7",
    expiring: "#fef3c7",
    expired: "#fee2e2",
    no_expiry: "#e0f2fe",
    unknown: "#f3f4f6",
  };

  return {
    padding: "5px 9px",
    borderRadius: 999,

    background:
      backgrounds[state] ||
      backgrounds.unknown,

    fontSize: 11,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
  };
}


function DocumentStat({
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


export default function ComplianceDocumentRegister({
  refreshKey = 0,
}) {
  const {
    user,
  } = useAuth();

  const {
    organisationId,
    role,
  } = useWorkspace();


  const [
    documents,
    setDocuments,
  ] = useState([]);


  const [
    members,
    setMembers,
  ] = useState([]);


  const [
    invitations,
    setInvitations,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    actionId,
    setActionId,
  ] = useState("");


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  const [
    filter,
    setFilter,
  ] = useState("all");


  const [
    selectedStaffId,
    setSelectedStaffId,
  ] = useState("");


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
            member.status === "active"
        ),
      [members]
    );


  const memberDirectory =
    useMemo(() => {
      const directory = new Map();

      invitations.forEach(
        (invitation) => {
          if (
            invitation.status !== "accepted" ||
            !invitation.accepted_by
          ) {
            return;
          }

          directory.set(
            invitation.accepted_by,
            {
              fullName:
                invitation.full_name || "",

              email:
                invitation.email || "",
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
          return "Unknown professional";
        }

        if (userId === user?.id) {
          return "You";
        }

        const member =
          activeMembers.find(
            (item) =>
              item.user_id === userId
          );

        const invitation =
          memberDirectory.get(userId);

        if (invitation?.fullName) {
          return invitation.fullName;
        }

        if (invitation?.email) {
          return invitation.email;
        }

        if (member?.role) {
          return `${getTeamRoleLabel(
            member.role
          )} · ${shortId(userId)}`;
        }

        return shortId(userId);
      },
      [
        activeMembers,
        memberDirectory,
        user?.id,
      ]
    );


  const getMemberRole =
    useCallback(
      (userId) => {
        const member =
          activeMembers.find(
            (item) =>
              item.user_id === userId
          );

        return member?.role
          ? getTeamRoleLabel(
              member.role
            )
          : "Workspace Member";
      },
      [
        activeMembers,
      ]
    );


  const refreshDocuments =
    useCallback(
      async () => {
        if (!organisationId) {
          setDocuments([]);
          setMembers([]);
          setInvitations([]);
          return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
          const [
            loadedDocuments,
            loadedMembers,
            loadedInvitations,
          ] =
            await Promise.all([
              listComplianceDocuments({
                organisationId,

                userId:
                  canManage
                    ? null
                    : user?.id || null,
              }),

              listOrganisationMembers(
                organisationId
              ),

              listOrganisationInvitations(
                organisationId
              ),
            ]);

          setDocuments(
            Array.isArray(
              loadedDocuments
            )
              ? loadedDocuments
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
            "Unable to load compliance document register:",
            error
          );

          setErrorMessage(
            error?.message ||
              "Compliance documents could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        organisationId,
        canManage,
        user?.id,
      ]
    );


  useEffect(() => {
    void refreshDocuments();
  }, [
    refreshDocuments,
    refreshKey,
  ]);


  const stats =
    useMemo(() => {
      const result = {
        total: documents.length,
        pending: 0,
        verified: 0,
        rejected: 0,
        expiring: 0,
        expired: 0,
      };

      documents.forEach(
        (document) => {
          if (
            document.verificationStatus ===
            "verified"
          ) {
            result.verified += 1;
          } else if (
            document.verificationStatus ===
            "rejected"
          ) {
            result.rejected += 1;
          } else {
            result.pending += 1;
          }

          const expiry =
            getComplianceExpiryState(
              document.expiryDate
            );

          if (
            expiry.state === "expiring"
          ) {
            result.expiring += 1;
          }

          if (
            expiry.state === "expired"
          ) {
            result.expired += 1;
          }
        }
      );

      return result;
    }, [
      documents,
    ]);


  const visibleDocuments =
    useMemo(() => {
      return documents.filter(
        (document) => {
          if (
            selectedStaffId &&
            document.userId !==
              selectedStaffId
          ) {
            return false;
          }

          if (filter === "all") {
            return true;
          }

          if (
            filter === "pending"
          ) {
            return (
              document.verificationStatus ===
              "pending"
            );
          }

          if (
            filter === "verified"
          ) {
            return (
              document.verificationStatus ===
              "verified"
            );
          }

          if (
            filter === "rejected"
          ) {
            return (
              document.verificationStatus ===
              "rejected"
            );
          }

          const expiry =
            getComplianceExpiryState(
              document.expiryDate
            );

          if (
            filter === "expiring"
          ) {
            return (
              expiry.state ===
              "expiring"
            );
          }

          if (
            filter === "expired"
          ) {
            return (
              expiry.state ===
              "expired"
            );
          }

          return true;
        }
      );
    }, [
      documents,
      filter,
      selectedStaffId,
    ]);


  async function handleOpenDocument(
    document
  ) {
    setErrorMessage("");
    setSuccessMessage("");
    setActionId(document.id);

    try {
      const signedUrl =
        await createComplianceDocumentSignedUrl({
          storagePath:
            document.storagePath,

          expiresIn: 300,
        });

      if (!signedUrl) {
        throw new Error(
          "A secure document link could not be created."
        );
      }

      window.open(
        signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "The document could not be opened."
      );
    } finally {
      setActionId("");
    }
  }


  async function handleVerify(
    document
  ) {
    if (!canManage) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setActionId(document.id);

    try {
      await verifyComplianceDocument({
        documentId:
          document.id,

        organisationId,

        verifiedBy:
          user?.id,
      });

      setSuccessMessage(
        `"${document.documentName}" has been verified.`
      );

      await refreshDocuments();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "The document could not be verified."
      );
    } finally {
      setActionId("");
    }
  }


  async function handleReject(
    document
  ) {
    if (!canManage) {
      return;
    }

    const reason =
      window.prompt(
        `Why is "${document.documentName}" being rejected?`
      );

    if (reason === null) {
      return;
    }

    if (!reason.trim()) {
      setErrorMessage(
        "A rejection reason is required."
      );

      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setActionId(document.id);

    try {
      await rejectComplianceDocument({
        documentId:
          document.id,

        organisationId,

        verifiedBy:
          user?.id,

        reason,
      });

      setSuccessMessage(
        `"${document.documentName}" has been rejected.`
      );

      await refreshDocuments();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "The document could not be rejected."
      );
    } finally {
      setActionId("");
    }
  }


  async function handleResetReview(
    document
  ) {
    if (!canManage) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setActionId(document.id);

    try {
      await resetComplianceDocumentReview({
        documentId:
          document.id,

        organisationId,
      });

      setSuccessMessage(
        `"${document.documentName}" has been returned to pending review.`
      );

      await refreshDocuments();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "The review status could not be reset."
      );
    } finally {
      setActionId("");
    }
  }


  async function handleDelete(
    document
  ) {
    const isOwnDocument =
      document.userId ===
      user?.id;

    const canDelete =
      canManage ||
      (
        isOwnDocument &&
        document.verificationStatus ===
          "pending"
      );

    if (!canDelete) {
      setErrorMessage(
        "You do not have permission to delete this compliance document."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${document.documentName}" and its stored file?`
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setActionId(document.id);

    try {
      await deleteComplianceDocument({
        documentId:
          document.id,

        organisationId,

        storagePath:
          document.storagePath,
      });

      setSuccessMessage(
        `"${document.documentName}" has been deleted.`
      );

      await refreshDocuments();
    } catch (error) {
      setErrorMessage(
        error?.message ||
          "The compliance document could not be deleted."
      );
    } finally {
      setActionId("");
    }
  }


  return (
    <section className="card premium-card">
      <div className="section-heading-row">
        <div>
          <div className="card-title">
            Compliance Document Review
          </div>

          <div className="card-subtitle">
            Secure workforce credentials,
            qualifications and compliance
            evidence stored in the provider
            workspace.
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            void refreshDocuments()
          }
          disabled={loading}
        >
          {loading
            ? "Refreshing…"
            : "↻ Refresh"}
        </button>
      </div>


      <section
        className="team-stat-grid"
        style={{
          marginTop: 16,
        }}
      >
        <DocumentStat
          icon="📁"
          value={stats.total}
          label="Documents"
        />

        <DocumentStat
          icon="🕒"
          value={stats.pending}
          label="Pending"
        />

        <DocumentStat
          icon="✅"
          value={stats.verified}
          label="Verified"
        />

        <DocumentStat
          icon="⚠️"
          value={stats.expiring}
          label="Expiring"
        />

        <DocumentStat
          icon="⛔"
          value={stats.expired}
          label="Expired"
        />
      </section>


      {errorMessage ? (
        <div
          className="auth-error"
          style={{
            marginTop: 14,
          }}
        >
          {errorMessage}
        </div>
      ) : null}


      {successMessage ? (
        <div
          className="auth-success"
          style={{
            marginTop: 14,
          }}
        >
          {successMessage}
        </div>
      ) : null}


      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "end",
          marginTop: 18,
          marginBottom: 16,
        }}
      >
        <label
          style={{
            minWidth: 220,
          }}
        >
          <span>
            Document Status
          </span>

          <select
            className="input"
            value={filter}
            onChange={(event) =>
              setFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Documents
            </option>

            <option value="pending">
              Pending Review
            </option>

            <option value="verified">
              Verified
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="expiring">
              Expiring Soon
            </option>

            <option value="expired">
              Expired
            </option>
          </select>
        </label>


        {canManage ? (
          <label
            style={{
              minWidth: 240,
            }}
          >
            <span>
              Professional
            </span>

            <select
              className="input"
              value={
                selectedStaffId
              }
              onChange={(event) =>
                setSelectedStaffId(
                  event.target.value
                )
              }
            >
              <option value="">
                All professionals
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
        ) : null}
      </div>


      {loading &&
      documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            ⏳
          </div>

          <div>
            Loading compliance documents…
          </div>
        </div>
      ) : visibleDocuments.length ===
        0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            📄
          </div>

          <div>
            No compliance documents found.
          </div>

          <small>
            Uploaded workforce compliance
            documents will appear here.
          </small>
        </div>
      ) : (
        <div
          className="team-list"
          style={{
            marginTop: 12,
          }}
        >
          {visibleDocuments.map(
            (document) => {
              const expiry =
                getComplianceExpiryState(
                  document.expiryDate
                );

              const busy =
                actionId ===
                document.id;

              const ownDocument =
                document.userId ===
                user?.id;

              const canDelete =
                canManage ||
                (
                  ownDocument &&
                  document.verificationStatus ===
                    "pending"
                );

              return (
                <article
                  key={document.id}
                  className="team-member-card"
                >
                  <div className="team-member-avatar">
                    📄
                  </div>


                  <div className="team-member-info">
                    <strong>
                      {document.documentName}
                    </strong>

                    <span>
                      {document.documentType}
                    </span>


                    <small>
                      Professional:{" "}
                      <strong>
                        {getMemberDisplayName(
                          document.userId
                        )}
                      </strong>
                      {" · "}
                      {getMemberRole(
                        document.userId
                      )}
                    </small>


                    {document.referenceNumber ? (
                      <small>
                        Reference:{" "}
                        {
                          document.referenceNumber
                        }
                      </small>
                    ) : null}


                    <small>
                      Issue date:{" "}
                      {formatDate(
                        document.issueDate
                      )}
                    </small>


                    <small>
                      Expiry date:{" "}
                      {formatDate(
                        document.expiryDate
                      )}
                    </small>


                    <small>
                      File:{" "}
                      {document.originalFileName ||
                        "Compliance document"}
                      {" · "}
                      {formatFileSize(
                        document.fileSize
                      )}
                    </small>


                    <small>
                      Uploaded:{" "}
                      {formatDateTime(
                        document.createdAt
                      )}
                    </small>


                    {document.notes ? (
                      <small>
                        Notes:{" "}
                        {document.notes}
                      </small>
                    ) : null}


                    {document.rejectionReason ? (
                      <div
                        className="auth-error"
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                        }}
                      >
                        <strong>
                          Rejection reason:
                        </strong>{" "}
                        {
                          document.rejectionReason
                        }
                      </div>
                    ) : null}


                    <div
                      style={{
                        display: "flex",
                        gap: 7,
                        flexWrap: "wrap",
                        marginTop: 9,
                      }}
                    >
                      <span
                        style={
                          verificationStyle(
                            document.verificationStatus
                          )
                        }
                      >
                        {verificationLabel(
                          document.verificationStatus
                        )}
                      </span>


                      <span
                        style={
                          expiryStyle(
                            expiry.state
                          )
                        }
                      >
                        {expiry.label}

                        {typeof expiry.daysRemaining ===
                          "number" &&
                        expiry.state ===
                          "expiring"
                          ? ` · ${expiry.daysRemaining} day${
                              expiry.daysRemaining === 1
                                ? ""
                                : "s"
                            }`
                          : ""}
                      </span>
                    </div>
                  </div>


                  <div
                    className="team-card-actions"
                    style={{
                      alignItems:
                        "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void handleOpenDocument(
                          document
                        )
                      }
                    >
                      {busy
                        ? "Working…"
                        : "Open Document"}
                    </button>


                    {canManage &&
                    document.verificationStatus !==
                      "verified" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleVerify(
                            document
                          )
                        }
                      >
                        ✓ Verify
                      </button>
                    ) : null}


                    {canManage &&
                    document.verificationStatus !==
                      "rejected" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleReject(
                            document
                          )
                        }
                      >
                        Reject
                      </button>
                    ) : null}


                    {canManage &&
                    document.verificationStatus !==
                      "pending" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void handleResetReview(
                            document
                          )
                        }
                      >
                        Reset Review
                      </button>
                    ) : null}


                    {canDelete ? (
                      <button
                        type="button"
                        className="danger"
                        disabled={busy}
                        onClick={() =>
                          void handleDelete(
                            document
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


      <div
        className="notice-box"
        style={{
          marginTop: 18,
          fontSize: 12,
        }}
      >
        🔒 Compliance files are private.
        Opening a document creates a temporary
        secure link rather than exposing the
        storage bucket publicly.
      </div>
    </section>
  );
}