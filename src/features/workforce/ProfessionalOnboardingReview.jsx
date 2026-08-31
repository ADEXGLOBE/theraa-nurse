// src/features/workforce/ProfessionalOnboardingReview.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";

import {
  approveProfessionalProfile,
  calculateProfessionalProfileCompletion,
  getOnboardingStatusLabel,
  listProfessionalProfiles,
  rejectProfessionalProfile,
} from "../../services/professionalProfileService";

import {
  evaluateProfessionalReadiness,
} from "../../services/serviceReadinessService";


/* =========================================================
   HELPERS
========================================================= */

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleString();
}


function statusAppearance(status) {
  switch (status) {
    case "approved":
      return {
        icon: "✅",
        background: "#dcfce7",
        border: "#86efac",
        color: "#166534",
      };

    case "in_review":
      return {
        icon: "🔎",
        background: "#dbeafe",
        border: "#93c5fd",
        color: "#1d4ed8",
      };

    case "rejected":
      return {
        icon: "⚠️",
        background: "#fee2e2",
        border: "#fca5a5",
        color: "#991b1b",
      };

    default:
      return {
        icon: "📝",
        background: "#f1f5f9",
        border: "#cbd5e1",
        color: "#475569",
      };
  }
}


function StatusBadge({
  status,
}) {
  const appearance =
    statusAppearance(status);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        background:
          appearance.background,
        border:
          `1px solid ${appearance.border}`,
        color:
          appearance.color,
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {appearance.icon}

      {getOnboardingStatusLabel(
        status
      )}
    </span>
  );
}


function ReviewStat({
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


/* =========================================================
   READINESS HELPERS
========================================================= */

function getGapIcon(status) {
  switch (status) {
    case "compliant":
      return "✅";

    case "expiring":
      return "⚠️";

    case "pending_review":
      return "🔎";

    case "missing":
    case "expired":
    case "rejected":
      return "❌";

    default:
      return "⚪";
  }
}


function getGapLabel(status) {
  if (!status) {
    return "UNKNOWN";
  }

  return String(status)
    .replaceAll("_", " ")
    .toUpperCase();
}


function readinessAppearance(
  status
) {
  switch (status) {
    case "ready":
      return {
        border: "#86efac",
        background: "#f0fdf4",
        color: "#166534",
      };

    case "warning":
      return {
        border: "#fde68a",
        background: "#fffbeb",
        color: "#92400e",
      };

    case "blocked":
      return {
        border: "#fca5a5",
        background: "#fef2f2",
        color: "#991b1b",
      };

    default:
      return {
        border: "#cbd5e1",
        background: "#f8fafc",
        color: "#475569",
      };
  }
}


/* =========================================================
   COMPONENT
========================================================= */

export default function ProfessionalOnboardingReview({
  refreshKey = 0,
  onProfileChanged,
}) {
  const {
    user,
  } = useAuth();

  const {
    organisationId,
    role,
  } = useWorkspace();


  /* =======================================================
     PROFILE STATE
  ======================================================= */

  const [
    profiles,
    setProfiles,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    actionProfileId,
    setActionProfileId,
  ] = useState(null);


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  const [
    selectedProfileId,
    setSelectedProfileId,
  ] = useState(null);


  const [
    reviewNotes,
    setReviewNotes,
  ] = useState("");


  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");


  /* =======================================================
     SERVICE READINESS STATE
  ======================================================= */

  const [
    readiness,
    setReadiness,
  ] = useState(null);


  const [
    readinessLoading,
    setReadinessLoading,
  ] = useState(false);


  const [
    readinessError,
    setReadinessError,
  ] = useState("");


  /* =======================================================
     PERMISSIONS
  ======================================================= */

  const canApprove =
    [
      "provider_admin",
      "manager",
    ].includes(role);


  const canViewReview =
    [
      "provider_admin",
      "manager",
      "support_coordinator",
    ].includes(role);


  /* =======================================================
     LOAD PROFESSIONAL PROFILES
  ======================================================= */

  const loadProfiles =
    useCallback(
      async () => {
        if (
          !organisationId ||
          !canViewReview
        ) {
          setProfiles([]);
          setLoading(false);
          return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
          const result =
            await listProfessionalProfiles(
              organisationId
            );

          setProfiles(
            Array.isArray(result)
              ? result
              : []
          );
        } catch (error) {
          console.error(
            "Unable to load professional onboarding profiles:",
            error
          );

          setErrorMessage(
            error?.message ||
              "Professional onboarding profiles could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        organisationId,
        canViewReview,
      ]
    );


  useEffect(() => {
    void loadProfiles();
  }, [
    loadProfiles,
    refreshKey,
  ]);


  /* =======================================================
     SELECTED PROFILE
  ======================================================= */

  const selectedProfile =
    useMemo(
      () =>
        profiles.find(
          (profile) =>
            profile.id ===
            selectedProfileId
        ) || null,
      [
        profiles,
        selectedProfileId,
      ]
    );


  useEffect(() => {
    setReviewNotes(
      selectedProfile
        ?.onboardingNotes ||
        ""
    );
  }, [
    selectedProfile,
  ]);


  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(
      () => ({
        total:
          profiles.length,

        incomplete:
          profiles.filter(
            (profile) =>
              profile.onboardingStatus ===
              "incomplete"
          ).length,

        inReview:
          profiles.filter(
            (profile) =>
              profile.onboardingStatus ===
              "in_review"
          ).length,

        approved:
          profiles.filter(
            (profile) =>
              profile.onboardingStatus ===
              "approved"
          ).length,

        rejected:
          profiles.filter(
            (profile) =>
              profile.onboardingStatus ===
              "rejected"
          ).length,
      }),
      [
        profiles,
      ]
    );


  /* =======================================================
     FILTERING
  ======================================================= */

  const filteredProfiles =
    useMemo(
      () => {
        if (
          statusFilter ===
          "all"
        ) {
          return profiles;
        }

        return profiles.filter(
          (profile) =>
            profile.onboardingStatus ===
            statusFilter
        );
      },
      [
        profiles,
        statusFilter,
      ]
    );


  /* =======================================================
     SERVICE READINESS
  ======================================================= */

  const loadReadiness =
    useCallback(
      async (profile) => {
        if (
          !organisationId ||
          !profile?.userId
        ) {
          setReadiness(null);
          return;
        }

        setReadinessLoading(true);
        setReadinessError("");

        try {
          const result =
            await evaluateProfessionalReadiness({
              organisationId,
              staffUserId:
                profile.userId,
            });

          setReadiness(result);
        } catch (error) {
          console.error(
            "Unable to evaluate professional service readiness:",
            error
          );

          setReadiness(null);

          setReadinessError(
            error?.message ||
              "Service readiness could not be evaluated."
          );
        } finally {
          setReadinessLoading(false);
        }
      },
      [
        organisationId,
      ]
    );


  /* =======================================================
     OPEN / CLOSE REVIEW
  ======================================================= */

  function handleToggleReview(
    profile
  ) {
    const selected =
      selectedProfileId ===
      profile.id;

    if (selected) {
      setSelectedProfileId(null);
      setReadiness(null);
      setReadinessError("");
      setReadinessLoading(false);

      return;
    }

    setSelectedProfileId(
      profile.id
    );

    setReadiness(null);
    setReadinessError("");

    void loadReadiness(
      profile
    );
  }


  /* =======================================================
     APPROVE PROFESSIONAL
  ======================================================= */

  async function handleApprove(
    profile
  ) {
    if (!canApprove) {
      setErrorMessage(
        "Your workspace role cannot approve professional onboarding."
      );

      return;
    }

    if (
      profile.userId ===
      user?.id
    ) {
      setErrorMessage(
        "You cannot approve your own professional onboarding profile."
      );

      return;
    }

    if (
      profile.onboardingStatus !==
      "in_review"
    ) {
      setErrorMessage(
        "Only profiles submitted for review can be approved."
      );

      return;
    }

    const completion =
      calculateProfessionalProfileCompletion(
        profile
      );

    if (
      !completion.complete
    ) {
      setErrorMessage(
        "This professional profile is incomplete and cannot be approved."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Approve ${profile.fullName || "this professional"} for provider onboarding?`
      );

    if (!confirmed) {
      return;
    }

    setActionProfileId(
      profile.id
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await approveProfessionalProfile({
        organisationId,
        profileId:
          profile.id,
        approvedBy:
          user?.id,
        notes:
          selectedProfileId ===
          profile.id
            ? reviewNotes
            : profile.onboardingNotes,
      });

      setSuccessMessage(
        `${profile.fullName || "Professional"} has been approved for provider onboarding.`
      );

      await loadProfiles();

      /*
       * Re-evaluate readiness after provider approval.
       *
       * This is important because provider approval is one
       * of the readiness gates.
       */
      if (
        selectedProfileId ===
        profile.id
      ) {
        await loadReadiness({
          ...profile,
          providerApproved: true,
          onboardingStatus:
            "approved",
        });
      }

      if (
        typeof onProfileChanged ===
        "function"
      ) {
        onProfileChanged();
      }
    } catch (error) {
      console.error(
        "Unable to approve professional:",
        error
      );

      setErrorMessage(
        error?.message ||
          "The professional could not be approved."
      );
    } finally {
      setActionProfileId(
        null
      );
    }
  }


  /* =======================================================
     RETURN FOR CORRECTION
  ======================================================= */

  async function handleReject(
    profile
  ) {
    if (!canApprove) {
      setErrorMessage(
        "Your workspace role cannot reject professional onboarding."
      );

      return;
    }

    if (
      profile.userId ===
      user?.id
    ) {
      setErrorMessage(
        "You cannot review your own professional onboarding profile."
      );

      return;
    }

    const notes =
      selectedProfileId ===
      profile.id
        ? reviewNotes.trim()
        : "";

    if (!notes) {
      setErrorMessage(
        "Enter provider review notes before rejecting the onboarding profile."
      );

      setSelectedProfileId(
        profile.id
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Return ${profile.fullName || "this professional"}'s onboarding profile for correction?`
      );

    if (!confirmed) {
      return;
    }

    setActionProfileId(
      profile.id
    );

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await rejectProfessionalProfile({
        organisationId,
        profileId:
          profile.id,
        notes,
      });

      setSuccessMessage(
        `${profile.fullName || "Professional"}'s onboarding profile requires correction.`
      );

      await loadProfiles();

      if (
        selectedProfileId ===
        profile.id
      ) {
        await loadReadiness({
          ...profile,
          providerApproved: false,
          onboardingStatus:
            "rejected",
        });
      }

      if (
        typeof onProfileChanged ===
        "function"
      ) {
        onProfileChanged();
      }
    } catch (error) {
      console.error(
        "Unable to reject professional:",
        error
      );

      setErrorMessage(
        error?.message ||
          "The professional review could not be completed."
      );
    } finally {
      setActionProfileId(
        null
      );
    }
  }


  /* =======================================================
     ACCESS BOUNDARY
  ======================================================= */

  if (!canViewReview) {
    return null;
  }


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      {/* ===================================================
          SUMMARY
      =================================================== */}

      <section className="team-stat-grid">
        <ReviewStat
          icon="🧑‍⚕️"
          label="Profiles"
          value={
            summary.total
          }
        />

        <ReviewStat
          icon="🔎"
          label="Awaiting Review"
          value={
            summary.inReview
          }
        />

        <ReviewStat
          icon="✅"
          label="Approved"
          value={
            summary.approved
          }
        />

        <ReviewStat
          icon="⚠️"
          label="Requires Attention"
          value={
            summary.rejected
          }
        />
      </section>


      {/* ===================================================
          GLOBAL MESSAGES
      =================================================== */}

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


      {/* ===================================================
          PROFESSIONAL REVIEW REGISTER
      =================================================== */}

      <section className="card premium-card">
        <div className="section-heading-row">
          <div>
            <div className="card-title">
              Professional Onboarding
              Review
            </div>

            <div className="card-subtitle">
              Review professional
              profiles and their
              current service readiness.
              Provider approval,
              authorised services and
              workforce compliance are
              evaluated separately
              before rostering.
            </div>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              void loadProfiles()
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


        {/* ===============================================
            FILTERS
        =============================================== */}

        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {[
            {
              value: "all",
              label: "All",
            },
            {
              value:
                "in_review",
              label:
                "Awaiting Review",
            },
            {
              value:
                "approved",
              label:
                "Approved",
            },
            {
              value:
                "incomplete",
              label:
                "Incomplete",
            },
            {
              value:
                "rejected",
              label:
                "Requires Attention",
            },
          ].map(
            (filter) => (
              <button
                key={
                  filter.value
                }
                type="button"
                className={
                  statusFilter ===
                  filter.value
                    ? "role-btn active"
                    : "role-btn"
                }
                onClick={() =>
                  setStatusFilter(
                    filter.value
                  )
                }
              >
                {filter.label}
              </button>
            )
          )}
        </div>


        {/* ===============================================
            LOADING / EMPTY
        =============================================== */}

        {loading ? (
          <div
            className="empty-state"
            style={{
              marginTop: 18,
            }}
          >
            Loading professional
            profiles…
          </div>
        ) : filteredProfiles.length ===
          0 ? (
          <div
            className="empty-state"
            style={{
              marginTop: 18,
            }}
          >
            <div className="empty-icon">
              🧑‍⚕️
            </div>

            <div>
              No professional profiles
              match this filter.
            </div>
          </div>
        ) : (
          <div
            className="team-list"
            style={{
              marginTop: 18,
            }}
          >
            {filteredProfiles.map(
              (profile) => {
                const completion =
                  calculateProfessionalProfileCompletion(
                    profile
                  );

                const selected =
                  selectedProfileId ===
                  profile.id;

                const appearance =
                  readinessAppearance(
                    selected
                      ? readiness
                        ?.status
                      : null
                  );

                return (
                  <article
                    key={
                      profile.id
                    }
                    className="card"
                    style={{
                      padding: 16,
                    }}
                  >
                    {/* ===================================
                        PROFILE HEADER
                    =================================== */}

                    <div
                      className="section-heading-row"
                      style={{
                        alignItems:
                          "flex-start",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          gap: 12,
                          alignItems:
                            "center",
                        }}
                      >
                        <div className="team-member-avatar">
                          {profile.fullName
                            ?.charAt(0)
                            ?.toUpperCase() ||
                            "P"}
                        </div>

                        <div className="team-member-info">
                          <strong>
                            {profile.fullName ||
                              "Unnamed Professional"}
                          </strong>

                          <span>
                            {profile.professionalRole ||
                              "Professional role not provided"}
                          </span>

                          <small>
                            {profile.employmentType ||
                              "Employment type not provided"}
                          </small>
                        </div>
                      </div>

                      <StatusBadge
                        status={
                          profile.onboardingStatus
                        }
                      />
                    </div>


                    {/* ===================================
                        PROFILE SUMMARY
                    =================================== */}

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: 9,
                        marginTop: 15,
                      }}
                    >
                      <div className="card">
                        <small>
                          Profile
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                            marginTop:
                              4,
                          }}
                        >
                          {
                            completion.percentage
                          }
                          %
                        </strong>
                      </div>


                      <div className="card">
                        <small>
                          Provider Approval
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                            marginTop:
                              4,
                          }}
                        >
                          {profile.providerApproved
                            ? "✅ Approved"
                            : "⏳ Pending"}
                        </strong>
                      </div>


                      <div className="card">
                        <small>
                          Services
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                            marginTop:
                              4,
                          }}
                        >
                          {
                            profile
                              .authorisedServices
                              ?.length || 0
                          }
                        </strong>
                      </div>


                      <div className="card">
                        <small>
                          Updated
                        </small>

                        <strong
                          style={{
                            display:
                              "block",
                            marginTop:
                              4,
                            fontSize:
                              12,
                          }}
                        >
                          {formatDate(
                            profile.updatedAt
                          )}
                        </strong>
                      </div>
                    </div>


                    {/* ===================================
                        CARD ACTIONS
                    =================================== */}

                    <div
                      style={{
                        display:
                          "flex",
                        gap: 8,
                        flexWrap:
                          "wrap",
                        marginTop: 14,
                      }}
                    >
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          handleToggleReview(
                            profile
                          )
                        }
                      >
                        {selected
                          ? "Close Review"
                          : "Review Profile"}
                      </button>


                      {canApprove &&
                      profile.onboardingStatus ===
                        "in_review" &&
                      profile.userId !==
                        user?.id ? (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={
                            actionProfileId ===
                            profile.id
                          }
                          onClick={() =>
                            void handleApprove(
                              profile
                            )
                          }
                        >
                          {actionProfileId ===
                          profile.id
                            ? "Processing…"
                            : "✅ Approve"}
                        </button>
                      ) : null}
                    </div>


                    {/* ===================================
                        EXPANDED REVIEW
                    =================================== */}

                    {selected ? (
                      <div
                        style={{
                          marginTop:
                            16,
                          paddingTop:
                            16,
                          borderTop:
                            "1px solid #e2e8f0",
                          display:
                            "grid",
                          gap: 16,
                        }}
                      >
                        {/* ===============================
                            PROFESSIONAL DETAILS
                        =============================== */}

                        <div>
                          <strong>
                            Professional
                            Details
                          </strong>

                          <div
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(210px, 1fr))",
                              gap: 12,
                              marginTop:
                                10,
                            }}
                          >
                            <div>
                              <small>
                                Phone
                              </small>

                              <div>
                                {profile.phone ||
                                  "—"}
                              </div>
                            </div>


                            <div>
                              <small>
                                Employee /
                                Contractor
                                Reference
                              </small>

                              <div>
                                {profile.employeeReference ||
                                  "—"}
                              </div>
                            </div>


                            <div>
                              <small>
                                Registration
                                Number
                              </small>

                              <div>
                                {profile.registrationNumber ||
                                  "—"}
                              </div>
                            </div>


                            <div>
                              <small>
                                Profile
                                Completion
                              </small>

                              <div>
                                {
                                  completion.percentage
                                }
                                %
                              </div>
                            </div>
                          </div>
                        </div>


                        {/* ===============================
                            QUALIFICATIONS
                        =============================== */}

                        <div>
                          <strong>
                            Qualifications
                          </strong>

                          <div
                            style={{
                              marginTop:
                                6,
                            }}
                          >
                            {profile.qualifications ||
                              "No qualifications provided."}
                          </div>
                        </div>


                        {/* ===============================
                            AREAS OF PRACTICE
                        =============================== */}

                        <div>
                          <strong>
                            Areas of Practice
                          </strong>

                          <div
                            style={{
                              marginTop:
                                7,
                              display:
                                "flex",
                              gap: 7,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            {profile
                              .areasOfPractice
                              ?.length > 0
                              ? profile.areasOfPractice.map(
                                  (
                                    area
                                  ) => (
                                    <span
                                      key={
                                        area
                                      }
                                      className="role-pill"
                                    >
                                      {
                                        area
                                      }
                                    </span>
                                  )
                                )
                              : "None provided."}
                          </div>
                        </div>


                        {/* ===============================
                            AUTHORISED SERVICES
                        =============================== */}

                        <div>
                          <strong>
                            Authorised Services
                          </strong>

                          <div
                            style={{
                              marginTop:
                                7,
                              display:
                                "flex",
                              gap: 7,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            {profile
                              .authorisedServices
                              ?.length > 0
                              ? profile.authorisedServices.map(
                                  (
                                    service
                                  ) => (
                                    <span
                                      key={
                                        service
                                      }
                                      className="role-pill"
                                    >
                                      {
                                        service
                                      }
                                    </span>
                                  )
                                )
                              : "No services selected."}
                          </div>
                        </div>


                        {/* ===============================
                            EXPERIENCE
                        =============================== */}

                        <div>
                          <strong>
                            Experience
                          </strong>

                          <div
                            style={{
                              marginTop:
                                6,
                              whiteSpace:
                                "pre-wrap",
                            }}
                          >
                            {profile.experienceSummary ||
                              "No experience summary provided."}
                          </div>
                        </div>


                        {/* ===============================
                            SERVICE READINESS
                        =============================== */}

                        <div
                          style={{
                            border:
                              `1px solid ${appearance.border}`,
                            background:
                              appearance.background,
                            borderRadius:
                              14,
                            padding: 16,
                            display:
                              "grid",
                            gap: 14,
                          }}
                        >
                          <div
                            className="section-heading-row"
                            style={{
                              alignItems:
                                "flex-start",
                            }}
                          >
                            <div>
                              <strong
                                style={{
                                  color:
                                    appearance.color,
                                }}
                              >
                                🛡️ Service
                                Readiness
                              </strong>

                              <div
                                style={{
                                  marginTop:
                                    4,
                                  fontSize:
                                    13,
                                  color:
                                    "#64748b",
                                }}
                              >
                                Combines
                                professional
                                onboarding,
                                provider
                                approval and
                                workforce
                                compliance.
                              </div>
                            </div>

                            <button
                              type="button"
                              className="btn-secondary"
                              disabled={
                                readinessLoading
                              }
                              onClick={() =>
                                void loadReadiness(
                                  profile
                                )
                              }
                            >
                              {readinessLoading
                                ? "Checking…"
                                : "↻ Recheck"}
                            </button>
                          </div>


                          {readinessLoading ? (
                            <div className="empty-state">
                              Checking
                              onboarding and
                              compliance
                              readiness…
                            </div>
                          ) : null}


                          {readinessError ? (
                            <div className="auth-error">
                              {readinessError}
                            </div>
                          ) : null}


                          {!readinessLoading &&
                          !readinessError &&
                          readiness ? (
                            <>
                              {/* =========================
                                  FINAL READINESS RESULT
                              ========================= */}

                              <div
                                style={{
                                  padding:
                                    14,
                                  borderRadius:
                                    12,
                                  border:
                                    `1px solid ${appearance.border}`,
                                  background:
                                    appearance.background,
                                  color:
                                    appearance.color,
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight:
                                      800,
                                    fontSize:
                                      17,
                                  }}
                                >
                                  {
                                    readiness.statusIcon
                                  }{" "}
                                  {
                                    readiness.statusLabel
                                  }
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      5,
                                    fontSize:
                                      12,
                                  }}
                                >
                                  Last
                                  evaluated:{" "}
                                  {formatDate(
                                    readiness.evaluatedAt
                                  )}
                                </div>
                              </div>


                              {/* =========================
                                  READINESS SUMMARY
                              ========================= */}

                              <div
                                style={{
                                  display:
                                    "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(170px, 1fr))",
                                  gap: 9,
                                }}
                              >
                                <div className="card">
                                  <small>
                                    Professional
                                    Profile
                                  </small>

                                  <strong
                                    style={{
                                      display:
                                        "block",
                                      marginTop:
                                        4,
                                    }}
                                  >
                                    {readiness
                                      .onboarding
                                      ?.profileComplete
                                      ? "✅ Complete"
                                      : "❌ Incomplete"}
                                  </strong>
                                </div>


                                <div className="card">
                                  <small>
                                    Provider
                                    Approval
                                  </small>

                                  <strong
                                    style={{
                                      display:
                                        "block",
                                      marginTop:
                                        4,
                                    }}
                                  >
                                    {readiness
                                      .onboarding
                                      ?.providerApproved
                                      ? "✅ Approved"
                                      : "❌ Not Approved"}
                                  </strong>
                                </div>


                                <div className="card">
                                  <small>
                                    Compliance
                                  </small>

                                  <strong
                                    style={{
                                      display:
                                        "block",
                                      marginTop:
                                        4,
                                    }}
                                  >
                                    {readiness
                                      .compliance
                                      ?.ready
                                      ? "✅ Cleared"
                                      : "❌ Blocked"}
                                  </strong>
                                </div>


                                <div className="card">
                                  <small>
                                    Compliance
                                    Requirements
                                  </small>

                                  <strong
                                    style={{
                                      display:
                                        "block",
                                      marginTop:
                                        4,
                                    }}
                                  >
                                    {readiness
                                      .compliance
                                      ?.requirementCount ??
                                      0}
                                  </strong>
                                </div>
                              </div>


                              {/* =========================
                                  COMPLIANCE REQUIREMENTS
                              ========================= */}

                              {readiness
                                .compliance
                                ?.gaps
                                ?.length >
                              0 ? (
                                <div>
                                  <strong>
                                    Compliance
                                    Requirements
                                  </strong>

                                  <div
                                    style={{
                                      display:
                                        "grid",
                                      gap: 7,
                                      marginTop:
                                        8,
                                    }}
                                  >
                                    {readiness.compliance.gaps.map(
                                      (
                                        gap
                                      ) => (
                                        <div
                                          key={
                                            gap.requirementId ||
                                            gap.id
                                          }
                                          style={{
                                            display:
                                              "flex",
                                            justifyContent:
                                              "space-between",
                                            alignItems:
                                              "center",
                                            gap: 12,
                                            padding:
                                              "10px 12px",
                                            background:
                                              "#ffffff",
                                            border:
                                              "1px solid #e2e8f0",
                                            borderRadius:
                                              10,
                                          }}
                                        >
                                          <span>
                                            {getGapIcon(
                                              gap.status
                                            )}{" "}
                                            {gap.requirementType ||
                                              "Compliance requirement"}
                                          </span>

                                          <strong
                                            style={{
                                              fontSize:
                                                11,
                                            }}
                                          >
                                            {getGapLabel(
                                              gap.status
                                            )}
                                          </strong>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="team-warning">
                                  No compliance
                                  requirements
                                  were found for
                                  this
                                  professional.
                                </div>
                              )}


                              {/* =========================
                                  BLOCKERS
                              ========================= */}

                              {readiness
                                .blockers
                                ?.length >
                              0 ? (
                                <div className="auth-error">
                                  <strong>
                                    Blocking
                                    Issues
                                  </strong>

                                  <div
                                    style={{
                                      marginTop:
                                        7,
                                      display:
                                        "grid",
                                      gap: 5,
                                    }}
                                  >
                                    {readiness.blockers.map(
                                      (
                                        blocker,
                                        index
                                      ) => (
                                        <div
                                          key={`${blocker}-${index}`}
                                        >
                                          ❌{" "}
                                          {
                                            blocker
                                          }
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              ) : null}


                              {/* =========================
                                  WARNINGS
                              ========================= */}

                              {readiness
                                .warnings
                                ?.length >
                              0 ? (
                                <div className="team-warning">
                                  <strong>
                                    Warnings
                                  </strong>

                                  <div
                                    style={{
                                      marginTop:
                                        7,
                                      display:
                                        "grid",
                                      gap: 5,
                                    }}
                                  >
                                    {readiness.warnings.map(
                                      (
                                        warning,
                                        index
                                      ) => (
                                        <div
                                          key={`${warning}-${index}`}
                                        >
                                          ⚠️{" "}
                                          {
                                            warning
                                          }
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              ) : null}


                              {/* =========================
                                  FINAL GUIDANCE
                              ========================= */}

                              {readiness.ready ? (
                                <div className="auth-success">
                                  ✅ No blocking
                                  service-readiness
                                  issues were
                                  detected.
                                </div>
                              ) : (
                                <div className="team-warning">
                                  <strong>
                                    Rostering
                                    currently
                                    blocked
                                  </strong>

                                  <div
                                    style={{
                                      marginTop:
                                        5,
                                    }}
                                  >
                                    This
                                    professional
                                    should not be
                                    rostered until
                                    the blocking
                                    readiness
                                    issues above
                                    are resolved.
                                  </div>
                                </div>
                              )}
                            </>
                          ) : null}
                        </div>


                        {/* ===============================
                            PROVIDER REVIEW
                        =============================== */}

                        {canApprove &&
                        profile.userId !==
                          user?.id ? (
                          <div>
                            <label>
                              <span>
                                Provider
                                Review Notes
                              </span>

                              <textarea
                                className="textarea"
                                rows={4}
                                value={
                                  reviewNotes
                                }
                                onChange={(
                                  event
                                ) =>
                                  setReviewNotes(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Record review notes or explain any corrections required..."
                              />
                            </label>


                            {profile.onboardingStatus ===
                            "in_review" ? (
                              <div
                                style={{
                                  display:
                                    "flex",
                                  gap: 8,
                                  flexWrap:
                                    "wrap",
                                  marginTop:
                                    10,
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn-primary"
                                  disabled={
                                    actionProfileId ===
                                    profile.id
                                  }
                                  onClick={() =>
                                    void handleApprove(
                                      profile
                                    )
                                  }
                                >
                                  {actionProfileId ===
                                  profile.id
                                    ? "Processing…"
                                    : "✅ Approve Professional"}
                                </button>

                                <button
                                  type="button"
                                  className="danger"
                                  disabled={
                                    actionProfileId ===
                                    profile.id
                                  }
                                  onClick={() =>
                                    void handleReject(
                                      profile
                                    )
                                  }
                                >
                                  ⚠️ Return for
                                  Correction
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}


                        {/* ===============================
                            PROVIDER NOTES
                        =============================== */}

                        {profile.onboardingNotes ? (
                          <div className="team-warning">
                            <strong>
                              Provider Review
                              Notes
                            </strong>

                            <div
                              style={{
                                marginTop:
                                  5,
                              }}
                            >
                              {
                                profile.onboardingNotes
                              }
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>


      {/* ===================================================
          APPROVAL / READINESS BOUNDARY
      =================================================== */}

      <section className="card premium-card">
        <div className="card-title">
          Professional Service
          Readiness Workflow
        </div>

        <div className="card-subtitle">
          Provider onboarding approval
          confirms that the organisation
          has reviewed the professional
          profile. Service readiness also
          considers workforce compliance
          and, during rostering, whether
          the professional is authorised
          for the selected service.
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gap: 8,
          }}
        >
          <div>
            🧑‍⚕️ Professional completes
            profile
          </div>

          <div>
            📤 Professional submits for
            provider review
          </div>

          <div>
            🔎 Provider reviews
            professional information
          </div>

          <div>
            ✅ Provider approves
            onboarding
          </div>

          <div>
            🪪 Compliance Engine checks
            required professional
            evidence
          </div>

          <div>
            🛡️ Service Readiness Engine
            combines onboarding and
            compliance
          </div>

          <div>
            📅 Roster Compliance Guard
            will check the selected
            service before scheduling
          </div>

          <div>
            📝 Service documentation
            will later connect completed
            rostered work to the
            participant record
          </div>
        </div>
      </section>
    </div>
  );
}