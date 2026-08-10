import { AsyncLocalStorage } from "node:async_hooks";
import type { ToolResult } from "./contracts.mjs";

export type AskVortaProgressState = "active" | "complete" | "failed";

export interface AskVortaProgressEvent {
  id: string;
  label: string;
  state: AskVortaProgressState;
  detail?: string;
}

type AskVortaProgressSink = (event: AskVortaProgressEvent) => void;

const progressStorage = new AsyncLocalStorage<AskVortaProgressSink>();

export async function withAskVortaProgressSink<T>(
  sink: AskVortaProgressSink,
  operation: () => Promise<T>,
): Promise<T> {
  return progressStorage.run(sink, operation);
}

export function emitAskVortaProgress(event: AskVortaProgressEvent): void {
  progressStorage.getStore()?.({
    id: event.id.slice(0, 80),
    label: event.label.slice(0, 120),
    state: event.state,
    ...(event.detail ? { detail: event.detail.slice(0, 120) } : {}),
  });
}

const TOOL_PROGRESS_LABELS: Record<string, string> = {
  get_site_risk: "Checking site risk",
  get_site_ranked_actions: "Ranking operational actions",
  get_shift_cover: "Checking Shift Cover",
  get_shift_handover: "Checking shift handover",
  get_contractor_availability: "Checking contractor availability",
  get_site_work_backlog: "Checking work-order backlog",
  get_site_maintenance_plan: "Checking PM and calibration plan",
  get_site_spares_risk: "Checking Stores Inventory",
  get_site_capability_actions: "Checking skills and capability",
  get_equipment_risk: "Checking equipment register",
  get_equipment_work: "Checking work orders",
  get_equipment_calibrations: "Checking calibrations",
  get_equipment_skills: "Checking equipment skills coverage",
  get_equipment_history: "Checking work-order history",
  get_equipment_documents: "Checking equipment documents",
  get_equipment_spares: "Checking equipment BOM and spares",
  get_equipment_risk_actions: "Checking equipment risk actions",
  search_maintenance_documents: "Searching manuals and drawings",
};

export function askVortaProgressLabelForTool(name: string): string | null {
  return TOOL_PROGRESS_LABELS[name] ?? null;
}

function numericValue(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function summaryNumber(result: ToolResult, keys: string[]): number | null {
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    return null;
  }
  const summary = (result.data as Record<string, unknown>).summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  const record = summary as Record<string, unknown>;
  for (const key of keys) {
    const value = numericValue(record[key]);
    if (value !== null) return value;
  }
  return null;
}

export function askVortaProgressDetailForTool(
  name: string,
  result: ToolResult,
): string | undefined {
  if (result.status === "empty") return "No matching records";
  if (result.status === "unavailable") return "Source unavailable";

  const knownCounts: Record<string, [string[], string]> = {
    get_site_work_backlog: [["openCount"], "open work orders"],
    get_site_spares_risk: [["riskItemCount"], "risk items"],
    get_site_maintenance_plan: [["dueCount"], "planned items"],
    get_shift_handover: [["itemCount"], "handover items"],
    get_contractor_availability: [["contractorCount"], "contractors"],
  };
  const known = knownCounts[name];
  if (known) {
    const count = summaryNumber(result, known[0]);
    if (count !== null) return `${count} ${known[1]}`;
  }

  if (Array.isArray(result.data)) {
    return `${result.data.length} record${result.data.length === 1 ? "" : "s"}`;
  }
  return undefined;
}
