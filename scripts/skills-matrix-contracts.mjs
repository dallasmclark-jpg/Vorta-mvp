import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const page = await readFile(
  new URL("../src/screens/SkillsMatrix/SkillsMatrixNative.tsx", import.meta.url),
  "utf8",
);
const runtimeContracts = await readFile(
  new URL("../src/lib/runtimeContracts.ts", import.meta.url),
  "utf8",
);
const engineersPage = await readFile(
  new URL("../src/screens/Engineers/EngineersSection.tsx", import.meta.url),
  "utf8",
);
const requirementsPage = await readFile(
  new URL("../src/screens/Requirements/RequirementsSection.tsx", import.meta.url),
  "utf8",
);
const trainingPage = await readFile(
  new URL("../src/screens/Training/TrainingSection.tsx", import.meta.url),
  "utf8",
);
const entry = await readFile(
  new URL("../src/screens/SkillsMatrix/index.ts", import.meta.url),
  "utf8",
);
const compatibilityEntry = await readFile(
  new URL("../src/screens/SkillsMatrix/SkillsMatrixIntelligenceBootstrap.tsx", import.meta.url),
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
const functionIndex = await readFile(
  new URL("../supabase/functions/skills-matrix-data/index.ts", import.meta.url),
  "utf8",
);
const functionAuth = await readFile(
  new URL("../supabase/functions/skills-matrix-data/auth.ts", import.meta.url),
  "utf8",
);
const functionTransform = await readFile(
  new URL("../supabase/functions/skills-matrix-data/transform.ts", import.meta.url),
  "utf8",
);
const functionAssetExperience = await readFile(
  new URL("../supabase/functions/skills-matrix-data/transform-asset-experience.ts", import.meta.url),
  "utf8",
);
const functionAnalysis = await readFile(
  new URL("../supabase/functions/skills-matrix-data/transform-analysis.ts", import.meta.url),
  "utf8",
);
const functionScopes = await readFile(
  new URL("../supabase/functions/skills-matrix-data/transform-scopes.ts", import.meta.url),
  "utf8",
);
const experienceMigration = await readFile(
  new URL("../supabase/migrations/20260722103718_add_pm_experience_evidence.sql", import.meta.url),
  "utf8",
);
const experienceIndexMigration = await readFile(
  new URL("../supabase/migrations/20260722104725_index_pm_experience_foreign_keys.sql", import.meta.url),
  "utf8",
);

for (const requiredText of [
  "By Team",
  "By Department",
  "Capability intelligence",
  "Priority Coverage Weaknesses",
  "People &amp; Experience",
  "Site-wide Maintenance",
  "Highest-risk capability",
  "Coverage status",
  "Recorded action gain",
  "All Site",
  "skills-matrix-people-scroll",
  "View all ${selectedDetail.priorityRisks.length} weaknesses",
  "sourceUpdatedAt",
  "areaSkills",
  "avatarUrl: string | null",
  "engineer.avatarUrl",
  "Find engineer",
  "View requirement",
  "Open training plan",
  "useSearchParams",
  "Showing:",
  "Clear filters",
]) {
  assert.match(
    page,
    new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Native Skills Matrix must retain ${requiredText}`,
  );
}

assert.match(page, /schemaVersion: "capability-v3"/);
assert.match(page, /normaliseSkillsMatrixPayload/);
assert.match(page, /validateSkillsMatrixPayload\(payload\)/);
assert.doesNotMatch(page, /return payload;/);
assert.match(page, /clearMaintenancePortalDataCache\(SKILLS_MATRIX_FUNCTION\)/);
assert.match(page, /Skills capability data could not be loaded/);
assert.match(page, /new Set\(risks\.map\(\(risk\) => risk\.equipmentId\)\)/);
assert.match(page, /risks\.filter\(\(risk\) => risk\.singlePoint\)\.length/);
assert.match(page, /selectedArea === ALL_SITE/);
assert.match(page, /skillIds\.has\(skill\.id\)/);
assert.match(page, /equipmentPriorityRisks\.slice\(0, 3\)/);
assert.match(page, /\["pending", "rejected", "expired"\]/);
assert.match(page, /searchParams\.get\("view"\)/);
assert.match(page, /searchParams\.get\("scope"\)/);
assert.match(page, /searchParams\.get\("area"\)/);
assert.match(page, /searchParams\.get\("priority"\)/);
assert.match(page, /searchParams\.get\("skill"\)/);
assert.match(page, /setSearchParams\(\(current\)/);
assert.match(page, /\/engineers\?engineer=/);
assert.match(page, /\/engineers\?skill=/);
assert.match(page, /\/requirements\?skill=/);
assert.match(page, /\/training\?skill=/);
assert.match(page, /View requirement <Award className="h-3 w-3" \/>/);
assert.match(page, /Open training plan <Wrench className="h-3 w-3" \/>/);
assert.doesNotMatch(page, /ClipboardList|GraduationCap/);
assert.match(
  page,
  /useEffect\(\(\) => \{\s*setShowAllWeaknesses\(false\);\s*\}, \[selectedScopeId\]\);/,
);
assert.match(
  page,
  /navigate\(`\/equipment\/\$\{encodeURIComponent\(risk\.equipmentId\)\}\/skills`\)/,
);
assert.doesNotMatch(page, /\.from\("engineers"\)/);
assert.doesNotMatch(page, /\.from\("equipment_assets"\)/);
assert.doesNotMatch(page, /\.from\("equipment_required_skills"\)/);
assert.doesNotMatch(page, /criticalTeamShare \* 12/);
assert.doesNotMatch(page, /score = Math\.min\(score, 59\)/);

assert.match(engineersPage, /useSearchParams/);
assert.match(engineersPage, /searchParams\.get\("engineer"\)/);
assert.match(engineersPage, /searchParams\.get\("skill"\)/);
assert.match(engineersPage, /assignment\.skill_id === skillFilterId/);
assert.match(engineersPage, /setSelectedEngineer\(match\)/);
assert.match(engineersPage, /Skill: \{skillFilterName\}/);
assert.match(engineersPage, /next\.delete\("engineer"\)/);

assert.match(requirementsPage, /useSearchParams/);
assert.match(requirementsPage, /searchParams\.get\("skill"\)/);
assert.match(requirementsPage, /requirement\.title\.trim\(\)\.toLowerCase\(\) === requestedSkill/);
assert.match(requirementsPage, /setSelectedReq\(match\)/);
assert.match(requirementsPage, /closeRequirement/);

assert.match(trainingPage, /useSearchParams/);
assert.match(trainingPage, /searchParams\.get\("skill"\)/);
assert.match(trainingPage, /searchParams\.get\("priority"\)/);
assert.match(trainingPage, /Training plan focus/);
assert.match(trainingPage, /clearTrainingFocus/);
assert.match(trainingPage, /Priority gaps and recommendations are filtered/);

assert.match(runtimeContracts, /requireStringField\(payload, "siteId", contract\)/);
assert.match(runtimeContracts, /requireStringField\(payload, "organisationId", contract\)/);
assert.match(runtimeContracts, /responseSiteId !== siteId/);
assert.match(functionIndex, /avatar_url/);
assert.match(functionIndex, /\.eq\("site_id", siteId\)/);
assert.match(functionIndex, /\.eq\("organisation_id", organisationId\)/);
assert.match(functionIndex, /siteId,[\s\S]*organisationId,[\s\S]*\.\.\.payload/);
assert.match(functionIndex, /import \{ context, preflight, response \}/);
assert.match(functionIndex, /\.from\("preventive_maintenance"\)/);
assert.match(functionIndex, /\.from\("engineer_pm_experience_snapshots"\)/);
assert.match(functionIndex, /preventiveMaintenance: preventiveMaintenanceResult\.data/);
assert.match(functionIndex, /pmExperience: pmExperienceResult\.data/);
assert.match(functionIndex, /skill_type,ai_weight/);
assert.match(functionAuth, /authClient\.auth\.getUser\(token\)/);
assert.match(functionAuth, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(functionAuth, /\.from\("user_site_access"\)/);
assert.match(functionAuth, /ALLOWED_ROLES\.has\(role\)/);
assert.match(functionAuth, /http:\/\/127\.0\.0\.1:4173/);
assert.doesNotMatch(functionAuth, /vorta_get_function_context/);
assert.doesNotMatch(functionAuth, /Access-Control-Allow-Origin"\s*:\s*"\*"/);
assert.match(functionTransform, /criticalTeamShare \* 12/);
assert.match(functionTransform, /overallScore = Math\.min\(overallScore, 59\)/);
assert.match(functionTransform, /sourceUpdatedAt/);
assert.match(functionTransform, /areaSkills/);
assert.match(functionTransform, /buildCapabilityPreview/);
assert.match(functionTransform, /row\.detail\.capabilityPreview = preview\.detail/);
assert.match(functionAnalysis, /skillsCoverage \* 0\.45/);
assert.match(functionAnalysis, /experienceDepth \* 0\.2/);
assert.match(functionAnalysis, /smeResilience \* 0\.2/);
assert.match(functionAnalysis, /validationHealth \* 0\.15/);
assert.match(functionAnalysis, /criticalGaps = priorityRisks\.filter/);
assert.match(functionAnalysis, /spofCount = priorityRisks\.filter/);
assert.match(functionAnalysis, /avatarUrl: engineer\.avatar_url/);
assert.match(functionScopes, /name: "Calibration Team"/);
assert.match(functionScopes, /name: "Operational Technology Team"/);
assert.match(functionScopes, /explicitSpecialists/);
assert.match(functionScopes, /explicitMemberIds\(calibrationTeam\.id\)/);
assert.match(functionScopes, /explicitMemberIds\(otTeam\.id\)/);

assert.match(functionAssetExperience, /const PREVIEW_MODEL = "core-asset-preview-v1"/);
assert.match(functionAssetExperience, /lower\(row\.skill_type\) === "technical"/);
assert.match(functionAssetExperience, /experience_score/);
assert.match(functionAssetExperience, /recency_factor/);
assert.match(functionAssetExperience, /coreCapabilityScore \* 0\.4 \+ assetCompetenceScore \* 0\.6/);
assert.match(functionAssetExperience, /previewOnly: true/);
assert.match(functionAssetExperience, /scoreAuthority: "current-capability-v3"/);
assert.match(functionAssetExperience, /proposedSkillsReadinessScore/);
assert.match(functionAssetExperience, /pmExperienceCoverage/);
assert.match(functionAssetExperience, /confirmedPmCount/);

assert.match(experienceMigration, /create table if not exists public\.engineer_source_identities/);
assert.match(experienceMigration, /create table if not exists public\.engineer_pm_experience_snapshots/);
assert.match(experienceMigration, /alter table public\.engineer_source_identities enable row level security/);
assert.match(experienceMigration, /alter table public\.engineer_pm_experience_snapshots enable row level security/);
assert.match(experienceMigration, /private\.vorta_rls_has_site_access/);
assert.match(experienceMigration, /private\.vorta_rls_has_engineer_access/);
assert.match(experienceMigration, /private\.vorta_rls_has_equipment_access/);
assert.match(experienceMigration, /where confirmation\.reversal = false/);
assert.match(experienceMigration, /least\(count\(\*\), 5\)::smallint as experience_score/);
assert.match(experienceMigration, /group by[\s\S]*line\.work_order_id/);
assert.match(experienceMigration, /revoke all on function private\.vorta_refresh_engineer_pm_experience\(uuid\)/);
assert.match(experienceMigration, /grant execute on function private\.vorta_refresh_engineer_pm_experience\(uuid\)[\s\S]*to service_role/);
assert.doesNotMatch(experienceMigration, /grant execute[\s\S]*to authenticated/);
assert.match(experienceIndexMigration, /engineer_pm_experience_engineer_fk_idx/);
assert.match(experienceIndexMigration, /engineer_pm_experience_equipment_fk_idx/);
assert.match(experienceIndexMigration, /engineer_source_identities_verified_by_idx/);
assert.match(experienceIndexMigration, /engineer_source_identities_import_batch_idx/);

assert.match(entry, /\.\/SkillsMatrixNative/);
assert.match(compatibilityEntry, /\.\/SkillsMatrixNative/);
assert.match(warmup, /schemaVersion: "capability-v3"/);
assert.match(prefetch, /schemaVersion: "capability-v3"/);

for (const forbidden of [
  "MutationObserver",
  "createPortal",
  "scrollIntoView",
  "window.scrollTo",
  "__vortaSkillsMatrixPayload",
  "vorta:skills-matrix-polished-payload",
  "SkillsMatrixSelectionExperience",
  "SkillsMatrixPolished",
  "SkillsMatrixResolvedExperience",
]) {
  assert.doesNotMatch(
    page + entry + compatibilityEntry,
    new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Native Skills Matrix must not use ${forbidden}`,
  );
}

for (const obsolete of [
  "SkillsMatrixSection.tsx",
  "SkillsMatrixResolvedExperience.tsx",
  "SkillsMatrixStableBootstrap.tsx",
  "SkillsMatrixSelectionExperience.tsx",
  "SkillsMatrixPolished.tsx",
]) {
  await assert.rejects(
    access(new URL(`../src/screens/SkillsMatrix/${obsolete}`, import.meta.url)),
    undefined,
    `${obsolete} must be removed after native consolidation`,
  );
}

console.log("Skills Matrix native, PM evidence and preview contracts passed.");
