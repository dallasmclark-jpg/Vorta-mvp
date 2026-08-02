const DISABLED_CAPABILITY_SCHEMA = {
  schemaVersion: "capability-v3",
} as const;

/**
 * Route components already load the evidence they need. A global fan-out here
 * caused repeated tablet reloads and restored sessions to compete with six
 * unnecessary Edge Function calls, delaying secure site-context resolution.
 *
 * Keep the entry point temporarily so existing callers remain stable while the
 * recovery branch proves that route-owned loading is sufficient. The capability
 * schema marker is retained only to keep the route and contract version aligned.
 */
export function warmMaintenancePortalDataFast(): void {
  void DISABLED_CAPABILITY_SCHEMA;
  // Deliberately disabled. Do not reintroduce startup-wide evidence fan-out.
}
