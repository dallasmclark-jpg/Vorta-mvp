import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const migration = read(
  "supabase/migrations/20260806113000_vor_061_fail_closed_document_access.sql",
);
const reader = read("src/screens/Equipment/equipmentDocumentCoverage.ts");
const browser = read("tests/browser/vor-021-document-coverage.spec.ts");

assert.ok(
  (migration.match(/security invoker/g) ?? []).length === 3,
  "The list, detail and bounded access-state readers must all remain security invoker.",
);
assert.ok(
  (migration.match(/document\.is_current is true/g) ?? []).length >= 2,
  "Both content readers must exclude non-current documents.",
);
assert.ok(
  (migration.match(/lower\(coalesce\(document\.approval_status, ''\)\) in \('approved', 'current'\)/g) ?? [])
    .length >= 2,
  "Both content readers must require approved/current evidence.",
);
assert.ok(
  (migration.match(/lower\(coalesce\(document\.status, ''\)\) !~ '\(obsolete\|superseded\|withdrawn\|retired\)'/g) ?? [])
    .length >= 2,
  "Both content readers must exclude obsolete and superseded states.",
);

assert.match(
  migration,
  /create or replace function public\.vorta_get_equipment_document_access_state\(/,
  "A bounded access-state reader must explain authorised stale or unapproved documents.",
);
assert.match(
  migration,
  /returns table\(\s*access_state text,\s*explanation text\s*\)/,
  "The access-state RPC must return only state and explanation.",
);
assert.match(migration, /'available_current'/);
assert.match(migration, /'superseded_or_obsolete'/);
assert.match(migration, /'not_approved'/);
assert.match(
  migration,
  /This document is superseded or obsolete and cannot be used as current Ask Vorta evidence\./,
);
assert.match(
  migration,
  /This document is not approved for current use and cannot be used as Ask Vorta evidence\./,
);

const accessReturnBlock = migration.match(
  /create or replace function public\.vorta_get_equipment_document_access_state[\s\S]*?returns table\(([\s\S]*?)\)\s*language sql/,
)?.[1] ?? "";
assert.equal(
  accessReturnBlock.replace(/\s+/g, " ").trim(),
  "access_state text, explanation text",
  "The access-state contract must not return document identity, content, source or revision metadata.",
);

assert.match(
  migration,
  /revoke all on function public\.vorta_get_equipment_document_access_state\(uuid, uuid\)[\s\S]*from public, anon/,
);
assert.match(
  migration,
  /grant execute on function public\.vorta_get_equipment_document_access_state\(uuid, uuid\)[\s\S]*to authenticated, service_role/,
);
assert.doesNotMatch(migration, /security definer/i);
assert.doesNotMatch(migration, /insert\s+into\s+public\./i);
assert.doesNotMatch(migration, /update\s+public\./i);
assert.doesNotMatch(migration, /delete\s+from\s+public\./i);

assert.match(reader, /export type LiveDocumentAccessState/);
assert.match(reader, /vorta_get_equipment_document_access_state/);
assert.match(reader, /superseded_or_obsolete/);
assert.match(reader, /not_approved/);
assert.match(
  reader,
  /This document is not available for the authorised equipment and site\./,
  "Unknown, cross-site or role-blocked documents must retain the generic non-disclosing message.",
);
assert.match(
  reader,
  /This document is superseded or obsolete and cannot be used as current Ask Vorta evidence\./,
);
assert.match(
  reader,
  /This document is not approved for current use and cannot be used as Ask Vorta evidence\./,
);

const missingRowIndex = reader.indexOf("if (!row)");
const accessStateCallIndex = reader.indexOf(
  "loadBlockedDocumentExplanation",
  missingRowIndex,
);
assert.ok(missingRowIndex >= 0 && accessStateCallIndex > missingRowIndex,
  "The bounded access-state query must run only after the content RPC returns no row.");

assert.match(browser, /56b3db95-78f2-4b62-80fa-7daf97767563/);
assert.match(browser, /037752d4-6e63-41ec-bee9-2f98489be484/);
assert.match(browser, /Full-text indexed/);
assert.match(browser, /Summary-only coverage/);
assert.match(browser, /unknown or role-inaccessible document does not disclose access state/);
assert.match(
  browser,
  /This document is not available for the authorised equipment and site\./,
);
assert.match(browser, /superseded\|obsolete\|not approved/);
assert.match(browser, /toHaveCount\(0\)/);

console.log("VOR-061 fail-closed document access contracts passed.");
