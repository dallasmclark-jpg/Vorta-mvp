import type { Context } from "@netlify/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import coreHandler from "./runtime.mjs";
import { authenticateAskVortaRequest } from "./authenticated-context.mjs";
import type {
  AskVortaRequest,
  JsonRecord,
  ToolResult,
} from "./contracts.mjs";
import {
  equipmentFactCategory,
  readableEquipmentDecisionFact,
  relevantEquipmentDecisionFacts,
  repairEquipmentDecisionAnswer,
  retainEquipmentDecisionFacts,
} from "./equipment-evidence.mjs";
import { jsonResponse } from "./request-context.mjs";
import { updateAskVortaInteraction } from "./telemetry.mjs";
import { executeTool } from "./tool-execution.mjs";
import {
  decisionField,
  records,
  textValues,
} from "./utilities.mjs";

// Permanent production regression: "vial fill sensor fault" must resolve to
// equipment evidence and must never collapse into the generic site-risk fallback.
const EQUIPMENT_FAULT_PATTERN =
  /\b(?:fault|sensor|probe|transmitter|alarm|trip|reject|filler|fill|vial|instrument|breakdown|failed|failure|diagnos|cause|problem)\b/i;

const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "error",
  "failed",
  "failure",
  "fault",
  "for",
  "from",
  "in",
  "is",
  "issue",
  "machine",
  "on",
  "problem",
  "sensor",
  "the",
  "this",
  "with",
]);

function normaliseToken(value: string): string {
  const token = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ers")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("er")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function meaningfulTokens(question: string): string[] {
  return [
    ...new Set(
      (question.toLowerCase().match(/[a-z0-9-]+/g) ?? [])
        .filter((token) => !QUERY_STOP_WORDS.has(token))
        .map(normaliseToken)
        .filter((token) => token.length >= 2),
    ),
  ];
}

function equipmentLabel(row: JsonRecord): string {
  const name = decisionField(row, ["equipment_name", "equipmentName", "name"]);
  const code = decisionField(row, ["equipment_code", "equipmentCode", "code"]);
  return [name, code].filter(Boolean).join(" · ") || "the matched equipment";
}

function equipmentId(row: JsonRecord): string {
  return decisionField(row, ["equipment_id", "equipmentId", "id"]);
}

function equipmentSearchText(row: JsonRecord): string {
  return [
    decisionField(row, ["equipment_name", "equipmentName", "name"]),
    decisionField(row, ["equipment_code", "equipmentCode", "code"]),
    decisionField(row, ["area"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function conversationEquipmentHints(request: AskVortaRequest): string[] {
  const context = request.conversationContext;
  if (!context) return [];
  return [
    context.activeEquipment?.query,
    context.activeEquipment?.id,
    context.activeEquipment?.code,
    context.activeEquipment?.name,
    context.selectedOption?.equipmentQuery,
    context.selectedOption?.equipmentId,
    context.selectedOption?.label,
    ...context.orderedOptions.flatMap((option) => [
      option.equipmentQuery,
      option.equipmentId,
      option.label,
    ]),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.toLowerCase());
}

function equipmentMatchScore(
  request: AskVortaRequest,
  row: JsonRecord,
): number {
  const question = request.question;
  const candidate = equipmentSearchText(row);
  if (!candidate) return 0;

  const tokens = meaningfulTokens(question);
  const candidateTokens = new Set(
    (candidate.match(/[a-z0-9-]+/g) ?? []).map(normaliseToken),
  );
  let score = 0;

  for (const token of tokens) {
    if (candidateTokens.has(token)) score += 90;
    else if (candidate.includes(token)) score += 45;
  }

  const phrase = tokens.join(" ");
  if (phrase.length >= 4 && candidate.includes(phrase)) score += 260;

  const loweredQuestion = question.toLowerCase();
  const id = equipmentId(row).toLowerCase();
  const code = decisionField(row, ["equipment_code", "equipmentCode", "code"])
    .toLowerCase();
  const name = decisionField(row, ["equipment_name", "equipmentName", "name"])
    .toLowerCase();
  if (code && loweredQuestion.includes(code)) score += 800;
  if (name && loweredQuestion.includes(name)) score += 900;

  for (const hint of conversationEquipmentHints(request)) {
    if (
      (id && hint.includes(id)) ||
      (code && hint.includes(code)) ||
      (name && hint.includes(name))
    ) {
      score += 340;
      break;
    }
  }

  return score;
}

interface EquipmentResolution {
  selected: JsonRecord | null;
  alternatives: JsonRecord[];
}

function resolveEquipment(
  request: AskVortaRequest,
  equipmentRows: JsonRecord[],
): EquipmentResolution {
  const ranked = equipmentRows
    .map((row) => ({ row, score: equipmentMatchScore(request, row) }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score);

  if (ranked.length === 0 || ranked[0].score < 80) {
    return { selected: null, alternatives: [] };
  }

  const top = ranked[0];
  const closeAlternatives = ranked
    .slice(1, 4)
    .filter((item) => item.score >= Math.max(80, top.score * 0.82))
    .map((item) => item.row);

  if (closeAlternatives.length > 0 && top.score < 500) {
    return {
      selected: null,
      alternatives: [top.row, ...closeAlternatives],
    };
  }

  return { selected: top.row, alternatives: [] };
}

function evidenceLinks(row: JsonRecord): JsonRecord[] {
  const id = equipmentId(row);
  if (!id) {
    return [
      {
        label: "Open equipment register",
        path: "/equipment",
        recordType: "equipment",
      },
    ];
  }

  const base = `/equipment/${encodeURIComponent(id)}`;
  return [
    {
      label: "Open previous work",
      path: `${base}/work-orders`,
      recordType: "work",
    },
    {
      label: "Open equipment history",
      path: `${base}/history`,
      recordType: "work",
    },
    {
      label: "Open approved documents",
      path: `${base}/documents`,
      recordType: "document",
    },
    {
      label: "Open equipment spares",
      path: `${base}/spares`,
      recordType: "spare",
    },
  ];
}

function packSources(pack: ToolResult, packData: JsonRecord): string[] {
  const domains =
    packData.domains &&
    typeof packData.domains === "object" &&
    !Array.isArray(packData.domains)
      ? (packData.domains as JsonRecord)
      : {};
  return [
    ...new Set([
      pack.source,
      ...Object.values(domains)
        .filter(
          (value): value is JsonRecord =>
            Boolean(value) && typeof value === "object" && !Array.isArray(value),
        )
        .map((value) =>
          typeof value.source === "string" ? value.source.trim() : "",
        )
        .filter(Boolean),
    ]),
  ];
}

function visibleFact(fact: string, maximum = 360): string {
  const text = readableEquipmentDecisionFact(fact);
  return text.length > maximum
    ? `${text.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`
    : text;
}

function rankedFacts(
  facts: string[],
  pattern: RegExp,
  question: string,
): string[] {
  const tokens = meaningfulTokens(question);
  return [...new Set(facts)]
    .filter((fact) => pattern.test(fact))
    .map((fact, index) => {
      const lowered = fact.toLowerCase();
      let score = /^priority /i.test(fact) ? 140 : 0;
      if (/\bcompleted\b|temporary fix|recurred|success|outcome/i.test(fact)) {
        score += 70;
      }
      if (/sensor|probe|transmitter|false reject|fault|f-20[47]|f-211/i.test(fact)) {
        score += 70;
      }
      if (/approved|revision|section|page|fault tree|drawing/i.test(fact)) {
        score += 55;
      }
      for (const token of tokens) {
        if (lowered.includes(token)) score += 12;
      }
      return { fact, score, index };
    })
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .map((item) => item.fact);
}

function clarificationAnswer(
  responseId: string,
  alternatives: JsonRecord[],
): JsonRecord {
  const labels = alternatives.map(equipmentLabel).filter(Boolean).slice(0, 4);
  return {
    responseId,
    directAnswer:
      labels.length > 0
        ? `Which equipment do you mean: ${labels.join(", ")}?`
        : "Which equipment does this fault relate to?",
    decisionSummary: [
      {
        label: "Equipment clarification",
        value:
          labels.length > 0
            ? `Choose one authorised match: ${labels.join(" · ")}.`
            : "Provide the equipment name or code so Vorta can use the correct history and documents.",
      },
    ],
    evidence: [],
    findings: [],
    coverOptions: [],
    recommendedActions: [],
    actionPlan: [],
    followUpQuestions: [],
    sources: ["Equipment risk register"],
    missingData: ["The equipment reference is ambiguous."],
    confidence: 42,
    intentLabel: "equipment_clarification",
    toolsUsed: ["get_equipment_risk"],
    evidenceLinks: [
      {
        label: "Open equipment register",
        path: "/equipment",
        recordType: "equipment",
      },
    ],
    evidenceGeneratedAt: new Date().toISOString(),
  };
}

function buildEquipmentFallbackAnswer(
  responseId: string,
  originalQuestion: string,
  selected: JsonRecord,
  pack: ToolResult,
): JsonRecord | null {
  if (!pack.data || typeof pack.data !== "object" || Array.isArray(pack.data)) {
    return null;
  }

  const packData = pack.data as JsonRecord;
  const decisionFacts = textValues(packData.decisionFacts);
  if (decisionFacts.length === 0) return null;

  const decisionGoal =
    `${originalQuestion}. Diagnose this equipment fault using previous work orders, corrective actions, maintenance history and approved current manual, SOP or drawing sections.`;
  const questionPlan: JsonRecord = {
    scope: "equipment",
    intentLabel: "equipment_fault_history",
    decisionGoal,
    equipmentQuery: equipmentLabel(selected),
    routingMode: "deterministic",
    forceActionPlan: false,
  };
  const toolOutcomes = new Map<string, ToolResult>([
    ["get_equipment_decision_pack", pack],
  ]);
  const answer: JsonRecord = {
    responseId,
    directAnswer:
      "The equipment evidence could not be analysed by the conversational reasoning service.",
    decisionSummary: [
      {
        label: "Equipment evidence",
        value: "Verified Vorta equipment evidence was loaded.",
      },
    ],
    evidence: [],
    findings: [],
    coverOptions: [],
    recommendedActions: [],
    actionPlan: [],
    followUpQuestions: [],
    sources: [],
    missingData: [],
    confidence: 50,
    intentLabel: "equipment_fault_history",
    toolsUsed: ["get_equipment_risk", "get_equipment_decision_pack"],
    evidenceLinks: evidenceLinks(selected),
    evidenceGeneratedAt: new Date().toISOString(),
  };

  retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
  repairEquipmentDecisionAnswer(answer, questionPlan, toolOutcomes);

  const relevantFacts = relevantEquipmentDecisionFacts(
    decisionGoal,
    decisionFacts,
  );
  const allFacts = [...relevantFacts, ...decisionFacts];
  const workFacts = rankedFacts(
    allFacts,
    /work evidence|work order|WO-/i,
    originalQuestion,
  ).slice(0, 3);
  const documentFacts = rankedFacts(
    allFacts,
    /priority document evidence|document evidence|manual|procedure|drawing|fault tree/i,
    originalQuestion,
  ).slice(0, 2);
  const calibrationFact = rankedFacts(
    allFacts,
    /calibrat|reference instrument|measurement|reading|verification record/i,
    originalQuestion,
  )[0];
  const spareFact = rankedFacts(
    allFacts,
    /priority spare evidence|spare evidence|component|part number|stock/i,
    originalQuestion,
  )[0];
  const workFact = workFacts[0];
  const documentFact = documentFacts[0];
  const label = equipmentLabel(selected);

  if (workFact && documentFact) {
    const historyLead =
      workFacts.length > 1
        ? "a repeated fault pattern in previous maintenance records"
        : "previous maintenance evidence relevant to this fault";
    answer.directAnswer =
      `For ${label}, Vorta found ${historyLead}: ${visibleFact(workFact, 300)}. ` +
      `${workFacts[1] ? `A second related record is ${visibleFact(workFacts[1], 240)}. ` : ""}` +
      `The approved guidance returned is ${visibleFact(documentFact, 300)}.`;
  } else if (workFact) {
    answer.directAnswer =
      `For ${label}, the previous maintenance evidence relevant to this fault is ${visibleFact(workFact, 320)}. ` +
      "No verified document section was returned, so Vorta is not inventing one.";
  } else if (documentFact) {
    answer.directAnswer =
      `For ${label}, the approved guidance returned for this fault is ${visibleFact(documentFact, 320)}. ` +
      "No matching previous corrective-work detail was returned.";
  } else {
    answer.directAnswer =
      `Vorta matched ${label}, but the authorised evidence did not return a previous corrective action or approved source section for this fault.`;
  }

  const summaryFacts = [
    workFacts[0]
      ? { label: "Previous work", value: visibleFact(workFacts[0]) }
      : null,
    workFacts[1]
      ? { label: "Repeat history", value: visibleFact(workFacts[1]) }
      : null,
    documentFacts[0]
      ? { label: "Approved guidance", value: visibleFact(documentFacts[0]) }
      : null,
    spareFact
      ? { label: "Relevant spare", value: visibleFact(spareFact) }
      : calibrationFact
        ? { label: "Instrument evidence", value: visibleFact(calibrationFact) }
        : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  answer.decisionSummary = [
    { label: "Equipment", value: label },
    ...summaryFacts,
  ].slice(0, 5);

  const visibleFacts = [
    ...workFacts,
    ...documentFacts,
    calibrationFact,
    spareFact,
  ].filter((fact): fact is string => Boolean(fact));
  answer.findings = visibleFacts.slice(0, 6).map((fact, index) => {
    const category = equipmentFactCategory(fact);
    return {
      category,
      severity: index === 0 ? "high" : "info",
      title:
        category === "work"
          ? "Previous maintenance evidence"
          : category === "document"
            ? "Approved source evidence"
            : "Supporting equipment evidence",
      detail: visibleFact(fact),
    };
  });
  answer.evidence = [
    ...new Set([...visibleFacts, ...decisionFacts]),
  ].slice(0, 16);
  answer.recommendedActions =
    workFact || documentFact
      ? [
          `Review the named previous work and approved guidance for ${label}, then confirm the live symptom or fault code before changing or replacing the sensor.`,
        ]
      : [];
  answer.actionPlan = [];
  answer.missingData = [
    ...(!workFact ? ["No matching previous corrective-work detail was returned."] : []),
    ...(!documentFact ? ["No verified manual, SOP or drawing section was returned."] : []),
  ];
  answer.confidence = workFact && documentFact ? 86 : workFact || documentFact ? 70 : 42;
  answer.sources = packSources(pack, packData);

  return answer;
}

async function writeFallbackTelemetry({
  supabase,
  userId,
  responseId,
  interaction,
  answer,
  fallbackEvidenceMs,
  fallbackTools,
  fallbackRounds,
}: {
  supabase: SupabaseClient;
  userId: string;
  responseId: string;
  interaction: JsonRecord | null;
  answer: JsonRecord;
  fallbackEvidenceMs: number;
  fallbackTools: string[];
  fallbackRounds: number;
}): Promise<void> {
  const createdAt =
    typeof interaction?.created_at === "string"
      ? Date.parse(interaction.created_at)
      : Number.NaN;
  const previousToolCount =
    typeof interaction?.tool_count === "number" ? interaction.tool_count : 0;
  const previousToolRounds =
    typeof interaction?.tool_round_count === "number"
      ? interaction.tool_round_count
      : 0;
  await updateAskVortaInteraction(supabase, responseId, userId, {
    route_key: "equipment",
    routing_mode: "fallback",
    intent_label: "equipment_fault_history",
    planner_ms:
      typeof interaction?.planner_ms === "number" ? interaction.planner_ms : 0,
    evidence_ms:
      (typeof interaction?.evidence_ms === "number" ? interaction.evidence_ms : 0) +
      fallbackEvidenceMs,
    answer_ms:
      typeof interaction?.answer_ms === "number" ? interaction.answer_ms : 0,
    tool_count: previousToolCount + fallbackTools.length,
    tool_round_count: previousToolRounds + fallbackRounds,
    failure_stage: "answer",
    duration_ms: Number.isFinite(createdAt) ? Date.now() - createdAt : 0,
    status: "fallback",
    completed_at: new Date().toISOString(),
    tools_used: [
      ...new Set([
        ...textValues(interaction?.tools_used),
        ...fallbackTools,
      ]),
    ],
    sources: [
      ...new Set([
        ...textValues(interaction?.sources),
        ...textValues(answer.sources),
      ]),
    ],
    confidence:
      typeof answer.confidence === "number" ? Math.round(answer.confidence) : 0,
    missing_data_count: textValues(answer.missingData).length,
  });
}

export default async function equipmentFallbackHandler(
  req: Request,
  context: Context,
): Promise<Response> {
  const primaryRequest = req.clone();
  const fallbackRequest = req.clone();
  const primaryResponse = await coreHandler(primaryRequest, context);
  if (
    primaryResponse.ok ||
    (primaryResponse.status !== 503 && primaryResponse.status !== 504)
  ) {
    return primaryResponse;
  }

  const payload = (await primaryResponse
    .clone()
    .json()
    .catch(() => null)) as JsonRecord | null;
  const responseId =
    typeof payload?.responseId === "string" ? payload.responseId : "";
  if (!responseId) return primaryResponse;

  const authenticated = await authenticateAskVortaRequest(fallbackRequest);
  if (!authenticated.ok) return primaryResponse;
  const { request, supabase, userId } = authenticated;

  const { data: interactionData } = await supabase
    .from("ask_vorta_interactions")
    .select(
      "route_key,created_at,planner_ms,evidence_ms,answer_ms,status,tool_count,tool_round_count,tools_used,sources",
    )
    .eq("id", responseId)
    .eq("user_id", userId)
    .maybeSingle();
  const interaction =
    interactionData && typeof interactionData === "object"
      ? (interactionData as JsonRecord)
      : null;
  const routeKey =
    typeof interaction?.route_key === "string" ? interaction.route_key : "";
  if (routeKey !== "equipment" && !EQUIPMENT_FAULT_PATTERN.test(request.question)) {
    return primaryResponse;
  }

  const fallbackEvidenceStartedAt = Date.now();
  const riskResult = await executeTool(
    "get_equipment_risk",
    {},
    supabase,
    request,
  );
  const resolution = resolveEquipment(request, records(riskResult.data));

  if (!resolution.selected) {
    if (resolution.alternatives.length === 0) return primaryResponse;
    const clarification = clarificationAnswer(responseId, resolution.alternatives);
    await writeFallbackTelemetry({
      supabase,
      userId,
      responseId,
      interaction,
      answer: clarification,
      fallbackEvidenceMs: Date.now() - fallbackEvidenceStartedAt,
      fallbackTools: ["get_equipment_risk"],
      fallbackRounds: 1,
    });
    return jsonResponse(clarification);
  }

  const selected = resolution.selected;
  const selectedQuery =
    decisionField(selected, ["equipment_code", "equipmentCode", "code"]) ||
    decisionField(selected, ["equipment_name", "equipmentName", "name"]);
  if (!selectedQuery) return primaryResponse;

  const toolRequest: AskVortaRequest = {
    ...request,
    question:
      `${request.question}\n` +
      "Equipment fault evidence required: previous work orders and confirmations, corrective actions, maintenance history, approved current manual/SOP/drawing sections, calibration evidence and relevant spares.",
  };
  const pack = await executeTool(
    "get_equipment_decision_pack",
    { query: selectedQuery },
    supabase,
    toolRequest,
  );
  if (pack.status !== "ok") return primaryResponse;

  const answer = buildEquipmentFallbackAnswer(
    responseId,
    request.question,
    selected,
    pack,
  );
  if (!answer) return primaryResponse;

  await writeFallbackTelemetry({
    supabase,
    userId,
    responseId,
    interaction,
    answer,
    fallbackEvidenceMs: Date.now() - fallbackEvidenceStartedAt,
    fallbackTools: ["get_equipment_risk", "get_equipment_decision_pack"],
    fallbackRounds: 2,
  });
  return jsonResponse(answer);
}
