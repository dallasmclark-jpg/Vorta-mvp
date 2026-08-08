import { supabase } from "../../lib/supabaseClient";
import {
  VOR_069_BACKTEST_DATASET_VERSION,
  VOR_069_BACKTEST_VALIDATION_DAYS,
  type HistoricalBacktestCase,
  type HistoricalBacktestResult,
  type HistoricalBacktestSummary,
} from "../Equipment/equipmentHistoricalBacktestService";

export type HistoricalValidationScope = "all" | string;
export type HistoricalValidationView =
  | "breakdowns"
  | "interventions"
  | "false-positives"
  | "spares";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasClassification(item: HistoricalBacktestCase, code: string): boolean {
  return item.classifications.some((classification) => classification.code === code);
}

function median(values: number[]): number | null {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return null;

  const midpoint = Math.floor(finite.length / 2);
  if (finite.length % 2 === 1) return finite[midpoint] ?? null;

  const left = finite[midpoint - 1];
  const right = finite[midpoint];
  if (left == null || right == null) return null;
  return (left + right) / 2;
}

function oneDecimal(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10) / 10;
}

export function summariseHistoricalValidationCases(
  cases: HistoricalBacktestCase[],
): HistoricalBacktestSummary {
  const breakdownCount = cases.filter((item) => Boolean(item.timeframe.failureAt)).length;
  const elevatedRiskPrecededBreakdownCount = cases.filter((item) =>
    hasClassification(item, "elevated_risk_preceded_breakdown"),
  ).length;
  const interventionPlausiblyRelevantCount = cases.filter((item) =>
    hasClassification(item, "intervention_plausibly_relevant"),
  ).length;
  const preFailureStockoutCount = cases.filter((item) =>
    hasClassification(item, "stockout_preceded_breakdown"),
  ).length;
  const stockoutExtendedRecoveryCount = cases.filter((item) =>
    hasClassification(item, "stockout_materially_extended_recovery"),
  ).length;
  const stockoutConstrainedPreventiveInterventionCount = cases.filter((item) =>
    hasClassification(item, "stockout_constrained_preventive_intervention"),
  ).length;
  const successfulInterventionCount = cases.filter((item) =>
    hasClassification(item, "successful_intervention"),
  ).length;
  const falsePositiveCount = cases.filter((item) =>
    hasClassification(item, "false_positive"),
  ).length;
  const preventabilitySupportedCount = cases.filter((item) =>
    hasClassification(item, "preventability_supported"),
  ).length;

  const warningMedian = median(cases.map((item) => item.timeframe.warningLeadDays));
  const materialWaitMedian = median(
    cases
      .map((item) => item.stock.verifiedMaterialWaitMinutes)
      .filter((value): value is number => value != null),
  );

  const unmitigatedPopulation = breakdownCount + falsePositiveCount;
  const riskModelVersions = Array.from(
    new Set(cases.map((item) => item.provenance.riskModelVersion).filter(Boolean)),
  );
  const evidenceProvenance = Array.from(
    new Set(cases.map((item) => item.provenance.evidenceProvenance).filter(Boolean)),
  );

  return {
    scenarioCount: cases.length,
    breakdownCount,
    elevatedRiskPrecededBreakdownCount,
    interventionPlausiblyRelevantCount,
    preFailureStockoutCount,
    stockoutExtendedRecoveryCount,
    stockoutConstrainedPreventiveInterventionCount,
    successfulInterventionCount,
    falsePositiveCount,
    preventabilitySupportedCount,
    evidenceSupportedPreventabilityRate:
      breakdownCount > 0
        ? oneDecimal((100 * preventabilitySupportedCount) / breakdownCount)
        : null,
    unmitigatedWarningBreakdownRate:
      unmitigatedPopulation > 0
        ? oneDecimal((100 * breakdownCount) / unmitigatedPopulation)
        : null,
    medianWarningDays: oneDecimal(warningMedian),
    medianVerifiedMaterialWaitMinutes:
      materialWaitMedian == null ? null : Math.round(materialWaitMedian),
    riskModelVersions,
    evidenceProvenance,
    preventabilityStatus: "not_established_from_sequence_alone",
  };
}

export function scopeHistoricalValidation(
  result: HistoricalBacktestResult,
  scope: HistoricalValidationScope,
): HistoricalBacktestResult {
  const cases =
    scope === "all"
      ? result.cases
      : result.cases.filter((item) => item.equipment.area === scope);

  return {
    ...result,
    status: cases.length > 0 ? "ready" : "empty",
    summary: summariseHistoricalValidationCases(cases),
    cases,
  };
}

export function getHistoricalValidationAreas(
  result: HistoricalBacktestResult,
): Array<{ area: string; scenarioCount: number }> {
  const counts = new Map<string, number>();

  result.cases.forEach((item) => {
    const area = item.equipment.area.trim() || "Unassigned";
    counts.set(area, (counts.get(area) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([area, scenarioCount]) => ({ area, scenarioCount }))
    .sort(
      (left, right) =>
        right.scenarioCount - left.scenarioCount || left.area.localeCompare(right.area),
    );
}

export function filterHistoricalValidationCases(
  cases: HistoricalBacktestCase[],
  view: HistoricalValidationView,
): HistoricalBacktestCase[] {
  if (view === "interventions") {
    return cases.filter((item) => hasClassification(item, "successful_intervention"));
  }

  if (view === "false-positives") {
    return cases.filter((item) => hasClassification(item, "false_positive"));
  }

  if (view === "spares") {
    return cases.filter(
      (item) =>
        item.stock.availableQuantity === 0 ||
        hasClassification(item, "stockout_preceded_breakdown") ||
        hasClassification(item, "stockout_materially_extended_recovery") ||
        hasClassification(item, "stockout_constrained_preventive_intervention"),
    );
  }

  return cases.filter((item) => Boolean(item.timeframe.failureAt));
}

export async function loadHistoricalValidation(
  siteId: string,
): Promise<HistoricalBacktestResult> {
  const { data, error } = await supabase.rpc("vorta_get_historical_backtest", {
    p_site_id: siteId,
    p_equipment_id: null,
    p_dataset_version: VOR_069_BACKTEST_DATASET_VERSION,
    p_validation_days: VOR_069_BACKTEST_VALIDATION_DAYS,
  });

  if (error) {
    throw new Error(`Historical validation unavailable: ${error.message}`);
  }

  if (!isRecord(data)) {
    throw new Error("Historical validation returned no governed payload.");
  }

  if (data.datasetVersion !== VOR_069_BACKTEST_DATASET_VERSION) {
    throw new Error("Historical validation dataset version is not approved.");
  }

  if (data.siteId !== siteId) {
    throw new Error("Historical validation returned evidence for the wrong site.");
  }

  if (data.status !== "ready" && data.status !== "empty") {
    throw new Error("Historical validation status is malformed.");
  }

  if (!Array.isArray(data.cases) || !isRecord(data.summary) || !isRecord(data.methodology)) {
    throw new Error("Historical validation payload is incomplete.");
  }

  return data as unknown as HistoricalBacktestResult;
}
