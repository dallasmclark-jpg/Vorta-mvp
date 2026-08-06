import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const health = read(
  "supabase/migrations/20260806110000_vor_060_document_evidence_health.sql",
);
const suite = read(
  "supabase/migrations/20260806110100_vor_060_knowledge_quality_checks.sql",
);

assert.match(
  health,
  /create or replace function public\.vorta_get_document_ingestion_health\(p_site_id uuid\)/,
  "VOR-060 must extend the existing site-scoped document health authority.",
);
assert.match(
  health,
  /lower\(coalesce\(d\.approval_status, ''\)\) in \('approved', 'current'\)/,
  "Only approved/current documents may enter the health contract.",
);
assert.match(health, /non_empty_chunk_count/);
assert.match(health, /DOCUMENT_HAS_NO_CHUNK_TEXT/);
assert.match(health, /metadata ->> 'coverageMode'/);
assert.match(health, /metadata ->> 'fullDocumentIndexed'/);
assert.match(health, /DOCUMENT_COVERAGE_METADATA_CONFLICT/);
assert.match(health, /'full_text'/);
assert.match(health, /'summary_only'/);
assert.match(health, /'unavailable'/);

assert.match(
  health,
  /lower\(btrim\(c\.section_title\)\) not in \([\s\S]*'summary'[\s\S]*'document summary'/,
  "Generic summary labels must not qualify as verified chunk locators.",
);
assert.match(
  health,
  /lower\(btrim\(d\.manual_section\)\) not in \([\s\S]*'summary'[\s\S]*'document summary'/,
  "Generic summary labels must not qualify as verified document locators.",
);
assert.match(health, /DOCUMENT_LOCATOR_MISSING/);
assert.match(health, /documentsMissingLocator/);

assert.match(health, /\^https\?:\/\//);
assert.match(health, /easidoc-demo\|ilearn-demo\|sap-demo/);
assert.match(health, /\^\/equipment\//);
assert.match(health, /DOCUMENT_SOURCE_REFERENCE_MALFORMED/);
assert.match(
  health,
  /'publicHttpReachabilityChecked', false/,
  "Structural link validation must not be misrepresented as a reachability check.",
);
assert.match(
  health,
  /Network reachability was not inferred/,
  "Malformed-link evidence must state the boundary precisely.",
);

assert.match(health, /DOCUMENT_DUPLICATE_CURRENT_REVISION/);
assert.match(health, /DOCUMENT_CURRENT_HAS_NEWER_APPROVED_REVISION/);
assert.match(health, /DOCUMENT_CURRENT_STATUS_CONFLICT/);
assert.match(health, /duplicateCurrentRevisionGroups/);
assert.match(health, /currentWithNewerApprovedRevision/);
assert.match(health, /obsoleteCurrentStatusConflicts/);

assert.match(health, /DOCUMENT_EQUIPMENT_ORPHANED/);
assert.match(health, /DOCUMENT_EQUIPMENT_SITE_MISMATCH/);
assert.match(health, /DOCUMENT_CHUNK_EQUIPMENT_MISMATCH/);
assert.match(health, /DOCUMENT_CHUNK_SITE_MISMATCH/);
assert.match(health, /chunkEquipmentRelationshipFailures/);

assert.match(
  health,
  /'knowledge:document_ingestion'/,
  "The existing document-ingestion incident key must remain the single alert authority.",
);
assert.match(health, /hard evidence failures/);
assert.match(health, /'fullText'/);
assert.match(health, /'summaryOnly'/);

assert.match(
  suite,
  /rename to vorta_run_knowledge_quality_suite_base_vor060/,
  "The established suite must be preserved behind the VOR-060 wrapper.",
);
assert.match(suite, /document_indexing_and_locator_completeness/);
assert.match(suite, /document_chunk_coverage_integrity/);
assert.match(suite, /document_source_reference_integrity/);
assert.match(suite, /document_revision_currency/);
assert.match(suite, /document_equipment_relationship_integrity/);
assert.match(
  suite,
  /Generic Summary and Document summary labels are excluded/,
  "The legacy locator check must use the same genuine-locator definition.",
);
assert.match(suite, /It does not claim unchecked HTTP reachability/);
assert.match(suite, /suite_version = v_suite_version/);
assert.match(suite, /passed_count = v_passed/);
assert.match(suite, /failed_count = v_failed/);
assert.match(suite, /warning_count = v_warned/);

assert.match(
  health,
  /revoke all on function public\.vorta_get_document_ingestion_health\(uuid\)[\s\S]*from public, anon/,
);
assert.match(
  health,
  /grant execute on function public\.vorta_get_document_ingestion_health\(uuid\)[\s\S]*to authenticated, service_role/,
);
assert.match(
  health,
  /revoke all on function private\.vorta_run_document_ingestion_health_monitor\(\)[\s\S]*from public, anon, authenticated/,
);
assert.match(
  suite,
  /revoke all on function public\.vorta_run_knowledge_quality_suite\(date\)[\s\S]*from public, anon, authenticated/,
);
assert.match(
  suite,
  /grant execute on function public\.vorta_run_knowledge_quality_suite\(date\)[\s\S]*to service_role/,
);

assert.doesNotMatch(health, /insert into public\.knowledge_documents/i);
assert.doesNotMatch(health, /update public\.knowledge_documents/i);
assert.doesNotMatch(health, /delete from public\.knowledge_documents/i);
assert.doesNotMatch(suite, /insert into public\.knowledge_documents/i);

console.log("VOR-060 document evidence health contracts passed.");
