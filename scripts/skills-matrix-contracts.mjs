import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../src/screens/SkillsMatrix/SkillsMatrixNative.tsx", import.meta.url),
  "utf8",
);
const entry = await readFile(
  new URL("../src/screens/SkillsMatrix/index.ts", import.meta.url),
  "utf8",
);
const compatibilityEntry = await readFile(
  new URL("../src/screens/SkillsMatrix/SkillsMatrixIntelligenceBootstrap.tsx", import.meta.url),
  "utf8",
);
const warmup = await readFile(
  new URL("../src/lib/maintenancePortalFastWarmup.ts", import.meta.url),
  "utf8",
);
const prefetch = await readFile(
  new URL("../src/lib/maintenancePortalPrefetch.ts", import.meta.url),
  "utf8",
);
const functionIndex = await readFile(
  new URL("../supabase/functions/skills-matrix-data/index.ts", import.meta.url),
  "utf8",
);
const functionAuth = await readFile(
  new URL("../supabase/functions/skills-matrix-data/auth.ts", import.meta.url),
  "utf8",
);
const functionTransform = await readFile(
  new URL("../supabase/functions/skills-matrix-data/transform.ts", import.meta.url),
  "utf8",
);
const functionAnalysis = await readFile(
  new URL("../supabase/functions/skills-matrix-data/transform-analysis.ts", import.meta.url),
  "utf8",
);

for (const requiredText of [
  "By Team",
  "By Department",
  "Calibration Team",
  "Operational Technology Team",
  "Capability intelligence",
  "Priority Coverage Weaknesses",
  "People &amp; Experience",
  "Site-wide Maintenance",
  "Highest-risk capability",
  "Coverage status",
  "Recorded action gain",
  "All Site",
  "skills-matrix-people-scroll",
  "View all ${selectedDetail.priorityRisks.length} weaknesses",
  "sourceUpdatedAt",
  "areaSkills",
  "avatarUrl: string | null",
  "engineer.avatarUrl",
]) {
  assert.match(
    page,
    new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Native Skills Matrix must retain ${requiredText}`,
  );
}

assert.match(page, /schemaVersion: "capability-v3"/);
assert.match(page, /normaliseSkillsMatrixPayload/);
assert.match(page, /return payload;/);
assert.match(page, /clearMaintenancePortalDataCache\(SKILLS_MATRIX_FUNCTION\)/);
assert.match(page, /Skills capability data could not be loaded/);
assert.match(page, /new Set\(risks\.map\(\(risk\) => risk\.equipmentId\)\)/);
assert.match(page, /risks\.filter\(\(risk\) => risk\.singlePoint\)\.length/);
assert.match(page, /selectedArea === ALL_SITE/);
assert.match(page, /skillIds\.has\(skill\.id\)/);
assert.match(page, /priorityRisks\.slice\(0, 3\)/);
assert.match(page, /\["pending", "rejected", "expired"\]/);
assert.match(
  page,
  /navigate\(`\/equipment\/\$\{encodeURIComponent\(risk\.equipmentId\)\}\/skills`\)/,
);
assert.doesNotMatch(page, /\.from\("engineers"\)/);
assert.doesNotMatch(page, /\.from\("equipment_assets"\)/);
assert.doesNotMatch(page, /\.from\("equipment_required_skills"\)/);
assert.doesNotMatch(page, /criticalTeamShare \* 12/);
assert.doesNotMatch(page, /score = Math\.min\(score, 59\)/);

assert.match(functionIndex, /avatar_url/);
assert.match(functionIndex, /organisationId/);
assert.match(functionIndex, /import \{ context, preflight, response \}/);
assert.match(functionAuth, /vorta_get_function_context/);
assert.doesNotMatch(
  functionIndex + functionAuth,
  /SUPABASE_SERVICE_ROLE_KEY/,
);
assert.match(functionTransform, /criticalTeamShare \* 12/);
assert.match(
  functionTransform,
  /overallScore = Math\.min\(overallScore, 59\)/,
);
assert.match(functionTransform, /sourceUpdatedAt/);
assert.match(functionTransform, /areaSkills/);
assert.match(functionAnalysis, /criticalGaps = priorityRisks\.filter/);
assert.match(functionAnalysis, /spofCount = priorityRisks\.filter/);
assert.match(functionAnalysis, /avatarUrl: engineer\.avatar_url/);

assert.match(entry, /\.\/SkillsMatrixNative/);
assert.match(compatibilityEntry, /\.\/SkillsMatrixNative/);
assert.match(warmup, /schemaVersion: "capability-v3"/);
assert.match(prefetch, /schemaVersion: "capability-v3"/);

for (const forbidden of [
  "MutationObserver",
  "createPortal",
  "scrollIntoView",
  "window.scrollTo",
  "__vortaSkillsMatrixPayload",
  "vorta:skills-matrix-polished-payload",
  "SkillsMatrixSelectionExperience",
  "SkillsMatrixPolished",
  "SkillsMatrixResolvedExperience",
]) {
  assert.doesNotMatch(
    page + entry + compatibilityEntry,
    new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Native Skills Matrix must not use ${forbidden}`,
  );
}

for (const obsolete of [
  "SkillsMatrixSection.tsx",
  "SkillsMatrixResolvedExperience.tsx",
  "SkillsMatrixStableBootstrap.tsx",
  "SkillsMatrixSelectionExperience.tsx",
  "SkillsMatrixPolished.tsx",
]) {
  await assert.rejects(
    access(new URL(`../src/screens/SkillsMatrix/${obsolete}`, import.meta.url)),
    undefined,
    `${obsolete} must be removed after native consolidation`,
  );
}

console.log("Skills Matrix native contracts passed.");
