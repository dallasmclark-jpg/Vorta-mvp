import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [service, equipment, evidence, dashboard, assistant, skills] = await Promise.all([
  read("src/screens/Equipment/equipmentService.ts"),
  read("src/screens/Equipment/EquipmentSkillsIntelligence.tsx"),
  read("src/screens/Equipment/EquipmentRequiredSkillCoverage.tsx"),
  read("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"),
  read("src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx"),
  read("src/screens/SkillsMatrix/SkillsMatrixNative.tsx"),
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

console.log("Equipment → people → training workflow contracts passed.");
