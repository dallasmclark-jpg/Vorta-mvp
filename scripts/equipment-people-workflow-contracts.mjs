import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  service,
  skillsPage,
  dashboard,
  assistant,
  engineers,
  requirements,
  training,
  matrix,
  migration,
] = await Promise.all([
  read("src/screens/Equipment/equipmentService.ts"),
  read("src/screens/Equipment/EquipmentSkillsIntelligence.tsx"),
  read(
    "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
  ),
  read("src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx"),
  read("src/screens/Engineers/EngineersSection.tsx"),
  read("src/screens/Requirements/RequirementsSection.tsx"),
  read("src/screens/Training/TrainingSection.tsx"),
  read("src/screens/SkillsMatrix/SkillsMatrixNative.tsx"),
  read(
    "supabase/migrations/20260717192000_enrich_equipment_skill_evidence.sql",
  ),
]);

for (const required of [
  "EquipmentSkillEngineerEvidence",
  "qualifiedEngineers",
  "nearestEngineers",
  "singlePointOfFailure",
  "validationGap",
  "avatarUrl",
]) {
  assert.match(
    service,
    new RegExp(required),
    `equipment service must expose ${required}`,
  );
}

for (const required of [
  "Open Skills Matrix",
  "Find engineer",
  "Qualified engineers",
  "Nearest to qualified",
  "SPOF",
  'from: "equipment-skills"',
  "returnTo",
  "/skills-matrix?",
  "/engineers?",
  "/requirements?",
  "/training?",
]) {
  assert.match(
    skillsPage,
    new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
}
assert.match(skillsPage, /View\s+requirement/);
assert.match(skillsPage, /Open\s+training plan/);
assert.match(skillsPage, /person\.engineerId/);
assert.match(skillsPage, /person\.validationStatus/);
assert.match(skillsPage, /skill\.qualifiedEngineers/);
assert.match(skillsPage, /skill\.nearestEngineers/);

assert.match(dashboard, /getLabourRiskWorkflowRoute/);
assert.match(dashboard, /\/skills-matrix\?/);
assert.match(dashboard, /\/training\?/);
assert.match(dashboard, /returnTo: "\/dashboard"/);
assert.match(dashboard, /from: "dashboard"/);

assert.match(assistant, /from: "ask-vorta"/);
assert.match(assistant, /returnTo/);
assert.match(assistant, /engineer: primary\.id/);
assert.match(assistant, /engineer: engineer\.id/);
assert.match(assistant, /Open capability evidence/);
assert.match(
  assistant,
  /\/equipment\/\$\{encodeURIComponent\(equipmentId\)\}\/skills/,
);

for (const page of [engineers, requirements, training, matrix]) {
  assert.match(page, /searchParams\.get\("returnTo"\)/);
  assert.match(page, /navigate\(returnTo\)/);
}
assert.match(engineers, /searchParams\.get\("engineer"\)/);
assert.match(engineers, /searchParams\.get\("skill"\)/);
assert.match(requirements, /searchParams\.get\("skill"\)/);
assert.match(training, /searchParams\.get\("skill"\)/);
assert.match(matrix, /searchParams\.get\("skill"\)/);

assert.match(migration, /private\.vorta_rls_has_equipment_access/);
assert.match(
  migration,
  /join public\.sites site on site\.id = equipment\.site_id/,
);
assert.match(migration, /qualified_engineers/);
assert.match(migration, /nearest_engineers/);
assert.match(migration, /single_point_of_failure/);
assert.match(migration, /validation_gap/);
assert.doesNotMatch(migration, /SUPABASE_SERVICE_ROLE_KEY/);

console.log("Equipment to people workflow contracts passed.");
