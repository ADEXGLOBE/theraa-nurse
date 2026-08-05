// src/services/onboardingService.js
import { supabase } from "./supabaseClient";

function clean(value) {
  return String(value ?? "").trim();
}

function validatePassword(
  password,
  confirmPassword
) {
  if (!password || password.length < 8) {
    throw new Error(
      "Password must contain at least 8 characters."
    );
  }

  if (password !== confirmPassword) {
    throw new Error(
      "Password and confirmation do not match."
    );
  }
}

export async function createProviderOrganisationAccount({
  organisationName,
  abn,
  providerType,
  ndisRegistrationStatus,
  organisationPhone,
  organisationAddress,
  managerName,
  managerPosition,
  email,
  password,
  confirmPassword,
}) {
  if (!clean(organisationName)) {
    throw new Error(
      "Organisation name is required."
    );
  }

  if (!clean(managerName)) {
    throw new Error(
      "Manager name is required."
    );
  }

  if (!clean(email)) {
    throw new Error(
      "Email is required."
    );
  }

  validatePassword(
    password,
    confirmPassword
  );

  const { data, error } =
    await supabase.auth.signUp({
      email: clean(email).toLowerCase(),
      password,

      options: {
        emailRedirectTo:
          window.location.origin,

        data: {
          signup_mode: "provider",
          workspace_name:
            clean(organisationName),
          full_name: clean(managerName),
          position_title:
            clean(managerPosition) ||
            "Provider Admin",
          professional_role:
            "provider_admin",
          abn: clean(abn),
          provider_type:
            clean(providerType),
          ndis_registration_status:
            clean(
              ndisRegistrationStatus
            ),
          phone: clean(
            organisationPhone
          ),
          address: clean(
            organisationAddress
          ),
        },
      },
    });

  if (error) throw error;

  return data;
}

export async function createIndependentAccount({
  fullName,
  professionalRole,
  businessName,
  abn,
  phone,
  email,
  password,
  confirmPassword,
}) {
  if (!clean(fullName)) {
    throw new Error(
      "Full name is required."
    );
  }

  if (!clean(professionalRole)) {
    throw new Error(
      "Professional role is required."
    );
  }

  validatePassword(
    password,
    confirmPassword
  );

  const workspaceName =
    clean(businessName) ||
    `${clean(
      fullName
    )} Professional Workspace`;

  const { data, error } =
    await supabase.auth.signUp({
      email: clean(email).toLowerCase(),
      password,

      options: {
        emailRedirectTo:
          window.location.origin,

        data: {
          signup_mode: "independent",
          workspace_name: workspaceName,
          full_name: clean(fullName),
          position_title:
            clean(professionalRole),
          professional_role:
            clean(professionalRole),
          abn: clean(abn),
          provider_type:
            "Independent Professional",
          ndis_registration_status:
            "Not specified",
          phone: clean(phone),
          address: "",
        },
      },
    });

  if (error) throw error;

  return data;
}

export async function createInvitedMemberAccount({
  invitationToken,
  fullName,
  professionalRole,
  email,
  password,
  confirmPassword,
}) {
  if (!clean(invitationToken)) {
    throw new Error(
      "Invitation code is required."
    );
  }

  if (!clean(fullName)) {
    throw new Error(
      "Your full name is required."
    );
  }

  if (!clean(email)) {
    throw new Error(
      "Your invited email is required."
    );
  }

  validatePassword(
    password,
    confirmPassword
  );

  const { data, error } =
    await supabase.auth.signUp({
      email: clean(email).toLowerCase(),
      password,

      options: {
        emailRedirectTo:
          window.location.origin,

        data: {
          signup_mode: "invited",
          invitation_token:
            clean(invitationToken),
          full_name: clean(fullName),
          professional_role:
            clean(professionalRole),
          position_title:
            clean(professionalRole),
        },
      },
    });

  if (error) throw error;

  return data;
}

export async function loginToTheraaNurse({
  email,
  password,
}) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: clean(email).toLowerCase(),
      password,
    });

  if (error) throw error;

  return data;
}

export async function sendPasswordReset(
  email
) {
  const { data, error } =
    await supabase.auth
      .resetPasswordForEmail(
        clean(email).toLowerCase(),
        {
          redirectTo:
            window.location.origin,
        }
      );

  if (error) throw error;

  return data;
}

export async function updatePassword(
  newPassword
) {
  if (
    !newPassword ||
    newPassword.length < 8
  ) {
    throw new Error(
      "Password must contain at least 8 characters."
    );
  }

  const { data, error } =
    await supabase.auth.updateUser({
      password: newPassword,
    });

  if (error) throw error;

  return data;
}