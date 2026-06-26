import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";

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
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0e14]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    </div>
  );
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
