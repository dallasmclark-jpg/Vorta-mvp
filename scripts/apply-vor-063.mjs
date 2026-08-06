import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) {
    throw new Error(`VOR-063 patch point missing: ${label}`);
  }
  return source.replace(before, after);
}

const movementPath = "netlify/functions/ask-vorta/site-risk-movement.mts";
let movement = readFileSync(movementPath, "utf8");

movement = replaceRequired(
  movement,
  "  const asksForMovement =\n    bareChangeQuestion ||",
  "  const asksForCause =\n    /\\b(?:why|what caused|what drove|what is behind|what's behind)\\b/.test(question) &&\n    /\\b(?:site|overall|maintenance|risk|changed|change|worse|worsened|higher|increased|rise|rose)\\b/.test(question);\n  const asksForMovement =\n    asksForCause ||\n    bareChangeQuestion ||",
  "cause-aware routing",
);

movement = replaceRequired(
  movement,
  "    requestedShiftComparison,\n  };",
  "    requestedShiftComparison,\n    asksForCause,\n  };",
  "cause flag",
);

movement = replaceRequired(
  movement,
  '      "Report movement without inventing its cause.",',
  '      "Describe a PM driver only when exact site-scoped due-date crossings reconcile with the overdue-PM snapshot delta; otherwise fail closed on causation.",',
  "verification boundary",
);

movement = replaceRequired(
  movement,
  '  return {\n    source: "Verified daily site risk history",\n    status: "ok",',
  `  const overduePmDelta = Math.round(\n    current.overduePmCount - previous.overduePmCount,\n  );\n  let pmDriverEvidence: JsonRecord = {\n    status: overduePmDelta > 0 ? "unavailable" : "not_applicable",\n    expectedDelta: overduePmDelta,\n    matchedCount: 0,\n    records: [],\n    message: overduePmDelta > 0\n      ? "Exact PM due-date crossings were not available."\n      : "No increase in overdue PMs requires a PM-driver explanation.",\n  };\n\n  if (overduePmDelta > 0 && dayGap === 1) {\n    const { data: pmData, error: pmError } = await supabase\n      .from("preventive_maintenance")\n      .select(\n        "id,equipment_id,pm_number,title,next_due_date,status,criticality,equipment_assets!inner(equipment_code,name,area,site_id)",\n      )\n      .eq("site_id", request.siteId)\n      .eq("equipment_assets.site_id", request.siteId)\n      .gte("next_due_date", previous.snapshotDate)\n      .lt("next_due_date", current.snapshotDate)\n      .order("next_due_date", { ascending: true })\n      .order("pm_number", { ascending: true });\n\n    if (pmError) {\n      pmDriverEvidence = {\n        status: "unavailable",\n        expectedDelta: overduePmDelta,\n        matchedCount: 0,\n        records: [],\n        message: \`The exact PM due-date crossing evidence could not be loaded: \${pmError.message}\`,\n      };\n    } else {\n      const records = (pmData ?? [])\n        .map((value) => value as JsonRecord)\n        .filter((row) =>\n          !/^(?:complete|completed|closed)$/i.test(stringValue(row.status))\n        )\n        .map((row) => {\n          const nested = row.equipment_assets;\n          const equipment = Array.isArray(nested)\n            ? (isRecord(nested[0]) ? nested[0] : null)\n            : (isRecord(nested) ? nested : null);\n          return {\n            id: stringValue(row.id),\n            equipmentId: stringValue(row.equipment_id),\n            pmNumber: stringValue(row.pm_number),\n            title: stringValue(row.title),\n            dueDate: stringValue(row.next_due_date),\n            status: stringValue(row.status),\n            criticality: stringValue(row.criticality) || "Not recorded",\n            equipmentCode: equipment ? stringValue(equipment.equipment_code) : "",\n            equipmentName: equipment ? stringValue(equipment.name) : "",\n            area: equipment ? stringValue(equipment.area) : "",\n          };\n        })\n        .filter((record) =>\n          Boolean(record.id && record.pmNumber && record.dueDate && record.equipmentId)\n        );\n      const reconciled = records.length === overduePmDelta;\n      pmDriverEvidence = {\n        status: reconciled ? "verified" : "mismatch",\n        expectedDelta: overduePmDelta,\n        matchedCount: records.length,\n        records,\n        message: reconciled\n          ? \`\${records.length} exact PM due-date crossing\${records.length === 1 ? "" : "s"} reconcile with the overdue-PM snapshot increase.\`\n          : \`The overdue-PM snapshot increased by \${overduePmDelta}, but \${records.length} exact site-scoped PM due-date crossing\${records.length === 1 ? " was" : "s were"} found.\`,\n      };\n    }\n  } else if (overduePmDelta > 0) {\n    pmDriverEvidence = {\n      status: "unavailable",\n      expectedDelta: overduePmDelta,\n      matchedCount: 0,\n      records: [],\n      message: "PM causation requires consecutive daily snapshots; the returned snapshots do not form one daily crossing window.",\n    };\n  }\n\n  return {\n    source: "Verified daily site risk history",\n    status: "ok",`,
  "PM driver loader",
);

movement = replaceRequired(
  movement,
  "      latestAgeDays,\n      current,",
  "      latestAgeDays,\n      pmDriverEvidence,\n      current,",
  "driver payload",
);

movement = replaceRequired(
  movement,
  "  const requestedShiftComparison =\n    questionPlan.requestedShiftComparison === true;",
  "  const requestedShiftComparison =\n    questionPlan.requestedShiftComparison === true;\n  const asksForCause = questionPlan.asksForCause === true;",
  "answer cause flag",
);

movement = replaceRequired(
  movement,
  '  const topChangeText = topChange\n    ? ` The largest recorded metric movement was ${topChange.label.toLowerCase()}, ${formatted(topChange.previous, topChange.integer)} → ${formatted(topChange.current, topChange.integer)} (${signed(topChange.delta, topChange.integer ? 0 : 1)}).`\n    : " No supporting metric changed in the two returned daily snapshots.";',
  `  const topChangeText = topChange\n    ? \` The largest recorded metric movement was \${topChange.label.toLowerCase()}, \${formatted(topChange.previous, topChange.integer)} → \${formatted(topChange.current, topChange.integer)} (\${signed(topChange.delta, topChange.integer ? 0 : 1)}).\`\n    : " No supporting metric changed in the two returned daily snapshots.";\n  const pmDriverEvidence = isRecord(outcome.data.pmDriverEvidence)\n    ? outcome.data.pmDriverEvidence\n    : null;\n  const pmDriverStatus = pmDriverEvidence\n    ? stringValue(pmDriverEvidence.status)\n    : "unavailable";\n  const pmDriverMessage = pmDriverEvidence\n    ? stringValue(pmDriverEvidence.message)\n    : "Exact PM due-date crossing evidence was not returned.";\n  const pmDriverRecords = pmDriverEvidence && Array.isArray(pmDriverEvidence.records)\n    ? pmDriverEvidence.records.filter(isRecord)\n    : [];\n  const pmDriverVerified = pmDriverStatus === "verified" && pmDriverRecords.length > 0;\n  const pmNames = pmDriverRecords.map((record) => {\n    const pmNumber = stringValue(record.pmNumber);\n    const equipmentCode = stringValue(record.equipmentCode);\n    return equipmentCode ? \`\${pmNumber} on \${equipmentCode}\` : pmNumber;\n  }).filter(Boolean);\n  const pmDriverText = pmDriverVerified\n    ? \` The recorded PM driver was \${pmNames.join(" and ")} crossing into overdue status; these records reconcile with the overdue-PM increase but do not prove every component of the overall risk movement.\`\n    : asksForCause\n      ? \` Ask Vorta cannot verify a record-level PM cause: \${pmDriverMessage}\`\n      : "";`,
  "answer driver parsing",
);

movement = replaceRequired(
  movement,
  "${topChangeText}${shiftBoundary}`",
  "${topChangeText}${pmDriverText}${shiftBoundary}`",
  "direct answer driver",
);

movement = replaceRequired(
  movement,
  '      {\n        label: "Highest-risk area",',
  '      ...(pmDriverVerified\n        ? [{\n            label: "Recorded PM driver",\n            value: `${pmNames.join("; ")} crossed into overdue status and reconciles with the +${pmDriverRecords.length} overdue-PM movement.`,\n          }]\n        : asksForCause\n          ? [{\n              label: "Cause boundary",\n              value: pmDriverMessage,\n            }]\n          : []),\n      {\n        label: "Highest-risk area",',
  "decision summary driver",
);

movement = replaceRequired(
  movement,
  '          `${unchanged.length ? unchanged.map((item) => item.label.toLowerCase()).join(", ") + " did not change. " : ""}Daily snapshots prove movement, not its cause${requestedShiftComparison ? ", and no verified shift-level comparison is available" : ""}.`,',
  '          `${unchanged.length ? unchanged.map((item) => item.label.toLowerCase()).join(", ") + " did not change. " : ""}${pmDriverVerified ? "The overdue-PM driver is record-level verified; other changed metrics still lack record-level cause evidence" : "Daily snapshots prove movement, not its cause"}${requestedShiftComparison ? ", and no verified shift-level comparison is available" : ""}.`,',
  "cause boundary summary",
);

movement = replaceRequired(
  movement,
  '    evidence: metrics.map(\n      (item) =>\n        `${item.label}: ${formatted(item.previous, item.integer)} on ${previous.snapshotDate} → ${formatted(item.current, item.integer)} on ${current.snapshotDate} (${signed(item.delta, item.integer ? 0 : 1)}).`,\n    ),',
  '    evidence: [\n      ...metrics.map(\n        (item) =>\n          `${item.label}: ${formatted(item.previous, item.integer)} on ${previous.snapshotDate} → ${formatted(item.current, item.integer)} on ${current.snapshotDate} (${signed(item.delta, item.integer ? 0 : 1)}).`,\n      ),\n      ...pmDriverRecords.map((record) =>\n        `PM ${stringValue(record.pmNumber)} on ${stringValue(record.equipmentCode) || stringValue(record.equipmentName)}: ${stringValue(record.title)}, due ${stringValue(record.dueDate)}, ${stringValue(record.criticality)} criticality.`\n      ),\n    ],',
  "driver evidence",
);

movement = replaceRequired(
  movement,
  '    findings: changes.slice(0, 5).map((item, index) => ({\n      category: "risk",\n      severity:\n        index === 0 && direction === "worsened"\n          ? "high"\n          : Math.abs(item.delta) > 0\n            ? "medium"\n            : "info",\n      title: item.label,\n      detail:\n        `${formatted(item.previous, item.integer)} on ${previousDate} → ${formatted(item.current, item.integer)} on ${currentDate} (${signed(item.delta, item.integer ? 0 : 1)}).`,\n    })),',
  '    findings: [\n      ...changes.slice(0, 5).map((item, index) => ({\n        category: "risk",\n        severity:\n          index === 0 && direction === "worsened"\n            ? "high"\n            : Math.abs(item.delta) > 0\n              ? "medium"\n              : "info",\n        title: item.label,\n        detail:\n          `${formatted(item.previous, item.integer)} on ${previousDate} → ${formatted(item.current, item.integer)} on ${currentDate} (${signed(item.delta, item.integer ? 0 : 1)}).`,\n      })),\n      ...pmDriverRecords.slice(0, 3).map((record) => ({\n        category: "pm",\n        severity: /critical/i.test(stringValue(record.criticality)) ? "high" : "medium",\n        title: `${stringValue(record.pmNumber)} · ${stringValue(record.equipmentCode) || stringValue(record.equipmentName)}`,\n        detail: `${stringValue(record.title)} crossed into overdue status after its ${readableDate(stringValue(record.dueDate))} due date.`,\n      })),\n    ].slice(0, 7),',
  "driver findings",
);

movement = replaceRequired(
  movement,
  '    missingData: [\n      "The daily snapshots do not prove which work, spare, skill, absence or equipment event caused the movement.",',
  '    missingData: [\n      ...(pmDriverVerified\n        ? ["The matched PM records reconcile with the overdue-PM movement, but no record-level cause has been verified for any other changed metric."]\n        : ["The daily snapshots do not prove which work, spare, skill, absence or equipment event caused the movement."]),\n      ...(asksForCause && !pmDriverVerified ? [pmDriverMessage] : []),',
  "cause-aware missing data",
);

writeFileSync(movementPath, movement);

const contractPath = "scripts/vor-063-pm-risk-driver-contracts.mjs";
writeFileSync(contractPath, `import assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\n\nconst source = readFileSync("netlify/functions/ask-vorta/site-risk-movement.mts", "utf8");\nconst scenarios = JSON.parse(readFileSync("tests/evals/vor-063-pm-risk-drivers.json", "utf8"));\n\nfor (const required of [\n  'const asksForCause =',\n  '.from("preventive_maintenance")',\n  '.eq("site_id", request.siteId)',\n  '.eq("equipment_assets.site_id", request.siteId)',\n  '.gte("next_due_date", previous.snapshotDate)',\n  '.lt("next_due_date", current.snapshotDate)',\n  'status: reconciled ? "verified" : "mismatch"',\n  'The recorded PM driver was',\n  'do not prove every component of the overall risk movement',\n  'cannot verify a record-level PM cause',\n]) assert.ok(source.includes(required), \`VOR-063 missing: \${required}\`);\n\nassert.doesNotMatch(source, /\\.insert\\(|\\.update\\(|\\.delete\\(|service_role/i);\nassert.equal(scenarios.length, 4);\nfor (const scenario of scenarios) {\n  assert.deepEqual(scenario.expectedTools, ["get_site_risk_movement"]);\n  assert.equal(scenario.maxToolCount, 1);\n  assert.equal(scenario.requireActionPlan, false);\n  assert.ok(scenario.maxDurationMs <= 5000);\n}\nconsole.log("VOR-063 contracts passed: PM-driven risk movement is exact, reconciled, one-tool and fail-closed.");\n`);

writeFileSync("tests/evals/vor-063-pm-risk-drivers.json", JSON.stringify([
  {
    id: "vor063-why-worse",
    question: "Why did site risk get worse?",
    expectedTools: ["get_site_risk_movement"],
    mustMentionAny: ["recorded PM driver", "PM-VF02-REJECT-30D", "PM-WFI-SEAL-Q"],
    confidenceMin: 65,
    maxToolCount: 1,
    maxDurationMs: 5000,
    maxDecisionSummaryItems: 5,
    maxFollowUpQuestions: 1,
    requireActionPlan: false,
  },
  {
    id: "vor063-what-caused-rise",
    question: "What caused the increase in overall maintenance risk?",
    expectedTools: ["get_site_risk_movement"],
    mustMentionAny: ["overdue PM", "VF-02", "WFI-01", "does not prove every"],
    confidenceMin: 65,
    maxToolCount: 1,
    maxDurationMs: 5000,
    maxDecisionSummaryItems: 5,
    maxFollowUpQuestions: 1,
    requireActionPlan: false,
  },
  {
    id: "vor063-what-drove-change",
    question: "What drove the change in site risk since yesterday?",
    expectedTools: ["get_site_risk_movement"],
    mustMentionAny: ["PM", "due", "overdue", "recorded"],
    confidenceMin: 65,
    maxToolCount: 1,
    maxDurationMs: 5000,
    maxDecisionSummaryItems: 5,
    maxFollowUpQuestions: 1,
    requireActionPlan: false,
  },
  {
    id: "vor063-previous-shift-cause-boundary",
    question: "What caused site risk to change since the previous shift?",
    expectedTools: ["get_site_risk_movement"],
    mustMentionAny: ["daily comparison", "no verified shift-level", "recorded PM driver"],
    mustNotMention: ["previous shift caused", "shift-level PM movement"],
    confidenceMin: 65,
    maxToolCount: 1,
    maxDurationMs: 5000,
    maxDecisionSummaryItems: 5,
    maxFollowUpQuestions: 1,
    requireActionPlan: false,
  },
], null, 2) + "\n");

let packageJson = readFileSync("package.json", "utf8");
packageJson = replaceRequired(
  packageJson,
  '    "eval:ask-vorta:vor062": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-062-site-risk-movement.json"',
  '    "eval:ask-vorta:vor062": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-062-site-risk-movement.json",\n    "eval:ask-vorta:vor063": "node scripts/ask-vorta-live-evals.mjs tests/evals/vor-063-pm-risk-drivers.json"',
  "package evaluator",
);
writeFileSync("package.json", packageJson);

let suite = readFileSync("scripts/run-contract-suite.mjs", "utf8");
suite = replaceRequired(
  suite,
  '  ["VOR-062 site risk movement", "scripts/vor-062-site-risk-movement-contracts.mjs"],',
  '  ["VOR-062 site risk movement", "scripts/vor-062-site-risk-movement-contracts.mjs"],\n  ["VOR-063 PM risk drivers", "scripts/vor-063-pm-risk-driver-contracts.mjs"],',
  "contract registration",
);
writeFileSync("scripts/run-contract-suite.mjs", suite);

let workflow = readFileSync(".github/workflows/vor-049-validation.yml", "utf8");
workflow = replaceRequired(workflow, '      - "scripts/vor-062*"', '      - "scripts/vor-062*"\n      - "scripts/vor-063*"', "workflow script paths");
workflow = workflow.replaceAll('      - "tests/evals/vor-062-site-risk-movement.json"', '      - "tests/evals/vor-062-site-risk-movement.json"\n      - "tests/evals/vor-063-pm-risk-drivers.json"');
workflow = replaceRequired(
  workflow,
  '      - name: Run permanent VOR-062 contracts\n        run: node scripts/vor-062-site-risk-movement-contracts.mjs',
  '      - name: Run permanent VOR-062 contracts\n        run: node scripts/vor-062-site-risk-movement-contracts.mjs\n\n      - name: Run permanent VOR-063 contracts\n        run: node scripts/vor-063-pm-risk-driver-contracts.mjs',
  "workflow contract step",
);
workflow = replaceRequired(
  workflow,
  '        run: npm run eval:ask-vorta:vor062 | tee vor-062-live-eval.log',
  '        run: npm run eval:ask-vorta:vor062 | tee vor-062-live-eval.log\n\n      - name: Run four authenticated VOR-063 PM-driver decisions\n        env:\n          VORTA_EVAL_BASE_URL: http://127.0.0.1:8788\n          VORTA_EVAL_DELAY_MS: 250\n          VORTA_EVAL_RATE_LIMIT_RETRY_MS: 310000\n          VORTA_EVAL_RATE_LIMIT_MAX_RETRIES: 1\n        shell: bash\n        run: npm run eval:ask-vorta:vor063 | tee vor-063-live-eval.log',
  "workflow eval step",
);
workflow = workflow.replaceAll('            vor-062-live-eval.log', '            vor-062-live-eval.log\n            vor-063-live-eval.log');
writeFileSync(".github/workflows/vor-049-validation.yml", workflow);

console.log("VOR-063 source, contracts, scenarios and workflow integration applied.");
