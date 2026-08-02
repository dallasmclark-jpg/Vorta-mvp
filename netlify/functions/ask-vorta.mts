import type { Config, Context } from "@netlify/functions";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import type { ResponseInput, Tool } from "openai/resources/responses/responses";

type JsonRecord = Record<string, unknown>;

interface RequestHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface AskVortaRequest {
  question: string;
  role: string;
  siteId: string;
  history: RequestHistoryItem[];
  pageContext: {
    path: string;
    timezone: string;
  };
}

interface ToolResult {
  source: string;
  status: "ok" | "empty" | "unavailable";
  data?: unknown;
  message?: string;
}

const MODEL = "gpt-5.6-terra";
const PLANNER_MODEL = "gpt-5.6-luna";
const MAX_TOOL_ROUNDS = 8;
const MAX_TOOL_OUTPUT_CHARACTERS = 50_000;
const RATE_LIMIT_WINDOW_MINUTES = 5;
const RATE_LIMIT_REQUESTS = 12;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ROLES = new Set([
  "maintenance-manager",
  "maintenance-planner",
  "reliability-engineer",
  "engineer",
  "production-manager",
  "operator",
  "contractor",
]);

const EMPTY_PARAMETERS = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

const EQUIPMENT_ID_PARAMETERS = {
  type: "object",
  properties: {
    equipment_id: {
      type: "string",
      description: "The exact equipment UUID returned by get_equipment_risk.",
    },
  },
  required: ["equipment_id"],
  additionalProperties: false,
} as const;

const TOOLS: Tool[] = [
  {
    type: "function",
    name: "get_site_risk",
    description:
      "Get the authorised active site's current risk, area risks, labour risk and evidence freshness. Use this for site priorities and cross-area comparisons.",
    parameters: EMPTY_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_site_operational_snapshot",
    description:
      "Get a cross-domain maintenance-manager decision snapshot covering current site risk, open work backlog, critical spares, capability dependencies and the latest shift handover. Use this for broad or vague questions such as what should I worry about, what needs attention, what should we do first, what changed or what could stop the site.",
    parameters: EMPTY_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_risk",
    description:
      "Get current equipment risk records. Use an empty query for the risk-ranked site list, or a name, code or area to narrow it. This tool returns the exact equipment UUID required by equipment-specific tools.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Equipment name, equipment code or area. Use an empty string for all equipment.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_decision_pack",
    description:
      "Resolve one equipment item from a natural-language name or code and return a compact cross-domain decision pack with risk, work, PM/calibration, skills, spares, risk-reduction actions, history and documents. Use for broad equipment questions, unclear equipment follow-ups or questions that combine several asset evidence domains.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language equipment name, equipment code or unambiguous asset reference.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_shift_cover",
    description:
      "Get a dated Shift Cover decision pack: scheduled teams and engineers, recorded holiday/training/absence exceptions, rota-off engineers, required-skill risks, individually ranked competent cover candidates and a provisional three-person cover package with calculated gaps closed. Always use this for rota, leave, training, availability or shift-cover questions.",
    parameters: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Inclusive start date in YYYY-MM-DD format.",
        },
        end_date: {
          type: "string",
          description: "Inclusive end date in YYYY-MM-DD format, no more than 31 days after start_date.",
        },
      },
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_shift_handover",
    description:
      "Get the latest authenticated maintenance shift-handover evidence from SAP work confirmations, including work completed, temporary repairs, outstanding work, materials, contractor involvement and the next action.",
    parameters: EMPTY_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_contractor_availability",
    description:
      "Get site-scoped contractor engineers and their recorded availability, on-call/remote/onsite support status, disciplines and validated skills. Never infer availability when no current record exists.",
    parameters: EMPTY_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_site_work_backlog",
    description:
      "Get the site's current work-order backlog, including exact asset, order, priority, assignment, overdue state, dates and backlog summary. Use for broad questions about open, overdue, unassigned or priority maintenance work.",
    parameters: EMPTY_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_site_maintenance_plan",
    description:
      "Get PMs and calibrations due in a requested date range, including exact assets, assignments, duration, due status and procedures. Use with get_shift_cover for plan-achievability and resource questions.",
    parameters: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Inclusive start date in YYYY-MM-DD format.",
        },
        end_date: {
          type: "string",
          description: "Inclusive end date in YYYY-MM-DD format, no more than 31 days after start_date.",
        },
      },
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_site_spares_risk",
    description:
      "Get site-wide critical spares exposure, including exact asset, part code, available/minimum/target quantities, shortfall, status, lead time and storage location. Use for broad spares, stock-out, lead-time or maintenance-readiness questions.",
    parameters: EMPTY_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_site_capability_actions",
    description:
      "Get risk-ranked site capability actions with named primary SMEs, backup candidates, skill requirements, shift exposure, candidate readiness and recommended training or validation action. Use for broad skills, single-point dependency, succession and training-priority questions.",
    parameters: EMPTY_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_work",
    description:
      "Get an authorised asset's work orders and linked planned-maintenance information, including status, priority, due dates, assignments and overdue flags.",
    parameters: EQUIPMENT_ID_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_calibrations",
    description:
      "Get an authorised asset's calibration schedule, due status, result, assigned engineer and linked work order.",
    parameters: EQUIPMENT_ID_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_skills",
    description:
      "Get an authorised asset's required skills, qualified engineers, SMEs, backups, development paths and shift skill coverage.",
    parameters: EQUIPMENT_ID_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_spares",
    description:
      "Get an authorised asset's component and spare-parts stock, minimum and target quantities, criticality, lead time and storage information.",
    parameters: EQUIPMENT_ID_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_risk_actions",
    description:
      "Get the authorised asset's calculated risk-reduction work queue, including current and projected risk scores, action sequence and total expected reduction. Use when asked what changes would reduce an asset's risk.",
    parameters: EQUIPMENT_ID_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_history",
    description:
      "Get an authorised asset's factual maintenance and failure history. Use this for repeat faults, previous repairs, downtime and troubleshooting evidence.",
    parameters: EQUIPMENT_ID_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "get_equipment_documents",
    description:
      "Get an authorised asset's document register with titles, types, revisions, approval state and source links.",
    parameters: EQUIPMENT_ID_PARAMETERS,
    strict: true,
  },
  {
    type: "function",
    name: "search_maintenance_documents",
    description:
      "Search approved Vorta document text for an authorised asset. Use for technical questions, fault codes, procedures, manuals, drawings, sections and page references.",
    parameters: {
      type: "object",
      properties: {
        equipment_id: {
          type: "string",
          description: "The exact equipment UUID returned by get_equipment_risk.",
        },
        query: {
          type: "string",
          description: "The technical question, fault code, component or procedure to find.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 8,
          description: "Maximum number of evidence chunks to return.",
        },
      },
      required: ["equipment_id", "query", "limit"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    directAnswer: { type: "string" },
    decisionSummary: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
        },
        required: ["label", "value"],
        additionalProperties: false,
      },
    },
    evidence: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    findings: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["cover", "absence", "skill", "spare", "work", "history", "document", "risk", "data"],
          },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "info"],
          },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["category", "severity", "title", "detail"],
        additionalProperties: false,
      },
      maxItems: 10,
    },
    coverOptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          engineerNames: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
          shift: { type: "string" },
          reason: { type: "string" },
          skillsCovered: {
            type: "array",
            items: { type: "string" },
            maxItems: 6,
          },
          assetsProtected: {
            type: "array",
            items: { type: "string" },
            maxItems: 6,
          },
          projectedImpact: { type: "string" },
          remainingRisk: { type: "string" },
          caveat: { type: "string" },
        },
        required: [
          "engineerNames",
          "shift",
          "reason",
          "skillsCovered",
          "assetsProtected",
          "projectedImpact",
          "remainingRisk",
          "caveat",
        ],
        additionalProperties: false,
      },
      maxItems: 6,
    },
    recommendedActions: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
    actionPlan: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          priority: {
            type: "string",
            enum: ["now", "before_shift", "this_week", "planned"],
          },
          action: { type: "string" },
          owner: { type: "string" },
          expectedImpact: { type: "string" },
          verification: { type: "string" },
        },
        required: ["priority", "action", "owner", "expectedImpact", "verification"],
        additionalProperties: false,
      },
      maxItems: 6,
    },
    followUpQuestions: {
      type: "array",
      minItems: 2,
      items: { type: "string" },
      maxItems: 4,
    },
    sources: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    missingData: {
      type: "array",
      items: { type: "string" },
      maxItems: 5,
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 100,
    },
    intentLabel: { type: "string" },
    toolsUsed: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
  },
  required: [
    "directAnswer",
    "decisionSummary",
    "evidence",
    "findings",
    "coverOptions",
    "recommendedActions",
    "actionPlan",
    "followUpQuestions",
    "sources",
    "missingData",
    "confidence",
    "intentLabel",
    "toolsUsed",
  ],
  additionalProperties: false,
} as const;


const QUESTION_PLAN_SCHEMA = {
  type: "object",
  properties: {
    intentLabel: { type: "string" },
    decisionGoal: { type: "string" },
    scope: {
      type: "string",
      enum: [
        "site_priorities",
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
        "write_request",
        "out_of_scope",
      ],
    },
    shouldUseTools: { type: "boolean" },
    requiredTools: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    optionalTools: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    equipmentQuery: { type: "string" },
    startDate: { type: "string" },
    endDate: { type: "string" },
    ambiguity: { type: "string" },
    answerFocus: { type: "string" },
    verificationChecks: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 6,
    },
  },
  required: [
    "intentLabel",
    "decisionGoal",
    "scope",
    "shouldUseTools",
    "requiredTools",
    "optionalTools",
    "equipmentQuery",
    "startDate",
    "endDate",
    "ambiguity",
    "answerFocus",
    "verificationChecks",
  ],
  additionalProperties: false,
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function requiredText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximumLength ? text : null;
}

function parseRequest(value: unknown): AskVortaRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as JsonRecord;
  const question = requiredText(record.question, 2_000);
  const siteId = requiredText(record.siteId, 100);
  const rawRole = requiredText(record.role, 80);
  const role = rawRole && ALLOWED_ROLES.has(rawRole) ? rawRole : null;
  const rawHistory = Array.isArray(record.history) ? record.history.slice(-12) : [];
  const history: RequestHistoryItem[] = rawHistory.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as JsonRecord;
    const content = requiredText(row.content, 4_000);
    const historyRole = row.role === "user" || row.role === "assistant" ? row.role : null;
    return content && historyRole ? [{ role: historyRole, content }] : [];
  });
  const rawPageContext =
    record.pageContext && typeof record.pageContext === "object" && !Array.isArray(record.pageContext)
      ? (record.pageContext as JsonRecord)
      : {};

  if (!question || !siteId || !role) return null;

  return {
    question,
    siteId,
    role,
    history,
    pageContext: {
      path: requiredText(rawPageContext.path, 300) ?? "/",
      timezone: requiredText(rawPageContext.timezone, 100) ?? "Europe/London",
    },
  };
}

function parseArguments(value: string): JsonRecord {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be an object.");
  }
  return parsed as JsonRecord;
}

function trimToolResult(result: ToolResult): string {
  const serialised = JSON.stringify(result);
  if (serialised.length <= MAX_TOOL_OUTPUT_CHARACTERS) return serialised;
  return JSON.stringify({
    source: result.source,
    status: "unavailable",
    message: "The result was too large to analyse safely. Narrow the equipment or date range.",
  });
}

function compactShiftCoverData(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const brief = value as JsonRecord;
  const calendar = Array.isArray(brief.calendar)
    ? brief.calendar.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  const priorityShifts = calendar
    .filter(
      (shift) =>
        shift.coverageStatus !== "covered" ||
        numberValue(shift.missingSkillCount) > 0,
    )
    .sort(
      (first, second) =>
        Number(second.coverageStatus !== "covered") -
          Number(first.coverageStatus !== "covered") ||
        numberValue(second.labourRiskScore) -
          numberValue(first.labourRiskScore) ||
        numberValue(second.missingSkillCount) -
          numberValue(first.missingSkillCount),
    )
    .slice(0, 4);
  const priorityKeys = new Set(
    priorityShifts.map(
      (shift) => `${String(shift.shiftDate)}:${String(shift.shiftType)}`,
    ),
  );
  const forPriorityShift = (item: unknown): item is JsonRecord => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as JsonRecord;
    return priorityKeys.has(`${String(row.shiftDate)}:${String(row.shiftType)}`);
  };
  const skillRisks = Array.isArray(brief.skillRisks)
    ? brief.skillRisks.filter(forPriorityShift)
    : [];
  const topSkillRisks = priorityShifts.flatMap((shift) =>
    skillRisks
      .filter(
        (risk) =>
          risk.shiftDate === shift.shiftDate &&
          risk.shiftType === shift.shiftType,
      )
      .sort(
        (first, second) =>
          numberValue(first.qualifiedEngineerCount) -
            numberValue(second.qualifiedEngineerCount) ||
          String(first.skillName).localeCompare(String(second.skillName)),
      )
      .slice(0, 4),
  );

  return {
    ...brief,
    calendar,
    offRota: Array.isArray(brief.offRota)
      ? brief.offRota.filter(forPriorityShift)
      : [],
    coverCandidates: Array.isArray(brief.coverCandidates)
      ? brief.coverCandidates.filter(forPriorityShift)
      : [],
    coverPackages: Array.isArray(brief.coverPackages)
      ? brief.coverPackages.filter(forPriorityShift)
      : [],
    skillRisks: topSkillRisks,
    summary: {
      shiftsChecked: calendar.length,
      reducedCoverShifts: calendar.filter(
        (shift) => shift.coverageStatus !== "covered",
      ).length,
      shiftsWithSkillExposure: calendar.filter(
        (shift) => numberValue(shift.missingSkillCount) > 0,
      ).length,
      priorityShiftCountWithDetailedEvidence: priorityShifts.length,
    },
    detailScope:
      "All shift summaries are included. Named rota-off, candidate, package and skill-by-asset detail is limited to the four highest-priority shifts.",
  };
}


function compactDecisionData(value: unknown, depth = 0): unknown {
  if (depth > 5) return "Further nested evidence omitted from the compact decision pack.";
  if (typeof value === "string") {
    return value.length > 1_500 ? value.slice(0, 1_500) + "…" : value;
  }
  if (Array.isArray(value)) {
    const limit = depth === 0 ? 20 : 12;
    return value.slice(0, limit).map((item) => compactDecisionData(item, depth + 1));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .slice(0, 60)
      .map(([key, item]) => [key, compactDecisionData(item, depth + 1)]),
  );
}

function compactToolDomain(result: ToolResult): JsonRecord {
  return {
    source: result.source,
    status: result.status,
    data: compactDecisionData(result.data),
    message: result.message,
  };
}

function textValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function coverShiftKey(shift: JsonRecord): string {
  return `${String(shift.shiftDate)}:${String(shift.shiftType)}`;
}

function compareCoverPriority(first: JsonRecord, second: JsonRecord): number {
  return (
    numberValue(second.labourRiskScore) - numberValue(first.labourRiskScore) ||
    numberValue(second.missingSkillCount) - numberValue(first.missingSkillCount) ||
    String(first.shiftDate).localeCompare(String(second.shiftDate)) ||
    String(first.shiftType).localeCompare(String(second.shiftType))
  );
}

function readableShift(shift: JsonRecord): string {
  const date = new Date(`${String(shift.shiftDate)}T12:00:00Z`);
  const dateLabel = Number.isNaN(date.getTime())
    ? String(shift.shiftDate)
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date);
  return `${dateLabel} ${String(shift.shiftType)}`;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}


function coverEvidenceConfidence(
  shiftCoverEvidence: JsonRecord,
  primaryShift: JsonRecord,
  primaryPackage: JsonRecord | undefined,
  primarySkillRisks: JsonRecord[],
  offRotaNames: string[],
): number {
  let score = primaryPackage ? 92 : 78;
  const sourceUpdatedAt =
    typeof shiftCoverEvidence.sourceUpdatedAt === "string"
      ? new Date(shiftCoverEvidence.sourceUpdatedAt).getTime()
      : Number.NaN;

  if (!Number.isFinite(sourceUpdatedAt)) {
    score -= 15;
  } else {
    const sourceAgeHours = Math.max(0, (Date.now() - sourceUpdatedAt) / 3_600_000);
    if (sourceAgeHours > 168) score -= 20;
    else if (sourceAgeHours > 72) score -= 12;
    else if (sourceAgeHours > 24) score -= 6;
  }

  if (textValues(primaryShift.engineerNames).length === 0) score -= 12;
  if (numberValue(primaryShift.missingSkillCount) > 0 && primarySkillRisks.length === 0) {
    score -= 12;
  }
  if (primaryPackage && offRotaNames.length === 0) score -= 8;
  if (primaryPackage && numberValue(primaryPackage.remainingMissingSkills) > 0) score -= 5;

  return Math.max(45, Math.min(95, Math.round(score)));
}

function enforceAnswerEvidence(
  answer: JsonRecord,
  question: string,
  shiftCoverEvidence: JsonRecord | null,
  shiftCoverArguments: JsonRecord | null,
): void {
  const writeRequest =
    /^\s*(?:please\s+)?(?:change|update|assign|delete|create|approve|order|schedule|book|cancel|close|complete|move|switch)\b/i.test(
      question,
    ) ||
    /\b(?:can|could|would|will)\s+you\s+(?:change|update|assign|delete|create|approve|order|schedule|book|cancel|close|complete|move|switch)\b/i.test(
      question,
    );
  if (writeRequest) {
    const directAnswer =
      typeof answer.directAnswer === "string" ? answer.directAnswer.trim() : "";
    if (!/\bread-only\b/i.test(directAnswer) || !/\bcannot\b/i.test(directAnswer)) {
      answer.directAnswer =
        `Ask Vorta is read-only and cannot change Vorta records. ${directAnswer}`.trim();
    }
  }

  if (!shiftCoverEvidence) return;
  const calendar = records(shiftCoverEvidence.calendar);
  const issueShifts = calendar
    .filter(
      (shift) =>
        shift.coverageStatus !== "covered" ||
        numberValue(shift.missingSkillCount) > 0,
    )
    .sort(compareCoverPriority);
  const priorityShift = issueShifts[0];
  if (!priorityShift) return;
  const jointHighestShifts = issueShifts.filter(
    (shift) =>
      numberValue(shift.labourRiskScore) ===
        numberValue(priorityShift.labourRiskScore) &&
      numberValue(shift.missingSkillCount) ===
        numberValue(priorityShift.missingSkillCount),
  );
  const packages = records(shiftCoverEvidence.coverPackages);
  const coverCandidates = records(shiftCoverEvidence.coverCandidates);
  const exceptions = records(shiftCoverEvidence.exceptions).filter(
    (item) => item.isAvailable === false,
  );
  const offRota = records(shiftCoverEvidence.offRota);
  const skillRisks = records(shiftCoverEvidence.skillRisks);
  const requestedStart =
    typeof shiftCoverArguments?.start_date === "string"
      ? shiftCoverArguments.start_date
      : undefined;
  const requestedEnd =
    typeof shiftCoverArguments?.end_date === "string"
      ? shiftCoverArguments.end_date
      : undefined;
  const requestedDate =
    requestedStart && requestedStart === requestedEnd ? requestedStart : undefined;
  const requestedType = /\bnight\b/i.test(question)
    ? "night"
    : /\bday\b/i.test(question)
      ? "day"
      : undefined;
  const requestedShift = issueShifts.find(
    (item) =>
      (!requestedDate || item.shiftDate === requestedDate) &&
      (!requestedType || item.shiftType === requestedType),
  );
  const packageEvidence =
    packages.find(
      (item) =>
        (!requestedDate || item.shiftDate === requestedDate) &&
        (!requestedType || item.shiftType === requestedType) &&
        (requestedDate || requestedType),
    ) ??
    packages.find(
      (item) =>
        item.shiftDate === priorityShift.shiftDate &&
        item.shiftType === priorityShift.shiftType,
    );
  const broadCoverQuestion = /\bcover(?:age)?\b/i.test(question);
  const packageQuestion = /\b(best|strongest|recommended|cover package)\b/i.test(
    question,
  ) || /\b(who can cover|cover option|cover candidate|replacement cover)\b/i.test(
    question,
  );

  const primaryShift = requestedShift ?? priorityShift;
  const primaryKey = coverShiftKey(primaryShift);
  const primaryPackage =
    packages.find((item) => coverShiftKey(item) === primaryKey) ?? packageEvidence;
  const scheduledNames = textValues(primaryShift.engineerNames);
  const teamNames = textValues(primaryShift.teamNames);
  const primaryOffRota = offRota.find((item) => coverShiftKey(item) === primaryKey);
  const offRotaNames = textValues(primaryOffRota?.engineerNames);
  const restConflictNames = textValues(primaryOffRota?.restConflictEngineerNames);
  const primarySkillRisks = skillRisks
    .filter((item) => coverShiftKey(item) === primaryKey)
    .sort(
      (first, second) =>
        numberValue(first.qualifiedEngineerCount) -
          numberValue(second.qualifiedEngineerCount) ||
        String(first.skillName).localeCompare(String(second.skillName)),
    )
    .slice(0, 4);
  const closedGapKeys = new Set(textValues(primaryPackage?.closedGapKeys));
  const residualSkillRisks = primarySkillRisks.filter((item) => {
    const gapKey = typeof item.gapKey === "string" ? item.gapKey : "";
    return !gapKey || !closedGapKeys.has(gapKey);
  });
  const residualRiskDetail =
    residualSkillRisks.length > 0
      ? residualSkillRisks
          .map(
            (item) =>
              `${String(item.skillName)} on ${String(item.equipmentCode ?? item.equipmentName)}`,
          )
          .join("; ")
      : primaryPackage && numberValue(primaryPackage.remainingMissingSkills) > 0
        ? `${numberValue(primaryPackage.remainingMissingSkills)} gaps remain; open the residual skill-by-asset list before releasing planned work`
        : "No zero-cover skill gap remains in the calculated package";

  const deterministicFindings: JsonRecord[] = [];
  deterministicFindings.push({
    category: "cover",
    severity: "high",
    title:
      jointHighestShifts.length > 1 && primaryShift === priorityShift
        ? "Joint-highest-risk shifts"
        : "Priority shift and scheduled team",
    detail:
      jointHighestShifts.length > 1 && primaryShift === priorityShift
        ? `${jointHighestShifts.map((shift) => `${readableShift(shift)} (${textValues(shift.teamNames).join(" + ")}), scheduled: ${textValues(shift.engineerNames).join(", ")}`).join("; ")}. These shifts are joint highest at ${numberValue(priorityShift.labourRiskScore).toFixed(1)} labour risk, with ${numberValue(priorityShift.missingSkillCount)} missing required-skill gaps across ${numberValue(priorityShift.equipmentWithMissingCover)} assets.`
        : `${readableShift(primaryShift)} — ${teamNames.join(" + ")}. Scheduled engineers: ${scheduledNames.join(", ")}. Labour risk ${numberValue(primaryShift.labourRiskScore).toFixed(1)}; ${numberValue(primaryShift.missingSkillCount)} missing required-skill gaps across ${numberValue(primaryShift.equipmentWithMissingCover)} assets.`,
  });
  deterministicFindings.push({
    category: "absence",
    severity: exceptions.length ? "high" : "info",
    title: exceptions.length
      ? "Recorded holiday, training or absence"
      : "No recorded holiday, training or absence",
    detail: exceptions.length
      ? exceptions
          .slice(0, 6)
          .map(
            (item) =>
              `${item.engineerName ?? item.teamName ?? "Scheduled team"} — ${String(item.exceptionType)} on ${readableShift(item)}`,
          )
          .join("; ")
      : "No holiday, training or absence exception is recorded for this period. This does not confirm that every off-rota engineer is available.",
  });
  if (offRotaNames.length) {
    deterministicFindings.push({
      category: "cover",
      severity: "info",
      title: "Off-rota engineers — availability not confirmed",
      detail: `${readableShift(primaryShift)}: ${offRotaNames.join(", ")}. ${restConflictNames.length ? `Rest-conflict review: ${restConflictNames.join(", ")}. ` : ""}Off-rota does not mean available; confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.`,
    });
  }
  if (primarySkillRisks.length) {
    deterministicFindings.push({
      category: "skill",
      severity: "high",
      title: "Highest missing skills and affected assets",
      detail: primarySkillRisks
        .map(
          (item) =>
            `${String(item.skillName)} — ${String(item.equipmentCode ?? item.equipmentName)} (${numberValue(item.qualifiedEngineerCount)}/${numberValue(item.minimumQualifiedEngineers)} validated on shift)`,
        )
        .join("; "),
    });
  }
  if (primaryPackage) {
    const names = textValues(primaryPackage.engineerNames);
    deterministicFindings.push({
      category: "cover",
      severity: "medium",
      title: "Calculated cover-package impact",
      detail: `${readableShift(primaryPackage)} — ${names.join(", ")} fully closes ${numberValue(primaryPackage.missingSkillsClosed)} missing-skill gaps, improves ${numberValue(primaryPackage.gapsImproved)} skill-by-asset exposure points and leaves ${numberValue(primaryPackage.remainingMissingSkills)} missing-skill gaps. This is provisional, not assigned.`,
    });
    deterministicFindings.push({
      category: "skill",
      severity:
        numberValue(primaryPackage.remainingMissingSkills) > 0 ? "high" : "low",
      title: "Residual risk after proposed cover",
      detail: `${residualRiskDetail}. ${
        numberValue(primaryPackage.remainingMissingSkills) > 0
          ? "Move work requiring these competencies or arrange validated cross-shift or contractor support."
          : "Verify the revised roster before releasing planned work."
      }`,
    });
  }

  const existingFindings = records(answer.findings).filter(
    (item) =>
      ![
        "Priority shift scheduled team",
        "Priority shift and scheduled team",
        "Joint-highest-risk shifts",
        "Recorded holiday, training or absence",
        "No recorded holiday, training or absence",
        "Off-rota engineers — availability not confirmed",
        "Highest missing skills and affected assets",
        "Calculated cover-package impact",
        "Residual risk after proposed cover",
      ].includes(String(item.title)) &&
      (!broadCoverQuestion && !packageQuestion ||
        !["cover", "absence", "skill"].includes(String(item.category))),
  );
  answer.findings = [...deterministicFindings, ...existingFindings].slice(0, 10);

  if (broadCoverQuestion || packageQuestion) {
    const orderedPackageShifts = [primaryShift];
    const packageOptions = orderedPackageShifts
      .map((shift) => {
        const coverPackage = packages.find(
          (item) => coverShiftKey(item) === coverShiftKey(shift),
        );
        if (!coverPackage || textValues(coverPackage.engineerNames).length === 0) {
          return null;
        }
        return {
          engineerNames: textValues(coverPackage.engineerNames).slice(0, 4),
          shift: readableShift(coverPackage),
          reason: `Strongest calculated package for ${textValues(shift.teamNames).join(" + ")} at ${numberValue(shift.labourRiskScore).toFixed(1)} labour risk.`,
          skillsCovered: textValues(coverPackage.closedSkills).slice(0, 6),
          assetsProtected: textValues(coverPackage.protectedAssets).slice(0, 6),
          projectedImpact: `Closes ${numberValue(coverPackage.missingSkillsClosed)} of ${numberValue(shift.missingSkillCount)} missing-skill gaps; improves ${numberValue(coverPackage.gapsImproved)} skill-by-asset exposure points; protects ${numberValue(coverPackage.assetsWithClosedGaps)} assets.`,
          remainingRisk: `${numberValue(coverPackage.remainingMissingSkills)} missing-skill gaps remain across the shift.`,
          caveat:
            "Provisional only—confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.",
        };
      })
      .filter(Boolean);
    const packageEngineerNames = new Set(
      textValues(primaryPackage?.engineerNames).map((name) => name.toLowerCase()),
    );
    const rankedCandidates = coverCandidates
      .filter((item) => coverShiftKey(item) === primaryKey)
      .sort(
        (first, second) =>
          numberValue(first.candidateRank) - numberValue(second.candidateRank),
      );
    const independentCandidates = rankedCandidates.filter(
      (item) =>
        !packageEngineerNames.has(String(item.engineerName).toLowerCase()),
    );
    const alternativePool =
      independentCandidates.length > 0 ? independentCandidates : rankedCandidates;
    const alternativeOptions = alternativePool.slice(0, 3).map((candidate) => ({
      engineerNames: [String(candidate.engineerName)],
      shift: readableShift(candidate),
      reason: `Ranked individual fallback${candidate.discipline ? ` — ${String(candidate.discipline)}` : ""}.`,
      skillsCovered: textValues(candidate.topSkills).slice(0, 6),
      assetsProtected: textValues(candidate.topAssets).slice(0, 6),
      projectedImpact: `Closes ${numberValue(candidate.gapsClosed)} gaps and improves ${numberValue(candidate.gapsImproved)} skill-by-asset exposure points.`,
      remainingRisk: `${numberValue(candidate.remainingMissingSkills)} missing-skill gaps remain with this individual option.`,
      caveat: `${String(candidate.availabilityStatus ?? "Availability unconfirmed")}. ${
        candidate.restConflict
          ? "Rest conflict recorded—do not assign until resolved."
          : "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval."
      }`,
    }));
    answer.coverOptions = [...packageOptions, ...alternativeOptions].slice(0, 4);
  }

  if (broadCoverQuestion && primaryPackage) {
    const reducedCount = calendar.filter(
      (shift) => shift.coverageStatus !== "covered",
    ).length;
    const highestLabels = jointHighestShifts
      .map(
        (shift) =>
          `${textValues(shift.teamNames).join(" + ")} ${readableShift(shift)}`,
      )
      .join(" and ");
    const packageNames = textValues(primaryPackage.engineerNames);
    const scheduledForHighestRisk = [
      ...new Set(
        jointHighestShifts.flatMap((shift) => textValues(shift.engineerNames)),
      ),
    ];
    const skillsGapCount = calendar.filter(
      (shift) => numberValue(shift.missingSkillCount) > 0,
    ).length;
    answer.directAnswer =
      `Yes—${skillsGapCount} of ${calendar.length} shifts have insufficient validated skill coverage; ` +
      `${reducedCount} also have reduced or non-standard rota cover.`;
    answer.decisionSummary = [
      {
        label: "Highest risk",
        value: `${highestLabels}; ${numberValue(priorityShift.labourRiskScore).toFixed(1)} labour risk, ${numberValue(priorityShift.missingSkillCount)} missing-skill gaps across ${numberValue(priorityShift.equipmentWithMissingCover)} assets.`,
      },
      {
        label: "Scheduled",
        value: scheduledForHighestRisk.join(", "),
      },
      {
        label: "Absence",
        value: exceptions.length
          ? `${exceptions.length} recorded holiday, training or absence exception${exceptions.length === 1 ? "" : "s"}.`
          : "None recorded. Confirm unrecorded leave or rota changes before offering overtime.",
      },
      {
        label: "Best provisional cover",
        value: `${packageNames.join(", ")} for ${readableShift(primaryPackage)}.`,
      },
      {
        label: "Calculated impact",
        value: `Closes ${numberValue(primaryPackage.missingSkillsClosed)} of ${numberValue(primaryShift.missingSkillCount)} missing-skill gaps; ${numberValue(primaryPackage.remainingMissingSkills)} remain.`,
      },
      {
        label: "Residual risk",
        value: residualRiskDetail,
      },
      {
        label: "First action",
        value: "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.",
      },
    ];
  }

  if (packageQuestion && primaryPackage) {
    const packageNames = textValues(primaryPackage.engineerNames);
    answer.directAnswer = `Best provisional cover for ${readableShift(primaryPackage)} is ${packageNames.join(", ")}.`;
    answer.decisionSummary = [
      {
        label: "Cover package",
        value: packageNames.join(", "),
      },
      {
        label: "Calculated impact",
        value: `Closes ${numberValue(primaryPackage.missingSkillsClosed)} of ${numberValue(primaryShift.missingSkillCount)} missing-skill gaps, improves ${numberValue(primaryPackage.gapsImproved)} skill-by-asset exposure points and leaves ${numberValue(primaryPackage.remainingMissingSkills)} gaps.`,
      },
      {
        label: "Residual risk",
        value: residualRiskDetail,
      },
      {
        label: "Status",
        value: "Off-rota candidates—not confirmed available or assigned.",
      },
      {
        label: "First action",
        value: "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.",
      },
    ];
  }

  if ((broadCoverQuestion || packageQuestion) && primaryPackage) {
    const packageNames = textValues(primaryPackage.engineerNames);
    const namedAction = {
      priority: "now",
      action: `Contact ${packageNames.join(", ")} for provisional cover of ${readableShift(primaryPackage)}.`,
      owner: "Maintenance Manager",
      expectedImpact: `Close ${numberValue(primaryPackage.missingSkillsClosed)} of ${numberValue(primaryShift.missingSkillCount)} missing-skill gaps; ${numberValue(primaryPackage.remainingMissingSkills)} remain.`,
      verification:
        "Confirm each engineer's acceptance and rest compliance, update the rota, then re-run Shift Cover.",
    };
    answer.actionPlan = [
      namedAction,
      {
        priority: "before_shift",
        action:
          "Confirm overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval for every proposed engineer.",
        owner: "Shift Supervisor",
        expectedImpact: "Converts the provisional package into a safe, auditable cover decision.",
        verification:
          "Record each acceptance and confirm the final named roster at handover.",
      },
      {
        priority: "before_shift",
        action:
          numberValue(primaryPackage.remainingMissingSkills) > 0
            ? `Move work relying on the ${numberValue(primaryPackage.remainingMissingSkills)} residual gaps or arrange validated cross-shift or contractor support.`
            : "Verify the revised team covers every required asset skill before releasing the plan.",
        owner: "Maintenance Planner",
        expectedImpact:
          "Prevents planned work from relying on competencies that remain uncovered.",
        verification:
          "Compare the released work plan with the residual skill-by-asset list after re-running Shift Cover.",
      },
    ];
    answer.recommendedActions = [
      namedAction.action,
      ...(Array.isArray(answer.recommendedActions)
        ? answer.recommendedActions.filter(
            (item): item is string =>
              typeof item === "string" && !/\bcontact\b/i.test(item),
      )
        : []),
    ].slice(0, 6);
    answer.followUpQuestions = [
      "Which skills and assets remain uncovered after this package?",
      `Show alternative cover if ${packageNames.join(", ")} are unavailable.`,
      "Which planned work should move away from the highest-risk shift?",
      "Show every shift with reduced rota or insufficient skills coverage.",
    ];
  }
  answer.evidenceGeneratedAt =
    typeof shiftCoverEvidence.sourceUpdatedAt === "string"
      ? shiftCoverEvidence.sourceUpdatedAt
      : typeof shiftCoverEvidence.generatedAt === "string"
        ? shiftCoverEvidence.generatedAt
        : undefined;
  answer.confidence = coverEvidenceConfidence(
    shiftCoverEvidence,
    primaryShift,
    primaryPackage,
    primarySkillRisks,
    offRotaNames,
  );
}

async function rpcTool(
  supabase: SupabaseClient,
  source: string,
  rpcName: string,
  parameters: JsonRecord = {},
): Promise<ToolResult> {
  const { data, error } = await supabase.rpc(rpcName, parameters);
  if (error) {
    return { source, status: "unavailable", message: error.message };
  }
  if (data === null || data === undefined || (Array.isArray(data) && data.length === 0)) {
    return { source, status: "empty", data: [] };
  }
  return { source, status: "ok", data };
}

function equipmentId(args: JsonRecord): string | null {
  return requiredText(args.equipment_id, 100);
}

function validDateRange(startDate: unknown, endDate: unknown): boolean {
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !DATE_ONLY_PATTERN.test(startDate) ||
    !DATE_ONLY_PATTERN.test(endDate)
  ) {
    return false;
  }
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 31 * 86_400_000;
}

function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normaliseRelativeShiftCoverArguments(
  question: string,
  timezone: string,
  args: JsonRecord,
  now = new Date(),
): JsonRecord {
  const relativeRange =
    /\b(this|current|next|following)\s+week\b|\bnext\s+(7|seven)\s+days\b|\b(today|tomorrow)\b/i.exec(
      question,
    )?.[0];
  if (!relativeRange) return args;

  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const today = new Date(`${localDate}T12:00:00Z`);
  const weekday = today.getUTCDay();
  const thisWeekStart = addUtcDays(today, weekday === 0 ? -6 : 1 - weekday);
  let start = thisWeekStart;
  let end = addUtcDays(start, 6);

  if (/\b(next|following)\s+week\b/i.test(question)) {
    start = addUtcDays(thisWeekStart, 7);
    end = addUtcDays(start, 6);
  } else if (/\btomorrow\b/i.test(question)) {
    start = addUtcDays(today, 1);
    end = start;
  } else if (/\btoday\b/i.test(question)) {
    start = today;
    end = start;
  } else if (/\bnext\s+(7|seven)\s+days\b/i.test(question)) {
    start = today;
    end = addUtcDays(start, 6);
  }

  return {
    ...args,
    start_date: formatUtcDate(start),
    end_date: formatUtcDate(end),
  };
}

async function sha256Fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

interface EvidenceLink {
  label: string;
  path: string;
  recordType: "shift" | "handover" | "equipment" | "work" | "spare" | "skill" | "document" | "risk";
}

function evidenceLinkForTool(name: string, args: JsonRecord): EvidenceLink | null {
  const equipment = equipmentId(args);
  const equipmentPath = equipment ? `/equipment/${encodeURIComponent(equipment)}` : null;
  const links: Record<string, EvidenceLink> = {
    get_site_risk: { label: "Open site risk", path: "/dashboard", recordType: "risk" },
    get_site_operational_snapshot: { label: "Open operational dashboard", path: "/dashboard", recordType: "risk" },
    get_equipment_decision_pack: { label: "Open equipment register", path: "/equipment", recordType: "equipment" },
    get_equipment_risk: { label: "Open equipment", path: "/equipment", recordType: "equipment" },
    get_shift_cover: { label: "Open Shift Cover", path: "/shift-cover", recordType: "shift" },
    get_shift_handover: { label: "Open Shift Handover", path: "/shift-handover", recordType: "handover" },
    get_contractor_availability: { label: "Open Engineers", path: "/engineers", recordType: "skill" },
    get_site_work_backlog: { label: "Open work plan", path: "/dashboard?focus=work-plan", recordType: "work" },
    get_site_maintenance_plan: { label: "Open maintenance plan", path: "/dashboard?focus=work-plan", recordType: "work" },
    get_site_spares_risk: { label: "Open equipment spares", path: "/equipment", recordType: "spare" },
    get_site_capability_actions: { label: "Open Skills Matrix", path: "/skills-matrix", recordType: "skill" },
  };
  if (links[name]) return links[name];
  if (!equipmentPath) return null;
  if (name === "get_equipment_work") {
    return { label: "Open asset work orders", path: `${equipmentPath}/work-orders`, recordType: "work" };
  }
  if (name === "get_equipment_calibrations") {
    return { label: "Open asset PMs", path: `${equipmentPath}/pms`, recordType: "work" };
  }
  if (name === "get_equipment_skills") {
    return { label: "Open asset skills", path: `${equipmentPath}/skills`, recordType: "skill" };
  }
  if (name === "get_equipment_spares") {
    return { label: "Open asset spares", path: `${equipmentPath}/spares`, recordType: "spare" };
  }
  if (name === "get_equipment_history") {
    return { label: "Open asset history", path: `${equipmentPath}/history`, recordType: "work" };
  }
  if (name === "get_equipment_documents" || name === "search_maintenance_documents") {
    return { label: "Open asset documents", path: `${equipmentPath}/documents`, recordType: "document" };
  }
  if (name === "get_equipment_risk_actions") {
    return { label: "Open asset risk", path: `${equipmentPath}/overview`, recordType: "risk" };
  }
  return null;
}

async function getSiteEquipmentIndex(
  supabase: SupabaseClient,
  siteId: string,
): Promise<Map<string, JsonRecord>> {
  const { data, error } = await supabase
    .from("equipment_assets")
    .select("id,name,equipment_code,area,criticality")
    .eq("site_id", siteId)
    .limit(500);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((item) => {
      const row = item as JsonRecord;
      return [String(row.id), row];
    }),
  );
}

function assetLabel(asset: JsonRecord | undefined): JsonRecord {
  return {
    equipmentName: typeof asset?.name === "string" ? asset.name : "Unknown asset",
    equipmentCode:
      typeof asset?.equipment_code === "string" ? asset.equipment_code : null,
    area: typeof asset?.area === "string" ? asset.area : null,
    equipmentCriticality:
      typeof asset?.criticality === "string" ? asset.criticality : null,
  };
}

function numberValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function executeTool(
  name: string,
  args: JsonRecord,
  supabase: SupabaseClient,
  request: AskVortaRequest,
): Promise<ToolResult> {
  switch (name) {
    case "get_site_risk":
      return rpcTool(supabase, "Current risk dashboard", "vorta_get_operational_dashboard_snapshot");


    case "get_site_operational_snapshot": {
      const domainDefinitions: Array<[string, Promise<ToolResult>]> = [
        ["siteRisk", executeTool("get_site_risk", {}, supabase, request)],
        ["workBacklog", executeTool("get_site_work_backlog", {}, supabase, request)],
        ["sparesRisk", executeTool("get_site_spares_risk", {}, supabase, request)],
        ["capability", executeTool("get_site_capability_actions", {}, supabase, request)],
        ["shiftHandover", executeTool("get_shift_handover", {}, supabase, request)],
      ];
      const domainEntries = await Promise.all(
        domainDefinitions.map(async ([key, pending]) => [
          key,
          compactToolDomain(await pending),
        ] as const),
      );
      const domains = Object.fromEntries(domainEntries) as Record<string, JsonRecord>;
      const statuses = Object.values(domains).map((item) => item.status);
      const status: ToolResult["status"] = statuses.some((item) => item === "ok")
        ? "ok"
        : statuses.some((item) => item === "empty")
          ? "empty"
          : "unavailable";
      return {
        source: "Cross-domain operational decision snapshot",
        status,
        data: {
          generatedAt: new Date().toISOString(),
          domains,
          caveat:
            "This snapshot combines decision evidence from several Vorta sources. Use a specialist tool as well when the question needs a date range, a named shift, a named person or one exact equipment record.",
        },
      };
    }

    case "get_equipment_risk": {
      const result = await rpcTool(
        supabase,
        "Equipment risk register",
        "vorta_get_demo_equipment_risk_list",
      );
      const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      if (!query || result.status !== "ok" || !Array.isArray(result.data)) return result;
      const rows = result.data.filter((item) => {
        const row = item as JsonRecord;
        return [row.equipment_name, row.equipment_code, row.area]
          .filter((value): value is string => typeof value === "string")
          .some((value) => value.toLowerCase().includes(query));
      });
      return { ...result, status: rows.length ? "ok" : "empty", data: rows };
    }


    case "get_equipment_decision_pack": {
      const query = requiredText(args.query, 300);
      if (!query) {
        return {
          source: "Equipment cross-domain decision pack",
          status: "unavailable",
          message: "A natural-language equipment name or code is required.",
        };
      }
      const riskResult = await executeTool(
        "get_equipment_risk",
        { query },
        supabase,
        request,
      );
      const matches = records(riskResult.data);
      if (riskResult.status !== "ok" || matches.length === 0) {
        return {
          source: "Equipment cross-domain decision pack",
          status: riskResult.status,
          data: { query, matches: compactDecisionData(matches) },
          message: riskResult.message ?? "No authorised equipment matched the reference.",
        };
      }
      const normalisedQuery = query.trim().toLowerCase();
      const exactMatch = matches.find((item) =>
        [item.equipment_name, item.equipment_code, item.name, item.code]
          .filter((value): value is string => typeof value === "string")
          .some((value) => value.trim().toLowerCase() === normalisedQuery),
      );
      const selected = exactMatch ?? (matches.length === 1 ? matches[0] : null);
      if (!selected) {
        return {
          source: "Equipment cross-domain decision pack",
          status: "ok",
          data: {
            query,
            ambiguous: true,
            matches: compactDecisionData(matches.slice(0, 8)),
            instruction:
              "Several authorised assets match. Ask one focused clarification using the displayed name or equipment code; do not choose an asset silently.",
          },
        };
      }
      const equipmentIdValue = [
        selected.equipment_id,
        selected.equipmentId,
        selected.id,
      ].find((value) => typeof value === "string" && value.trim().length > 0);
      if (typeof equipmentIdValue !== "string") {
        return {
          source: "Equipment cross-domain decision pack",
          status: "unavailable",
          data: { query, equipment: compactDecisionData(selected) },
          message: "The matched equipment record did not expose its authorised identifier.",
        };
      }
      const domainNames = [
        "get_equipment_work",
        "get_equipment_calibrations",
        "get_equipment_skills",
        "get_equipment_spares",
        "get_equipment_risk_actions",
        "get_equipment_history",
        "get_equipment_documents",
      ] as const;
      const domainEntries = await Promise.all(
        domainNames.map(async (toolName) => [
          toolName,
          compactToolDomain(
            await executeTool(
              toolName,
              { equipment_id: equipmentIdValue },
              supabase,
              request,
            ),
          ),
        ] as const),
      );
      return {
        source: "Equipment cross-domain decision pack",
        status: "ok",
        data: {
          query,
          equipment: compactDecisionData(selected),
          domains: Object.fromEntries(domainEntries),
          caveat:
            "Use search_maintenance_documents as an additional specialist lookup when the question asks for a fault code, procedure, drawing, manual section or exact technical instruction.",
        },
      };
    }

    case "get_shift_cover": {
      const startDate = args.start_date;
      const endDate = args.end_date;
      if (!validDateRange(startDate, endDate)) {
        return {
          source: "Shift cover calendar, exceptions and skills",
          status: "unavailable",
          message: "Dates must use YYYY-MM-DD and cover no more than 31 days.",
        };
      }
      const result = await rpcTool(
        supabase,
        "Shift Cover decision pack",
        "vorta_get_shift_cover_ai_brief",
        {
          p_site_id: request.siteId,
          p_start_date: startDate,
          p_end_date: endDate,
        },
      );
      return result.status === "ok"
        ? { ...result, data: compactShiftCoverData(result.data) }
        : result;
    }

    case "get_shift_handover": {
      const latestResult = await supabase
        .from("work_order_confirmations")
        .select("confirmation_timestamp,created_at")
        .eq("site_id", request.siteId)
        .eq("reversal", false)
        .order("confirmation_timestamp", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestResult.error) {
        return {
          source: "Latest shift handover and SAP confirmations",
          status: "unavailable",
          message: latestResult.error.message,
        };
      }
      const anchorValue =
        latestResult.data?.confirmation_timestamp ?? latestResult.data?.created_at;
      if (!anchorValue) {
        return {
          source: "Latest shift handover and SAP confirmations",
          status: "empty",
          data: { summary: { itemCount: 0 }, items: [] },
        };
      }
      const anchor = new Date(anchorValue);
      const windowEnd = new Date(anchor.getTime() + 1).toISOString();
      const windowStart = new Date(anchor.getTime() - 12 * 60 * 60 * 1_000).toISOString();
      const confirmationResult = await supabase
        .from("work_order_confirmations")
        .select(
          "id,work_order_id,confirmation_number,confirmation_text,confirmed_by,work_center,confirmation_timestamp,actual_work,work_unit,actual_duration,duration_unit,final_confirmation,source_system",
        )
        .eq("site_id", request.siteId)
        .eq("reversal", false)
        .gte("confirmation_timestamp", windowStart)
        .lte("confirmation_timestamp", windowEnd)
        .order("confirmation_timestamp", { ascending: false })
        .limit(150);
      if (confirmationResult.error) {
        return {
          source: "Latest shift handover and SAP confirmations",
          status: "unavailable",
          message: confirmationResult.error.message,
        };
      }
      const confirmations = confirmationResult.data ?? [];
      const workOrderIds = [
        ...new Set(confirmations.map((item) => String(item.work_order_id)).filter(Boolean)),
      ];
      const workResult = workOrderIds.length
        ? await supabase
            .from("work_orders")
            .select(
              "id,equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,outcome,downtime_minutes,fault_code,system_status_codes,user_status_codes,primary_notification_number,updated_at",
            )
            .eq("site_id", request.siteId)
            .in("id", workOrderIds)
        : { data: [], error: null };
      if (workResult.error) {
        return {
          source: "Latest shift handover and SAP confirmations",
          status: "unavailable",
          message: workResult.error.message,
        };
      }
      const equipment = await getSiteEquipmentIndex(supabase, request.siteId);
      const orderMap = new Map((workResult.data ?? []).map((item) => [String(item.id), item]));
      const grouped = new Map<string, typeof confirmations>();
      confirmations.forEach((confirmation) => {
        const id = String(confirmation.work_order_id);
        grouped.set(id, [...(grouped.get(id) ?? []), confirmation]);
      });
      const items = [...grouped.entries()].map(([workOrderId, orderConfirmations]) => {
        const order = orderMap.get(workOrderId);
        const latest = orderConfirmations[0];
        const evidence = `${order?.status ?? ""} ${order?.outcome ?? ""} ${order?.assigned_engineer ?? ""} ${latest?.confirmation_text ?? ""}`.toLowerCase();
        const contractor = /contractor|external|vendor|oem support|specialist/.test(evidence);
        const waitingOnParts = /waiting parts|waiting on parts|awaiting spare|awaiting material|material shortage/.test(evidence);
        const temporary = /temporary|temporarily|running with restriction|restored pending/.test(evidence);
        const complete =
          Boolean(latest?.final_confirmation) ||
          /completed|closed|teco|returned to service/.test(evidence);
        return {
          workOrderNumber: order?.wo_number,
          notificationNumber: order?.primary_notification_number,
          ...assetLabel(equipment.get(String(order?.equipment_id))),
          priority: order?.priority,
          description: order?.description,
          faultCode: order?.fault_code,
          assignedEngineer: order?.assigned_engineer ?? latest?.confirmed_by,
          latestConfirmation: latest?.confirmation_text,
          confirmedBy: latest?.confirmed_by,
          lastActivityAt: latest?.confirmation_timestamp,
          actualWork: latest?.actual_work,
          workUnit: latest?.work_unit,
          downtimeMinutes: order?.downtime_minutes,
          status: waitingOnParts
            ? "waiting_on_parts"
            : contractor
              ? "external_contractor"
              : temporary
                ? "temporarily_restored"
                : complete
                  ? "completed"
                  : "ongoing",
          contractor,
          nextAction: waitingOnParts
            ? "Confirm the required material, reservation and expected issue time."
            : contractor
              ? "Confirm contractor attendance, site access and agreed technical scope."
              : temporary
                ? "Monitor the next operating cycle and complete the permanent repair plan."
                : complete
                  ? "Confirm the repair remains stable on the incoming shift."
                  : "Review the latest confirmation and continue the outstanding scope.",
        };
      });
      return {
        source: "Latest shift handover and SAP confirmations",
        status: items.length ? "ok" : "empty",
        data: {
          window: { start: windowStart, end: windowEnd },
          summary: {
            itemCount: items.length,
            completedCount: items.filter((item) => item.status === "completed").length,
            ongoingCount: items.filter((item) => item.status !== "completed").length,
            waitingOnPartsCount: items.filter((item) => item.status === "waiting_on_parts").length,
            contractorCount: items.filter((item) => item.contractor).length,
          },
          items: items.slice(0, 30),
        },
      };
    }

    case "get_contractor_availability": {
      const engineerResult = await supabase
        .from("engineers")
        .select(
          "id,full_name,employment_type,discipline,availability_status,verified,shift_pattern,source_updated_at",
        )
        .eq("site_id", request.siteId)
        .ilike("employment_type", "%contract%")
        .order("full_name")
        .limit(100);
      if (engineerResult.error) {
        return {
          source: "Contractor availability and validated capability",
          status: "unavailable",
          message: engineerResult.error.message,
        };
      }
      const engineers = engineerResult.data ?? [];
      const engineerIds = engineers.map((item) => item.id);
      const [availabilityResult, skillsResult] = await Promise.all([
        engineerIds.length
          ? supabase
              .from("engineer_availability")
              .select(
                "engineer_id,availability_status,available_now,available_from,available_until,on_shift,on_call,remote_support_available,onsite_support_available,phone_available,video_available,current_location,notes,last_updated_at",
              )
              .eq("site_id", request.siteId)
              .in("engineer_id", engineerIds)
          : Promise.resolve({ data: [], error: null }),
        engineerIds.length
          ? supabase
              .from("engineer_skills")
              .select("engineer_id,validated_rating,verification_status,skills(name,category)")
              .in("engineer_id", engineerIds)
              .gte("validated_rating", 3)
              .limit(300)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const detailError = availabilityResult.error ?? skillsResult.error;
      if (detailError) {
        return {
          source: "Contractor availability and validated capability",
          status: "unavailable",
          message: detailError.message,
        };
      }
      const availability = new Map(
        (availabilityResult.data ?? []).map((item) => [String(item.engineer_id), item]),
      );
      const skills = new Map<string, unknown[]>();
      (skillsResult.data ?? []).forEach((item) => {
        const id = String(item.engineer_id);
        skills.set(id, [...(skills.get(id) ?? []), item]);
      });
      const rows = engineers.map((engineer) => {
        const availabilityRow = availability.get(String(engineer.id));
        return {
          engineerName: engineer.full_name,
          discipline: engineer.discipline,
          verified: engineer.verified,
          employmentType: engineer.employment_type,
          availabilityStatus:
            availabilityRow?.availability_status ?? engineer.availability_status ?? "not_recorded",
          availableNow: availabilityRow?.available_now ?? null,
          availableFrom: availabilityRow?.available_from ?? null,
          availableUntil: availabilityRow?.available_until ?? null,
          onShift: availabilityRow?.on_shift ?? null,
          onCall: availabilityRow?.on_call ?? null,
          remoteSupport: availabilityRow?.remote_support_available ?? null,
          onsiteSupport: availabilityRow?.onsite_support_available ?? null,
          location: availabilityRow?.current_location ?? null,
          availabilityUpdatedAt: availabilityRow?.last_updated_at ?? null,
          validatedSkills: (skills.get(String(engineer.id)) ?? []).slice(0, 12),
        };
      });
      return {
        source: "Contractor availability and validated capability",
        status: rows.length ? "ok" : "empty",
        data: {
          summary: {
            contractorCount: rows.length,
            recordedAvailableNowCount: rows.filter((item) => item.availableNow === true).length,
            missingCurrentAvailabilityCount: rows.filter(
              (item) => item.availableNow === null,
            ).length,
          },
          contractors: rows,
          caveat:
            "Recorded availability is evidence only; confirm acceptance, access, certification and fatigue controls before assignment.",
        },
      };
    }

    case "get_site_work_backlog": {
      const [equipment, workResult] = await Promise.all([
        getSiteEquipmentIndex(supabase, request.siteId),
        supabase
          .from("work_orders")
          .select(
            "equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,is_overdue,fault_code,order_type_code,order_type_description,scheduled_start_at,scheduled_finish_at,updated_at",
          )
          .eq("site_id", request.siteId)
          .limit(300),
      ]);
      if (workResult.error) {
        return {
          source: "Site maintenance work backlog",
          status: "unavailable",
          message: workResult.error.message,
        };
      }
      const closed = /completed|closed|cancel|teco|business complete/i;
      const rows = (workResult.data ?? [])
        .filter((item) => !closed.test(String(item.status ?? "")))
        .map((item) => ({
          ...assetLabel(equipment.get(String(item.equipment_id))),
          workOrderNumber: item.wo_number,
          priority: item.priority,
          description: item.description,
          workType: item.work_type,
          status: item.status,
          assignedEngineer: item.assigned_engineer,
          requestedDate: item.requested_date,
          dueDate: item.due_date,
          overdue: Boolean(item.is_overdue),
          faultCode: item.fault_code,
          orderTypeCode: item.order_type_code,
          orderTypeDescription: item.order_type_description,
          scheduledStartAt: item.scheduled_start_at,
          scheduledFinishAt: item.scheduled_finish_at,
          updatedAt: item.updated_at,
        }))
        .sort((left, right) => {
          const overdueDifference = Number(right.overdue) - Number(left.overdue);
          if (overdueDifference) return overdueDifference;
          const priorities = ["critical", "high", "medium", "low"];
          return (
            priorities.indexOf(String(left.priority).toLowerCase()) -
            priorities.indexOf(String(right.priority).toLowerCase())
          );
        });
      return {
        source: "Site maintenance work backlog",
        status: rows.length ? "ok" : "empty",
        data: {
          summary: {
            openCount: rows.length,
            overdueCount: rows.filter((item) => item.overdue).length,
            unassignedCount: rows.filter((item) => !item.assignedEngineer).length,
            criticalOrHighCount: rows.filter((item) =>
              /critical|high/i.test(String(item.priority)),
            ).length,
          },
          workOrders: rows.slice(0, 35),
        },
      };
    }

    case "get_site_maintenance_plan": {
      const startDate = args.start_date;
      const endDate = args.end_date;
      if (!validDateRange(startDate, endDate)) {
        return {
          source: "Site PM and calibration plan",
          status: "unavailable",
          message: "Dates must use YYYY-MM-DD and cover no more than 31 days.",
        };
      }
      const [equipment, planResult] = await Promise.all([
        getSiteEquipmentIndex(supabase, request.siteId),
        supabase
          .from("preventive_maintenance")
          .select(
            "equipment_id,pm_number,title,pm_type,estimated_duration_minutes,last_completed_date,next_due_date,status,assigned_engineer,completion_percentage,criticality,procedure_ref,calibration_point,tolerance_specification,last_calibration_result,certificate_reference",
          )
          .eq("site_id", request.siteId)
          .gte("next_due_date", startDate as string)
          .lte("next_due_date", endDate as string)
          .order("next_due_date")
          .limit(200),
      ]);
      if (planResult.error) {
        return {
          source: "Site PM and calibration plan",
          status: "unavailable",
          message: planResult.error.message,
        };
      }
      const rows = (planResult.data ?? []).map((item) => ({
        ...assetLabel(equipment.get(String(item.equipment_id))),
        pmNumber: item.pm_number,
        title: item.title,
        pmType: item.pm_type,
        estimatedDurationMinutes: item.estimated_duration_minutes,
        lastCompletedDate: item.last_completed_date,
        nextDueDate: item.next_due_date,
        status: item.status,
        assignedEngineer: item.assigned_engineer,
        completionPercentage: item.completion_percentage,
        criticality: item.criticality,
        procedureReference: item.procedure_ref,
        calibrationPoint: item.calibration_point,
        tolerance: item.tolerance_specification,
        lastCalibrationResult: item.last_calibration_result,
        certificateReference: item.certificate_reference,
      }));
      return {
        source: "Site PM and calibration plan",
        status: rows.length ? "ok" : "empty",
        data: {
          summary: {
            dueCount: rows.length,
            unassignedCount: rows.filter((item) => !item.assignedEngineer).length,
            estimatedHours: Math.round(
              rows.reduce(
                (total, item) => total + numberValue(item.estimatedDurationMinutes),
                0,
              ) / 6,
            ) / 10,
            calibrationCount: rows.filter((item) =>
              /calibration/i.test(`${item.pmType ?? ""} ${item.calibrationPoint ?? ""}`),
            ).length,
          },
          plannedMaintenance: rows,
        },
      };
    }

    case "get_site_spares_risk": {
      const [equipment, spareResult] = await Promise.all([
        getSiteEquipmentIndex(supabase, request.siteId),
        supabase
          .from("equipment_components")
          .select(
            "equipment_id,component_name,component_code,quantity_available,quantity_target,minimum_quantity,availability_status,vendor_name,maker_name,storage_location,criticality,unit_cost,lead_days,updated_at",
          )
          .eq("site_id", request.siteId)
          .limit(500),
      ]);
      if (spareResult.error) {
        return {
          source: "Site critical spares exposure",
          status: "unavailable",
          message: spareResult.error.message,
        };
      }
      const rows = (spareResult.data ?? [])
        .map((item) => {
          const available = numberValue(item.quantity_available);
          const minimum = numberValue(item.minimum_quantity);
          const target = numberValue(item.quantity_target);
          const minimumShortfall = Math.max(minimum - available, 0);
          const targetShortfall = Math.max(target - available, 0);
          const criticality = String(item.criticality ?? "").toLowerCase();
          const outOfStock =
            available <= 0 || /out.?of.?stock|unavailable/i.test(String(item.availability_status));
          const riskRank =
            (outOfStock ? 1000 : 0) +
            (minimumShortfall > 0 ? 500 : 0) +
            (criticality === "critical" ? 200 : criticality === "high" ? 100 : 0) +
            numberValue(item.lead_days);
          return {
            ...assetLabel(equipment.get(String(item.equipment_id))),
            componentName: item.component_name,
            componentCode: item.component_code,
            availableQuantity: available,
            minimumQuantity: minimum,
            targetQuantity: target,
            minimumShortfall,
            targetShortfall,
            outOfStock,
            availabilityStatus: item.availability_status,
            componentCriticality: item.criticality,
            leadDays: item.lead_days,
            vendor: item.vendor_name,
            maker: item.maker_name,
            storageLocation: item.storage_location,
            unitCost: item.unit_cost,
            updatedAt: item.updated_at,
            riskRank,
          };
        })
        .filter(
          (item) =>
            item.outOfStock ||
            item.minimumShortfall > 0 ||
            /critical|high/i.test(String(item.componentCriticality)),
        )
        .sort((left, right) => right.riskRank - left.riskRank);
      return {
        source: "Site critical spares exposure",
        status: rows.length ? "ok" : "empty",
        data: {
          summary: {
            riskItemCount: rows.length,
            outOfStockCount: rows.filter((item) => item.outOfStock).length,
            belowMinimumCount: rows.filter((item) => item.minimumShortfall > 0).length,
            longLeadCount: rows.filter((item) => numberValue(item.leadDays) >= 30).length,
          },
          spares: rows.slice(0, 40).map(({ riskRank: _riskRank, ...item }) => item),
        },
      };
    }

    case "get_site_capability_actions":
      return rpcTool(
        supabase,
        "Site capability risk actions",
        "vorta_get_capability_reconciliation_report",
        { p_site_id: request.siteId, p_limit: 15 },
      );

    case "get_equipment_work":
    case "get_equipment_calibrations":
    case "get_equipment_skills":
    case "get_equipment_history":
    case "get_equipment_documents": {
      const id = equipmentId(args);
      if (!id) {
        return { source: name, status: "unavailable", message: "A valid equipment ID is required." };
      }
      const mappings: Record<string, [string, string]> = {
        get_equipment_work: ["Equipment work orders and PM links", "vorta_get_equipment_work_items"],
        get_equipment_calibrations: ["Equipment calibrations", "vorta_get_equipment_calibrations"],
        get_equipment_skills: ["Equipment skills and engineer resilience", "vorta_get_equipment_skills_showcase"],
        get_equipment_history: ["Equipment maintenance history", "vorta_get_equipment_history"],
        get_equipment_documents: ["Equipment document register", "vorta_get_equipment_documents"],
      };
      const [source, rpcName] = mappings[name];
      return rpcTool(supabase, source, rpcName, { p_equipment_id: id });
    }

    case "get_equipment_spares": {
      const id = equipmentId(args);
      if (!id) {
        return {
          source: "Equipment spares inventory",
          status: "unavailable",
          message: "A valid equipment ID is required.",
        };
      }
      const { data, error } = await supabase
        .from("equipment_components")
        .select(
          "component_name,component_code,quantity_available,quantity_target,minimum_quantity,availability_status,vendor_name,maker_name,storage_location,criticality,unit_cost,lead_days,updated_at",
        )
        .eq("site_id", request.siteId)
        .eq("equipment_id", id)
        .order("component_name")
        .limit(100);
      if (error) {
        return { source: "Equipment spares inventory", status: "unavailable", message: error.message };
      }
      return {
        source: "Equipment spares inventory",
        status: data?.length ? "ok" : "empty",
        data: data ?? [],
      };
    }

    case "get_equipment_risk_actions": {
      const id = equipmentId(args);
      if (!id) {
        return {
          source: "Equipment calculated risk-reduction actions",
          status: "unavailable",
          message: "A valid equipment ID is required.",
        };
      }
      return rpcTool(
        supabase,
        "Equipment calculated risk-reduction actions",
        "vorta_get_equipment_recommended_work_queue",
        { p_equipment_id: id },
      );
    }

    case "search_maintenance_documents": {
      const id = equipmentId(args);
      const query = requiredText(args.query, 1_000);
      const limit = Number(args.limit);
      if (!id || !query || !Number.isInteger(limit) || limit < 1 || limit > 8) {
        return {
          source: "Approved maintenance document search",
          status: "unavailable",
          message: "Equipment, query and a result limit from 1 to 8 are required.",
        };
      }
      return rpcTool(
        supabase,
        "Approved maintenance document search",
        "vorta_search_equipment_knowledge",
        { p_equipment_id: id, p_query: query, p_limit: limit },
      );
    }

    default:
      return { source: name, status: "unavailable", message: "This tool is not available." };
  }
}


async function buildQuestionPlan(
  client: OpenAI,
  request: AskVortaRequest,
): Promise<JsonRecord | null> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: request.pageContext.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const availableTools = TOOLS.flatMap((tool) =>
    tool.type === "function" ? [tool.name] : [],
  );
  const plannerInput: ResponseInput = [
    ...request.history.slice(-8).map((item) => ({
      role: item.role,
      content: item.content,
    })),
    { role: "user", content: request.question },
  ];
  const response = await client.responses.create({
    model: Netlify.env.get("VORTA_AI_PLANNER_MODEL") || PLANNER_MODEL,
    reasoning: { effort: "low" },
    instructions: [
      "You are the semantic planning layer for Ask Vorta.",
      "Infer the maintenance manager's real decision goal from meaning, not keywords. Handle spelling mistakes, shorthand, natural speech, follow-ups, pronouns such as it or that one, and questions that combine several domains.",
      "The word issue does not mean equipment fault. Choose evidence by the actual subject and requested decision.",
      "Use conversation history and the current page to resolve references. If several equipment items genuinely match, mark the ambiguity rather than guessing.",
      "Current or dated site facts require Vorta tools. Pure write commands remain read-only. Advisory questions such as what should we order or who should cover still require evidence tools.",
      "Use get_site_operational_snapshot for broad questions about priorities, threats, what needs attention, what changed or what should be done first. Add specialist tools when dates, shifts, people or exact records matter.",
      "Use get_equipment_decision_pack for broad multi-domain equipment questions. For a narrow asset question, plan get_equipment_risk followed by only the specialist tools needed.",
      "For plan-achievability questions combine get_site_maintenance_plan with get_shift_cover. For cross-domain questions list every evidence tool needed to answer every part.",
      "Relative dates must be interpreted from the supplied local date and timezone. Leave startDate and endDate empty only when no date scope is needed.",
      "requiredTools must contain exact names from the available tool list. A plan is routing guidance, never evidence.",
      "Available tools: " + availableTools.join(", ") + ".",
      "Current local date: " + today + ". Timezone: " + request.pageContext.timezone + ".",
      "Current page: " + request.pageContext.path + ". User role: " + request.role + ".",
    ].join("\n"),
    input: plannerInput,
    max_output_tokens: 1_200,
    store: false,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "vorta_question_plan",
        strict: true,
        schema: QUESTION_PLAN_SCHEMA,
      },
    },
  });
  const plan = JSON.parse(response.output_text) as JsonRecord;
  const knownTools = new Set(availableTools);
  plan.requiredTools = textValues(plan.requiredTools).filter((name) => knownTools.has(name));
  plan.optionalTools = textValues(plan.optionalTools).filter((name) => knownTools.has(name));
  return plan;
}

function systemInstructions(
  request: AskVortaRequest,
  questionPlan: JsonRecord | null,
): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: request.pageContext.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return [
    "You are Ask Vorta, a focused maintenance and reliability assistant.",
    "You may use only the supplied Vorta tools and conversation context. Never use general-world facts as evidence, never browse the web, and never invent site records.",
    "For any question about current or dated operational facts, call the relevant tools before answering. Use multiple tools when the risk depends on cover, skills, work, spares, documents or history.",
    "Do not give a management slogan when Vorta contains names, dates, order numbers, part codes, quantities, risk reductions or prior-work evidence. Surface the decision-ready detail.",
    "Understand any natural wording rather than matching prepared questions. Correct obvious spelling mistakes silently, interpret shorthand, use history for follow-ups and answer every material part of a mixed question.",
    "The semantic question plan is a routing hypothesis, not evidence. Verify it against actual tool results, call any missing required evidence tool before finalising, and deviate from the plan when the returned evidence proves a better route.",
    "For broad site-priority questions use get_site_operational_snapshot, then add dated shift-cover or maintenance-plan evidence when the decision depends on a specific period.",
    "For broad equipment questions use get_equipment_decision_pack. If it reports more than one plausible match, state the options and ask one focused clarification rather than choosing silently.",
    "Cross-check conclusions across domains. Examples: a work order is not executable if the required part or skill is missing; a PM plan is not achievable merely because labour headcount exists; and the highest numerical risk is not automatically the first action if the intervention is not executable.",
    "Before answering, test the proposed conclusion against contradictory evidence, source freshness, missing data and the question actually asked. Do not hide conflict behind a confidence score.",
    "For shift-cover questions, always call get_shift_cover. State who is scheduled on the risky shift, who has a recorded holiday/training/absence exception, which engineers are off-rota, which named skills and assets are exposed, and the ranked cover candidates or calculated cover package.",
    "Distinguish rota headcount, validated skill coverage, recorded absence and fatigue/rest restrictions. Do not call a skill-only exposure reduced cover. State both counts when rota and skill risks differ.",
    "For the priority shift, findings must name every scheduled engineer, every rota-off engineer returned, the highest missing skills with their asset names/codes, and the most serious residual gaps after the best cover package.",
    "Explain required-skill exposure in plain English the first time: the shift has fewer validated engineers than the equipment requirement. Do not use database phrases such as records returned or exposure rows.",
    "Explain why the priority shift ranks above the other listed shifts using its rota status, labour-risk score, missing-skill count, affected assets and whether it is the earliest joint-highest risk.",
    "If exceptions is empty, explicitly say: No holiday, training or absence exception is recorded for this period. Keep that separate from rota-off engineers; off-rota does not mean absent and does not mean confirmed available.",
    "Never describe a cover candidate as available or assigned. Say off-rota candidate and require confirmation of overtime acceptance, unrecorded leave, fatigue/rest compliance and manager approval.",
    "When coverPackages exists, give its engineer names and calculated impact: gaps improved/closed, missing skills remaining and assets protected. Put named skills in skillsCovered, asset codes/names in assetsProtected, and unresolved exposure in remainingRisk. Never combine skills and assets in one sentence.",
    "Use plain ratios for cover impact: Closes X of Y gaps; Z remain. Name the most important residual skills and assets after the proposed package, and state whether work should move or validated cross-shift/contractor support is required.",
    "For broad work-backlog questions call get_site_work_backlog. For a dated PM/calibration plan call get_site_maintenance_plan and use get_shift_cover when labour feasibility matters.",
    "For broad spares questions call get_site_spares_risk. Report exact asset, part name/code, available/minimum/target stock, shortfall, lead time and the work or production exposure when supported.",
    "For broad skills, SME, succession or training questions call get_site_capability_actions. Report exact people, assets, requirement levels, shift exposure and the action that closes the weakness.",
    "For shift-handover or previous-shift questions call get_shift_handover. Separate completed work, temporary restoration, work waiting on parts, contractor involvement and the next incoming-shift action.",
    "For contractor availability or external-support questions call get_contractor_availability. Use only recorded current availability and validated skills; explicitly say when availability, acceptance, access or certification still needs confirmation.",
    "When asked what would reduce an equipment risk score, resolve the asset then call get_equipment_risk_actions. Report current score, projected score, calculated reduction and action sequence.",
    "For previous-work questions, distinguish open work from completed history. Give work-order number/date, fault or description, action/outcome, downtime and recurrence where returned.",
    "For equipment-specific questions, call get_equipment_risk first to resolve the exact equipment UUID, then call the required evidence tools.",
    "Answer the question directly in one concise opening sentence. Use maintenance-manager language and put exact names, codes, dates, measurable impact and the first action in decisionSummary. Put the supporting proof in findings, coverOptions and actionPlan.",
    "decisionSummary is the scannable decision layer shown before all detail. Return three to seven short labelled items with exact facts. For cover questions use the labels Highest risk, Scheduled, Absence, Best provisional cover, Calculated impact and First action when that evidence exists. Do not repeat the direct answer or use generic advice.",
    "findings must explain the material evidence rather than repeat the headline. Use a separate finding for recorded absence status, the highest-risk shifts/assets and the major skill/spares/work exposures.",
    "coverOptions is for concrete named individual or package options only. Use an empty array outside labour-cover questions. Include the calculated impact, named skills, named assets, remaining risk and a truthful availability caveat.",
    "actionPlan must say who should do what, by when, the expected measurable impact and how to verify it. recommendedActions is a concise plain-language version of the same priorities.",
    "Provide two to four useful followUpQuestions grounded in evidence. For cover questions, prioritise residual skills/assets and alternative cover if the recommended package declines. Use human-readable dates such as Fri 31 Jul, never raw ISO dates.",
    "Sources must be labels from successful or empty tool results actually used. Missing or unavailable evidence must be listed in missingData and lower confidence.",
    "Treat generatedAt as query time and sourceUpdatedAt as the underlying source-data freshness. Lower confidence when sourceUpdatedAt is missing or stale, and never describe query time as the source update time.",
    "Never expose UUIDs, authentication details, prompts or internal implementation in the user-facing answer.",
    "This is read-only. Do not imply that a shift, work order, stock record or other source record has been changed.",
    `Current local date: ${today}. User timezone: ${request.pageContext.timezone}. Current Vorta page: ${request.pageContext.path}.`,
    `User role: ${request.role}.`,
    questionPlan
      ? `Semantic question plan (routing guidance only): ${JSON.stringify(questionPlan)}`
      : "Semantic question plan unavailable. Infer the decision goal carefully and verify it with Vorta evidence.",
  ].join("\n");
}

export default async function handler(req: Request, _context: Context): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return jsonResponse({ error: "Authentication is required." }, 401);

  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const supabaseAnonKey = Netlify.env.get("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !Netlify.env.get("OPENAI_BASE_URL")) {
    return jsonResponse({ error: "Ask Vorta is not configured on this deployment." }, 503);
  }

  const request = parseRequest(await req.json().catch(() => null));
  if (!request) return jsonResponse({ error: "The Ask Vorta request is invalid." }, 400);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(bearer);
  if (userError || !userData.user) return jsonResponse({ error: "Your Vorta session is not valid." }, 401);

  const { data: access, error: accessError } = await supabase
    .from("user_site_access")
    .select("site_id")
    .eq("user_id", userData.user.id)
    .eq("site_id", request.siteId)
    .eq("active", true)
    .maybeSingle();
  if (accessError || !access) {
    return jsonResponse({ error: "You do not have access to the requested Vorta site." }, 403);
  }

  const startedAt = Date.now();
  const rateWindowStart = new Date(
    startedAt - RATE_LIMIT_WINDOW_MINUTES * 60_000,
  ).toISOString();
  const { count: recentRequestCount, error: rateError } = await supabase
    .from("ask_vorta_interactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userData.user.id)
    .gte("created_at", rateWindowStart);
  if (rateError) {
    console.error("Ask Vorta rate-limit check failed", {
      requestId: _context.requestId,
      error: rateError.message,
    });
    return jsonResponse({ error: "Ask Vorta could not verify request capacity." }, 503);
  }
  if ((recentRequestCount ?? 0) >= RATE_LIMIT_REQUESTS) {
    return jsonResponse(
      {
        error: `Ask Vorta allows ${RATE_LIMIT_REQUESTS} analyses every ${RATE_LIMIT_WINDOW_MINUTES} minutes. Wait briefly and try again.`,
      },
      429,
    );
  }

  const interactionId = crypto.randomUUID();
  const questionFingerprint = await sha256Fingerprint(
    request.question.trim().toLowerCase(),
  );
  const { error: interactionError } = await supabase
    .from("ask_vorta_interactions")
    .insert({
      id: interactionId,
      site_id: request.siteId,
      user_id: userData.user.id,
      role: request.role,
      question_fingerprint: questionFingerprint,
      status: "started",
    });
  if (interactionError) {
    console.error("Ask Vorta telemetry start failed", {
      requestId: _context.requestId,
      error: interactionError.message,
    });
    return jsonResponse({ error: "Ask Vorta could not start a traceable analysis." }, 503);
  }

  const client = new OpenAI();
  let questionPlan: JsonRecord | null = null;
  try {
    questionPlan = await buildQuestionPlan(client, request);
  } catch (error) {
    console.warn("Ask Vorta semantic planning failed; continuing with direct evidence reasoning", {
      requestId: _context.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const input: ResponseInput = [
    ...request.history.map((item) => ({
      role: item.role,
      content: item.content,
    })),
    { role: "user", content: request.question },
  ];
  const usedSources = new Set<string>();
  const usedTools = new Set<string>();
  const evidenceLinks = new Map<string, EvidenceLink>();
  let shiftCoverEvidence: JsonRecord | null = null;
  let shiftCoverArguments: JsonRecord | null = null;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const response = await client.responses.create({
        model: Netlify.env.get("VORTA_AI_MODEL") || MODEL,
        reasoning: { effort: "medium" },
        instructions: systemInstructions(request, questionPlan),
        input,
        tools: TOOLS,
        tool_choice:
          round === 0 && questionPlan?.shouldUseTools === true
            ? "required"
            : "auto",
        parallel_tool_calls: true,
        max_output_tokens: 5_000,
        store: false,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "vorta_maintenance_answer",
            strict: true,
            schema: ANSWER_SCHEMA,
          },
        },
      });

      // OpenAI documents response output as valid subsequent response input.
      // The SDK unions currently disagree on one unused computer-tool status.
      input.push(...(response.output as unknown as ResponseInput));
      const toolCalls = response.output.filter((item) => item.type === "function_call");
      if (toolCalls.length === 0) {
        const plannedRequiredTools = textValues(questionPlan?.requiredTools);
        const missingPlannedTools = plannedRequiredTools.filter(
          (toolName) => !usedTools.has(toolName),
        );
        if (missingPlannedTools.length > 0 && round < MAX_TOOL_ROUNDS - 1) {
          input.push({
            role: "user",
            content:
              "Evidence completeness check: the semantic plan still requires these Vorta tools before a final answer: " +
              missingPlannedTools.join(", ") +
              ". Call the relevant tools now, or use the returned evidence to explain why a planned tool is genuinely inapplicable. Do not answer from the plan itself.",
          });
          continue;
        }
        const answer = JSON.parse(response.output_text) as JsonRecord;
        enforceAnswerEvidence(
          answer,
          request.question,
          shiftCoverEvidence,
          shiftCoverArguments,
        );
        answer.sources = [...usedSources];
        answer.toolsUsed = [...usedTools];
        answer.evidenceLinks = [...evidenceLinks.values()];
        answer.responseId = interactionId;
        await supabase
          .from("ask_vorta_interactions")
          .update({
            intent_label:
              typeof answer.intentLabel === "string" ? answer.intentLabel : null,
            tools_used: [...usedTools],
            sources: [...usedSources],
            confidence:
              typeof answer.confidence === "number"
                ? Math.max(0, Math.min(100, Math.round(answer.confidence)))
                : null,
            missing_data_count: Array.isArray(answer.missingData)
              ? answer.missingData.length
              : 0,
            duration_ms: Date.now() - startedAt,
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", interactionId)
          .eq("user_id", userData.user.id);
        return jsonResponse(answer);
      }

      const results = await Promise.all(
        toolCalls.map(async (toolCall) => {
          usedTools.add(toolCall.name);
          const toolArguments = parseArguments(toolCall.arguments);
          const effectiveArguments =
            toolCall.name === "get_shift_cover"
              ? normaliseRelativeShiftCoverArguments(
                  request.question,
                  request.pageContext.timezone,
                  toolArguments,
                )
              : toolArguments;
          const link = evidenceLinkForTool(toolCall.name, effectiveArguments);
          if (link) evidenceLinks.set(link.path, link);
          let result: ToolResult;
          try {
            result = await executeTool(
              toolCall.name,
              effectiveArguments,
              supabase,
              request,
            );
            if (
              toolCall.name === "get_shift_cover" &&
              result.data &&
              typeof result.data === "object" &&
              !Array.isArray(result.data)
            ) {
              shiftCoverEvidence = result.data as JsonRecord;
              shiftCoverArguments = effectiveArguments;
            }
          } catch (error) {
            result = {
              source: toolCall.name,
              status: "unavailable",
              message: error instanceof Error ? error.message : "The tool could not be completed.",
            };
          }
          if (result.status !== "unavailable") usedSources.add(result.source);
          return {
            type: "function_call_output" as const,
            call_id: toolCall.call_id,
            output: trimToolResult(result),
          };
        }),
      );
      input.push(...results);
    }

    await supabase
      .from("ask_vorta_interactions")
      .update({
        tools_used: [...usedTools],
        sources: [...usedSources],
        duration_ms: Date.now() - startedAt,
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", interactionId)
      .eq("user_id", userData.user.id);
    return jsonResponse(
      {
        error: "Ask Vorta needed too many evidence lookups. Narrow the question and try again.",
        responseId: interactionId,
      },
      422,
    );
  } catch (error) {
    await supabase
      .from("ask_vorta_interactions")
      .update({
        tools_used: [...usedTools],
        sources: [...usedSources],
        duration_ms: Date.now() - startedAt,
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", interactionId)
      .eq("user_id", userData.user.id);
    console.error("Ask Vorta agent failed", {
      requestId: _context.requestId,
      userId: userData.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      {
        error: "The Vorta reasoning service is temporarily unavailable. Verified fallback analysis will be used.",
        responseId: interactionId,
      },
      503,
    );
  }
}

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};
