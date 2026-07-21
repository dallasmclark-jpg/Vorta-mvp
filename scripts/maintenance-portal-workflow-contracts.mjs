import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  operations,
  maintenanceExperience,
  dashboard,
  equipmentWorkOrders,
  aiAssistant,
  pilotImpact,
  pilotAdoption,
  pilotSetup,
  pilotSetupHook,
  pilotSetupModel,
  pilotSetupData,
  pilotSetupPeople,
  pilotSetupRehearsal,
  pilotSetupLaunch,
  pilotUsage,
  accessControl,
  runtimeContracts,
] = await Promise.all([
  read("../src/screens/AiOperations/AiOperations.tsx"),
  read("../src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx"),
  read("../src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"),
  read("../src/screens/Equipment/EquipmentWorkOrders.tsx"),
  read("../src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx"),
  read("../src/screens/PilotImpact/PilotImpactSection.tsx"),
  read("../src/screens/PilotAdoption/PilotAdoptionSection.tsx"),
  read("../src/screens/PilotSetup/PilotSetupSection.tsx"),
  read("../src/screens/PilotSetup/usePilotSetup.ts"),
  read("../src/screens/PilotSetup/pilotSetupModel.ts"),
  read("../src/screens/PilotSetup/PilotSetupDataStage.tsx"),
  read("../src/screens/PilotSetup/PilotSetupPeopleStage.tsx"),
  read("../src/screens/PilotSetup/PilotSetupRehearsalStage.tsx"),
  read("../src/screens/PilotSetup/PilotSetupLaunchStage.tsx"),
  read("../src/lib/pilotUsage.ts"),
  read("../src/lib/accessControl.ts"),
  read("../src/lib/runtimeContracts.ts"),
]);

const combinedPilotSetup = [
  pilotSetup,
  pilotSetupHook,
  pilotSetupModel,
  pilotSetupData,
  pilotSetupPeople,
  pilotSetupRehearsal,
  pilotSetupLaunch,
].join("\n");

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);
const mustNotMatch = (source, pattern, message) => assert.doesNotMatch(source, pattern, message);

mustMatch(operations, /groupLabel: "Operations"/, "Daily operations must lead navigation");
mustMatch(operations, /groupLabel: "Pilot evidence"/, "Pilot evidence must be grouped separately");
mustMatch(operations, /label: "Training Plan"/, "Training must remain an operational plan");
mustNotMatch(operations, /label: "Providers"/, "Providers must not return to primary navigation");
mustMatch(operations, /path="training-providers"/, "Providers must remain contextually routable");
mustMatch(operations, /canAdministerPilot\(role, isDemoAdmin\)/, "Pilot Setup must use shared capability control");
mustMatch(operations, /canImportSapData\(role, isDemoAdmin\)/, "SAP import must use shared capability control");
mustMatch(operations, /mayImportSapData[\s\S]*label: "Data Import"/, "Data Import navigation must be gated");
mustMatch(operations, /path="settings\/data-import"[\s\S]*mayImportSapData \?/, "Data Import route must be gated");
mustMatch(operations, /<Navigate to="\/dashboard" replace \/>/, "Unauthorised admin routes must redirect");
mustMatch(accessControl, /role === "site_admin"/, "Site administrators must retain pilot administration");
mustMatch(accessControl, /canImportSapData/, "SAP import capability must be testable independently");

mustMatch(
  operations,
  /const isLivePilotMode =[\s\S]*VITE_VORTA_DATA_MODE/,
  "Maintenance navigation must use the explicit data mode",
);
mustMatch(operations, /const liveNav: NavGroup\[\]/, "Live pilot navigation must be separately declared");
mustMatch(
  operations,
  /nav=\{isLivePilotMode \? liveNav : nav\}/,
  "Portal navigation must switch to the restricted live set",
);
mustMatch(
  operations,
  /data-live-pilot-truth="restricted-route"/,
  "Restricted live routes must present a truth-safe state",
);
mustMatch(
  operations,
  /const liveNav:[\s\S]*label: "Engineers", icon: Users, to: "\/engineers"/,
  "Verified Engineers must be available in live navigation",
);
mustMatch(
  operations,
  /<Route path="engineers" element=\{<EngineersSection \/>\} \/>/,
  "Engineers must route through its data-mode entry rather than a simulated-workflow guard",
);
for (const path of ["career", "training", "training-providers", "ai-matching", "settings", "support"]) {
  mustMatch(
    operations,
    new RegExp(`path="${path}"[\\s\\S]*?isLivePilotMode \\?`),
    `${path} must be guarded in live pilot mode`,
  );
}
mustMatch(
  operations,
  /mailto:support@vorta\.network/,
  "Live pilot support must use a real contact route rather than simulated tickets",
);
mustMatch(
  operations,
  /!isLivePilotMode[\s\S]*label: "Settings"/,
  "Simulated Settings navigation must be withheld in live mode",
);

assert.equal(
  [...pilotImpact.matchAll(/vorta_get_pilot_value_report/g)].length,
  1,
  "Pilot Impact must use one consolidated report RPC",
);
mustMatch(pilotImpact, /p_site_id: siteContext\.siteId/, "Pilot Impact must use auth site context");
mustMatch(pilotImpact, /Pilot to date/, "Pilot Impact must provide pilot-to-date range");
mustMatch(pilotImpact, /Last 30 days/, "Pilot Impact must provide 30-day range");
mustMatch(pilotImpact, /Custom range/, "Pilot Impact must provide custom range");
mustMatch(pilotImpact, /Download Pilot Report/, "Pilot report download must remain available");
mustMatch(pilotImpact, /window\.print\(\)/, "Pilot report must support print-to-PDF");
mustMatch(pilotImpact, /@media print/, "Pilot report must retain print styling");
mustMatch(pilotImpact, /validatePilotImpactReport/, "Pilot impact responses must be runtime validated");
mustMatch(pilotImpact, /eventType: "pilot_report_downloaded"/, "Pilot downloads must be tracked at their source action");

assert.equal(
  [...pilotAdoption.matchAll(/vorta_get_pilot_adoption_report/g)].length,
  1,
  "Pilot Adoption must use one report RPC",
);
mustMatch(pilotAdoption, /p_site_id: siteId/, "Pilot Adoption must use auth site context");
mustMatch(pilotAdoption, /Ask Vorta queries/, "Ask Vorta engagement must remain visible");
mustMatch(pilotAdoption, /Follow-through actions/, "Follow-through must remain distinct from views");
mustMatch(pilotAdoption, /Prompt text is never stored/, "Prompt privacy boundary must remain visible");
mustMatch(pilotAdoption, /validatePilotAdoptionReport/, "Pilot adoption responses must be runtime validated");

assert.equal(
  [...pilotSetupHook.matchAll(/vorta_get_pilot_setup/g)].length,
  1,
  "Pilot Setup must load through one administrator-scoped RPC",
);
mustMatch(pilotSetupHook, /validatePilotSetupReport/, "Pilot Setup responses must be runtime validated");
mustMatch(pilotSetupHook, /vorta_update_pilot_configuration/, "Configuration must use controlled RPC");
mustMatch(pilotSetupHook, /vorta_update_pilot_participants/, "Participants must be explicit and persisted");
mustMatch(pilotSetupHook, /vorta_record_pilot_rehearsal_attempt/, "Rehearsals must append attempts");
mustMatch(pilotSetupHook, /vorta_upsert_pilot_weekly_review/, "Weekly reviews must be persisted");
mustMatch(pilotSetupHook, /vorta_launch_pilot/, "Launch must use backend gate");
mustMatch(pilotSetupHook, /window\.addEventListener\("beforeunload"/, "Unsaved work must be protected");
mustMatch(pilotSetupModel, /result: ""/, "Rehearsal drafts must not default to pass");
mustMatch(pilotSetupRehearsal, /<option value="">Choose result<\/option>/, "Rehearsal result must be explicit");
mustMatch(pilotSetupPeople, /At least 8 characters required/, "Manual pass must require evidence");
mustMatch(pilotSetupData, /These cannot be manually overridden/, "Automated gates must remain immutable");
mustMatch(pilotSetupLaunch, /Edit review/, "Weekly reviews must be editable");
mustMatch(pilotSetup, /aria-label="Pilot setup stages"/, "Pilot Setup must use staged navigation");
mustMatch(pilotSetup, /useModalFocusTrap/, "Pilot launch must trap focus");
mustMatch(combinedPilotSetup, /Administrator-only workflow · SAP remains read-only/, "SAP must remain read-only");
mustNotMatch(combinedPilotSetup, /11000000-0000-0000-0000-000000000001/, "Pilot Setup must never hardcode the pilot site");

mustMatch(runtimeContracts, /validateOperationalDashboardPayload/, "Dashboard runtime contracts must exist");
mustMatch(runtimeContracts, /validateSkillsMatrixPayload/, "Skills Matrix runtime contracts must exist");
mustMatch(runtimeContracts, /validateWorkOrderRow/, "Work order runtime contracts must exist");

mustMatch(pilotUsage, /vorta_track_pilot_usage_event/, "Usage must use controlled tracking RPC");
mustMatch(pilotUsage, /window\.sessionStorage/, "Usage events must be session grouped");
mustNotMatch(pilotUsage, /service_role/, "Frontend must never expose service-role credentials");
mustMatch(maintenanceExperience, /eventType: "equipment_view"/, "Equipment reviews must be tracked");
mustMatch(maintenanceExperience, /eventType: "ask_vorta_query"/, "Ask Vorta use must be tracked");
mustMatch(maintenanceExperience, /questionLength: question\.length/, "Only Ask Vorta length may be retained");
mustNotMatch(maintenanceExperience, /WORK_ORDER_NUMBER/, "Portal root must not parse work-order text");
mustNotMatch(maintenanceExperience, /stopImmediatePropagation/, "Portal root must not suppress native interactions");
mustMatch(dashboard, /openWorkOrderDetail/, "Dashboard work orders must open explicitly");
mustMatch(equipmentWorkOrders, /openWorkOrderDetail/, "Equipment work orders must open explicitly");
mustMatch(aiAssistant, /openWorkOrderDetail/, "Ask Vorta history must open explicitly");

console.log("Maintenance portal workflow contracts passed.");
