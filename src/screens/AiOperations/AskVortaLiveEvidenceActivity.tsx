import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  ASK_VORTA_PROGRESS_EVENT,
  ASK_VORTA_PROGRESS_RESET_EVENT,
  type VortaAgentProgressEvent,
} from "./vortaAgentService";

const MAX_VISIBLE_PROGRESS_STEPS = 4;

function mergeProgressStep(
  current: VortaAgentProgressEvent[],
  next: VortaAgentProgressEvent,
): VortaAgentProgressEvent[] {
  const existingIndex = current.findIndex((item) => item.id === next.id);
  if (existingIndex < 0) return [...current, next];
  return current.map((item, index) => (index === existingIndex ? next : item));
}

export function AskVortaLiveEvidenceActivity(): JSX.Element {
  const [steps, setSteps] = useState<VortaAgentProgressEvent[]>([]);

  useEffect(() => {
    const handleProgress = (event: Event): void => {
      const progressEvent = event as CustomEvent<VortaAgentProgressEvent>;
      if (!progressEvent.detail) return;
      setSteps((current) => mergeProgressStep(current, progressEvent.detail));
    };
    const resetProgress = (): void => setSteps([]);

    window.addEventListener(ASK_VORTA_PROGRESS_EVENT, handleProgress);
    window.addEventListener(ASK_VORTA_PROGRESS_RESET_EVENT, resetProgress);
    return () => {
      window.removeEventListener(ASK_VORTA_PROGRESS_EVENT, handleProgress);
      window.removeEventListener(ASK_VORTA_PROGRESS_RESET_EVENT, resetProgress);
    };
  }, []);

  const visible = useMemo(
    () => steps.slice(-MAX_VISIBLE_PROGRESS_STEPS),
    [steps],
  );
  const active = [...visible].reverse().find((step) => step.state === "active");
  const completedCount = visible.filter((step) => step.state === "complete").length;

  return (
    <div
      data-vorta-ai-live-evidence-activity="true"
      className="w-full space-y-2 rounded-xl border border-gray-800 bg-gray-900/55 px-3 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-300">
          <ShieldCheck className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
          <span className="truncate">
            {active?.label ?? "Starting the relevant evidence checks…"}
          </span>
        </span>
        {visible.length > 0 ? (
          <span className="shrink-0 text-[11px] font-medium text-slate-500">
            {completedCount}/{visible.length} checked
          </span>
        ) : (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-400" aria-hidden="true" />
        )}
      </div>

      {visible.length > 0 ? (
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden" aria-label="Live Vorta evidence checks">
          {visible.map((step) => (
            <span
              key={step.id}
              title={step.detail || step.label}
              className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${
                step.state === "complete"
                  ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200"
                  : step.state === "failed"
                    ? "border-amber-500/25 bg-amber-500/[0.07] text-amber-200"
                    : "border-blue-500/25 bg-blue-500/[0.08] text-blue-200"
              }`}
            >
              {step.state === "complete" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : step.state === "failed" ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
              )}
              <span className="truncate">{step.label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
