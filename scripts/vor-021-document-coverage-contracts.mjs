import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migration = read("supabase/migrations/20260806101500_vor_021_document_coverage_semantics.sql");
const evidence = read("src/screens/Equipment/equipmentPilotEvidence.ts");
const listView = read("src/screens/Equipment/LiveEquipmentDocumentsView.tsx");
const viewer = read("src/screens/Equipment/LiveEquipmentDocumentViewerView.tsx");
const browser = read("tests/browser/vor-021-document-coverage.spec.ts");

const checks = [
  ["list RPC exposes coverage mode", migration.includes("coverage_mode text")],
  ["detail RPC exposes full-document state", migration.includes("full_document_indexed boolean")],
  ["verified locator state is derived", migration.includes("has_verified_locator boolean")],
  ["summary-only metadata is authoritative", migration.includes("metadata ->> 'coverageMode'") && migration.includes("metadata ->> 'fullDocumentIndexed'")],
  ["summary-only reason is explicit", migration.includes("Only the approved document summary is indexed; the full source text is not indexed.")],
  ["functions remain security invoker", (migration.match(/security invoker/g) ?? []).length === 2],
  ["anonymous execution remains revoked", migration.includes("revoke all on function public.vorta_get_equipment_documents(uuid) from public, anon")],
  ["authenticated execution remains explicit", migration.includes("grant execute on function public.vorta_get_equipment_document(uuid, uuid) to authenticated, service_role")],
  ["live mapper carries coverage mode", evidence.includes("coverageMode: LiveDocumentCoverageMode") && evidence.includes("row.coverage_mode")],
  ["live mapper carries verified locator", evidence.includes("hasVerifiedLocator") && evidence.includes("row.has_verified_locator")],
  ["citations disclose summary-only state", evidence.includes("summary-only coverage; full source text not indexed")],
  ["document list labels full text", listView.includes("Full-text indexed")],
  ["document list labels summary-only", listView.includes("Summary-only coverage")],
  ["document list exposes coverage test hook", listView.includes("data-vorta-document-coverage")],
  ["viewer states the coverage boundary", viewer.includes("Coverage boundary:") && viewer.includes("data-vorta-document-coverage-note")],
  ["Ask Vorta is told not to inflate summaries", listView.includes("never present summary-only evidence as full source text") && viewer.includes("Never present summary-only evidence as full source text")],
  ["responsive browser test covers full text", browser.includes('"full_text"') && browser.includes("X31:4")],
  ["responsive browser test covers summary-only", browser.includes('"summary_only"') && browser.includes("Approved summary")],
];

let failures = 0;
for (const [label, passed] of checks) {
  if (passed) {
    console.log(`PASS: ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

if (failures > 0) {
  console.error(`VOR-021 document coverage contracts failed: ${failures}/${checks.length}`);
  process.exit(1);
}

console.log(`VOR-021 document coverage contracts passed: ${checks.length}/${checks.length}`);
