import type { Session } from "@supabase/supabase-js";

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

export function normalisePilotRole(value: unknown): PilotRole | null {
  if (typeof value !== "string") return null;

  const normalised = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
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

export function resolveSessionRole(session: Session | null): PilotRole | null {
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

export function resolveDemoAdmin(session: Session | null): boolean {
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

function matchesPortalPath(pathname: string, portalPath: string): boolean {
  return pathname === portalPath || pathname.startsWith(`${portalPath}/`);
}

export function canAccessPath(
  role: PilotRole,
  pathname: string,
  isDemoAdmin = false,
): boolean {
  const isEngineerPath = matchesPortalPath(pathname, "/engineer");
  const isContractorPath = matchesPortalPath(pathname, "/contractor");
  const isProductionPath = matchesPortalPath(pathname, "/production");
  const isOperatorPath = matchesPortalPath(pathname, "/operator");
  const isPlannerPath = matchesPortalPath(pathname, "/planner");
  const isSpecialistPortalPath =
    isEngineerPath ||
    isContractorPath ||
    isProductionPath ||
    isOperatorPath ||
    isPlannerPath;

  if (isDemoAdmin || role === "vorta_admin") return true;

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

export function canAdministerPilot(role: PilotRole | null, isDemoAdmin: boolean): boolean {
  return isDemoAdmin || role === "vorta_admin" || role === "site_admin";
}

export function canImportSapData(role: PilotRole | null, isDemoAdmin: boolean): boolean {
  return canAdministerPilot(role, isDemoAdmin);
}
