from pathlib import Path

path = Path("netlify/functions/ask-vorta.mts")
source = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    source = source.replace(old, new, 1)


required_text = '''function requiredText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximumLength ? text : null;
}
'''
normalisers = required_text + r'''
function normaliseEquipmentReference(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/([a-z]+)0+(\d)/g, "$1$2");
}

function equipmentReferenceMatches(candidate: unknown, query: string): boolean {
  if (typeof candidate !== "string") return false;
  const rawCandidate = candidate.trim().toLowerCase();
  const rawQuery = query.trim().toLowerCase();
  if (rawCandidate.includes(rawQuery) || rawQuery.includes(rawCandidate)) return true;
  const normalisedCandidate = normaliseEquipmentReference(candidate);
  const normalisedQuery = normaliseEquipmentReference(query);
  return Boolean(
    normalisedCandidate.length >= 3 &&
      normalisedQuery.length >= 3 &&
      (normalisedCandidate.includes(normalisedQuery) ||
        normalisedQuery.includes(normalisedCandidate)),
  );
}

function extractEquipmentReference(value: string): string | null {
  const matches = value.match(/\b[a-z]{2,}(?:\s*-?\s*\d{1,3})(?:-[a-z0-9]+)*\b/gi) ?? [];
  return matches.length ? matches[matches.length - 1].replace(/\s+/g, "") : null;
}
'''
replace_once(required_text, normalisers, "equipment normalisers")

compact_domain = '''function compactToolDomain(result: ToolResult): JsonRecord {
  return {
    source: result.source,
    status: result.status,
    data: compactDecisionData(result.data),
    message: result.message,
  };
}
'''
decision_helpers = compact_domain + '''
function collectDecisionFacts(
  value: unknown,
  path = "",
  depth = 0,
): Array<{ score: number; text: string }> {
  if (depth > 6 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .slice(0, 40)
      .flatMap((item, index) =>
        collectDecisionFacts(item, `${path}[${index}]`, depth + 1),
      );
  }
  if (typeof value !== "object") return [];

  const facts: Array<{ score: number; text: string }> = [];
  for (const [key, item] of Object.entries(value as JsonRecord).slice(0, 100)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (
      (typeof item === "string" || typeof item === "number" || typeof item === "boolean") &&
      String(item).trim()
    ) {
      const keyScore = /code|number|reference|fault|component|part|skill|engineer|name/i.test(key)
        ? 8
        : /title|summary|description|action|outcome|status|quantity|stock|lead|risk|validation|calibration/i.test(key)
          ? 5
          : 1;
      const valueScore = /[A-Z]{2,}[-0-9]{2,}/.test(String(item)) ? 5 : 0;
      if (keyScore + valueScore >= 5) {
        facts.push({
          score: keyScore + valueScore,
          text: `${nextPath}: ${String(item).slice(0, 500)}`,
        });
      }
      continue;
    }
    facts.push(...collectDecisionFacts(item, nextPath, depth + 1));
  }
  return facts;
}

function equipmentDecisionFacts(
  selected: JsonRecord,
  domains: Record<string, JsonRecord>,
): string[] {
  const identity = [
    selected.equipment_code,
    selected.equipment_name,
    selected.code,
    selected.name,
    selected.area,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => `equipment: ${value}`);
  const ranked = collectDecisionFacts(domains)
    .sort((first, second) => second.score - first.score)
    .map((item) => item.text);
  return [...new Set([...identity, ...ranked])].slice(0, 36);
}
'''
replace_once(compact_domain, decision_helpers, "decision fact helpers")

replace_once(
    '''      const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      if (!query || result.status !== "ok" || !Array.isArray(result.data)) return result;
      const rows = result.data.filter((item) => {
        const row = item as JsonRecord;
        return [row.equipment_name, row.equipment_code, row.area]
          .filter((value): value is string => typeof value === "string")
          .some((value) => value.toLowerCase().includes(query));
      });
''',
    '''      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query || result.status !== "ok" || !Array.isArray(result.data)) return result;
      const rows = result.data.filter((item) => {
        const row = item as JsonRecord;
        return [row.equipment_name, row.equipment_code, row.area]
          .some((value) => equipmentReferenceMatches(value, query));
      });
''',
    "equipment risk matching",
)

replace_once(
    '''      const normalisedQuery = query.trim().toLowerCase();
      const exactMatch = matches.find((item) =>
        [item.equipment_name, item.equipment_code, item.name, item.code]
          .filter((value): value is string => typeof value === "string")
          .some((value) => value.trim().toLowerCase() === normalisedQuery),
      );
''',
    '''      const normalisedQuery = normaliseEquipmentReference(query);
      const exactMatch = matches.find((item) =>
        [item.equipment_name, item.equipment_code, item.name, item.code]
          .some((value) => {
            const normalisedCandidate = normaliseEquipmentReference(value);
            return Boolean(
              normalisedCandidate &&
                (normalisedCandidate === normalisedQuery ||
                  normalisedQuery.includes(normalisedCandidate)),
            );
          }),
      );
''',
    "decision pack exact match",
)

replace_once(
    '''      const domainEntries = await Promise.all(
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
''',
    '''      const domainEntries = await Promise.all(
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
      const domains = Object.fromEntries(domainEntries) as Record<string, JsonRecord>;
      return {
        source: "Equipment cross-domain decision pack",
        status: "ok",
        data: {
          query,
          equipment: compactDecisionData(selected),
          decisionFacts: equipmentDecisionFacts(selected, domains),
          domains,
          caveat:
''',
    "decision pack facts",
)

start = source.index("function deterministicQuestionPlan(")
end = source.index("\nasync function buildQuestionPlan(", start)
deterministic = r'''function deterministicQuestionPlan(
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
  });

  if (equipmentQuery) {
    const actionRequested = /\b(?:what (?:do|should)|do first|fix|stopping|let .* run|next shift must|can we)\b/.test(
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

  if (request.history.length > 0) return null;

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
  const planAndCover =
    /\b(?:pm|calibration|maintenance plan|planned work|workload|jobs?)\b/.test(question) &&
    /\b(?:cover|coverage|people|available|availability|rota|complete|achievable|slip)\b/.test(question);
  if (planAndCover && (coverDate || nextWeek)) {
    const range = nextWeek
      ? nextWeekRange()
      : { startDate: coverDate as string, endDate: coverDate as string };
    return fastPlan(
      "mixed",
      "maintenance_plan_cover_feasibility",
      ["get_site_maintenance_plan", "get_shift_cover"],
      "Compare the dated PM/calibration workload with the actual rota and validated skills. State what is achievable, what will slip and the first mitigation.",
      {
        ...range,
        summaryItemLimit: 5,
        forceActionPlan: true,
      },
    );
  }

  if (
    coverDate &&
    /\b(?:cover|coverage|short|rota|available|availability)\b/.test(question) &&
    /\b(?:shift|skills?|engineers?|people|team|day|night|today|tomorrow)\b/.test(question)
  ) {
    return fastPlan(
      "shift_cover",
      "shift_cover_risk",
      "get_shift_cover",
      "Identify the dated rota and validated-skill cover risks, then give the best evidence-backed cover action.",
      {
        startDate: coverDate,
        endDate: coverDate,
        summaryItemLimit: 4,
        forceActionPlan: true,
      },
    );
  }

  if (/\b(?:contractors?|external support|on[- ]call|remote support|onsite support|plc support)\b/.test(question)) {
    return fastPlan(
      "contractor",
      "contractor_support",
      "get_contractor_availability",
      "Report only recorded contractor skills and availability, with any confirmation caveat.",
      { summaryItemLimit: 4 },
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

  if (/\b(?:backlog|open work|overdue work|unassigned work|work orders?)\b/.test(question)) {
    return fastPlan(
      "work",
      "work_backlog",
      "get_site_work_backlog",
      "Prioritise the current work backlog using exact orders, assets, dates and readiness evidence.",
      { summaryItemLimit: 4 },
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

  if (/\b(?:biggest (?:maintenance )?(?:risks?|threats?|problems?)|maintenance threats?|site priorit(?:y|ies)|what needs attention|what should (?:i|we) (?:do|review|worry about) first|what should (?:i|we) worry about|what should (?:i|we) be (?:most )?worried about|what could stop (?:the )?site|what is likely to bite us)\b/.test(question)) {
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
'''
source = source[:start] + deterministic + source[end:]

shape_end = '''  answer.actionPlan = [
    {
      priority: "now",
      action,
      owner: scope === "spares" ? "Maintenance Manager / Stores" : "Maintenance Manager",
      expectedImpact:
        scope === "spares"
          ? "Starts the highest-priority verified stock intervention identified by the current Vorta evidence."
          : "Starts the highest-priority executable maintenance intervention identified by the current Vorta evidence.",
      verification:
        scope === "spares"
          ? "Open the linked Stores Inventory evidence and confirm the named part, shortfall, lead time and purchasing status."
          : "Open the linked Vorta evidence and confirm the named action has an owner and status before the next shift handover.",
    },
  ];
}
'''
planned_shape = shape_end + '''
function enforcePlannedResponseShape(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
): void {
  const scope = typeof questionPlan?.scope === "string" ? questionPlan.scope : "";
  const summaryLimit = scope === "mixed" ? 5 : new Set(["equipment", "skills"]).has(scope) ? 4 : 5;
  answer.decisionSummary = records(answer.decisionSummary).slice(0, summaryLimit);
  answer.followUpQuestions = textValues(answer.followUpQuestions).slice(0, 1);

  const actionRequested =
    questionPlan?.forceActionPlan === true ||
    /\b(?:what (?:do|should)|do first|can we fix|what is stopping|let .* run|next shift must)\b/i.test(
      String(questionPlan?.decisionGoal ?? ""),
    );
  if (!actionRequested || records(answer.actionPlan).length > 0) return;
  const action =
    textValues(answer.recommendedActions)[0] ??
    records(answer.findings)
      .map((item) => (typeof item.detail === "string" ? item.detail : ""))
      .find((value) => /\b(?:verify|replace|confirm|inspect|repair|order|test|challenge)\b/i.test(value)) ??
    "Review the linked Vorta evidence and assign the first verified intervention before releasing the work.";
  answer.actionPlan = [
    {
      priority: "now",
      action,
      owner: "Maintenance Manager",
      expectedImpact: "Starts the first evidence-backed intervention for the requested maintenance decision.",
      verification: "Open the linked equipment evidence and confirm the named action, owner and completion status.",
    },
  ];
}
'''
replace_once(shape_end, planned_shape, "planned response shaping")

replace_once(
    '''  const deterministicToolName =
    questionPlan?.routingMode === "deterministic"
      ? textValues(questionPlan.requiredTools)[0] ?? null
      : null;
  const deterministicArguments: JsonRecord =
    deterministicToolName === "get_shift_cover" ||
    deterministicToolName === "get_site_maintenance_plan"
      ? {
          start_date:
            typeof questionPlan?.startDate === "string"
              ? questionPlan.startDate
              : "",
          end_date:
            typeof questionPlan?.endDate === "string"
              ? questionPlan.endDate
              : "",
        }
      : {};
''',
    '''  const deterministicToolNames =
    questionPlan?.routingMode === "deterministic"
      ? textValues(questionPlan.requiredTools)
      : [];
  const hasDeterministicRouting = deterministicToolNames.length > 0;
  const deterministicArgumentsFor = (toolName: string): JsonRecord => {
    if (toolName === "get_shift_cover" || toolName === "get_site_maintenance_plan") {
      return {
        start_date:
          typeof questionPlan?.startDate === "string"
            ? questionPlan.startDate
            : "",
        end_date:
          typeof questionPlan?.endDate === "string"
            ? questionPlan.endDate
            : "",
      };
    }
    if (toolName === "get_equipment_decision_pack") {
      return {
        query:
          typeof questionPlan?.equipmentQuery === "string"
            ? questionPlan.equipmentQuery
            : "",
      };
    }
    return {};
  };
''',
    "multi-tool setup",
)

preload_start = source.index("    if (deterministicToolName) {")
preload_end = source.index("\n\n    for (let round", preload_start)
preload = r'''    if (hasDeterministicRouting) {
      const deterministicResults = await Promise.all(
        deterministicToolNames.map(async (toolName) => {
          const toolArguments = deterministicArgumentsFor(toolName);
          usedTools.add(toolName);
          let result: ToolResult;
          try {
            result = await executeTool(
              toolName,
              toolArguments,
              supabase,
              request,
            );
          } catch (error) {
            result = {
              source: toolName,
              status: "unavailable",
              message:
                error instanceof Error
                  ? error.message
                  : "The deterministic evidence lookup could not be completed.",
            };
          }
          toolOutcomes.set(toolName, result);
          if (result.status !== "unavailable") usedSources.add(result.source);
          if (
            toolName === "get_shift_cover" &&
            result.data &&
            typeof result.data === "object" &&
            !Array.isArray(result.data)
          ) {
            shiftCoverEvidence = result.data as JsonRecord;
            shiftCoverArguments = toolArguments;
          }
          const link = evidenceLinkForTool(toolName, toolArguments);
          if (link) evidenceLinks.set(link.path, link);
          return { toolName, result };
        }),
      );
      for (const { toolName, result } of deterministicResults) {
        input.push({
          role: "user",
          content:
            `Verified Vorta evidence from ${toolName}. Use this evidence directly, do not request another tool, and answer only from this authorised result:\n${trimToolResult(result)}`,
        });
      }
    }
'''
source = source[:preload_start] + preload + source[preload_end:]
source = source.replace("tools: deterministicToolName ? [] : TOOLS,", "tools: hasDeterministicRouting ? [] : TOOLS,")
source = source.replace('tool_choice: deterministicToolName\n          ? "none"', 'tool_choice: hasDeterministicRouting\n          ? "none"')
source = source.replace("parallel_tool_calls: !deterministicToolName,", "parallel_tool_calls: !hasDeterministicRouting,")

replace_once(
    '''        enforceDeterministicResponseShape(answer, questionPlan);
        const calibratedConfidence = evidenceAwareConfidence(
''',
    '''        enforceDeterministicResponseShape(answer, questionPlan);
        enforcePlannedResponseShape(answer, questionPlan);
        const calibratedConfidence = evidenceAwareConfidence(
''',
    "answer shape call",
)

instruction = '''    "For broad equipment questions use get_equipment_decision_pack. If it reports more than one plausible match, state the options and ask one focused clarification rather than choosing silently.",
'''
replace_once(
    instruction,
    instruction + '''    "When an equipment decision pack returns decisionFacts, treat them as the decisive evidence index. Use the relevant exact equipment code, fault code, work-order number, component code, named skill, named engineer and approved verification fact in the answer rather than replacing them with generic prose.",
''',
    "decision facts instruction",
)

path.write_text(source)
