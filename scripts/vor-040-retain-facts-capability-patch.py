from pathlib import Path

main_path = Path("netlify/functions/ask-vorta.mts")
main_source = main_path.read_text()
edge_path = Path("netlify/edge-functions/ask-vorta-work-backlog.ts")
edge_source = edge_path.read_text()


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


old_extract = r'''function extractEquipmentReference(value: string): string | null {
  const matches = value.match(/\b[a-z]{2,}(?:\s*-?\s*\d{1,3})(?:-[a-z0-9]+)*\b/gi) ?? [];
  return matches.length ? matches[matches.length - 1].replace(/\s+/g, "") : null;
}
'''
new_extract = r'''function extractEquipmentReference(value: string): string | null {
  const codedMatches =
    value.match(/\b[a-z]{2,}(?:\s*-?\s*\d{1,3})(?:-[a-z0-9]+)*\b/gi) ?? [];
  if (codedMatches.length > 0) {
    return codedMatches[codedMatches.length - 1].replace(/\s+/g, "");
  }

  const excludedAcronyms = new Set([
    "AI",
    "KPI",
    "OEM",
    "PLC",
    "PM",
    "RCA",
    "SAP",
    "SME",
    "SOP",
    "WO",
  ]);
  const acronymMatches = (value.match(/\b[A-Z]{3,5}\b/g) ?? []).filter(
    (candidate) => !excludedAcronyms.has(candidate),
  );
  return acronymMatches.length ? acronymMatches[acronymMatches.length - 1] : null;
}
'''
main_source = replace_once(
    main_source,
    old_extract,
    new_extract,
    "equipment acronym resolution",
)

facts_anchor = '''function equipmentDecisionFacts(
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
facts_helpers = facts_anchor + r'''
function relevantEquipmentDecisionFacts(
  question: string,
  decisionFacts: string[],
): string[] {
  const loweredQuestion = question.toLowerCase();
  const questionTokens = new Set(
    (loweredQuestion.match(/[a-z0-9-]{4,}/g) ?? []).filter(
      (token) => !new Set(["what", "with", "that", "this", "from", "have", "actually", "should"]).has(token),
    ),
  );
  const topicPatterns: RegExp[] = [];

  if (/\b(?:who|skill|qualified|qualification|without guessing|engineer|backup)\b/.test(loweredQuestion)) {
    topicPatterns.push(/engineer|skill|qualified|validated|candidate|competency|authorisation|training/i);
  }
  if (/\b(?:spare|part|stock|stopping|block|available|lead time)\b/.test(loweredQuestion)) {
    topicPatterns.push(/component|part|stock|quantity|availability|lead|work.?order|wo-/i);
  }
  if (/\b(?:run|campaign|release|proof|verify|verification)\b/.test(loweredQuestion)) {
    topicPatterns.push(/interlock|airflow|validation|challenge|approved|document|test|verification/i);
  }
  if (/\b(?:fault|wrong|repeat|reject|problem|keep|again)\b/.test(loweredQuestion)) {
    topicPatterns.push(/fault|sensor|reject|repeat|history|work.?order|component|vacuum|condenser/i);
  }
  if (/\b(?:water|conductivity|instrument|lying|bias|sample)\b/.test(loweredQuestion)) {
    topicPatterns.push(/conductivity|bias|grab sample|calibrated|reference|sensor|water/i);
  }

  return [...new Set(decisionFacts)]
    .map((fact, index) => {
      const loweredFact = fact.toLowerCase();
      let score = /^equipment:/.test(loweredFact) ? 40 : 0;
      if (/[A-Z]{2,}[-0-9]{2,}/.test(fact)) score += 8;
      for (const token of questionTokens) {
        if (loweredFact.includes(token)) score += 4;
      }
      for (const pattern of topicPatterns) {
        if (pattern.test(fact)) score += 18;
      }
      return { fact, score, index };
    })
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .slice(0, 12)
    .map((item) => item.fact);
}

function retainEquipmentDecisionFacts(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
  toolOutcomes: Map<string, ToolResult>,
): void {
  if (questionPlan?.scope !== "equipment") return;
  const pack = toolOutcomes.get("get_equipment_decision_pack");
  if (
    !pack?.data ||
    typeof pack.data !== "object" ||
    Array.isArray(pack.data)
  ) {
    return;
  }
  const decisionFacts = textValues((pack.data as JsonRecord).decisionFacts);
  if (decisionFacts.length === 0) return;

  const selectedFacts = relevantEquipmentDecisionFacts(
    String(questionPlan.decisionGoal ?? ""),
    decisionFacts,
  );
  answer.evidence = [
    ...new Set([
      ...textValues(answer.evidence),
      ...selectedFacts,
    ]),
  ].slice(0, 16);
}
'''
main_source = replace_once(
    main_source,
    facts_anchor,
    facts_helpers,
    "equipment fact retention helpers",
)

shape_call = '''        enforceDeterministicResponseShape(answer, questionPlan);
        enforcePlannedResponseShape(answer, questionPlan);
        const calibratedConfidence = evidenceAwareConfidence(
'''
shape_call_new = '''        enforceDeterministicResponseShape(answer, questionPlan);
        enforcePlannedResponseShape(answer, questionPlan);
        retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
        const calibratedConfidence = evidenceAwareConfidence(
'''
main_source = replace_once(
    main_source,
    shape_call,
    shape_call_new,
    "equipment fact retention call",
)

# Extend the existing edge middleware with a narrowly-scoped capability fast path.
edge_source = replace_once(
    edge_source,
    '''const OPEN_WORK_PATTERN = /\\b(?:backlog|open work|overdue work|unassigned work|work orders?)\\b/i;
const MIXED_DECISION_PATTERN = /\\b(?:shift|cover|rota|pm|calibration|spare|stock|part|skill|contractor|handover|history|document|manual)\\b/i;
const EQUIPMENT_CODE_PATTERN = /\\b[A-Z]{2,}(?:-[A-Z0-9]+)*-?\\d+[A-Z0-9-]*\\b/;
''',
    '''const OPEN_WORK_PATTERN = /\\b(?:backlog|open work|overdue work|unassigned work|work orders?)\\b/i;
const CAPABILITY_PATTERN = /\\b(?:one person deep|only one person|single[- ]person|single point|single[- ]point|backup sme|developed as backup|develop as backup)\\b/i;
const MIXED_DECISION_PATTERN = /\\b(?:shift|cover|rota|pm|calibration|spare|stock|part|contractor|handover|history|document|manual)\\b/i;
const EQUIPMENT_CODE_PATTERN = /\\b[A-Z]{2,}(?:-[A-Z0-9]+)*-?\\d+[A-Z0-9-]*\\b/;
''',
    "capability edge patterns",
)

request_anchor = '''function isFactualBacklogRequest(body: JsonRecord): boolean {
  const question = requiredText(body.question, 2_000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question || history.length > 0) return false;
  if (!OPEN_WORK_PATTERN.test(question)) return false;
  if (MIXED_DECISION_PATTERN.test(question.replace(OPEN_WORK_PATTERN, ""))) return false;
  if (EQUIPMENT_CODE_PATTERN.test(question)) return false;
  return true;
}
'''
request_helpers = request_anchor + '''
function isCapabilityRequest(body: JsonRecord): boolean {
  const question = requiredText(body.question, 2_000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question || history.length > 0) return false;
  if (!CAPABILITY_PATTERN.test(question)) return false;
  if (MIXED_DECISION_PATTERN.test(question)) return false;
  if (EQUIPMENT_CODE_PATTERN.test(question)) return false;
  return true;
}
'''
edge_source = replace_once(
    edge_source,
    request_anchor,
    request_helpers,
    "capability request classifier",
)

handler_gate = '''  const record = body as JsonRecord;
  if (!isFactualBacklogRequest(record)) return context.next(request);

  const question = requiredText(record.question, 2_000);
'''
handler_gate_new = '''  const record = body as JsonRecord;
  const requestKind = isFactualBacklogRequest(record)
    ? "backlog"
    : isCapabilityRequest(record)
      ? "capability"
      : null;
  if (!requestKind) return context.next(request);

  const question = requiredText(record.question, 2_000);
'''
edge_source = replace_once(
    edge_source,
    handler_gate,
    handler_gate_new,
    "edge request kind",
)

rate_anchor = '''    if (Number.isFinite(recentRequestCount) && recentRequestCount >= RATE_LIMIT_REQUESTS) {
      return jsonResponse(
        {
          error: `Ask Vorta allows ${RATE_LIMIT_REQUESTS} analyses every ${RATE_LIMIT_WINDOW_MINUTES} minutes. Wait briefly and try again.`,
        },
        429,
      );
    }

    const equipmentQuery = new URLSearchParams({
'''
capability_block = '''    if (Number.isFinite(recentRequestCount) && recentRequestCount >= RATE_LIMIT_REQUESTS) {
      return jsonResponse(
        {
          error: `Ask Vorta allows ${RATE_LIMIT_REQUESTS} analyses every ${RATE_LIMIT_WINDOW_MINUTES} minutes. Wait briefly and try again.`,
        },
        429,
      );
    }

    if (requestKind === "capability") {
      const capabilityResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/vorta_get_capability_reconciliation_report`,
        {
          method: "POST",
          headers: supabaseHeaders(anonKey, bearer, {
            "content-type": "application/json",
          }),
          body: JSON.stringify({ p_site_id: siteId, p_limit: 15 }),
        },
      );
      const capabilityReport = (await capabilityResponse.json().catch(() => null)) as JsonRecord | null;
      if (!capabilityResponse.ok || !capabilityReport) return context.next(request);

      const allActions = records(capabilityReport.actions);
      const backupActions = allActions.filter(
        (action) => String(action.actionType ?? "") === "BACKUP_SME_DEVELOPMENT",
      );
      const rankedActions = [...backupActions, ...allActions.filter((action) => !backupActions.includes(action))].slice(0, 4);
      const topAction = rankedActions[0];
      if (!topAction) return context.next(request);

      const equipment =
        topAction.equipment && typeof topAction.equipment === "object" && !Array.isArray(topAction.equipment)
          ? (topAction.equipment as JsonRecord)
          : {};
      const primarySme =
        topAction.primarySme && typeof topAction.primarySme === "object" && !Array.isArray(topAction.primarySme)
          ? (topAction.primarySme as JsonRecord)
          : {};
      const backupSme =
        topAction.backupSme && typeof topAction.backupSme === "object" && !Array.isArray(topAction.backupSme)
          ? (topAction.backupSme as JsonRecord)
          : {};
      const candidate =
        topAction.candidate && typeof topAction.candidate === "object" && !Array.isArray(topAction.candidate)
          ? (topAction.candidate as JsonRecord)
          : {};
      const requirement =
        topAction.requirement && typeof topAction.requirement === "object" && !Array.isArray(topAction.requirement)
          ? (topAction.requirement as JsonRecord)
          : {};
      const equipmentCode = requiredText(equipment.code, 120) || "the highest-ranked asset";
      const equipmentName = requiredText(equipment.name, 240) || "asset name not recorded";
      const primaryName = requiredText(primarySme.name, 200);
      const backupName = requiredText(backupSme.name, 200);
      const candidateName = requiredText(candidate.name, 200);
      const skillName = requiredText(requirement.skillName, 240);
      const recommendedAction =
        requiredText(topAction.recommendedAction, 1_000) ||
        "Complete the limiting skills and equipment validation, then designate an active backup SME.";
      const rationale = requiredText(topAction.rationale, 1_000);
      const interactionId = crypto.randomUUID();
      const questionFingerprint = await sha256Fingerprint(question.toLowerCase());

      const startResponse = await fetch(`${supabaseUrl}/rest/v1/ask_vorta_interactions`, {
        method: "POST",
        headers: supabaseHeaders(anonKey, bearer, {
          "content-type": "application/json",
          prefer: "return=minimal",
        }),
        body: JSON.stringify({
          id: interactionId,
          site_id: siteId,
          user_id: userId,
          role,
          question_fingerprint: questionFingerprint,
          status: "started",
        }),
      });
      if (!startResponse.ok) return context.next(request);

      const missingData = rankedActions
        .flatMap((action) =>
          Array.isArray(action.missingEvidence)
            ? action.missingEvidence.filter((item): item is string => typeof item === "string")
            : [],
        )
        .filter((item, index, values) => values.indexOf(item) === index)
        .slice(0, 5);
      const findings = rankedActions.map((action) => {
        const actionEquipment =
          action.equipment && typeof action.equipment === "object" && !Array.isArray(action.equipment)
            ? (action.equipment as JsonRecord)
            : {};
        const actionCandidate =
          action.candidate && typeof action.candidate === "object" && !Array.isArray(action.candidate)
            ? (action.candidate as JsonRecord)
            : {};
        return {
          category: "skills",
          severity: /critical/i.test(String(action.priorityLevel))
            ? "critical"
            : /high/i.test(String(action.priorityLevel))
              ? "high"
              : "medium",
          title: `${String(actionEquipment.code ?? "Asset")} · ${String(action.actionType ?? "Capability action")}`,
          detail: `${String(action.rationale ?? "Capability dependency recorded")}${actionCandidate.name ? ` Candidate: ${String(actionCandidate.name)}.` : ""} ${String(action.recommendedAction ?? "")}`.trim(),
        };
      });
      const evidence = rankedActions.map(
        (action) =>
          `${String((action.equipment as JsonRecord | undefined)?.code ?? "Asset")}: ${String(action.rationale ?? "Capability dependency recorded")}. Recommended action: ${String(action.recommendedAction ?? "not recorded")}.`,
      );
      const directAnswer = `${equipmentCode} (${equipmentName}) is the highest-ranked single-person capability dependency. ${primaryName ? `${primaryName} is the recorded primary SME; ` : ""}${backupName ? `${backupName} is the active backup SME.` : "no active validated backup SME is recorded."}${candidateName ? ` Develop ${candidateName} as the nearest recorded backup candidate.` : " No named backup candidate is currently proven."}`;
      const decisionSummary = [
        {
          label: "Highest dependency",
          value: `${equipmentCode} · ${String(topAction.priorityLevel ?? "priority not recorded")} · score ${String(topAction.priorityScore ?? "not recorded")}.`,
        },
        {
          label: "Current SME",
          value: primaryName || "No active validated primary SME is recorded.",
        },
        {
          label: "Backup candidate",
          value: candidateName
            ? `${candidateName}${skillName ? ` · limiting skill: ${skillName}` : ""}.`
            : "No named candidate is currently proven.",
        },
        {
          label: "Required action",
          value: recommendedAction,
        },
      ];
      const answer = {
        directAnswer,
        decisionSummary,
        evidence,
        findings,
        coverOptions: [],
        recommendedActions: [recommendedAction],
        actionPlan: [
          {
            priority: "now",
            action: recommendedAction,
            owner: String(topAction.actionOwner ?? "Maintenance Manager"),
            expectedImpact: `Reduces the single-person dependency on ${equipmentCode} by developing and validating a named backup.`,
            verification: `Confirm the candidate's limiting skill, equipment-specific evidence and active backup-SME designation in the Skills Matrix.`,
          },
        ],
        followUpQuestions: [],
        sources: ["Site capability risk actions"],
        missingData,
        confidence: candidateName ? 83 : 72,
        intentLabel: "capability_risk",
        toolsUsed: ["get_site_capability_actions"],
        evidenceGeneratedAt:
          requiredText(capabilityReport.generatedAt, 100) || new Date().toISOString(),
        evidenceLinks: [
          {
            label: "Open Skills Matrix",
            path: "/skills-matrix",
            recordType: "skill",
          },
        ],
        responseId: interactionId,
      };

      await patchInteraction(supabaseUrl, anonKey, bearer, interactionId, userId, {
        intent_label: "capability_risk",
        tools_used: ["get_site_capability_actions"],
        sources: ["Site capability risk actions"],
        confidence: answer.confidence,
        missing_data_count: missingData.length,
        duration_ms: Date.now() - startedAt,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      return jsonResponse(answer);
    }

    const equipmentQuery = new URLSearchParams({
'''
edge_source = replace_once(
    edge_source,
    rate_anchor,
    capability_block,
    "capability edge response",
)

main_path.write_text(main_source)
edge_path.write_text(edge_source)
