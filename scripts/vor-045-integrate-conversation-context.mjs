import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, source) {
  writeFileSync(path, source);
}

function replaceOnce(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}.`);
  }
  return source.replace(oldValue, newValue);
}

function findFunctionRange(source, name) {
  const candidates = [`function ${name}(`, `async function ${name}(`];
  const start = candidates
    .map((candidate) => source.indexOf(candidate))
    .filter((index) => index >= 0)
    .sort((first, second) => first - second)[0];
  if (start === undefined) throw new Error(`Function ${name} was not found.`);
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) throw new Error(`Function ${name} has no opening brace.`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1 };
    }
  }
  throw new Error(`Function ${name} has no closing brace.`);
}

function updateFunction(source, name, updater) {
  const range = findFunctionRange(source, name);
  const block = source.slice(range.start, range.end);
  const updated = updater(block);
  return source.slice(0, range.start) + updated + source.slice(range.end);
}

function patchBackend() {
  const path = "netlify/functions/ask-vorta.mts";
  let source = read(path);
  if (source.includes("function buildConversationContext(")) {
    console.log("VOR-045 backend context integration is already applied.");
    return;
  }

  source = replaceOnce(
    source,
    'import type { ResponseInput, Tool } from "openai/resources/responses/responses";\n',
    'import type { ResponseInput, Tool } from "openai/resources/responses/responses";\nimport {\n  contextResolutionPrompt,\n  createConversationContext,\n  resolveConversationFollowUp,\n  sanitizeConversationContext,\n} from "./_shared/askVortaConversationContext.mjs";\nimport type {\n  ConversationContext,\n  ConversationContextOption,\n  ConversationContextResolution,\n  ConversationContextSubject,\n} from "./_shared/askVortaConversationContext.mjs";\n',
    "backend context imports",
  );

  source = replaceOnce(
    source,
    "  history: RequestHistoryItem[];\n  pageContext: PageContext;",
    "  history: RequestHistoryItem[];\n  conversationContext: ConversationContext | null;\n  pageContext: PageContext;",
    "backend request context field",
  );

  source = updateFunction(source, "parseRequest", (block) => {
    let updated = replaceOnce(
      block,
      "  const record = value as JsonRecord;\n",
      "  const record = value as JsonRecord;\n  const conversationContext = sanitizeConversationContext(record.conversationContext);\n",
      "request context sanitisation",
    );
    const returnIndex = updated.lastIndexOf("  return {");
    if (returnIndex < 0) throw new Error("parseRequest return object was not found.");
    const head = updated.slice(0, returnIndex);
    let tail = updated.slice(returnIndex);
    if (tail.includes("    history,\n")) {
      tail = replaceOnce(
        tail,
        "    history,\n",
        "    history,\n    conversationContext,\n",
        "parsed request context return",
      );
    } else {
      tail = replaceOnce(
        tail,
        "    pageContext:",
        "    conversationContext,\n    pageContext:",
        "parsed request context return fallback",
      );
    }
    return head + tail;
  });

  const helpers = String.raw`
function conversationSubject(scopeValue: unknown): ConversationContextSubject {
  const scope = typeof scopeValue === "string" ? scopeValue : "mixed";
  const mapping: Record<string, ConversationContextSubject> = {
    site: "site",
    site_risk: "risk",
    site_priorities: "site_priorities",
    equipment: "equipment",
    shift_cover: "shift_cover",
    maintenance_plan: "maintenance_plan",
    spares: "spares",
    documents: "documents",
    work: "work",
    skills: "skills",
    handover: "handover",
    risk: "risk",
    clarification: "mixed",
  };
  return mapping[scope] ?? "mixed";
}

function enrichQuestionWithConversationContext(
  question: string,
  resolution: ConversationContextResolution,
): string {
  if (!resolution.usedContext) return question;
  const additions: string[] = [];
  if (resolution.selectedOption) {
    additions.push(
      "Selected prior option " +
        resolution.selectedOption.position +
        ": " +
        resolution.selectedOption.label +
        (resolution.selectedOption.value ? ". " + resolution.selectedOption.value : ""),
    );
  }
  if (resolution.activeEquipmentQuery) {
    additions.push("Resolved equipment: " + resolution.activeEquipmentQuery + ".");
  }
  if (resolution.inheritedSubject) {
    additions.push(
      "Continue the prior " + resolution.inheritedSubject.replace(/_/g, " ") + " decision.",
    );
  }
  if (resolution.inheritedDateRange) {
    additions.push(
      "Use the inherited date range " +
        resolution.inheritedDateRange.startDate +
        " to " +
        resolution.inheritedDateRange.endDate +
        " in " +
        resolution.inheritedDateRange.timezone +
        ".",
    );
  }
  return additions.length
    ? question + "\n\nValidated structured follow-up context: " + additions.join(" ")
    : question;
}

function contextRecords(value: unknown, depth = 0): JsonRecord[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => contextRecords(item, depth + 1));
  }
  if (typeof value !== "object") return [];
  const record = value as JsonRecord;
  return [
    record,
    ...Object.values(record).flatMap((item) => contextRecords(item, depth + 1)),
  ];
}

function contextField(record: JsonRecord | undefined, keys: string[]): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function rankedActionContextOptions(
  outcomes: Map<string, ToolResult>,
): ConversationContextOption[] {
  const siteSnapshot = outcomeData(outcomes, "get_site_operational_snapshot");
  const siteRanked = operationalDomainData(siteSnapshot, "rankedActions");
  const equipmentRanked = outcomeData(outcomes, "get_equipment_risk_actions");
  const candidates = [
    ...contextRecords(siteRanked),
    ...contextRecords(equipmentRanked),
  ]
    .filter((item) =>
      Boolean(
        item.action_rank ??
          item.actionRank ??
          item.operational_value_score ??
          item.operationalValueScore,
      ),
    )
    .sort(
      (first, second) =>
        numberValue(first.action_rank ?? first.actionRank) -
        numberValue(second.action_rank ?? second.actionRank),
    );
  const seen = new Set<string>();
  return candidates.flatMap((item, index): ConversationContextOption[] => {
    const equipmentCode = contextField(item, ["equipment_code", "equipmentCode"]);
    const equipmentName = contextField(item, ["equipment_name", "equipmentName"]);
    const equipmentId = contextField(item, ["equipment_id", "equipmentId"]);
    const workOrder = contextField(item, ["work_order_number", "workOrderNumber"]);
    const actionTitle = contextField(item, ["action_title", "actionTitle"]);
    const key = [workOrder, equipmentCode, actionTitle].filter(Boolean).join("|");
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const currentRisk = firstDecisionNumber(item, ["current_risk_score", "currentRiskScore"]);
    const projectedRisk = firstDecisionNumber(item, ["projected_risk_score", "projectedRiskScore"]);
    const value = firstDecisionNumber(item, ["operational_value_score", "operationalValueScore"]);
    return [{
      position: index + 1,
      type: "ranked_action",
      label: [workOrder, equipmentCode || equipmentName, actionTitle].filter(Boolean).join(" · "),
      ...(equipmentCode || equipmentName
        ? { equipmentQuery: equipmentCode || equipmentName }
        : {}),
      ...(equipmentId ? { equipmentId } : {}),
      ...(workOrder ? { reference: workOrder } : {}),
      value: [
        value !== null ? "Operational value " + value.toFixed(1) + "/100" : "",
        currentRisk !== null && projectedRisk !== null
          ? "Risk " + currentRisk.toFixed(1) + " to " + projectedRisk.toFixed(1)
          : "",
      ].filter(Boolean).join("; "),
    }];
  }).slice(0, 8).map((item, index) => ({ ...item, position: index + 1 }));
}

function answerContextOptions(
  answer: JsonRecord,
  outcomes: Map<string, ToolResult>,
): ConversationContextOption[] {
  const ranked = rankedActionContextOptions(outcomes);
  if (ranked.length) return ranked;

  const cover = records(answer.coverOptions).slice(0, 8).map((item, index) => ({
    position: index + 1,
    type: "cover" as const,
    label: [
      "Cover option " + (index + 1),
      textValues(item.engineerNames).join(" + "),
      contextField(item, ["shift"]),
    ].filter(Boolean).join(" · "),
    value: [
      contextField(item, ["projectedImpact"]),
      contextField(item, ["remainingRisk"]),
    ].filter(Boolean).join("; "),
  }));
  if (cover.length) return cover;

  const spareCandidates = contextRecords(outcomeData(outcomes, "get_site_spares_risk"))
    .filter((item) =>
      Boolean(
        item.part_number ??
          item.partNumber ??
          item.component_code ??
          item.componentCode ??
          item.spare_part_number,
      ),
    )
    .slice(0, 8)
    .map((item, index) => {
      const part = contextField(item, [
        "part_number",
        "partNumber",
        "component_code",
        "componentCode",
        "spare_part_number",
      ]);
      const description = contextField(item, ["description", "name", "component_name"]);
      const equipment = contextField(item, ["equipment_code", "equipmentCode", "equipment_name"]);
      return {
        position: index + 1,
        type: "spare" as const,
        label: [part, description, equipment].filter(Boolean).join(" · "),
        ...(equipment ? { equipmentQuery: equipment } : {}),
        ...(part ? { reference: part } : {}),
      };
    });
  if (spareCandidates.length) return spareCandidates;

  const documentCandidates = [
    ...contextRecords(outcomeData(outcomes, "search_maintenance_documents")),
    ...contextRecords(outcomeData(outcomes, "get_equipment_documents")),
  ]
    .filter((item) => Boolean(item.title ?? item.document_title ?? item.documentTitle))
    .slice(0, 8)
    .map((item, index) => {
      const title = contextField(item, ["title", "document_title", "documentTitle"]);
      const revision = contextField(item, ["revision"]);
      const equipment = contextField(item, ["equipment_code", "equipmentCode", "equipment_name"]);
      return {
        position: index + 1,
        type: "document" as const,
        label: [title, revision ? "Revision " + revision : ""].filter(Boolean).join(" · "),
        ...(equipment ? { equipmentQuery: equipment } : {}),
        reference: contextField(item, ["external_reference", "externalReference", "source_url", "sourceUrl"]),
      };
    });
  if (documentCandidates.length) return documentCandidates;

  return records(answer.actionPlan).slice(0, 8).map((item, index) => ({
    position: index + 1,
    type: "work" as const,
    label: contextField(item, ["action"]) || "Action " + (index + 1),
    value: [
      contextField(item, ["owner"]),
      contextField(item, ["expectedImpact"]),
    ].filter(Boolean).join("; "),
  }));
}

function buildConversationContext(
  request: AskVortaRequest,
  questionPlan: JsonRecord | null,
  outcomes: Map<string, ToolResult>,
  answer: JsonRecord,
  resolution: ConversationContextResolution,
): ConversationContext | null {
  const previous = resolution.context ?? request.conversationContext;
  const evidenceRecords = [
    ...contextRecords(outcomeData(outcomes, "get_equipment_decision_pack")),
    ...contextRecords(outcomeData(outcomes, "get_equipment_risk_actions")),
    ...contextRecords(outcomeData(outcomes, "get_equipment_risk")),
    ...contextRecords(outcomeData(outcomes, "search_maintenance_documents")),
  ];
  const evidenceEquipment = evidenceRecords.find((item) =>
    Boolean(
      item.equipment_code ??
        item.equipmentCode ??
        item.equipment_name ??
        item.equipmentName ??
        item.equipment_id ??
        item.equipmentId,
    ),
  );
  const explicitEquipment = equipmentReferenceFromQuestion(request.question);
  const selectedEquipment = resolution.selectedOption?.equipmentQuery ?? "";
  const evidenceCode = contextField(evidenceEquipment, ["equipment_code", "equipmentCode", "code"]);
  const evidenceName = contextField(evidenceEquipment, ["equipment_name", "equipmentName", "name"]);
  const evidenceId = contextField(evidenceEquipment, ["equipment_id", "equipmentId", "id"]);
  const activeQuery =
    explicitEquipment ||
    selectedEquipment ||
    evidenceCode ||
    evidenceName ||
    (resolution.usedContext ? previous?.activeEquipment?.query ?? "" : "");
  const activeEquipment = activeQuery
    ? {
        query: activeQuery,
        ...(evidenceId ? { id: evidenceId } : previous?.activeEquipment?.id ? { id: previous.activeEquipment.id } : {}),
        ...(evidenceCode ? { code: evidenceCode } : previous?.activeEquipment?.code ? { code: previous.activeEquipment.code } : {}),
        ...(evidenceName ? { name: evidenceName } : previous?.activeEquipment?.name ? { name: previous.activeEquipment.name } : {}),
      }
    : null;
  const area =
    contextField(evidenceEquipment, ["area", "area_name", "areaName"]) ||
    (resolution.usedContext ? previous?.area ?? "" : "") ||
    null;
  const startDate = typeof questionPlan?.startDate === "string" ? questionPlan.startDate : "";
  const endDate = typeof questionPlan?.endDate === "string" ? questionPlan.endDate : "";
  const plannedDateRange = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ? { startDate, endDate, timezone: request.pageContext.timezone }
    : null;
  const generatedOptions = answerContextOptions(answer, outcomes);
  const orderedOptions = generatedOptions.length
    ? generatedOptions
    : resolution.usedContext
      ? previous?.orderedOptions ?? []
      : [];
  const selectedOption = resolution.selectedOption
    ? orderedOptions.find((item) => item.position === resolution.selectedOption?.position) ?? resolution.selectedOption
    : null;
  const firstCover = records(answer.coverOptions)[0];
  const shiftLabel = contextField(firstCover, ["shift"]);
  const context = createConversationContext({
    version: 1,
    subject: conversationSubject(questionPlan?.scope ?? resolution.inheritedSubject ?? previous?.subject),
    intent:
      (typeof answer.intentLabel === "string" && answer.intentLabel.trim()) ||
      (typeof questionPlan?.intentLabel === "string" && questionPlan.intentLabel.trim()) ||
      previous?.intent ||
      "Vorta follow-up",
    activeEquipment,
    area,
    shift: shiftLabel ? { type: shiftLabel } : resolution.usedContext ? previous?.shift : null,
    dateRange: plannedDateRange ?? (resolution.usedContext ? previous?.dateRange : null),
    orderedOptions,
    selectedOption,
    updatedAt:
      typeof answer.evidenceGeneratedAt === "string"
        ? answer.evidenceGeneratedAt
        : new Date().toISOString(),
  });
  return context ?? previous ?? null;
}

`;

  const deterministicMarker = "function deterministicQuestionPlan(";
  const markerIndex = source.indexOf(deterministicMarker);
  if (markerIndex < 0) throw new Error("deterministicQuestionPlan marker was not found.");
  source = source.slice(0, markerIndex) + helpers + source.slice(markerIndex);

  source = replaceOnce(
    source,
    `  const client = new OpenAI();
  let questionPlan: JsonRecord | null = deterministicQuestionPlan(request);
  if (!questionPlan) {
    try {
      questionPlan = await buildQuestionPlan(client, request);`,
    `  const client = new OpenAI();
  const conversationResolution = resolveConversationFollowUp(
    request.question,
    request.conversationContext,
  );
  const planningRequest: AskVortaRequest = {
    ...request,
    question: enrichQuestionWithConversationContext(
      request.question,
      conversationResolution,
    ),
  };
  let questionPlan: JsonRecord | null = conversationResolution.shouldClarify
    ? {
        routingMode: "deterministic",
        scope: "clarification",
        intentLabel: "Clarify follow-up reference",
        decisionGoal: conversationResolution.clarificationQuestion ?? "Clarify the intended prior option.",
        shouldUseTools: false,
        requiredTools: [],
        optionalTools: [],
        equipmentQuery: "",
        startDate: "",
        endDate: "",
        ambiguity: conversationResolution.clarificationQuestion ?? "The prior reference is ambiguous.",
        answerFocus: "Ask one concise clarification and do not guess.",
        verificationChecks: ["Confirm the intended prior option or asset."],
      }
    : deterministicQuestionPlan(planningRequest);
  if (!questionPlan) {
    try {
      questionPlan = await buildQuestionPlan(client, planningRequest);`,
    "handler structured planning request",
  );

  source = replaceOnce(
    source,
    `    { role: "user", content: request.question },
  ];`,
    `    ...(conversationResolution.usedContext
      ? [{
          role: "user" as const,
          content:
            "Validated structured conversation context for this follow-up: " +
            contextResolutionPrompt(conversationResolution),
        }]
      : []),
    { role: "user", content: request.question },
  ];`,
    "final reasoning structured context input",
  );

  source = replaceOnce(
    source,
    `      "Current page: " + request.pageContext.path + ". User role: " + request.role + ".",
`,
    `      "Current page: " + request.pageContext.path + ". User role: " + request.role + ".",
      "Validated structured conversation context: " +
        contextResolutionPrompt(
          resolveConversationFollowUp(request.question, request.conversationContext),
        ) +
        ". Explicit equipment, area, shift and date wording in the current question overrides inherited context.",
`,
    "planner structured context instruction",
  );

  source = replaceOnce(
    source,
    `    "Understand any natural wording rather than matching prepared questions. Correct obvious spelling mistakes silently, interpret shorthand, use history for follow-ups and answer every material part of a mixed question.",
`,
    `    "Understand any natural wording rather than matching prepared questions. Correct obvious spelling mistakes silently, interpret shorthand, use history for follow-ups and answer every material part of a mixed question.",
    "Use this validated structured conversation context for pronouns, ordinal choices and inherited dates: " +
      contextResolutionPrompt(
        resolveConversationFollowUp(request.question, request.conversationContext),
      ) +
      ". Never let inherited context override explicit wording, and ask one concise clarification when the resolver marks the reference ambiguous.",
`,
    "answer structured context instruction",
  );

  source = replaceOnce(
    source,
    `    answer.evidenceLinks = [...evidenceLinks.values()];
    answer.responseId = interactionId;
    await supabase`,
    `    answer.evidenceLinks = [...evidenceLinks.values()];
    answer.responseId = interactionId;
    answer.conversationContext = buildConversationContext(
      request,
      questionPlan,
      toolOutcomes,
      answer,
      conversationResolution,
    );
    await supabase`,
    "deterministic answer context envelope",
  );

  const finalAnswerMarker = `        answer.evidenceLinks = [...evidenceLinks.values()];
        answer.responseId = interactionId;
        await supabase`;
  source = replaceOnce(
    source,
    finalAnswerMarker,
    `        answer.evidenceLinks = [...evidenceLinks.values()];
        answer.responseId = interactionId;
        answer.conversationContext = buildConversationContext(
          request,
          questionPlan,
          toolOutcomes,
          answer,
          conversationResolution,
        );
        await supabase`,
    "model answer context envelope",
  );

  source = replaceOnce(
    source,
    `  try {
    if (hasDeterministicRouting) {`,
    `  if (conversationResolution.shouldClarify) {
    return completeDeterministicAnswer({
      directAnswer:
        conversationResolution.clarificationQuestion ??
        "Which earlier option or asset do you mean?",
      decisionSummary: [{
        label: "Clarification needed",
        value:
          conversationResolution.clarificationQuestion ??
          "Name the option, asset or work order you want to continue with.",
      }],
      evidence: [],
      findings: [{
        category: "data",
        severity: "info",
        title: "Ambiguous follow-up reference",
        detail:
          "Ask Vorta found more than one plausible prior reference and did not choose silently.",
      }],
      coverOptions: [],
      recommendedActions: [],
      actionPlan: [],
      followUpQuestions: [],
      sources: [],
      missingData: [],
      confidence: 90,
      intentLabel: "Clarify follow-up reference",
      toolsUsed: [],
      evidenceLinks: [],
    });
  }

  try {
    if (hasDeterministicRouting) {`,
    "ambiguous follow-up clarification response",
  );

  write(path, source);
  console.log("Applied VOR-045 backend structured conversation context integration.");
}

function patchAgentService() {
  const path = "src/screens/AiOperations/vortaAgentService.ts";
  let source = read(path);
  if (source.includes("export interface VortaConversationContext")) {
    console.log("VOR-045 agent-service context integration is already applied.");
    return;
  }

  source = replaceOnce(
    source,
    `export interface VortaAgentHistoryItem {
  role: "user" | "assistant";
  content: string;
}
`,
    `export interface VortaAgentHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface VortaConversationContextOption {
  position: number;
  type: "equipment" | "ranked_action" | "cover" | "spare" | "document" | "work" | "skill";
  label: string;
  equipmentQuery?: string;
  equipmentId?: string;
  reference?: string;
  value?: string;
}

export interface VortaConversationContext {
  version: 1;
  subject: string;
  intent: string;
  activeEquipment: {
    query: string;
    id?: string;
    code?: string;
    name?: string;
  } | null;
  area: string | null;
  shift: {
    team?: string;
    type?: string;
    date?: string;
  } | null;
  dateRange: {
    startDate: string;
    endDate: string;
    timezone: string;
  } | null;
  orderedOptions: VortaConversationContextOption[];
  selectedOption: VortaConversationContextOption | null;
  updatedAt: string | null;
}
`,
    "agent service context types",
  );

  source = replaceOnce(
    source,
    `  evidenceGeneratedAt?: string;
}`,
    `  evidenceGeneratedAt?: string;
  conversationContext?: VortaConversationContext;
}`,
    "agent answer context field",
  );

  source = replaceOnce(
    source,
    `  history: VortaAgentHistoryItem[];
  pagePath: string;
}`,
    `  history: VortaAgentHistoryItem[];
  conversationContext?: VortaConversationContext;
  pagePath: string;
}`,
    "agent request context field",
  );

  source = replaceOnce(
    source,
    `function parseAgentAnswer(value: unknown): VortaAgentAnswer {`,
    `function isConversationContextOption(value: unknown): value is VortaConversationContextOption {
  return (
    isRecord(value) &&
    Number.isInteger(value.position) &&
    Number(value.position) >= 1 &&
    Number(value.position) <= 8 &&
    typeof value.type === "string" &&
    typeof value.label === "string" &&
    Boolean(value.label.trim())
  );
}

function isConversationContext(value: unknown): value is VortaConversationContext {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.subject === "string" &&
    typeof value.intent === "string" &&
    (value.activeEquipment === null || isRecord(value.activeEquipment)) &&
    (value.area === null || typeof value.area === "string") &&
    (value.shift === null || isRecord(value.shift)) &&
    (value.dateRange === null || isRecord(value.dateRange)) &&
    Array.isArray(value.orderedOptions) &&
    value.orderedOptions.length <= 8 &&
    value.orderedOptions.every(isConversationContextOption) &&
    (value.selectedOption === null || isConversationContextOption(value.selectedOption))
  );
}

function parseAgentAnswer(value: unknown): VortaAgentAnswer {`,
    "agent context validation",
  );

  source = replaceOnce(
    source,
    `    evidenceGeneratedAt:
      typeof record.evidenceGeneratedAt === "string" &&
      Number.isFinite(new Date(record.evidenceGeneratedAt).getTime())
        ? record.evidenceGeneratedAt
        : undefined,
  };`,
    `    evidenceGeneratedAt:
      typeof record.evidenceGeneratedAt === "string" &&
      Number.isFinite(new Date(record.evidenceGeneratedAt).getTime())
        ? record.evidenceGeneratedAt
        : undefined,
    conversationContext: isConversationContext(record.conversationContext)
      ? record.conversationContext
      : undefined,
  };`,
    "parsed agent context",
  );

  source = replaceOnce(
    source,
    `  history,
  pagePath,
}: AskVortaAgentInput)`,
    `  history,
  conversationContext,
  pagePath,
}: AskVortaAgentInput)`,
    "agent context destructuring",
  );

  source = replaceOnce(
    source,
    `        history: history.slice(-8),
        pageContext: {`,
    `        history: history.slice(-8),
        conversationContext,
        pageContext: {`,
    "agent request context payload",
  );

  write(path, source);
  console.log("Applied VOR-045 agent-service context integration.");
}

function patchAssistant() {
  const path = "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx";
  let source = read(path);
  if (source.includes("function latestConversationContext(")) {
    console.log("VOR-045 assistant context integration is already applied.");
    return;
  }

  source = replaceOnce(
    source,
    `  type VortaAgentHistoryItem,
} from "./vortaAgentService";`,
    `  type VortaAgentHistoryItem,
  type VortaConversationContext,
} from "./vortaAgentService";`,
    "assistant context type import",
  );

  source = replaceOnce(
    source,
    `  evidenceGeneratedAt?: string;
}`,
    `  evidenceGeneratedAt?: string;
  conversationContext?: VortaConversationContext;
}`,
    "assistant answer context field",
  );

  source = replaceOnce(
    source,
    `function agentRole(role: VortaAiRole): string {`,
    `function latestConversationContext(
  messages: GlobalAiMessage[],
): VortaConversationContext | undefined {
  return [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        message.answer?.conversationContext,
    )?.answer?.conversationContext;
}

function agentRole(role: VortaAiRole): string {`,
    "latest structured context helper",
  );

  source = replaceOnce(
    source,
    `            history,
            pagePath: window.location.pathname,`,
    `            history,
            conversationContext: latestConversationContext(messages),
            pagePath: window.location.pathname,`,
    "assistant request context",
  );

  source = replaceOnce(
    source,
    `            evidenceGeneratedAt: agentAnswer.evidenceGeneratedAt,
            roleLabel: roleProfile.label,`,
    `            evidenceGeneratedAt: agentAnswer.evidenceGeneratedAt,
            conversationContext: agentAnswer.conversationContext,
            roleLabel: roleProfile.label,`,
    "assistant answer context persistence",
  );

  write(path, source);
  console.log("Applied VOR-045 assistant structured context integration.");
}

function patchWorkspace() {
  const path = "src/screens/AiOperations/AskVortaWorkspace.tsx";
  let source = read(path);
  if (source.includes("conversationContext?: VortaConversationContext;")) {
    console.log("VOR-045 workspace context integration is already applied.");
    return;
  }

  source = replaceOnce(
    source,
    `import { Button } from "../../components/ui/button";
`,
    `import { Button } from "../../components/ui/button";
import type { VortaConversationContext } from "./vortaAgentService";
`,
    "workspace context type import",
  );

  source = replaceOnce(
    source,
    `  evidenceGeneratedAt?: string;
}`,
    `  evidenceGeneratedAt?: string;
  conversationContext?: VortaConversationContext;
}`,
    "workspace persisted context field",
  );

  write(path, source);
  console.log("Applied VOR-045 Recent-conversation context persistence.");
}

patchBackend();
patchAgentService();
patchAssistant();
patchWorkspace();
