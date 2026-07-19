import { AlertTriangle, Database, FlaskConical } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  getEffectiveDataMode,
  type VortaDataMode,
} from "../lib/dataTrust";

const PRESENTATION: Record<
  VortaDataMode,
  {
    label: string;
    detail: string;
    className: string;
    icon: typeof Database;
  }
> = {
  live: {
    label: "LIVE SITE DATA",
    detail:
      "Site-scoped Supabase records are authoritative. Missing or failed records are shown as unavailable, not replaced with demo evidence.",
    className:
      "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200",
    icon: Database,
  },
  demo: {
    label: "DEMO DATA",
    detail:
      "This environment contains demonstration records. Do not treat values or recommendations as verified site evidence.",
    className:
      "border-amber-500/30 bg-amber-500/[0.07] text-amber-100",
    icon: FlaskConical,
  },
  unavailable: {
    label: "DATA UNAVAILABLE",
    detail:
      "Vorta has no verified active-site context. Operational values are withheld until secure access is restored.",
    className:
      "border-red-500/30 bg-red-500/[0.07] text-red-100",
    icon: AlertTriangle,
  },
};

export function DataTrustBanner(): JSX.Element {
  const { siteContext } = useAuth();
  const mode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const presentation = PRESENTATION[mode];
  const Icon = presentation.icon;

  return (
    <aside
      data-vorta-data-mode={mode}
      role={mode === "unavailable" ? "alert" : "status"}
      aria-live={mode === "unavailable" ? "assertive" : "polite"}
      className={`sticky top-0 z-40 flex min-h-10 w-full items-center gap-3 border-b px-4 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.16)] backdrop-blur-md md:px-6 ${presentation.className}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
        <strong className="shrink-0 text-[11px] font-bold tracking-[0.14em]">
          {presentation.label}
        </strong>
        <span className="min-w-0 text-[11px] leading-4 opacity-80 sm:truncate">
          {presentation.detail}
        </span>
      </div>

      {siteContext?.siteId ? (
        <span className="hidden shrink-0 font-mono text-[10px] opacity-55 lg:inline">
          Site {siteContext.siteId.slice(0, 8)}
        </span>
      ) : null}
    </aside>
  );
}
