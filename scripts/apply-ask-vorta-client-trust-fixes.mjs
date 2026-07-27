import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function patchFile(file, operations) {
  const path = resolve(file);
  let content = readFileSync(path, "utf8");
  for (const [search, replacement, label] of operations) {
    const index = content.indexOf(search);
    if (index < 0) throw new Error(`Could not find ${label} in ${file}.`);
    if (content.indexOf(search, index + search.length) >= 0) {
      throw new Error(`Found ${label} more than once in ${file}.`);
    }
    content = content.slice(0, index) + replacement + content.slice(index + search.length);
  }
  writeFileSync(path, content);
}

patchFile("src/screens/LabourRisk/shiftCoverService.ts", [
  [
    `  skillName: string;\n  skillCategory: string | null;`,
    `  gapKey: string;\n  skillName: string;\n  skillCategory: string | null;`,
    "skill-risk gap key type",
  ],
  [
    `  closedSkills: string[];\n  protectedAssets: string[];`,
    `  closedSkills: string[];\n  protectedAssets: string[];\n  closedGapKeys: string[];`,
    "cover-package closed keys type",
  ],
  [
    `  generatedAt: string;\n  startDate: string;`,
    `  generatedAt: string;\n  sourceUpdatedAt: string | null;\n  startDate: string;`,
    "AI brief source timestamp type",
  ],
  [
    `    shiftDate: requiredString(read(record, "shiftDate", "shift_date"), \`${label}.shiftDate\`),\n    shiftType: shiftType(read(record, "shiftType", "shift_type"), \`${label}.shiftType\`),\n    skillName: requiredString(read(record, "skillName", "skill_name"), \`${label}.skillName\`),`,
    `    shiftDate: requiredString(read(record, "shiftDate", "shift_date"), \`${label}.shiftDate\`),\n    shiftType: shiftType(read(record, "shiftType", "shift_type"), \`${label}.shiftType\`),\n    gapKey: requiredString(read(record, "gapKey", "gap_key"), \`${label}.gapKey\`),\n    skillName: requiredString(read(record, "skillName", "skill_name"), \`${label}.skillName\`),`,
    "skill-risk gap key parser",
  ],
  [
    `    protectedAssets: stringArray(\n      read(record, "protectedAssets", "protected_assets"),\n      \`${label}.protectedAssets\`,\n    ),\n    status: requiredString(record.status, \`${label}.status\`),`,
    `    protectedAssets: stringArray(\n      read(record, "protectedAssets", "protected_assets"),\n      \`${label}.protectedAssets\`,\n    ),\n    closedGapKeys: stringArray(\n      read(record, "closedGapKeys", "closed_gap_keys"),\n      \`${label}.closedGapKeys\`,\n    ),\n    status: requiredString(record.status, \`${label}.status\`),`,
    "cover-package closed keys parser",
  ],
  [
    `  const startTimestamp = dateOnlyTimestamp(startDate, "requested start date");\n  const endTimestamp = dateOnlyTimestamp(endDate, "requested end date");\n\n  return {`,
    `  const startTimestamp = dateOnlyTimestamp(startDate, "requested start date");\n  const endTimestamp = dateOnlyTimestamp(endDate, "requested end date");\n  const calendar = payload.calendar.map((item, index) =>\n    parseCalendarItem(item, index, startTimestamp, endTimestamp),\n  );\n  const priorityShift = [...calendar]\n    .filter((item) => item.coverageStatus !== "covered" || item.missingSkillCount > 0)\n    .sort(\n      (first, second) =>\n        second.labourRiskScore - first.labourRiskScore ||\n        second.missingSkillCount - first.missingSkillCount ||\n        first.shiftDate.localeCompare(second.shiftDate) ||\n        first.shiftType.localeCompare(second.shiftType),\n    )[0];\n  const parsedCandidates = Array.isArray(rawCoverCandidates)\n    ? rawCoverCandidates.map(parseCoverCandidate)\n    : [];\n  const parsedPackages = Array.isArray(rawCoverPackages)\n    ? rawCoverPackages.map(parseCoverPackage)\n    : [];\n  const forPriorityShift = <T extends { shiftDate: string; shiftType: ShiftType }>(item: T) =>\n    !priorityShift ||\n    (item.shiftDate === priorityShift.shiftDate && item.shiftType === priorityShift.shiftType);\n\n  return {`,
    "AI brief prioritisation setup",
  ],
  [
    `    generatedAt: timestampString(\n      payload.generatedAt ?? payload.generated_at,\n      "shiftCoverAiBrief.generatedAt",\n    ),\n    startDate: requiredString(`,
    `    generatedAt: timestampString(\n      payload.generatedAt ?? payload.generated_at,\n      "shiftCoverAiBrief.generatedAt",\n    ),\n    sourceUpdatedAt: nullableTimestamp(\n      payload.sourceUpdatedAt ?? payload.source_updated_at,\n      "shiftCoverAiBrief.sourceUpdatedAt",\n    ),\n    startDate: requiredString(`,
    "AI brief source timestamp parser",
  ],
  [
    `    calendar: payload.calendar.map((item, index) =>\n      parseCalendarItem(item, index, startTimestamp, endTimestamp),\n    ),\n    exceptions: payload.exceptions.map(parseException),\n    skillRisks: rawSkillRisks.map(parseSkillRisk),\n    offRota: Array.isArray(rawOffRota) ? rawOffRota.map(parseOffRota) : [],\n    coverCandidates: Array.isArray(rawCoverCandidates)\n      ? rawCoverCandidates.map(parseCoverCandidate)\n      : [],\n    coverPackages: Array.isArray(rawCoverPackages)\n      ? rawCoverPackages.map(parseCoverPackage)\n      : [],`,
    `    calendar,\n    exceptions: payload.exceptions.map(parseException),\n    skillRisks: rawSkillRisks.map(parseSkillRisk),\n    offRota: Array.isArray(rawOffRota) ? rawOffRota.map(parseOffRota) : [],\n    coverCandidates: parsedCandidates.filter(forPriorityShift),\n    coverPackages: parsedPackages.filter(forPriorityShift),`,
    "AI brief primary-shift option filtering",
  ],
]);

patchFile("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx", [[
  `    evidenceGeneratedAt: shiftCoverBrief?.generatedAt,`,
  `    evidenceGeneratedAt: shiftCoverBrief?.sourceUpdatedAt ?? shiftCoverBrief?.generatedAt,`,
  "fallback evidence freshness",
]]);

patchFile("scripts/ask-vorta-agent-contracts.mjs", [
  [
    `const assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");`,
    `const assistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");\nconst shiftCoverService = read("src/screens/LabourRisk/shiftCoverService.ts");\nconst trustMigration = read("supabase/migrations/20260727173000_harden_ask_vorta_cover_evidence.sql");`,
    "contract evidence imports",
  ],
  [
    `    agent.includes("evidenceGeneratedAt") &&`,
    `    agent.includes("evidenceGeneratedAt") &&\n    agent.includes("sourceUpdatedAt") &&\n    agent.includes("coverEvidenceConfidence") &&\n    agent.includes("closedGapKeys") &&`,
    "agent trust contract checks",
  ],
  [
    `    service.includes("evidenceGeneratedAt") &&\n    liveEvalRunner.includes("answer.decisionSummary"),`,
    `    service.includes("evidenceGeneratedAt") &&\n    shiftCoverService.includes("sourceUpdatedAt") &&\n    shiftCoverService.includes("closedGapKeys") &&\n    assistant.includes("shiftCoverBrief?.sourceUpdatedAt") &&\n    trustMigration.includes("vorta_get_shift_cover_ai_brief_base") &&\n    trustMigration.includes("sourceUpdatedAt") &&\n    trustMigration.includes("closedGapKeys") &&\n    liveEvalRunner.includes("answer.decisionSummary"),`,
    "end-to-end freshness contract",
  ],
]);

const goldenPath = resolve("tests/evals/ask-vorta-live-golden.json");
const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
if (!golden.some((item) => item.id === "golden-cover-holiday-impact")) {
  golden.push({
    id: "golden-cover-holiday-impact",
    question: "What cover issues do holidays create next week?",
    expectedTools: ["get_shift_cover"],
    mustMention: ["cover"],
    mustMentionAny: ["holiday", "absence"],
    mustNotMention: ["23 Jul", "24 Jul", "25 Jul", "26 Jul"],
  });
}
if (!golden.some((item) => item.id === "golden-advisory-order")) {
  golden.push({
    id: "golden-advisory-order",
    question: "What spares should we order first?",
    expectedTools: ["get_site_spares_risk"],
    mustMention: ["stock"],
    mustMentionAny: ["spare", "part", "component", "material"],
    mustNotMention: ["read-only", "cannot change"],
  });
}
writeFileSync(goldenPath, `${JSON.stringify(golden, null, 2)}\n`);
console.log("Ask Vorta client and regression fixes applied.");
