import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const backendPath = resolve(repositoryRoot, "netlify/functions/ask-vorta.mts");
const liveEvalPath = resolve(repositoryRoot, "scripts/ask-vorta-live-evals.mjs");
const chainContractPaths = [
  resolve(repositoryRoot, "scripts/vor-044-operational-value-ranking-contracts.mjs"),
  resolve(repositoryRoot, "scripts/vor-045-conversation-context-contracts.mjs"),
  resolve(repositoryRoot, "scripts/vor-046-photo-ocr-contracts.mjs"),
];

const backendMarker = "function compactEquipmentDecisionPackForModel(";
const repairMarker = "function repairEquipmentDecisionAnswer(";
const evalMarker = "function visibleDecisionText(answer)";

let backend = readFileSync(backendPath, "utf8");
let liveEval = readFileSync(liveEvalPath, "utf8");
const fullyApplied =
  backend.includes(backendMarker) &&
  backend.includes(repairMarker) &&
  liveEval.includes(evalMarker);
if (fullyApplied) {
  console.log("VOR-049 decision-ready equipment integration is already applied.");
  process.exit(0);
}
if (
  backend.includes(backendMarker) ||
  backend.includes(repairMarker) ||
  liveEval.includes(evalMarker)
) {
  throw new Error(
    "VOR-049 integration is partially applied. Restore a clean source tree before rebuilding.",
  );
}

const oldTrimToolResult = `function trimToolResult(result: ToolResult): string {
  const serialised = JSON.stringify(result);
  if (serialised.length <= MAX_TOOL_OUTPUT_CHARACTERS) return serialised;
  return JSON.stringify({
    source: result.source,
    status: "unavailable",
    message: "The result was too large to analyse safely. Narrow the equipment or date range.",
  });
}`;
const newTrimToolResult = `function compactEquipmentDecisionPackForModel(
  result: ToolResult,
): ToolResult | null {
  if (
    result.source !== "Equipment cross-domain decision pack" ||
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data)
  ) {
    return null;
  }

  const data = result.data as JsonRecord;
  const decisionFacts = textValues(data.decisionFacts)
    .slice(0, 24)
    .map((fact) => fact.slice(0, 900));
  return {
    source: result.source,
    status: result.status,
    message: result.message,
    data: {
      query: data.query,
      equipment: compactDecisionData(data.equipment),
      ambiguous: data.ambiguous,
      matches: compactDecisionData(data.matches),
      coveredTools: textValues(data.coveredTools),
      includedDomains: textValues(data.includedDomains),
      omittedDomains: textValues(data.omittedDomains),
      decisionFacts,
      caveat:
        typeof data.caveat === "string"
          ? data.caveat
          : "The model-facing pack contains the question-relevant verified decision facts rather than every raw equipment domain.",
    },
  };
}

function trimToolResult(result: ToolResult): string {
  const compactEquipmentPack = compactEquipmentDecisionPackForModel(result);
  if (compactEquipmentPack) {
    const compactSerialised = JSON.stringify(compactEquipmentPack);
    if (compactSerialised.length <= MAX_TOOL_OUTPUT_CHARACTERS) {
      return compactSerialised;
    }
    const data = compactEquipmentPack.data as JsonRecord;
    return JSON.stringify({
      ...compactEquipmentPack,
      data: {
        ...data,
        decisionFacts: textValues(data.decisionFacts)
          .slice(0, 12)
          .map((fact) => fact.slice(0, 650)),
      },
    });
  }

  const serialised = JSON.stringify(result);
  if (serialised.length <= MAX_TOOL_OUTPUT_CHARACTERS) return serialised;
  return JSON.stringify({
    source: result.source,
    status: "unavailable",
    message: "The result was too large to analyse safely. Narrow the equipment or date range.",
  });
}`;
if (!backend.includes(oldTrimToolResult)) {
  throw new Error("VOR-049 could not locate trimToolResult.");
}
backend = backend.replace(oldTrimToolResult, newTrimToolResult);

const collectFactsAnchor = "function collectDecisionFacts(\n";
const domainSelectionHelpers = `type EquipmentDecisionDomainName =
  | "get_equipment_work"
  | "get_equipment_calibrations"
  | "get_equipment_skills"
  | "get_equipment_spares"
  | "get_equipment_risk_actions"
  | "get_equipment_history"
  | "get_equipment_documents";

const ALL_EQUIPMENT_DECISION_DOMAINS: EquipmentDecisionDomainName[] = [
  "get_equipment_work",
  "get_equipment_calibrations",
  "get_equipment_skills",
  "get_equipment_spares",
  "get_equipment_risk_actions",
  "get_equipment_history",
  "get_equipment_documents",
];

function equipmentDecisionDomains(question: string): EquipmentDecisionDomainName[] {
  const lowered = question.toLowerCase();
  const selected = new Set<EquipmentDecisionDomainName>();
  const add = (...domains: EquipmentDecisionDomainName[]): void => {
    domains.forEach((domain) => selected.add(domain));
  };

  if (
    /\\b(?:why .*risk|driving .*risk|highest[- ]risk|risk reduction|do first|safest next action|leading intervention)\\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_work", "get_equipment_spares", "get_equipment_risk_actions");
  }
  if (
    /\\b(?:who|qualified|qualification|skill|capability|engineer|authori[sz]e|can lead|can verify|calibrate and verify)\\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_skills");
  }
  if (
    /\\b(?:spare|part|required action|blocking|blocker|permanent correction|permanent repair|replace|out of stock|stockout)\\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_spares", "get_equipment_work");
  }
  if (
    /\\b(?:fault|cause|caused|diagnos|repeat|false reject|credible reading|instrument fault|probe disagreement|keep generating|work history)\\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_history");
  }
  if (
    /\\b(?:calibrat|conductivity|pressure|transmitter|probe|measurement|reading|reference instrument)\\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_calibrations");
  }
  if (
    /\\b(?:document|manual|guide|approved|procedure|drawing|evidence|before acting|after repair|before production restarts|before returning|release|campaign|verification|verify|checks? required)\\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_documents");
  }
  if (/\\b(?:after repair|before production restarts|before returning|release|campaign|next safe action|next shift)\\b/.test(lowered)) {
    add("get_equipment_work", "get_equipment_calibrations");
  }
  if (/\\bnext shift\\b/.test(lowered)) {
    add("get_equipment_spares");
  }
  if (/\\b(?:risk reduction|what remains afterwards|leading intervention)\\b/.test(lowered)) {
    add("get_equipment_risk_actions", "get_equipment_spares");
  }

  return selected.size > 0
    ? ALL_EQUIPMENT_DECISION_DOMAINS.filter((domain) => selected.has(domain))
    : [...ALL_EQUIPMENT_DECISION_DOMAINS];
}

`;
if (!backend.includes(collectFactsAnchor)) {
  throw new Error("VOR-049 could not locate the decision-fact helper anchor.");
}
backend = backend.replace(collectFactsAnchor, domainSelectionHelpers + collectFactsAnchor);

const oldDomainNames = `      const domainNames = [
        "get_equipment_work",
        "get_equipment_calibrations",
        "get_equipment_skills",
        "get_equipment_spares",
        "get_equipment_risk_actions",
        "get_equipment_history",
        "get_equipment_documents",
      ] as const;`;
const newDomainNames = `      const domainNames = equipmentDecisionDomains(request.question);`;
if (!backend.includes(oldDomainNames)) {
  throw new Error("VOR-049 could not locate the equipment decision-pack domain list.");
}
backend = backend.replace(oldDomainNames, newDomainNames);

const packDataAnchor = `          coveredTools,
          decisionFacts: equipmentDecisionFacts(selected, domains, request.question),
          domains,`;
const packDataReplacement = `          coveredTools,
          includedDomains: domainNames,
          omittedDomains: ALL_EQUIPMENT_DECISION_DOMAINS.filter(
            (domain) => !domainNames.includes(domain),
          ),
          decisionFacts: equipmentDecisionFacts(selected, domains, request.question),
          domains,`;
if (!backend.includes(packDataAnchor)) {
  throw new Error("VOR-049 could not locate the equipment decision-pack output.");
}
backend = backend.replace(packDataAnchor, packDataReplacement);

const oldFactsReturn = `  const questionRanked = relevantEquipmentDecisionFacts(
    question,
    [...explicitFacts, ...rankedFacts],
  );
  return [
    ...new Set([
      ...priorityFacts,
      ...identity,
      ...questionRanked,
      ...explicitFacts.slice(0, 32),
      ...rankedFacts.slice(0, 24),
    ]),
  ].slice(0, 64);`;
const newFactsReturn = `  const questionRanked = relevantEquipmentDecisionFacts(
    question,
    [...priorityFacts, ...explicitFacts, ...rankedFacts],
  );
  return [
    ...new Set([
      ...priorityFacts,
      ...identity,
      ...questionRanked,
      ...explicitFacts,
      ...rankedFacts,
    ]),
  ]
    .slice(0, 24)
    .map((fact) => fact.slice(0, 900));`;
if (!backend.includes(oldFactsReturn)) {
  throw new Error("VOR-049 could not locate the equipment decision-fact boundary.");
}
backend = backend.replace(oldFactsReturn, newFactsReturn);

const retainFactsAnchor = "function retainEquipmentDecisionFacts(\n";
const answerRepairHelpers = `function equipmentVisibleDecisionText(answer: JsonRecord): string {
  return [
    typeof answer.directAnswer === "string" ? answer.directAnswer : "",
    ...records(answer.decisionSummary).flatMap((item) => [
      typeof item.label === "string" ? item.label : "",
      typeof item.value === "string" ? item.value : "",
    ]),
    ...records(answer.findings).flatMap((item) => [
      typeof item.title === "string" ? item.title : "",
      typeof item.detail === "string" ? item.detail : "",
    ]),
    ...textValues(answer.recommendedActions),
    ...records(answer.actionPlan).flatMap((item) => [
      typeof item.action === "string" ? item.action : "",
      typeof item.expectedImpact === "string" ? item.expectedImpact : "",
      typeof item.verification === "string" ? item.verification : "",
    ]),
    ...textValues(answer.missingData),
  ]
    .filter(Boolean)
    .join(" ");
}

function unavailableEquipmentDecisionClaim(value: string): boolean {
  return /(?:decision pack|equipment evidence|authorised result|available result)[^.]{0,120}(?:unavailable|too large|could not be analysed)|(?:cannot|can’t|can't|unable to) (?:confirm|verify|identify|support|determine)[^.]{0,120}(?:available|authorised|decision pack|evidence|result)|no authorised [^.]{0,80}(?:evidence|personnel|record)/i.test(
    value,
  );
}

function readableEquipmentDecisionFact(fact: string): string {
  return fact
    .replace(/^priority (?:spare|capability|document) evidence:\\s*/i, "")
    .replace(/^work evidence\\s*/i, "work order ")
    .replace(/^document evidence:\\s*/i, "")
    .replace(/^equipment:\\s*/i, "")
    .replace(/\\s*\\|\\s*/g, "; ")
    .trim();
}

function equipmentFactCategory(fact: string): string {
  if (/capability|skill|engineer|qualified/i.test(fact)) return "skill";
  if (/spare|component|part|stock|lead time/i.test(fact)) return "spare";
  if (/document|manual|guide|drawing|procedure/i.test(fact)) return "document";
  if (/work evidence|work order|WO-/i.test(fact)) return "work";
  if (/risk|intervention|action/i.test(fact)) return "risk";
  return "data";
}

function repairEquipmentDecisionAnswer(
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

  const packData = pack.data as JsonRecord;
  const decisionFacts = textValues(packData.decisionFacts);
  if (decisionFacts.length === 0) return;
  const visibleText = equipmentVisibleDecisionText(answer);
  if (!unavailableEquipmentDecisionClaim(visibleText)) return;

  const goal = String(questionPlan.decisionGoal ?? "");
  const selectedFacts = [
    ...new Set([
      ...decisionFacts.filter((fact) => /^priority /i.test(fact)),
      ...relevantEquipmentDecisionFacts(goal, decisionFacts),
      ...decisionFacts,
    ]),
  ].slice(0, 8);
  if (selectedFacts.length === 0) return;

  const loweredGoal = goal.toLowerCase();
  const capabilityFact = selectedFacts.find((fact) => /priority capability evidence/i.test(fact));
  const spareFact = selectedFacts.find((fact) => /priority spare evidence/i.test(fact));
  const documentFact = selectedFacts.find((fact) => /priority document evidence|document evidence/i.test(fact));
  const workFact = selectedFacts.find((fact) => /work evidence|work.?order|WO-/i.test(fact));
  const primaryFact =
    (/\\b(?:who|qualified|engineer|skill|authori[sz]e|can lead|can verify)\\b/.test(loweredGoal)
      ? capabilityFact
      : undefined) ??
    (/\\b(?:spare|part|stock|blocking|blocker|permanent correction|permanent repair)\\b/.test(loweredGoal)
      ? spareFact
      : undefined) ??
    (/\\b(?:document|manual|approved|evidence|verification|verify|before acting|after repair)\\b/.test(loweredGoal)
      ? documentFact
      : undefined) ??
    spareFact ??
    capabilityFact ??
    documentFact ??
    workFact ??
    selectedFacts[0];
  const primaryText = readableEquipmentDecisionFact(primaryFact);
  const supportingFact = selectedFacts.find((fact) => fact !== primaryFact);
  const supportingText = supportingFact
    ? readableEquipmentDecisionFact(supportingFact)
    : "";

  if (/\\b(?:who|qualified|engineer|skill|authori[sz]e|can lead|can verify)\\b/.test(loweredGoal)) {
    answer.directAnswer = `The verified Vorta capability evidence identifies ${primaryText}.`;
  } else if (/\\b(?:spare|part|stock|blocking|blocker|permanent correction|permanent repair)\\b/.test(loweredGoal)) {
    answer.directAnswer = `The verified blocking-spare evidence is ${primaryText}${supportingText ? `; ${supportingText}` : ""}.`;
  } else if (/\\b(?:fault|cause|diagnos|repeat|reading|instrument fault|probe disagreement)\\b/.test(loweredGoal)) {
    answer.directAnswer = `The authorised diagnosis is supported by ${primaryText}${supportingText ? `; ${supportingText}` : ""}.`;
  } else if (/\\b(?:verification|verify|checks? required|after repair|before production restarts|before returning|release|campaign)\\b/.test(loweredGoal)) {
    answer.directAnswer = `The required equipment verification is supported by ${primaryText}${supportingText ? `; ${supportingText}` : ""}.`;
  } else {
    answer.directAnswer = `The authorised equipment evidence supports the decision: ${primaryText}${supportingText ? `; ${supportingText}` : ""}.`;
  }

  answer.decisionSummary = selectedFacts.slice(0, 4).map((fact, index) => ({
    label:
      index === 0
        ? "Decision"
        : equipmentFactCategory(fact) === "spare"
          ? "Spare"
          : equipmentFactCategory(fact) === "skill"
            ? "Capability"
            : equipmentFactCategory(fact) === "document"
              ? "Approved evidence"
              : equipmentFactCategory(fact) === "work"
                ? "Work evidence"
                : "Supporting evidence",
    value: readableEquipmentDecisionFact(fact),
  }));
  answer.findings = selectedFacts.slice(0, 5).map((fact, index) => ({
    category: equipmentFactCategory(fact),
    severity: index === 0 ? "high" : "info",
    title: index === 0 ? "Verified decision fact" : "Supporting Vorta evidence",
    detail: readableEquipmentDecisionFact(fact),
  }));
  answer.missingData = textValues(answer.missingData).filter(
    (item) => !unavailableEquipmentDecisionClaim(item),
  );

  if (
    questionPlan.forceActionPlan === true &&
    (records(answer.actionPlan).length === 0 ||
      unavailableEquipmentDecisionClaim(equipmentVisibleDecisionText(answer)))
  ) {
    const actionFact =
      selectedFacts.find((fact) => /action|replace|verify|inspect|repair|order|procure/i.test(fact)) ??
      primaryFact;
    answer.actionPlan = [
      {
        priority: "now",
        action: readableEquipmentDecisionFact(actionFact),
        owner: "Maintenance Manager",
        expectedImpact:
          "Starts the first verified intervention supported by the current equipment evidence.",
        verification:
          "Open the linked equipment records and confirm the named part, person, work order or approved verification result before closing the decision.",
      },
    ];
  }
}

`;
if (!backend.includes(retainFactsAnchor)) {
  throw new Error("VOR-049 could not locate retainEquipmentDecisionFacts.");
}
backend = backend.replace(retainFactsAnchor, answerRepairHelpers + retainFactsAnchor);

const deterministicRepairAnchor = `    retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
    answer.confidence = evidenceAwareConfidence(answer, questionPlan, toolOutcomes);`;
const deterministicRepairReplacement = `    retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
    repairEquipmentDecisionAnswer(answer, questionPlan, toolOutcomes);
    answer.confidence = evidenceAwareConfidence(answer, questionPlan, toolOutcomes);`;
if (!backend.includes(deterministicRepairAnchor)) {
  throw new Error("VOR-049 could not locate deterministic answer completion.");
}
backend = backend.replace(deterministicRepairAnchor, deterministicRepairReplacement);

const semanticRepairAnchor = `        retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
        enforceEquipmentReturnToServiceSafety(answer, questionPlan);`;
const semanticRepairReplacement = `        retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
        repairEquipmentDecisionAnswer(answer, questionPlan, toolOutcomes);
        enforceEquipmentReturnToServiceSafety(answer, questionPlan);`;
if (!backend.includes(semanticRepairAnchor)) {
  throw new Error("VOR-049 could not locate semantic answer completion.");
}
backend = backend.replace(semanticRepairAnchor, semanticRepairReplacement);

const confidenceReturnAnchor = `  const lowerBound = okResults.length > 0 ? (ambiguity ? 40 : 55) : 20;
  return Math.max(lowerBound, Math.min(95, Math.round(score)));`;
const confidenceReturnReplacement = `  const lowerBound = okResults.length > 0 ? (ambiguity ? 40 : 55) : 20;
  const visibleDecisionUnavailable = unavailableEquipmentDecisionClaim(
    equipmentVisibleDecisionText(answer),
  );
  const upperBound = visibleDecisionUnavailable ? 50 : 95;
  return Math.max(
    Math.min(lowerBound, upperBound),
    Math.min(upperBound, Math.round(score)),
  );`;
if (!backend.includes(confidenceReturnAnchor)) {
  throw new Error("VOR-049 could not locate confidence calibration.");
}
backend = backend.replace(confidenceReturnAnchor, confidenceReturnReplacement);
writeFileSync(backendPath, backend);

const answerTextAnchor = "function answerText(answer) {\n";
const visibleEvalHelpers = `function visibleDecisionText(answer) {
  return [
    answer?.directAnswer,
    ...(answer?.decisionSummary || []).flatMap((item) => [item?.label, item?.value]),
    ...(answer?.findings || []).flatMap((item) => [item?.title, item?.detail]),
    ...(answer?.recommendedActions || []),
    ...(answer?.actionPlan || []).flatMap((item) => [
      item?.action,
      item?.owner,
      item?.expectedImpact,
      item?.verification,
    ]),
  ]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join("\\n")
    .toLowerCase();
}

function visibleDecisionContradictions(answer) {
  const visible = visibleDecisionText(answer);
  const evidence = (answer?.evidence || [])
    .filter((value) => typeof value === "string")
    .join("\\n")
    .toLowerCase();
  const failures = [];
  if (
    /(?:cannot|can’t|can't|unable to) (?:confirm|verify|identify)[^.]{0,120}(?:engineer|qualified|capability)/.test(visible) &&
    /priority capability evidence/.test(evidence)
  ) {
    failures.push("visible answer denies capability evidence present in the response");
  }
  if (
    /(?:cannot|can’t|can't|unable to) (?:confirm|verify|identify)[^.]{0,120}(?:spare|part|blocking)/.test(visible) &&
    /priority spare evidence/.test(evidence)
  ) {
    failures.push("visible answer denies spare evidence present in the response");
  }
  if (
    /(?:decision pack|equipment evidence|authorised result)[^.]{0,120}(?:unavailable|too large)/.test(visible) &&
    /priority (?:capability|spare|document) evidence|work evidence/.test(evidence)
  ) {
    failures.push("visible answer claims the equipment decision is unavailable despite decisive evidence");
  }
  return failures;
}

`;
if (!liveEval.includes(answerTextAnchor)) {
  throw new Error("VOR-049 could not locate the live-evaluation answer text helper.");
}
liveEval = liveEval.replace(answerTextAnchor, visibleEvalHelpers + answerTextAnchor);

const evalTextAnchor = `    const text = answerText(payload);
    const usedTools = new Set(payload.toolsUsed || []);`;
const evalTextReplacement = `    const text = answerText(payload);
    const visibleText = visibleDecisionText(payload);
    const requireVisibleDecision =
      scenario.requireVisibleDecision === true ||
      /vor-033-demo-golden\\.json$/.test(scenarioFile);
    const assertionText = requireVisibleDecision ? visibleText : text;
    const usedTools = new Set(payload.toolsUsed || []);`;
if (!liveEval.includes(evalTextAnchor)) {
  throw new Error("VOR-049 could not locate live-evaluation response assertions.");
}
liveEval = liveEval.replace(evalTextAnchor, evalTextReplacement);
liveEval = liveEval.replaceAll(
  "text.includes(phrase.toLowerCase())",
  "assertionText.includes(phrase.toLowerCase())",
);
liveEval = liveEval.replace(
  `    for (const phrase of scenario.mustNotMention || []) {
      if (assertionText.includes(phrase.toLowerCase())) failures.push(\`unsafe phrase "\${phrase}"\`);
    }`,
  `    for (const phrase of scenario.mustNotMention || []) {
      if (assertionText.includes(phrase.toLowerCase())) failures.push(\`unsafe phrase "\${phrase}"\`);
    }
    if (requireVisibleDecision) {
      failures.push(...visibleDecisionContradictions(payload));
      if (
        /(?:decision pack|equipment evidence|authorised result)[^.]{0,120}(?:unavailable|too large)/.test(
          visibleText,
        )
      ) {
        failures.push("visible decision layer reports an unavailable or oversized equipment pack");
      }
    }`,
);
writeFileSync(liveEvalPath, liveEval);

for (const contractPath of chainContractPaths) {
  let contract = readFileSync(contractPath, "utf8");
  if (contract.includes("vor-049-integrate-decision-ready-equipment")) continue;
  const routeIntegrationPattern =
    "(?: && node scripts\\\\/vor-048-integrate-routing-telemetry-feedback\\\\.mjs)?";
  if (!contract.includes(routeIntegrationPattern)) {
    throw new Error(`VOR-049 could not extend integration-chain contract ${contractPath}.`);
  }
  contract = contract.replaceAll(
    routeIntegrationPattern,
    `${routeIntegrationPattern}(?: && node scripts\\\\/vor-049-integrate-decision-ready-equipment\\\\.mjs)?`,
  );
  writeFileSync(contractPath, contract);
}

console.log("Applied VOR-049 decision-ready equipment evidence, answer repair and visible-quality evaluation.");
