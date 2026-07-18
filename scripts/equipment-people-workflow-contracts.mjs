import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  service,
  equipment,
  evidence,
  dashboard,
  assistant,
  skills,
  packageText,
  hardenedMigration,
] = await Promise.all([
  read("src/screens/Equipment/equipmentService.ts"),
  read("src/screens/Equipment/EquipmentSkillsIntelligence.tsx"),
  read("src/screens/Equipment/EquipmentRequiredSkillCoverage.tsx"),
  read("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"),
  read("src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx"),
  read("src/screens/SkillsMatrix/SkillsMatrixNative.tsx"),
  read("package.json"),
  read("supabase/migrations/20260718102000_harden_equipment_skill_evidence_showcase.sql"),
]);

for (const text of [
  "EquipmentSkillEngineerEvidence",
  "qualifiedEngineers",
  "nearestEngineers",
  "singlePointOfFailure",
  "validationGap",
]) assert.match(service, new RegExp(text));

for (const text of [
  "EquipmentRequiredSkillCoverage",
  "Open Skills Matrix",
  "Find engineer",
  "View requirement",
  "Open training plan",
  "returnTo",
  "qualifiedEngineers",
  "nearestEngineers",
]) assert.match(equipment + evidence, new RegExp(text));

for (const text of [
  "Requirement coverage",
  "Resilience",
  "Close skill gap",
  "Develop backup",
  "skillName",
  'view: "priority"',
  "trainingPriority",
  "hiddenQualifiedCount",
]) assert.match(evidence, new RegExp(text));

assert.match(evidence, /equipment: equipmentId/);
assert.match(evidence, /skill: skill\.skillId/);
assert.match(evidence, /min-h-10/);
assert.match(evidence, /text-xs/);

assert.match(dashboard, /getLabourRiskWorkflowRoute/);
assert.match(dashboard, /single-point-failure/);
assert.match(dashboard, /\/skills-matrix\?/);
assert.match(dashboard, /\/training\?/);
assert.match(dashboard, /from=dashboard/);

assert.match(assistant, /equipmentWorkflowRoute/);
assert.match(assistant, /Open capability risk/);
assert.match(assistant, /engineer=\$\{encodeURIComponent\(sme\.id\)\}/);
assert.match(assistant, /equipmentId=\{result\.primaryEquipment\?\.id \?\? null\}/);

assert.match(skills, /equipmentFilterId/);
assert.match(skills, /equipmentPriorityRisks/);
assert.match(skills, /Equipment: \$\{equipmentFocusName\}/);
assert.match(skills, /next\.delete\("equipment"\)/);
assert.match(skills, /risk\.equipmentId === equipmentFilterId/);

for (const pattern of [
  /create or replace function public\.vorta_get_equipment_skills_showcase/,
  /join public\.sites site on site\.id = equipment\.site_id/,
  /qualification_state/,
  /SKILL_VERIFIED_EQUIPMENT_AUTHORISATION_MISSING/,
  /from public\.maintenance_shift_teams/,
  /grant execute on function public\.vorta_get_equipment_skills_showcase\(uuid\) to authenticated/,
]) assert.match(hardenedMigration, pattern);
assert.doesNotMatch(hardenedMigration, /pg_get_functiondef/);
assert.doesNotMatch(hardenedMigration, /function_definition := replace/);

const packageJson = JSON.parse(packageText);
assert.equal(packageJson.scripts.build, "npm run test:contracts && vite build");
assert.equal(packageJson.scripts.check, "npm run build");
assert.equal(packageJson.scripts.prebuild, undefined);
assert.equal(packageJson.scripts["pretest:contracts"], undefined);
assert.equal(packageJson.scripts["prepare:skills-matrix"], undefined);
assert.match(packageJson.scripts["repair:legacy-workflows"], /apply-equipment-people-workflow-fix/);

console.log("Equipment → people → training workflow contracts passed.");
