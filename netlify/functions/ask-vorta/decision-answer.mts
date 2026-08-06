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

  if (
    intent === "site_priorities" ||
    intent === "site_threat_prioritization"
  ) {
    const snapshot = outcomeData(outcomes, "get_site_operational_snapshot");
    const riskData = operationalDomainData(snapshot, "siteRisk");
    const rankedData = operationalDomainData(snapshot, "rankedActions");
    const rankedActions = records(rankedData)
      .sort(
        (first, second) =>
          numberValue(first.action_rank ?? first.actionRank) -
          numberValue(second.action_rank ?? second.actionRank),
      )
      .slice(0, 3);
    const riskScore = firstDecisionNumber(riskData, ["riskScore"]) ?? 0;
    const highestArea =
      firstDecisionText(riskData, ["highestArea"]) ||
      "highest-risk area not returned";

    const actionDetails = rankedActions.map((item, index) => {
      const workOrder = firstDecisionText(item, [
        "work_order_number",
        "workOrderNumber",
      ]);
      const equipmentCode = firstDecisionText(item, [
        "equipment_code",
        "equipmentCode",
      ]);
      const actionTitle = firstDecisionText(item, [
        "action_title",
        "actionTitle",
      ]);
      const action = [workOrder, equipmentCode, actionTitle]
        .filter(Boolean)
        .join(" · ");
      const currentRisk = firstDecisionNumber(item, [
        "current_risk_score",
        "currentRiskScore",
      ]);
      const projectedRisk = firstDecisionNumber(item, [
        "projected_risk_score",
        "projectedRiskScore",
      ]);
      const reduction = firstDecisionNumber(item, [
        "calculated_risk_reduction",
        "calculatedRiskReduction",
      ]);
      const operationalValue = firstDecisionNumber(item, [
        "operational_value_score",
        "operationalValueScore",
      ]);
      const feasibility = firstDecisionText(item, [
        "feasibility_state",
        "feasibilityState",
      ]);
      const owner =
        firstDecisionText(item, ["owner"]) ||
        "Maintenance Manager / Planner";
      const verification =
        firstDecisionText(item, ["verification"]) ||
        "Open the operational dashboard and confirm the owner, readiness, dependencies and projected risk change before the authorised SAP user releases or sequences work.";
      const hardDependencies = textValues(
        item.hard_dependencies ?? item.hardDependencies,
      );
      const advisoryDependencies = textValues(
        item.advisory_dependencies ?? item.advisoryDependencies,
      );
      const impact =
        currentRisk !== null &&
        projectedRisk !== null &&
        reduction !== null
          ? `risk ${currentRisk.toFixed(1)} → ${projectedRisk.toFixed(1)} (${reduction.toFixed(1)} calculated reduction)`
          : "exact projected risk change not returned";
      const dependencyText = hardDependencies.length
        ? `blockers ${hardDependencies.join(", ")}`
        : advisoryDependencies.length
          ? `confirm ${advisoryDependencies.join(", ")}`
          : "no recorded blocker returned";
      return {
        rank: index + 1,
        action:
          action ||
          `Ranked maintenance intervention ${index + 1}`,
        impact,
        operationalValue,
        feasibility: feasibility
          ? feasibility.replace(/_/g, " ")
          : "not verified",
        owner,
        verification,
        dependencyText,
      };
    });

    const topAction = actionDetails[0];
    const unavailableDomains =
      snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
        ? Object.entries(
            ((snapshot as JsonRecord).domains &&
            typeof (snapshot as JsonRecord).domains === "object" &&
            !Array.isArray((snapshot as JsonRecord).domains)
              ? (snapshot as JsonRecord).domains
              : {}) as JsonRecord,
          )
            .filter(
              ([, value]) =>
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                (value as JsonRecord).status === "unavailable",
            )
            .map(([name]) => name)
        : [];

    return {
      ...base,
      directAnswer: topAction
        ? `The first current maintenance priority is ${topAction.action}; it is the highest-value recorded intervention and ${topAction.impact}.`
        : `The operational snapshot returned site risk ${riskScore}, but no ranked executable maintenance intervention was available.`,
      decisionSummary: topAction
        ? [
            {
              label: "Site context",
              value: `Site risk ${riskScore}; highest-risk area ${highestArea}.`,
            },
            ...actionDetails.map((item) => ({
              label: `#${item.rank} priority`,
              value: `${item.action}; ${item.impact}; feasibility ${item.feasibility}; owner ${item.owner}.`,
            })),
            {
              label: "First verification",
              value: topAction.verification,
            },
          ].slice(0, 5)
        : [
            {
              label: "Site context",
              value: `Site risk ${riskScore}; highest-risk area ${highestArea}.`,
            },
            {
              label: "Ranked action",
              value: "No executable ranked action was returned.",
            },
          ],
      evidence: actionDetails.map(
        (item) =>
          `#${item.rank} ${item.action}: ${item.impact}; ${item.dependencyText}; feasibility ${item.feasibility}; owner ${item.owner}.`,
      ),
      findings: actionDetails.map((item) => ({
        category: "risk",
        severity: item.rank === 1 ? "high" : "medium",
        title: `#${item.rank} current maintenance priority`,
        detail: `${item.action}. ${item.impact}; ${item.dependencyText}; feasibility ${item.feasibility}; owner ${item.owner}.`,
      })),
      recommendedActions: actionDetails.map((item) => item.action),
      actionPlan: topAction
        ? [{
            priority: "now",
            action: topAction.action,
            owner: topAction.owner,
            expectedImpact: topAction.impact,
            verification: topAction.verification,
          }]
        : [],
      missingData: [
        ...(unavailableDomains.length
          ? [`Unavailable operational domains: ${unavailableDomains.join(", ")}.`]
          : []),
        ...(topAction
          ? []
          : ["No executable ranked operational action was returned."]),
      ],
      confidence: topAction
        ? unavailableDomains.length
          ? 72
          : actionDetails.length >= 3
            ? 86
            : 80
        : 48,
    };
  }


  if (intent === "shift_handover") {
    const outcome = outcomes.get("get_shift_handover");
    const rawData = outcomeData(outcomes, "get_shift_handover");
    const data = rawData && typeof rawData === "object" && !Array.isArray(rawData)
      ? (rawData as JsonRecord)
      : {};
    const summary = data.summary && typeof data.summary === "object" && !Array.isArray(data.summary)
      ? (data.summary as JsonRecord)
      : {};
    const statusRank = (value: string): number => {
      if (/waiting_on_parts/.test(value)) return 5;
      if (/external_contractor/.test(value)) return 4;
      if (/temporarily_restored/.test(value)) return 3;
      if (/ongoing/.test(value)) return 2;
      return 0;
    };
    const priorityRank = (value: string): number => {
      if (/critical/i.test(value)) return 4;
      if (/high/i.test(value)) return 3;
      if (/medium/i.test(value)) return 2;
      if (/low/i.test(value)) return 1;
      return 0;
    };
    const items = records(data.items).sort((left, right) => {
      const statusDifference = statusRank(firstDecisionText(right, ["status"])) - statusRank(firstDecisionText(left, ["status"]));
      return statusDifference || priorityRank(firstDecisionText(right, ["priority"])) - priorityRank(firstDecisionText(left, ["priority"]));
    });
    const top = items[0];
    const itemCount = numberValue(summary.itemCount ?? items.length);
    const completedCount = numberValue(summary.completedCount);
    const ongoingCount = numberValue(summary.ongoingCount);
    const waitingCount = numberValue(summary.waitingOnPartsCount);
    const contractorCount = numberValue(summary.contractorCount);
    const workOrder = top ? firstDecisionText(top, ["workOrderNumber"]) : "";
    const equipment = top ? firstDecisionText(top, ["equipmentCode", "equipmentName"]) : "";
    const label = [workOrder, equipment].filter(Boolean).join(" · ");
    const status = top ? firstDecisionText(top, ["status"]).replace(/_/g, " ") : "";
    const priority = top ? firstDecisionText(top, ["priority"]) : "";
    const owner = top ? firstDecisionText(top, ["assignedEngineer", "confirmedBy"]) : "";
    const nextAction = top ? firstDecisionText(top, ["nextAction"]) : "";
    const confirmation = top ? firstDecisionText(top, ["latestConfirmation", "description"]) : "";
    const activity = top ? firstDecisionText(top, ["lastActivityAt"]) : "";
    const actionRequested = questionPlan.forceActionPlan === true || /\b(?:first|next action|needs? sorting|what should|checked? first|action first)\b/i.test(request.question);
    const missingData = [
      ...(!owner && top ? [`No incoming-shift owner is recorded for ${label || "the highest-priority handover item"}.`] : []),
      ...(!nextAction && top ? [`No explicit next action is recorded for ${label || "the highest-priority handover item"}.`] : []),
      ...(!activity && top ? [`No latest activity timestamp is recorded for ${label || "the highest-priority handover item"}.`] : []),
      ...(!top ? [outcome?.status === "unavailable" ? outcome.message || "Shift handover evidence is unavailable." : "No current shift-handover item was returned."] : []),
    ];
    const action = `${nextAction || "Review the latest confirmation and continue the outstanding scope"} for ${label || "the highest-priority handover item"}.`;

    return {
      ...base,
      directAnswer: top
        ? `The latest handover contains ${itemCount} items: ${completedCount} completed, ${ongoingCount} ongoing and ${waitingCount} waiting on parts. Check ${label || "the highest-priority item"} first; it is ${status || "outstanding"}${priority ? ` with ${priority} priority` : ""}.`
        : outcome?.status === "unavailable"
          ? "The current shift-handover evidence is unavailable, so Ask Vorta cannot identify a safe next item."
          : "No current shift-handover item was returned by the authorised evidence.",
      decisionSummary: [
        { label: "Handover totals", value: `${itemCount} items · ${completedCount} completed · ${ongoingCount} ongoing.` },
        { label: "Waiting / contractor", value: `${waitingCount} waiting on parts · ${contractorCount} involving external support.` },
        { label: "Check first", value: top ? `${label || "Recorded handover item"} · ${status || "status not recorded"}${owner ? ` · owner ${owner}` : " · owner not recorded"}.` : "No current item returned." },
        { label: "Next action", value: nextAction || "No explicit next action was returned." },
        { label: "Latest confirmation", value: confirmation || "No confirmation text was returned." },
      ],
      evidence: items.slice(0, 4).map((item) => {
        const itemLabel = [firstDecisionText(item, ["workOrderNumber"]), firstDecisionText(item, ["equipmentCode", "equipmentName"])].filter(Boolean).join(" · ");
        const itemStatus = firstDecisionText(item, ["status"]).replace(/_/g, " ");
        const itemOwner = firstDecisionText(item, ["assignedEngineer", "confirmedBy"]);
        const itemAction = firstDecisionText(item, ["nextAction"]);
        return `${itemLabel || "Handover item"}: ${itemStatus || "status not recorded"}; ${itemOwner ? `owner ${itemOwner}` : "owner not recorded"}; ${itemAction || "next action not recorded"}.`;
      }),
      findings: items.slice(0, 4).map((item, index) => ({
        category: "handover",
        severity: index === 0 && firstDecisionText(item, ["status"]) !== "completed" ? "high" : "medium",
        title: [firstDecisionText(item, ["workOrderNumber"]), firstDecisionText(item, ["equipmentCode", "equipmentName"])].filter(Boolean).join(" · ") || "Shift-handover item",
        detail: `${firstDecisionText(item, ["latestConfirmation", "description"]) || "No confirmation detail returned"}; status ${firstDecisionText(item, ["status"]).replace(/_/g, " ") || "not recorded"}; ${firstDecisionText(item, ["nextAction"]) || "next action not recorded"}.`,
      })),
      recommendedActions: top && actionRequested ? [action] : [],
      actionPlan: top && actionRequested ? [{
        priority: "incoming_shift",
        action,
        owner: owner || "Maintenance Manager / Incoming Shift",
        expectedImpact: "Carries the highest-priority recorded handover item into an owned incoming-shift action without creating a parallel work queue.",
        verification: "Open the linked handover and SAP work-order evidence and confirm the incoming-shift owner, current status and next confirmation before changing operational records.",
      }] : [],
      missingData,
      confidence: top ? (missingData.length ? 72 : 86) : 45,
    };
  }

  if (intent === "spares_priority") {
    const outcome = outcomes.get("get_site_spares_risk");
    const rawData = outcomeData(outcomes, "get_site_spares_risk");
    const data = rawData && typeof rawData === "object" && !Array.isArray(rawData)
      ? (rawData as JsonRecord)
      : {};
    const summary = data.summary && typeof data.summary === "object" && !Array.isArray(data.summary)
      ? (data.summary as JsonRecord)
      : {};
    const spares = records(data.spares);
    const top = spares[0];
    const name = top ? firstDecisionText(top, ["componentName"]) : "";
    const code = top ? firstDecisionText(top, ["componentCode"]) : "";
    const equipment = top ? firstDecisionText(top, ["equipmentCode", "equipmentName"]) : "";
    const label = [code, name, equipment].filter(Boolean).join(" · ");
    const available = top ? numberValue(top.availableQuantity) : 0;
    const minimum = top ? numberValue(top.minimumQuantity) : 0;
    const target = top ? numberValue(top.targetQuantity) : 0;
    const minimumShortfall = top ? numberValue(top.minimumShortfall) : 0;
    const targetShortfall = top ? numberValue(top.targetShortfall) : 0;
    const criticality = top ? firstDecisionText(top, ["componentCriticality"]) : "";
    const leadDays = top ? numberValue(top.leadDays) : 0;
    const vendor = top ? firstDecisionText(top, ["vendor", "maker"]) : "";
    const storageLocation = top ? firstDecisionText(top, ["storageLocation"]) : "";
    const outOfStock = top?.outOfStock === true;
    const actionRequested = questionPlan.forceActionPlan === true || /\b(?:order|buy|get|purchase|do first|action|stockout)\b/i.test(request.question);
    const missingData = [
      ...(!code && top ? ["The highest-risk spare has no recorded part number."] : []),
      ...(!vendor && top ? [`No supplier or maker is recorded for ${label || "the highest-risk spare"}.`] : []),
      ...(top && top.leadDays == null ? [`No supplier lead time is recorded for ${label || "the highest-risk spare"}.`] : []),
      ...(!top ? [outcome?.status === "unavailable" ? outcome.message || "Critical-spares evidence is unavailable." : "No current critical-spares risk item was returned."] : []),
    ];
    const action = top
      ? `Confirm the physical stock, ${target > 0 ? `target quantity ${target}` : `minimum quantity ${minimum}`}, supplier lead time and authorised purchasing route for ${label || "the highest-risk spare"}, then have Stores / Buyer raise or update the approved purchasing record.`
      : "Confirm the current stock and approved purchasing evidence before raising any purchasing record.";

    return {
      ...base,
      directAnswer: top
        ? `${label || "The highest-risk spare"} is the first recorded spares priority: ${outOfStock ? "it is out of stock" : `${available} are recorded in stock`}, against minimum ${minimum} and target ${target}, with a target shortfall of ${targetShortfall}${leadDays ? ` and ${leadDays}-day lead time` : ""}.`
        : outcome?.status === "unavailable"
          ? "The current critical-spares evidence is unavailable, so Ask Vorta cannot identify a safe purchasing priority."
          : "No current critical-spares risk item was returned by the authorised evidence.",
      decisionSummary: [
        { label: "First spare", value: label || "No current risk item returned." },
        { label: "Stock position", value: top ? `${available} available · minimum ${minimum} · target ${target} · shortfall ${targetShortfall}.` : "No stock position returned." },
        { label: "Risk", value: top ? `${outOfStock ? "Out of stock" : minimumShortfall > 0 ? "Below minimum" : "Recorded exposure"} · ${criticality || "criticality not recorded"}.` : "No risk item returned." },
        { label: "Supply evidence", value: top ? `${vendor || "supplier not recorded"} · ${leadDays ? `${leadDays}-day lead time` : "lead time not recorded"}${storageLocation ? ` · stored ${storageLocation}` : ""}.` : "No supply evidence returned." },
        { label: "Site exposure", value: `${numberValue(summary.riskItemCount ?? spares.length)} risk items · ${numberValue(summary.outOfStockCount)} out of stock · ${numberValue(summary.belowMinimumCount)} below minimum · ${numberValue(summary.longLeadCount)} long lead.` },
      ],
      evidence: spares.slice(0, 4).map((item) => `${[firstDecisionText(item, ["componentCode"]), firstDecisionText(item, ["componentName"]), firstDecisionText(item, ["equipmentCode", "equipmentName"])].filter(Boolean).join(" · ") || "Spare"}: stock ${numberValue(item.availableQuantity)}; minimum ${numberValue(item.minimumQuantity)}; target ${numberValue(item.targetQuantity)}; ${numberValue(item.leadDays) ? `${numberValue(item.leadDays)}-day lead time` : "lead time not recorded"}.`),
      findings: spares.slice(0, 4).map((item, index) => ({
        category: "spares",
        severity: item.outOfStock === true ? "critical" : index === 0 ? "high" : "medium",
        title: [firstDecisionText(item, ["componentCode"]), firstDecisionText(item, ["componentName"]), firstDecisionText(item, ["equipmentCode", "equipmentName"])].filter(Boolean).join(" · ") || "Critical spare",
        detail: `Recorded stock ${numberValue(item.availableQuantity)}; target shortfall ${numberValue(item.targetShortfall)}; ${numberValue(item.leadDays) ? `${numberValue(item.leadDays)}-day lead time` : "lead time not recorded"}.`,
      })),
      recommendedActions: top && actionRequested ? [action] : [],
      actionPlan: top && actionRequested ? [{
        priority: "now",
        action,
        owner: "Maintenance Manager / Stores / Buyer",
        expectedImpact: `Closes the recorded ${targetShortfall || minimumShortfall} unit shortfall on the highest-risk spare after authorised purchasing confirmation.`,
        verification: "Recheck physical stock and the approved purchasing or SAP evidence after an authorised buyer records the request; Ask Vorta does not place orders or alter stock.",
      }] : [],
      missingData,
      confidence: top ? (missingData.length ? 72 : 86) : 45,
    };
  }

  if (intent === "contractor_support") {
    const outcome = outcomes.get("get_contractor_availability");
    const rawData = outcomeData(outcomes, "get_contractor_availability");
    const data = rawData && typeof rawData === "object" && !Array.isArray(rawData)
      ? (rawData as JsonRecord)
      : {};
    const summary = data.summary && typeof data.summary === "object" && !Array.isArray(data.summary)
      ? (data.summary as JsonRecord)
      : {};
    const requestedTerms = ["plc", "automation", "controls", "electrical", "mechanical", "instrumentation", "calibration", "hvac", "welding"].filter((term) => request.question.toLowerCase().includes(term));
    const options = records(data.contractors).map((contractor) => {
      const skills = records(contractor.validatedSkills)
        .map((skill) => firstDecisionText(skill, ["name"]))
        .filter((value): value is string => Boolean(value));
      const discipline = firstDecisionText(contractor, ["discipline"]);
      const searchable = `${discipline} ${skills.join(" ")}`.toLowerCase();
      const matchCount = requestedTerms.filter((term) => searchable.includes(term)).length;
      const availableNow = contractor.availableNow === true;
      const availabilityRecorded = contractor.availableNow !== null && contractor.availableNow !== undefined;
      const verified = contractor.verified === true;
      const modes = [contractor.onsiteSupport === true ? "onsite" : "", contractor.remoteSupport === true ? "remote" : "", contractor.onCall === true ? "on call" : ""].filter(Boolean);
      return {
        contractor,
        name: firstDecisionText(contractor, ["engineerName"]),
        discipline,
        status: firstDecisionText(contractor, ["availabilityStatus"]),
        availableNow,
        availabilityRecorded,
        verified,
        skills,
        modes,
        matchCount,
        score: matchCount * 200 + (availableNow ? 100 : 0) + (verified ? 40 : 0) + skills.length,
      };
    }).sort((left, right) => right.score - left.score);
    const top = options[0];
    const availability = top
      ? top.availableNow
        ? "recorded available now"
        : top.availabilityRecorded
          ? `recorded ${top.status || "not available now"}`
          : "current availability not recorded"
      : "not returned";
    const skillText = top?.skills.length ? top.skills.slice(0, 4).join(", ") : "no validated skill returned";
    const missingData = [
      ...(!top?.availabilityRecorded && top ? [`Current availability is not recorded for ${top.name || "the highest-ranked contractor"}.`] : []),
      ...(!top?.verified && top ? [`Verified contractor status is not recorded for ${top.name || "the highest-ranked contractor"}.`] : []),
      ...(!top?.skills.length && top ? [`No validated skill is recorded for ${top.name || "the highest-ranked contractor"}.`] : []),
      ...(requestedTerms.length > 0 && top && top.matchCount === 0 ? [`No recorded validated skill explicitly matches ${requestedTerms.join(", ")}.`] : []),
      ...(!top ? [outcome?.status === "unavailable" ? outcome.message || "Contractor availability evidence is unavailable." : "No current contractor-support record was returned."] : []),
    ];
    const action = top
      ? `Confirm ${top.name || "the recorded contractor"}'s acceptance, current availability, site access, fatigue controls and exact technical scope before an authorised manager arranges support.`
      : "Confirm contractor availability and validated capability before arranging external support.";

    return {
      ...base,
      directAnswer: top
        ? `The best recorded contractor support option is ${top.name || "the highest-ranked contractor"}: ${availability}, ${top.verified ? "verified" : "verification not recorded"}, with validated skills ${skillText}${top.modes.length ? ` and ${top.modes.join(" / ")} support recorded` : ""}. Availability and acceptance still require confirmation.`
        : outcome?.status === "unavailable"
          ? "The current contractor availability evidence is unavailable, so Ask Vorta cannot recommend a support option."
          : "No current contractor-support record was returned by the authorised evidence.",
      decisionSummary: [
        { label: "Best recorded option", value: top?.name || "No contractor record returned." },
        { label: "Availability", value: top ? availability : "No availability evidence returned." },
        { label: "Validated capability", value: top ? skillText : "No validated skill evidence returned." },
        { label: "Support mode", value: top?.modes.length ? top.modes.join(" / ") : "No onsite, remote or on-call mode was returned." },
        { label: "Recorded pool", value: `${numberValue(summary.contractorCount ?? options.length)} contractors · ${numberValue(summary.recordedAvailableNowCount)} available now · ${numberValue(summary.missingCurrentAvailabilityCount)} missing current availability.` },
      ],
      evidence: options.slice(0, 4).map((item) => `${item.name || "Contractor"}: ${item.availabilityRecorded ? (item.availableNow ? "available now" : item.status || "not available now") : "availability not recorded"}; ${item.verified ? "verified" : "verification not recorded"}; skills ${item.skills.slice(0, 4).join(", ") || "not recorded"}.`),
      findings: options.slice(0, 4).map((item, index) => ({
        category: "contractor",
        severity: index === 0 && item.availableNow && item.verified ? "info" : "medium",
        title: item.name || "Contractor support record",
        detail: `${item.availabilityRecorded ? (item.availableNow ? "Available now" : item.status || "Not available now") : "Availability not recorded"}; ${item.verified ? "verified" : "verification not recorded"}; validated skills ${item.skills.slice(0, 4).join(", ") || "not recorded"}.`,
      })),
      recommendedActions: top ? [action] : [],
      actionPlan: top ? [{
        priority: "before_external_support",
        action,
        owner: "Maintenance Manager / Planner",
        expectedImpact: "Confirms that the recorded external support option is actually available, suitably skilled and authorised before work is planned.",
        verification: "Confirm acceptance, attendance, site access, current certificates, technical scope and rest compliance in the approved systems; Ask Vorta does not assign or book contractors.",
      }] : [],
      missingData,
      confidence: top ? (missingData.length ? 68 : 86) : 45,
    };
  }

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

  if (intent === "work_backlog") {
  const backlogData = outcomeData(outcomes, "get_site_work_backlog");
  const backlogRecord =
    backlogData && typeof backlogData === "object" && !Array.isArray(backlogData)
      ? (backlogData as JsonRecord)
      : {};
  const summary =
    backlogRecord.summary &&
    typeof backlogRecord.summary === "object" &&
    !Array.isArray(backlogRecord.summary)
      ? (backlogRecord.summary as JsonRecord)
      : {};
  const workOrders = records(backlogRecord.workOrders);
  const priorityOrders = workOrders.filter(
    (item) => item.overdue === true || !firstDecisionText(item, ["assignedEngineer"]),
  );
  const rankedOrders = (priorityOrders.length ? priorityOrders : workOrders).slice(0, 4);
  const topOrder = rankedOrders[0];
  const openCount = numberValue(summary.openCount);
  const overdueCount = numberValue(summary.overdueCount);
  const unassignedCount = numberValue(summary.unassignedCount);
  const criticalOrHighCount = numberValue(summary.criticalOrHighCount);
  const topNumber = topOrder
    ? firstDecisionText(topOrder, ["workOrderNumber"])
    : "";
  const topEquipment = topOrder
    ? firstDecisionText(topOrder, ["equipmentCode", "equipmentName"])
    : "";
  const topPriority = topOrder
    ? firstDecisionText(topOrder, ["priority"])
    : "";
  const topDueDate = topOrder
    ? firstDecisionText(topOrder, ["dueDate"])
    : "";
  const topDescription = topOrder
    ? firstDecisionText(topOrder, ["description"])
    : "";
  const topAssignee = topOrder
    ? firstDecisionText(topOrder, ["assignedEngineer"])
    : "";
  const topLabel = [topNumber, topEquipment].filter(Boolean).join(" · ");
  const action = topOrder
    ? `Confirm scope, readiness and an authorised assignee for ${topLabel}, then have the Maintenance Planner update and sequence the SAP work order before release.`
    : "Confirm the current SAP-backed work-order evidence before assigning or sequencing backlog work.";
  const findings = rankedOrders.map((item) => {
    const workOrderNumber = firstDecisionText(item, ["workOrderNumber"]);
    const equipment = firstDecisionText(item, ["equipmentCode", "equipmentName"]);
    const priority = firstDecisionText(item, ["priority"]);
    const dueDate = firstDecisionText(item, ["dueDate"]);
    const description = firstDecisionText(item, ["description"]);
    const assignedEngineer = firstDecisionText(item, ["assignedEngineer"]);
    return {
      category: "work",
      severity: /critical/i.test(priority)
        ? "critical"
        : /high/i.test(priority)
          ? "high"
          : "medium",
      title: [workOrderNumber, equipment].filter(Boolean).join(" · ") || "Backlog work order",
      detail: [
        description,
        priority ? `Priority ${priority}` : "",
        dueDate ? `due ${dueDate}` : "",
        assignedEngineer
          ? `assigned to ${assignedEngineer}`
          : "no engineer recorded",
      ].filter(Boolean).join("; ") + ".",
    };
  });

  return {
    ...base,
    directAnswer: topOrder
      ? `${overdueCount} overdue work orders and ${unassignedCount} unassigned work orders need management attention; start with work order ${topLabel}${topDueDate ? `, due ${topDueDate}` : ""}.`
      : "No open work order was returned by the current site backlog evidence.",
    decisionSummary: [
      {
        label: "Highest priority",
        value: topOrder
          ? [topLabel, topPriority, topDueDate ? `due ${topDueDate}` : ""]
              .filter(Boolean)
              .join(" · ")
          : "No current open order returned.",
      },
      { label: "Backlog", value: `${openCount} open · ${overdueCount} overdue.` },
      { label: "Assignment", value: `${unassignedCount} open work orders have no recorded assignee.` },
      { label: "Critical or high", value: `${criticalOrHighCount} open work orders are critical or high priority.` },
    ],
    evidence: rankedOrders.map((item) => {
      const workOrderNumber = firstDecisionText(item, ["workOrderNumber"]);
      const equipment = firstDecisionText(item, ["equipmentCode", "equipmentName"]);
      const dueDate = firstDecisionText(item, ["dueDate"]);
      const assignedEngineer = firstDecisionText(item, ["assignedEngineer"]);
      return `${[workOrderNumber, equipment].filter(Boolean).join(" · ")}: ${dueDate ? `due ${dueDate}` : "due date not recorded"}; ${assignedEngineer ? `assigned to ${assignedEngineer}` : "unassigned"}.`;
    }),
    findings,
    recommendedActions: topOrder ? [action] : [],
    actionPlan: topOrder
      ? [{
          priority: "now",
          action,
          owner: "Maintenance Manager / Planner",
          expectedImpact:
            "Moves the highest-priority overdue or unassigned work order from identified risk toward an owned, executable plan.",
          verification:
            "Open the linked SAP work order evidence and confirm the authorised assignee, readiness, due date and released sequence are recorded by an authorised user.",
        }]
      : [],
    missingData: unassignedCount > 0
      ? [`${unassignedCount} open work orders have no recorded assignee.`]
      : [],
    confidence: topOrder ? 86 : 62,
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
