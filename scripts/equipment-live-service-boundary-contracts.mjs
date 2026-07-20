import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
const lineCount = (value) => value.trimEnd().split("\n").length;

const views = read("src/screens/Equipment/EquipmentLiveEvidenceViews.tsx");
const shared = read("src/screens/Equipment/EquipmentPilotEvidenceShared.tsx");
const routes = read("src/screens/Equipment/EquipmentLiveRoutes.tsx");
const service = read("src/screens/Equipment/equipmentService.ts");

assert.ok(lineCount(views) <= 350, "EquipmentLiveEvidenceViews must remain a focused workflow composition module.");
assert.match(views, /from "\.\/EquipmentPilotEvidenceShared"/);
for (const sharedName of [
  "usePilotEvidence",
  "PageFrame",
  "Metric",
  "EvidenceStateMessage",
  "LoadingEvidence",
  "RefreshButton",
  "AskVortaButton",
  "formatDate",
  "riskTone",
]) {
  assert.match(views, new RegExp(sharedName));
}
for (const duplicate of [
  "function useEvidence",
  "function PageFrame",
  "function Metric",
  "function EvidenceMessage",
  "function LoadingEvidence",
  "function RefreshButton",
  "function AskButton",
  "function formatDate",
  "function toneForRisk",
]) {
  assert.doesNotMatch(views, new RegExp(duplicate));
}
assert.doesNotMatch(views, /LiveEquipmentWorkOrdersView/);
assert.doesNotMatch(routes, /LiveEquipmentWorkOrdersView/);
assert.match(shared, /if \(level === "Low"\) return "border-lime-500/);

assert.match(service, /Equipment compatibility and operational service/);
assert.match(service, /Live pilot routes use equipmentLiveTrust and/);
assert.match(service, /Add new domain readers to focused modules/);
assert.doesNotMatch(service, /Replace other function bodies with Supabase queries when ready/);
assert.doesNotMatch(service, /getEquipmentWorkOrders (?:Supabase error|threw), using mock/);
assert.doesNotMatch(service, /getEquipmentPMs (?:Supabase error|threw), using mock/);
assert.match(service, /getEquipmentWorkOrders Supabase error; returning no verified rows/);
assert.match(service, /getEquipmentPMs Supabase error; returning no verified rows/);
assert.match(service, /getEquipmentSkills Supabase error; returning legacy compatibility data/);
assert.doesNotMatch(service, /from ["']react["']/);
assert.doesNotMatch(service, /<PageFrame|<Metric|JSX\.Element/);

console.log("Equipment live evidence and service boundary contracts passed.");
