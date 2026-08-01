import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readMigration = (filename) => readFileSync(resolve(repositoryRoot, "supabase/migrations", filename), "utf8");

const storylineEvidence = readMigration("20260801180721_enrich_demo_storyline_evidence.sql");
const visibleLanguage = readMigration("20260801180802_remove_remaining_visible_demo_language.sql");
const healthGate = readMigration("20260801180839_add_demo_storyline_health_gate.sql");
const indexMigration = readMigration("20260801180925_index_demo_storyline_site_reference.sql");

const requireText = (source, expected, message) => {
  assert.ok(source.includes(expected), message ?? `Expected migration to include: ${expected}`);
};

requireText(storylineEvidence, "private.vorta_demo_storylines", "Private storyline storage must exist.");
requireText(storylineEvidence, "'vor-033-before-storyline-enrichment'", "Phase 2 must capture a baseline before mutation.");
requireText(storylineEvidence, "revoke all on table private.vorta_demo_storylines from public, anon, authenticated");
requireText(storylineEvidence, "grant select, insert, update, delete on table private.vorta_demo_storylines to service_role");
requireText(storylineEvidence, "private.vorta_apply_demo_storyline_narratives_internal", "Rolling recalculation must restore the approved narratives.");
requireText(storylineEvidence, "FD-03: Vacuum-pump motor current reached 18.6 A against a 15.0 A baseline.");
requireText(storylineEvidence, "RABS-01: Door-interlock input dropped out twice after cleaning.");
requireText(storylineEvidence, "VF-02: Replace reject-station sensor VF02-SENS-014");
requireText(storylineEvidence, "WFI-01: Replace conductivity sensor WFI1-COND-001");
requireText(storylineEvidence, "AHU-01: Replace HEPA differential-pressure transmitter HVAC-DP-001");
requireText(storylineEvidence, "COLD-01: Dual store probes differed by 1.3 °C during defrost recovery.");

const storyKeys = [
  "fd03-vacuum-and-defrost-recovery",
  "rabs01-interlock-recovery",
  "vf02-reject-sensor-recovery",
  "wfi01-conductivity-recovery",
  "ahu01-hepa-dp-recovery",
  "cold01-probe-and-handover",
];
for (const storyKey of storyKeys) requireText(storylineEvidence, `'${storyKey}'`);

const promptArrays = storylineEvidence.match(/array\[[\s\S]*?\]/g) ?? [];
assert.equal(promptArrays.length, 6, "Each of the six storylines must contain a question set.");
for (const promptArray of promptArrays) {
  assert.equal((promptArray.match(/'(?:[^']|'')*'/g) ?? []).length, 4, "Each storyline must define four manager questions.");
}

for (const reference of [
  "'FD-03','WO-260706','NT-26007','PM-260704','FD-03-PLC-01'",
  "'RABS-01','WO-261006','NT-26010','PM-261004','RABS-01-PLC-01'",
  "'VF-02','WO-250467','N-260002','PM-VF02-SENSOR-CAL-M','VF02-SENS-014'",
  "'WFI-01','WO-250414',null,'PM-WFI-COND-WK','WFI1-COND-001'",
  "'AHU-01','WO-250447',null,'PM-HVAC-HEPA-CAL','HVAC-DP-001'",
  "'COLD-01','WO-T0302',null,'PM-COLD-PROBE-CAL','COLD-01-SEN-C01'",
]) requireText(storylineEvidence, reference, `Missing connected storyline reference: ${reference}`);

requireText(visibleLanguage, "ILEARN-BOSCH-VF-OEM-2026");
requireText(visibleLanguage, "EDOC-GEA-FD-MAN-5.1");
requireText(visibleLanguage, "SAPWO-VF-REPEAT-INFEED-2026");
assert.equal(/\b(demo data|demo manual|demo Wrexham)\b/i.test(visibleLanguage), false, "Replacement summaries must not retain visible demo phrasing.");

requireText(healthGate, "private.vorta_get_demo_storyline_health_internal", "A separate storyline health gate must exist.");
requireText(healthGate, "story_summary.prompt_count >= 20", "At least twenty manager prompts must be covered.");
requireText(healthGate, "story_summary.fully_linked = story_summary.total", "Every active storyline must resolve all required evidence.");
requireText(healthGate, "top_summary.complete = 10", "The ten highest-risk assets must retain complete evidence coverage.");
requireText(healthGate, "duplicate_narratives.groups = 0", "Repeated prominent work-order narratives must fail the gate.");
requireText(healthGate, "asset.equipment_code, asset.name, asset.model, asset.description", "The visible seed scan must include asset model and description.");
requireText(healthGate, "array_to_string(document.fault_codes, ' ')", "The visible seed scan must cover document array references.");
requireText(healthGate, "array_to_string(chunk.component_tags, ' ')", "The visible seed scan must cover chunk array references.");
assert.equal(healthGate.includes("document.source_path"), false, "Internal storage paths must not be treated as visible UI fields.");
assert.equal(healthGate.includes("document.metadata::text"), false, "Internal demo metadata must not create false presentation failures.");
requireText(healthGate, "vorta_get_demo_dataset_credibility_phase1_internal", "The new credibility report must preserve the phase-one checks.");
requireText(healthGate, "perform private.vorta_apply_demo_storyline_narratives_internal", "Rolling date refresh must restore storyline narratives after risk recalculation.");
requireText(healthGate, "VOR-033 Phase 2 demo storyline credibility contract failed");

requireText(indexMigration, "vorta_demo_storylines_site_active_idx");
requireText(indexMigration, "(site_id, active, story_key)");

for (const source of [storylineEvidence, healthGate]) {
  assert.equal(
    /create\s+(or\s+replace\s+)?function\s+public\.vorta_(get|refresh|apply)_demo_(dataset|storyline)/i.test(source),
    false,
    "Demo maintenance functions must remain private and unavailable through the public Data API.",
  );
}

console.log("VOR-033 connected demo storyline contracts passed.");
