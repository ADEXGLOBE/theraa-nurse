// src/components/InvitationSignup.jsx
import {
  useEffect,
  useState,
} from "react";

import {
  createInvitedMemberAccount,
} from "../services/onboardingService";

import {
  getTeamRoleLabel,
  lookupInvitation,
} from "../services/teamService";

export default function InvitationSignup({
  initialToken = "",
  onBack,
}) {
  const [token, setToken] =
    useState(initialToken);

  const [invitation, setInvitation] =
    useState(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [checking, setChecking] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function checkInvitation(
    invitationToken = token
  ) {
    setChecking(true);
    setErrorMsg("");
    setMessage("");

    try {
      const result =
        await lookupInvitation(
          invitationToken
        );

      setInvitation(result);

      setForm((previous) => ({
        ...previous,
        fullName:
          result.invited_name ||
          previous.fullName,
        email:
          result.invitation_email ||
          previous.email,
      }));
    } catch (error) {
      setInvitation(null);

      setErrorMsg(
        error?.message ||
          "Invitation could not be checked."
      );
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (initialToken) {
      void checkInvitation(
        initialToken
      );
    }
  }, [initialToken]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!invitation) {
      setErrorMsg(
        "Validate the invitation before creating your account."
      );
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setMessage("");

    try {
      const data =
        await createInvitedMemberAccount({
          invitationToken: token,
          fullName: form.fullName,
          professionalRole:
            invitation.invited_role,
          email: form.email,
          password: form.password,
          confirmPassword:
            form.confirmPassword,
        });

      if (data?.session) {
        setMessage(
          "Your team account has been created. Loading your organisation…"
        );
      } else {
        setMessage(
          "Your account has been created. Check your email and confirm your account before signing in."
        );
      }
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Your invited account could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="auth-v3-form-card auth-login-card"
      onSubmit={handleSubmit}
    >
      <div className="auth-form-topline">
        <button
          type="button"
          onClick={onBack}
        >
          ← Back
        </button>

        <span>
          Join organisation
        </span>
      </div>

      <div className="auth-form-title">
        <h2>
          Accept Team Invitation
        </h2>

        <p>
          Validate your invitation and
          create your own secure Theraa
          Nurse password.
        </p>
      </div>

      <label>
        <span>Invitation code</span>

        <input
          value={token}
          onChange={(event) =>
            setToken(
              event.target.value
            )
          }
          placeholder="Paste invitation code"
        />
      </label>

      <button
        type="button"
        disabled={
          checking || !token.trim()
        }
        onClick={() =>
          void checkInvitation()
        }
      >
        {checking
          ? "Checking…"
          : "Check Invitation"}
      </button>

      {invitation ? (
        <div className="auth-review-box">
          <strong>
            Invitation confirmed
          </strong>

          <span>
            {
              invitation.organisation_name
            }
          </span>

          <small>
            Role:{" "}
            {getTeamRoleLabel(
              invitation.invited_role
            )}
          </small>

          <small>
            Email:{" "}
            {
              invitation.invitation_email
            }
          </small>
        </div>
      ) : null}

      {invitation ? (
        <>
          <label>
            <span>Full name</span>

            <input
              value={form.fullName}
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    fullName:
                      event.target.value,
                  })
                )
              }
            />
          </label>

          <label>
            <span>Invited email</span>

            <input
              type="email"
              value={form.email}
              readOnly
            />
          </label>

          <label>
            <span>Password</span>

            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    password:
                      event.target.value,
                  })
                )
              }
              placeholder="At least 8 characters"
            />
          </label>

          <label>
            <span>
              Confirm password
            </span>

            <input
              type="password"
              value={
                form.confirmPassword
              }
              onChange={(event) =>
                setForm(
                  (previous) => ({
                    ...previous,
                    confirmPassword:
                      event.target.value,
                  })
                )
              }
            />
          </label>

          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Creating account…"
              : "Join Organisation"}
          </button>
        </>
      ) : null}

      {errorMsg ? (
        <div className="auth-error">
          {errorMsg}
        </div>
      ) : null}

      {message ? (
        <div className="auth-success">
          {message}
        </div>
      ) : null}
    </form>
  );
}