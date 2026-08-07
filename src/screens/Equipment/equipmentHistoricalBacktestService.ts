import { supabase } from "../../lib/supabaseClient";

export const VOR_069_BACKTEST_DATASET_VERSION =
  "vor069-historical-backtest-v1" as const;
export const VOR_069_BACKTEST_VALIDATION_DAYS = 45 as const;

export interface HistoricalBacktestSummary {
  scenarioCount: number;
  breakdownCount: number;
  elevatedRiskPrecededBreakdownCount: number;
  interventionPlausiblyRelevantCount: number;
  preFailureStockoutCount: number;
  stockoutExtendedRecoveryCount: number;
  stockoutConstrainedPreventiveInterventionCount: number;
  successfulInterventionCount: number;
  falsePositiveCount: number;
  preventabilitySupportedCount: number;
  evidenceSupportedPreventabilityRate: number | null;
  unmitigatedWarningBreakdownRate: number | null;
  medianWarningDays: number | null;
  medianVerifiedMaterialWaitMinutes: number | null;
  riskModelVersions: string[];
  evidenceProvenance: string[];
  preventabilityStatus: string;
}

export interface HistoricalBacktestClassification {
  code: string;
  label: string;
  evidenceLevel: string;
  confidence: number;
}

export interface HistoricalBacktestCase {
  scenarioKey: string;
  scenarioType: string;
  equipment: {
    id: string;
    code: string;
    name: string;
    area: string;
  };
  timeframe: {
    warningStartAt: string;
    interventionAt: string | null;
    failureAt: string | null;
    validationWindowEnd: string;
    warningLeadHours: number;
    warningLeadDays: number;
  };
  risk: {
    warningCapturedAt: string | null;
    warningScore: number | null;
    warningLevel: string | null;
    preOutcomeCapturedAt: string | null;
    preOutcomeScore: number | null;
    preOutcomeLevel: string | null;
    postInterventionCapturedAt: string | null;
    postInterventionScore: number | null;
    postInterventionLevel: string | null;
    primaryDriver: string | null;
    drivers: Record<string, number | null>;
    warningCounts: Record<string, number | null>;
    recommendedActionAtTime: string;
    observedPostInterventionReduction: number | null;
    modelVersion: string | null;
  };
  stock: {
    materialNumber: string | null;
    description: string | null;
    snapshotAt: string | null;
    availableQuantity: number | null;
    minimumQuantity: number | null;
    targetQuantity: number | null;
    status: string | null;
    stockoutStartAt: string | null;
    replenishedAt: string | null;
    reservationNumber: string | null;
    reservationItem: string | null;
    requiredQuantity: number | null;
    reservedQuantity: number | null;
    withdrawnQuantity: number | null;
    reservationStatus: string | null;
    materialDocumentNumber: string | null;
    movementDocumentItem: string | null;
    movementType: string | null;
    movementAt: string | null;
    movementQuantity: number | null;
    verifiedMaterialWaitMinutes: number | null;
  };
  workOrder: {
    id: string;
    number: string;
    description: string;
    type: string;
    priority: string;
    outcome: string;
    actualStartAt: string | null;
    actualFinishAt: string | null;
    downtimeMinutes: number | null;
  } | null;
  validation: {
    windowDays: number;
    subsequentBreakdowns: number;
    noBreakdownInWindow: boolean;
  };
  classifications: HistoricalBacktestClassification[];
  confidence: number;
  evidenceRecords: Record<string, unknown>;
  provenance: {
    evidenceProvenance: string;
    datasetVersion: string;
    riskModelVersion: string;
    syntheticDemo: boolean;
  };
  limitations: string[];
}

export interface HistoricalBacktestResult {
  status: "ready" | "empty";
  siteId: string;
  equipmentId: string | null;
  datasetVersion: string;
  validationWindowDays: number;
  generatedAt: string;
  summary: HistoricalBacktestSummary;
  cases: HistoricalBacktestCase[];
  methodology: {
    riskThreshold: number;
    riskSequence: string;
    stockSequence: string;
    recoveryImpact: string;
    falsePositiveRule: string;
    causationBoundary: string;
  };
}

export interface EquipmentHistoricalBacktestBundle {
  equipment: HistoricalBacktestResult;
  site: HistoricalBacktestResult;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseSummary(value: unknown): HistoricalBacktestSummary {
  if (!isRecord(value)) {
    throw new Error("Historical backtest summary is missing or malformed.");
  }

  return {
    scenarioCount: asNumber(value.scenarioCount),
    breakdownCount: asNumber(value.breakdownCount),
    elevatedRiskPrecededBreakdownCount: asNumber(
      value.elevatedRiskPrecededBreakdownCount,
    ),
    interventionPlausiblyRelevantCount: asNumber(
      value.interventionPlausiblyRelevantCount,
    ),
    preFailureStockoutCount: asNumber(value.preFailureStockoutCount),
    stockoutExtendedRecoveryCount: asNumber(
      value.stockoutExtendedRecoveryCount,
    ),
    stockoutConstrainedPreventiveInterventionCount: asNumber(
      value.stockoutConstrainedPreventiveInterventionCount,
    ),
    successfulInterventionCount: asNumber(value.successfulInterventionCount),
    falsePositiveCount: asNumber(value.falsePositiveCount),
    preventabilitySupportedCount: asNumber(value.preventabilitySupportedCount),
    evidenceSupportedPreventabilityRate: asNullableNumber(
      value.evidenceSupportedPreventabilityRate,
    ),
    unmitigatedWarningBreakdownRate: asNullableNumber(
      value.unmitigatedWarningBreakdownRate,
    ),
    medianWarningDays: asNullableNumber(value.medianWarningDays),
    medianVerifiedMaterialWaitMinutes: asNullableNumber(
      value.medianVerifiedMaterialWaitMinutes,
    ),
    riskModelVersions: asStringArray(value.riskModelVersions),
    evidenceProvenance: asStringArray(value.evidenceProvenance),
    preventabilityStatus: asString(value.preventabilityStatus),
  };
}

function parseClassification(value: unknown): HistoricalBacktestClassification {
  if (!isRecord(value)) {
    throw new Error("Historical backtest classification is malformed.");
  }
  return {
    code: asString(value.code),
    label: asString(value.label),
    evidenceLevel: asString(value.evidenceLevel),
    confidence: asNumber(value.confidence),
  };
}

function parseCase(value: unknown): HistoricalBacktestCase {
  if (!isRecord(value)) {
    throw new Error("Historical backtest case is malformed.");
  }
  const equipment = isRecord(value.equipment) ? value.equipment : {};
  const timeframe = isRecord(value.timeframe) ? value.timeframe : {};
  const risk = isRecord(value.risk) ? value.risk : {};
  const stock = isRecord(value.stock) ? value.stock : {};
  const validation = isRecord(value.validation) ? value.validation : {};
  const provenance = isRecord(value.provenance) ? value.provenance : {};
  const rawWorkOrder = isRecord(value.workOrder) ? value.workOrder : null;

  const equipmentId = asString(equipment.id);
  const scenarioKey = asString(value.scenarioKey);
  if (!equipmentId || !scenarioKey) {
    throw new Error("Historical backtest case is missing its evidence identity.");
  }

  return {
    scenarioKey,
    scenarioType: asString(value.scenarioType),
    equipment: {
      id: equipmentId,
      code: asString(equipment.code),
      name: asString(equipment.name),
      area: asString(equipment.area),
    },
    timeframe: {
      warningStartAt: asString(timeframe.warningStartAt),
      interventionAt: asNullableString(timeframe.interventionAt),
      failureAt: asNullableString(timeframe.failureAt),
      validationWindowEnd: asString(timeframe.validationWindowEnd),
      warningLeadHours: asNumber(timeframe.warningLeadHours),
      warningLeadDays: asNumber(timeframe.warningLeadDays),
    },
    risk: {
      warningCapturedAt: asNullableString(risk.warningCapturedAt),
      warningScore: asNullableNumber(risk.warningScore),
      warningLevel: asNullableString(risk.warningLevel),
      preOutcomeCapturedAt: asNullableString(risk.preOutcomeCapturedAt),
      preOutcomeScore: asNullableNumber(risk.preOutcomeScore),
      preOutcomeLevel: asNullableString(risk.preOutcomeLevel),
      postInterventionCapturedAt: asNullableString(
        risk.postInterventionCapturedAt,
      ),
      postInterventionScore: asNullableNumber(risk.postInterventionScore),
      postInterventionLevel: asNullableString(risk.postInterventionLevel),
      primaryDriver: asNullableString(risk.primaryDriver),
      drivers: isRecord(risk.drivers)
        ? Object.fromEntries(
            Object.entries(risk.drivers).map(([key, item]) => [
              key,
              asNullableNumber(item),
            ]),
          )
        : {},
      warningCounts: isRecord(risk.warningCounts)
        ? Object.fromEntries(
            Object.entries(risk.warningCounts).map(([key, item]) => [
              key,
              asNullableNumber(item),
            ]),
          )
        : {},
      recommendedActionAtTime: asString(risk.recommendedActionAtTime),
      observedPostInterventionReduction: asNullableNumber(
        risk.observedPostInterventionReduction,
      ),
      modelVersion: asNullableString(risk.modelVersion),
    },
    stock: {
      materialNumber: asNullableString(stock.materialNumber),
      description: asNullableString(stock.description),
      snapshotAt: asNullableString(stock.snapshotAt),
      availableQuantity: asNullableNumber(stock.availableQuantity),
      minimumQuantity: asNullableNumber(stock.minimumQuantity),
      targetQuantity: asNullableNumber(stock.targetQuantity),
      status: asNullableString(stock.status),
      stockoutStartAt: asNullableString(stock.stockoutStartAt),
      replenishedAt: asNullableString(stock.replenishedAt),
      reservationNumber: asNullableString(stock.reservationNumber),
      reservationItem: asNullableString(stock.reservationItem),
      requiredQuantity: asNullableNumber(stock.requiredQuantity),
      reservedQuantity: asNullableNumber(stock.reservedQuantity),
      withdrawnQuantity: asNullableNumber(stock.withdrawnQuantity),
      reservationStatus: asNullableString(stock.reservationStatus),
      materialDocumentNumber: asNullableString(stock.materialDocumentNumber),
      movementDocumentItem: asNullableString(stock.movementDocumentItem),
      movementType: asNullableString(stock.movementType),
      movementAt: asNullableString(stock.movementAt),
      movementQuantity: asNullableNumber(stock.movementQuantity),
      verifiedMaterialWaitMinutes: asNullableNumber(
        stock.verifiedMaterialWaitMinutes,
      ),
    },
    workOrder: rawWorkOrder
      ? {
          id: asString(rawWorkOrder.id),
          number: asString(rawWorkOrder.number),
          description: asString(rawWorkOrder.description),
          type: asString(rawWorkOrder.type),
          priority: asString(rawWorkOrder.priority),
          outcome: asString(rawWorkOrder.outcome),
          actualStartAt: asNullableString(rawWorkOrder.actualStartAt),
          actualFinishAt: asNullableString(rawWorkOrder.actualFinishAt),
          downtimeMinutes: asNullableNumber(rawWorkOrder.downtimeMinutes),
        }
      : null,
    validation: {
      windowDays: asNumber(validation.windowDays),
      subsequentBreakdowns: asNumber(validation.subsequentBreakdowns),
      noBreakdownInWindow: validation.noBreakdownInWindow === true,
    },
    classifications: Array.isArray(value.classifications)
      ? value.classifications.map(parseClassification)
      : [],
    confidence: asNumber(value.confidence),
    evidenceRecords: isRecord(value.evidenceRecords)
      ? value.evidenceRecords
      : {},
    provenance: {
      evidenceProvenance: asString(provenance.evidenceProvenance),
      datasetVersion: asString(provenance.datasetVersion),
      riskModelVersion: asString(provenance.riskModelVersion),
      syntheticDemo: provenance.syntheticDemo === true,
    },
    limitations: asStringArray(value.limitations),
  };
}

function parseBacktestResult(value: unknown): HistoricalBacktestResult {
  if (!isRecord(value)) {
    throw new Error("Historical backtest returned no governed payload.");
  }

  const datasetVersion = asString(value.datasetVersion);
  if (datasetVersion !== VOR_069_BACKTEST_DATASET_VERSION) {
    throw new Error("Historical backtest dataset version is not approved.");
  }

  const status = value.status === "ready" ? "ready" : value.status === "empty" ? "empty" : null;
  if (!status) {
    throw new Error("Historical backtest status is malformed.");
  }

  if (!Array.isArray(value.cases)) {
    throw new Error("Historical backtest cases are missing.");
  }

  const methodology = isRecord(value.methodology) ? value.methodology : {};
  return {
    status,
    siteId: asString(value.siteId),
    equipmentId: asNullableString(value.equipmentId),
    datasetVersion,
    validationWindowDays: asNumber(value.validationWindowDays),
    generatedAt: asString(value.generatedAt),
    summary: parseSummary(value.summary),
    cases: value.cases.map(parseCase),
    methodology: {
      riskThreshold: asNumber(methodology.riskThreshold),
      riskSequence: asString(methodology.riskSequence),
      stockSequence: asString(methodology.stockSequence),
      recoveryImpact: asString(methodology.recoveryImpact),
      falsePositiveRule: asString(methodology.falsePositiveRule),
      causationBoundary: asString(methodology.causationBoundary),
    },
  };
}

async function resolveAuthorisedSiteId(equipmentId: string): Promise<string> {
  const { data, error } = await supabase
    .from("equipment_assets")
    .select("site_id")
    .eq("id", equipmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve authorised equipment site: ${error.message}`);
  }
  if (!data?.site_id) {
    throw new Error("Equipment is not available in the authorised site.");
  }
  return String(data.site_id);
}

async function getHistoricalBacktest(
  siteId: string,
  equipmentId: string | null,
): Promise<HistoricalBacktestResult> {
  const { data, error } = await supabase.rpc("vorta_get_historical_backtest", {
    p_site_id: siteId,
    p_equipment_id: equipmentId,
    p_dataset_version: VOR_069_BACKTEST_DATASET_VERSION,
    p_validation_days: VOR_069_BACKTEST_VALIDATION_DAYS,
  });

  if (error) {
    throw new Error(`Historical backtest unavailable: ${error.message}`);
  }
  return parseBacktestResult(data);
}

export async function getEquipmentHistoricalBacktestBundle(
  equipmentId: string,
): Promise<EquipmentHistoricalBacktestBundle> {
  const siteId = await resolveAuthorisedSiteId(equipmentId);
  const [equipment, site] = await Promise.all([
    getHistoricalBacktest(siteId, equipmentId),
    getHistoricalBacktest(siteId, null),
  ]);
  return { equipment, site };
}
