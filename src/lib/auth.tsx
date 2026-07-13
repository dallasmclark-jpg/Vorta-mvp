import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { VortaLoadingScreen } from "../components/VortaLoadingScreen";

export type PilotRole =
  | "vorta_admin"
  | "site_admin"
  | "maintenance_manager"
  | "maintenance_planner"
  | "reliability_engineer"
  | "engineer"
  | "production_manager"
  | "operator"
  | "contractor_admin"
  | "contractor_engineer";

export interface ActiveSiteContext {
  siteId: string;
  organisationId: string;
  role: PilotRole;
  isDefault: boolean;
}

interface AuthContextValue {
  session: Session | null;
  role: PilotRole | null;
  siteContext: ActiveSiteContext | null;
  isDemoAdmin: boolean;
  loading: boolean;
  roleResolutionFailed: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  role: null,
  siteContext: null,
  isDemoAdmin: false,
  loading: true,
  roleResolutionFailed: false,
});

export function normalisePilotRole(value: unknown): PilotRole | null {
  if (typeof value !== "string") return null;

  const normalised = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  switch (normalised) {
    case "vorta_admin":
    case "vortaadmin":
      return "vorta_admin";

    case "site_admin":
    case "siteadmin":
    case "admin":
      return "site_admin";

    case "maintenance_manager":
    case "maintenancemanager":
    case "manager":
      return "maintenance_manager";

    case "maintenance_planner":
    case "maintenanceplanner":
    case "planner":
      return "maintenance_planner";

    case "reliability_engineer":
    case "reliabilityengineer":
    case "reliability":
      return "reliability_engineer";

    case "engineer":
    case "maintenance_engineer":
    case "maintenanceengineer":
      return "engineer";

    case "production_manager":
    case "productionmanager":
      return "production_manager";

    case "operator":
    case "production_operator":
    case "productionoperator":
      return "operator";

    case "contractor_admin":
    case "contractoradmin":
    case "contractor_company_admin":
    case "contractor":
      return "contractor_admin";

    case "contractor_engineer":
    case "contractorengineer":
      return "contractor_engineer";

    default:
      return null;
  }
}

export function resolveSessionRole(
  session: Session | null,
): PilotRole | null {
  if (!session) return null;

  const appMetadata = session.user.app_metadata ?? {};
  const userMetadata = session.user.user_metadata ?? {};

  return normalisePilotRole(
    appMetadata.portal_role ??
      appMetadata.role ??
      userMetadata.portal_role ??
      userMetadata.role,
  );
}

export function resolveDemoAdmin(
  session: Session | null,
): boolean {
  return session?.user.app_metadata?.demo_admin === true;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Vorta role: ${String(value)}`);
}

export function roleHomePath(role: PilotRole): string {
  switch (role) {
    case "engineer":
      return "/engineer/dashboard";

    case "contractor_admin":
    case "contractor_engineer":
      return "/contractor/dashboard";

    case "production_manager":
      return "/production/dashboard";

    case "operator":
      return "/operator/dashboard";

    case "maintenance_planner":
      return "/planner/planner-dashboard";

    case "maintenance_manager":
    case "reliability_engineer":
    case "site_admin":
    case "vorta_admin":
      return "/dashboard";

    default:
      return assertNever(role);
  }
}

function matchesPortalPath(
  pathname: string,
  portalPath: string,
): boolean {
  return (
    pathname === portalPath ||
    pathname.startsWith(`${portalPath}/`)
  );
}

export function canAccessPath(
  role: PilotRole,
  pathname: string,
  isDemoAdmin = false,
): boolean {
  const isEngineerPath = matchesPortalPath(
    pathname,
    "/engineer",
  );
  const isContractorPath = matchesPortalPath(
    pathname,
    "/contractor",
  );
  const isProductionPath = matchesPortalPath(
    pathname,
    "/production",
  );
  const isOperatorPath = matchesPortalPath(
    pathname,
    "/operator",
  );
  const isPlannerPath = matchesPortalPath(
    pathname,
    "/planner",
  );

  const isSpecialistPortalPath =
    isEngineerPath ||
    isContractorPath ||
    isProductionPath ||
    isOperatorPath ||
    isPlannerPath;

  if (isDemoAdmin || role === "vorta_admin") {
    return true;
  }

  switch (role) {
    case "engineer":
      return isEngineerPath;

    case "contractor_admin":
    case "contractor_engineer":
      return isContractorPath;

    case "production_manager":
      return isProductionPath;

    case "operator":
      return isOperatorPath;

    case "maintenance_planner":
      return isPlannerPath;

    case "maintenance_manager":
    case "site_admin":
    case "reliability_engineer":
      return !isSpecialistPortalPath;

    case "vorta_admin":
      return true;

    default:
      return assertNever(role);
  }
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);
  const [role, setRole] =
    useState<PilotRole | null>(null);
  const [siteContext, setSiteContext] =
    useState<ActiveSiteContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [
    roleResolutionFailed,
    setRoleResolutionFailed,
  ] = useState(false);

  const activeUserIdRef = useRef<string | null>(null);
  const hydratedUserIdRef = useRef<string | null>(null);
  const hydratingUserIdRef = useRef<string | null>(null);
  const hydrationRequestRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const clearAuthentication = () => {
      hydrationRequestRef.current += 1;
      activeUserIdRef.current = null;
      hydratedUserIdRef.current = null;
      hydratingUserIdRef.current = null;

      setSession(null);
      setRole(null);
      setSiteContext(null);
      setRoleResolutionFailed(false);
      setLoading(false);
    };

    const hydrateSession = async (
      nextSession: Session | null,
    ) => {
      if (!mounted) return;

      if (!nextSession) {
        clearAuthentication();
        return;
      }

      const nextUserId = nextSession.user.id;
      const metadataRole =
        resolveSessionRole(nextSession);

      setSession(nextSession);

      const userChanged =
        activeUserIdRef.current !== nextUserId;

      activeUserIdRef.current = nextUserId;

      if (
        hydratedUserIdRef.current === nextUserId
      ) {
        setRole((currentRole) =>
          currentRole ?? metadataRole
        );
        setLoading(false);
        return;
      }

      if (
        hydratingUserIdRef.current === nextUserId
      ) {
        return;
      }

      hydratingUserIdRef.current = nextUserId;
      const requestId =
        ++hydrationRequestRef.current;

      if (userChanged) {
        setRole(metadataRole);
        setSiteContext(null);
      }

      setRoleResolutionFailed(false);
      setLoading(true);

      try {
        const [profileResult, accessResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("role, organisation_id")
              .eq("id", nextUserId)
              .maybeSingle(),

            supabase
              .from("user_site_access")
              .select(
                [
                  "site_id",
                  "organisation_id",
                  "app_role",
                  "is_default",
                ].join(","),
              )
              .eq("user_id", nextUserId)
              .eq("active", true)
              .order("is_default", {
                ascending: false,
              })
              .order("created_at", {
                ascending: true,
              })
              .limit(1)
              .maybeSingle(),
          ]);

        if (
          !mounted ||
          requestId !==
            hydrationRequestRef.current ||
          activeUserIdRef.current !== nextUserId
        ) {
          return;
        }

        const profileError = profileResult.error;
        const accessError = accessResult.error;
        const lookupFailed =
          Boolean(profileError) ||
          Boolean(accessError);

        if (lookupFailed) {
          console.warn(
            "Vorta auth context hydration failed.",
            {
              profile:
                profileError?.message ?? null,
              siteAccess:
                accessError?.message ?? null,
            },
          );
        }

        const accessRole = normalisePilotRole(
          accessResult.data?.app_role,
        );

        const profileRole = normalisePilotRole(
          profileResult.data?.role,
        );

        const effectiveRole =
          accessRole ??
          profileRole ??
          metadataRole;

        setRole(effectiveRole);

        if (
          accessResult.data &&
          effectiveRole
        ) {
          setSiteContext({
            siteId: accessResult.data.site_id,
            organisationId:
              accessResult.data.organisation_id,
            role: effectiveRole,
            isDefault:
              accessResult.data.is_default,
          });
        } else {
          setSiteContext(null);
        }

        setRoleResolutionFailed(
          lookupFailed && !effectiveRole,
        );

        if (!lookupFailed) {
          hydratedUserIdRef.current =
            nextUserId;
        }

        hydratingUserIdRef.current = null;
        setLoading(false);
      } catch (error) {
        if (
          !mounted ||
          requestId !==
            hydrationRequestRef.current ||
          activeUserIdRef.current !== nextUserId
        ) {
          return;
        }

        console.warn(
          "Vorta auth context hydration failed.",
          error,
        );

        setRole((currentRole) =>
          currentRole ?? metadataRole
        );
        setRoleResolutionFailed(!metadataRole);
        hydratingUserIdRef.current = null;
        setLoading(false);
      }
    };

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          console.warn(
            "Unable to read the current Vorta session.",
            error.message,
          );
        }

        void hydrateSession(data.session);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void hydrateSession(nextSession);
      },
    );

    return () => {
      mounted = false;
      hydrationRequestRef.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const isDemoAdmin =
    resolveDemoAdmin(session) ||
    role === "vorta_admin";

  return (
    <AuthContext.Provider
      value={{
        session,
        role,
        siteContext,
        isDemoAdmin,
        loading,
        roleResolutionFailed,
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

  if (loading) {
    return <VortaLoadingScreen />;
  }

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
  role: PilotRole | readonly PilotRole[];
  children: JSX.Element;
}): JSX.Element {
  const {
    session,
    role,
    siteContext,
    isDemoAdmin,
    loading,
    roleResolutionFailed,
  } = useAuth();

  const location = useLocation();
  const authErrorRef = useRef<string | null>(null);

  if (loading) {
    return <VortaLoadingScreen />;
  }

  if (!session) {
    return (
      <Navigate
        to="/"
        state={{
          from: location,
          ...(authErrorRef.current
            ? {
                authError:
                  authErrorRef.current,
              }
            : {}),
        }}
        replace
      />
    );
  }

  if (!role) {
    if (roleResolutionFailed) {
      return (
        <Navigate
          to="/"
          state={{
            from: location,
            authError:
              "Vorta could not verify your portal access. Please retry.",
          }}
          replace
        />
      );
    }

    authErrorRef.current =
      "Your account does not have a supported Vorta portal role.";

    return <SignOutUnsupportedRole />;
  }

  const hasGlobalAdminAccess =
    isDemoAdmin ||
    role === "vorta_admin";

  if (
    !hasGlobalAdminAccess &&
    !siteContext
  ) {
    authErrorRef.current =
      "Your account does not have an active Vorta site assignment.";

    return <SignOutUnsupportedRole />;
  }

  const allowedRoles: readonly PilotRole[] =
    Array.isArray(requiredRole)
      ? requiredRole
      : [requiredRole];

  const hasAccess =
    hasGlobalAdminAccess ||
    allowedRoles.includes(role);

  if (!hasAccess) {
    return (
      <Navigate
        to={roleHomePath(role)}
        replace
      />
    );
  }

  return children;
}

export function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useAuth();
  const resolvedRef = useRef(false);
  const loaderShownRef = useRef(false);

  const [showLoader, setShowLoader] =
    useState(false);
  const [fadeOut, setFadeOut] =
    useState(false);
  const [ready, setReady] =
    useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (resolvedRef.current) return;

      loaderShownRef.current = true;
      setShowLoader(true);
    }, 250);

    return () =>
      window.clearTimeout(timer);
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

    return () =>
      window.clearTimeout(timer);
  }, [loading]);

  return (
    <>
      {showLoader && (
        <VortaLoadingScreen fadeOut={fadeOut} />
      )}
      {ready && children}
    </>
  );
}
