import OpenAI from "openai";
import type { ResponseInput, Tool } from "openai/resources/responses/responses";
import {
  contextResolutionPrompt,
  createConversationContext,
  resolveConversationFollowUp,
  sanitizeConversationContext,
} from "../_shared/askVortaConversationContext.mjs";
import type { AskVortaRequest, JsonRecord } from "./contracts.mjs";
import { PLANNER_MODEL, PLANNER_TIMEOUT_MS, QUESTION_PLAN_SCHEMA, TOOLS } from "./contracts.mjs";
import { withPhaseTimeout } from "./phase-runtime.mjs";
import { extractEquipmentReference, textValues } from "./utilities.mjs";

function parseEnglishDateRange(
  question: string,
): { startDate: string; endDate: string } | null {
  const months: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  const monthPattern =
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const normalized = question
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[,–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const toIsoDate = (
    dayText: string,
    monthText: string,
    yearText: string,
  ): string | null => {
    const day = Number(dayText);
    const month = months[monthText.slice(0, 3)];
    const year = Number(yearText);
    if (!month || !Number.isInteger(day) || !Number.isInteger(year)) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  };

  const rangeMatch = normalized.match(
    new RegExp(
      `\\b(?:from\\s+|between\\s+)(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})(?:\\s+(\\d{4}))?\\s+(?:to|and)\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})(?:\\s+(\\d{4}))?\\b`,
      "i",
    ),
  );
  if (rangeMatch) {
    const sharedYear = rangeMatch[6] || rangeMatch[3];
    if (!sharedYear) return null;
    const startDate = toIsoDate(
      rangeMatch[1],
      rangeMatch[2],
      rangeMatch[3] || sharedYear,
    );
    const endDate = toIsoDate(
      rangeMatch[4],
      rangeMatch[5],
      rangeMatch[6] || sharedYear,
    );
    if (!startDate || !endDate || startDate > endDate) return null;
    return { startDate, endDate };
  }

  const singleMatch = normalized.match(
    new RegExp(
      `\\b(?:on\\s+|for\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\s+(\\d{4})\\b`,
      "i",
    ),
  );
  if (!singleMatch) return null;
  const date = toIsoDate(singleMatch[1], singleMatch[2], singleMatch[3]);
  return date ? { startDate: date, endDate: date } : null;
}

export function deterministicQuestionPlan(
  request: AskVortaRequest,
): JsonRecord | null {
  const question = request.question
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\bwot\b/g, "what")
    .replace(/\bshud\b/g, "should")
    .replace(/\brite\b/g, "right")
    .replace(/\bproblms?\b/g, "problems")
    .replace(/\btomor+ow\b/g, "tomorrow")
    .replace(/\bcalabrations?\b/g, "calibrations")
    .replace(/\bvacum\b/g, "vacuum")
    .replace(/\bwhats\b/g, "what is");

  const explicitCoverRange = parseEnglishDateRange(request.question);
  const absoluteWorkforceQuestion =
    explicitCoverRange !== null &&
    /\b(?:who(?:'s| is)? off|holiday|absence|leave|training|available|availability|cover|coverage|rest conflict|fatigue|rota|engineers?|team|shift)\b/.test(
      question,
    );

  const contextText = [...request.history.map((item) => item.content), request.question].join(" ");
  const explicitEquipment = extractEquipmentReference(request.question);
  const historicalEquipment = extractEquipmentReference(contextText);
  const pronounFollowUp = /\b(?:it|that one|that asset|the asset|what part|what spare)\b/i.test(
    request.question,
  );
  const equipmentQuery = explicitEquipment ?? (pronounFollowUp ? historicalEquipment : null);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: request.pageContext.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dateWithOffset = (days: number): string => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const nextWeekRange = (): { startDate: string; endDate: string } => {
    const date = new Date(`${today}T12:00:00Z`);
    const weekday = date.getUTCDay();
    const daysToMonday = weekday === 0 ? 1 : 8 - weekday;
    const start = new Date(date);
    start.setUTCDate(start.getUTCDate() + daysToMonday);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  };

  const fastPlan = (
    scope: string,
    intentLabel: string,
    toolNames: string | string[],
    answerFocus: string,
    options: {
      startDate?: string;
      endDate?: string;
      summaryItemLimit?: number;
      forceActionPlan?: boolean;
      equipmentQuery?: string;
      followUpLimit?: number;
    } = {},
  ): JsonRecord => ({
    intentLabel,
    decisionGoal: request.question,
    scope,
    shouldUseTools: true,
    requiredTools: Array.isArray(toolNames) ? toolNames : [toolNames],
    optionalTools: [],
    equipmentQuery: options.equipmentQuery ?? "",
    startDate: options.startDate ?? "",
    endDate: options.endDate ?? "",
    ambiguity: "none",
    answerFocus,
    verificationChecks: [
      "Use only current authorised Vorta evidence.",
      "Use relevant decisionFacts and exact names, codes, work orders, skills and approved evidence returned by the tools.",
    ],
    routingMode: "deterministic",
    summaryItemLimit: options.summaryItemLimit ?? 4,
    forceActionPlan: options.forceActionPlan ?? false,
    followUpLimit: options.followUpLimit ?? 1,
  });

  if (equipmentQuery && !absoluteWorkforceQuestion) {
    const actionRequested = /\b(?:what (?:do|should)|do first|fix(?:ing|ed)?|repair(?:ing|ed)?|stopping|block(?:ing|ed)?|preventing|let .* run|next shift|can we|qualified|diagnos(?:e|is)|before acting|safest|next action|release(?:d)?|authori[sz]e|risk reduction|required action|must be verified|verify|verification|confirm(?:ed|ing)?|after repair|evidence (?:is )?required|required evidence|intervention|return(?:ing)?|calibrat|checked next|repeats?|what caused|which reading|at risk|instrument fault|permanent correction)\b/.test(
      question,
    );
    return fastPlan(
      "equipment",
      "equipment_decision",
      "get_equipment_decision_pack",
      "Resolve the exact asset and answer with decisive named evidence from decisionFacts, including relevant fault codes, work orders, components, skills, engineers and approved verification evidence.",
      {
        equipmentQuery,
        summaryItemLimit: 4,
        forceActionPlan: actionRequested,
      },
    );
  }

  const hasConversationHistory = request.history.length > 0;

  if (
    /\b(?:handover|hand over|previous shift|last shift|nights? (?:leave|left)|days? (?:leave|left)|left us|incoming shift)\b/.test(
      question,
    )
  ) {
    return fastPlan(
      "handover",
      "shift_handover",
      "get_shift_handover",
      "Summarise what the previous shift completed, left ongoing or waiting, and the next action using no more than three decision summary items.",
      { summaryItemLimit: 3 },
    );
  }

  const coverDate = /\btomorrow\b/.test(question)
    ? dateWithOffset(1)
    : /\btoday\b/.test(question)
      ? dateWithOffset(0)
      : null;
  const nextWeek = /\b(?:next|following) week\b/.test(question);
  const thisWeek = /\b(?:this|current) week\b/.test(question);
  const thisWeekRange = (): { startDate: string; endDate: string } => {
    const date = new Date(`${today}T12:00:00Z`);
    const weekday = date.getUTCDay();
    const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
    const start = new Date(date);
    start.setUTCDate(start.getUTCDate() - daysFromMonday);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  };
  const requestedCoverRange =
    explicitCoverRange ??
    (nextWeek
      ? nextWeekRange()
      : thisWeek
        ? thisWeekRange()
        : { startDate: coverDate ?? today, endDate: coverDate ?? today });
  const planAndCover =
    /\b(?:pm|calibration|maintenance plan|planned work|workload|jobs?)\b/.test(question) &&
    /\b(?:cover|coverage|people|available|availability|rota|complete|achievable|slip)\b/.test(question);
  if (planAndCover && (explicitCoverRange || coverDate || nextWeek || thisWeek)) {
    return fastPlan(
      "mixed",
      "maintenance_plan_cover_feasibility",
      ["get_site_maintenance_plan", "get_shift_cover"],
      "Compare the dated PM/calibration workload with the actual rota and validated skills. State what is achievable, what will slip and the first mitigation.",
      { ...requestedCoverRange, summaryItemLimit: 5, forceActionPlan: true },
    );
  }

  const explicitShiftCoverQuestion =
    /\bshift[- ]?cover\b/.test(question) ||
    /\b(?:rota|off[- ]?rota|rest conflict|fatigue|reduced cover|skills? cover|labour cover)\b/.test(question);
  const staffingWriteRequest =
  /^\s*(?:please\s+)?(?:assign|move|switch|update|change)\b/.test(question) &&
  /\b(?:cover|engineers?|people|team|shift|rota)\b/.test(question);
  const datedWorkforceQuestion =
    (explicitCoverRange !== null || coverDate !== null || nextWeek || thisWeek) &&
    /\b(?:who(?:'s| is)? off|holiday|absence|leave|training|available|availability|cover|coverage|shift|engineers?|team|people)\b/.test(question);
  const shiftCoverPageContext = /\bshift-cover\b/.test(request.pageContext.path);
  const recentConversation = request.history
    .slice(-2)
    .map((item) => item.content.toLowerCase())
    .join(" ");
  const inheritedShiftCoverContext =
    /\b(?:shift[- ]?cover|rota|off[- ]?rota|reduced cover|rest conflict|fatigue|holiday|absence|validated[- ]skill)\b/.test(
      recentConversation,
    ) &&
    /\b(?:what about|and|how about|next week|this week|tomorrow|today|same shift|that shift|those shifts)\b/.test(
      question,
    );
  const asksForCoverDecision =
    /\b(?:risk|issue|gap|short|cover|coverage|available|availability|off|holiday|absence|leave|training|rest|fatigue|rota|engineers?|team|people)\b/.test(question);
  if (
    (shiftCoverPageContext ||
      staffingWriteRequest ||
      (asksForCoverDecision &&
        (explicitShiftCoverQuestion || datedWorkforceQuestion || inheritedShiftCoverContext))) &&
    !/\b(?:document cover|insurance cover|cover image|cover photo|cover page)\b/.test(question) &&
    !/\b(?:evidence|prove|confirm|picture)\b/.test(question)
  ) {
    return fastPlan(
      "shift_cover",
      "shift_cover_risk",
      "get_shift_cover",
      staffingWriteRequest
      ? "State that Ask Vorta is read-only and cannot assign engineers or change the rota, then provide the best evidence-backed provisional cover recommendation and confirmation steps."
      : "Identify the dated rota and validated-skill cover risks, then give the best evidence-backed cover action.",
      { ...requestedCoverRange, summaryItemLimit: 5, forceActionPlan: true },
    );
  }


  if (hasConversationHistory) return null;

  const evidenceFreshnessRequest =
    /\b(?:how fresh|freshness|last updated|source update|updated evidence|evidence timestamp)\b/.test(question) &&
    /\b(?:site[- ]?risk|risk answer|evidence)\b/.test(question);
  if (evidenceFreshnessRequest) {
    return fastPlan(
      "site_risk",
      "site_evidence_freshness",
      "get_site_risk",
      "Report the newest and oldest source-update timestamps behind the current site-risk evidence and distinguish source freshness from query time.",
      { summaryItemLimit: 3, followUpLimit: 0 },
    );
  }

  if (/\b(?:what .*cannot prove|what .*can not prove|not prove|missing evidence|evidence .*missing|available evidence|cannot confirm|can not confirm|unproven|incomplete picture)\b/.test(question)) {
    return fastPlan(
      "site_priorities",
      "site_missing_evidence",
      "get_site_operational_snapshot",
      "State which maintenance domains are proven, unavailable or empty and what real-world confirmations remain outside the recorded evidence.",
      { summaryItemLimit: 5, followUpLimit: 1 },
    );
  }

  if (/\b(?:morning maintenance meeting|morning meeting|three things .* say|three points .* meeting)\b/.test(question)) {
    return fastPlan(
      "site_priorities",
      "morning_maintenance_briefing",
      "get_site_operational_snapshot",
      "Return exactly three evidence-backed briefing points covering current risk, work and the most material spare, skill or handover constraint.",
      { summaryItemLimit: 3, followUpLimit: 0 },
    );
  }

  if (/\b(?:single|one) maintenance intervention\b/.test(question) && /\b(?:biggest|highest|largest).*risk reduction\b/.test(question)) {
    return fastPlan(
      "site_priorities",
      "verified_risk_reduction_ranking",
      "get_site_operational_snapshot",
      "Return the single highest verified risk-reduction intervention from the current calculated site action evidence, with one executable actionPlan item.",
      { summaryItemLimit: 4, forceActionPlan: true, followUpLimit: 1 },
    );
  }

  if (/\b(?:contractors?|external support|on[- ]call|remote support|onsite support|plc support)\b/.test(question)) {
    return fastPlan(
      "contractor",
      "contractor_support",
      "get_contractor_availability",
      "Report only recorded contractor skills and availability, with the first confirmation action and any caveat.",
      { summaryItemLimit: 4, forceActionPlan: true },
    );
  }

  if (/\b(?:(?:which|what) (?:plant )?area (?:currently )?(?:has|carries|holds|is carrying) (?:the )?highest (?:maintenance )?risk|highest[- ]risk (?:plant )?area)\b/.test(question)) {
    return fastPlan(
      "site_risk",
      "highest_current_area_risk",
      "get_site_risk",
      "Name the highest-risk area and the exact current score without padding the factual answer.",
      { summaryItemLimit: 3 },
    );
  }

  if (/\b(?:spares?|stock(?:out)?|inventory|parts?|lead time|shortfall|what should (?:we|i) order|what (?:bit|part|spare) should (?:we|i) (?:buy|get|order) first|what should (?:we|i) (?:buy|get) first)\b/.test(question)) {
    const asksForAction = /\b(?:buy|get|order|do) first\b/.test(question);
    return fastPlan(
      "spares",
      "spares_priority",
      "get_site_spares_risk",
      "Identify the most urgent spare using stock, minimum, target, shortfall, criticality and lead time, and state the first purchasing action when requested.",
      { summaryItemLimit: 4, forceActionPlan: asksForAction },
    );
  }

  const maintenancePlanOnly =
    /\b(?:pm|pms|planned maintenance|preventive maintenance|calibration|calibrations|calibrate|due next|due this week|next seven days)\b/.test(question) &&
    !/\b(?:cover|coverage|people|available|availability|rota|achievable|complete|slip)\b/.test(question);
  if (maintenancePlanOnly) {
    const includesOverdue = /\boverdue\b/.test(question);
    const asksNextSevenDays = /\b(?:next seven days|next 7 days)\b/.test(question);
    return fastPlan(
      "maintenance_plan",
      "maintenance_plan",
      "get_site_maintenance_plan",
      "Report the dated PM and calibration work requested, separating overdue items from the next due work and naming the asset, due date and assignee where recorded.",
      {
        startDate: includesOverdue ? dateWithOffset(-21) : dateWithOffset(0),
        endDate: asksNextSevenDays ? dateWithOffset(7) : dateWithOffset(10),
        summaryItemLimit: 4,
      },
    );
  }

  if (/\b(?:backlog|open work|overdue work|unassigned work|work orders?)\b/.test(question)) {
    return fastPlan(
      "work",
      "work_backlog",
      "get_site_work_backlog",
      "Prioritise the current work backlog using exact orders, assets, dates and readiness evidence, then state the first executable action.",
      { summaryItemLimit: 4, forceActionPlan: true },
    );
  }

  if (/\b(?:skills?|sme|single[- ]point|single person|one person deep|only one person|succession|capability|training priorit(?:y|ies))\b/.test(question)) {
    return fastPlan(
      "skills",
      "capability_risk",
      "get_site_capability_actions",
      "Identify the highest capability dependency and the evidence-backed action that reduces it.",
      { summaryItemLimit: 4 },
    );
  }

  if (
    !/\bshift-cover\b/.test(request.pageContext.path) &&
    /\b(?:biggest (?:maintenance )?(?:risks?|threats?|problems?)|maintenance threats?|site priorit(?:y|ies)|what needs attention|what should (?:i|we) (?:do|review|worry about) first|what should (?:i|we) worry about|what should (?:i|we) be (?:most )?worried about|what could stop (?:the )?site|what is likely to bite us)\b/.test(question)) {
    return fastPlan(
      "site_priorities",
      "site_threat_prioritization",
      "get_site_operational_snapshot",
      "Rank the main current maintenance threats, state the first executable action and return one actionPlan item for it.",
      { summaryItemLimit: 4, forceActionPlan: true },
    );
  }

  return null;
}

export async function buildQuestionPlan(
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
    { role: "user", content: request.question.trim() },
  ];
  const response = await withPhaseTimeout(
    "planner",
    PLANNER_TIMEOUT_MS,
    (signal) =>
      client.responses.create(
        {
          model: Netlify.env.get("VORTA_AI_PLANNER_MODEL") || PLANNER_MODEL,
          reasoning: { effort: "low" },
          instructions: [
            "You are the semantic planning layer for Ask Vorta.",
            "Infer the maintenance manager's real decision goal from meaning, not keywords. Handle spelling mistakes, shorthand, natural speech, follow-ups, pronouns such as it or that one, and questions that combine several domains.",
            "The word issue does not mean equipment fault. Choose evidence by the actual subject and requested decision.",
            "Use conversation history and the current page to resolve references. If several equipment items genuinely match, mark the ambiguity rather than guessing.",
            "Current or dated site facts require Vorta tools. Pure write commands remain read-only. Advisory questions such as what should we order or who should cover still require evidence tools.",
            "Use get_site_operational_snapshot for broad questions about priorities, threats, what needs attention, what changed or what should be done first. Add specialist tools only when a narrower date, person or record query is not included in the pack.",
            "Decision packs already include their named specialist domains. Never require a decision pack and its covered specialist tools in the same plan unless the specialist query is materially narrower than the pack.",
            "Use get_equipment_decision_pack for broad multi-domain equipment questions. For a narrow asset question, plan get_equipment_risk followed by only the specialist tools needed.",
            "For plan-achievability questions combine get_site_maintenance_plan with get_shift_cover. For cross-domain questions list every evidence tool needed to answer every part.",
            "Relative dates must be interpreted from the supplied local date and timezone. Leave startDate and endDate empty only when no date scope is needed.",
            "requiredTools must contain exact names from the available tool list. A plan is routing guidance, never evidence.",
            "Available tools: " + availableTools.join(", ") + ".",
            "Current local date: " + today + ". Timezone: " + request.pageContext.timezone + ".",
            "Current page: " + request.pageContext.path + ". User role: " + request.role + ".",
      "Validated structured conversation context: " +
        contextResolutionPrompt(
          resolveConversationFollowUp(request.question, request.conversationContext),
        ) +
        ". Explicit equipment, area, shift and date wording in the current question overrides inherited context.",
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
        },
        { signal },
      ),
  );
  const plan = JSON.parse(response.output_text) as JsonRecord;
  const knownTools = new Set(availableTools);
  plan.requiredTools = textValues(plan.requiredTools).filter((name) => knownTools.has(name));
  plan.optionalTools = textValues(plan.optionalTools).filter((name) => knownTools.has(name));
  return plan;
}

export function systemInstructions(
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
    "When deterministic routing has already preloaded verified Vorta evidence, use that evidence directly and do not request another tool.",
    "Do not give a management slogan when Vorta contains names, dates, order numbers, part codes, quantities, risk reductions or prior-work evidence. Surface the decision-ready detail.",
    "Understand any natural wording rather than matching prepared questions. Correct obvious spelling mistakes silently, interpret shorthand, use history for follow-ups and answer every material part of a mixed question.",
    "When image evidence is supplied, observed text and visual candidates are unverified visual evidence. Exact equipment or component claims require an exact visible code or part identifier plus an authorised Vorta match. Manufacturer or model resemblance alone is never exact. Use approved/current documents, recorded history and spares only after the Vorta match is established. Do not recommend bypassing protection, resetting an interlock or returning equipment to service from a photo alone.",
    "Use this validated structured conversation context for pronouns, ordinal choices and inherited dates: " +
      contextResolutionPrompt(
        resolveConversationFollowUp(request.question, request.conversationContext),
      ) +
      ". Never let inherited context override explicit wording, and ask one concise clarification when the resolver marks the reference ambiguous.",
    "The semantic question plan is a routing hypothesis, not evidence. Verify it against actual tool results, call any missing required evidence tool before finalising, and deviate from the plan when the returned evidence proves a better route.",
    "For broad site-priority questions use get_site_operational_snapshot, then add dated shift-cover or maintenance-plan evidence only when the decision depends on a specific period not covered by the snapshot. Treat its rankedActions domain as the deterministic operational-value order: ready work must remain ahead of blocked work, and every recommendation must retain the returned score components, dependencies, owner and verification.",
    "Do not repeat a specialist lookup when a successful site or equipment decision pack already contains equivalent evidence. Reuse the pack and spend the remaining tool budget only on genuinely narrower evidence.",
    "For broad equipment questions use get_equipment_decision_pack. If it reports more than one plausible match, state the options and ask one focused clarification rather than choosing silently.",
    "When an equipment decision pack returns decisionFacts, treat them as the decisive evidence index. Use the relevant exact equipment code, fault code, work-order number, component code, named skill, named engineer and approved verification fact in the answer rather than replacing them with generic prose.",
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
    "When asked what would reduce an equipment risk score, resolve the asset then call get_equipment_risk_actions. Report the returned operational rank, current/projected score, calculated reduction, feasibility dependencies, score components, owner, confidence and verification; never present blocked work as immediately executable.",
    "For previous-work questions, distinguish open work from completed history. Give work-order number/date, fault or description, action/outcome, downtime and recurrence where returned.",
    "For equipment-specific questions, call get_equipment_risk first to resolve the exact equipment UUID, then call the required evidence tools.",
    "Answer the question directly in one concise opening sentence. Use maintenance-manager language and put exact names, codes, dates, measurable impact and the first action in decisionSummary. Put the supporting proof in findings, coverOptions and actionPlan.",
    "decisionSummary is the scannable decision layer shown before all detail. Return one to five short labelled items with exact facts. Simple factual answers should usually use one or two items; complex decisions may use up to five. For cover questions use the labels Highest risk, Scheduled, Absence, Best provisional cover and Calculated impact when that evidence exists. Do not repeat the direct answer or use generic advice.",
    "findings must explain the material evidence rather than repeat the headline. Use a separate finding for recorded absence status, the highest-risk shifts/assets and the major skill/spares/work exposures.",
    "coverOptions is for concrete named individual or package options only. Use an empty array outside labour-cover questions. Include the calculated impact, named skills, named assets, remaining risk and a truthful availability caveat.",
    "When the question requires action, actionPlan must say who should do what, by when, the expected measurable impact and how to verify it. Return an empty actionPlan for a purely factual lookup with no justified next action. recommendedActions is a concise plain-language version of the same priorities and may also be empty.",
    "Return zero to three useful followUpQuestions only when they materially continue the decision. Do not pad a simple factual answer with generic questions. For cover questions, prioritise residual skills/assets and alternative cover if the recommended package declines. Use human-readable dates such as Fri 31 Jul, never raw ISO dates.",
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
