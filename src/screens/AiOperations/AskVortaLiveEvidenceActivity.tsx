import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  ASK_VORTA_PROGRESS_EVENT,
  ASK_VORTA_PROGRESS_RESET_EVENT,
  type VortaAgentProgressEvent,
} from "./vortaAgentService";

function mergeProgressStep(
  current: VortaAgentProgressEvent[],
  next: VortaAgentProgressEvent,
): VortaAgentProgressEvent[] {
  const existingIndex = current.findIndex((item) => item.id === next.id);
  if (existingIndex < 0) return [...current, next];
  return current.map((item, index) => (index === existingIndex ? next : item));
}

function currentProgressStep(
  steps: VortaAgentProgressEvent[],
): VortaAgentProgressEvent | null {
  const reversed = [...steps].reverse();
  return (
    reversed.find((step) => step.state === "active") ??
    reversed.find((step) => step.state === "failed") ??
    reversed[0] ??
    null
  );
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

  const current = currentProgressStep(steps);
  const label = current?.label ?? "Starting the relevant evidence checks…";

  return (
    <div
      data-vorta-ai-live-evidence-activity="true"
      data-vorta-ai-single-status="true"
      className="w-full max-w-[440px]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span
        data-vorta-ai-single-status-icon="true"
        className="inline-flex items-center justify-center"
        aria-hidden="true"
      >
        <ShieldCheck className="h-4 w-4 text-blue-300" />
      </span>
      <span
        data-vorta-ai-single-status-label="true"
        className={
          current?.state === "failed"
            ? "block truncate text-sm font-semibold text-amber-200"
            : "block truncate text-sm font-semibold text-slate-200"
        }
      >
        {label}
      </span>
    </div>
  );
}
