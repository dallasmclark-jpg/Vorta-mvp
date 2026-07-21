import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

async function loadTypeScriptModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = await transform(source, {
    loader: "ts",
    format: "esm",
    target: "es2020",
  });
  const url = `data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`;
  return import(url);
}

const access = await loadTypeScriptModule("../src/lib/accessControl.ts");
const contracts = await loadTypeScriptModule("../src/lib/runtimeContracts.ts");

assert.equal(access.normalisePilotRole("Maintenance Manager"), "maintenance_manager");
assert.equal(access.normalisePilotRole("site-admin"), "site_admin");
assert.equal(access.normalisePilotRole("unsupported"), null);

assert.equal(access.roleHomePath("engineer"), "/engineer/dashboard");
assert.equal(access.roleHomePath("maintenance_manager"), "/dashboard");
assert.equal(access.canAccessPath("maintenance_manager", "/dashboard"), true);
assert.equal(access.canAccessPath("maintenance_manager", "/engineer/dashboard"), false);
assert.equal(access.canAccessPath("engineer", "/engineer/dashboard"), true);
assert.equal(access.canAccessPath("engineer", "/dashboard"), false);
assert.equal(access.canAccessPath("vorta_admin", "/operator/dashboard"), true);
assert.equal(access.canAdministerPilot("maintenance_manager", false), false);
assert.equal(access.canAdministerPilot("site_admin", false), true);
assert.equal(access.canImportSapData("maintenance_manager", false), false);
assert.equal(access.canImportSapData("vorta_admin", false), true);

const operationalPayload = {
  areaProfiles: [{ area: "Fill Finish", riskScore: 74 }],
  siteRisk: { riskScore: 62 },
  scopes: [{ scopeKey: "site", scopeLabel: "Site Risk", riskScore: 62 }],
  freshness: {
    maintenanceDataAt: "2026-07-18T09:00:00Z",
    workforceDataAt: "2026-07-18T09:00:00Z",
    riskCalculatedAt: "2026-07-18T09:05:00Z",
  },
};
assert.equal(
  contracts.validateOperationalDashboardPayload(operationalPayload),
  operationalPayload,
);
assert.deepEqual(contracts.parseDashboardFreshness(operationalPayload.freshness), {
  maintenanceDataAt: "2026-07-18T09:00:00Z",
  workforceDataAt: "2026-07-18T09:00:00Z",
  riskCalculatedAt: "2026-07-18T09:05:00Z",
});
assert.throws(
  () => contracts.validateOperationalDashboardPayload({ areaProfiles: [], scopes: [] }),
  contracts.RuntimeContractError,
);

const siteId = "11000000-0000-0000-0000-000000000001";
const organisationId = "10000000-0000-0000-0000-000000000001";
const skillsPayload = {
  siteId,
  organisationId,
  generatedAt: "2026-07-18T09:00:00Z",
  sourceUpdatedAt: "2026-07-18T08:00:00Z",
  site: { id: siteId, name: "Demo Site" },
  overall: {},
  teams: [],
  departments: [],
  areaSkills: {},
  details: {},
};
assert.equal(contracts.validateSkillsMatrixPayload(skillsPayload), skillsPayload);
assert.throws(
  () => contracts.validateSkillsMatrixPayload({ generatedAt: "" }),
  contracts.RuntimeContractError,
);
assert.throws(
  () => contracts.validateSkillsMatrixPayload({ ...skillsPayload, site: { id: "site-2", name: "Other Site" } }),
  contracts.RuntimeContractError,
);

const requirementsPayload = {
  siteId,
  organisationId,
  generatedAt: "2026-07-18T09:00:00Z",
  requirements: [],
  coverageByGroup: [],
  certExpiries: [],
  actionRows: [],
  departments: [],
  stats: {
    totalReqs: 0,
    fullyCovered: 0,
    skillsAtRisk: 0,
    criticalGaps: 0,
  },
};
assert.equal(
  contracts.validateRequirementsPayload(requirementsPayload),
  requirementsPayload,
);
assert.throws(
  () => contracts.validateRequirementsPayload({ requirements: [] }),
  contracts.RuntimeContractError,
);

const operations = await readFile(
  new URL("../src/screens/AiOperations/AiOperations.tsx", import.meta.url),
  "utf8",
);
const app = await readFile(new URL("../src/index.tsx", import.meta.url), "utf8");

for (const route of [
  "dashboard",
  "equipment",
  "skills-matrix",
  "pilot-impact",
  "pilot-adoption",
  "settings/pilot-setup",
  "settings/data-import",
]) {
  assert.match(operations, new RegExp(`path=["']${route.replace("/", "\\/")}`));
}
assert.match(operations, /canImportSapData/);
assert.match(operations, /<Navigate to="\/dashboard" replace \/>/);
assert.match(app, /role="engineer"/);
assert.match(app, /role="maintenance_planner"/);
assert.match(app, /"maintenance_manager"/);
assert.match(app, /"site_admin"/);

console.log("Runtime and route smoke tests passed.");
