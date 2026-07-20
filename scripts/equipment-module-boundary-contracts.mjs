import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");
const lineCount = (value) => value.trimEnd().split("\n").length;

const legacyPath = "src/screens/Equipment/EquipmentPilotEvidenceViews.tsx";
assert.equal(existsSync(resolve(legacyPath)), false, "The legacy combined pilot-evidence module must remain removed.");

const boundaries = [
  ["src/screens/Equipment/EquipmentPilotEvidenceShared.tsx", 330],
  ["src/screens/Equipment/EquipmentWorkEvidenceDetails.tsx", 140],
  ["src/screens/Equipment/LiveEquipmentWorkOrdersPilotView.tsx", 430],
  ["src/screens/Equipment/LiveEquipmentHistoryView.tsx", 230],
  ["src/screens/Equipment/LiveEquipmentDocumentsView.tsx", 230],
  ["src/screens/Equipment/LiveEquipmentDocumentViewerView.tsx", 230],
];

for (const [path, maximumLines] of boundaries) {
  const content = read(path);
  assert.ok(lineCount(content) <= maximumLines, `${path} exceeds its focused module boundary of ${maximumLines} lines.`);
  assert.doesNotMatch(content, /EquipmentPilotEvidenceViews/);
}

const routes = read("src/screens/Equipment/EquipmentLiveRoutes.tsx");
for (const moduleName of [
  "LiveEquipmentWorkOrdersPilotView",
  "LiveEquipmentHistoryView",
  "LiveEquipmentDocumentsView",
  "LiveEquipmentDocumentViewerView",
]) {
  assert.match(routes, new RegExp(`from "\./${moduleName}"`));
}
assert.doesNotMatch(routes, /EquipmentPilotEvidenceViews/);

const shared = read("src/screens/Equipment/EquipmentPilotEvidenceShared.tsx");
assert.match(shared, /export function usePilotEvidence/);
assert.match(shared, /requestVersion/);
assert.match(shared, /finally/);
assert.doesNotMatch(shared, /loadLiveEquipment(?:WorkItems|History|Documents|Document)/);

const workOrders = read("src/screens/Equipment/LiveEquipmentWorkOrdersPilotView.tsx");
assert.match(workOrders, /executionReadiness === null/);
assert.match(workOrders, /WorkEvidenceDetails/);
const history = read("src/screens/Equipment/LiveEquipmentHistoryView.tsx");
assert.match(history, /buildWorkEvidenceCitation/);
const documents = read("src/screens/Equipment/LiveEquipmentDocumentsView.tsx");
const viewer = read("src/screens/Equipment/LiveEquipmentDocumentViewerView.tsx");
assert.match(documents, /buildDocumentCitation/);
assert.match(viewer, /safeExternalUrl/);

console.log("Equipment pilot-evidence module boundary contracts passed.");
