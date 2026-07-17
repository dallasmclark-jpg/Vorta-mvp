import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../src/screens/SkillsMatrix/SkillsMatrixSection.tsx", import.meta.url),
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
