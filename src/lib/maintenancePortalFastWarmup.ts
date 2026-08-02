/**
 * Route components already load the evidence they need. A global fan-out here
 * caused repeated tablet reloads and restored sessions to compete with six
 * unnecessary Edge Function calls, delaying secure site-context resolution.
 *
 * Keep the entry point temporarily so existing callers remain stable while the
 * recovery branch proves that route-owned loading is sufficient.
 */
export function warmMaintenancePortalDataFast(): void {
  // Deliberately disabled. Do not reintroduce startup-wide evidence fan-out.
}
