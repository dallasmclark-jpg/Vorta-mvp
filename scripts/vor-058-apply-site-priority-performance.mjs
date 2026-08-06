import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(path, before, after) {
  const source = readFileSync(path, "utf8");
  const matches = source.split(before).length - 1;
  assert.equal(matches, 1, `${path}: expected one replacement anchor, found ${matches}`);
  writeFileSync(path, source.replace(before, after));
}

replaceOnce(
  "netlify/functions/ask-vorta/route-planning.mts",
  `

  if (hasConversationHistory) return null;

  const evidenceFreshnessRequest =
`,
  `

  const sitePriorityQuestion =
    !/\\bshift-cover\\b/.test(request.pageContext.path) &&
    !equipmentQuery &&
    (
      /\\b(?:top|main|biggest|highest|current)\\s+(?:site\\s+|maintenance\\s+)?(?:risks?|threats?|priorities|problems?)\\b/.test(question) ||
      /\\b(?:site|maintenance)\\s+priorit(?:y|ies)\\b/.test(question) ||
      /\\bwhat needs (?:my|our|your|the site's?|site)?\\s*attention\\b/.test(question) ||
      /\\bwhere should (?:maintenance|we|i) focus first\\b/.test(question) ||
      /\\bwhat should (?:i|we) (?:do|review|prioriti[sz]e|focus on|worry about) first\\b/.test(question) ||
      /\\b(?:things?|issues?|risks?|problems?)\\s+(?:most\\s+)?likely to\\s+(?:hurt|stop|disrupt|bite)(?:\\s+us|\\s+the site)?\\b/.test(question) ||
      /\\bwhat (?:could|might|is likely to) (?:stop|hurt|disrupt|bite)(?:\\s+us|\\s+the site)?\\b/.test(question)
    ) &&
    !/\\b(?:how fresh|freshness|last updated|source update|updated evidence|evidence timestamp|cannot prove|can not prove|not prove|missing evidence|evidence .*missing|unproven|incomplete picture|morning maintenance meeting|morning meeting|single maintenance intervention|one maintenance intervention)\\b/.test(question);

  if (sitePriorityQuestion) {
    return fastPlan(
      "site_priorities",
      "site_threat_prioritization",
      "get_site_operational_snapshot",
      "Rank the main current maintenance threats from the authorised operational-value evidence, state the first executable action and retain exact impact, blockers, owner and verification.",
      { summaryItemLimit: 5, forceActionPlan: true, followUpLimit: 1 },
    );
  }

  if (hasConversationHistory) return null;

  const evidenceFreshnessRequest =
`,
);

replaceOnce(
  "netlify/functions/ask-vorta/runtime.mts",
  `  const routeKey = canonicalRouteKey(questionPlan);
`,
  `  const plannedIntent = String(questionPlan?.intentLabel ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\\s-]+/g, "_");
  if (
    questionPlan?.routingMode !== "deterministic" &&
    (
      plannedIntent === "site_priorities" ||
      plannedIntent === "site_threat_prioritization" ||
      plannedIntent === "site_threat_prioritisation"
    )
  ) {
    questionPlan = {
      ...questionPlan,
      scope: "site_priorities",
      intentLabel: "site_threat_prioritization",
      shouldUseTools: true,
      requiredTools: ["get_site_operational_snapshot"],
      optionalTools: [],
      equipmentQuery: "",
      ambiguity: "none",
      answerFocus:
        "Rank the main current maintenance threats from the authorised operational-value evidence, state the first executable action and retain exact impact, blockers, owner and verification.",
      verificationChecks: [
        "Use only the authorised site operational snapshot.",
        "Do not repeat equipment specialist lookups unless the user explicitly names an asset.",
      ],
      routingMode: "deterministic",
      summaryItemLimit: 5,
      forceActionPlan: true,
      followUpLimit: 1,
    };
  }

  const routeKey = canonicalRouteKey(questionPlan);
`,
);

replaceOnce(
  "netlify/functions/ask-vorta/decision-answer.mts",
  `  if (intent === "maintenance_plan_cover_feasibility") {
`,
  `  if (
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

  if (intent === "maintenance_plan_cover_feasibility") {
`,
);

const contractSource = `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync(
  "netlify/functions/ask-vorta/route-planning.mts",
  "utf8",
);
const runtimeSource = readFileSync(
  "netlify/functions/ask-vorta/runtime.mts",
  "utf8",
);
const answerSource = readFileSync(
  "netlify/functions/ask-vorta/decision-answer.mts",
  "utf8",
);
const suiteSource = readFileSync("scripts/run-contract-suite.mjs", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const scenarios = JSON.parse(
  readFileSync(
    "tests/evals/vor-058-site-priority-performance.json",
    "utf8",
  ),
);

const siteMatcherIndex = routeSource.indexOf("const sitePriorityQuestion");
const historyFallbackIndex = routeSource.indexOf(
  "if (hasConversationHistory) return null;",
);
assert.ok(siteMatcherIndex >= 0, "The natural site-priority matcher must exist");
assert.ok(
  siteMatcherIndex < historyFallbackIndex,
  "Site-priority follow-ups must be handled before semantic-history fallback",
);
for (const phrase of [
  "most\\\\s+)?likely to",
  "where should",
  "what needs",
  "get_site_operational_snapshot",
]) {
  assert.ok(
    routeSource.includes(phrase),
    `Site-priority routing must retain ${phrase}`,
  );
}
assert.ok(
  routeSource.includes('"site_threat_prioritization"'),
  "The site-priority route must use the canonical intent",
);

for (const required of [
  'plannedIntent === "site_priorities"',
  'plannedIntent === "site_threat_prioritization"',
  'requiredTools: ["get_site_operational_snapshot"]',
  'optionalTools: []',
  'routingMode: "deterministic"',
]) {
  assert.ok(
    runtimeSource.includes(required),
    `Semantic site-priority normalisation must retain ${required}`,
  );
}
assert.ok(
  !runtimeSource.includes(
    'requiredTools: ["get_site_operational_snapshot", "get_equipment_risk"]',
  ),
  "Site-priority normalisation must not add equipment specialist lookups",
);

for (const required of [
  'intent === "site_priorities"',
  'intent === "site_threat_prioritization"',
  'const rankedActions = records(rankedData)',
  'actionPlan: topAction',
  "calculated reduction",
  "Unavailable operational domains",
]) {
  assert.ok(
    answerSource.includes(required),
    `Deterministic site-priority answers must retain ${required}`,
  );
}
assert.ok(
  answerSource.includes("Maintenance Manager / Planner"),
  "The deterministic answer must retain an accountable operational owner",
);
assert.ok(
  answerSource.includes("authorised SAP user"),
  "The deterministic answer must preserve the SAP read-only boundary",
);

assert.equal(scenarios.length, 6, "VOR-058 requires six natural variants");
for (const scenario of scenarios) {
  assert.deepEqual(
    scenario.expectedTools,
    ["get_site_operational_snapshot"],
    `${scenario.id} must use one authorised site snapshot`,
  );
  assert.equal(
    scenario.maxToolCount,
    1,
    `${scenario.id} must suppress redundant specialist calls`,
  );
  assert.ok(
    scenario.maxDurationMs <= 18_000,
    `${scenario.id} must retain the production p95 ceiling`,
  );
  assert.notEqual(
    scenario.requireActionPlan,
    false,
    `${scenario.id} must remain decision-ready`,
  );
}

assert.ok(
  suiteSource.includes("VOR-058 site-priority performance"),
  "The permanent contract suite must register VOR-058",
);
assert.ok(
  packageSource.includes('"eval:ask-vorta:vor058"'),
  "package.json must expose the authenticated VOR-058 evaluation",
);

console.log(
  "VOR-058 contracts passed: deterministic site-priority routing, one-snapshot tool suppression, decision-ready ranked answers, latency limits and SAP read-only wording are protected.",
);
`;

writeFileSync(
  "scripts/vor-058-site-priority-performance-contracts.mjs",
  contractSource,
);

const scenarios = [
  {
    id: "vor058-three-threats",
    question:
      "Give me the three things most likely to hurt us today and what I should do first.",
  },
  {
    id: "vor058-focus-first",
    question: "Where should maintenance focus first across the site?",
  },
  {
    id: "vor058-top-priorities",
    question: "What are the top maintenance priorities right now?",
  },
  {
    id: "vor058-manager-attention",
    question: "What needs my attention before today's production meeting?",
  },
  {
    id: "vor058-bite-next",
    question: "Which site problems are most likely to bite us next?",
  },
  {
    id: "vor058-first-executable",
    question:
      "What is the biggest current maintenance threat and the first executable action?",
  },
].map((scenario) => ({
  ...scenario,
  expectedTools: ["get_site_operational_snapshot"],
  maxToolCount: 1,
  maxDurationMs: 18_000,
  maxDecisionSummaryItems: 5,
  maxFollowUpQuestions: 1,
  requireActionPlan: true,
  mustMentionAny: [
    "risk",
    "priority",
    "maintenance",
    "work order",
    "calculated reduction",
  ],
  mustNotMention: [
    "has been updated",
    "assigned successfully",
    "work order released",
    "purchase order placed",
  ],
}));

writeFileSync(
  "tests/evals/vor-058-site-priority-performance.json",
  `${JSON.stringify(scenarios, null, 2)}\n`,
);

replaceOnce(
  "scripts/run-contract-suite.mjs",
  `  ["VOR-057 daily Netlify release", "scripts/netlify-daily-deploy-contracts.mjs"],
  ["VOR-064 locked browser runtime", "scripts/vor-064-locked-browser-runtime-contracts.mjs"],
`,
  `  ["VOR-057 daily Netlify release", "scripts/netlify-daily-deploy-contracts.mjs"],
  ["VOR-058 site-priority performance", "scripts/vor-058-site-priority-performance-contracts.mjs"],
  ["VOR-064 locked browser runtime", "scripts/vor-064-locked-browser-runtime-contracts.mjs"],
`,
);

replaceOnce(
  "package.json",
  `    "eval:ask-vorta:vor049": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-033-demo-golden.json"
`,
  `    "eval:ask-vorta:vor049": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-033-demo-golden.json",
    "eval:ask-vorta:vor058": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-058-site-priority-performance.json"
`,
);

console.log("Applied VOR-058 site-priority performance implementation.");
