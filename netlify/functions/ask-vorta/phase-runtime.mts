import type { AskVortaPhase, JsonRecord } from "./contracts.mjs";
import { emitAskVortaProgress } from "./progress-events.mjs";

export class AskVortaPhaseTimeoutError extends Error {
  readonly stage: AskVortaPhase;

  constructor(stage: AskVortaPhase) {
    super(`Ask Vorta ${stage} phase timed out.`);
    this.name = "AskVortaPhaseTimeoutError";
    this.stage = stage;
  }
}

function phaseProgress(stage: AskVortaPhase): { id: string; label: string } | null {
  if (stage === "planner") {
    return { id: "phase-planner", label: "Understanding the question" };
  }
  if (stage === "answer") {
    return { id: "phase-answer", label: "Preparing the answer" };
  }
  return null;
}

export async function withPhaseTimeout<T>(
  stage: AskVortaPhase,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const progress = phaseProgress(stage);
  if (progress) {
    emitAskVortaProgress({ ...progress, state: "active" });
  }
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new AskVortaPhaseTimeoutError(stage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation(controller.signal), timeoutPromise]);
    if (progress) {
      emitAskVortaProgress({ ...progress, state: "complete" });
    }
    return result;
  } catch (error) {
    if (progress) {
      emitAskVortaProgress({ ...progress, state: "failed", detail: "Could not complete this stage" });
    }
    if (
      error instanceof AskVortaPhaseTimeoutError ||
      controller.signal.aborted ||
      (typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw error instanceof AskVortaPhaseTimeoutError
        ? error
        : new AskVortaPhaseTimeoutError(stage);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function canonicalRouteKey(questionPlan: JsonRecord | null): string {
  const intent =
    typeof questionPlan?.intentLabel === "string"
      ? questionPlan.intentLabel.trim().toLowerCase()
      : "";
  if (intent === "maintenance_plan_cover_feasibility") {
    return "maintenance_plan_cover";
  }
  if (intent === "site_risk_movement") {
    return "site_risk_movement";
  }

  const scope =
    typeof questionPlan?.scope === "string"
      ? questionPlan.scope.trim().toLowerCase()
      : "";
  const supported = new Set([
    "site_priorities",
    "site_risk",
    "equipment",
    "shift_cover",
    "handover",
    "work",
    "maintenance_plan",
    "spares",
    "skills",
    "contractor",
    "documents",
    "mixed",
    "general",
  ]);
  return supported.has(scope) ? scope : "general";
}

export function routingModeForPlan(
  questionPlan: JsonRecord | null,
): "deterministic" | "semantic" | "fallback" {
  if (questionPlan?.routingMode === "deterministic") return "deterministic";
  return questionPlan ? "semantic" : "fallback";
}