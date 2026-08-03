from pathlib import Path
import re


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"VOR-040 anchor {label} count {count}")
    return source.replace(old, new, 1)


path = Path("netlify/functions/ask-vorta.mts")
source = path.read_text()

helpers = r'''
function firstDecisionText(value: unknown, keys: string[]): string {
  for (const record of nestedDecisionRecords(value)) {
    const text = decisionField(record, keys);
    if (text) return text;
  }
  return "";
}

function firstDecisionNumber(value: unknown, keys: string[]): number | null {
  const text = firstDecisionText(value, keys);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function outcomeData(
  outcomes: Map<string, ToolResult>,
  toolName: string,
): unknown {
  return outcomes.get(toolName)?.data;
}

function operationalDomainData(value: unknown, domainName: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const domains = (value as JsonRecord).domains;
  if (!domains || typeof domains !== "object" || Array.isArray(domains)) return null;
  const domain = (domains as JsonRecord)[domainName];
  if (!domain || typeof domain !== "object" || Array.isArray(domain)) return null;
  return (domain as JsonRecord).data;
}

function readableEvidenceTime(timestamp: number | null): string {
  return timestamp === null
    ? "no verified source-update timestamp returned"
    : new Date(timestamp).toISOString().replace("T", " ").replace(/:\d{2}\.\d{3}Z$/, " UTC");
}

function deterministicOperationalAnswer(
  request: AskVortaRequest,
  questionPlan: JsonRecord | null,
  outcomes: Map<string, ToolResult>,
): JsonRecord | null {
  if (questionPlan?.routingMode !== "deterministic") return null;
  const intent = typeof questionPlan.intentLabel === "string" ? questionPlan.intentLabel : "";
  const generatedAt = new Date().toISOString();
  const base = {
    findings: [] as JsonRecord[],
    coverOptions: [] as JsonRecord[],
    recommendedActions: [] as string[],
    actionPlan: [] as JsonRecord[],
    followUpQuestions: [] as string[],
    sources: [] as string[],
    missingData: [] as string[],
    confidence: 75,
    intentLabel: intent,
    toolsUsed: [] as string[],
    evidenceLinks: [] as JsonRecord[],
    evidenceGeneratedAt: generatedAt,
  };

  if (intent === "maintenance_plan_cover_feasibility") {
    const planData = outcomeData(outcomes, "get_site_maintenance_plan");
    const coverData = outcomeData(outcomes, "get_shift_cover");
    const dueCount = firstDecisionNumber(planData, ["dueCount"]) ?? 0;
    const calibrationCount = firstDecisionNumber(planData, ["calibrationCount"]) ?? 0;
    const estimatedHours = firstDecisionNumber(planData, ["estimatedHours"]) ?? 0;
    const unassignedCount = firstDecisionNumber(planData, ["unassignedCount"]) ?? 0;
    const shiftsChecked = firstDecisionNumber(coverData, ["shiftsChecked"]) ?? 0;
    const reducedCoverShifts = firstDecisionNumber(coverData, ["reducedCoverShifts"]) ?? 0;
    const skillExposureShifts = firstDecisionNumber(coverData, ["shiftsWithSkillExposure"]) ?? 0;
    const gapsRemain = reducedCoverShifts > 0 || skillExposureShifts > 0 || unassignedCount > 0;
    const period = `${String(questionPlan.startDate || "next week")} to ${String(questionPlan.endDate || "")}`.replace(/ to $/, "");
    const firstAction = gapsRemain
      ? "Reconcile the highest-risk PM and calibration jobs against validated shift cover before releasing the weekly plan."
      : "Confirm the dated rota and release the planned PM and calibration workload."
    return {
      ...base,
      directAnswer: gapsRemain
        ? `The next-week PM and calibration workload is not fully proven achievable: ${dueCount} planned items (${calibrationCount} calibrations, ${estimatedHours} estimated hours) were checked against ${shiftsChecked} shifts, with ${reducedCoverShifts} reduced-cover shifts and ${skillExposureShifts} shifts carrying validated-skill gaps.`
        : `The next-week evidence supports the planned PM and calibration workload: ${dueCount} planned items (${calibrationCount} calibrations, ${estimatedHours} estimated hours) were checked against ${shiftsChecked} shifts with no recorded cover or validated-skill gap.`,
      decisionSummary: [
        { label: "Period", value: period },
        { label: "Planned workload", value: `${dueCount} PM/calibration items · ${estimatedHours} estimated hours · ${calibrationCount} calibrations.` },
        { label: "Cover evidence", value: `${shiftsChecked} shifts checked · ${reducedCoverShifts} reduced-cover · ${skillExposureShifts} with validated-skill gaps.` },
        { label: "Unassigned work", value: `${unassignedCount} planned items have no recorded assignee.` },
        { label: "First action", value: firstAction },
      ],
      evidence: [
        `Maintenance plan: ${dueCount} dated PM/calibration items, ${calibrationCount} calibrations, ${estimatedHours} estimated hours and ${unassignedCount} unassigned.`,
        `Shift cover: ${shiftsChecked} shifts checked, ${reducedCoverShifts} reduced-cover shifts and ${skillExposureShifts} shifts with validated-skill exposure.`,
      ],
      findings: [
        { category: "work", severity: gapsRemain ? "high" : "info", title: "Plan and cover comparison", detail: gapsRemain ? "The dated plan still has rota, validated-skill or assignment constraints; completion is not guaranteed." : "No recorded cover or assignment constraint was returned for the dated plan." },
      ],
      recommendedActions: [firstAction],
      actionPlan: [{
        priority: "before_weekly_plan_release",
        action: firstAction,
        owner: "Maintenance Manager / Planner",
        expectedImpact: "Prevents PM or calibration work being released without the recorded people and validated skills needed to complete it.",
        verification: "Open the linked maintenance plan and Shift Cover evidence and confirm every priority job has an assignee and validated cover.",
      }],
      missingData: gapsRemain
        ? ["Overtime acceptance, unrecorded leave and final job sequencing are not proven by the current evidence."]
        : ["Final overtime acceptance and unrecorded leave still require manager confirmation."],
      confidence: gapsRemain ? 72 : 82,
    };
  }

  if (intent === "site_evidence_freshness") {
    const riskData = outcomeData(outcomes, "get_site_risk");
    const timestamps = evidenceTimestamps(riskData);
    const newest = timestamps.length ? Math.max(...timestamps) : null;
    const oldest = timestamps.length ? Math.min(...timestamps) : null;
    const freshness = readableEvidenceTime(newest);
    return {
      ...base,
      directAnswer: newest
        ? `The current site-risk answer is backed by recorded Vorta evidence last updated at ${freshness}; that timestamp is source freshness, not a guarantee of real-time conditions.`
        : "Vorta returned the current site-risk evidence but no verified source-update timestamp, so freshness cannot be proven from this result.",
      decisionSummary: [
        { label: "Newest evidence", value: freshness },
        { label: "Oldest evidence", value: readableEvidenceTime(oldest) },
        { label: "Freshness caveat", value: "Query time and source-update time are different; real-time status is not guaranteed." },
      ],
      evidence: [`Site-risk evidence timestamp check: ${freshness}.`],
      missingData: newest ? [] : ["The site-risk result did not expose a verified source-update timestamp."],
      confidence: newest ? 82 : 55,
    };
  }

  if (intent === "site_missing_evidence") {
    const snapshot = outcomeData(outcomes, "get_site_operational_snapshot");
    const domainsValue = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? (snapshot as JsonRecord).domains
      : null;
    const domains = domainsValue && typeof domainsValue === "object" && !Array.isArray(domainsValue)
      ? Object.entries(domainsValue as JsonRecord)
      : [];
    const unavailable = domains
      .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value) && (value as JsonRecord).status === "unavailable")
      .map(([name]) => name);
    const empty = domains
      .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value) && (value as JsonRecord).status === "empty")
      .map(([name]) => name);
    const recorded = domains.filter(([, value]) => value && typeof value === "object" && !Array.isArray(value) && (value as JsonRecord).status === "ok").map(([name]) => name);
    const missing = [
      ...(unavailable.length ? [`Unavailable evidence domains: ${unavailable.join(", ")}.`] : []),
      ...(empty.length ? [`No current records returned for: ${empty.join(", ")}.`] : []),
      "Vorta cannot prove unrecorded leave, overtime acceptance, fatigue/rest approval, supplier acceptance or work completed outside the recorded source systems.",
    ];
    return {
      ...base,
      directAnswer: `Vorta can prove the recorded ${recorded.join(", ") || "maintenance"} evidence, but it cannot confirm facts that are missing, unavailable or not entered in the source systems.`,
      decisionSummary: [
        { label: "Proven domains", value: recorded.join(", ") || "No complete domain was returned." },
        { label: "Unavailable domains", value: unavailable.join(", ") || "None returned as unavailable." },
        { label: "Empty domains", value: empty.join(", ") || "None returned empty." },
        { label: "Cannot confirm", value: "Unrecorded leave, overtime acceptance, fatigue/rest approval, supplier acceptance and off-system work completion." },
      ],
      evidence: domains.map(([name, value]) => `${name}: ${String((value as JsonRecord).status ?? "unknown")}`),
      missingData: missing,
      confidence: recorded.length ? 68 : 40,
    };
  }

  if (intent === "morning_maintenance_briefing") {
    const snapshot = outcomeData(outcomes, "get_site_operational_snapshot");
    const riskData = operationalDomainData(snapshot, "siteRisk");
    const workData = operationalDomainData(snapshot, "workBacklog");
    const sparesData = operationalDomainData(snapshot, "sparesRisk");
    const riskScore = firstDecisionNumber(riskData, ["riskScore"]) ?? 0;
    const highestArea = firstDecisionText(riskData, ["highestArea"]) || "highest-risk area not returned";
    const overdueCount = firstDecisionNumber(workData, ["overdueCount"]) ?? 0;
    const openCount = firstDecisionNumber(workData, ["openCount"]) ?? 0;
    const outOfStockCount = firstDecisionNumber(sparesData, ["outOfStockCount"]) ?? 0;
    const criticalSpare = firstDecisionText(sparesData, ["componentCode", "componentName", "equipmentCode"]);
    return {
      ...base,
      directAnswer: "Use these three evidence-backed points in the morning maintenance meeting: current site risk, overdue work and the critical-spares constraint.",
      decisionSummary: [
        { label: "1 · Risk", value: `Site risk ${riskScore}; highest-risk area ${highestArea}.` },
        { label: "2 · Work", value: `${overdueCount} overdue from ${openCount} open work orders.` },
        { label: "3 · Spares", value: `${outOfStockCount} out-of-stock risk items${criticalSpare ? `; first recorded constraint ${criticalSpare}` : ""}.` },
      ],
      evidence: [
        `Risk evidence: site score ${riskScore}, highest area ${highestArea}.`,
        `Work evidence: ${openCount} open and ${overdueCount} overdue.`,
        `Spares evidence: ${outOfStockCount} out of stock${criticalSpare ? `, including ${criticalSpare}` : ""}.`,
      ],
      confidence: 78,
    };
  }

  if (intent === "verified_risk_reduction_ranking") {
    const snapshot = outcomeData(outcomes, "get_site_operational_snapshot");
    const riskData = operationalDomainData(snapshot, "siteRisk");
    const priorityAction = firstDecisionText(riskData, ["priorityAction", "priority_action"])
      || firstDecisionText(snapshot, ["priorityAction", "priority_action"]);
    const riskScore = firstDecisionNumber(riskData, ["riskScore"]) ?? 0;
    const highestArea = firstDecisionText(riskData, ["highestArea"]) || "highest-risk area not returned";
    const action = priorityAction || "Complete the highest-value verified maintenance work queue shown in the current site-risk evidence.";
    return {
      ...base,
      directAnswer: `The single highest verified risk-reduction intervention is: ${action}`,
      decisionSummary: [
        { label: "Current risk", value: `Site risk ${riskScore}; highest-risk area ${highestArea}.` },
        { label: "Highest-value action", value: action },
        { label: "Evidence basis", value: "Current calculated site-risk and cross-domain work, spare, capability and handover evidence." },
      ],
      evidence: [`Verified risk-reduction action: ${action}`],
      findings: [{ category: "risk", severity: "high", title: "Highest verified intervention", detail: action }],
      recommendedActions: [action],
      actionPlan: [{
        priority: "now",
        action,
        owner: "Maintenance Manager",
        expectedImpact: "Delivers the largest currently verified risk reduction recorded by Vorta; the exact projected change remains governed by the linked calculation.",
        verification: "Open the operational dashboard and confirm the action, owner, work status and projected risk reduction before release.",
      }],
      missingData: priorityAction ? [] : ["The snapshot did not expose a named priority action; the linked dashboard must be checked before work release."],
      confidence: priorityAction ? 84 : 58,
    };
  }

  return null;
}

'''

anchor = "function deterministicQuestionPlan(\n"
if helpers.strip() not in source:
    if anchor not in source:
        raise SystemExit("deterministicQuestionPlan anchor missing")
    source = source.replace(anchor, helpers + anchor, 1)

source = replace_once(
    source,
    '''      forceActionPlan?: boolean;
      equipmentQuery?: string;
    } = {},''',
    '''      forceActionPlan?: boolean;
      equipmentQuery?: string;
      followUpLimit?: number;
    } = {},''',
    "fastPlan options",
)
source = replace_once(
    source,
    '''    summaryItemLimit: options.summaryItemLimit ?? 4,
    forceActionPlan: options.forceActionPlan ?? false,
  });''',
    '''    summaryItemLimit: options.summaryItemLimit ?? 4,
    forceActionPlan: options.forceActionPlan ?? false,
    followUpLimit: options.followUpLimit ?? 1,
  });''',
    "fastPlan return",
)

route_anchor = '''  if (/\\b(?:contractors?|external support|on[- ]call|remote support|onsite support|plc support)\\b/.test(question)) {'''
routes = r'''  const evidenceFreshnessRequest =
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

'''
if route_anchor not in source:
    raise SystemExit("operational route anchor missing")
source = source.replace(route_anchor, routes + route_anchor, 1)

source = replace_once(
    source,
    '''  answer.followUpQuestions = textValues(answer.followUpQuestions).slice(0, 1);''',
    '''  const configuredFollowUpLimit = Number(questionPlan.followUpLimit);
  const followUpLimit = Number.isFinite(configuredFollowUpLimit)
    ? Math.max(0, Math.min(1, Math.round(configuredFollowUpLimit)))
    : 1;
  answer.followUpQuestions = textValues(answer.followUpQuestions).slice(0, followUpLimit);''',
    "deterministic follow-up limit",
)

completion_anchor = '''  const deterministicArgumentsFor = (toolName: string): JsonRecord => {
'''
if completion_anchor not in source:
    raise SystemExit("deterministic arguments anchor missing")
# Insert completion helper after deterministicArgumentsFor block using its exact closing anchor.
closing = '''    return {};
  };

  try {'''
completion = r'''    return {};
  };

  const completeDeterministicAnswer = async (
    answer: JsonRecord,
  ): Promise<Response> => {
    enforceAnswerEvidence(
      answer,
      request.question,
      shiftCoverEvidence,
      shiftCoverArguments,
    );
    enforceDeterministicResponseShape(answer, questionPlan);
    enforcePlannedResponseShape(answer, questionPlan);
    retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
    answer.confidence = evidenceAwareConfidence(answer, questionPlan, toolOutcomes);
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
  };

  try {'''
source = replace_once(source, closing, completion, "completion helper")

insert_after_results = '''      for (const { toolName, result } of deterministicResults) {
        input.push({
          role: "user",
          content:
            `Verified Vorta evidence from ${toolName}. Use this evidence directly, do not request another tool, and answer only from this authorised result:\\n${trimToolResult(result)}`,
        });
      }
    }


    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {'''
replace_after_results = '''      for (const { toolName, result } of deterministicResults) {
        input.push({
          role: "user",
          content:
            `Verified Vorta evidence from ${toolName}. Use this evidence directly, do not request another tool, and answer only from this authorised result:\\n${trimToolResult(result)}`,
        });
      }
      const deterministicAnswer = deterministicOperationalAnswer(
        request,
        questionPlan,
        toolOutcomes,
      );
      if (deterministicAnswer) {
        return completeDeterministicAnswer(deterministicAnswer);
      }
    }


    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {'''
source = replace_once(source, insert_after_results, replace_after_results, "direct deterministic answer")

catch_anchor = '''  } catch (error) {
    await supabase
      .from("ask_vorta_interactions")'''
catch_replacement = '''  } catch (error) {
    const verifiedFallback = deterministicOperationalAnswer(
      request,
      questionPlan,
      toolOutcomes,
    );
    if (verifiedFallback && usedSources.size > 0) {
      console.warn("Ask Vorta final reasoning failed; returning verified deterministic evidence", {
        requestId: _context.requestId,
        userId: userData.user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return completeDeterministicAnswer(verifiedFallback);
    }
    await supabase
      .from("ask_vorta_interactions")'''
source = replace_once(source, catch_anchor, catch_replacement, "verified catch fallback")

path.write_text(source)
print("Applied deterministic operational answers and verified fallback.")
