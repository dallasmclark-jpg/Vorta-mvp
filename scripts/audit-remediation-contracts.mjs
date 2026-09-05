import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Keep the audit's architectural safeguards executable, not merely documented.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const indexHtml = read("index.html");
const portalHardening = read("src/components/MaintenancePortalHardening.tsx");
const portalShell = read("src/components/PortalShell.tsx");
const dashboard = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
const dashboardNotice = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardEvidenceNotice.tsx",
);
const riskMeter = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/RiskMeter.tsx",
);
const labourRiskSection = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/LabourRiskSection.tsx",
);
const equipmentService = read("src/screens/Equipment/equipmentService.ts");
const riskRouting = read("src/screens/AiOperations/riskActionRouting.ts");
const shiftService = read("src/screens/LabourRisk/shiftCoverService.ts");
const aiOperations = read("src/screens/AiOperations/AiOperations.tsx");
const assistant = read(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx",
);
const supabaseClient = read("src/lib/supabaseClient.ts");
const browserWorkflow = read(".github/workflows/maintenance-manager-quality.yml");
const engineerPortal = read("src/screens/EngineerPortal/EngineerPortal.tsx");
const engineerIdentity = read("src/screens/EngineerPortal/engineerIdentity.ts");
const engineerSkills = read("src/screens/EngineerPortal/EngineerSkillsLiveScreens.tsx");
const engineerWork = read("src/screens/EngineerPortal/EngineerWorkLiveScreens.tsx");
const engineerEquipment = read("src/screens/EngineerPortal/EngineerEquipmentLiveScreens.tsx");
const engineerSkillsFunction = read("supabase/functions/engineer-skills-data/index.ts");
const engineerWorkFunction = read("supabase/functions/engineer-work-data/index.ts");
const engineerEquipmentFunction = read("supabase/functions/engineer-equipment-data/index.ts");

for (const retired of [
  ".github/workflows/audit-apply-patch.yml",
  ".github/workflows/audit-source-export.yml",
  "src/lib/equipmentDocumentNavigationInterceptor.ts",
  "src/lib/workforceProfilePhotos.ts",
  "src/lib/vortaAiLauncherEnhancement.ts",
  "src/lib/vortaAiPanelEnhancement.ts",
  "src/lib/vortaAiPanelMinimiseFix.ts",
  "src/lib/vortaAiPanelFinalCleanup.ts",
  "src/lib/vortaAiGenericFaultBridge.ts",
  "src/lib/vortaAiFaultIntelligence.ts",
]) {
  assert.equal(existsSync(new URL(`../${retired}`, import.meta.url)), false, `${retired} must be retired`);
}

assert.doesNotMatch(indexHtml, /:has\(|nth-child|equipmentDocumentNavigationInterceptor|workforceProfilePhotos/);
assert.doesNotMatch(portalHardening, /:has\(|nth-child|\[class\*=/);
assert.match(portalHardening, /data-vorta-desktop-sidebar/);
assert.match(portalShell, /data-vorta-sidebar-label/);

assert.match(shiftService, /snapshot.siteId does not match/);
assert.match(shiftService, /dateOnlyTimestamp/);
assert.match(shiftService, /finiteNumber/);
assert.match(shiftService, /labourRiskScore/);
assert.match(shiftService, /duplicate day or night shifts/);

assert.match(dashboard, /Promise\.allSettled/);
assert.match(dashboard, /lastSuccessfulSnapshotAt/);
assert.match(dashboard, /riskActionsDisabled/);
assert.match(dashboardNotice, /data-vorta-dashboard-evidence-state/);
assert.match(riskMeter, /prefers-reduced-motion/);
assert.match(dashboard, /<LabourRiskSection/);
assert.match(labourRiskSection, /data-vorta-labour-risk-card/);
assert.match(equipmentService, /RiskActionTarget/);
assert.match(equipmentService, /getAreaInterventionPlansStrict/);
assert.match(riskRouting, /action\.target/);
assert.doesNotMatch(riskRouting, /includes\("skill"\)|includes\("spare"\)/);

assert.match(aiOperations, /const SkillsMatrixRouteEntry = lazy/);
assert.match(aiOperations, /const EquipmentWorkOrders = lazy/);
assert.match(aiOperations, /<Suspense fallback=\{<RouteLoader \/>\}>/);
assert.doesNotMatch(assistant, /MutationObserver|stopImmediatePropagation|document\.querySelector/);

assert.match(supabaseClient, /signal\?: AbortSignal/);
assert.match(supabaseClient, /signal:\s*invocationSignal\(options\)/);
assert.match(supabaseClient, /invocationSignal\(options\)\?\.aborted/);

// Engineer portal audit contracts: active routes must be live-only and self/site scoped.
assert.match(engineerPortal, /EngineerSkillsLiveScreens/);
assert.match(engineerPortal, /EngineerWorkLiveScreens/);
assert.match(engineerPortal, /EngineerEquipmentLiveScreens/);
assert.doesNotMatch(engineerPortal, /EngineerCoreScreens|EngineerStoresEquipmentFilter/);
assert.doesNotMatch(engineerSkills, /DEMO_|MOCK_|skills-matrix-data|engineers-data/);
assert.doesNotMatch(engineerWork, /DEMO_|MOCK_|\.from\("work_orders"\)/);
assert.doesNotMatch(engineerEquipment, /DEMO_|MOCK_|getEquipmentList|getEquipmentComponents/);
assert.match(engineerSkills, /engineer-skills-data/);
assert.match(engineerWork, /engineer-work-data/);
assert.match(engineerEquipment, /engineer-equipment-data/);
assert.match(engineerIdentity, /\.eq\("profile_id", profileId\)/);
assert.doesNotMatch(engineerIdentity, /loadEngineerByExactName|exact-name identity|full-name identity/);

for (const endpoint of [
  engineerSkillsFunction,
  engineerWorkFunction,
  engineerEquipmentFunction,
]) {
  assert.match(endpoint, /\.eq\("profile_id", user\.id\)/);
  assert.match(endpoint, /\.from\("user_site_access"\)/);
  assert.match(endpoint, /roleKey\(access\.app_role\) !== "engineer"/);
  assert.doesNotMatch(endpoint, /user_metadata.*engineer_id|raw_user_meta_data.*engineer_id/);
}
assert.match(engineerWorkFunction, /\.eq\("site_id", siteId\)/);
assert.match(engineerWorkFunction, /\.ilike\("assigned_engineer", String\(engineer\.full_name\)\)/);
assert.match(engineerEquipmentFunction, /\.eq\("organisation_id", profile\.organisation_id\)/);

assert.match(browserWorkflow, /maintenance-manager-work-orders\.spec\.ts/);
assert.match(browserWorkflow, /maintenance-manager-dashboard-resilience\.spec\.ts/);
assert.match(browserWorkflow, /maintenance-manager-visual\.spec\.ts/);

console.log("Audit remediation contracts passed.");
