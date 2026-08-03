import { readFileSync, writeFileSync } from "node:fs";

const targetPath = "netlify/functions/ask-vorta.mts";
let source = readFileSync(targetPath, "utf8");

const integratedMarkers = [
  'case "get_site_ranked_actions":',
  '["rankedActions", executeTool("get_site_ranked_actions", {}, supabase, request)]',
  '"vorta_get_ranked_operational_actions"',
  'const rankedData = operationalDomainData(snapshot, "rankedActions");',
  'Treat its rankedActions domain as the deterministic operational-value order',
];

if (integratedMarkers.every((marker) => source.includes(marker))) {
  console.log("VOR-044 Ask Vorta operational-value integration is already applied.");
  process.exit(0);
}

function replaceOnce(oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}.`);
  }
  source = source.replace(oldValue, newValue);
}

replaceOnce(
  "      \"Get the authorised asset's calculated risk-reduction work queue, including current and projected risk scores, action sequence and total expected reduction. Use when asked what changes would reduce an asset's risk.\",",
  "      \"Get the authorised asset's deterministic operational-value ranking, including current/projected risk, calculated reduction, readiness dependencies, score components, owner, confidence and verification. Use when asked what changes would reduce an asset's risk or what should be done first.\",",
  "equipment risk-action tool description",
);

replaceOnce(
  [
    '    case "get_site_risk":',
    '      return rpcTool(supabase, "Current risk dashboard", "vorta_get_operational_dashboard_snapshot");',
    "",
    "",
    '    case "get_site_operational_snapshot": {',
  ].join("\n"),
  [
    '    case "get_site_risk":',
    '      return rpcTool(supabase, "Current risk dashboard", "vorta_get_operational_dashboard_snapshot");',
    "",
    '    case "get_site_ranked_actions":',
    "      return rpcTool(",
    "        supabase,",
    '        "Site operational-value ranking",',
    '        "vorta_get_ranked_operational_actions",',
    "        { p_limit: 10 },",
    "      );",
    "",
    '    case "get_site_operational_snapshot": {',
  ].join("\n"),
  "site ranked-action execution case",
);

replaceOnce(
  [
    "      const domainDefinitions: Array<[string, Promise<ToolResult>]> = [",
    '        ["siteRisk", executeTool("get_site_risk", {}, supabase, request)],',
    '        ["workBacklog", executeTool("get_site_work_backlog", {}, supabase, request)],',
  ].join("\n"),
  [
    "      const domainDefinitions: Array<[string, Promise<ToolResult>]> = [",
    '        ["siteRisk", executeTool("get_site_risk", {}, supabase, request)],',
    '        ["rankedActions", executeTool("get_site_ranked_actions", {}, supabase, request)],',
    '        ["workBacklog", executeTool("get_site_work_backlog", {}, supabase, request)],',
  ].join("\n"),
  "site decision-pack ranked domain",
);

replaceOnce(
  [
    "      return rpcTool(",
    "        supabase,",
    '        "Equipment calculated risk-reduction actions",',
    '        "vorta_get_equipment_recommended_work_queue",',
    "        { p_equipment_id: id },",
    "      );",
  ].join("\n"),
  [
    "      return rpcTool(",
    "        supabase,",
    '        "Equipment operational-value ranking",',
    '        "vorta_get_ranked_operational_actions",',
    "        { p_equipment_id: id, p_limit: 10 },",
    "      );",
  ].join("\n"),
  "equipment operational-value RPC",
);

const deterministicStart = source.indexOf(
  '  if (intent === "verified_risk_reduction_ranking") {',
);
const deterministicEnd = source.indexOf("\n\n  return null;\n}", deterministicStart);
if (deterministicStart < 0 || deterministicEnd < 0) {
  throw new Error("deterministic operational-value answer block could not be located.");
}

const deterministicBlock = [
  '  if (intent === "verified_risk_reduction_ranking") {',
  '    const snapshot = outcomeData(outcomes, "get_site_operational_snapshot");',
  '    const riskData = operationalDomainData(snapshot, "siteRisk");',
  '    const rankedData = operationalDomainData(snapshot, "rankedActions");',
  "    const rankedActions = records(rankedData).sort(",
  "      (first, second) =>",
  "        numberValue(first.action_rank ?? first.actionRank) -",
  "        numberValue(second.action_rank ?? second.actionRank),",
  "    );",
  "    const topAction = rankedActions[0];",
  '    const priorityAction = firstDecisionText(riskData, ["priorityAction", "priority_action"])',
  '      || firstDecisionText(snapshot, ["priorityAction", "priority_action"]);',
  '    const riskScore = firstDecisionNumber(riskData, ["riskScore"]) ?? 0;',
  '    const highestArea = firstDecisionText(riskData, ["highestArea"]) || "highest-risk area not returned";',
  "    const workOrder = topAction",
  '      ? firstDecisionText(topAction, ["work_order_number", "workOrderNumber"])',
  '      : "";',
  "    const equipmentCode = topAction",
  '      ? firstDecisionText(topAction, ["equipment_code", "equipmentCode"])',
  '      : "";',
  "    const actionTitle = topAction",
  '      ? firstDecisionText(topAction, ["action_title", "actionTitle"])',
  '      : "";',
  "    const action = topAction",
  '      ? [workOrder, equipmentCode, actionTitle].filter(Boolean).join(" · ")',
  '      : priorityAction || "Complete the highest-value verified maintenance work queue shown in the current site-risk evidence.";',
  "    const currentRisk = topAction",
  '      ? firstDecisionNumber(topAction, ["current_risk_score", "currentRiskScore"])',
  "      : null;",
  "    const projectedRisk = topAction",
  '      ? firstDecisionNumber(topAction, ["projected_risk_score", "projectedRiskScore"])',
  "      : null;",
  "    const reduction = topAction",
  '      ? firstDecisionNumber(topAction, ["calculated_risk_reduction", "calculatedRiskReduction"])',
  "      : null;",
  "    const operationalValue = topAction",
  '      ? firstDecisionNumber(topAction, ["operational_value_score", "operationalValueScore"])',
  "      : null;",
  "    const feasibility = topAction",
  '      ? firstDecisionText(topAction, ["feasibility_state", "feasibilityState"])',
  '      : "";',
  "    const owner = topAction",
  '      ? firstDecisionText(topAction, ["owner"]) || "Maintenance Manager to assign"',
  '      : "Maintenance Manager";',
  "    const verification = topAction",
  '      ? firstDecisionText(topAction, ["verification"])',
  '      : "Open the operational dashboard and confirm the action, owner, work status and projected risk reduction before release.";',
  "    const scoringBasis = topAction",
  '      ? firstDecisionText(topAction, ["scoring_basis", "scoringBasis"])',
  '      : "";',
  "    const hardDependencies = topAction",
  "      ? textValues(topAction.hard_dependencies ?? topAction.hardDependencies)",
  "      : [];",
  "    const advisoryDependencies = topAction",
  "      ? textValues(topAction.advisory_dependencies ?? topAction.advisoryDependencies)",
  "      : [];",
  "    const impact =",
  "      currentRisk !== null && projectedRisk !== null && reduction !== null",
  "        ? `Risk ${currentRisk.toFixed(1)} → ${projectedRisk.toFixed(1)} (${reduction.toFixed(1)} calculated reduction)${operationalValue !== null ? `; operational value ${operationalValue.toFixed(1)}/100` : \"\"}.`",
  '        : "The exact projected change was not returned by the ranked evidence.";',
  "    const scoreBreakdown = topAction",
  "      ? [",
  "          `risk reduction ${numberValue(topAction.risk_reduction_points ?? topAction.riskReductionPoints).toFixed(1)}/40`,",
  "          `urgency ${numberValue(topAction.urgency_points ?? topAction.urgencyPoints).toFixed(1)}/20`,",
  "          `readiness ${numberValue(topAction.readiness_points ?? topAction.readinessPoints).toFixed(1)}/15`,",
  "          `criticality/exposure ${numberValue(topAction.criticality_points ?? topAction.criticalityPoints).toFixed(1)}/10`,",
  "          `efficiency ${numberValue(topAction.efficiency_points ?? topAction.efficiencyPoints).toFixed(1)}/5`,",
  "          `evidence confidence ${numberValue(topAction.confidence_points ?? topAction.confidencePoints).toFixed(1)}/10`,",
  '        ].join(", ")',
  '      : "No transparent score breakdown was returned.";',
  "    const alternatives = rankedActions",
  "      .slice(1, 4)",
  "      .map((item) => {",
  "        const rank = numberValue(item.action_rank ?? item.actionRank);",
  '        const code = firstDecisionText(item, ["equipment_code", "equipmentCode"]);',
  '        const order = firstDecisionText(item, ["work_order_number", "workOrderNumber"]);',
  '        const value = firstDecisionNumber(item, ["operational_value_score", "operationalValueScore"]);',
  '        return `#${rank} ${[order, code].filter(Boolean).join(" · ")}${value !== null ? ` (${value.toFixed(1)}/100)` : ""}`;',
  "      })",
  '      .join("; ");',
  "    const feasibilityLabel = feasibility",
  '      ? feasibility.replace(/_/g, " ")',
  '      : "not verified";',
  "    return {",
  "      ...base,",
  "      directAnswer: topAction",
  "        ? `The highest-value executable intervention is ${action}. ${impact}`",
  "        : `The single highest verified risk-reduction intervention is: ${action}`,",
  "      decisionSummary: [",
  '        { label: "Site context", value: `Site risk ${riskScore}; highest-risk area ${highestArea}.` },',
  '        { label: "Highest-value action", value: action },',
  '        { label: "Calculated impact", value: impact },',
  '        { label: "Feasibility", value: `${feasibilityLabel}; owner ${owner}${hardDependencies.length ? `; blockers ${hardDependencies.join(", ")}` : ""}.` },',
  '        { label: "Why it ranks first", value: operationalValue !== null ? `${operationalValue.toFixed(1)}/100 from ${scoreBreakdown}.` : scoringBasis || scoreBreakdown },',
  "      ],",
  "      evidence: [",
  "        `Ranked operational action: ${action}.`,",
  "        impact,",
  "        `Score components: ${scoreBreakdown}.`,",
  "        ...(alternatives ? [`Next ranked alternatives: ${alternatives}.`] : []),",
  "      ],",
  "      findings: [",
  "        {",
  '          category: "risk",',
  '          severity: "high",',
  '          title: "Highest-value executable intervention",',
  "          detail: `${action}. ${impact} Feasibility: ${feasibilityLabel}; owner ${owner}.`,",
  "        },",
  "        {",
  '          category: "work",',
  '          severity: hardDependencies.length ? "high" : "info",',
  '          title: "Operational-value evidence",',
  "          detail: `${scoreBreakdown}.${scoringBasis ? ` ${scoringBasis}` : \"\"}${alternatives ? ` Alternatives: ${alternatives}.` : \"\"}`,",
  "        },",
  "      ],",
  "      recommendedActions: [action],",
  "      actionPlan: [{",
  '        priority: "now",',
  "        action,",
  "        owner,",
  "        expectedImpact: impact,",
  "        verification,",
  "      }],",
  "      missingData: topAction",
  "        ? [...hardDependencies, ...advisoryDependencies].slice(0, 5)",
  '        : ["The operational snapshot did not return a ranked action; open the linked dashboard before work release."],',
  "      confidence: topAction",
  '        ? Math.max(40, Math.min(95, Math.round(firstDecisionNumber(topAction, ["confidence_score", "confidenceScore"]) ?? 70)))',
  "        : priorityAction ? 64 : 48,",
  "    };",
  "  }",
].join("\n");

source =
  source.slice(0, deterministicStart) +
  deterministicBlock +
  source.slice(deterministicEnd);

replaceOnce(
  '    "For broad site-priority questions use get_site_operational_snapshot, then add dated shift-cover or maintenance-plan evidence only when the decision depends on a specific period not covered by the snapshot.",',
  '    "For broad site-priority questions use get_site_operational_snapshot, then add dated shift-cover or maintenance-plan evidence only when the decision depends on a specific period not covered by the snapshot. Treat its rankedActions domain as the deterministic operational-value order: ready work must remain ahead of blocked work, and every recommendation must retain the returned score components, dependencies, owner and verification.",',
  "site ranking instruction",
);

replaceOnce(
  '    "When asked what would reduce an equipment risk score, resolve the asset then call get_equipment_risk_actions. Report current score, projected score, calculated reduction and action sequence.",',
  '    "When asked what would reduce an equipment risk score, resolve the asset then call get_equipment_risk_actions. Report the returned operational rank, current/projected score, calculated reduction, feasibility dependencies, score components, owner, confidence and verification; never present blocked work as immediately executable.",',
  "equipment ranking instruction",
);

writeFileSync(targetPath, source);
console.log("Applied VOR-044 Ask Vorta operational-value integration.");
