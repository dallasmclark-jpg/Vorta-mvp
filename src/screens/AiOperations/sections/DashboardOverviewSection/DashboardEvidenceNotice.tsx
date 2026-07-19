import { Info, X } from "lucide-react";

export type DashboardEvidenceState =
  | "loading"
  | "current"
  | "stale"
  | "unavailable";

interface DashboardEvidenceNoticeProps {
  state: DashboardEvidenceState;
  error: string | null;
  warnings: string[];
  lastSuccessfulSnapshotLabel: string | null;
}

export function DashboardEvidenceNotice({
  state,
  error,
  warnings,
  lastSuccessfulSnapshotLabel,
}: DashboardEvidenceNoticeProps): JSX.Element | null {
  if (!error && warnings.length === 0) return null;

  return (
    <div className="contents">
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          data-vorta-dashboard-evidence-state={state}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            state === "stale"
              ? "border-amber-500/30 bg-amber-500/[0.07]"
              : "border-red-500/25 bg-red-500/5"
          }`}
        >
          <X
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              state === "stale" ? "text-amber-300" : "text-red-400"
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p
              className={`text-sm font-semibold ${
                state === "stale" ? "text-amber-200" : "text-red-300"
              }`}
            >
              {error}
            </p>
            {lastSuccessfulSnapshotLabel && (
              <p className="mt-1 text-xs text-slate-400">
                Last successful operational snapshot: {lastSuccessfulSnapshotLabel}
              </p>
            )}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-amber-200">
              Some secondary intelligence is unavailable
            </p>
            <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-400">
              {warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
