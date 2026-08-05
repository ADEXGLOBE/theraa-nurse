// src/pages/AuthPage.jsx
import { useEffect, useState } from "react";

import {
  createIndependentAccount,
  createProviderOrganisationAccount,
  loginToTheraaNurse,
  sendPasswordReset,
  updatePassword,
} from "../services/onboardingService";

const PROVIDER_TYPES = [
  "NDIS Provider",
  "Aged Care Provider",
  "Disability Support Organisation",
  "Support Coordination Provider",
  "Allied Health Practice",
  "Community Care Organisation",
  "Other",
];

const PROFESSIONAL_ROLES = [
  "Independent Support Coordinator",
  "Recovery Coach",
  "Support Worker",
  "Behaviour Support Practitioner",
  "Occupational Therapist",
  "Physiotherapist",
  "Speech Pathologist",
  "Psychologist",
  "Nurse",
  "Social Worker",
  "Allied Health Professional",
  "Other",
];

const initialProviderForm = {
  organisationName: "",
  abn: "",
  providerType: "NDIS Provider",
  ndisRegistrationStatus: "Registered",
  organisationPhone: "",
  organisationAddress: "",
  managerName: "",
  managerPosition: "Provider Admin",
  email: "",
  password: "",
  confirmPassword: "",
};

const initialIndependentForm = {
  fullName: "",
  professionalRole:
    "Independent Support Coordinator",
  businessName: "",
  abn: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function ChoiceCard({
  icon,
  title,
  description,
  buttonText,
  onClick,
  disabled = false,
}) {
  return (
    <article
      className={
        disabled
          ? "auth-choice-card disabled"
          : "auth-choice-card"
      }
    >
      <div className="auth-choice-icon">
        {icon}
      </div>

      <h3>{title}</h3>
      <p>{description}</p>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
      >
        {buttonText}
      </button>
    </article>
  );
}

function FormMessage({ error, message }) {
  return (
    <>
      {error ? (
        <div className="auth-error">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="auth-success">
          {message}
        </div>
      ) : null}
    </>
  );
}

export default function AuthPage() {
  const [screen, setScreen] =
    useState("welcome");

  const [providerStep, setProviderStep] =
    useState(1);

  const [independentStep, setIndependentStep] =
    useState(1);

  const [providerForm, setProviderForm] =
    useState(initialProviderForm);

  const [
    independentForm,
    setIndependentForm,
  ] = useState(initialIndependentForm);

  const [loginForm, setLoginForm] =
    useState({
      email: "",
      password: "",
    });

  const [recoveryEmail, setRecoveryEmail] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [isRecovery, setIsRecovery] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMsg, setErrorMsg] =
    useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;

    if (
      hash.includes("type=recovery") ||
      search.includes("type=recovery")
    ) {
      setIsRecovery(true);
      setScreen("reset");
    }
  }, []);

  function clearMessages() {
    setMessage("");
    setErrorMsg("");
  }

  function openScreen(nextScreen) {
    clearMessages();
    setScreen(nextScreen);
  }

  function updateProviderField(key, value) {
    setProviderForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function updateIndependentField(
    key,
    value
  ) {
    setIndependentForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function validateProviderStepOne() {
    if (
      !providerForm.organisationName.trim()
    ) {
      throw new Error(
        "Enter the organisation name."
      );
    }

    if (!providerForm.providerType) {
      throw new Error(
        "Select a provider type."
      );
    }
  }

  function validateProviderStepTwo() {
    if (!providerForm.managerName.trim()) {
      throw new Error(
        "Enter the account owner or manager name."
      );
    }

    if (!providerForm.email.trim()) {
      throw new Error(
        "Enter the manager's email."
      );
    }
  }

  function nextProviderStep() {
    clearMessages();

    try {
      if (providerStep === 1) {
        validateProviderStepOne();
      }

      if (providerStep === 2) {
        validateProviderStepTwo();
      }

      setProviderStep((step) =>
        Math.min(3, step + 1)
      );
    } catch (error) {
      setErrorMsg(error.message);
    }
  }

  function nextIndependentStep() {
    clearMessages();

    try {
      if (
        independentStep === 1 &&
        !independentForm.fullName.trim()
      ) {
        throw new Error(
          "Enter your full name."
        );
      }

      if (
        independentStep === 1 &&
        !independentForm.professionalRole
      ) {
        throw new Error(
          "Select your professional role."
        );
      }

      if (
        independentStep === 2 &&
        !independentForm.email.trim()
      ) {
        throw new Error(
          "Enter your email."
        );
      }

      setIndependentStep((step) =>
        Math.min(3, step + 1)
      );
    } catch (error) {
      setErrorMsg(error.message);
    }
  }

  async function handleProviderSignup(
    event
  ) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const data =
        await createProviderOrganisationAccount(
          providerForm
        );

      if (data?.session) {
        setMessage(
          "Organisation created successfully. Opening your provider workspace…"
        );
      } else {
        setMessage(
          "Your provider organisation has been created. Check your email and confirm your account before signing in."
        );
      }

      setProviderForm(
        initialProviderForm
      );
      setProviderStep(1);
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "The organisation could not be created."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleIndependentSignup(
    event
  ) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const data =
        await createIndependentAccount(
          independentForm
        );

      if (data?.session) {
        setMessage(
          "Your independent workspace has been created successfully."
        );
      } else {
        setMessage(
          "Your independent workspace has been created. Check your email and confirm your account before signing in."
        );
      }

      setIndependentForm(
        initialIndependentForm
      );
      setIndependentStep(1);
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Your workspace could not be created."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      await loginToTheraaNurse(
        loginForm
      );

      setMessage(
        "Login successful. Loading your workspace…"
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Login was unsuccessful."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    clearMessages();
    setLoading(true);

    try {
      await sendPasswordReset(
        recoveryEmail ||
          loginForm.email
      );

      setMessage(
        "Password reset email sent. Check your inbox."
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "The reset email could not be sent."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(
    event
  ) {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      await updatePassword(newPassword);

      setMessage(
        "Password updated successfully. You may now sign in."
      );

      setNewPassword("");
      setIsRecovery(false);
      setScreen("login");

      window.history.replaceState(
        {},
        document.title,
        window.location.origin
      );
    } catch (error) {
      setErrorMsg(
        error?.message ||
          "Password could not be updated."
      );
    } finally {
      setLoading(false);
    }
  }

  function renderWelcome() {
    return (
      <>
        <div className="auth-v3-heading">
          <div className="auth-logo">TN</div>

          <div>
            <div className="eyebrow">
              Theraa Nurse V3
            </div>

            <h1>
              How would you like to use
              Theraa Nurse?
            </h1>

            <p>
              Create a provider workspace,
              establish an independent
              professional workspace, or join an
              organisation that invited you.
            </p>
          </div>
        </div>

        <div className="auth-choice-grid">
          <ChoiceCard
            icon="🏥"
            title="Create Provider Organisation"
            description="For NDIS providers, aged care organisations, allied health practices and disability support businesses."
            buttonText="Create Organisation"
            onClick={() =>
              openScreen("provider")
            }
          />

          <ChoiceCard
            icon="👤"
            title="Independent Professional"
            description="For independent support coordinators, recovery coaches, practitioners, nurses and sole traders."
            buttonText="Create Personal Workspace"
            onClick={() =>
              openScreen("independent")
            }
          />

          <ChoiceCard
            icon="🔗"
            title="Join Existing Organisation"
            description="For workers and professionals who have received an invitation from a manager or Provider Admin."
            buttonText="Invitation Setup Coming Next"
            disabled
          />
        </div>

        <div className="auth-existing-account">
          <span>
            Already have a Theraa Nurse
            account?
          </span>

          <button
            type="button"
            onClick={() =>
              openScreen("login")
            }
          >
            Sign in
          </button>
        </div>
      </>
    );
  }

  function renderProviderSignup() {
    return (
      <form
        className="auth-v3-form-card"
        onSubmit={handleProviderSignup}
      >
        <div className="auth-form-topline">
          <button
            type="button"
            onClick={() =>
              openScreen("welcome")
            }
          >
            ← Back
          </button>

          <span>
            Provider setup · Step{" "}
            {providerStep} of 3
          </span>
        </div>

        <div className="auth-step-track">
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={
                step <= providerStep
                  ? "active"
                  : ""
              }
            />
          ))}
        </div>

        {providerStep === 1 ? (
          <div className="auth-form-grid">
            <div className="auth-form-title">
              <h2>
                Organisation details
              </h2>

              <p>
                Create the secure provider
                workspace that will own your
                participant records.
              </p>
            </div>

            <label className="auth-form-wide">
              <span>Organisation name *</span>

              <input
                value={
                  providerForm.organisationName
                }
                onChange={(event) =>
                  updateProviderField(
                    "organisationName",
                    event.target.value
                  )
                }
                placeholder="e.g. LAXA Disability Services"
              />
            </label>

            <label>
              <span>ABN</span>

              <input
                value={providerForm.abn}
                onChange={(event) =>
                  updateProviderField(
                    "abn",
                    event.target.value
                  )
                }
                placeholder="Australian Business Number"
              />
            </label>

            <label>
              <span>Provider type *</span>

              <select
                value={
                  providerForm.providerType
                }
                onChange={(event) =>
                  updateProviderField(
                    "providerType",
                    event.target.value
                  )
                }
              >
                {PROVIDER_TYPES.map(
                  (item) => (
                    <option key={item}>
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>
                NDIS registration status
              </span>

              <select
                value={
                  providerForm.ndisRegistrationStatus
                }
                onChange={(event) =>
                  updateProviderField(
                    "ndisRegistrationStatus",
                    event.target.value
                  )
                }
              >
                <option>Registered</option>
                <option>Unregistered</option>
                <option>
                  Registration in progress
                </option>
                <option>Not applicable</option>
              </select>
            </label>

            <label>
              <span>Contact number</span>

              <input
                value={
                  providerForm.organisationPhone
                }
                onChange={(event) =>
                  updateProviderField(
                    "organisationPhone",
                    event.target.value
                  )
                }
                placeholder="Organisation phone"
              />
            </label>

            <label className="auth-form-wide">
              <span>
                Organisation address
              </span>

              <input
                value={
                  providerForm.organisationAddress
                }
                onChange={(event) =>
                  updateProviderField(
                    "organisationAddress",
                    event.target.value
                  )
                }
                placeholder="Business address"
              />
            </label>
          </div>
        ) : null}

        {providerStep === 2 ? (
          <div className="auth-form-grid">
            <div className="auth-form-title">
              <h2>
                Provider Admin details
              </h2>

              <p>
                This person becomes the first
                administrator and can later invite
                managers, coordinators and workers.
              </p>
            </div>

            <label>
              <span>Full name *</span>

              <input
                value={
                  providerForm.managerName
                }
                onChange={(event) =>
                  updateProviderField(
                    "managerName",
                    event.target.value
                  )
                }
                placeholder="Account owner or manager"
              />
            </label>

            <label>
              <span>Position</span>

              <input
                value={
                  providerForm.managerPosition
                }
                onChange={(event) =>
                  updateProviderField(
                    "managerPosition",
                    event.target.value
                  )
                }
                placeholder="e.g. Director"
              />
            </label>

            <label className="auth-form-wide">
              <span>Email *</span>

              <input
                type="email"
                value={providerForm.email}
                onChange={(event) =>
                  updateProviderField(
                    "email",
                    event.target.value
                  )
                }
                placeholder="manager@organisation.com.au"
              />
            </label>
          </div>
        ) : null}

        {providerStep === 3 ? (
          <div className="auth-form-grid">
            <div className="auth-form-title">
              <h2>
                Secure your account
              </h2>

              <p>
                Create the Provider Admin
                password. Team members will later
                receive their own invitations and
                create their own passwords.
              </p>
            </div>

            <label>
              <span>Password *</span>

              <input
                type="password"
                value={
                  providerForm.password
                }
                onChange={(event) =>
                  updateProviderField(
                    "password",
                    event.target.value
                  )
                }
                placeholder="At least 8 characters"
              />
            </label>

            <label>
              <span>
                Confirm password *
              </span>

              <input
                type="password"
                value={
                  providerForm.confirmPassword
                }
                onChange={(event) =>
                  updateProviderField(
                    "confirmPassword",
                    event.target.value
                  )
                }
                placeholder="Repeat password"
              />
            </label>

            <div className="auth-review-box auth-form-wide">
              <strong>
                Workspace summary
              </strong>

              <span>
                {
                  providerForm.organisationName
                }
              </span>

              <small>
                {providerForm.managerName} ·{" "}
                {providerForm.managerPosition}
              </small>

              <small>
                First role: Provider Admin
              </small>
            </div>
          </div>
        ) : null}

        <FormMessage
          error={errorMsg}
          message={message}
        />

        <div className="auth-form-actions">
          {providerStep > 1 ? (
            <button
              type="button"
              className="auth-secondary-action"
              onClick={() => {
                clearMessages();
                setProviderStep(
                  (step) => step - 1
                );
              }}
            >
              Previous
            </button>
          ) : null}

          {providerStep < 3 ? (
            <button
              type="button"
              onClick={nextProviderStep}
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating organisation…"
                : "Create Provider Organisation"}
            </button>
          )}
        </div>
      </form>
    );
  }

  function renderIndependentSignup() {
    return (
      <form
        className="auth-v3-form-card"
        onSubmit={
          handleIndependentSignup
        }
      >
        <div className="auth-form-topline">
          <button
            type="button"
            onClick={() =>
              openScreen("welcome")
            }
          >
            ← Back
          </button>

          <span>
            Independent setup · Step{" "}
            {independentStep} of 3
          </span>
        </div>

        <div className="auth-step-track">
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={
                step <= independentStep
                  ? "active"
                  : ""
              }
            />
          ))}
        </div>

        {independentStep === 1 ? (
          <div className="auth-form-grid">
            <div className="auth-form-title">
              <h2>
                Professional details
              </h2>

              <p>
                Create a secure workspace for your
                own participants and professional
                practice.
              </p>
            </div>

            <label>
              <span>Full name *</span>

              <input
                value={
                  independentForm.fullName
                }
                onChange={(event) =>
                  updateIndependentField(
                    "fullName",
                    event.target.value
                  )
                }
                placeholder="Your full name"
              />
            </label>

            <label>
              <span>
                Professional role *
              </span>

              <select
                value={
                  independentForm.professionalRole
                }
                onChange={(event) =>
                  updateIndependentField(
                    "professionalRole",
                    event.target.value
                  )
                }
              >
                {PROFESSIONAL_ROLES.map(
                  (item) => (
                    <option key={item}>
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>
                Business name
              </span>

              <input
                value={
                  independentForm.businessName
                }
                onChange={(event) =>
                  updateIndependentField(
                    "businessName",
                    event.target.value
                  )
                }
                placeholder="Optional trading name"
              />
            </label>

            <label>
              <span>ABN</span>

              <input
                value={independentForm.abn}
                onChange={(event) =>
                  updateIndependentField(
                    "abn",
                    event.target.value
                  )
                }
                placeholder="Optional"
              />
            </label>
          </div>
        ) : null}

        {independentStep === 2 ? (
          <div className="auth-form-grid">
            <div className="auth-form-title">
              <h2>
                Contact details
              </h2>

              <p>
                This email becomes your personal
                Theraa Nurse login.
              </p>
            </div>

            <label>
              <span>Phone</span>

              <input
                value={
                  independentForm.phone
                }
                onChange={(event) =>
                  updateIndependentField(
                    "phone",
                    event.target.value
                  )
                }
                placeholder="Contact number"
              />
            </label>

            <label>
              <span>Email *</span>

              <input
                type="email"
                value={
                  independentForm.email
                }
                onChange={(event) =>
                  updateIndependentField(
                    "email",
                    event.target.value
                  )
                }
                placeholder="Your email"
              />
            </label>
          </div>
        ) : null}

        {independentStep === 3 ? (
          <div className="auth-form-grid">
            <div className="auth-form-title">
              <h2>
                Secure your workspace
              </h2>

              <p>
                Your participant records will be
                stored within your independent
                professional workspace.
              </p>
            </div>

            <label>
              <span>Password *</span>

              <input
                type="password"
                value={
                  independentForm.password
                }
                onChange={(event) =>
                  updateIndependentField(
                    "password",
                    event.target.value
                  )
                }
                placeholder="At least 8 characters"
              />
            </label>

            <label>
              <span>
                Confirm password *
              </span>

              <input
                type="password"
                value={
                  independentForm.confirmPassword
                }
                onChange={(event) =>
                  updateIndependentField(
                    "confirmPassword",
                    event.target.value
                  )
                }
                placeholder="Repeat password"
              />
            </label>

            <div className="auth-review-box auth-form-wide">
              <strong>
                Workspace summary
              </strong>

              <span>
                {independentForm.businessName ||
                  `${independentForm.fullName} Professional Workspace`}
              </span>

              <small>
                {
                  independentForm.professionalRole
                }
              </small>

              <small>
                First role: Workspace Owner
              </small>
            </div>
          </div>
        ) : null}

        <FormMessage
          error={errorMsg}
          message={message}
        />

        <div className="auth-form-actions">
          {independentStep > 1 ? (
            <button
              type="button"
              className="auth-secondary-action"
              onClick={() => {
                clearMessages();
                setIndependentStep(
                  (step) => step - 1
                );
              }}
            >
              Previous
            </button>
          ) : null}

          {independentStep < 3 ? (
            <button
              type="button"
              onClick={nextIndependentStep}
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating workspace…"
                : "Create Independent Workspace"}
            </button>
          )}
        </div>
      </form>
    );
  }

  function renderLogin() {
    return (
      <form
        className="auth-v3-form-card auth-login-card"
        onSubmit={handleLogin}
      >
        <div className="auth-form-topline">
          <button
            type="button"
            onClick={() =>
              openScreen("welcome")
            }
          >
            ← Back
          </button>

          <span>Secure sign in</span>
        </div>

        <div className="auth-form-title">
          <h2>
            Sign in to Theraa Nurse
          </h2>

          <p>
            Access your provider or independent
            professional workspace.
          </p>
        </div>

        <label>
          <span>Email</span>

          <input
            type="email"
            value={loginForm.email}
            onChange={(event) =>
              setLoginForm((previous) => ({
                ...previous,
                email: event.target.value,
              }))
            }
            placeholder="Enter your email"
          />
        </label>

        <label>
          <span>Password</span>

          <input
            type="password"
            value={loginForm.password}
            onChange={(event) =>
              setLoginForm((previous) => ({
                ...previous,
                password:
                  event.target.value,
              }))
            }
            placeholder="Enter your password"
          />
        </label>

        <FormMessage
          error={errorMsg}
          message={message}
        />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Signing in…"
            : "Login to Theraa Nurse"}
        </button>

        <button
          type="button"
          className="auth-text-action"
          onClick={() =>
            openScreen("forgot")
          }
        >
          Forgot password?
        </button>
      </form>
    );
  }

  function renderForgotPassword() {
    return (
      <div className="auth-v3-form-card auth-login-card">
        <div className="auth-form-topline">
          <button
            type="button"
            onClick={() =>
              openScreen("login")
            }
          >
            ← Back
          </button>

          <span>Password recovery</span>
        </div>

        <div className="auth-form-title">
          <h2>Reset your password</h2>

          <p>
            Enter your account email and we will
            send a secure recovery link.
          </p>
        </div>

        <label>
          <span>Email</span>

          <input
            type="email"
            value={recoveryEmail}
            onChange={(event) =>
              setRecoveryEmail(
                event.target.value
              )
            }
            placeholder="Your account email"
          />
        </label>

        <FormMessage
          error={errorMsg}
          message={message}
        />

        <button
          type="button"
          disabled={loading}
          onClick={() =>
            void handlePasswordReset()
          }
        >
          {loading
            ? "Sending…"
            : "Send Reset Email"}
        </button>
      </div>
    );
  }

  function renderPasswordUpdate() {
    return (
      <form
        className="auth-v3-form-card auth-login-card"
        onSubmit={handleUpdatePassword}
      >
        <div className="auth-form-title">
          <h2>Create a new password</h2>

          <p>
            Enter a new secure password for your
            Theraa Nurse account.
          </p>
        </div>

        <label>
          <span>New password</span>

          <input
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(
                event.target.value
              )
            }
            placeholder="At least 8 characters"
          />
        </label>

        <FormMessage
          error={errorMsg}
          message={message}
        />

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Updating…"
            : "Update Password"}
        </button>
      </form>
    );
  }

  return (
    <div className="auth-v3-page">
      <div className="auth-v3-shell">
        {isRecovery ||
        screen === "reset"
          ? renderPasswordUpdate()
          : null}

        {!isRecovery &&
        screen === "welcome"
          ? renderWelcome()
          : null}

        {!isRecovery &&
        screen === "provider"
          ? renderProviderSignup()
          : null}

        {!isRecovery &&
        screen === "independent"
          ? renderIndependentSignup()
          : null}

        {!isRecovery &&
        screen === "login"
          ? renderLogin()
          : null}

        {!isRecovery &&
        screen === "forgot"
          ? renderForgotPassword()
          : null}

        <div className="auth-v3-footer">
          Secure access for providers,
          independent professionals and
          authorised care teams.
        </div>
      </div>
    </div>
  );
}