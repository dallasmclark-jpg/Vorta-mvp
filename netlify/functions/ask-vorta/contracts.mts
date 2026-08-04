import type { ResponseInput, Tool } from "openai/resources/responses/responses";
import type {
  ValidatedAskVortaImage,
} from "../_shared/askVortaImageEvidence.mjs";
import type {
  ConversationContext,
  ConversationContextOption,
  ConversationContextResolution,
  ConversationContextSubject,
} from "../_shared/askVortaConversationContext.mjs";

export type JsonRecord = Record<string, unknown>;

export interface RequestHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface PageContext {
  path: string;
  timezone: string;
}

export interface AskVortaRequest {
  question: string;
  role: string;
  siteId: string;
  history: RequestHistoryItem[];
  conversationContext: ConversationContext | null;
  image: ValidatedAskVortaImage | null;
  pageContext: PageContext;
}

export interface ToolResult {
  source: string;
  status: "ok" | "empty" | "unavailable";
  data?: unknown;
  message?: string;
}

export const MODEL = "gpt-5.6-terra";

export const PLANNER_MODEL = "gpt-5.6-luna";

export const MAX_TOOL_ROUNDS = 8;

export const MAX_TOOL_OUTPUT_CHARACTERS = 50_000;

export const RATE_LIMIT_WINDOW_MINUTES = 5;

export const RATE_LIMIT_REQUESTS = 12;

export const PLANNER_TIMEOUT_MS = 12_000;

export const EVIDENCE_TIMEOUT_MS = 15_000;

export const ANSWER_TIMEOUT_MS = 40_000;

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ALLOWED_ROLES = new Set([
  "maintenance-manager",
  "maintenance-planner",
  "reliability-engineer",
  "engineer",
  "production-manager",
  "operator",
  "contractor",
]);

export const EMPTY_PARAMETERS = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
} as const;

export const EQUIPMENT_ID_PARAMETERS = {
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

export const TOOLS: Tool[] = [
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
      "Get the authorised asset's deterministic operational-value ranking, including current/projected risk, calculated reduction, readiness dependencies, score components, owner, confidence and verification. Use when asked what changes would reduce an asset's risk or what should be done first.",
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

export const SITE_DECISION_PACK_COVERAGE = new Set([
  "get_site_risk",
  "get_site_work_backlog",
  "get_site_spares_risk",
  "get_site_capability_actions",
  "get_shift_handover",
]);

export const EQUIPMENT_DECISION_PACK_COVERAGE = new Set([
  "get_equipment_risk",
  "get_equipment_work",
  "get_equipment_calibrations",
  "get_equipment_skills",
  "get_equipment_spares",
  "get_equipment_risk_actions",
  "get_equipment_history",
  "get_equipment_documents",
]);

export function successfulToolNames(outcomes: Map<string, ToolResult>): Set<string> {
  return new Set(
    [...outcomes.entries()]
      .filter(([, result]) => result.status === "ok")
      .map(([name]) => name),
  );
}

export function decisionPackCoveringTool(
  toolName: string,
  successfulTools: Set<string>,
): string | null {
  if (
    successfulTools.has("get_site_operational_snapshot") &&
    SITE_DECISION_PACK_COVERAGE.has(toolName)
  ) {
    return "get_site_operational_snapshot";
  }
  if (
    successfulTools.has("get_equipment_decision_pack") &&
    EQUIPMENT_DECISION_PACK_COVERAGE.has(toolName)
  ) {
    return "get_equipment_decision_pack";
  }
  return null;
}

export const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    directAnswer: { type: "string" },
    decisionSummary: {
      type: "array",
      minItems: 1,
      maxItems: 5,
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
      minItems: 0,
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
      minItems: 0,
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
      minItems: 0,
      items: { type: "string" },
      maxItems: 3,
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

export const QUESTION_PLAN_SCHEMA = {
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

export type AskVortaPhase = "planner" | "evidence" | "answer";

export interface EvidenceLink {
  label: string;
  path: string;
  recordType: "shift" | "handover" | "equipment" | "work" | "spare" | "skill" | "document" | "risk";
}
