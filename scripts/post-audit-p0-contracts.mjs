import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  dataTrust,
  liveTrust,
  liveRoutes,
  equipmentIndex,
  dashboardExperience,
  skillsRoute,
  aiOperations,
  netlify,
  validateMode,
  releaseGate,
  qualityWorkflow,
] = await Promise.all([
  read("src/lib/dataTrust.ts"),
  read("src/screens/Equipment/equipmentLiveTrust.ts"),
  read("src/screens/Equipment/EquipmentLiveRoutes.tsx"),
  read("src/screens/Equipment/index.ts"),
  read("src/screens/AiOperations/MaintenanceDashboardExperience.tsx"),
  read("src/screens/AiOperations/SkillsMatrixRouteEntry.tsx"),
  read("src/screens/AiOperations/AiOperations.tsx"),
  read("netlify.toml"),
  read("scripts/validate-data-mode.mjs"),
  read("scripts/netlify-release-gate.mjs"),
  read(".github/workflows/maintenance-manager-quality.yml"),
]);

assert.match(
  dataTrust,
  /import\.meta\.env\.PROD \? "unavailable" : "demo"/,
  "Production must fail closed when VITE_VORTA_DATA_MODE is missing.",
);

assert.match(liveTrust, /loadLiveEquipmentComponents/);
assert.match(liveTrust, /Stock resilience is unavailable, not 100%/);
assert.match(liveTrust, /loadLiveEquipmentRiskProfile/);
assert.match(liveTrust, /none has a verified risk profile/);
assert.doesNotMatch(liveTrust, /vorta_get_demo_equipment_risk_list/);
assert.doesNotMatch(liveTrust, /riskBreakdownFor/);

for (const entry of [
  "EquipmentSectionEntry",
  "EquipmentOverviewTrustedEntry",
  "EquipmentSparesEntry",
  "EquipmentAiInsightsTrustedEntry",
]) {
  assert.match(liveRoutes, new RegExp(entry));
  assert.match(equipmentIndex, new RegExp(entry));
}
assert.match(liveRoutes, /vorta-global-ai-prompt/);
assert.match(liveRoutes, /navigate\(-1\)/);
assert.match(liveRoutes, /No demonstration record, generated score or optimistic percentage/);

assert.doesNotMatch(dashboardExperience, /querySelector|onClickCapture|cursor-pointer/);
assert.match(skillsRoute, /risk === "shift-cover"/);
assert.match(skillsRoute, /maintenance\/labour-risk\/shift-cover/);
assert.match(aiOperations, /<SkillsMatrixRouteEntry \/>/);

assert.match(netlify, /node scripts\/validate-data-mode\.mjs && npm run build/);
assert.match(validateMode, /context !== "production"/);
assert.match(validateMode, /Missing configuration is not treated as live/);
assert.match(releaseGate, /20 \* 60_000/);
assert.match(qualityWorkflow, /github\.event\.pull_request\.number \|\| github\.sha/);
assert.match(qualityWorkflow, /cancel-in-progress: false/);
assert.match(qualityWorkflow, /--project=desktop-1920/);
assert.match(qualityWorkflow, /VITE_VORTA_DATA_MODE: demo/);

console.log("Post-audit P0 contracts passed.");
