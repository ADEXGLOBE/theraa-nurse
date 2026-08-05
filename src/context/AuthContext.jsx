// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../services/supabaseClient";

const AuthContext = createContext(null);

function normaliseUser(user) {
  if (!user) return null;

  return {
    ...user,
    displayName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Theraa Nurse User",
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] =
    useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadInitialSession() {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          throw error;
        }

        setUser(
          normaliseUser(
            data?.session?.user || null
          )
        );
      } catch (error) {
        console.error(
          "Failed to get Supabase session:",
          error
        );

        if (mounted) {
          setUser(null);
          setAuthError(
            error?.message ||
              "Authentication could not be loaded."
          );
        }
      } finally {
        if (mounted) {
          setAuthReady(true);
        }
      }
    }

    void loadInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        setUser(
          normaliseUser(
            session?.user || null
          )
        );

        setAuthError("");
        setAuthReady(true);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      authReady,
      authError,
      signOut,

      userId: user?.id || null,
      userEmail: user?.email || null,
      userDisplayName:
        user?.displayName || "User",
    }),
    [user, authReady, authError]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}