import { supabase } from "./supabaseClient";

const MAINTENANCE_PORTAL_FUNCTIONS = [
  "skills-matrix-data",
  "engineers-data",
  "requirements-data",
  "training-data",
  "training-providers-data",
  "ai-matching-data",
] as const;

let warmupStarted = false;

export function warmMaintenancePortalDataFast(): void {
  if (warmupStarted) return;

  warmupStarted = true;

  void Promise.allSettled(
    MAINTENANCE_PORTAL_FUNCTIONS.map((functionName) =>
      supabase.functions.invoke(functionName),
    ),
  );
}
