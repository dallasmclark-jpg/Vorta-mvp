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

// ─── Route guard ─────────────────────────────────────────────────────────────

export function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <VortaLoadingScreen />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// ─── Boot loader with fade-out ───────────────────────────────────────────────

// Wraps the entire app during initial auth resolution, fading the loader out
// over 250ms once loading completes so the transition into the app is smooth.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const [showLoader, setShowLoader] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setFadeOut(true);
      const t = setTimeout(() => setShowLoader(false), 260);
      return () => clearTimeout(t);
    }
  }, [loading]);

  return (
    <>
      {showLoader && <VortaLoadingScreen fadeOut={fadeOut} />}
      {!loading && children}
    </>
  );
}
