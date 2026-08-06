import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");
const occurrences = (source, value) => source.split(value).length - 1;

const migration = read(
  "supabase/migrations/20260806113000_vor_061_fail_closed_document_access.sql",
);
const reader = read("src/screens/Equipment/equipmentDocumentCoverage.ts");
const browser = read("tests/browser/vor-021-document-coverage.spec.ts");

assert.equal(
  occurrences(migration, "security invoker"),
  3,
  "The list, detail and bounded access-state readers must all remain security invoker.",
);
assert.ok(
  occurrences(migration, "document.is_current is true") >= 2,
  "Both content readers must exclude non-current documents.",
);
assert.ok(
  occurrences(
    migration,
    "lower(coalesce(document.approval_status, '')) in ('approved', 'current')",
  ) >= 2,
  "Both content readers must require approved/current evidence.",
);
assert.ok(
  occurrences(
    migration,
    "lower(coalesce(document.status, '')) !~ '(obsolete|superseded|withdrawn|retired)'",
  ) >= 2,
  "Both content readers must exclude obsolete and superseded states.",
);

const accessFunctionStart = migration.indexOf(
  "create or replace function public.vorta_get_equipment_document_access_state(",
);
const accessFunctionEnd = migration.indexOf(
  "revoke all on function public.vorta_get_equipment_documents(uuid)",
  accessFunctionStart,
);
assert.ok(
  accessFunctionStart >= 0 && accessFunctionEnd > accessFunctionStart,
  "The bounded access-state function must exist before the execution grants.",
);
const accessFunction = migration.slice(accessFunctionStart, accessFunctionEnd);

assert.ok(
  accessFunction.includes(
    "returns table(\n  access_state text,\n  explanation text\n)",
  ),
  "The access-state RPC must return only state and explanation.",
);
assert.ok(accessFunction.includes("'available_current'"));
assert.ok(accessFunction.includes("'superseded_or_obsolete'"));
assert.ok(accessFunction.includes("'not_approved'"));
assert.ok(
  accessFunction.includes(
    "This document is superseded or obsolete and cannot be used as current Ask Vorta evidence.",
  ),
);
assert.ok(
  accessFunction.includes(
    "This document is not approved for current use and cannot be used as Ask Vorta evidence.",
  ),
);
assert.ok(!accessFunction.includes("returns table(\n  document_id"));
assert.ok(!accessFunction.includes("chunk_text"));
assert.ok(!accessFunction.includes("source_url"));
assert.ok(!accessFunction.includes("revision text"));

assert.ok(
  migration.includes(
    "revoke all on function public.vorta_get_equipment_document_access_state(uuid, uuid)\n  from public, anon;",
  ),
);
assert.ok(
  migration.includes(
    "grant execute on function public.vorta_get_equipment_document_access_state(uuid, uuid)\n  to authenticated, service_role;",
  ),
);
assert.ok(!migration.toLowerCase().includes("security definer"));
assert.ok(!migration.toLowerCase().includes("insert into public."));
assert.ok(!migration.toLowerCase().includes("update public."));
assert.ok(!migration.toLowerCase().includes("delete from public."));

assert.ok(reader.includes("export type LiveDocumentAccessState"));
assert.ok(reader.includes("vorta_get_equipment_document_access_state"));
assert.ok(reader.includes("superseded_or_obsolete"));
assert.ok(reader.includes("not_approved"));
assert.ok(
  reader.includes(
    "This document is not available for the authorised equipment and site.",
  ),
  "Unknown, cross-site or role-blocked documents must retain the generic non-disclosing message.",
);
assert.ok(
  reader.includes(
    "This document is superseded or obsolete and cannot be used as current Ask Vorta evidence.",
  ),
);
assert.ok(
  reader.includes(
    "This document is not approved for current use and cannot be used as Ask Vorta evidence.",
  ),
);

const detailEmptyBranch = reader.indexOf(
  "const blockedExplanation = await loadBlockedDocumentExplanation(",
);
const detailRowCheck = reader.lastIndexOf("if (!row)", detailEmptyBranch);
assert.ok(
  detailRowCheck >= 0 && detailEmptyBranch > detailRowCheck,
  "The bounded access-state query must run only after the content RPC returns no row.",
);

assert.ok(browser.includes("56b3db95-78f2-4b62-80fa-7daf97767563"));
assert.ok(browser.includes("037752d4-6e63-41ec-bee9-2f98489be484"));
assert.ok(browser.includes("Full-text indexed"));
assert.ok(browser.includes("Summary-only coverage"));
assert.ok(
  browser.includes(
    "unknown or role-inaccessible document does not disclose access state",
  ),
);
assert.ok(
  browser.includes(
    "This document is not available for the authorised equipment and site.",
  ),
);
assert.ok(browser.includes("superseded|obsolete|not approved"));
assert.ok(browser.includes("toHaveCount(0)"));

console.log("VOR-061 fail-closed document access contracts passed.");
