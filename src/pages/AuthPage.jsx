import { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function checkRecoverySession() {
      const hash = window.location.hash;
      const search = window.location.search;

      if (
        hash.includes("type=recovery") ||
        search.includes("type=recovery")
      ) {
        setIsRecovery(true);
        setMode("reset");
      }
    }

    checkRecoverySession();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMsg("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        setMessage("Account created. Please check your email to confirm your account.");
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage("Login successful.");
      }
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    setLoading(true);
    setMessage("");
    setErrorMsg("");

    try {
      if (!email) {
        throw new Error("Enter your email first, then click Forgot password.");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setMessage("Password reset email sent. Check your inbox.");
    } catch (err) {
      setErrorMsg(err.message || "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMsg("");

    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setMessage("Password updated successfully. You can now log in.");
      setIsRecovery(false);
      setMode("login");
      setNewPassword("");
      window.history.replaceState({}, document.title, window.location.origin);
    } catch (err) {
      setErrorMsg(err.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">TN</div>
          <div>
            <h1>Theraa Nurse</h1>
            <p>Care plan optimisation, purpose-based support, and client insights.</p>
          </div>
        </div>

        {isRecovery || mode === "reset" ? (
          <form onSubmit={handleUpdatePassword} className="auth-form">
            <h2>Reset Password</h2>

            <label>
              New password
              <input
                type="password"
                value={newPassword}
                placeholder="Enter new password"
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>

            {errorMsg ? <div className="auth-error">{errorMsg}</div> : null}
            {message ? <div className="auth-success">{message}</div> : null}

            <button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setMessage("");
                  setErrorMsg("");
                }}
              >
                Login
              </button>

              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                  setErrorMsg("");
                }}
              >
                Sign Up
              </button>
            </div>

            {mode === "login" ? (
              <button
                type="button"
                className="forgot-link"
                onClick={handlePasswordReset}
                disabled={loading}
              >
                Forgot password?
              </button>
            ) : null}

            <form onSubmit={handleSubmit} className="auth-form">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  placeholder="Enter your email"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  placeholder="Enter your password"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {errorMsg ? <div className="auth-error">{errorMsg}</div> : null}
              {message ? <div className="auth-success">{message}</div> : null}

              <button type="submit" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Login to Theraa Nurse"
                  : "Create Theraa Nurse Account"}
              </button>
            </form>
          </>
        )}

        <p className="auth-footer">
          Secure access for providers, support workers, and authorised care teams.
        </p>
      </div>
    </div>
  );
}