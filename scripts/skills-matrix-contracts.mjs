import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../src/screens/SkillsMatrix/SkillsMatrixSection.tsx", import.meta.url),
  "utf8",
);
const polish = await readFile(
  new URL("../src/screens/SkillsMatrix/SkillsMatrixPolished.tsx", import.meta.url),
  "utf8",
);
const entry = await readFile(
  new URL("../src/screens/SkillsMatrix/index.ts", import.meta.url),
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

for (const requiredText of [
  "By Team",
  "By Department",
  "Calibration",
  "Operational Technology",
  "Priority Coverage Weaknesses",
  "People &amp; Experience",
  "Critical equipment competency, experience and SME resilience",
]) {
  assert.match(
    page,
    new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Skills Matrix must retain ${requiredText}`,
  );
}

assert.match(
  page,
  /schemaVersion: "capability-v2"/,
  "Skills Matrix must use the equipment-weighted capability payload",
);
assert.match(
  page,
  /clearMaintenancePortalDataCache\(SKILLS_MATRIX_FUNCTION\)/,
  "Manual refresh must bypass the cached Skills Matrix payload",
);
assert.match(
  page,
  /Skills capability data could not be loaded/,
  "Skills Matrix must distinguish data failure from zero risk",
);
assert.match(
  page,
  /navigate\(`\/equipment\/\$\{encodeURIComponent\(risk\.equipmentId\)\}\/skills`\)/,
  "Coverage weaknesses must open the affected equipment skills record",
);
assert.doesNotMatch(
  page,
  />AI Insights</,
  "Skills Matrix must not restore the duplicate AI Insights panel",
);
assert.doesNotMatch(
  page,
  />Engineer Detail</,
  "Skills Matrix must not restore the duplicate engineer detail table",
);
assert.doesNotMatch(
  page,
  /Generate AI Report/,
  "Skills Matrix must not show a non-functional AI report control",
);

assert.match(
  entry,
  /SkillsMatrixPolished/,
  "Skills Matrix route must use the polished capability experience",
);
for (const requiredText of [
  "rebalanceOverallCapability",
  "shiftResilience",
  "specialistResilience",
  "criticalTeams.length >= 5",
  "Calibration Team",
  "Operational Technology Team",
  "View all ${visibleRiskCount} weaknesses",
  "Avg experience",
  "Critical SMEs",
  "Training needs",
  "suppressNonActionableMatrixMarkers",
]) {
  assert.match(
    polish,
    new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Skills Matrix polish must retain ${requiredText}`,
  );
}
assert.match(
  polish,
  /index < 3/,
  "Coverage weaknesses must default to the top three",
);
assert.match(
  polish,
  /score = Math\.min\(score, 64\)/,
  "Overall capability must be safety-capped when team resilience is poor",
);
assert.match(
  polish,
  /Unverified.*No evidence/s,
  "Non-actionable validation markers must be suppressed from the matrix",
);

assert.match(
  warmup,
  /schemaVersion: "capability-v2"/,
  "Portal warmup must cache the rebuilt Skills Matrix payload",
);
assert.match(
  prefetch,
  /schemaVersion: "capability-v2"/,
  "Navigation prefetch must reuse the rebuilt Skills Matrix payload",
);

console.log("Skills Matrix contracts passed.");
