import { useState } from "react";
import { supabase } from "../services/supabaseClient";

export default function AuthPage({ onAuthSuccess }) {
const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        setMessage(
          data?.session
            ? "Account created successfully."
            : "Account created. Check your email to confirm your signup."
        );

        if (data?.user && data?.session) {
          onAuthSuccess?.(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage("Login successful.");
        onAuthSuccess?.(data.user);
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
  if (!email) {
    setError("Enter your email first, then click Forgot Password.");
    return;
  }

  setLoading(true);
  setError("");
  setMessage("");

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });

  if (error) {
    setError(error.message);
  } else {
    setMessage("Password reset email sent. Check your inbox.");
  }

  setLoading(false);
}

  return (
    <div style={styles.page}>
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.brandBlock}>
            <div style={styles.badge}>TN</div>
            <div>
              <h1 style={styles.title}>Theraa Nurse</h1>
              <p style={styles.subtitle}>
                Care plan optimisation, purpose-based support, and client insights.
              </p>
            </div>
          </div>

          <div style={styles.toggleRow}>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
              style={{
                ...styles.toggleBtn,
                ...(mode === "login" ? styles.toggleBtnActive : {}),
              }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
                setMessage("");
              }}
              style={{
                ...styles.toggleBtn,
                ...(mode === "signup" ? styles.toggleBtnActive : {}),
              }}
            >
              Sign Up
            </button>

            <button
              type="button"
              onClick={handlePasswordReset}
              style={{
                border: "none",
                background: "transparent",
                color: "#2563eb",
                cursor: "pointer",
                fontSize: 13,
                textAlign: "left",
                padding: 0,
                marginTop: -6,
              }}
            >
              Forgot password?
              </button>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {mode === "signup" && (
              <div>
                <label style={styles.label}>Full name</label>
                <input
                  style={styles.input}
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
            )}

            <div>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}
            {message ? <div style={styles.message}>{message}</div> : null}

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading
                ? mode === "login"
                  ? "Logging in..."
                  : "Creating account..."
                : mode === "login"
                ? "Login to Theraa Nurse"
                : "Create account"}
            </button>
          </form>

          <div style={styles.footerNote}>
            Secure access for providers, support workers, and authorised care teams.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    background:
      "linear-gradient(135deg, #eef4ff 0%, #f8fafc 45%, #eefdf6 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
  },
  overlay: {
    width: "100%",
    maxWidth: 480,
  },
  card: {
    background: "#ffffff",
    borderRadius: 20,
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.12)",
    border: "1px solid #e5e7eb",
    padding: 28,
  },
  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  title: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.1,
    color: "#0f172a",
  },
  subtitle: {
    margin: "6px 0 0 0",
    fontSize: 14,
    color: "#64748b",
  },
  toggleRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 18,
  },
  toggleBtn: {
    border: "1px solid #dbe3ee",
    background: "#f8fafc",
    color: "#334155",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  toggleBtnActive: {
    background: "#0f172a",
    color: "#fff",
    borderColor: "#0f172a",
  },
  form: {
    display: "grid",
    gap: 14,
  },
  label: {
    display: "block",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #dbe3ee",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    background: "#fff",
  },
  submitBtn: {
    marginTop: 4,
    border: "none",
    borderRadius: 12,
    padding: "12px 16px",
    background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  error: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
  },
  message: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
  },
  footerNote: {
    marginTop: 16,
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
};