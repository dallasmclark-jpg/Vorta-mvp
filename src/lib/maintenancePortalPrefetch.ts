import { supabase } from "./supabaseClient";

type RouteDataRequest = {
  functionName: string;
  options?: { body: Record<string, string> };
};

const ROUTE_DATA_REQUEST: Record<string, RouteDataRequest> = {
  "/ai-matching": { functionName: "ai-matching-data" },
  "/skills-matrix": {
    functionName: "skills-matrix-data",
    options: { body: { schemaVersion: "capability-v3" } },
  },
  "/engineers": { functionName: "engineers-data" },
  "/requirements": { functionName: "requirements-data" },
  "/training": { functionName: "training-data" },
  "/training-providers": { functionName: "training-providers-data" },
};

function normalisePath(pathname: string): string {
  const path = pathname.split("?")[0].split("#")[0];
  return path === "/" ? path : path.replace(/\/+$/, "");
}

export function prefetchMaintenancePortalRoute(
  pathname: string,
): void {
  const request = ROUTE_DATA_REQUEST[normalisePath(pathname)];
  if (!request) return;

  void supabase.functions.invoke(
    request.functionName,
    request.options,
  );
}
