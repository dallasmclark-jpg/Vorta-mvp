import type { AskVortaRequest, JsonRecord, ToolResult } from "./contracts.mjs";
import { decisionField, evidenceTimestamps, nestedDecisionRecords, numberValue, records, textValues } from "./utilities.mjs";

export function firstDecisionText(value: unknown, keys: string[]): string {
  for (const record of nestedDecisionRecords(value)) {
    const text = decisionField(record, keys);
    if (text) return text;
  }
  return "";
}

export function firstDecisionNumber(value: unknown, keys: string[]): number | null {
  const text = firstDecisionText(value, keys);
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

export function outcomeData(
  outcomes: Map<string, ToolResult>,
  toolName: string,
): unknown {
  return outcomes.get(toolName)?.data;
}

export function operationalDomainData(value: unknown, domainName: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const domains = (value as JsonRecord).domains;
  if (!domains || typeof domains !== "object" || Array.isArray(domains)) return null;
  const domain = (domains as JsonRecord)[domainName];
  if (!domain || typeof domain !== "object" || Array.isArray(domain)) return null;
  return (domain as JsonRecord).data;
}

export function readableEvidenceTime(timestamp: number | null): string {
  return timestamp === null
    ? "no verified source-update timestamp returned"
    : new Date(timestamp).toISOString().replace("T", " ").replace(/:\d{2}\.\d{3}Z$/, " UTC");
}

export function deterministicOperationalAnswer(
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
        { category: "work", severity: gapsRemain ? "high" : "info", title: "Plan and cover comparison", detail: gapsRemain ? "The dated plan still has rota, validated-skill or assignment constraints; completion is not yet proven by the recorded evidence." : "No recorded cover or assignment constraint was returned for the dated plan." },
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

  if (intent === "shift_cover_risk") {
    const coverData = outcomeData(outcomes, "get_shift_cover");
    const calendar = records(
      coverData && typeof coverData === "object" && !Array.isArray(coverData)
        ? (coverData as JsonRecord).calendar
        : null,
    );
    const summary =
      coverData && typeof coverData === "object" && !Array.isArray(coverData)
        ? ((coverData as JsonRecord).summary as JsonRecord | undefined)
        : undefined;
    const shiftsChecked = numberValue(summary?.shiftsChecked ?? calendar.length);
    const reducedCoverShifts = numberValue(summary?.reducedCoverShifts);
    const skillExposureShifts = numberValue(summary?.shiftsWithSkillExposure);
    const period = `${String(questionPlan.startDate || "today")} to ${String(questionPlan.endDate || questionPlan.startDate || "today")}`;
    const hasRisk = reducedCoverShifts > 0 || skillExposureShifts > 0;
    return {
      ...base,
      directAnswer: hasRisk
        ? "Shift Cover evidence identifies rota or validated-skill risk in the requested period."
        : "No reduced rota cover or validated-skill gap is recorded in the requested period.",
      decisionSummary: [
        { label: "Period", value: period },
        { label: "Shifts checked", value: String(shiftsChecked) },
        { label: "Reduced rota cover", value: String(reducedCoverShifts) },
        { label: "Validated-skill exposure", value: String(skillExposureShifts) },
      ],
      evidence: [
        `${shiftsChecked} shifts checked; ${reducedCoverShifts} reduced-cover shifts and ${skillExposureShifts} shifts with validated-skill exposure.`,
      ],
      recommendedActions: hasRisk
        ? ["Review the highest-risk shift and confirm the provisional cover package before releasing planned work."]
        : [],
      actionPlan: hasRisk
        ? [{
            priority: "before_shift",
            action: "Confirm the highest-risk shift roster and the evidence-backed provisional cover package.",
            owner: "Maintenance Manager",
            expectedImpact: "Reduces the recorded rota and validated-skill exposure before the shift starts.",
            verification: "Reopen Shift Cover and confirm the final roster, skills, absence records and rest compliance.",
          }]
        : [],
      missingData: [
        "Overtime acceptance, unrecorded leave, fatigue/rest approval and manager approval still require confirmation.",
      ],
      confidence: hasRisk ? 80 : 84,
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
    findings: [{
      category: "freshness",
      severity: newest ? "info" : "medium",
      title: "Source evidence freshness",
      detail: newest
        ? `Newest recorded source update: ${freshness}. This is source-update time, not query time or a real-time promise.`
        : "The site-risk result did not expose a verified source-update timestamp, so freshness cannot be proven from this evidence.",
    }],
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
      findings: [
      {
        category: "evidence",
        severity: unavailable.length ? "high" : empty.length ? "medium" : "info",
        title: "Evidence gaps and confirmations",
        detail: missing.join(" "),
      },
    ],
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
      findings: [
      {
        category: "risk",
        severity: "high",
        title: "Morning briefing evidence · site risk",
        detail: `Current site risk is ${riskScore}; ${highestArea} is the highest-risk area returned by the operational snapshot.`,
      },
      {
        category: "work",
        severity: overdueCount > 0 ? "high" : "info",
        title: "Morning briefing evidence · work",
        detail: `${overdueCount} overdue work orders remain within ${openCount} open work orders.`,
      },
      {
        category: "spares",
        severity: outOfStockCount > 0 ? "high" : "info",
        title: "Morning briefing evidence · spares",
        detail: `${outOfStockCount} out-of-stock risk items are recorded${criticalSpare ? `; the first recorded constraint is ${criticalSpare}` : ""}.`,
      },
    ],
    confidence: 78,
    };
  }

  if (intent === "verified_risk_reduction_ranking") {
    const snapshot = outcomeData(outcomes, "get_site_operational_snapshot");
    const riskData = operationalDomainData(snapshot, "siteRisk");
    const rankedData = operationalDomainData(snapshot, "rankedActions");
    const rankedActions = records(rankedData).sort(
      (first, second) =>
        numberValue(first.action_rank ?? first.actionRank) -
        numberValue(second.action_rank ?? second.actionRank),
    );
    const topAction = rankedActions[0];
    const priorityAction = firstDecisionText(riskData, ["priorityAction", "priority_action"])
      || firstDecisionText(snapshot, ["priorityAction", "priority_action"]);
    const riskScore = firstDecisionNumber(riskData, ["riskScore"]) ?? 0;
    const highestArea = firstDecisionText(riskData, ["highestArea"]) || "highest-risk area not returned";
    const workOrder = topAction
      ? firstDecisionText(topAction, ["work_order_number", "workOrderNumber"])
      : "";
    const equipmentCode = topAction
      ? firstDecisionText(topAction, ["equipment_code", "equipmentCode"])
      : "";
    const actionTitle = topAction
      ? firstDecisionText(topAction, ["action_title", "actionTitle"])
      : "";
    const action = topAction
      ? [workOrder, equipmentCode, actionTitle].filter(Boolean).join(" · ")
      : priorityAction || "Complete the highest-value verified maintenance work queue shown in the current site-risk evidence.";
    const currentRisk = topAction
      ? firstDecisionNumber(topAction, ["current_risk_score", "currentRiskScore"])
      : null;
    const projectedRisk = topAction
      ? firstDecisionNumber(topAction, ["projected_risk_score", "projectedRiskScore"])
      : null;
    const reduction = topAction
      ? firstDecisionNumber(topAction, ["calculated_risk_reduction", "calculatedRiskReduction"])
      : null;
    const operationalValue = topAction
      ? firstDecisionNumber(topAction, ["operational_value_score", "operationalValueScore"])
      : null;
    const feasibility = topAction
      ? firstDecisionText(topAction, ["feasibility_state", "feasibilityState"])
      : "";
    const owner = topAction
      ? firstDecisionText(topAction, ["owner"]) || "Maintenance Manager to assign"
      : "Maintenance Manager";
    const verification = topAction
      ? firstDecisionText(topAction, ["verification"])
      : "Open the operational dashboard and confirm the action, owner, work status and projected risk reduction before release.";
    const scoringBasis = topAction
      ? firstDecisionText(topAction, ["scoring_basis", "scoringBasis"])
      : "";
    const hardDependencies = topAction
      ? textValues(topAction.hard_dependencies ?? topAction.hardDependencies)
      : [];
    const advisoryDependencies = topAction
      ? textValues(topAction.advisory_dependencies ?? topAction.advisoryDependencies)
      : [];
    const impact =
      currentRisk !== null && projectedRisk !== null && reduction !== null
        ? `Risk ${currentRisk.toFixed(1)} → ${projectedRisk.toFixed(1)} (${reduction.toFixed(1)} calculated reduction)${operationalValue !== null ? `; operational value ${operationalValue.toFixed(1)}/100` : ""}.`
        : "The exact projected change was not returned by the ranked evidence.";
    const scoreBreakdown = topAction
      ? [
          `risk reduction ${numberValue(topAction.risk_reduction_points ?? topAction.riskReductionPoints).toFixed(1)}/40`,
          `urgency ${numberValue(topAction.urgency_points ?? topAction.urgencyPoints).toFixed(1)}/20`,
          `readiness ${numberValue(topAction.readiness_points ?? topAction.readinessPoints).toFixed(1)}/15`,
          `criticality/exposure ${numberValue(topAction.criticality_points ?? topAction.criticalityPoints).toFixed(1)}/10`,
          `efficiency ${numberValue(topAction.efficiency_points ?? topAction.efficiencyPoints).toFixed(1)}/5`,
          `evidence confidence ${numberValue(topAction.confidence_points ?? topAction.confidencePoints).toFixed(1)}/10`,
        ].join(", ")
      : "No transparent score breakdown was returned.";
    const alternatives = rankedActions
      .slice(1, 4)
      .map((item) => {
        const rank = numberValue(item.action_rank ?? item.actionRank);
        const code = firstDecisionText(item, ["equipment_code", "equipmentCode"]);
        const order = firstDecisionText(item, ["work_order_number", "workOrderNumber"]);
        const value = firstDecisionNumber(item, ["operational_value_score", "operationalValueScore"]);
        return `#${rank} ${[order, code].filter(Boolean).join(" · ")}${value !== null ? ` (${value.toFixed(1)}/100)` : ""}`;
      })
      .join("; ");
    const feasibilityLabel = feasibility
      ? feasibility.replace(/_/g, " ")
      : "not verified";
    return {
      ...base,
      directAnswer: topAction
        ? `The highest-value executable intervention is ${action}. ${impact}`
        : `The single highest verified risk-reduction intervention is: ${action}`,
      decisionSummary: [
        { label: "Site context", value: `Site risk ${riskScore}; highest-risk area ${highestArea}.` },
        { label: "Highest-value action", value: action },
        { label: "Calculated impact", value: impact },
        { label: "Feasibility", value: `${feasibilityLabel}; owner ${owner}${hardDependencies.length ? `; blockers ${hardDependencies.join(", ")}` : ""}.` },
        { label: "Why it ranks first", value: operationalValue !== null ? `${operationalValue.toFixed(1)}/100 from ${scoreBreakdown}.` : scoringBasis || scoreBreakdown },
      ],
      evidence: [
        `Ranked operational action: ${action}.`,
        impact,
        `Score components: ${scoreBreakdown}.`,
        ...(alternatives ? [`Next ranked alternatives: ${alternatives}.`] : []),
      ],
      findings: [
        {
          category: "risk",
          severity: "high",
          title: "Highest-value executable intervention",
          detail: `${action}. ${impact} Feasibility: ${feasibilityLabel}; owner ${owner}.`,
        },
        {
          category: "work",
          severity: hardDependencies.length ? "high" : "info",
          title: "Operational-value evidence",
          detail: `${scoreBreakdown}.${scoringBasis ? ` ${scoringBasis}` : ""}${alternatives ? ` Alternatives: ${alternatives}.` : ""}`,
        },
      ],
      recommendedActions: [action],
      actionPlan: [{
        priority: "now",
        action,
        owner,
        expectedImpact: impact,
        verification,
      }],
      missingData: topAction
        ? [...hardDependencies, ...advisoryDependencies].slice(0, 5)
        : ["The operational snapshot did not return a ranked action; open the linked dashboard before work release."],
      confidence: topAction
        ? Math.max(40, Math.min(95, Math.round(firstDecisionNumber(topAction, ["confidence_score", "confidenceScore"]) ?? 70)))
        : priorityAction ? 64 : 48,
    };
  }

  return null;
}
