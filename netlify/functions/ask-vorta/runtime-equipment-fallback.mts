import type { Context } from "@netlify/functions";
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
import { executeTool } from "./tool-execution.mjs";
import {
  decisionField,
  records,
  textValues,
} from "./utilities.mjs";
import { updateAskVortaInteraction } from "./telemetry.mjs";

const EQUIPMENT_FAULT_PATTERN =
  /\b(?:fault|sensor|probe|transmitter|alarm|trip|reject|filler|fill|vial|instrument|breakdown|failed|failure|diagnos|cause|problem)\b/i;

const EQUIPMENT_QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "from",
  "in",
  "is",
  "issue",
  "machine",
  "on",
  "problem",
  "the",
  "this",
  "with",
  "fault",
  "failed",
  "failure",
  "sensor",
  "probe",
  "alarm",
  "error",
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

function queryTokens(question: string): string[] {
  return [
    ...new Set(
      (question.toLowerCase().match(/[a-z0-9-]+/g) ?? [])
        .filter((token) => !EQUIPMENT_QUERY_STOP_WORDS.has(token))
        .map(normaliseToken)
        .filter((token) => token.length >= 2),
    ),
  ];
}

function assetIdentity(row: JsonRecord): string {
  return [
    decisionField(row, ["equipment_name", "equipmentName", "name"]),
    decisionField(row, ["equipment_code", "equipmentCode", "code"]),
    decisionField(row, ["area"]),
  ]
    .filter(Boolean)
    .join(" ");
}

function scoreEquipmentMatch(question: string, row: JsonRecord): number {
  const candidate = assetIdentity(row).toLowerCase();
  if (!candidate) return 0;

  const tokens = queryTokens(question);
  const candidateTokens = new Set(
    (candidate.match(/[a-z0-9-]+/g) ?? []).map(normaliseToken),
  );
  const meaningfulPhrase = tokens.join(" ");
  let score = 0;

  for (const token of tokens) {
    if (candidateTokens.has(token)) score += 90;
    else if (candidate.includes(token)) score += 45;
  }

  if (meaningfulPhrase.length >= 4 && candidate.includes(meaningfulPhrase)) {
    score += 260;
  }

  const code = decisionField(row, ["equipment_code", "equipmentCode", "code"])
    .toLowerCase();
  if (code && question.toLowerCase().includes(code)) score += 800;

  const name = decisionField(row, ["equipment_name", "equipmentName", "name"])
    .toLowerCase();
  if (name && question.toLowerCase().includes(name)) score += 900;

  return score;
}

interface EquipmentResolution {
  selected: JsonRecord | null;
  alternatives: JsonRecord[];
}

function resolveEquipment(
  question: string,
  equipmentRows: JsonRecord[],
): EquipmentResolution {
  const ranked = equipmentRows
    .map((row) => ({ row, score: scoreEquipmentMatch(question, row) }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score);

  if (ranked.length === 0 || ranked[0].score < 80) {
    return { selected: null, alternatives: [] };
  }

  const top = ranked[0];
  const alternatives = ranked
    .slice(1, 4)
    .filter((item) => item.score >= Math.max(80, top.score * 0.82))
    .map((item) => item.row);

  if (alternatives.length > 0 && top.score < 500) {
    return {
      selected: null,
      alternatives: [top.row, ...alternatives],
    };
  }

  return { selected: top.row, alternatives: [] };
}

function equipmentId(row: JsonRecord): string {
  return decisionField(row, ["equipment_id", "equipmentId", "id"]);
}

function equipmentLabel(row: JsonRecord): string {
  const name = decisionField(row, ["equipment_name", "equipmentName", "name"]);
  const code = decisionField(row, ["equipment_code", "equipmentCode", "code"]);
  return [name, code].filter(Boolean).join(" · ") || "the matched equipment";
}

function domainSources(packData: JsonRecord): string[] {
  const domains =
    packData.domains &&
    typeof packData.domains === "object" &&
    !Array.isArray(packData.domains)
      ? (packData.domains as JsonRecord)
      : {};

  return [
    ...new Set(
      Object.values(domains)
        .filter(
          (value): value is JsonRecord =>
            Boolean(value) && typeof value === "object" && !Array.isArray(value),
        )
        .map((value) =>
          typeof value.source === "string" ? value.source.trim() : "",
        )
        .filter(Boolean),
    ),
  ];
}

function firstFact(
  facts: string[],
  pattern: RegExp,
): string | undefined {
  return facts.find((fact) => pattern.test(fact));
}

function buildEvidenceLinks(row: JsonRecord): JsonRecord[] {
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

function deterministicEquipmentAnswer(
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
    toolsUsed: ["get_equipment_decision_pack"],
    evidenceLinks: buildEvidenceLinks(selected),
    evidenceGeneratedAt: new Date().toISOString(),
    responseId,
  };

  retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
  repairEquipmentDecisionAnswer(answer, questionPlan, toolOutcomes);

  const relevantFacts = relevantEquipmentDecisionFacts(
    decisionGoal,
    decisionFacts,
  );
  const workFact =
    firstFact(relevantFacts, /work evidence|work order|WO-/i) ??
    firstFact(decisionFacts, /work evidence|work order|WO-/i);
  const documentFact =
    firstFact(relevantFacts, /priority document evidence|document evidence|manual|procedure|drawing/i) ??
    firstFact(decisionFacts, /priority document evidence|document evidence|manual|procedure|drawing/i);
  const calibrationFact =
    firstFact(relevantFacts, /calibrat|reference instrument|measurement|reading/i) ??
    firstFact(decisionFacts, /calibrat|reference instrument|measurement|reading/i);
  const spareFact =
    firstFact(relevantFacts, /priority spare evidence|spare evidence|component|part number|stock/i) ??
    firstFact(decisionFacts, /priority spare evidence|spare evidence|component|part number|stock/i);
  const label = equipmentLabel(selected);

  if (workFact && documentFact) {
    answer.directAnswer =
      `For ${label}, Vorta found previous maintenance evidence relevant to this fault: ${readableEquipmentDecisionFact(workFact)}. ` +
      `The approved guidance returned is ${readableEquipmentDecisionFact(documentFact)}.`;
  } else if (workFact) {
    answer.directAnswer =
      `For ${label}, the previous maintenance evidence relevant to this fault is ${readableEquipmentDecisionFact(workFact)}. ` +
      "No verified document section was returned, so Vorta is not inventing one.";
  } else if (documentFact) {
    answer.directAnswer =
      `For ${label}, the approved guidance returned for this fault is ${readableEquipmentDecisionFact(documentFact)}. ` +
      "No matching previous corrective-work detail was returned.";
  } else {
    answer.directAnswer =
      `Vorta matched ${label}, but the authorised evidence did not return a previous corrective action or approved source section for this fault.`;
  }

  const summaryFacts = [
    workFact
      ? { label: "Previous work", value: readableEquipmentDecisionFact(workFact) }
      : null,
    documentFact
      ? { label: "Approved guidance", value: readableEquipmentDecisionFact(documentFact) }
      : null,
    calibrationFact
      ? { label: "Instrument evidence", value: readableEquipmentDecisionFact(calibrationFact) }
      : null,
    spareFact
      ? { label: "Relevant spare", value: readableEquipmentDecisionFact(spareFact) }
      : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  answer.decisionSummary = [
    { label: "Equipment", value: label },
    ...summaryFacts,
  ].slice(0, 5);

  const visibleFacts = [workFact, documentFact, calibrationFact, spareFact]
    .filter((fact): fact is string => Boolean(fact));
  answer.findings = visibleFacts.map((fact, index) => ({
    category: equipmentFactCategory(fact),
    severity: index === 0 ? "high" : "info",
    title:
      equipmentFactCategory(fact) === "work"
        ? "Previous maintenance evidence"
        : equipmentFactCategory(fact) === "document"
          ? "Approved source evidence"
          : "Supporting equipment evidence",
    detail: readableEquipmentDecisionFact(fact),
  }));
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
  answer.confidence = workFact && documentFact ? 84 : workFact || documentFact ? 68 : 42;
  answer.sources = [
    ...new Set([pack.source, ...domainSources(packData)]),
  ];

  return answer;
}

async function writeFallbackTelemetry({
  supabase,
  userId,
  responseId,
  interaction,
  answer,
  fallbackEvidenceMs,
}: {
  supabase: Awaited<
    ReturnType<typeof authenticateAskVortaRequest>
  > extends { ok: true; supabase: infer Client }
    ? Client
    : never;
  userId: string;
  responseId: string;
  interaction: JsonRecord | null;
  answer: JsonRecord;
  fallbackEvidenceMs: number;
}): Promise<void> {
  const createdAt =
    typeof interaction?.created_at === "string"
      ? Date.parse(interaction.created_at)
      : Number.NaN;
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
    tool_count: 1,
    tool_round_count: 1,
    failure_stage: "answer",
    duration_ms: Number.isFinite(createdAt) ? Date.now() - createdAt : null,
    status: "fallback",
    completed_at: new Date().toISOString(),
    tools_used: ["get_equipment_decision_pack"],
    sources: textValues(answer.sources),
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
  if (primaryResponse.ok || primaryResponse.status !== 503) {
    return primaryResponse;
  }

  const primaryPayload = await primaryResponse
    .clone()
    .json()
    .catch(() => null) as JsonRecord | null;
  const responseId =
    typeof primaryPayload?.responseId === "string"
      ? primaryPayload.responseId
      : "";
  if (!responseId) return primaryResponse;

  const authenticated = await authenticateAskVortaRequest(fallbackRequest);
  if (!authenticated.ok) return primaryResponse;
  const { request, supabase, userId } = authenticated;

  const { data: interactionData } = await supabase
    .from("ask_vorta_interactions")
    .select(
      "route_key,created_at,planner_ms,evidence_ms,answer_ms,status",
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

  const riskResult = await executeTool(
    "get_equipment_risk",
    {},
    supabase,
    request,
  );
  const resolution = resolveEquipment(request.question, records(riskResult.data));
  if (!resolution.selected) {
    if (resolution.alternatives.length === 0) return primaryResponse;
    const clarification = clarificationAnswer(responseId, resolution.alternatives);
    await writeFallbackTelemetry({
      supabase,
      userId,
      responseId,
      interaction,
      answer: clarification,
      fallbackEvidenceMs: 0,
    });
    return jsonResponse(clarification);
  }

  const selected = resolution.selected;
  const selectedQuery =
    decisionField(selected, ["equipment_code", "equipmentCode", "code"]) ||
    decisionField(selected, ["equipment_name", "equipmentName", "name"]);
  if (!selectedQuery) return primaryResponse;

  const fallbackEvidenceStartedAt = Date.now();
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
  const fallbackEvidenceMs = Date.now() - fallbackEvidenceStartedAt;
  if (pack.status !== "ok") return primaryResponse;

  const answer = deterministicEquipmentAnswer(
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
    fallbackEvidenceMs,
  });
  return jsonResponse(answer);
}
