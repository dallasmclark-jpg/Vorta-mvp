import { supabase } from "./supabaseClient";

const ROUTE_DATA_FUNCTION: Record<string, string> = {
  "/ai-matching": "ai-matching-data",
  "/skills-matrix": "skills-matrix-data",
  "/engineers": "engineers-data",
  "/requirements": "requirements-data",
  "/training": "training-data",
  "/training-providers": "training-providers-data",
};

function normalisePath(pathname: string): string {
  const path = pathname.split("?")[0].split("#")[0];
  return path === "/" ? path : path.replace(/\/+$/, "");
}

export function prefetchMaintenancePortalRoute(
  pathname: string,
): void {
  const functionName =
    ROUTE_DATA_FUNCTION[normalisePath(pathname)];

  if (!functionName) return;

  void supabase.functions.invoke(functionName);
}
