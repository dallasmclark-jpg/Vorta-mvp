import { supabase } from "./supabaseClient";

type WarmupRequest = {
  functionName: string;
  options?: { body: Record<string, string> };
};

const MAINTENANCE_PORTAL_REQUESTS: WarmupRequest[] = [
  {
    functionName: "skills-matrix-data",
    options: { body: { schemaVersion: "capability-v3" } },
  },
  { functionName: "engineers-data" },
  { functionName: "requirements-data" },
  { functionName: "training-data" },
  { functionName: "training-providers-data" },
  { functionName: "ai-matching-data" },
];

let warmupStarted = false;

export function warmMaintenancePortalDataFast(): void {
  if (warmupStarted) return;

  warmupStarted = true;

  void Promise.allSettled(
    MAINTENANCE_PORTAL_REQUESTS.map(({ functionName, options }) =>
      supabase.functions.invoke(functionName, options),
    ),
  );
}
