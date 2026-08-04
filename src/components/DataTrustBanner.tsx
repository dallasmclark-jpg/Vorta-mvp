import { AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  getConfiguredDataMode,
  getEffectiveDataMode,
} from "../lib/dataTrust";

/**
 * Operational pages should not carry a persistent provenance banner.
 * Only a blocking unavailable-data state is surfaced globally.
 */
export function DataTrustBanner(): JSX.Element | null {
  const { siteContext } = useAuth();
  const hasActiveSite = Boolean(siteContext?.siteId);
  const configuredMode = getConfiguredDataMode();
  const mode = getEffectiveDataMode(hasActiveSite);

  if (mode !== "unavailable") {
    return null;
  }

  const unavailableReason = hasActiveSite
    ? "deployment-mode"
    : "active-site";
  const message = hasActiveSite
    ? "Vorta has verified the active site, but this deployment has no authorised operational data mode. Values are withheld until the deployment configuration is restored."
    : "Vorta has no verified active-site context. Operational values are withheld until secure access is restored.";

  return (
    <aside
      data-vorta-data-mode="unavailable"
      data-vorta-data-unavailable-reason={unavailableReason}
      data-vorta-configured-data-mode={configuredMode}
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-40 flex min-h-10 w-full items-center gap-3 border-b border-red-500/30 bg-red-500/[0.07] px-4 py-2 text-xs text-red-100 shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur-md md:px-6"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
        <strong className="shrink-0 text-[11px] font-bold tracking-[0.14em]">
          DATA UNAVAILABLE
        </strong>
        <span className="min-w-0 text-[11px] leading-4 opacity-80 sm:truncate">
          {message}
        </span>
      </div>
    </aside>
  );
}
