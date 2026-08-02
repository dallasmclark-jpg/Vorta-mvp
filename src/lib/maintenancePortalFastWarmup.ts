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

let warmupInFlight = false;
let warmedUserId: string | null = null;

/**
 * Warm read-only Maintenance Manager evidence only after Supabase has verified
 * the restored browser session. This avoids a stale tablet session launching a
 * burst of unauthorised Edge Function calls before auth recovery completes.
 */
export function warmMaintenancePortalDataFast(): void {
  if (warmupInFlight) return;

  warmupInFlight = true;

  void supabase.auth
    .getSession()
    .then(async ({ data, error }) => {
      const session = data.session;
      if (error || !session?.access_token) return;

      const verification = await supabase.auth.getUser(session.access_token);
      const userId = verification.data.user?.id ?? null;
      if (verification.error || !userId || userId === warmedUserId) return;

      await Promise.allSettled(
        MAINTENANCE_PORTAL_REQUESTS.map(({ functionName, options }) =>
          supabase.functions.invoke(functionName, options),
        ),
      );

      warmedUserId = userId;
    })
    .catch((error) => {
      console.warn("Vorta skipped Maintenance Manager data warm-up.", error);
    })
    .finally(() => {
      warmupInFlight = false;
    });
}
