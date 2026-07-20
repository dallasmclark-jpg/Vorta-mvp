import { readFileSync, rmSync, writeFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const write = (path, content) => writeFileSync(path, content);
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Missing expected source block: ${label}`);
  return source.replace(search, replacement);
};

const viewsPath = "src/screens/Equipment/EquipmentLiveEvidenceViews.tsx";
let views = read(viewsPath);
const overviewMarker = "export function LiveEquipmentOverviewView";
const overviewIndex = views.indexOf(overviewMarker);
if (overviewIndex < 0) throw new Error("Live Equipment overview marker was not found.");

const consolidatedPrefix = `import {
  Bell,
  CheckCircle2,
  Database,
  Gauge,
  GraduationCap,
  Package,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  loadLiveEquipmentCalibrations,
  loadLiveEquipmentComponents,
  loadLiveEquipmentNotifications,
  loadLiveEquipmentSkills,
  loadLiveEquipmentWorkItems,
  type LiveCalibration,
  type LiveComponentsPayload,
  type LiveEquipmentRecord,
  type LiveNotification,
  type LiveSkillsPayload,
} from "./equipmentLiveTrust";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  Metric,
  PageFrame,
  RefreshButton,
  formatDate,
  riskTone,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

function EquipmentAskVortaButton({
  record,
  question,
}: {
  record: LiveEquipmentRecord;
  question: string;
}): JSX.Element {
  return (
    <AskVortaButton
      question={\`${"${question}"} Use verified evidence for ${"${record.name}"} (${"${record.assetNumber}"}) only.\`}
    />
  );
}

`;
views = consolidatedPrefix + views.slice(overviewIndex);
views = views.replaceAll("useEvidence(", "usePilotEvidence(");
views = views.replaceAll("<EvidenceMessage", "<EvidenceStateMessage");
views = views.replaceAll("<AskButton", "<EquipmentAskVortaButton");
views = views.replaceAll("toneForRisk", "riskTone");

const deadStart = views.indexOf("export function LiveEquipmentWorkOrdersView");
const nextView = views.indexOf("export function LiveEquipmentCalibrationsView");
if (deadStart < 0 || nextView < 0 || nextView <= deadStart) {
  throw new Error("The obsolete Work Orders view boundary was not found.");
}
views = `${views.slice(0, deadStart)}${views.slice(nextView)}`;
write(viewsPath, views);

const sharedPath = "src/screens/Equipment/EquipmentPilotEvidenceShared.tsx";
let shared = read(sharedPath);
shared = replaceRequired(
  shared,
  '  if (level === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";\n  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";',
  '  if (level === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";\n  if (level === "Low") return "border-lime-500/30 bg-lime-500/10 text-lime-300";\n  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";',
  "shared Low-risk tone",
);
write(sharedPath, shared);

const servicePath = "src/screens/Equipment/equipmentService.ts";
let service = read(servicePath);
service = replaceRequired(
  service,
  `// ─── Equipment Service ────────────────────────────────────────────────────────
// All data access for the Equipment section goes through this file.
// Currently returns mock data for detail pages; equipment list fetches from
// Supabase. Replace other function bodies with Supabase queries when ready.`,
  `// ─── Equipment compatibility and operational service ─────────────────────────
// This public module currently bridges legacy/demo route adapters and operational
// Supabase readers. Live pilot routes use equipmentLiveTrust and
// equipmentPilotEvidence. Add new domain readers to focused modules rather than
// expanding this compatibility surface.`,
  "service ownership header",
);
for (const [from, to] of [
  ["getEquipmentWorkOrders Supabase error, using mock:", "getEquipmentWorkOrders Supabase error; returning no verified rows:"],
  ["getEquipmentWorkOrders threw, using mock:", "getEquipmentWorkOrders threw; returning no verified rows:"],
  ["getEquipmentPMs Supabase error, using mock:", "getEquipmentPMs Supabase error; returning no verified rows:"],
  ["getEquipmentPMs threw, using mock:", "getEquipmentPMs threw; returning no verified rows:"],
  ["getEquipmentSkills Supabase error, using mock:", "getEquipmentSkills Supabase error; returning legacy compatibility data:"],
]) {
  service = replaceRequired(service, from, to, from);
}
write(servicePath, service);

const contractPath = "scripts/equipment-live-service-boundary-contracts.mjs";
write(contractPath, `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(\`../\${path}\`, import.meta.url)), "utf8");
const lineCount = (value) => value.trimEnd().split("\\n").length;

const views = read("src/screens/Equipment/EquipmentLiveEvidenceViews.tsx");
const shared = read("src/screens/Equipment/EquipmentPilotEvidenceShared.tsx");
const routes = read("src/screens/Equipment/EquipmentLiveRoutes.tsx");
const service = read("src/screens/Equipment/equipmentService.ts");

assert.ok(lineCount(views) <= 350, "EquipmentLiveEvidenceViews must remain a focused workflow composition module.");
assert.match(views, /from "\\.\\/EquipmentPilotEvidenceShared"/);
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
assert.match(shared, /if \\(level === "Low"\\) return "border-lime-500/);

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
assert.doesNotMatch(service, /<PageFrame|<Metric|JSX\\.Element/);

console.log("Equipment live evidence and service boundary contracts passed.");
`);

const docsPath = "docs/equipment-live-service-boundaries.md";
write(docsPath, `# Equipment live evidence and service boundaries

## Audit outcome

The live evidence view module duplicated the request-state hook, page frame, metrics, loading state, evidence warning, refresh control, Ask Vorta control, date formatting and risk tone already owned by \`EquipmentPilotEvidenceShared.tsx\`. Those foundations are now shared.

The unused \`LiveEquipmentWorkOrdersView\` implementation was removed. The live Work Orders route remains owned by \`LiveEquipmentWorkOrdersPilotView.tsx\`, including execution readiness and SAP evidence.

## equipmentService decision

\`equipmentService.ts\` remains a compatibility surface for this batch. It mixes legacy/demo adapters, operational dashboard readers, risk planning, knowledge search and older Equipment tabs, so splitting it by line count would create broad import churn without improving pilot behaviour.

New readers must not be added there by default. Prefer focused service modules such as \`equipmentLiveTrust.ts\` and \`equipmentPilotEvidence.ts\`. A future service extraction should be domain-led and preserve the existing public exports until consumers move deliberately.

## Fallback language

Service diagnostics must describe what the function actually returns. Work Orders and PM readers return empty verified states on failure, not mock rows. Skills retains legacy compatibility data for older demo routes and labels that behaviour explicitly.

## Protected behaviour

- Live Equipment routes remain site-scoped and fail closed.
- The pilot Work Orders, History and Documents modules are unchanged.
- No Supabase queries, RPC names, risk calculations or fallback return values changed.
- Shift Cover and the Maintenance Manager dashboard are outside this change.
`);

const packagePath = "package.json";
const packageJson = JSON.parse(read(packagePath));
const contractCommand = "node scripts/equipment-live-service-boundary-contracts.mjs";
if (!packageJson.scripts["test:contracts"].includes(contractCommand)) {
  packageJson.scripts["test:contracts"] += ` && ${contractCommand}`;
}
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

for (const temporaryPath of [
  ".github/workflows/run-equipment-live-service-audit.yml",
  "docs/audits/.equipment-live-service-audit-trigger",
  "scripts/audit-equipment-live-service.mjs",
]) {
  rmSync(temporaryPath, { force: true });
}

console.log("Applied focused Equipment live evidence and service boundary patch.");
