import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gate = readFileSync("src/components/PrototypePortalUnavailable.tsx", "utf8");
const production = readFileSync(
  "src/screens/ProductionManager/ProductionManagerPortal.tsx",
  "utf8",
);
const operator = readFileSync(
  "src/screens/OperatorPortal/OperatorPortal.tsx",
  "utf8",
);
const contractor = readFileSync(
  "src/screens/ContractorPortal/ContractorPortal.tsx",
  "utf8",
);
const browser = readFileSync(
  "tests/browser/vor-071-future-role-data-truth.spec.ts",
  "utf8",
);

for (const required of [
  "Prototype · non-operational",
  "Operational data is not connected for this role yet",
  "No approved live role-specific data feed is connected to this view",
  "No sync time, confidence score or operational KPI is being inferred",
  "authenticated organisation, site and role boundary remains enforced",
]) {
  assert.ok(gate.includes(required), `Future-role truth gate is missing: ${required}`);
}

assert.doesNotMatch(
  gate,
  /SyncIndicator|Date\.now\(|syncedAt=|confidence=|CountUpNumber|AnimatedProgress/,
  "The unavailable state must not manufacture freshness, confidence or operational metrics",
);

const portalContracts = [
  {
    label: "Production Manager",
    source: production,
    assistantRole: 'role="production-manager"',
    forbiddenImports: [
      "ProductionManagerDashboard",
      "ProductionShiftCoverageSection",
      "ProductionOperatorsSection",
      "ProductionSkillsMatrixSection",
      "ProductionTrainingSection",
      "ProductionComplianceSection",
      "ProductionRiskSection",
      "ProductionAiImprovementsSection",
      "ProductionSettingsSection",
    ],
  },
  {
    label: "Operator",
    source: operator,
    assistantRole: 'role="operator"',
    forbiddenImports: [
      "OperatorDashboardSection",
      "OperatorMyShiftSection",
      "OperatorMySkillsSection",
      "OperatorTrainingSection",
      "OperatorComplianceSection",
      "OperatorTasksSection",
      "OperatorAiGuidanceSection",
      "OperatorKnowledgeBaseSection",
      "OperatorProfileSettingsSection",
    ],
  },
  {
    label: "Contractor",
    source: contractor,
    assistantRole: 'role="contractor"',
    forbiddenImports: [
      "ContractorDashboardSection",
      "CompanyProfileSection",
      "ContractorEngineersSection",
      "ContractorAvailabilitySection",
      "ContractorOpportunitiesSection",
      "ContractorAssignmentsSection",
      "ContractorJobReportsSection",
      "ContractorTimesheetsSection",
      "ContractorInvoicesSection",
      "ContractorComplianceSection",
      "ContractorAiRecommendationsSection",
      "ContractorSettingsSection",
    ],
  },
];

for (const portal of portalContracts) {
  assert.ok(
    portal.source.includes("PrototypePortalUnavailable"),
    `${portal.label} routes must use the shared honest unavailable state`,
  );
  assert.ok(
    portal.source.includes(portal.assistantRole),
    `${portal.label} must preserve the governed Ask Vorta entry`,
  );
  assert.doesNotMatch(
    portal.source,
    /SyncIndicator|Date\.now\(|syncedAt=|confidence=/,
    `${portal.label} route shell must not manufacture live evidence`,
  );
  for (const forbiddenImport of portal.forbiddenImports) {
    assert.ok(
      !portal.source.includes(`from "./${forbiddenImport}"`),
      `${portal.label} production routes must not import prototype operational section ${forbiddenImport}`,
    );
  }
}

for (const route of [
  "/production/dashboard",
  "/production/risk",
  "/operator/dashboard",
  "/operator/shift",
  "/contractor/dashboard",
  "/contractor/assignments",
]) {
  assert.ok(browser.includes(route), `Authenticated browser coverage is missing ${route}`);
}
for (const required of [
  "Prototype · non-operational",
  "Operational data is not connected for this role yet",
  "Evidence state",
  "Access boundary",
  "expectNoPageOverflow",
]) {
  assert.ok(browser.includes(required), `Browser data-truth proof is missing: ${required}`);
}

console.log(
  "VOR-071 contracts passed: production-reachable future-role routes are explicitly gated from prototype operational evidence while authenticated shells and Ask Vorta access remain intact.",
);
