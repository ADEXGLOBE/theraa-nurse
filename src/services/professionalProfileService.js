import { supabase } from "./supabaseClient";

export const PROFESSIONAL_ROLES = [
  "Support Worker",
  "Nurse",
  "Allied Health",
  "Support Coordinator",
  "Behaviour Support Practitioner",
  "Occupational Therapist",
  "Physiotherapist",
  "Speech Pathologist",
  "Psychologist",
  "Social Worker",
  "Case Manager",
  "Care Coordinator",
  "Other",
];

export const EMPLOYMENT_TYPES = [
  "Employee",
  "Casual",
  "Part-Time",
  "Full-Time",
  "Contractor",
  "Agency Worker",
  "Volunteer",
  "Other",
];

export const AUTHORISED_SERVICES = [
  "Support Shift",
  "Community Access",
  "Personal Care",
  "Medication Support",
  "Therapy Support",
  "Transport",
  "Domestic Assistance",
  "Social & Community Participation",
  "Clinical Support",
  "Telehealth / Remote Support",
  "Case Conference",
  "Other",
];

function normaliseProfile(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organisationId: row.organisation_id,
    userId: row.user_id,

    fullName: row.full_name || "",
    preferredName: row.preferred_name || "",
    phone: row.phone || "",

    professionalRole:
      row.professional_role || "",

    employmentType:
      row.employment_type || "",

    employeeReference:
      row.employee_reference || "",

    qualifications:
      row.qualifications || "",

    registrationNumber:
      row.registration_number || "",

    areasOfPractice:
      Array.isArray(row.areas_of_practice)
        ? row.areas_of_practice
        : [],

    authorisedServices:
      Array.isArray(row.authorised_services)
        ? row.authorised_services
        : [],

    experienceSummary:
      row.experience_summary || "",

    onboardingStatus:
      row.onboarding_status ||
      "incomplete",

    profileCompleted:
      Boolean(row.profile_completed),

    providerApproved:
      Boolean(row.provider_approved),

    approvedBy:
      row.approved_by || null,

    approvedAt:
      row.approved_at || null,

    onboardingNotes:
      row.onboarding_notes || "",

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

function toDatabasePayload(profile) {
  return {
    full_name:
      profile.fullName?.trim() || null,

    preferred_name:
      profile.preferredName?.trim() ||
      null,

    phone:
      profile.phone?.trim() || null,

    professional_role:
      profile.professionalRole || null,

    employment_type:
      profile.employmentType || null,

    employee_reference:
      profile.employeeReference?.trim() ||
      null,

    qualifications:
      profile.qualifications?.trim() ||
      null,

    registration_number:
      profile.registrationNumber?.trim() ||
      null,

    areas_of_practice:
      Array.isArray(profile.areasOfPractice)
        ? profile.areasOfPractice
        : [],

    authorised_services:
      Array.isArray(
        profile.authorisedServices
      )
        ? profile.authorisedServices
        : [],

    experience_summary:
      profile.experienceSummary?.trim() ||
      null,
  };
}

export async function getMyProfessionalProfile({
  organisationId,
  userId,
}) {
  if (!organisationId || !userId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from("professional_profiles")
    .select("*")
    .eq(
      "organisation_id",
      organisationId
    )
    .eq(
      "user_id",
      userId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normaliseProfile(data);
}

export async function saveMyProfessionalProfile({
  organisationId,
  userId,
  profile,
}) {
  if (!organisationId) {
    throw new Error(
      "Organisation is required."
    );
  }

  if (!userId) {
    throw new Error(
      "User is required."
    );
  }

  const payload = {
    organisation_id:
      organisationId,

    user_id:
      userId,

    ...toDatabasePayload(profile),
  };

  const {
    data,
    error,
  } = await supabase
    .from("professional_profiles")
    .upsert(
      payload,
      {
        onConflict:
          "organisation_id,user_id",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normaliseProfile(data);
}

export async function submitProfessionalProfileForReview({
  organisationId,
  userId,
}) {
  const {
    data,
    error,
  } = await supabase
    .from("professional_profiles")
    .update({
      onboarding_status:
        "in_review",
    })
    .eq(
      "organisation_id",
      organisationId
    )
    .eq(
      "user_id",
      userId
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normaliseProfile(data);
}

export async function listProfessionalProfiles(
  organisationId
) {
  if (!organisationId) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from("professional_profiles")
    .select("*")
    .eq(
      "organisation_id",
      organisationId
    )
    .order(
      "full_name",
      {
        ascending: true,
      }
    );

  if (error) {
    throw error;
  }

  return (
    Array.isArray(data)
      ? data
      : []
  ).map(normaliseProfile);
}

export async function approveProfessionalProfile({
  organisationId,
  profileId,
  approvedBy,
  notes = "",
}) {
  const {
    data,
    error,
  } = await supabase
    .from("professional_profiles")
    .update({
      onboarding_status:
        "approved",

      provider_approved:
        true,

      approved_by:
        approvedBy || null,

      approved_at:
        new Date().toISOString(),

      onboarding_notes:
        notes?.trim() || null,
    })
    .eq(
      "organisation_id",
      organisationId
    )
    .eq(
      "id",
      profileId
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normaliseProfile(data);
}

export async function rejectProfessionalProfile({
  organisationId,
  profileId,
  notes = "",
}) {
  const {
    data,
    error,
  } = await supabase
    .from("professional_profiles")
    .update({
      onboarding_status:
        "rejected",

      provider_approved:
        false,

      approved_by:
        null,

      approved_at:
        null,

      onboarding_notes:
        notes?.trim() || null,
    })
    .eq(
      "organisation_id",
      organisationId
    )
    .eq(
      "id",
      profileId
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normaliseProfile(data);
}

export function calculateProfessionalProfileCompletion(
  profile
) {
  if (!profile) {
    return {
      percentage: 0,
      complete: false,
      completedFields: 0,
      totalFields: 0,
      missingFields: [],
    };
  }

  const checks = [
    {
      label: "Full name",
      complete:
        Boolean(
          profile.fullName?.trim()
        ),
    },
    {
      label:
        "Professional role",
      complete:
        Boolean(
          profile.professionalRole
        ),
    },
    {
      label:
        "Employment type",
      complete:
        Boolean(
          profile.employmentType
        ),
    },
    {
      label:
        "Phone number",
      complete:
        Boolean(
          profile.phone?.trim()
        ),
    },
    {
      label:
        "Qualifications",
      complete:
        Boolean(
          profile.qualifications?.trim()
        ),
    },
    {
      label:
        "Authorised services",
      complete:
        Array.isArray(
          profile.authorisedServices
        ) &&
        profile.authorisedServices
          .length > 0,
    },
    {
      label:
        "Experience summary",
      complete:
        Boolean(
          profile.experienceSummary?.trim()
        ),
    },
  ];

  const completedFields =
    checks.filter(
      (item) =>
        item.complete
    ).length;

  const totalFields =
    checks.length;

  const percentage =
    totalFields === 0
      ? 0
      : Math.round(
          (
            completedFields /
            totalFields
          ) *
            100
        );

  const missingFields =
    checks
      .filter(
        (item) =>
          !item.complete
      )
      .map(
        (item) =>
          item.label
      );

  return {
    percentage,
    complete:
      completedFields ===
      totalFields,
    completedFields,
    totalFields,
    missingFields,
  };
}

export function getOnboardingStatusLabel(
  status
) {
  switch (status) {
    case "in_review":
      return "In Review";

    case "approved":
      return "Approved";

    case "rejected":
      return "Rejected";

    default:
      return "Incomplete";
  }
}