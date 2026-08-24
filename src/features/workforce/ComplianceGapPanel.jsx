// src/features/workforce/ComplianceGapPanel.jsx

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
  buildOrganisationComplianceGaps,
  getComplianceReadiness,
} from "../../services/complianceGapService";


function shortId(value) {
  if (!value) {
    return "Unknown";
  }

  return `${String(value).slice(0, 8)}…`;
}


function statusLabel(status) {
  switch (status) {
    case "compliant":
      return "Compliant";

    case "expiring":
      return "Expiring Soon";

    case "pending_review":
      return "Pending Review";

    case "rejected":
      return "Rejected";

    case "expired":
      return "Expired";

    case "missing":
      return "Missing";

    default:
      return "Unknown";
  }
}


function statusStyle(status) {
  const backgrounds = {
    compliant: "#dcfce7",
    expiring: "#fef3c7",
    pending_review: "#dbeafe",
    rejected: "#fee2e2",
    expired: "#fee2e2",
    missing: "#fee2e2",
    unknown: "#f3f4f6",
  };

  const textColours = {
    compliant: "#166534",
    expiring: "#92400e",
    pending_review: "#1d4ed8",
    rejected: "#991b1b",
    expired: "#991b1b",
    missing: "#991b1b",
    unknown: "#374151",
  };

  return {
    padding: "5px 9px",
    borderRadius: 999,
    background:
      backgrounds[status] ||
      backgrounds.unknown,
    color:
      textColours[status] ||
      textColours.unknown,
    fontSize: 11,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
  };
}


function severityLabel(severity) {
  switch (severity) {
    case "high":
      return "High";

    case "medium":
      return "Medium";

    case "none":
      return "None";

    default:
      return "Low";
  }
}


function GapStat({
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


export default function ComplianceGapPanel({
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
    members,
    setMembers,
  ] = useState([]);


  const [
    invitations,
    setInvitations,
  ] = useState([]);


  const [
    gaps,
    setGaps,
  ] = useState([]);


  const [
    summary,
    setSummary,
  ] = useState({
    requirements: 0,
    compliant: 0,
    expiring: 0,
    pendingReview: 0,
    rejected: 0,
    expired: 0,
    missing: 0,
    attentionRequired: 0,
  });


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const [
    filter,
    setFilter,
  ] = useState("attention");


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
          return "Unknown professional";
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

        if (
          member?.role
        ) {
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


  const getMemberRole =
    useCallback(
      (userId) => {
        const member =
          activeMembers.find(
            (item) =>
              item.user_id ===
              userId
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


  const refreshGaps =
    useCallback(
      async () => {
        if (
          !organisationId
        ) {
          setGaps([]);
          return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
          const [
            gapResult,
            loadedMembers,
            loadedInvitations,
          ] =
            await Promise.all([
              buildOrganisationComplianceGaps({
                organisationId,
              }),

              listOrganisationMembers(
                organisationId
              ),

              listOrganisationInvitations(
                organisationId
              ),
            ]);


          setGaps(
            Array.isArray(
              gapResult?.gaps
            )
              ? gapResult.gaps
              : []
          );


          setSummary({
            requirements:
              gapResult?.summary
                ?.requirements ||
              0,

            compliant:
              gapResult?.summary
                ?.compliant ||
              0,

            expiring:
              gapResult?.summary
                ?.expiring ||
              0,

            pendingReview:
              gapResult?.summary
                ?.pendingReview ||
              0,

            rejected:
              gapResult?.summary
                ?.rejected ||
              0,

            expired:
              gapResult?.summary
                ?.expired ||
              0,

            missing:
              gapResult?.summary
                ?.missing ||
              0,

            attentionRequired:
              gapResult?.summary
                ?.attentionRequired ||
              0,
          });


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
            "Unable to analyse compliance gaps:",
            error
          );

          setErrorMessage(
            error?.message ||
              "Compliance gaps could not be analysed."
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
    void refreshGaps();
  }, [
    refreshGaps,
    refreshKey,
  ]);


  const visibleGaps =
    useMemo(() => {
      return gaps.filter(
        (gap) => {
          if (
            selectedStaffId &&
            gap.staffUserId !==
              selectedStaffId
          ) {
            return false;
          }


          if (
            filter === "all"
          ) {
            return true;
          }


          if (
            filter ===
            "attention"
          ) {
            return [
              "missing",
              "expired",
              "rejected",
              "expiring",
              "pending_review",
            ].includes(
              gap.status
            );
          }


          return (
            gap.status ===
            filter
          );
        }
      );
    }, [
      gaps,
      filter,
      selectedStaffId,
    ]);


  const readiness =
    useMemo(
      () =>
        getComplianceReadiness(
          visibleGaps
        ),
      [
        visibleGaps,
      ]
    );


  return (
    <section className="card premium-card">
      <div className="section-heading-row">
        <div>
          <div className="card-title">
            Compliance Gap Detection
          </div>

          <div className="card-subtitle">
            Compare declared workforce
            requirements against uploaded
            and verified compliance evidence.
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            void refreshGaps()
          }
          disabled={
            loading
          }
        >
          {loading
            ? "Analysing…"
            : "↻ Analyse"}
        </button>
      </div>


      <section
        className="team-stat-grid"
        style={{
          marginTop: 16,
        }}
      >
        <GapStat
          icon="📋"
          value={
            summary.requirements
          }
          label="Requirements"
        />

        <GapStat
          icon="✅"
          value={
            summary.compliant
          }
          label="Compliant"
        />

        <GapStat
          icon="⚠️"
          value={
            summary.attentionRequired
          }
          label="Need Attention"
        />

        <GapStat
          icon="❌"
          value={
            summary.missing
          }
          label="Missing"
        />

        <GapStat
          icon="⛔"
          value={
            summary.expired
          }
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


      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
          marginTop: 16,
        }}
      >
        <label>
          <span>
            Gap Status
          </span>

          <select
            className="input"
            value={
              filter
            }
            onChange={(
              event
            ) =>
              setFilter(
                event.target.value
              )
            }
          >
            <option value="attention">
              Needs Attention
            </option>

            <option value="all">
              All Requirements
            </option>

            <option value="compliant">
              Compliant
            </option>

            <option value="expiring">
              Expiring Soon
            </option>

            <option value="pending_review">
              Pending Review
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="expired">
              Expired
            </option>

            <option value="missing">
              Missing
            </option>
          </select>
        </label>


        {canManage ? (
          <label>
            <span>
              Professional
            </span>

            <select
              className="input"
              value={
                selectedStaffId
              }
              onChange={(
                event
              ) =>
                setSelectedStaffId(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                All professionals
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
        ) : null}
      </div>


      <div
        className="notice-box"
        style={{
          marginTop: 14,
          fontSize: 12,
        }}
      >
        {readiness.ready ? (
          <>
            ✅ No blocking compliance
            gaps are present in the
            currently selected view.
          </>
        ) : (
          <>
            ⚠️{" "}
            <strong>
              {
                readiness.blockingCount
              }
            </strong>{" "}
            blocking compliance gap
            {readiness.blockingCount ===
            1
              ? ""
              : "s"}{" "}
            detected.

            {readiness.warningCount >
            0 ? (
              <>
                {" "}
                {
                  readiness.warningCount
                }{" "}
                additional warning
                {readiness.warningCount ===
                1
                  ? ""
                  : "s"}{" "}
                also require attention.
              </>
            ) : null}
          </>
        )}
      </div>


      {loading &&
      gaps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            ⏳
          </div>

          <div>
            Analysing workforce
            compliance…
          </div>
        </div>
      ) : visibleGaps.length ===
        0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            ✅
          </div>

          <div>
            No compliance gaps in this
            view.
          </div>

          <small>
            Declared requirements with
            matching current verified
            evidence will appear as
            compliant.
          </small>
        </div>
      ) : (
        <div
          className="team-list"
          style={{
            marginTop: 16,
          }}
        >
          {visibleGaps.map(
            (gap) => (
              <article
                key={
                  gap.requirementId
                }
                className="team-member-card"
              >
                <div className="team-member-avatar">
                  {gap.status ===
                  "compliant"
                    ? "✅"
                    : gap.status ===
                      "expiring"
                    ? "⚠️"
                    : gap.status ===
                      "pending_review"
                    ? "🕒"
                    : "❌"}
                </div>


                <div className="team-member-info">
                  <strong>
                    {
                      gap.requirementType
                    }
                  </strong>


                  <span>
                    {getMemberDisplayName(
                      gap.staffUserId
                    )}
                  </span>


                  <small>
                    {getMemberRole(
                      gap.staffUserId
                    )}
                  </small>


                  <small>
                    Assessment:{" "}
                    <strong>
                      {gap.label}
                    </strong>
                  </small>


                  <small>
                    Matching document
                    records:{" "}
                    {
                      gap.matchingDocumentCount
                    }
                  </small>


                  {gap.currentDocuments
                    .length > 0 ? (
                    <small>
                      Current verified:{" "}
                      {
                        gap.currentDocuments
                          .length
                      }
                    </small>
                  ) : null}


                  {gap.expiringDocuments
                    .length > 0 ? (
                    <small>
                      Verified expiring:{" "}
                      {
                        gap.expiringDocuments
                          .length
                      }
                    </small>
                  ) : null}


                  {gap.pendingDocuments
                    .length > 0 ? (
                    <small>
                      Awaiting review:{" "}
                      {
                        gap.pendingDocuments
                          .length
                      }
                    </small>
                  ) : null}


                  {gap.expiredDocuments
                    .length > 0 ? (
                    <small>
                      Expired evidence:{" "}
                      {
                        gap.expiredDocuments
                          .length
                      }
                    </small>
                  ) : null}


                  {gap.rejectedDocuments
                    .length > 0 ? (
                    <small>
                      Rejected evidence:{" "}
                      {
                        gap.rejectedDocuments
                          .length
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
                    style={
                      statusStyle(
                        gap.status
                      )
                    }
                  >
                    {statusLabel(
                      gap.status
                    )}
                  </span>

                  <span
                    style={{
                      fontSize: 11,
                      color: "#6b7280",
                      fontWeight: 700,
                    }}
                  >
                    Severity:{" "}
                    {severityLabel(
                      gap.severity
                    )}
                  </span>
                </div>
              </article>
            )
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
        Theraa Nurse only checks
        requirements that have been
        declared in the Workforce
        Compliance Register. It does not
        assume every credential applies
        to every professional.
      </div>
    </section>
  );
}