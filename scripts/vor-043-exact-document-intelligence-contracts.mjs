import { readFileSync } from "node:fs";

const evidenceMigration = readFileSync(
  "supabase/migrations/20260803110815_vor_043_exact_document_intelligence.sql",
  "utf8",
);
const failClosedMigration = readFileSync(
  "supabase/migrations/20260803110953_vor_043_fail_closed_summary_only_citations.sql",
  "utf8",
);
const askVortaFunction = readFileSync("netlify/functions/ask-vorta.mts", "utf8");

const checks = [
  [
    askVortaFunction.includes('rpc: "vorta_search_equipment_knowledge"'),
    "Ask Vorta still routes technical document questions through the authorised knowledge RPC",
  ],
  [
    evidenceMigration.includes("citation_label text")
      && evidenceMigration.includes("locator_status text")
      && evidenceMigration.includes("source_link_status text"),
    "document evidence exposes a first-class citation, locator state and link state",
  ],
  [
    evidenceMigration.includes("revision_status text")
      && evidenceMigration.includes("page_number integer")
      && evidenceMigration.includes("drawing_number text")
      && evidenceMigration.includes("sheet_number text"),
    "exact revision, page, drawing and sheet metadata remain in the evidence contract",
  ],
  [
    evidenceMigration.includes("verified_excerpt text")
      && evidenceMigration.includes("left(")
      && evidenceMigration.includes("900"),
    "stored evidence excerpts are bounded before reaching the model",
  ],
  [
    evidenceMigration.includes("coverage_mode text")
      && evidenceMigration.includes("full_document_indexed boolean")
      && evidenceMigration.includes("Summary-only coverage"),
    "summary-only coverage is distinguished from indexed source text",
  ],
  [
    evidenceMigration.includes("summary_only_no_verified_locator")
      && evidenceMigration.includes("summary_only_with_recorded_locator")
      && evidenceMigration.includes("no_verified_locator"),
    "missing and summary-only locators fail closed instead of being inferred",
  ],
  [
    evidenceMigration.includes("Stored document summary only; the full source text is not indexed."),
    "summary chunks carry an explicit non-source-text warning",
  ],
  [
    evidenceMigration.includes("kd.is_current = true")
      && evidenceMigration.includes("kd.approval_status = 'Approved'")
      && evidenceMigration.includes("('active', 'review_due')"),
    "document search remains limited to approved current operational records",
  ],
  [
    evidenceMigration.includes("security definer")
      && evidenceMigration.includes("vorta_has_site_access")
      && evidenceMigration.includes("set search_path to 'pg_catalog', 'public'"),
    "the public wrapper keeps site authorisation and a fixed search path",
  ],
  [
    evidenceMigration.includes("from public, anon, authenticated")
      && evidenceMigration.includes("to authenticated, service_role")
      && failClosedMigration.includes("has_function_privilege('anon'")
      && failClosedMigration.includes("has_function_privilege('authenticated'"),
    "RPC grants are explicit and protected by a migration-time invariant gate",
  ],
];

const failures = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) console.log(`${passed ? "✓" : "✗"} ${label}`);
if (failures.length) process.exit(1);
