// src/features/workforce/ProfessionalOnboardingPanel.jsx

import {
  useState,
} from "react";

import { useWorkspace } from "../../context/WorkspaceContext";

import ProfessionalProfile from "./ProfessionalProfile";
import ProfessionalOnboardingReview from "./ProfessionalOnboardingReview";


export default function ProfessionalOnboardingPanel() {
  const {
    role,
  } = useWorkspace();

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);


  const canReviewProfessionals =
    [
      "provider_admin",
      "manager",
      "support_coordinator",
    ].includes(role);


  const canApproveProfessionals =
    [
      "provider_admin",
      "manager",
    ].includes(role);


  function handleProfileChanged() {
    setRefreshKey(
      (current) =>
        current + 1
    );
  }


  return (
    <div
      style={{
        display: "grid",
        gap: 18,
      }}
    >
      {/* =========================================
          ONBOARDING INTRODUCTION
      ========================================= */}

      <section className="card premium-card">
        <div className="eyebrow">
          Workforce Onboarding
        </div>

        <div
          className="card-title"
          style={{
            marginTop: 5,
          }}
        >
          Professional Onboarding &
          Service Readiness
        </div>

        <div className="card-subtitle">
          Build a verified professional
          workforce before assigning
          care-delivery services.
        </div>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
            marginTop: 18,
          }}
        >
          <div className="card">
            <small>
              Step 1
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              👤 Professional Profile
            </div>
          </div>


          <div className="card">
            <small>
              Step 2
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              🔎 Provider Review
            </div>
          </div>


          <div className="card">
            <small>
              Step 3
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              🪪 Compliance
            </div>
          </div>


          <div className="card">
            <small>
              Step 4
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              ✅ Service Ready
            </div>
          </div>


          <div className="card">
            <small>
              Step 5
            </small>

            <div
              style={{
                fontWeight: 800,
                marginTop: 4,
              }}
            >
              📅 Roster
            </div>
          </div>
        </div>
      </section>


      {/* =========================================
          CURRENT USER PROFILE
      ========================================= */}

      <ProfessionalProfile
        onProfileChanged={
          handleProfileChanged
        }
      />


      {/* =========================================
          PROVIDER REVIEW
      ========================================= */}

      {canReviewProfessionals ? (
        <ProfessionalOnboardingReview
          refreshKey={
            refreshKey
          }
          onProfileChanged={
            handleProfileChanged
          }
        />
      ) : null}


      {/* =========================================
          ROLE INFORMATION
      ========================================= */}

      {role ===
      "support_coordinator" ? (
        <section className="card premium-card">
          <div className="team-warning">
            <strong>
              Review Access
            </strong>

            <div
              style={{
                marginTop: 5,
              }}
            >
              Support Coordinators can
              view professional
              onboarding information,
              but final provider
              approval must be completed
              by a Provider Admin or
              Manager.
            </div>
          </div>
        </section>
      ) : null}


      {canApproveProfessionals ? (
        <section className="card premium-card">
          <div className="card-title">
            Service Readiness
          </div>

          <div className="card-subtitle">
            Provider approval is one
            part of workforce readiness.
            Theraa Nurse will combine
            onboarding approval,
            authorised services and
            compliance evidence before
            allowing a professional to
            be rostered.
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 14,
              alignItems: "center",
            }}
          >
            <span className="role-pill">
              👤 Profile
            </span>

            <span>
              →
            </span>

            <span className="role-pill">
              ✅ Provider Approval
            </span>

            <span>
              →
            </span>

            <span className="role-pill">
              🪪 Compliance
            </span>

            <span>
              →
            </span>

            <span className="role-pill">
              🩺 Service Authorisation
            </span>

            <span>
              →
            </span>

            <span className="role-pill">
              📅 Roster Ready
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}