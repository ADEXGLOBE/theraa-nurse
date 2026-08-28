// src/features/workforce/ProfessionalProfile.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";

import {
  AUTHORISED_SERVICES,
  EMPLOYMENT_TYPES,
  PROFESSIONAL_ROLES,
  calculateProfessionalProfileCompletion,
  getMyProfessionalProfile,
  getOnboardingStatusLabel,
  saveMyProfessionalProfile,
  submitProfessionalProfileForReview,
} from "../../services/professionalProfileService";


const EMPTY_PROFILE = {
  fullName: "",
  preferredName: "",
  phone: "",

  professionalRole: "",
  employmentType: "",
  employeeReference: "",

  qualifications: "",
  registrationNumber: "",

  areasOfPractice: [],
  authorisedServices: [],

  experienceSummary: "",

  onboardingStatus: "incomplete",
  providerApproved: false,
  onboardingNotes: "",
};


function statusAppearance(status) {
  switch (status) {
    case "approved":
      return {
        background: "#dcfce7",
        color: "#166534",
        border: "#86efac",
        icon: "✅",
      };

    case "in_review":
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
        border: "#93c5fd",
        icon: "🔎",
      };

    case "rejected":
      return {
        background: "#fee2e2",
        color: "#991b1b",
        border: "#fca5a5",
        icon: "⚠️",
      };

    default:
      return {
        background: "#f1f5f9",
        color: "#475569",
        border: "#cbd5e1",
        icon: "📝",
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
        padding: "7px 11px",
        borderRadius: 999,
        background:
          appearance.background,
        color:
          appearance.color,
        border: `1px solid ${appearance.border}`,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      <span>
        {appearance.icon}
      </span>

      {getOnboardingStatusLabel(
        status
      )}
    </span>
  );
}


function ProgressBar({
  percentage,
}) {
  return (
    <div
      style={{
        width: "100%",
        height: 12,
        borderRadius: 999,
        overflow: "hidden",
        background: "#e2e8f0",
      }}
    >
      <div
        style={{
          width: `${Math.max(
            0,
            Math.min(
              percentage,
              100
            )
          )}%`,
          height: "100%",
          borderRadius: 999,
          background:
            percentage === 100
              ? "#16a34a"
              : "#2563eb",
          transition:
            "width 180ms ease",
        }}
      />
    </div>
  );
}


function SectionTitle({
  icon,
  title,
  description,
}) {
  return (
    <div
      style={{
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontWeight: 800,
          fontSize: 17,
        }}
      >
        <span>{icon}</span>
        <span>{title}</span>
      </div>

      {description ? (
        <div
          className="card-subtitle"
          style={{
            marginTop: 4,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>
  );
}


export default function ProfessionalProfile({
  onProfileChanged,
}) {
  const {
    user,
  } = useAuth();

  const {
    organisationId,
    organisationName,
    roleLabel,
  } = useWorkspace();


  const [
    profile,
    setProfile,
  ] = useState(
    EMPTY_PROFILE
  );


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    submitting,
    setSubmitting,
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
    areaInput,
    setAreaInput,
  ] = useState("");


  const completion =
    useMemo(
      () =>
        calculateProfessionalProfileCompletion(
          profile
        ),
      [
        profile,
      ]
    );


  const profileLocked =
    profile.onboardingStatus ===
      "in_review" ||
    profile.providerApproved;


  const loadProfile =
    useCallback(
      async () => {
        if (
          !organisationId ||
          !user?.id
        ) {
          setLoading(false);
          return;
        }

        setLoading(true);
        setErrorMessage("");

        try {
          const existingProfile =
            await getMyProfessionalProfile({
              organisationId,
              userId:
                user.id,
            });

          if (
            existingProfile
          ) {
            setProfile({
              ...EMPTY_PROFILE,
              ...existingProfile,
            });
          } else {
            setProfile(
              EMPTY_PROFILE
            );
          }
        } catch (error) {
          console.error(
            "Unable to load professional profile:",
            error
          );

          setErrorMessage(
            error?.message ||
              "Your professional profile could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        organisationId,
        user?.id,
      ]
    );


  useEffect(() => {
    void loadProfile();
  }, [
    loadProfile,
  ]);


  function updateField(
    key,
    value
  ) {
    setProfile(
      (previous) => ({
        ...previous,
        [key]: value,
      })
    );

    setSuccessMessage("");
  }


  function toggleService(
    service
  ) {
    setProfile(
      (previous) => {
        const services =
          Array.isArray(
            previous.authorisedServices
          )
            ? previous.authorisedServices
            : [];

        const exists =
          services.includes(
            service
          );

        return {
          ...previous,

          authorisedServices:
            exists
              ? services.filter(
                  (item) =>
                    item !==
                    service
                )
              : [
                  ...services,
                  service,
                ],
        };
      }
    );

    setSuccessMessage("");
  }


  function addAreaOfPractice() {
    const value =
      areaInput.trim();

    if (!value) {
      return;
    }

    setProfile(
      (previous) => {
        const current =
          Array.isArray(
            previous.areasOfPractice
          )
            ? previous.areasOfPractice
            : [];

        if (
          current.some(
            (item) =>
              item.toLowerCase() ===
              value.toLowerCase()
          )
        ) {
          return previous;
        }

        return {
          ...previous,

          areasOfPractice: [
            ...current,
            value,
          ],
        };
      }
    );

    setAreaInput("");
  }


  function removeAreaOfPractice(
    area
  ) {
    setProfile(
      (previous) => ({
        ...previous,

        areasOfPractice:
          previous.areasOfPractice.filter(
            (item) =>
              item !== area
          ),
      })
    );
  }


  async function handleSave(
    event
  ) {
    if (event) {
      event.preventDefault();
    }

    if (
      !organisationId ||
      !user?.id
    ) {
      setErrorMessage(
        "Your workspace information is unavailable."
      );

      return null;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const saved =
        await saveMyProfessionalProfile({
          organisationId,
          userId:
            user.id,
          profile,
        });

      setProfile(
        (previous) => ({
          ...previous,
          ...saved,
        })
      );

      setSuccessMessage(
        "Professional profile saved."
      );

      if (
        typeof onProfileChanged ===
        "function"
      ) {
        onProfileChanged(
          saved
        );
      }

      return saved;
    } catch (error) {
      console.error(
        "Unable to save professional profile:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Your professional profile could not be saved."
      );

      return null;
    } finally {
      setSaving(false);
    }
  }


  async function handleSubmitForReview() {
    if (
      !completion.complete
    ) {
      setErrorMessage(
        `Complete the following before submitting: ${completion.missingFields.join(
          ", "
        )}.`
      );

      return;
    }

    if (
      !organisationId ||
      !user?.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Submit your professional profile for provider review?"
      );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const saved =
        await saveMyProfessionalProfile({
          organisationId,
          userId:
            user.id,
          profile,
        });

      const submitted =
        await submitProfessionalProfileForReview({
          organisationId,
          userId:
            user.id,
        });

      setProfile({
        ...EMPTY_PROFILE,
        ...saved,
        ...submitted,
      });

      setSuccessMessage(
        "Your professional onboarding profile has been submitted for provider review."
      );

      if (
        typeof onProfileChanged ===
        "function"
      ) {
        onProfileChanged(
          submitted
        );
      }
    } catch (error) {
      console.error(
        "Unable to submit professional profile:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Your professional profile could not be submitted."
      );
    } finally {
      setSubmitting(false);
    }
  }


  if (loading) {
    return (
      <section className="card premium-card">
        <div className="empty-state">
          <div className="empty-icon">
            ⏳
          </div>

          <div>
            Loading professional
            onboarding…
          </div>
        </div>
      </section>
    );
  }


  return (
    <div
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      {/* ==============================
          ONBOARDING SUMMARY
      ============================== */}

      <section className="card premium-card">
        <div
          className="section-heading-row"
          style={{
            alignItems:
              "flex-start",
          }}
        >
          <div>
            <div className="eyebrow">
              Professional Onboarding
            </div>

            <div
              className="card-title"
              style={{
                marginTop: 5,
              }}
            >
              My Professional Profile
            </div>

            <div className="card-subtitle">
              Complete your professional
              information before you are
              approved to provide services
              within{" "}
              {organisationName ||
                "this provider workspace"}.
            </div>
          </div>

          <StatusBadge
            status={
              profile.onboardingStatus
            }
          />
        </div>


        <div
          style={{
            marginTop: 22,
            display: "grid",
            gap: 9,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <strong>
              Onboarding Profile
            </strong>

            <strong>
              {
                completion.percentage
              }
              %
            </strong>
          </div>

          <ProgressBar
            percentage={
              completion.percentage
            }
          />

          <small
            style={{
              color: "#64748b",
            }}
          >
            {
              completion.completedFields
            }{" "}
            of{" "}
            {
              completion.totalFields
            }{" "}
            required profile areas
            completed.
          </small>
        </div>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginTop: 20,
          }}
        >
          <div className="card">
            <small>
              Workspace Role
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 5,
              }}
            >
              {roleLabel ||
                "Professional"}
            </div>
          </div>


          <div className="card">
            <small>
              Profile
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 5,
              }}
            >
              {completion.complete
                ? "✅ Complete"
                : "📝 Incomplete"}
            </div>
          </div>


          <div className="card">
            <small>
              Provider Approval
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 5,
              }}
            >
              {profile.providerApproved
                ? "✅ Approved"
                : "⏳ Not Approved"}
            </div>
          </div>


          <div className="card">
            <small>
              Service Readiness
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 5,
              }}
            >
              {profile.providerApproved
                ? "✅ Provider Approved"
                : "⏳ Pending"}
            </div>
          </div>
        </div>
      </section>


      {profileLocked ? (
        <div
          className={
            profile.providerApproved
              ? "auth-success"
              : "team-warning"
          }
        >
          {profile.providerApproved
            ? "Your professional onboarding has been approved by the provider."
            : "Your profile is currently under provider review. Editing is temporarily locked until the review is completed."}
        </div>
      ) : null}


      {profile.onboardingStatus ===
        "rejected" ? (
        <div className="auth-error">
          <strong>
            Provider review requires
            attention.
          </strong>

          {profile.onboardingNotes ? (
            <div
              style={{
                marginTop: 6,
              }}
            >
              {
                profile.onboardingNotes
              }
            </div>
          ) : null}
        </div>
      ) : null}


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


      {/* ==============================
          PROFILE FORM
      ============================== */}

      <form
        onSubmit={
          handleSave
        }
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        {/* PERSONAL */}

        <section className="card premium-card">
          <SectionTitle
            icon="👤"
            title="Personal Details"
            description="Your identity and contact information within the provider workforce."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <label>
              <span>
                Full Name *
              </span>

              <input
                className="input"
                value={
                  profile.fullName
                }
                disabled={
                  profileLocked
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "fullName",
                    event.target
                      .value
                  )
                }
                placeholder="e.g. James Walker"
              />
            </label>


            <label>
              <span>
                Preferred Name
              </span>

              <input
                className="input"
                value={
                  profile.preferredName
                }
                disabled={
                  profileLocked
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "preferredName",
                    event.target
                      .value
                  )
                }
                placeholder="Name used at work"
              />
            </label>


            <label>
              <span>
                Phone *
              </span>

              <input
                className="input"
                type="tel"
                value={
                  profile.phone
                }
                disabled={
                  profileLocked
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "phone",
                    event.target
                      .value
                  )
                }
                placeholder="04..."
              />
            </label>


            <label>
              <span>
                Account Email
              </span>

              <input
                className="input"
                value={
                  user?.email || ""
                }
                disabled
              />
            </label>
          </div>
        </section>


        {/* PROFESSIONAL */}

        <section className="card premium-card">
          <SectionTitle
            icon="🧑‍⚕️"
            title="Professional Details"
            description="Tell the provider about your professional role and employment arrangement."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <label>
              <span>
                Professional Role *
              </span>

              <select
                className="input"
                value={
                  profile.professionalRole
                }
                disabled={
                  profileLocked
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "professionalRole",
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  Select role
                </option>

                {PROFESSIONAL_ROLES.map(
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
                Employment Type *
              </span>

              <select
                className="input"
                value={
                  profile.employmentType
                }
                disabled={
                  profileLocked
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "employmentType",
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  Select employment
                  type
                </option>

                {EMPLOYMENT_TYPES.map(
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
                Employee / Contractor
                Reference
              </span>

              <input
                className="input"
                value={
                  profile.employeeReference
                }
                disabled={
                  profileLocked
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "employeeReference",
                    event.target
                      .value
                  )
                }
                placeholder="Optional internal reference"
              />
            </label>


            <label>
              <span>
                Registration Number
              </span>

              <input
                className="input"
                value={
                  profile.registrationNumber
                }
                disabled={
                  profileLocked
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "registrationNumber",
                    event.target
                      .value
                  )
                }
                placeholder="If professionally registered"
              />
            </label>
          </div>


          <label
            style={{
              display: "block",
              marginTop: 14,
            }}
          >
            <span>
              Qualifications *
            </span>

            <textarea
              className="textarea"
              rows={4}
              value={
                profile.qualifications
              }
              disabled={
                profileLocked
              }
              onChange={(
                event
              ) =>
                updateField(
                  "qualifications",
                  event.target
                    .value
                )
              }
              placeholder="e.g. Certificate III in Individual Support, Bachelor of Nursing..."
            />
          </label>
        </section>


        {/* AREAS OF PRACTICE */}

        <section className="card premium-card">
          <SectionTitle
            icon="🎯"
            title="Areas of Practice"
            description="Identify the care, disability or health areas in which you have experience."
          />

          {!profileLocked ? (
            <div
              style={{
                display: "flex",
                gap: 8,
              }}
            >
              <input
                className="input"
                value={
                  areaInput
                }
                onChange={(
                  event
                ) =>
                  setAreaInput(
                    event.target
                      .value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();
                    addAreaOfPractice();
                  }
                }}
                placeholder="e.g. Dementia care"
              />

              <button
                type="button"
                className="btn-secondary"
                onClick={
                  addAreaOfPractice
                }
              >
                + Add
              </button>
            </div>
          ) : null}


          {profile.areasOfPractice
            .length === 0 ? (
            <div
              className="empty-state"
              style={{
                marginTop: 12,
              }}
            >
              No areas of practice
              added yet.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 14,
              }}
            >
              {profile.areasOfPractice.map(
                (area) => (
                  <span
                    key={area}
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      gap: 7,
                      padding:
                        "7px 10px",
                      borderRadius:
                        999,
                      background:
                        "#eff6ff",
                      border:
                        "1px solid #bfdbfe",
                      color:
                        "#1e40af",
                      fontSize: 13,
                      fontWeight:
                        600,
                    }}
                  >
                    {area}

                    {!profileLocked ? (
                      <button
                        type="button"
                        onClick={() =>
                          removeAreaOfPractice(
                            area
                          )
                        }
                        style={{
                          border:
                            "none",
                          background:
                            "transparent",
                          cursor:
                            "pointer",
                          padding: 0,
                          color:
                            "inherit",
                        }}
                        aria-label={`Remove ${area}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                )
              )}
            </div>
          )}
        </section>


        {/* AUTHORISED SERVICES */}

        <section className="card premium-card">
          <SectionTitle
            icon="🩺"
            title="Services"
            description="Select the services you are qualified, experienced or authorised to provide. Provider approval and compliance checks will still apply."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 9,
            }}
          >
            {AUTHORISED_SERVICES.map(
              (service) => {
                const selected =
                  profile.authorisedServices.includes(
                    service
                  );

                return (
                  <label
                    key={
                      service
                    }
                    style={{
                      display:
                        "flex",
                      gap: 9,
                      alignItems:
                        "flex-start",
                      padding:
                        "10px 12px",
                      border:
                        selected
                          ? "1px solid #60a5fa"
                          : "1px solid #e2e8f0",
                      borderRadius:
                        10,
                      background:
                        selected
                          ? "#eff6ff"
                          : "transparent",
                      cursor:
                        profileLocked
                          ? "default"
                          : "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        selected
                      }
                      disabled={
                        profileLocked
                      }
                      onChange={() =>
                        toggleService(
                          service
                        )
                      }
                    />

                    <span>
                      {service}
                    </span>
                  </label>
                );
              }
            )}
          </div>
        </section>


        {/* EXPERIENCE */}

        <section className="card premium-card">
          <SectionTitle
            icon="📋"
            title="Experience Summary"
            description="Provide a concise overview of your relevant professional and care-delivery experience."
          />

          <textarea
            className="textarea"
            rows={6}
            value={
              profile.experienceSummary
            }
            disabled={
              profileLocked
            }
            onChange={(
              event
            ) =>
              updateField(
                "experienceSummary",
                event.target
                  .value
              )
            }
            placeholder="Describe your relevant experience, participant groups supported, clinical or disability support experience and areas of strength..."
          />
        </section>


        {/* MISSING PROFILE ITEMS */}

        {!completion.complete ? (
          <section className="card premium-card">
            <SectionTitle
              icon="🧭"
              title="Before You Submit"
              description="Complete these areas before submitting your profile for provider review."
            />

            <div
              style={{
                display: "grid",
                gap: 8,
              }}
            >
              {completion.missingFields.map(
                (field) => (
                  <div
                    key={field}
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: 8,
                    }}
                  >
                    <span>
                      ⬜
                    </span>

                    <span>
                      {field}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>
        ) : null}


        {/* ACTIONS */}

        {!profileLocked ? (
          <section className="card premium-card">
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                flexWrap:
                  "wrap",
                gap: 12,
              }}
            >
              <div>
                <strong>
                  Professional
                  Onboarding
                </strong>

                <div className="card-subtitle">
                  Save your work at
                  any time. Submit
                  once your profile
                  reaches 100%.
                </div>
              </div>


              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap:
                    "wrap",
                }}
              >
                <button
                  type="submit"
                  className="btn-secondary"
                  disabled={
                    saving ||
                    submitting
                  }
                >
                  {saving
                    ? "Saving…"
                    : "💾 Save Profile"}
                </button>


                <button
                  type="button"
                  className="btn-primary"
                  disabled={
                    saving ||
                    submitting ||
                    !completion.complete
                  }
                  onClick={() =>
                    void handleSubmitForReview()
                  }
                >
                  {submitting
                    ? "Submitting…"
                    : "📤 Submit for Provider Review"}
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </form>


      {/* APPROVED */}

      {profile.providerApproved ? (
        <section
          className="card premium-card"
          style={{
            border:
              "1px solid #86efac",
            background:
              "#f0fdf4",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color:
                "#166534",
            }}
          >
            ✅ Provider Approved
          </div>

          <div
            style={{
              marginTop: 7,
              color:
                "#166534",
            }}
          >
            Your professional
            onboarding profile has
            been approved within this
            provider workspace.
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color:
                "#15803d",
            }}
          >
            Final service readiness
            will also consider your
            workforce compliance
            requirements before you
            are rostered for services.
          </div>
        </section>
      ) : null}
    </div>
  );
}