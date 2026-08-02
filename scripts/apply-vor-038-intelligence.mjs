import { readFileSync, writeFileSync, rmSync } from "node:fs";

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing patch marker: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Patch marker is not unique: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function insertBefore(source, marker, insertion, label) {
  return replaceOnce(source, marker, insertion + marker, label);
}

const sourcePath = "netlify/functions/ask-vorta.mts";
let source = readFileSync(sourcePath, "utf8");

source = replaceOnce(source, 'const MODEL = "gpt-4.1-mini";', 'const MODEL = "gpt-5.6-terra";\nconst PLANNER_MODEL = "gpt-5.6-luna";', "model constants");
source = replaceOnce(source, "const MAX_TOOL_ROUNDS = 5;", "const MAX_TOOL_ROUNDS = 8;", "tool rounds");
source = replaceOnce(source, "const MAX_TOOL_OUTPUT_CHARACTERS = 35_000;", "const MAX_TOOL_OUTPUT_CHARACTERS = 50_000;", "tool output budget");
source = replaceOnce(source, "record.history.slice(-8)", "record.history.slice(-12)", "history depth");

source = insertBefore(
  source,
  '  {\n    type: "function",\n    name: "get_equipment_risk",',
  String.raw`  {
    type: "function",
    name: "get_site_operational_snapshot",
    description:
      "Get a cross-domain maintenance-manager decision snapshot covering current site risk, open work backlog, critical spares, capability dependencies and the latest shift handover. Use this for broad or vague questions such as what should I worry about, what needs attention, what should we do first, what changed or what could stop the site.",
    parameters: EMPTY_PARAMETERS,
    strict: true,
  },
`,
  "site operational snapshot tool",
);

source = insertBefore(
  source,
  '  {\n    type: "function",\n    name: "get_shift_cover",',
  String.raw`  {
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
`,
  "equipment decision pack tool",
);

const questionPlanSchema = String.raw`
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

`;
source = insertBefore(source, "function jsonResponse(body: unknown", questionPlanSchema, "question plan schema");

const compactHelper = String.raw`
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

`;
source = insertBefore(source, "function textValues(value: unknown)", compactHelper, "decision pack compaction");

source = replaceOnce(
  source,
  '    get_site_risk: { label: "Open site risk", path: "/dashboard", recordType: "risk" },',
  '    get_site_risk: { label: "Open site risk", path: "/dashboard", recordType: "risk" },\n    get_site_operational_snapshot: { label: "Open operational dashboard", path: "/dashboard", recordType: "risk" },\n    get_equipment_decision_pack: { label: "Open equipment register", path: "/equipment", recordType: "equipment" },',
  "evidence links",
);

const siteSnapshotCase = String.raw`
    case "get_site_operational_snapshot": {
      const domainEntries = await Promise.all([
        ["siteRisk", executeTool("get_site_risk", {}, supabase, request)],
        ["workBacklog", executeTool("get_site_work_backlog", {}, supabase, request)],
        ["sparesRisk", executeTool("get_site_spares_risk", {}, supabase, request)],
        ["capability", executeTool("get_site_capability_actions", {}, supabase, request)],
        ["shiftHandover", executeTool("get_shift_handover", {}, supabase, request)],
      ].map(async ([key, pending]) => [key, compactToolDomain(await pending)] as const));
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

`;
source = insertBefore(source, '    case "get_equipment_risk": {', siteSnapshotCase, "site snapshot switch case");

const equipmentPackCase = String.raw`
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

`;
source = insertBefore(source, '    case "get_shift_cover": {', equipmentPackCase, "equipment pack switch case");

const plannerFunction = String.raw`
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

`;
source = insertBefore(source, "function systemInstructions(request: AskVortaRequest)", plannerFunction, "planner function");
source = replaceOnce(
  source,
  "function systemInstructions(request: AskVortaRequest): string {",
  "function systemInstructions(\n  request: AskVortaRequest,\n  questionPlan: JsonRecord | null,\n): string {",
  "system instruction signature",
);

source = replaceOnce(
  source,
  '    "Do not give a management slogan when Vorta contains names, dates, order numbers, part codes, quantities, risk reductions or prior-work evidence. Surface the decision-ready detail.",',
  '    "Do not give a management slogan when Vorta contains names, dates, order numbers, part codes, quantities, risk reductions or prior-work evidence. Surface the decision-ready detail.",\n    "Understand any natural wording rather than matching prepared questions. Correct obvious spelling mistakes silently, interpret shorthand, use history for follow-ups and answer every material part of a mixed question.",\n    "The semantic question plan is a routing hypothesis, not evidence. Verify it against actual tool results, call any missing required evidence tool before finalising, and deviate from the plan when the returned evidence proves a better route.",\n    "For broad site-priority questions use get_site_operational_snapshot, then add dated shift-cover or maintenance-plan evidence when the decision depends on a specific period.",\n    "For broad equipment questions use get_equipment_decision_pack. If it reports more than one plausible match, state the options and ask one focused clarification rather than choosing silently.",\n    "Cross-check conclusions across domains. Examples: a work order is not executable if the required part or skill is missing; a PM plan is not achievable merely because labour headcount exists; and the highest numerical risk is not automatically the first action if the intervention is not executable.",\n    "Before answering, test the proposed conclusion against contradictory evidence, source freshness, missing data and the question actually asked. Do not hide conflict behind a confidence score.",',
  "general intelligence instructions",
);

source = replaceOnce(
  source,
  '    `User role: ${request.role}.`,\n  ].join("\\n");',
  '    `User role: ${request.role}.`,\n    questionPlan\n      ? `Semantic question plan (routing guidance only): ${JSON.stringify(questionPlan)}`\n      : "Semantic question plan unavailable. Infer the decision goal carefully and verify it with Vorta evidence.",\n  ].join("\\n");',
  "plan injection",
);

source = replaceOnce(
  source,
  '  const client = new OpenAI();\n  const input: ResponseInput = [',
  '  const client = new OpenAI();\n  let questionPlan: JsonRecord | null = null;\n  try {\n    questionPlan = await buildQuestionPlan(client, request);\n  } catch (error) {\n    console.warn("Ask Vorta semantic planning failed; continuing with direct evidence reasoning", {\n      requestId: _context.requestId,\n      error: error instanceof Error ? error.message : String(error),\n    });\n  }\n  const input: ResponseInput = [',
  "planner call",
);

source = replaceOnce(
  source,
  '        model: Netlify.env.get("VORTA_AI_MODEL") || MODEL,\n        instructions: systemInstructions(request),',
  '        model: Netlify.env.get("VORTA_AI_MODEL") || MODEL,\n        reasoning: { effort: "medium" },\n        instructions: systemInstructions(request, questionPlan),',
  "main reasoning model",
);
source = replaceOnce(
  source,
  '        tool_choice: "auto",',
  '        tool_choice:\n          round === 0 && questionPlan?.shouldUseTools === true\n            ? "required"\n            : "auto",',
  "first round tool requirement",
);
source = replaceOnce(source, "        max_output_tokens: 3_000,", "        max_output_tokens: 5_000,", "answer token budget");
source = replaceOnce(
  source,
  '        text: {\n          format: {',
  '        text: {\n          verbosity: "low",\n          format: {',
  "answer verbosity",
);

source = replaceOnce(
  source,
  '      if (toolCalls.length === 0) {\n        const answer = JSON.parse(response.output_text) as JsonRecord;',
  '      if (toolCalls.length === 0) {\n        const plannedRequiredTools = textValues(questionPlan?.requiredTools);\n        const missingPlannedTools = plannedRequiredTools.filter(\n          (toolName) => !usedTools.has(toolName),\n        );\n        if (missingPlannedTools.length > 0 && round < MAX_TOOL_ROUNDS - 1) {\n          input.push({\n            role: "user",\n            content:\n              "Evidence completeness check: the semantic plan still requires these Vorta tools before a final answer: " +\n              missingPlannedTools.join(", ") +\n              ". Call the relevant tools now, or use the returned evidence to explain why a planned tool is genuinely inapplicable. Do not answer from the plan itself.",\n          });\n          continue;\n        }\n        const answer = JSON.parse(response.output_text) as JsonRecord;',
  "planned tool enforcement",
);

writeFileSync(sourcePath, source);

let evalScript = readFileSync("scripts/ask-vorta-live-evals.mjs", "utf8");
evalScript = replaceOnce(
  evalScript,
  "      history: [],\n      pageContext: { path: \"/dashboard\", timezone: \"Europe/London\" },",
  "      history: scenario.history || [],\n      pageContext: {\n        path: scenario.path || \"/dashboard\",\n        timezone: scenario.timezone || \"Europe/London\",\n      },",
  "eval conversation context",
);
evalScript = replaceOnce(
  evalScript,
  "    for (const tool of scenario.expectedTools) {",
  "    for (const tool of scenario.expectedTools || []) {",
  "optional expected tools",
);
evalScript = replaceOnce(
  evalScript,
  "    for (const phrase of scenario.mustMention) {",
  "    if (scenario.expectedAnyTools?.length && !scenario.expectedAnyTools.some((tool) => usedTools.has(tool))) {\n      failures.push(`missing any tool: ${scenario.expectedAnyTools.join(\", \")}`);\n    }\n    if (scenario.minimumToolCount && usedTools.size < scenario.minimumToolCount) {\n      failures.push(`used ${usedTools.size} tools; expected at least ${scenario.minimumToolCount}`);\n    }\n    for (const phrase of scenario.mustMention || []) {",
  "richer eval tool checks",
);
writeFileSync("scripts/ask-vorta-live-evals.mjs", evalScript);

const intelligenceEvals = [
  {
    id: "vor038-broad-priorities-natural",
    question: "Give me the three things most likely to hurt us today and what I should do first.",
    expectedTools: ["get_site_operational_snapshot"],
    mustMentionAny: ["risk", "work", "spare", "skill", "handover"],
    mustNotMention: ["I do not know", "check each system"],
  },
  {
    id: "vor038-spares-colloquial",
    question: "Anything nasty lurking in stores that could stop a repair?",
    expectedTools: ["get_site_spares_risk"],
    mustMentionAny: ["stock", "part", "spare", "component"],
    mustNotMention: ["check the warehouse"],
  },
  {
    id: "vor038-plan-feasibility-mixed",
    question: "Can we actually deliver next week's PM and calibration plan with the people available?",
    expectedTools: ["get_site_maintenance_plan", "get_shift_cover"],
    minimumToolCount: 2,
    mustMentionAny: ["plan", "cover", "skill", "assigned"],
    mustNotMention: ["probably", "should be fine"],
  },
  {
    id: "vor038-cover-typos",
    question: "whats the bigest labour rik nxt wk and who cud cover it",
    expectedTools: ["get_shift_cover"],
    mustMentionAny: ["cover", "shift", "skill", "scheduled"],
    mustNotMention: ["equipment fault"],
  },
  {
    id: "vor038-equipment-broad",
    question: "Tell me what matters about the Bosch vial filler: why it is risky, what is open and what action cuts the risk most.",
    expectedTools: ["get_equipment_decision_pack"],
    mustMentionAny: ["risk", "work", "action"],
    mustNotMention: ["select an equipment page"],
  },
  {
    id: "vor038-follow-up-pronoun",
    history: [
      { role: "user", content: "Tell me about the Bosch vial filler." },
      { role: "assistant", content: "The Bosch vial filler is the equipment being reviewed." },
    ],
    path: "/equipment/40000000-0000-0000-0000-000000000001/overview",
    question: "What failed on it last time and have we got the parts to do it again?",
    expectedAnyTools: ["get_equipment_decision_pack", "get_equipment_history"],
    minimumToolCount: 1,
    mustMentionAny: ["history", "work order", "part", "stock", "spare"],
    mustNotMention: ["what do you mean by it"],
  },
  {
    id: "vor038-cross-domain-executability",
    question: "Which high-risk job looks urgent but cannot actually be executed because of people or parts?",
    expectedTools: ["get_site_operational_snapshot"],
    mustMentionAny: ["work", "skill", "part", "stock", "execute"],
    mustNotMention: ["all high-risk jobs are executable"],
  },
  {
    id: "vor038-handover-shorthand",
    question: "What did nights leave us and what needs chasing first?",
    expectedTools: ["get_shift_handover"],
    mustMentionAny: ["completed", "ongoing", "waiting", "next"],
    mustNotMention: ["I cannot see the handover"],
  },
  {
    id: "vor038-advisory-not-write",
    question: "What should we order first and why?",
    expectedTools: ["get_site_spares_risk"],
    mustMentionAny: ["stock", "lead", "shortfall", "part"],
    mustNotMention: ["read-only and cannot", "order placed"],
  },
  {
    id: "vor038-write-command-read-only",
    question: "Assign the best three cover engineers to Red Shift now.",
    expectedTools: [],
    mustMention: ["read-only"],
    mustMentionAny: ["cannot", "can’t"],
    mustNotMention: ["assigned successfully", "has been assigned"],
  },
  {
    id: "vor038-ambiguous-asset",
    question: "Why is the filler risky?",
    expectedAnyTools: ["get_equipment_decision_pack", "get_equipment_risk"],
    mustMentionAny: ["filler", "equipment", "risk"],
    mustNotMention: ["I picked one at random"],
  },
  {
    id: "vor038-contractor-mixed",
    question: "If our own team cannot cover the PLC gap, who outside the team has recorded support and what still needs confirming?",
    expectedTools: ["get_contractor_availability"],
    mustMentionAny: ["PLC", "availability", "confirm", "contractor"],
    mustNotMention: ["definitely available", "assigned"],
  },
];
writeFileSync("tests/evals/vor-038-intelligence.json", JSON.stringify(intelligenceEvals, null, 2) + "\n");

const contract = String.raw`import { readFileSync } from "node:fs";

const source = readFileSync("netlify/functions/ask-vorta.mts", "utf8");
const runner = readFileSync("scripts/run-contract-suite.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const evals = JSON.parse(readFileSync("tests/evals/vor-038-intelligence.json", "utf8"));

const checks = [
  [source.includes('const MODEL = "gpt-5.6-terra"'), "balanced GPT-5.6 reasoning model is the backend default"],
  [source.includes('const PLANNER_MODEL = "gpt-5.6-luna"'), "separate efficient semantic planner exists"],
  [source.includes('reasoning: { effort: "low" }'), "planner reasoning effort is explicit"],
  [source.includes('reasoning: { effort: "medium" }'), "answer reasoning effort is explicit"],
  [source.includes("buildQuestionPlan"), "semantic planning stage is called"],
  [source.includes("get_site_operational_snapshot"), "broad cross-domain site tool exists"],
  [source.includes("get_equipment_decision_pack"), "broad cross-domain equipment tool exists"],
  [source.includes("missingPlannedTools"), "server enforces planned evidence completeness"],
  [source.includes("MAX_TOOL_ROUNDS = 8"), "multi-step tool budget is increased"],
  [source.includes("matching prepared questions"), "instructions prohibit prepared-question matching"],
  [runner.includes("VOR-038 Ask Vorta intelligence"), "permanent contract is in the main suite"],
  [packageJson.scripts["eval:ask-vorta:vor038"]?.includes("vor-038-intelligence.json"), "live intelligence eval command exists"],
  [Array.isArray(evals) && evals.length >= 12, "at least twelve semantic intelligence scenarios exist"],
  [evals.some((item) => item.history?.length), "follow-up conversation context is evaluated"],
  [evals.some((item) => /rik|cud|nxt/.test(item.question)), "misspelt shorthand is evaluated"],
  [evals.some((item) => item.minimumToolCount >= 2), "mixed-domain tool orchestration is evaluated"],
];

const failures = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) console.log(`${passed ? "PASS" : "FAIL"} - ${label}`);
if (failures.length) process.exit(1);
console.log(`VOR-038 Ask Vorta intelligence contract passed: ${checks.length}/${checks.length}.`);
`;
writeFileSync("scripts/vor-038-ask-vorta-intelligence-contracts.mjs", contract);

let runner = readFileSync("scripts/run-contract-suite.mjs", "utf8");
runner = replaceOnce(
  runner,
  '  ["VOR-037 unified Ask Vorta", "scripts/vor-037-unified-ask-vorta-contracts.mjs"],',
  '  ["VOR-037 unified Ask Vorta", "scripts/vor-037-unified-ask-vorta-contracts.mjs"],\n  ["VOR-038 Ask Vorta intelligence", "scripts/vor-038-ask-vorta-intelligence-contracts.mjs"],',
  "contract runner entry",
);
writeFileSync("scripts/run-contract-suite.mjs", runner);

const packagePath = "package.json";
const packageData = JSON.parse(readFileSync(packagePath, "utf8"));
packageData.scripts["eval:ask-vorta:vor038"] =
  "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-038-intelligence.json";
writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + "\n");

rmSync("scripts/apply-vor-038-intelligence.mjs", { force: true });
rmSync(".github/workflows/vor-038-self-patch.yml", { force: true });
console.log("Applied VOR-038 backend intelligence patch and removed temporary patch machinery.");
