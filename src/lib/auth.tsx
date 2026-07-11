import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { VortaLoadingScreen } from "../components/VortaLoadingScreen";

export type PilotRole = "maintenance_manager" | "engineer";

interface AuthContextValue {
  session: Session | null;
  role: PilotRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  role: null,
  loading: true,
});

export function normalisePilotRole(value: unknown): PilotRole | null {
  if (typeof value !== "string") return null;

  const normalised = value.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (
    normalised === "maintenance_manager" ||
    normalised === "maintenancemanager"
  ) {
    return "maintenance_manager";
  }

  if (
    normalised === "engineer" ||
    normalised === "maintenance_engineer"
  ) {
    return "engineer";
  }

  return null;
}

export function resolveSessionRole(session: Session | null): PilotRole | null {
  if (!session) return null;

  const metadata = session.user.app_metadata ?? {};

  return normalisePilotRole(
    metadata.portal_role ?? metadata.role,
  );
}

export function roleHomePath(role: PilotRole): string {
  return role === "engineer" ? "/engineer/dashboard" : "/dashboard";
}

export function canAccessPath(
  role: PilotRole,
  pathname: string,
): boolean {
  if (role === "engineer") {
    return pathname === "/engineer" || pathname.startsWith("/engineer/");
  }

  return !(
    pathname === "/engineer" ||
    pathname.startsWith("/engineer/") ||
    pathname === "/contractor" ||
    pathname.startsWith("/contractor/") ||
    pathname === "/production" ||
    pathname.startsWith("/production/") ||
    pathname === "/operator" ||
    pathname.startsWith("/operator/") ||
    pathname === "/planner" ||
    pathname.startsWith("/planner/")
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        role: resolveSessionRole(session),
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function RequireAuth({
  children,
}: {
  children: JSX.Element;
}): JSX.Element {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <VortaLoadingScreen />;

  if (!session) {
    return (
      <Navigate
        to="/"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}

function SignOutUnsupportedRole(): JSX.Element {
  useEffect(() => {
    void supabase.auth.signOut();
  }, []);
  return <VortaLoadingScreen />;
}

export function RequireRole({
  role: requiredRole,
  children,
}: {
  role: PilotRole;
  children: JSX.Element;
}): JSX.Element {
  const { session, role, loading } = useAuth();
  const location = useLocation();
  const unsupportedRoleRef = useRef(false);

  if (loading) return <VortaLoadingScreen />;

  if (!session) {
    return (
      <Navigate
        to="/"
        state={{
          from: location,
          ...(unsupportedRoleRef.current
            ? {
                authError:
                  "Your account does not have a supported Vorta pilot role.",
              }
            : {}),
        }}
        replace
      />
    );
  }

  if (!role) {
    unsupportedRoleRef.current = true;
    return <SignOutUnsupportedRole />;
  }

  if (role !== requiredRole) {
    return <Navigate to={roleHomePath(role)} replace />;
  }

  return children;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const resolvedRef = useRef(false);
  const loaderShownRef = useRef(false);
  const [showLoader, setShowLoader] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (resolvedRef.current) return;
      loaderShownRef.current = true;
      setShowLoader(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) return;

    resolvedRef.current = true;

    if (!loaderShownRef.current) {
      setReady(true);
      return;
    }

    setFadeOut(true);

    const timer = window.setTimeout(() => {
      setShowLoader(false);
      setReady(true);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [loading]);

  return (
    <>
      {showLoader && <VortaLoadingScreen fadeOut={fadeOut} />}
      {ready && children}
    </>
  );
}
