import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(path, before, after) {
  const source = readFileSync(path, "utf8");
  const matches = source.split(before).length - 1;
  assert.equal(matches, 1, `${path}: expected one replacement anchor, found ${matches}`);
  writeFileSync(path, source.replace(before, after));
}

const deterministicBuilders = String.raw`
  if (intent === "shift_handover") {
    const outcome = outcomes.get("get_shift_handover");
    const handoverData = outcomeData(outcomes, "get_shift_handover");
    const handoverRecord =
      handoverData && typeof handoverData === "object" && !Array.isArray(handoverData)
        ? (handoverData as JsonRecord)
        : {};
    const summary =
      handoverRecord.summary &&
      typeof handoverRecord.summary === "object" &&
      !Array.isArray(handoverRecord.summary)
        ? (handoverRecord.summary as JsonRecord)
        : {};
    const items = records(handoverRecord.items);
    const statusWeight = (status: string): number => {
      if (/waiting_on_parts/.test(status)) return 5;
      if (/external_contractor/.test(status)) return 4;
      if (/temporarily_restored/.test(status)) return 3;
      if (/ongoing/.test(status)) return 2;
      return 0;
    };
    const priorityWeight = (priority: string): number => {
      if (/critical/i.test(priority)) return 4;
      if (/high/i.test(priority)) return 3;
      if (/medium/i.test(priority)) return 2;
      if (/low/i.test(priority)) return 1;
      return 0;
    };
    const rankedItems = [...items].sort((left, right) => {
      const statusDifference =
        statusWeight(firstDecisionText(right, ["status"])) -
        statusWeight(firstDecisionText(left, ["status"]));
      if (statusDifference) return statusDifference;
      return (
        priorityWeight(firstDecisionText(right, ["priority"])) -
        priorityWeight(firstDecisionText(left, ["priority"]))
      );
    });
    const topItem = rankedItems[0];
    const itemCount = numberValue(summary.itemCount ?? items.length);
    const completedCount = numberValue(summary.completedCount);
    const ongoingCount = numberValue(summary.ongoingCount);
    const waitingCount = numberValue(summary.waitingOnPartsCount);
    const contractorCount = numberValue(summary.contractorCount);
    const topWorkOrder = topItem
      ? firstDecisionText(topItem, ["workOrderNumber"])
      : "";
    const topEquipment = topItem
      ? firstDecisionText(topItem, ["equipmentCode", "equipmentName"])
      : "";
    const topStatus = topItem
      ? firstDecisionText(topItem, ["status"]).replace(/_/g, " ")
      : "";
    const topPriority = topItem
      ? firstDecisionText(topItem, ["priority"])
      : "";
    const topOwner = topItem
      ? firstDecisionText(topItem, ["assignedEngineer", "confirmedBy"])
      : "";
    const topNextAction = topItem
      ? firstDecisionText(topItem, ["nextAction"])
      : "";
    const topConfirmation = topItem
      ? firstDecisionText(topItem, ["latestConfirmation"])
      : "";
    const topActivity = topItem
      ? firstDecisionText(topItem, ["lastActivityAt"])
      : "";
    const topLabel = [topWorkOrder, topEquipment].filter(Boolean).join(" · ");
    const actionRequested =
      questionPlan.forceActionPlan === true ||
      /\b(?:first|next action|needs? sorting|what should|checked? first|action first)\b/i.test(
        request.question,
      );
    const missingData = [
      ...(!topOwner && topItem
        ? [`No incoming-shift owner is recorded for ${topLabel || "the highest-priority handover item"}.`]
        : []),
      ...(!topNextAction && topItem
        ? [`No explicit next action is recorded for ${topLabel || "the highest-priority handover item"}.`]
        : []),
      ...(!topActivity && topItem
        ? [`No latest activity timestamp is recorded for ${topLabel || "the highest-priority handover item"}.`]
        : []),
      ...(!topItem
        ? [
            outcome?.status === "unavailable"
              ? outcome.message || "Shift handover evidence is unavailable."
              : "No current shift-handover item was returned.",
          ]
        : []),
    ];
    const action = topItem
      ? `${topNextAction || "Review the latest confirmation and continue the outstanding scope"} for ${topLabel || "the highest-priority handover item"}.`
      : "Confirm the latest handover evidence before directing incoming-shift work.";

    return {
      ...base,
      directAnswer: topItem
        ? `The latest handover contains ${itemCount} items: ${completedCount} completed, ${ongoingCount} ongoing and ${waitingCount} waiting on parts. Check ${topLabel || "the highest-priority item"} first; it is recorded as ${topStatus || "outstanding"}${topPriority ? ` with ${topPriority} priority` : ""}.`
        : outcome?.status === "unavailable"
          ? "The current shift-handover evidence is unavailable, so Ask Vorta cannot identify a safe next item."
          : "No current shift-handover item was returned by the authorised evidence.",
      decisionSummary: [
        {
          label: "Handover totals",
          value: `${itemCount} items · ${completedCount} completed · ${ongoingCount} ongoing.`,
        },
        {
          label: "Waiting / contractor",
          value: `${waitingCount} waiting on parts · ${contractorCount} involving external support.`,
        },
        {
          label: "Check first",
          value: topItem
            ? `${topLabel || "Recorded handover item"} · ${topStatus || "status not recorded"}${topOwner ? ` · owner ${topOwner}` : " · owner not recorded"}.`
            : "No current item returned.",
        },
        {
          label: "Next action",
          value: topNextAction || "No explicit next action was returned.",
        },
        {
          label: "Latest confirmation",
          value: topConfirmation || "No confirmation text was returned.",
        },
      ],
      evidence: rankedItems.slice(0, 4).map((item) => {
        const workOrder = firstDecisionText(item, ["workOrderNumber"]);
        const equipment = firstDecisionText(item, ["equipmentCode", "equipmentName"]);
        const status = firstDecisionText(item, ["status"]).replace(/_/g, " ");
        const owner = firstDecisionText(item, ["assignedEngineer", "confirmedBy"]);
        const nextAction = firstDecisionText(item, ["nextAction"]);
        return `${[workOrder, equipment].filter(Boolean).join(" · ") || "Handover item"}: ${status || "status not recorded"}; ${owner ? `owner ${owner}` : "owner not recorded"}; ${nextAction || "next action not recorded"}.`;
      }),
      findings: rankedItems.slice(0, 4).map((item, index) => {
        const workOrder = firstDecisionText(item, ["workOrderNumber"]);
        const equipment = firstDecisionText(item, ["equipmentCode", "equipmentName"]);
        const status = firstDecisionText(item, ["status"]).replace(/_/g, " ");
        const detail = firstDecisionText(item, ["latestConfirmation", "description"]);
        const nextAction = firstDecisionText(item, ["nextAction"]);
        return {
          category: "handover",
          severity: index === 0 && status !== "completed" ? "high" : "medium",
          title: [workOrder, equipment].filter(Boolean).join(" · ") || "Shift-handover item",
          detail: `${detail || "No confirmation detail returned"}; status ${status || "not recorded"}; ${nextAction || "next action not recorded"}.`,
        };
      }),
      recommendedActions: topItem && actionRequested ? [action] : [],
      actionPlan: topItem && actionRequested
        ? [{
            priority: "incoming_shift",
            action,
            owner: topOwner || "Maintenance Manager / Incoming Shift",
            expectedImpact:
              "Carries the highest-priority recorded handover item into an owned incoming-shift action without creating a parallel work queue.",
            verification:
              "Open the linked handover and SAP work-order evidence and confirm the incoming-shift owner, current status and next confirmation before changing operational records.",
          }]
        : [],
      missingData,
      confidence: topItem ? (missingData.length ? 72 : 86) : 45,
    };
  }

  if (intent === "spares_priority") {
    const outcome = outcomes.get("get_site_spares_risk");
    const sparesData = outcomeData(outcomes, "get_site_spares_risk");
    const sparesRecord =
      sparesData && typeof sparesData === "object" && !Array.isArray(sparesData)
        ? (sparesData as JsonRecord)
        : {};
    const summary =
      sparesRecord.summary &&
      typeof sparesRecord.summary === "object" &&
      !Array.isArray(sparesRecord.summary)
        ? (sparesRecord.summary as JsonRecord)
        : {};
    const spares = records(sparesRecord.spares);
    const topSpare = spares[0];
    const riskItemCount = numberValue(summary.riskItemCount ?? spares.length);
    const outOfStockCount = numberValue(summary.outOfStockCount);
    const belowMinimumCount = numberValue(summary.belowMinimumCount);
    const longLeadCount = numberValue(summary.longLeadCount);
    const componentName = topSpare
      ? firstDecisionText(topSpare, ["componentName"])
      : "";
    const componentCode = topSpare
      ? firstDecisionText(topSpare, ["componentCode"])
      : "";
    const equipment = topSpare
      ? firstDecisionText(topSpare, ["equipmentCode", "equipmentName"])
      : "";
    const available = topSpare ? numberValue(topSpare.availableQuantity) : 0;
    const minimum = topSpare ? numberValue(topSpare.minimumQuantity) : 0;
    const target = topSpare ? numberValue(topSpare.targetQuantity) : 0;
    const minimumShortfall = topSpare ? numberValue(topSpare.minimumShortfall) : 0;
    const targetShortfall = topSpare ? numberValue(topSpare.targetShortfall) : 0;
    const criticality = topSpare
      ? firstDecisionText(topSpare, ["componentCriticality"])
      : "";
    const leadDays = topSpare ? numberValue(topSpare.leadDays) : 0;
    const vendor = topSpare
      ? firstDecisionText(topSpare, ["vendor", "maker"])
      : "";
    const storageLocation = topSpare
      ? firstDecisionText(topSpare, ["storageLocation"])
      : "";
    const outOfStock = topSpare?.outOfStock === true;
    const label = [componentCode, componentName, equipment].filter(Boolean).join(" · ");
    const actionRequested =
      questionPlan.forceActionPlan === true ||
      /\b(?:order|buy|get|purchase|do first|action|stockout)\b/i.test(request.question);
    const missingData = [
      ...(!componentCode && topSpare
        ? ["The highest-risk spare has no recorded part number."]
        : []),
      ...(!vendor && topSpare
        ? [`No supplier or maker is recorded for ${label || "the highest-risk spare"}.`]
        : []),
      ...(!(topSpare && topSpare.leadDays != null)
        ? topSpare
          ? [`No supplier lead time is recorded for ${label || "the highest-risk spare"}.`]
          : []
        : []),
      ...(!topSpare
        ? [
            outcome?.status === "unavailable"
              ? outcome.message || "Critical-spares evidence is unavailable."
              : "No current critical-spares risk item was returned.",
          ]
        : []),
    ];
    const purchasingAction = topSpare
      ? `Confirm the physical stock, ${target > 0 ? `target quantity ${target}` : `minimum quantity ${minimum}`}, supplier lead time and authorised purchasing route for ${label || "the highest-risk spare"}, then have Stores / Buyer raise or update the approved purchasing record.`
      : "Confirm the current stock and approved purchasing evidence before raising any purchasing record.";

    return {
      ...base,
      directAnswer: topSpare
        ? `${label || "The highest-risk spare"} is the first recorded spares priority: ${outOfStock ? "it is out of stock" : `${available} are recorded in stock`}, against minimum ${minimum} and target ${target}, with a target shortfall of ${targetShortfall}${leadDays ? ` and ${leadDays}-day lead time` : ""}.`
        : outcome?.status === "unavailable"
          ? "The current critical-spares evidence is unavailable, so Ask Vorta cannot identify a safe purchasing priority."
          : "No current critical-spares risk item was returned by the authorised evidence.",
      decisionSummary: [
        {
          label: "First spare",
          value: label || "No current risk item returned.",
        },
        {
          label: "Stock position",
          value: topSpare
            ? `${available} available · minimum ${minimum} · target ${target} · shortfall ${targetShortfall}.`
            : "No stock position returned.",
        },
        {
          label: "Risk",
          value: topSpare
            ? `${outOfStock ? "Out of stock" : minimumShortfall > 0 ? "Below minimum" : "Recorded exposure"} · ${criticality || "criticality not recorded"}.`
            : "No risk item returned.",
        },
        {
          label: "Supply evidence",
          value: topSpare
            ? `${vendor || "supplier not recorded"} · ${leadDays ? `${leadDays}-day lead time` : "lead time not recorded"}${storageLocation ? ` · stored ${storageLocation}` : ""}.`
            : "No supply evidence returned.",
        },
        {
          label: "Site exposure",
          value: `${riskItemCount} risk items · ${outOfStockCount} out of stock · ${belowMinimumCount} below minimum · ${longLeadCount} long lead.`,
        },
      ],
      evidence: spares.slice(0, 4).map((item) => {
        const code = firstDecisionText(item, ["componentCode"]);
        const name = firstDecisionText(item, ["componentName"]);
        const asset = firstDecisionText(item, ["equipmentCode", "equipmentName"]);
        const stock = numberValue(item.availableQuantity);
        const min = numberValue(item.minimumQuantity);
        const targetValue = numberValue(item.targetQuantity);
        const lead = numberValue(item.leadDays);
        return `${[code, name, asset].filter(Boolean).join(" · ") || "Spare"}: stock ${stock}; minimum ${min}; target ${targetValue}; ${lead ? `${lead}-day lead time` : "lead time not recorded"}.`;
      }),
      findings: spares.slice(0, 4).map((item, index) => {
        const code = firstDecisionText(item, ["componentCode"]);
        const name = firstDecisionText(item, ["componentName"]);
        const asset = firstDecisionText(item, ["equipmentCode", "equipmentName"]);
        const stock = numberValue(item.availableQuantity);
        const shortfall = numberValue(item.targetShortfall);
        const lead = numberValue(item.leadDays);
        return {
          category: "spares",
          severity: item.outOfStock === true ? "critical" : index === 0 ? "high" : "medium",
          title: [code, name, asset].filter(Boolean).join(" · ") || "Critical spare",
          detail: `Recorded stock ${stock}; target shortfall ${shortfall}; ${lead ? `${lead}-day lead time` : "lead time not recorded"}.`,
        };
      }),
      recommendedActions: topSpare && actionRequested ? [purchasingAction] : [],
      actionPlan: topSpare && actionRequested
        ? [{
            priority: "now",
            action: purchasingAction,
            owner: "Maintenance Manager / Stores / Buyer",
            expectedImpact: `Closes the recorded ${targetShortfall || minimumShortfall} unit shortfall on the highest-risk spare after authorised purchasing confirmation.`,
            verification:
              "Recheck physical stock and the approved purchasing or SAP evidence after an authorised buyer records the request; Ask Vorta does not place orders or alter stock.",
          }]
        : [],
      missingData,
      confidence: topSpare ? (missingData.length ? 72 : 86) : 45,
    };
  }

  if (intent === "contractor_support") {
    const outcome = outcomes.get("get_contractor_availability");
    const contractorData = outcomeData(outcomes, "get_contractor_availability");
    const contractorRecord =
      contractorData && typeof contractorData === "object" && !Array.isArray(contractorData)
        ? (contractorData as JsonRecord)
        : {};
    const summary =
      contractorRecord.summary &&
      typeof contractorRecord.summary === "object" &&
      !Array.isArray(contractorRecord.summary)
        ? (contractorRecord.summary as JsonRecord)
        : {};
    const contractors = records(contractorRecord.contractors);
    const question = request.question.toLowerCase();
    const requestedTerms = [
      "plc",
      "automation",
      "controls",
      "electrical",
      "mechanical",
      "instrumentation",
      "calibration",
      "hvac",
      "welding",
    ].filter((term) => question.includes(term));
    const contractorDetails = contractors.map((contractor) => {
      const skillRows = records(contractor.validatedSkills);
      const skillNames = skillRows
        .map((skill) => firstDecisionText(skill, ["name"]))
        .filter((value): value is string => Boolean(value));
      const engineerName = firstDecisionText(contractor, ["engineerName"]);
      const discipline = firstDecisionText(contractor, ["discipline"]);
      const availabilityStatus = firstDecisionText(contractor, ["availabilityStatus"]);
      const availableNow = contractor.availableNow === true;
      const availabilityRecorded = contractor.availableNow !== null && contractor.availableNow !== undefined;
      const verified = contractor.verified === true;
      const searchable = `${discipline} ${skillNames.join(" ")}`.toLowerCase();
      const matchCount = requestedTerms.filter((term) => searchable.includes(term)).length;
      const supportModes = [
        contractor.onsiteSupport === true ? "onsite" : "",
        contractor.remoteSupport === true ? "remote" : "",
        contractor.onCall === true ? "on call" : "",
      ].filter(Boolean);
      return {
        contractor,
        engineerName,
        discipline,
        availabilityStatus,
        availableNow,
        availabilityRecorded,
        verified,
        skillNames,
        matchCount,
        supportModes,
        score:
          matchCount * 200 +
          (availableNow ? 100 : 0) +
          (verified ? 40 : 0) +
          skillNames.length,
      };
    });
    contractorDetails.sort((left, right) => right.score - left.score);
    const top = contractorDetails[0];
    const contractorCount = numberValue(summary.contractorCount ?? contractors.length);
    const availableNowCount = numberValue(summary.recordedAvailableNowCount);
    const missingAvailabilityCount = numberValue(summary.missingCurrentAvailabilityCount);
    const missingData = [
      ...(!top?.availabilityRecorded
        ? top
          ? [`Current availability is not recorded for ${top.engineerName || "the highest-ranked contractor"}.`]
          : []
        : []),
      ...(!top?.verified
        ? top
          ? [`Verified contractor status is not recorded for ${top.engineerName || "the highest-ranked contractor"}.`]
          : []
        : []),
      ...(!top?.skillNames.length
        ? top
          ? [`No validated skill is recorded for ${top.engineerName || "the highest-ranked contractor"}.`]
          : []
        : []),
      ...(requestedTerms.length > 0 && top && top.matchCount === 0
        ? [`No recorded validated skill explicitly matches ${requestedTerms.join(", ")}.`]
        : []),
      ...(!top
        ? [
            outcome?.status === "unavailable"
              ? outcome.message || "Contractor availability evidence is unavailable."
              : "No current contractor-support record was returned.",
          ]
        : []),
    ];
    const availabilityText = top
      ? top.availableNow
        ? "recorded available now"
        : top.availabilityRecorded
          ? `recorded ${top.availabilityStatus || "not available now"}`
          : "current availability not recorded"
      : "not returned";
    const skillText = top?.skillNames.length
      ? top.skillNames.slice(0, 4).join(", ")
      : "no validated skill returned";
    const contractorAction = top
      ? `Confirm ${top.engineerName || "the recorded contractor"}'s acceptance, current availability, site access, fatigue controls and exact technical scope before an authorised manager arranges support.`
      : "Confirm contractor availability and validated capability before arranging external support.";

    return {
      ...base,
      directAnswer: top
        ? `The best recorded contractor support option is ${top.engineerName || "the highest-ranked contractor"}: ${availabilityText}, ${top.verified ? "verified" : "verification not recorded"}, with validated skills ${skillText}${top.supportModes.length ? ` and ${top.supportModes.join(" / ")} support recorded` : ""}. Availability and acceptance still require confirmation.`
        : outcome?.status === "unavailable"
          ? "The current contractor availability evidence is unavailable, so Ask Vorta cannot recommend a support option."
          : "No current contractor-support record was returned by the authorised evidence.",
      decisionSummary: [
        {
          label: "Best recorded option",
          value: top?.engineerName || "No contractor record returned.",
        },
        {
          label: "Availability",
          value: top ? availabilityText : "No availability evidence returned.",
        },
        {
          label: "Validated capability",
          value: top ? skillText : "No validated skill evidence returned.",
        },
        {
          label: "Support mode",
          value: top?.supportModes.length
            ? top.supportModes.join(" / ")
            : "No onsite, remote or on-call mode was returned.",
        },
        {
          label: "Recorded pool",
          value: `${contractorCount} contractors · ${availableNowCount} available now · ${missingAvailabilityCount} missing current availability.`,
        },
      ],
      evidence: contractorDetails.slice(0, 4).map((item) =>
        `${item.engineerName || "Contractor"}: ${item.availabilityRecorded ? (item.availableNow ? "available now" : item.availabilityStatus || "not available now") : "availability not recorded"}; ${item.verified ? "verified" : "verification not recorded"}; skills ${item.skillNames.slice(0, 4).join(", ") || "not recorded"}.`,
      ),
      findings: contractorDetails.slice(0, 4).map((item, index) => ({
        category: "contractor",
        severity: index === 0 && item.availableNow && item.verified ? "info" : "medium",
        title: item.engineerName || "Contractor support record",
        detail: `${item.availabilityRecorded ? (item.availableNow ? "Available now" : item.availabilityStatus || "Not available now") : "Availability not recorded"}; ${item.verified ? "verified" : "verification not recorded"}; validated skills ${item.skillNames.slice(0, 4).join(", ") || "not recorded"}.`,
      })),
      recommendedActions: top ? [contractorAction] : [],
      actionPlan: top
        ? [{
            priority: "before_external_support",
            action: contractorAction,
            owner: "Maintenance Manager / Planner",
            expectedImpact:
              "Confirms that the recorded external support option is actually available, suitably skilled and authorised before work is planned.",
            verification:
              "Confirm acceptance, attendance, site access, current certificates, technical scope and rest compliance in the approved systems; Ask Vorta does not assign or book contractors.",
          }]
        : [],
      missingData,
      confidence: top ? (missingData.length ? 68 : 86) : 45,
    };
  }

`;

replaceOnce(
  "netlify/functions/ask-vorta/decision-answer.mts",
  '  if (intent === "maintenance_plan_cover_feasibility") {\n',
  `${deterministicBuilders}  if (intent === "maintenance_plan_cover_feasibility") {\n`,
);

replaceOnce(
  "package.json",
  '    "eval:ask-vorta:vor058": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-058-site-priority-performance.json"\n',
  '    "eval:ask-vorta:vor058": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-058-site-priority-performance.json",\n    "eval:ask-vorta:vor059": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-059-deterministic-operational-answers.json",\n    "eval:ask-vorta:vor059:audit": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-059-operational-model-independence-audit.json"\n',
);

replaceOnce(
  "scripts/run-contract-suite.mjs",
  '  ["VOR-058 site-priority performance", "scripts/vor-058-site-priority-performance-contracts.mjs"],\n',
  '  ["VOR-058 site-priority performance", "scripts/vor-058-site-priority-performance-contracts.mjs"],\n  ["VOR-059 deterministic operational answers", "scripts/vor-059-deterministic-operational-answers-contracts.mjs"],\n',
);

for (const path of [".github/workflows/vor-049-validation.yml"]) {
  let source = readFileSync(path, "utf8");
  source = source.replaceAll(
    '      - "scripts/vor-058*"\n',
    '      - "scripts/vor-058*"\n      - "scripts/vor-059*"\n',
  );
  source = source.replaceAll(
    '      - "tests/evals/vor-058-site-priority-performance.json"\n',
    '      - "tests/evals/vor-058-site-priority-performance.json"\n      - "tests/evals/vor-059-deterministic-operational-answers.json"\n      - "tests/evals/vor-059-operational-model-independence-audit.json"\n',
  );
  source = source.replace(
    '      - name: Run complete contract suite\n',
    '      - name: Run permanent VOR-059 contracts\n        run: node scripts/vor-059-deterministic-operational-answers-contracts.mjs\n\n      - name: Run complete contract suite\n',
  );
  source = source.replace(
    '      - name: Stop exact-source Ask Vorta evaluation server\n',
    '      - name: Run six authenticated VOR-059 operational decisions\n        env:\n          VORTA_EVAL_BASE_URL: http://127.0.0.1:8788\n          VORTA_EVAL_DELAY_MS: 250\n          VORTA_EVAL_RATE_LIMIT_RETRY_MS: 310000\n          VORTA_EVAL_RATE_LIMIT_MAX_RETRIES: 1\n        shell: bash\n        run: npm run eval:ask-vorta:vor059 | tee vor-059-live-eval.log\n\n      - name: Stop exact-source Ask Vorta evaluation server\n',
  );
  source = source.replaceAll(
    '            vor-058-live-eval.log\n',
    '            vor-058-live-eval.log\n            vor-059-live-eval.log\n',
  );
  writeFileSync(path, source);
}

replaceOnce(
  "scripts/vor-050-live-eval-orchestration-contracts.mjs",
  'const equipmentScenarios = JSON.parse(\n',
  'const operationalScenarios = JSON.parse(\n  readFileSync(\n    "tests/evals/vor-059-deterministic-operational-answers.json",\n    "utf8",\n  ),\n);\nconst equipmentScenarios = JSON.parse(\n',
);
replaceOnce(
  "scripts/vor-050-live-eval-orchestration-contracts.mjs",
  '/deploy-preview-|Wait for exact Netlify preview commit|VORTA_EVAL_BASE_URL|eval:ask-vorta:vor0(?:48|49|58)/,\n',
  '/deploy-preview-|Wait for exact Netlify preview commit|VORTA_EVAL_BASE_URL|eval:ask-vorta:vor0(?:48|49|58|59)/,\n',
);
replaceOnce(
  "scripts/vor-050-live-eval-orchestration-contracts.mjs",
  '    prDecisionWorkflow.includes("npm run eval:ask-vorta:vor058"),\n  "The central pull-request owner may run only the bounded VOR-058 suite against exact local branch source",\n',
  '    prDecisionWorkflow.includes("npm run eval:ask-vorta:vor058") &&\n    prDecisionWorkflow.includes("npm run eval:ask-vorta:vor059"),\n  "The central pull-request owner must run the bounded VOR-058 and VOR-059 suites against exact local branch source",\n',
);
replaceOnce(
  "scripts/vor-050-live-eval-orchestration-contracts.mjs",
  'assert.equal(\n  equipmentScenarios.length,\n',
  'assert.equal(\n  operationalScenarios.length,\n  6,\n  "The exact-source pull-request gate must retain six model-independent operational scenarios",\n);\nassert.ok(\n  operationalScenarios.every(\n    (scenario) =>\n      Number(scenario.maxToolCount) === 1 &&\n      Number(scenario.maxDurationMs) <= 18_000,\n  ),\n  "VOR-059 must use one authorised tool per question and retain the production p95 ceiling",\n);\nassert.equal(\n  sitePriorityScenarios.length + operationalScenarios.length,\n  12,\n  "The exact-source account window must remain bounded to 12 total requests",\n);\nassert.equal(\n  equipmentScenarios.length,\n',
);

replaceOnce(
  "scripts/vor-054-cross-domain-live-contracts.mjs",
  '    centralWorkflow.includes("npm run eval:ask-vorta:vor058"),\n  "The sole pull-request owner may run the bounded VOR-058 suite only against exact local branch source",\n',
  '    centralWorkflow.includes("npm run eval:ask-vorta:vor058") &&\n    centralWorkflow.includes("npm run eval:ask-vorta:vor059"),\n  "The sole pull-request owner may run the bounded VOR-058 and VOR-059 suites only against exact local branch source",\n',
);

const contract = String.raw`import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const answerSource = readFileSync(
  "netlify/functions/ask-vorta/decision-answer.mts",
  "utf8",
);
const workflowSource = readFileSync(
  ".github/workflows/vor-049-validation.yml",
  "utf8",
);
const packageSource = readFileSync("package.json", "utf8");
const suiteSource = readFileSync("scripts/run-contract-suite.mjs", "utf8");
const scenarios = JSON.parse(
  readFileSync(
    "tests/evals/vor-059-deterministic-operational-answers.json",
    "utf8",
  ),
);
const audit = JSON.parse(
  readFileSync(
    "tests/evals/vor-059-operational-model-independence-audit.json",
    "utf8",
  ),
);

for (const intent of ["shift_handover", "spares_priority", "contractor_support"]) {
  assert.ok(
    answerSource.includes(\`intent === "\${intent}"\`),
    \`Missing deterministic answer builder for \${intent}\`,
  );
}
for (const tool of [
  "get_shift_handover",
  "get_site_spares_risk",
  "get_contractor_availability",
]) {
  assert.ok(
    answerSource.includes(\`outcomes.get("\${tool}")\`) &&
      answerSource.includes(\`outcomeData(outcomes, "\${tool}")\`),
    \`The deterministic builder must consume authorised \${tool} evidence\`,
  );
}
for (const required of [
  "Maintenance Manager / Incoming Shift",
  "Maintenance Manager / Stores / Buyer",
  "Maintenance Manager / Planner",
  "Ask Vorta does not place orders or alter stock",
  "Ask Vorta does not assign or book contractors",
  "without creating a parallel work queue",
  "confidence: topItem ? (missingData.length ? 72 : 86) : 45",
  "confidence: topSpare ? (missingData.length ? 72 : 86) : 45",
  "confidence: top ? (missingData.length ? 68 : 86) : 45",
]) {
  assert.ok(
    answerSource.includes(required),
    \`VOR-059 must retain \${required}\`,
  );
}
assert.doesNotMatch(
  answerSource,
  /purchase order placed|ordered successfully|contractor assigned|booking confirmed|attendance booked/,
  "Deterministic operational answers must not claim an operational write",
);

assert.equal(scenarios.length, 6, "VOR-059 requires six permanent exact-source decisions");
assert.equal(audit.length, 12, "VOR-059 must retain the full 12-question audit");
for (const scenario of [...scenarios, ...audit]) {
  assert.equal(
    scenario.expectedTools.length,
    1,
    \`\${scenario.id} must use exactly one authorised evidence tool\`,
  );
  assert.equal(
    scenario.maxToolCount,
    1,
    \`\${scenario.id} must prohibit redundant tool rounds\`,
  );
  assert.ok(
    Number(scenario.confidenceMin) >= 65,
    \`\${scenario.id} must reject unexplained low confidence\`,
  );
  assert.ok(
    Number(scenario.maxDurationMs) <= 18_000,
    \`\${scenario.id} must retain the production p95 ceiling\`,
  );
}

for (const required of [
  '"scripts/vor-059*"',
  '"tests/evals/vor-059-deterministic-operational-answers.json"',
  "Run permanent VOR-059 contracts",
  "Run six authenticated VOR-059 operational decisions",
  "npm run eval:ask-vorta:vor059",
  "vor-059-live-eval.log",
]) {
  assert.ok(
    workflowSource.includes(required),
    \`The central exact-source gate must retain \${required}\`,
  );
}
assert.ok(
  packageSource.includes('"eval:ask-vorta:vor059"') &&
    packageSource.includes('"eval:ask-vorta:vor059:audit"'),
  "package.json must expose permanent and full VOR-059 audits",
);
assert.ok(
  suiteSource.includes("VOR-059 deterministic operational answers"),
  "The permanent contract suite must register VOR-059",
);

console.log(
  "VOR-059 contracts passed: handover, spares and contractor decisions are model-independent, confidence-bounded, one-tool and read-only.",
);
`;
writeFileSync(
  "scripts/vor-059-deterministic-operational-answers-contracts.mjs",
  contract,
);

console.log("Applied VOR-059 deterministic operational answer implementation.");
