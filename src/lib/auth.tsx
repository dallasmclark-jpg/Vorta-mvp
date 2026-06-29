import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { VortaLoadingScreen } from "../components/VortaLoadingScreen";

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore persisted session from localStorage (supabase-js does this automatically)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Keep session state current across sign-in, sign-out, and token refresh events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function AuthLoading() {
  return <VortaLoadingScreen />;
}

// ─── Route guard ─────────────────────────────────────────────────────────────

/**
 * Wrap any route that requires authentication.
 * Redirects unauthenticated users to /login, preserving the intended destination
 * so they can be returned there after a successful sign-in.
 */
export function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
