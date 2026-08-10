import type { Context } from "@netlify/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import coreHandler from "./runtime-equipment-fallback.mjs";
import { authenticateAskVortaRequest } from "./authenticated-context.mjs";
import type { AskVortaRequest, JsonRecord } from "./contracts.mjs";
import { jsonResponse } from "./request-context.mjs";
import {
  handleSparePhotoIdentification,
  shouldHandleSparePhotoPayload,
} from "./spare-photo-identification.mjs";

export const ASK_VORTA_BACKTEST_REVISION =
  "vor-069-historical-backtest-intelligence-v1";

const DATASET_VERSION = "vor069-historical-backtest-v1";
const VALIDATION_DAYS = 45;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BACKTEST_PATTERN =
  /\b(?:backtest|historical risk|risk history|before (?:a |the )?breakdown|preced(?:e|ed|ing) (?:a |the )?breakdown|warning before failure|risk before failure|stock[- ]?out.*breakdown|breakdown.*stock[- ]?out|spare.*recovery|recovery.*spare|material.*downtime|false positive|successful intervention|predict(?:ed|ion)?.*breakdown|breakdown.*predict)\b/i;

type BacktestSummary = {
  scenarioCount: number;
  breakdownCount: number;
  elevatedRiskPrecededBreakdownCount: number;
  interventionPlausiblyRelevantCount: number;
  preFailureStockoutCount: number;
  stockoutExtendedRecoveryCount: number;
  successfulInterventionCount: number;
  falsePositiveCount: number;
  preventabilitySupportedCount: number;
  evidenceSupportedPreventabilityRate: number | null;
  unmitigatedWarningBreakdownRate: number | null;
  medianWarningDays: number | null;
  medianVerifiedMaterialWaitMinutes: number | null;
  preventabilityStatus: string;
};

type BacktestCase = JsonRecord & {
  scenarioKey: string;
  scenarioType: string;
  equipment: JsonRecord;
  timeframe: JsonRecord;
  risk: JsonRecord;
  stock: JsonRecord;
  workOrder: JsonRecord | null;
  validation: JsonRecord;
  classifications: JsonRecord[];
  confidence: number;
  provenance: JsonRecord;
  limitations: string[];
};

type BacktestPayload = {
  status: "ready" | "empty";
  siteId: string;
  equipmentId: string | null;
  datasetVersion: string;
  validationWindowDays: number;
  generatedAt: string;
  summary: BacktestSummary;
  cases: BacktestCase[];
  methodology: JsonRecord;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integer(value: unknown): number {
  const numeric = numberValue(value);
  return numeric == null ? 0 : Math.round(numeric);
}

function parsePayload(value: unknown): BacktestPayload | null {
  if (!isRecord(value)) return null;
  if (value.datasetVersion !== DATASET_VERSION) return null;
  if (value.status !== "ready" && value.status !== "empty") return null;
  if (!isRecord(value.summary) || !Array.isArray(value.cases)) return null;

  const summary = value.summary;
  return {
    status: value.status,
    siteId: text(value.siteId),
    equipmentId: text(value.equipmentId) || null,
    datasetVersion: DATASET_VERSION,
    validationWindowDays: integer(value.validationWindowDays),
    generatedAt: text(value.generatedAt),
    summary: {
      scenarioCount: integer(summary.scenarioCount),
      breakdownCount: integer(summary.breakdownCount),
      elevatedRiskPrecededBreakdownCount: integer(
        summary.elevatedRiskPrecededBreakdownCount,
      ),
      interventionPlausiblyRelevantCount: integer(
        summary.interventionPlausiblyRelevantCount,
      ),
      preFailureStockoutCount: integer(summary.preFailureStockoutCount),
      stockoutExtendedRecoveryCount: integer(
        summary.stockoutExtendedRecoveryCount,
      ),
      successfulInterventionCount: integer(summary.successfulInterventionCount),
      falsePositiveCount: integer(summary.falsePositiveCount),
      preventabilitySupportedCount: integer(summary.preventabilitySupportedCount),
      evidenceSupportedPreventabilityRate: numberValue(
        summary.evidenceSupportedPreventabilityRate,
      ),
      unmitigatedWarningBreakdownRate: numberValue(
        summary.unmitigatedWarningBreakdownRate,
      ),
      medianWarningDays: numberValue(summary.medianWarningDays),
      medianVerifiedMaterialWaitMinutes: numberValue(
        summary.medianVerifiedMaterialWaitMinutes,
      ),
      preventabilityStatus: text(summary.preventabilityStatus),
    },
    cases: value.cases
      .filter(isRecord)
      .map((item) => ({
        ...item,
        scenarioKey: text(item.scenarioKey),
        scenarioType: text(item.scenarioType),
        equipment: isRecord(item.equipment) ? item.equipment : {},
        timeframe: isRecord(item.timeframe) ? item.timeframe : {},
        risk: isRecord(item.risk) ? item.risk : {},
        stock: isRecord(item.stock) ? item.stock : {},
        workOrder: isRecord(item.workOrder) ? item.workOrder : null,
        validation: isRecord(item.validation) ? item.validation : {},
        classifications: Array.isArray(item.classifications)
          ? item.classifications.filter(isRecord)
          : [],
        confidence: integer(item.confidence),
        provenance: isRecord(item.provenance) ? item.provenance : {},
        limitations: Array.isArray(item.limitations)
          ? item.limitations.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [],
      })),
    methodology: isRecord(value.methodology) ? value.methodology : {},
  };
}

function routeEquipmentId(request: AskVortaRequest): string | null {
  const pathMatch = request.pageContext.path.match(
    /\/equipment\/([0-9a-f-]{36})(?:\/|$)/i,
  )?.[1];
  if (pathMatch && UUID_PATTERN.test(pathMatch)) return pathMatch;

  const activeId = request.conversationContext?.activeEquipment?.id?.trim();
  if (activeId && UUID_PATTERN.test(activeId)) return activeId;
  return null;
}

async function resolveQuestionEquipmentId(
  request: AskVortaRequest,
  supabase: SupabaseClient,
): Promise<string | null> {
  const routed = routeEquipmentId(request);
  if (routed) return routed;

  const { data, error } = await supabase
    .from("equipment_assets")
    .select("id,equipment_code,name")
    .eq("site_id", request.siteId)
    .limit(150);
  if (error || !Array.isArray(data)) return null;

  const question = request.question.toLowerCase();
  const matches = data
    .map((row) => {
      const code = text(row.equipment_code).toLowerCase();
      const name = text(row.name).toLowerCase();
      let score = 0;
      if (code && question.includes(code)) score += 100;
      if (name && question.includes(name)) score += 80;
      const significantNameTokens = name
        .split(/\s+/)
        .filter((token) => token.length >= 4 && question.includes(token));
      score += significantNameTokens.length * 8;
      return { id: text(row.id), score };
    })
    .filter((item) => item.id && item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (matches.length === 0) return null;
  if (matches.length > 1 && matches[0].score === matches[1].score) return null;
  return matches[0].id;
}

function formatMinutes(value: number | null): string {
  if (value == null) return "not evidenced";
  const rounded = Math.max(0, Math.round(value));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes} minutes`;
  return minutes ? `${hours}h ${minutes}m` : `${hours} hours`;
}

function classificationLabels(item: BacktestCase): string[] {
  return item.classifications
    .map((classification) => {
      const label = text(classification.label);
      const confidence = integer(classification.confidence);
      return label ? `${label}${confidence ? ` (${confidence}%)` : ""}` : "";
    })
    .filter(Boolean);
}

function evidenceLinks(item: BacktestCase): JsonRecord[] {
  const id = text(item.equipment.id);
  if (!id) return [];

  const links: JsonRecord[] = [
    {
      label: `${text(item.equipment.code) || "Equipment"} history evidence`,
      path: `/equipment/${id}/history`,
      recordType: "equipment_history",
    },
  ];
  const wo = text(item.workOrder?.number);
  if (wo) {
    links.push({
      label: `Work order ${wo}`,
      path: `/equipment/${id}/work-orders?workOrder=${encodeURIComponent(wo)}`,
      recordType: "work_order",
    });
  }
  const materialNumber = text(item.stock.materialNumber);
  if (materialNumber) {
    links.push({
      label: `Spare ${materialNumber}`,
      path: `/equipment/${id}/spares`,
      recordType: "spare",
    });
  }
  return links;
}

function equipmentAnswer(responseId: string, payload: BacktestPayload): JsonRecord {
  const item = payload.cases[0];
  if (!item) {
    return {
      responseId,
      directAnswer:
        "Vorta has no governed historical backtest case for this equipment in the selected validation dataset. I will not invent an asset-specific failure, intervention or stock event.",
      decisionSummary: [
        { label: "Equipment cases", value: "0" },
        {
          label: "Site validation cases",
          value: String(payload.summary.scenarioCount),
        },
      ],
      evidence: [],
      findings: [],
      coverOptions: [],
      recommendedActions: [
        "Use the site-level historical validation summary or select equipment with a governed VOR-069 case.",
      ],
      actionPlan: [],
      followUpQuestions: [],
      sources: ["vorta_get_historical_backtest"],
      missingData: ["No governed VOR-069 case is linked to this equipment."],
      confidence: 95,
      intentLabel: "historical_backtest",
      toolsUsed: ["vorta_get_historical_backtest"],
      evidenceLinks: [],
      evidenceGeneratedAt: payload.generatedAt,
    };
  }

  const code = text(item.equipment.code) || "the equipment";
  const warning = numberValue(item.risk.warningScore);
  const preOutcome = numberValue(item.risk.preOutcomeScore);
  const post = numberValue(item.risk.postInterventionScore);
  const warningDays = numberValue(item.timeframe.warningLeadDays);
  const material = text(item.stock.materialNumber);
  const available = numberValue(item.stock.availableQuantity);
  const wait = numberValue(item.stock.verifiedMaterialWaitMinutes);
  const downtime = numberValue(item.workOrder?.downtimeMinutes);
  const wo = text(item.workOrder?.number);
  const reservation = text(item.stock.reservationNumber);
  const materialDocument = text(item.stock.materialDocumentNumber);
  const primaryDriver = text(item.risk.primaryDriver) || "the highest verified driver";
  const reduction = numberValue(item.risk.observedPostInterventionReduction);
  const classificationText = classificationLabels(item);

  let directAnswer: string;
  if (item.scenarioType === "stockout_extended_recovery") {
    directAnswer =
      `${code} had elevated historical risk ${warning ?? "—"}/100, rising to ${preOutcome ?? "—"}/100 before the recorded breakdown, with a ${warningDays ?? "—"}-day warning period. ` +
      `The linked critical spare ${material || "material"} was at ${available ?? "—"} available at failure. ` +
      `${reservation ? `Reservation ${reservation}` : "A linked reservation"}${materialDocument ? ` and 261 material document ${materialDocument}` : ""} show material issue ${formatMinutes(wait)} after failure; the linked work order${wo ? ` ${wo}` : ""} records ${formatMinutes(downtime)} downtime. ` +
      "This supports a material-related recovery delay. It does not prove the stock-out caused the breakdown, and the evidence does not establish that an earlier intervention was preventative.";
  } else if (item.scenarioType === "successful_intervention") {
    directAnswer =
      `${code} moved from ${warning ?? "—"}/100 historical risk to ${preOutcome ?? "—"}/100 before intervention. ` +
      `After the recorded intervention, risk fell to ${post ?? "—"}/100${reduction != null ? `, an observed ${reduction}-point reduction` : ""}, and no breakdown was recorded in the ${payload.validationWindowDays}-day validation window. ` +
      "That is an observed sequence, not proof that the intervention prevented a specific future failure.";
  } else if (item.scenarioType === "false_positive") {
    directAnswer =
      `${code} carried elevated historical risk ${warning ?? "—"}/100, driven mainly by ${primaryDriver}, but no breakdown followed in the ${payload.validationWindowDays}-day validation window. ` +
      "Vorta retains this as a false-positive validation case rather than hiding it, so the backtest is not hindsight-only.";
  } else {
    directAnswer =
      `${code} had elevated historical risk ${warning ?? "—"}/100, rising to ${preOutcome ?? "—"}/100 before the recorded breakdown, with a ${warningDays ?? "—"}-day warning period. ` +
      `The main verified driver was ${primaryDriver}. This establishes that elevated risk preceded the failure, but timing alone does not establish causation or preventability.`;
  }

  return {
    responseId,
    directAnswer,
    decisionSummary: [
      { label: "Equipment", value: code },
      {
        label: "Historical risk",
        value: `${warning ?? "—"} → ${preOutcome ?? "—"}/100`,
      },
      {
        label: "Warning period",
        value: `${warningDays ?? "—"} days`,
      },
      {
        label: "Evidence confidence",
        value: `${item.confidence}%`,
      },
      material
        ? {
            label: "Critical spare",
            value: `${material} · ${available ?? "—"} available`,
          }
        : null,
    ].filter(Boolean),
    evidence: [
      `Scenario ${item.scenarioKey}`,
      ...classificationText,
      wo ? `Work order ${wo}` : "",
      reservation ? `Reservation ${reservation}` : "",
      materialDocument ? `261 material document ${materialDocument}` : "",
    ].filter(Boolean),
    findings: item.classifications.map((classification) => ({
      category: "historical_backtest",
      severity:
        text(classification.evidenceLevel) === "supported_impact" ? "high" : "info",
      title: text(classification.label),
      detail: `${text(classification.evidenceLevel)} · ${integer(classification.confidence)}% confidence`,
    })),
    coverOptions: [],
    recommendedActions: [text(item.risk.recommendedActionAtTime)].filter(Boolean),
    actionPlan: [],
    followUpQuestions: [],
    sources: [
      "equipment_risk_event_history",
      "site_material_stock_history",
      ...(wo ? ["work_orders"] : []),
      ...(reservation ? ["work_order_material_reservations"] : []),
      ...(materialDocument ? ["work_order_goods_movements"] : []),
    ],
    missingData:
      item.scenarioType === "successful_intervention"
        ? ["Preventability is not established from sequence alone."]
        : [
            "Breakdown causation is not established from sequence alone.",
            "Preventability is not established from sequence alone.",
          ],
    confidence: item.confidence,
    intentLabel: "historical_backtest",
    toolsUsed: ["vorta_get_historical_backtest"],
    evidenceLinks: evidenceLinks(item),
    evidenceGeneratedAt: payload.generatedAt,
  };
}

function siteAnswer(responseId: string, payload: BacktestPayload): JsonRecord {
  const summary = payload.summary;
  const breakdownRate = summary.breakdownCount
    ? Math.round(
        (summary.elevatedRiskPrecededBreakdownCount / summary.breakdownCount) * 100,
      )
    : 0;
  const representativeLinks = payload.cases.slice(0, 4).flatMap(evidenceLinks);

  return {
    responseId,
    directAnswer:
      `Across the governed ${DATASET_VERSION} demonstration dataset, ${summary.elevatedRiskPrecededBreakdownCount} of ${summary.breakdownCount} controlled breakdown cases (${breakdownRate}%) had elevated Vorta risk beforehand, with a median warning of ${summary.medianWarningDays ?? "—"} days. ` +
      `${summary.preFailureStockoutCount} breakdown cases had a critical spare at zero before or at failure, and ${summary.stockoutExtendedRecoveryCount} have linked stock, reservation, 261 movement and repair timing that supports material-related recovery delay; median verified material wait was ${formatMinutes(summary.medianVerifiedMaterialWaitMinutes)}. ` +
      `The validation also retains ${summary.successfulInterventionCount} successful intervention cases and ${summary.falsePositiveCount} false positives. Preventability is not established from timing alone.`,
    decisionSummary: [
      {
        label: "Breakdowns preceded by elevated risk",
        value: `${summary.elevatedRiskPrecededBreakdownCount}/${summary.breakdownCount}`,
      },
      {
        label: "Median warning",
        value: `${summary.medianWarningDays ?? "—"} days`,
      },
      {
        label: "Pre-failure critical stock-outs",
        value: String(summary.preFailureStockoutCount),
      },
      {
        label: "Material-related recovery impacts",
        value: String(summary.stockoutExtendedRecoveryCount),
      },
      {
        label: "False positives retained",
        value: String(summary.falsePositiveCount),
      },
    ],
    evidence: [
      `${summary.scenarioCount} governed scenarios`,
      `${summary.successfulInterventionCount} successful interventions`,
      `${summary.falsePositiveCount} false positives`,
      `${formatMinutes(summary.medianVerifiedMaterialWaitMinutes)} median verified material wait`,
      `Preventability supported cases: ${summary.preventabilitySupportedCount}`,
    ],
    findings: [
      {
        category: "historical_backtest",
        severity: "high",
        title: "Elevated risk preceded all controlled breakdown cases",
        detail: `${summary.elevatedRiskPrecededBreakdownCount} of ${summary.breakdownCount} breakdown scenarios had timestamped elevated risk beforehand.`,
      },
      {
        category: "spares",
        severity: "high",
        title: "Critical spares affected verified recovery sequences",
        detail: `${summary.stockoutExtendedRecoveryCount} cases meet the strict stock + reservation + 261 + repair-timestamp recovery-impact rule.`,
      },
      {
        category: "validation",
        severity: "info",
        title: "False positives are retained",
        detail: `${summary.falsePositiveCount} elevated-risk cases had no subsequent breakdown in the ${payload.validationWindowDays}-day validation window.`,
      },
    ],
    coverOptions: [],
    recommendedActions: [
      "Use historical validation as supporting evidence for prioritisation, then confirm the current live risk, current spare position and SAP work status before acting.",
    ],
    actionPlan: [],
    followUpQuestions: [],
    sources: [
      "equipment_risk_event_history",
      "site_material_stock_history",
      "work_orders",
      "work_order_material_reservations",
      "work_order_goods_movements",
    ],
    missingData: [
      "This dataset is explicitly synthetic demonstration history, not imported SAP production evidence.",
      "Temporal sequence alone does not establish breakdown causation.",
      "Preventability is not established from sequence alone.",
    ],
    confidence: 94,
    intentLabel: "historical_backtest",
    toolsUsed: ["vorta_get_historical_backtest"],
    evidenceLinks: representativeLinks,
    evidenceGeneratedAt: payload.generatedAt,
  };
}

async function runBacktest(
  request: AskVortaRequest,
  supabase: SupabaseClient,
): Promise<BacktestPayload | null> {
  const equipmentId = await resolveQuestionEquipmentId(request, supabase);
  const { data, error } = await supabase.rpc("vorta_get_historical_backtest", {
    p_site_id: request.siteId,
    p_equipment_id: equipmentId,
    p_dataset_version: DATASET_VERSION,
    p_validation_days: VALIDATION_DAYS,
  });
  if (error) throw error;
  return parsePayload(data);
}

export default async function backtestHandler(
  req: Request,
  context: Context,
): Promise<Response> {
  const routeRequest = req.clone();
  const raw = await routeRequest.json().catch(() => null);
  if (shouldHandleSparePhotoPayload(raw)) {
    return handleSparePhotoIdentification(req, context);
  }
  const question = isRecord(raw) ? text(raw.question) : "";
  if (!question || !BACKTEST_PATTERN.test(question)) {
    return coreHandler(req, context);
  }

  const authenticated = await authenticateAskVortaRequest(req.clone());
  if (!authenticated.ok) return authenticated.response;
  const { request, supabase } = authenticated;

  try {
    const payload = await runBacktest(request, supabase);
    if (!payload) {
      return jsonResponse(
        {
          error:
            "Historical backtest evidence did not pass the governed response contract.",
        },
        503,
      );
    }

    const responseId = crypto.randomUUID();
    const answer = payload.equipmentId
      ? equipmentAnswer(responseId, payload)
      : siteAnswer(responseId, payload);
    return jsonResponse(answer);
  } catch (error) {
    console.error("Ask Vorta historical backtest failed:", error);
    return jsonResponse(
      {
        error:
          "Historical backtest evidence is temporarily unavailable. No synthetic substitute has been generated.",
      },
      503,
    );
  }
}
