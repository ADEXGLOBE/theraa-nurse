// src/services/serviceReadinessService.js

import {
  buildStaffComplianceGaps,
  getComplianceReadiness,
} from "./complianceGapService";

import {
  getMyProfessionalProfile,
  calculateProfessionalProfileCompletion,
} from "./professionalProfileService";


/* =========================================================
   CONSTANTS
========================================================= */

export const SERVICE_READINESS_STATUS = {
  READY: "ready",
  WARNING: "warning",
  BLOCKED: "blocked",
};


/* =========================================================
   BASIC HELPERS
========================================================= */

function clean(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}


function uniqueStrings(values = []) {
  return [
    ...new Set(
      (values || [])
        .filter(Boolean)
        .map((value) =>
          String(value).trim()
        )
        .filter(Boolean)
    ),
  ];
}


/* =========================================================
   SERVICE NAME NORMALISATION
========================================================= */

/*
 * We normalise service names before comparing them.
 *
 * This prevents small differences in wording/capitalisation
 * from incorrectly blocking an otherwise authorised worker.
 */

function normaliseServiceType(value) {
  const text = clean(value);

  const aliases = {
    "support":
      "support shift",

    "support work":
      "support shift",

    "support worker":
      "support shift",

    "community participation":
      "social & community participation",

    "social and community participation":
      "social & community participation",

    "social community participation":
      "social & community participation",

    "community access support":
      "community access",

    "personal care support":
      "personal care",

    "medication":
      "medication support",

    "therapy":
      "therapy support",

    "transport support":
      "transport",

    "domestic support":
      "domestic assistance",

    "case conferencing":
      "case conference",

    "clinical":
      "clinical support",

    "telehealth":
      "telehealth/remote support",

    "remote support":
      "telehealth/remote support",
  };

  return aliases[text] || text;
}


/* =========================================================
   PROFILE HELPERS
========================================================= */

function getProfileCompletion(profile) {
  if (!profile) {
    return {
      percentage: 0,
      completed: false,
      missing: [
        "Professional profile",
      ],
    };
  }

  try {
    const result =
      calculateProfessionalProfileCompletion(
        profile
      );

    /*
     * Support slightly different return shapes
     * without tightly coupling the readiness engine
     * to presentation code.
     */

    const percentage =
      Number(
        result?.percentage ??
        result?.percent ??
        result?.completionPercentage ??
        0
      );

    const missing =
      result?.missing ||
      result?.missingFields ||
      result?.missingItems ||
      [];

    return {
      ...result,

      percentage,

      completed:
        Boolean(
          result?.completed ??
          result?.complete ??
          percentage >= 100
        ),

      missing,
    };
  } catch (error) {
    console.error(
      "Unable to calculate professional profile completion:",
      error
    );

    return {
      percentage: 0,
      completed: false,
      missing: [
        "Professional profile completion could not be calculated",
      ],
    };
  }
}


/* =========================================================
   AUTHORISED SERVICE CHECK
========================================================= */

export function isProfessionalAuthorisedForService({
  profile,
  serviceType,
} = {}) {
  /*
   * If no service has been selected yet,
   * we do not treat that as an authorisation failure.
   *
   * This allows the readiness engine to also be used
   * on the onboarding screen before rostering.
   */

  if (!serviceType) {
    return {
      checked: false,
      authorised: null,
      serviceType: null,
      authorisedServices:
        profile?.authorisedServices || [],
    };
  }


  const requestedService =
    normaliseServiceType(
      serviceType
    );


  const authorisedServices =
    (
      profile?.authorisedServices ||
      []
    ).map(
      normaliseServiceType
    );


  const authorised =
    authorisedServices.includes(
      requestedService
    );


  return {
    checked: true,

    authorised,

    serviceType,

    normalisedServiceType:
      requestedService,

    authorisedServices:
      profile?.authorisedServices || [],
  };
}


/* =========================================================
   COMPLIANCE MESSAGE HELPERS
========================================================= */

function getGapDisplayName(gap) {
  return (
    gap?.requirementType ||
    "Compliance requirement"
  );
}


function buildComplianceBlockerMessage(
  gap
) {
  const name =
    getGapDisplayName(gap);


  switch (gap?.status) {
    case "missing":
      return `${name} is missing.`;

    case "expired":
      return `${name} has expired.`;

    case "rejected":
      return `${name} has been rejected.`;

    default:
      return `${name} requires attention.`;
  }
}


function buildComplianceWarningMessage(
  gap
) {
  const name =
    getGapDisplayName(gap);


  if (
    gap?.status ===
    "pending_review"
  ) {
    return `${name} is awaiting compliance review.`;
  }


  if (
    gap?.status ===
    "expiring"
  ) {
    /*
     * Try to surface the actual expiry information
     * if the compliance gap already contains it.
     */

    const document =
      gap?.expiringDocuments?.[0];

    const daysRemaining =
      document?.expiry?.daysRemaining ??
      document?.expiry?.daysUntilExpiry ??
      null;


    if (
      daysRemaining !== null &&
      daysRemaining !== undefined
    ) {
      return `${name} expires in ${daysRemaining} day${
        Number(daysRemaining) === 1
          ? ""
          : "s"
      }.`;
    }


    return `${name} expires soon.`;
  }


  return `${name} requires attention.`;
}


/* =========================================================
   ONBOARDING READINESS
========================================================= */

function buildOnboardingReadiness(
  profile
) {
  const completion =
    getProfileCompletion(
      profile
    );


  const profileExists =
    Boolean(profile);


  const profileComplete =
    profileExists &&
    completion.completed;


  const onboardingStatus =
    profile?.onboardingStatus ||
    "incomplete";


  const providerApproved =
    Boolean(
      profile?.providerApproved
    );


  const onboardingApproved =
    onboardingStatus ===
      "approved" &&
    providerApproved;


  return {
    profileExists,

    profileComplete,

    completionPercentage:
      completion.percentage,

    missingProfileItems:
      completion.missing || [],

    onboardingStatus,

    providerApproved,

    onboardingApproved,
  };
}


/* =========================================================
   BUILD ONBOARDING BLOCKERS
========================================================= */

function buildOnboardingBlockers({
  onboarding,
} = {}) {
  const blockers = [];


  if (
    !onboarding?.profileExists
  ) {
    blockers.push(
      "Professional onboarding profile has not been created."
    );

    return blockers;
  }


  if (
    !onboarding?.profileComplete
  ) {
    blockers.push(
      "Professional onboarding profile is incomplete."
    );
  }


  if (
    onboarding?.onboardingStatus ===
    "in_review"
  ) {
    blockers.push(
      "Professional onboarding is awaiting provider review."
    );
  }


  if (
    onboarding?.onboardingStatus ===
    "rejected"
  ) {
    blockers.push(
      "Professional onboarding requires correction before service delivery."
    );
  }


  if (
    !onboarding?.providerApproved
  ) {
    blockers.push(
      "Professional has not been approved by the provider."
    );
  }


  return blockers;
}


/* =========================================================
   DETERMINE FINAL STATUS
========================================================= */

function determineFinalStatus({
  blockers = [],
  warnings = [],
} = {}) {
  if (
    blockers.length > 0
  ) {
    return (
      SERVICE_READINESS_STATUS.BLOCKED
    );
  }


  if (
    warnings.length > 0
  ) {
    return (
      SERVICE_READINESS_STATUS.WARNING
    );
  }


  return (
    SERVICE_READINESS_STATUS.READY
  );
}


/* =========================================================
   STATUS LABEL
========================================================= */

export function getServiceReadinessStatusLabel(
  status
) {
  switch (status) {
    case SERVICE_READINESS_STATUS.READY:
      return "Service Ready";

    case SERVICE_READINESS_STATUS.WARNING:
      return "Service Ready — Attention Required";

    case SERVICE_READINESS_STATUS.BLOCKED:
      return "Not Service Ready";

    default:
      return "Readiness Unknown";
  }
}


/* =========================================================
   STATUS ICON
========================================================= */

export function getServiceReadinessStatusIcon(
  status
) {
  switch (status) {
    case SERVICE_READINESS_STATUS.READY:
      return "🟢";

    case SERVICE_READINESS_STATUS.WARNING:
      return "🟡";

    case SERVICE_READINESS_STATUS.BLOCKED:
      return "🔴";

    default:
      return "⚪";
  }
}


/* =========================================================
   MAIN SERVICE READINESS ENGINE
========================================================= */

/*
 * This is the main function used by:
 *
 * - Professional Onboarding
 * - Provider Review
 * - Roster
 * - future Service Delivery
 *
 *
 * Final readiness combines:
 *
 * 1. Professional profile
 * 2. Provider approval
 * 3. Service authorisation
 * 4. Compliance requirements
 *
 *
 * IMPORTANT:
 *
 * This function does NOT recreate compliance rules.
 *
 * Missing / expired / rejected compliance decisions
 * come directly from complianceGapService.js.
 */

export async function evaluateServiceReadiness({
  organisationId,
  staffUserId,
  serviceType = null,
} = {}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required to evaluate service readiness."
    );
  }


  if (!staffUserId) {
    throw new Error(
      "Staff user ID is required to evaluate service readiness."
    );
  }


  /*
   * Load onboarding profile and compliance
   * information in parallel.
   */

  const [
    profile,
    complianceResult,
  ] =
    await Promise.all([
      getMyProfessionalProfile({
        organisationId,
        userId:
          staffUserId,
      }),

      buildStaffComplianceGaps({
        organisationId,
        staffUserId,
      }),
    ]);


  /* =======================================================
     ONBOARDING
  ======================================================= */

  const onboarding =
    buildOnboardingReadiness(
      profile
    );


  const onboardingBlockers =
    buildOnboardingBlockers({
      onboarding,
    });


  /* =======================================================
     SERVICE AUTHORISATION
  ======================================================= */

  const service =
    isProfessionalAuthorisedForService({
      profile,
      serviceType,
    });


  const serviceBlockers = [];


  if (
    service.checked &&
    !service.authorised
  ) {
    serviceBlockers.push(
      `${serviceType} is not currently listed as an authorised service for this professional.`
    );
  }


  /* =======================================================
     COMPLIANCE
  ======================================================= */

  const complianceGaps =
    complianceResult?.gaps ||
    [];


  const complianceReadiness =
    getComplianceReadiness(
      complianceGaps
    );


  const complianceBlockers =
    (
      complianceReadiness.blocking ||
      []
    ).map(
      buildComplianceBlockerMessage
    );


  const complianceWarnings =
    (
      complianceReadiness.warnings ||
      []
    ).map(
      buildComplianceWarningMessage
    );


  /* =======================================================
     COMBINE BLOCKERS
  ======================================================= */

  const blockers =
    uniqueStrings([
      ...onboardingBlockers,
      ...serviceBlockers,
      ...complianceBlockers,
    ]);


  /* =======================================================
     COMBINE WARNINGS
  ======================================================= */

  const warnings =
    uniqueStrings([
      ...complianceWarnings,
    ]);


  /* =======================================================
     FINAL STATUS
  ======================================================= */

  const status =
    determineFinalStatus({
      blockers,
      warnings,
    });


  const ready =
    blockers.length === 0;


  return {
    organisationId,

    staffUserId,

    serviceType,

    ready,

    status,

    statusLabel:
      getServiceReadinessStatusLabel(
        status
      ),

    statusIcon:
      getServiceReadinessStatusIcon(
        status
      ),


    /* -----------------------------------------------------
       ONBOARDING RESULT
    ----------------------------------------------------- */

    onboarding: {
      ...onboarding,

      ready:
        onboardingBlockers.length ===
        0,

      blockers:
        onboardingBlockers,
    },


    /* -----------------------------------------------------
       SERVICE AUTHORISATION RESULT
    ----------------------------------------------------- */

    service: {
      ...service,

      ready:
        service.checked
          ? service.authorised
          : null,

      blockers:
        serviceBlockers,
    },


    /* -----------------------------------------------------
       COMPLIANCE RESULT
    ----------------------------------------------------- */

    compliance: {
      ready:
        complianceReadiness.ready,

      requirementCount:
        complianceGaps.length,

      blockingCount:
        complianceReadiness
          .blockingCount,

      warningCount:
        complianceReadiness
          .warningCount,

      blockers:
        complianceReadiness
          .blocking,

      warnings:
        complianceReadiness
          .warnings,

      gaps:
        complianceGaps,

      summary:
        complianceResult?.summary ||
        null,
    },


    /* -----------------------------------------------------
       FINAL DECISION
    ----------------------------------------------------- */

    blockerCount:
      blockers.length,

    warningCount:
      warnings.length,

    blockers,

    warnings,

    evaluatedAt:
      new Date().toISOString(),

    profile,
  };
}


/* =========================================================
   ONBOARDING-LEVEL READINESS
========================================================= */

/*
 * This helper is useful on the Onboarding screen.
 *
 * No particular service type needs to be selected.
 *
 * It answers:
 *
 * "Is this professional generally ready for service?"
 */

export async function evaluateProfessionalReadiness({
  organisationId,
  staffUserId,
} = {}) {
  return evaluateServiceReadiness({
    organisationId,
    staffUserId,
    serviceType: null,
  });
}


/* =========================================================
   ROSTER-LEVEL READINESS
========================================================= */

/*
 * This helper is intended for RosterBoard.
 *
 * A service type MUST be supplied because roster readiness
 * must verify that the professional is authorised for the
 * particular service being scheduled.
 */

export async function evaluateRosterReadiness({
  organisationId,
  staffUserId,
  serviceType,
} = {}) {
  if (!serviceType) {
    throw new Error(
      "Service type is required to evaluate roster readiness."
    );
  }


  return evaluateServiceReadiness({
    organisationId,
    staffUserId,
    serviceType,
  });
}