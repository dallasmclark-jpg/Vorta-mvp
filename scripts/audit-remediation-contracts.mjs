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
const engineerSkillsList = read("src/screens/EngineerPortal/EngineerSkillsLiveScreens.tsx");
const engineerSkillsWorkflow = read("src/screens/EngineerPortal/EngineerSkillsWorkflowScreens.tsx");
const engineerEquipmentCompetency = read("src/screens/EngineerPortal/EngineerEquipmentCompetencyScreen.tsx");
const competencyReviewPanel = read("src/screens/EngineerPortal/EquipmentCompetencyReviewPanel.tsx");
const skillsMatrixRoute = read("src/screens/AiOperations/SkillsMatrixRouteEntry.tsx");
const engineerWork = read("src/screens/EngineerPortal/EngineerWorkLiveScreens.tsx");
const engineerEquipment = read("src/screens/EngineerPortal/EngineerEquipmentLiveScreens.tsx");
const engineerSkillsFunction = read("supabase/functions/engineer-skills-data/index.ts");
const engineerSkillSelfAssessmentFunction = read("supabase/functions/engineer-skill-self-assessment/index.ts");
const engineerEquipmentSelfAssessmentFunction = read("supabase/functions/engineer-equipment-self-assessment/index.ts");
const competencyReviewDataFunction = read("supabase/functions/equipment-competency-review-data/index.ts");
const competencyAssessmentFunction = read("supabase/functions/equipment-competency-assessment/index.ts");
const competencyLifecycleMigration = read(
  "supabase/migrations/20260905193114_engineer_competency_pending_review_lifecycle.sql",
);
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
assert.match(engineerPortal, /EngineerSkillsWorkflowScreens/);
assert.match(engineerPortal, /EngineerSkillsWorkflowScreen/);
assert.match(engineerPortal, /EngineerSkillSelfAssessmentScreen/);
assert.match(engineerPortal, /EngineerEquipmentCompetencyScreen/);
assert.match(engineerPortal, /skills\/equipment\/:equipmentId/);
assert.match(engineerPortal, /EngineerWorkLiveScreens/);
assert.match(engineerPortal, /EngineerEquipmentLiveScreens/);
assert.doesNotMatch(engineerPortal, /EngineerCoreScreens|EngineerStoresEquipmentFilter|EngineerSkillDetailScreen/);
assert.doesNotMatch(engineerSkillsList, /DEMO_|MOCK_|skills-matrix-data|engineers-data/);
assert.doesNotMatch(engineerWork, /DEMO_|MOCK_|\.from\("work_orders"\)/);
assert.doesNotMatch(engineerEquipment, /DEMO_|MOCK_|getEquipmentList|getEquipmentComponents/);
assert.match(engineerSkillsList, /engineer-skills-data/);
assert.match(engineerSkillsWorkflow, /engineer-skills-data/);
assert.match(engineerSkillsWorkflow, /engineer-skill-self-assessment/);
assert.doesNotMatch(engineerSkillsWorkflow, /\.from\("engineer_skills"\)[\s\S]*?\.update\(/);
assert.match(engineerEquipmentCompetency, /engineer-equipment-self-assessment/);
assert.match(engineerEquipmentCompetency, /authoritative|independent review/i);
assert.match(competencyReviewPanel, /equipment-competency-review-data/);
assert.match(competencyReviewPanel, /assessmentId:\s*item\.id/);
assert.match(competencyReviewPanel, /action:\s*"validate"|review\(item, "validate"\)/);
assert.match(competencyReviewPanel, /review\(item, "reject"\)/);
assert.match(skillsMatrixRoute, /EquipmentCompetencyReviewPanel/);
assert.match(skillsMatrixRoute, /maintenance_manager/);
assert.match(engineerWork, /engineer-work-data/);
assert.match(engineerEquipment, /engineer-equipment-data/);
assert.match(engineerIdentity, /\.eq\("profile_id", profileId\)/);
assert.doesNotMatch(engineerIdentity, /loadEngineerByExactName|exact-name identity|full-name identity/);

for (const endpoint of [
  engineerSkillsFunction,
  engineerWorkFunction,
  engineerEquipmentFunction,
]) {
  assert.match(endpoint, /\.eq\("profile_id",\s*user\.id\)/);
  assert.match(endpoint, /\.from\("user_site_access"\)/);
  assert.match(endpoint, /roleKey\(access\.app_role\)\s*!==\s*"engineer"/);
  assert.doesNotMatch(endpoint, /user_metadata.*engineer_id|raw_user_meta_data.*engineer_id/);
}
assert.match(engineerWorkFunction, /\.eq\("site_id", siteId\)/);
assert.match(engineerWorkFunction, /\.ilike\("assigned_engineer", String\(engineer\.full_name\)\)/);
assert.match(engineerEquipmentFunction, /\.eq\("organisation_id", profile\.organisation_id\)/);

// SKL-004: self-assessment must be pending evidence, never an authoritative browser write.
assert.match(engineerSkillSelfAssessmentFunction, /\.eq\("profile_id",\s*user\.id\)/);
assert.match(engineerSkillSelfAssessmentFunction, /verification_status:\s*"pending"/);
assert.match(engineerSkillSelfAssessmentFunction, /verified_by:\s*null/);
assert.doesNotMatch(engineerSkillSelfAssessmentFunction, /manager_rating|validated_rating/);
assert.match(competencyLifecycleMigration, /revoke update \(self_rating\).*authenticated/is);

// SKL-005: equipment competency follows proposal -> authorised review -> audited validation/rejection.
assert.match(competencyLifecycleMigration, /equipment_competency_one_pending_idx/);
assert.match(competencyLifecycleMigration, /assessment_status in \('pending','validated','rejected','superseded'\)/);
assert.match(competencyLifecycleMigration, /reviewed_by_profile_id/);
assert.match(competencyLifecycleMigration, /reviewed_by_engineer_id/);
assert.match(competencyLifecycleMigration, /review_outcome/);
assert.match(competencyLifecycleMigration, /assessor_authority[\s\S]*'SELF'/);
assert.match(engineerEquipmentSelfAssessmentFunction, /vorta_submit_equipment_competency_self_assessment/);
assert.match(engineerEquipmentSelfAssessmentFunction, /authoritativeCapabilityUnchanged:\s*true/);
assert.match(competencyReviewDataFunction, /MANAGER_ROLES/);
assert.match(competencyReviewDataFunction, /QUALIFIED_PEER/);
assert.match(competencyReviewDataFunction, /practice_authority/);
assert.match(competencyAssessmentFunction, /pendingAssessment\?\.assessor_profile_id\s*===\s*user\.id|pendingAssessment\?\.assessor_profile_id===user\.id/);
assert.match(competencyAssessmentFunction, /vorta_reject_equipment_competency_self_assessment/);
assert.match(competencyAssessmentFunction, /vorta_apply_equipment_competency_assessment/);
assert.match(competencyAssessmentFunction, /vorta_refresh_engineer_equipment_scores/);

assert.match(browserWorkflow, /maintenance-manager-work-orders\.spec\.ts/);
assert.match(browserWorkflow, /maintenance-manager-dashboard-resilience\.spec\.ts/);
assert.match(browserWorkflow, /maintenance-manager-visual\.spec\.ts/);

console.log("Audit remediation contracts passed.");
