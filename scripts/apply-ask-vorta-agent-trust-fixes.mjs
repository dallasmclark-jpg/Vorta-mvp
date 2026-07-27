import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve("netlify/functions/ask-vorta.mts");
let content = readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (content.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Found ${label} more than once.`);
  }
  content = content.slice(0, index) + replacement + content.slice(index + search.length);
}

function replaceRegexOnce(pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...content.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) throw new Error(`Expected one ${label}; found ${matches.length}.`);
  content = content.replace(pattern, replacement);
}

replaceOnce(
  `  const writeRequest =\n    /\\b(change|update|assign|delete|create|approve|order|schedule|book|cancel)\\b/i.test(\n      question,\n    );`,
  `  const writeRequest =\n    /^\\s*(?:please\\s+)?(?:change|update|assign|delete|create|approve|order|schedule|book|cancel|close|complete|move|switch)\\b/i.test(\n      question,\n    ) ||\n    /\\b(?:can|could|would|will)\\s+you\\s+(?:change|update|assign|delete|create|approve|order|schedule|book|cancel|close|complete|move|switch)\\b/i.test(\n      question,\n    );`,
  "write-intent detector",
);

replaceOnce(
  `  const broadCoverQuestion =\n    /\\bcover(?:age)?\\b/i.test(question) &&\n    !/\\b(holiday|training|absence|rest conflict|fatigue)\\b/i.test(question);`,
  `  const broadCoverQuestion = /\\bcover(?:age)?\\b/i.test(question);`,
  "broad cover intent",
);

replaceOnce(
  `  const closedSkillNames = new Set(\n    textValues(primaryPackage?.closedSkills).map((name) => name.toLowerCase()),\n  );\n  const residualSkillRisks = primarySkillRisks.filter(\n    (item) => !closedSkillNames.has(String(item.skillName).toLowerCase()),\n  );`,
  `  const closedGapKeys = new Set(textValues(primaryPackage?.closedGapKeys));\n  const residualSkillRisks = primarySkillRisks.filter((item) => {\n    const gapKey = typeof item.gapKey === "string" ? item.gapKey : "";\n    return !gapKey || !closedGapKeys.has(gapKey);\n  });`,
  "residual skill calculation",
);

replaceRegexOnce(
  /    const orderedPackageShifts = requestedShift[\s\S]*?\n        \);\n    const packageOptions = orderedPackageShifts/,
  `    const orderedPackageShifts = [primaryShift];\n    const packageOptions = orderedPackageShifts`,
  "cover-package shift ordering",
);

replaceOnce(
  `      expectedImpact: \`Fully close \${numberValue(primaryPackage.missingSkillsClosed)} missing-skill gaps; \${numberValue(primaryPackage.remainingMissingSkills)} remain.\`,`,
  `      expectedImpact: \`Close \${numberValue(primaryPackage.missingSkillsClosed)} of \${numberValue(primaryShift.missingSkillCount)} missing-skill gaps; \${numberValue(primaryPackage.remainingMissingSkills)} remain.\`,`,
  "action impact ratio",
);

const confidenceHelper = `\nfunction coverEvidenceConfidence(\n  shiftCoverEvidence: JsonRecord,\n  primaryShift: JsonRecord,\n  primaryPackage: JsonRecord | undefined,\n  primarySkillRisks: JsonRecord[],\n  offRotaNames: string[],\n): number {\n  let score = primaryPackage ? 92 : 78;\n  const sourceUpdatedAt =\n    typeof shiftCoverEvidence.sourceUpdatedAt === "string"\n      ? new Date(shiftCoverEvidence.sourceUpdatedAt).getTime()\n      : Number.NaN;\n\n  if (!Number.isFinite(sourceUpdatedAt)) {\n    score -= 15;\n  } else {\n    const sourceAgeHours = Math.max(0, (Date.now() - sourceUpdatedAt) / 3_600_000);\n    if (sourceAgeHours > 168) score -= 20;\n    else if (sourceAgeHours > 72) score -= 12;\n    else if (sourceAgeHours > 24) score -= 6;\n  }\n\n  if (textValues(primaryShift.engineerNames).length === 0) score -= 12;\n  if (numberValue(primaryShift.missingSkillCount) > 0 && primarySkillRisks.length === 0) {\n    score -= 12;\n  }\n  if (primaryPackage && offRotaNames.length === 0) score -= 8;\n  if (primaryPackage && numberValue(primaryPackage.remainingMissingSkills) > 0) score -= 5;\n\n  return Math.max(45, Math.min(95, Math.round(score)));\n}\n`;

replaceOnce(
  `function enforceAnswerEvidence(\n`,
  `${confidenceHelper}\nfunction enforceAnswerEvidence(\n`,
  "confidence helper insertion point",
);

replaceOnce(
  `  answer.evidenceGeneratedAt =\n    typeof shiftCoverEvidence.generatedAt === "string"\n      ? shiftCoverEvidence.generatedAt\n      : new Date().toISOString();\n  answer.confidence = primaryPackage ? 95 : 85;`,
  `  answer.evidenceGeneratedAt =\n    typeof shiftCoverEvidence.sourceUpdatedAt === "string"\n      ? shiftCoverEvidence.sourceUpdatedAt\n      : typeof shiftCoverEvidence.generatedAt === "string"\n        ? shiftCoverEvidence.generatedAt\n        : undefined;\n  answer.confidence = coverEvidenceConfidence(\n    shiftCoverEvidence,\n    primaryShift,\n    primaryPackage,\n    primarySkillRisks,\n    offRotaNames,\n  );`,
  "freshness and confidence assignment",
);

replaceOnce(
  `    "Sources must be labels from successful or empty tool results actually used. Missing or unavailable evidence must be listed in missingData and lower confidence.",`,
  `    "Sources must be labels from successful or empty tool results actually used. Missing or unavailable evidence must be listed in missingData and lower confidence.",\n    "Treat generatedAt as query time and sourceUpdatedAt as the underlying source-data freshness. Lower confidence when sourceUpdatedAt is missing or stale, and never describe query time as the source update time.",`,
  "source freshness instruction",
);

writeFileSync(path, content);
console.log("Ask Vorta agent trust fixes applied.");
