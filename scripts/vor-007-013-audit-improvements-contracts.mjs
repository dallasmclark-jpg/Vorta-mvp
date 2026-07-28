import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const route = read("src/screens/Equipment/EquipmentRouteEntry.tsx");
const mobile = read("src/screens/Equipment/MobileEquipmentSection.tsx");
const spares = read("src/screens/Equipment/EquipmentSpares.tsx");
const sparesService = read("src/screens/Equipment/sparesIntelligenceService.ts");
const resilience = read("src/lib/liveEvidenceResilience.ts");
const surfaces = read("src/card-surfaces.css");
const handover = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");
const handoverService = read("src/screens/ShiftHandover/shiftHandoverWorkflowService.ts");
const migration = read("supabase/migrations/20260728130000_add_shift_handover_control_workflow.sql");

assert.match(route, /if \(isPhone\)[\s\S]*<MobileEquipmentSection[\s\S]*dataMode=\{dataMode\}/);
assert.doesNotMatch(route, /isPhone && dataMode === "demo"/);
assert.match(mobile, /data-vorta-equipment-mode=\{dataMode\}/);
assert.match(mobile, /loadLiveEquipmentList\(siteId\)/);
assert.match(mobile, /loadEquipmentEvidenceCoverage/);
assert.match(mobile, /line-clamp-2 text-base font-semibold/);
assert.match(mobile, /work-orders\?view=pm-backlog/);
assert.match(mobile, /pms\?view=backlog/);
assert.ok((mobile.match(/min-h-14 rounded-lg/g) ?? []).length >= 3);
assert.match(mobile, /<article[\s\S]*data-vorta-group-frame="true"[\s\S]*<button[\s\S]*Open WOs[\s\S]*<button[\s\S]*PM overdue[\s\S]*<button[\s\S]*Calibration/);

assert.match(sparesService, /getVerifiedEquipmentComponents/);
assert.match(sparesService, /source_updated_at/);
assert.match(sparesService, /getVerifiedEquipmentWorkQueue/);
assert.match(sparesService, /projectedRiskScore > currentRiskScore/);
assert.match(spares, /Promise\.allSettled/);
assert.match(spares, /No stock coverage, exposure or replenishment result is being substituted/);
assert.match(spares, /No verified spare intervention is available/);
assert.match(spares, /<details className="rounded-xl border border-gray-800/);
assert.match(spares, /data-vorta-group-frame="true"/);
assert.doesNotMatch(spares, /Math\.min\(8, Math\.max\(2, components\.stockSummary\.outOfStock \* 3\)\)/);
assert.doesNotMatch(spares, /Showing the latest available data/);

assert.match(resilience, /const REQUEST_TIMEOUT_MS = 8_000/);
assert.match(resilience, /const MAX_ATTEMPTS = 2/);
assert.match(resilience, /const inFlightEvidence = new Map/);
assert.match(resilience, /controller\.abort\(\)/);
assert.match(resilience, /vorta:evidence-request/);

assert.match(surfaces, /data-vorta-group-frame="true"/);
assert.doesNotMatch(surfaces, /:has\(/);
assert.doesNotMatch(surfaces, /aria-label="Handover scope level"/);

assert.match(handover, /data-vorta-handover-control="true"/);
assert.match(handover, /Save handover/);
assert.match(handover, /Acknowledge/);
assert.match(handover, /Carry forward/);
assert.match(handover, /Previous verified evidence remains visible/);
assert.match(handoverService, /vorta_save_shift_handover_action/);
assert.match(handoverService, /vorta_acknowledge_shift_handover_action/);
assert.match(handoverService, /vorta_carry_forward_shift_handover_action/);
assert.match(migration, /create table if not exists public\.shift_handover_actions/);
assert.match(migration, /create table if not exists public\.shift_handover_action_events/);
assert.match(migration, /private\.vorta_shift_handover_can_manage/);
assert.match(migration, /Handover changed before this save/);
assert.match(migration, /Completed SAP work orders cannot be reopened/);
assert.match(migration, /shift_handover_actions_site_read/);
assert.match(migration, /grant execute on function public\.vorta_get_shift_handover_actions/);

console.log("VOR-007 through VOR-013 engineering, workflow and UI contracts passed.");
