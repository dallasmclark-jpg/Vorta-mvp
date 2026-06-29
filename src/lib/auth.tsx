import { createContext, useContext, useEffect, useRef, useState } from "react";
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

// ─── Boot loader with delay threshold + fade-out ─────────────────────────────

// Wraps the entire app during initial auth resolution.
// Only shows the loader if auth takes longer than 250ms (avoids flash for
// cached sessions). Fades the loader out over 250ms once loading completes.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  // Tracks whether auth resolved — readable inside timer callbacks without stale closure
  const resolvedRef    = useRef(false);
  // Tracks whether the threshold timer committed to showing the loader
  const loaderShownRef = useRef(false);
  const [showLoader, setShowLoader] = useState(false);
  const [fadeOut,    setFadeOut]    = useState(false);
  const [ready,      setReady]      = useState(false);

  // Threshold: only show loader if auth is still pending after 250ms
  useEffect(() => {
    const t = setTimeout(() => {
      if (resolvedRef.current) return; // auth already resolved — don't show loader
      loaderShownRef.current = true;
      setShowLoader(true);
    }, 250);
    return () => clearTimeout(t);
  }, []);

  // When auth resolves, either reveal children immediately or fade out the loader
  useEffect(() => {
    if (loading) return;
    resolvedRef.current = true;
    if (!loaderShownRef.current) {
      // Resolved before threshold — skip loader entirely
      setReady(true);
      return;
    }
    // Loader is visible — fade it out then reveal children
    setFadeOut(true);
    const t = setTimeout(() => { setShowLoader(false); setReady(true); }, 260);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <>
      {showLoader && <VortaLoadingScreen fadeOut={fadeOut} />}
      {ready && children}
    </>
  );
}
