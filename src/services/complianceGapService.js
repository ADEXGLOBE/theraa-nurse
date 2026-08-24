// src/services/complianceGapService.js

import {
  listStaffCompliance,
} from "./complianceService";

import {
  getComplianceExpiryState,
  listComplianceDocuments,
} from "./complianceDocumentService";


/* =========================================================
   NORMALISATION
========================================================= */

function clean(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}


function normaliseRequirementType(
  value
) {
  const text =
    clean(value);

  /*
   * Map common wording variants
   * to one canonical comparison key.
   */
  const aliases = {
    "first aid certificate":
      "first aid",

    "provide first aid":
      "first aid",

    "cpr certificate":
      "cpr",

    "ndis worker screening check":
      "ndis worker screening",

    "worker screening":
      "ndis worker screening",

    "national police check":
      "police check",

    "police clearance":
      "police check",

    "working with children":
      "working with children check",

    "wwcc":
      "working with children check",

    "manual handling training":
      "manual handling",

    "infection control training":
      "infection control",

    "professional registration certificate":
      "professional registration",
  };


  return (
    aliases[text] ||
    text
  );
}


/* =========================================================
   MATCH DOCUMENT TO REQUIREMENT
========================================================= */

function documentMatchesRequirement({
  requirement,
  document,
}) {
  if (
    !requirement ||
    !document
  ) {
    return false;
  }


  /*
   * The document must belong to the same worker.
   */
  if (
    requirement.staffUserId !==
    document.userId
  ) {
    return false;
  }


  const requirementKey =
    normaliseRequirementType(
      requirement.requirementType
    );


  const documentTypeKey =
    normaliseRequirementType(
      document.documentType
    );


  /*
   * Primary match:
   * requirement type vs uploaded document type.
   */
  if (
    requirementKey &&
    documentTypeKey &&
    requirementKey ===
      documentTypeKey
  ) {
    return true;
  }


  /*
   * Secondary match:
   * Sometimes the certificate name carries
   * the useful wording.
   */
  const documentNameKey =
    normaliseRequirementType(
      document.documentName
    );


  if (
    requirementKey &&
    documentNameKey &&
    (
      documentNameKey.includes(
        requirementKey
      ) ||
      requirementKey.includes(
        documentNameKey
      )
    )
  ) {
    return true;
  }


  return false;
}


/* =========================================================
   DOCUMENT QUALITY
========================================================= */

function analyseMatchingDocuments(
  documents
) {
  const result = {
    matchingDocuments:
      documents || [],

    verifiedCurrent:
      [],

    verifiedExpiring:
      [],

    verifiedExpired:
      [],

    pending:
      [],

    rejected:
      [],
  };


  for (
    const document of
    documents || []
  ) {
    const verification =
      document.verificationStatus ||
      "pending";


    if (
      verification ===
      "pending"
    ) {
      result.pending.push(
        document
      );

      continue;
    }


    if (
      verification ===
      "rejected"
    ) {
      result.rejected.push(
        document
      );

      continue;
    }


    if (
      verification !==
      "verified"
    ) {
      continue;
    }


    const expiry =
      getComplianceExpiryState(
        document.expiryDate
      );


    if (
      expiry.state ===
      "expired"
    ) {
      result.verifiedExpired.push(
        {
          ...document,
          expiry,
        }
      );

      continue;
    }


    if (
      expiry.state ===
      "expiring"
    ) {
      result.verifiedExpiring.push(
        {
          ...document,
          expiry,
        }
      );

      continue;
    }


    /*
     * Current includes:
     * - valid future expiry
     * - no expiry
     */
    result.verifiedCurrent.push(
      {
        ...document,
        expiry,
      }
    );
  }


  return result;
}


/* =========================================================
   DETERMINE GAP STATE
========================================================= */

function determineGapState(
  analysis
) {
  if (
    analysis.verifiedCurrent.length >
    0
  ) {
    return {
      status:
        "compliant",

      severity:
        "none",

      label:
        "Current verified document available",
    };
  }


  if (
    analysis.verifiedExpiring.length >
    0
  ) {
    return {
      status:
        "expiring",

      severity:
        "medium",

      label:
        "Verified document is expiring soon",
    };
  }


  if (
    analysis.pending.length >
    0
  ) {
    return {
      status:
        "pending_review",

      severity:
        "medium",

      label:
        "Document uploaded and awaiting review",
    };
  }


  if (
    analysis.rejected.length >
    0
  ) {
    return {
      status:
        "rejected",

      severity:
        "high",

      label:
        "Uploaded document was rejected",
    };
  }


  if (
    analysis.verifiedExpired.length >
    0
  ) {
    return {
      status:
        "expired",

      severity:
        "high",

      label:
        "Verified document has expired",
    };
  }


  return {
    status:
      "missing",

    severity:
      "high",

    label:
      "No matching verified document found",
  };
}


/* =========================================================
   BUILD ONE GAP RESULT
========================================================= */

export function buildComplianceGap({
  requirement,
  documents,
}) {
  if (!requirement) {
    return null;
  }


  const matchingDocuments =
    (documents || []).filter(
      (document) =>
        documentMatchesRequirement({
          requirement,
          document,
        })
    );


  const analysis =
    analyseMatchingDocuments(
      matchingDocuments
    );


  const state =
    determineGapState(
      analysis
    );


  return {
    id:
      requirement.id,

    requirementId:
      requirement.id,

    staffUserId:
      requirement.staffUserId,

    requirementType:
      requirement.requirementType,

    requirementStatus:
      requirement.status,

    requirementVerified:
      Boolean(
        requirement.verified
      ),

    status:
      state.status,

    severity:
      state.severity,

    label:
      state.label,

    matchingDocumentCount:
      matchingDocuments.length,

    currentDocuments:
      analysis.verifiedCurrent,

    expiringDocuments:
      analysis.verifiedExpiring,

    expiredDocuments:
      analysis.verifiedExpired,

    pendingDocuments:
      analysis.pending,

    rejectedDocuments:
      analysis.rejected,

    hasCurrentVerifiedDocument:
      analysis.verifiedCurrent.length >
      0,

    hasExpiringVerifiedDocument:
      analysis.verifiedExpiring.length >
      0,

    hasExpiredVerifiedDocument:
      analysis.verifiedExpired.length >
      0,

    hasPendingDocument:
      analysis.pending.length >
      0,

    hasRejectedDocument:
      analysis.rejected.length >
      0,
  };
}


/* =========================================================
   SCAN ORGANISATION
========================================================= */

export async function buildOrganisationComplianceGaps({
  organisationId,
} = {}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }


  const [
    requirements,
    documents,
  ] =
    await Promise.all([
      listStaffCompliance({
        organisationId,
      }),

      listComplianceDocuments({
        organisationId,
      }),
    ]);


  const gaps =
    (requirements || [])
      .map(
        (requirement) =>
          buildComplianceGap({
            requirement,
            documents,
          })
      )
      .filter(Boolean);


  const summary = {
    requirements:
      gaps.length,

    compliant:
      gaps.filter(
        (gap) =>
          gap.status ===
          "compliant"
      ).length,

    expiring:
      gaps.filter(
        (gap) =>
          gap.status ===
          "expiring"
      ).length,

    pendingReview:
      gaps.filter(
        (gap) =>
          gap.status ===
          "pending_review"
      ).length,

    rejected:
      gaps.filter(
        (gap) =>
          gap.status ===
          "rejected"
      ).length,

    expired:
      gaps.filter(
        (gap) =>
          gap.status ===
          "expired"
      ).length,

    missing:
      gaps.filter(
        (gap) =>
          gap.status ===
          "missing"
      ).length,

    attentionRequired:
      gaps.filter(
        (gap) =>
          [
            "missing",
            "expired",
            "rejected",
            "expiring",
            "pending_review",
          ].includes(
            gap.status
          )
      ).length,
  };


  return {
    organisationId,

    summary,

    gaps,
  };
}


/* =========================================================
   SCAN ONE PROFESSIONAL
========================================================= */

export async function buildStaffComplianceGaps({
  organisationId,
  staffUserId,
} = {}) {
  if (!organisationId) {
    throw new Error(
      "Organisation ID is required."
    );
  }


  if (!staffUserId) {
    throw new Error(
      "Staff user ID is required."
    );
  }


  const result =
    await buildOrganisationComplianceGaps({
      organisationId,
    });


  const gaps =
    result.gaps.filter(
      (gap) =>
        gap.staffUserId ===
        staffUserId
    );


  return {
    organisationId,

    staffUserId,

    summary: {
      requirements:
        gaps.length,

      compliant:
        gaps.filter(
          (gap) =>
            gap.status ===
            "compliant"
        ).length,

      expiring:
        gaps.filter(
          (gap) =>
            gap.status ===
            "expiring"
        ).length,

      pendingReview:
        gaps.filter(
          (gap) =>
            gap.status ===
            "pending_review"
        ).length,

      rejected:
        gaps.filter(
          (gap) =>
            gap.status ===
            "rejected"
        ).length,

      expired:
        gaps.filter(
          (gap) =>
            gap.status ===
            "expired"
        ).length,

      missing:
        gaps.filter(
          (gap) =>
            gap.status ===
            "missing"
        ).length,
    },

    gaps,
  };
}


/* =========================================================
   ROSTER-READINESS HELPER
========================================================= */

export function getComplianceReadiness(
  gaps = []
) {
  const blocking =
    gaps.filter(
      (gap) =>
        [
          "missing",
          "expired",
          "rejected",
        ].includes(
          gap.status
        )
    );


  const warnings =
    gaps.filter(
      (gap) =>
        [
          "expiring",
          "pending_review",
        ].includes(
          gap.status
        )
    );


  return {
    ready:
      blocking.length === 0,

    blockingCount:
      blocking.length,

    warningCount:
      warnings.length,

    blocking,

    warnings,
  };
}