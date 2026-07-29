import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const canonicalRisk = read(
  "supabase/migrations/20260729122000_canonicalise_site_risk_formula.sql",
);
const summaryCoverage = read(
  "supabase/migrations/20260729123000_backfill_summary_knowledge_chunks.sql",
);
const summaryLabels = read(
  "supabase/migrations/20260729124500_label_summary_only_knowledge_chunks.sql",
);
const engineersBundle = read(
  "supabase/migrations/20260729124000_add_engineers_evidence_bundle.sql",
);
const engineersFunction = read("supabase/functions/engineers-data/index.ts");
const equipmentTabs = read("src/screens/Equipment/EquipmentTabNavigation.tsx");
const tabStates = read("src/tab-states.css");

assert.match(
  canonicalRisk,
  /create or replace function private\.vorta_calculate_site_operational_risk/,
  "Site risk must have one private canonical operational calculation.",
);
assert.ok(
  (canonicalRisk.match(/private\.vorta_calculate_site_operational_risk\(v_site_id\)/g) ?? [])
    .length >= 2,
  "Both refresh and health verification must use the canonical risk calculation.",
);
assert.match(
  canonicalRisk,
  /p_check_key = 'site_risk_formula_consistent'/,
  "The health result must verify the canonical site-risk formula.",
);
assert.match(
  canonicalRisk,
  /revoke all on function private\.vorta_calculate_site_operational_risk\(uuid\)[\s\S]*from public, anon, authenticated/,
  "The internal risk calculation must not be directly callable by portal roles.",
);
assert.match(
  canonicalRisk,
  /grant execute on function private\.vorta_calculate_site_operational_risk\(uuid\)[\s\S]*to service_role/,
  "The risk calculation must remain available to trusted backend workflows.",
);

assert.match(summaryCoverage, /'coverageMode', 'summary_only'/);
assert.match(summaryCoverage, /'fullDocumentIndexed', false/);
assert.match(summaryCoverage, /'VORTA-SUMMARY-001'/);
assert.match(summaryCoverage, /coalesce\(document\.extracted_summary, document\.summary\)/);
assert.match(summaryCoverage, /on conflict \(document_id, chunk_ref\) do nothing/);
assert.match(summaryLabels, /summary-only coverage/);
assert.match(summaryLabels, /where chunk\.metadata ->> 'coverageMode' = 'summary_only'/);
assert.doesNotMatch(
  summaryCoverage,
  /page_number\s*\+|generate_series/,
  "Document repair must not invent page locators.",
);

assert.match(
  engineersBundle,
  /create or replace function public\.vorta_get_engineers_evidence_bundle_internal/,
);
assert.match(engineersBundle, /site\.id = p_site_id/);
assert.match(engineersBundle, /site\.organisation_id = p_organisation_id/);
assert.match(engineersBundle, /engineer\.organisation_id = p_organisation_id/);
assert.match(engineersBundle, /revoke all on function public\.vorta_get_engineers_evidence_bundle_internal/);
assert.match(engineersBundle, /to service_role/);
assert.match(engineersBundle, /engineers_site_org_name_idx/);
assert.match(engineersBundle, /skill_gap_snapshots_site_org_idx/);
assert.match(engineersBundle, /training_bookings_org_engineer_idx/);
assert.equal(
  (engineersFunction.match(/db\.rpc\(/g) ?? []).length,
  1,
  "Engineers Edge Function must issue one evidence-bundle RPC.",
);
assert.match(engineersFunction, /vorta_get_engineers_evidence_bundle_internal/);
assert.match(engineersFunction, /evidenceLoadMs/);
assert.doesNotMatch(engineersFunction, /\.from\("engineers"\)/);

assert.match(equipmentTabs, /findPortalScrollContainer/);
assert.match(equipmentTabs, /verticalScrollByEquipmentRoute/);
assert.match(equipmentTabs, /scrollContainer\.scrollTop/);
assert.match(equipmentTabs, /scrollContainer\.scrollTo/);
assert.match(equipmentTabs, /data-vorta-preserve-portal-scroll="true"/);
assert.doesNotMatch(equipmentTabs, /window\.scrollY|window\.scrollTo/);

assert.match(tabStates, /\[data-vorta-portal-shell="true"\]/);
assert.match(tabStates, /\[data-vorta-tab-outline="true"\]/);
assert.doesNotMatch(tabStates, /!important/);
assert.doesNotMatch(
  tabStates,
  /^\s*\[role=tab\]\[aria-selected=true\]/m,
  "Selected styling must not leak globally outside the Vorta portal.",
);

console.log("VOR-020 to VOR-024 canonical risk, evidence, performance and UI contracts passed.");
