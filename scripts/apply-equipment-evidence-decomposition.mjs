import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const equipmentDir = join(root, "src/screens/Equipment");
const sourcePath = join(equipmentDir, "EquipmentPilotEvidenceViews.tsx");
const source = readFileSync(sourcePath, "utf8");
const sourceFile = ts.createSourceFile(
  sourcePath,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function declaration(name) {
  const match = sourceFile.statements.find((statement) => {
    if (
      !ts.isFunctionDeclaration(statement) &&
      !ts.isInterfaceDeclaration(statement)
    ) {
      return false;
    }
    return statement.name?.text === name;
  });

  assert.ok(match, `Missing top-level declaration: ${name}`);
  return match;
}

function declarationText(name) {
  const node = declaration(name);
  return source.slice(node.getStart(sourceFile), node.getEnd());
}

function exportedFunction(name) {
  const text = declarationText(name);
  return text.startsWith("export ")
    ? text
    : text.replace(/^function\s+/, "export function ");
}

function write(relativePath, content) {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${content.trim()}\n`, "utf8");
}

const shared = `
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { openMaintenanceAiAssistant } from "../../lib/maintenanceActions";
import {
  EquipmentTabNavigation,
  type EquipmentTabRoute,
} from "./EquipmentTabNavigation";
import type {
  LiveDataState,
  LiveEquipmentRecord,
} from "./equipmentLiveTrust";
import type { LiveEquipmentDocumentSummary } from "./equipmentPilotEvidence";

${declarationText("EvidenceHookState")}

${declarationText("unavailableState")}

${exportedFunction("usePilotEvidence")}

${exportedFunction("formatDate")}

${exportedFunction("formatDateTime")}

${exportedFunction("formatQuantity")}

${exportedFunction("safeExternalUrl")}

${exportedFunction("riskTone")}

${exportedFunction("statusTone")}

${exportedFunction("PageFrame")}

${exportedFunction("Metric")}

${exportedFunction("EvidenceStateMessage")}

${exportedFunction("LoadingEvidence")}

${exportedFunction("RefreshButton")}

${exportedFunction("AskVortaButton")}

${exportedFunction("documentStatusTone")}
`;

const workEvidenceDetails = `
import {
  ClipboardCheck,
  Database,
  PackageCheck,
} from "lucide-react";
import type { LiveEquipmentHistoryItem } from "./equipmentPilotEvidence";
import {
  formatDate,
  formatDateTime,
  formatQuantity,
} from "./EquipmentPilotEvidenceShared";

${exportedFunction("WorkEvidenceDetails")}

${declarationText("EvidenceList")}
`;

const workOrders = `
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  loadLiveEquipmentWorkItems,
  type LiveEquipmentRecord,
  type LiveWorkItem,
} from "./equipmentLiveTrust";
import {
  buildWorkEvidenceCitation,
  isLiveWorkItemCompleted,
  isLiveWorkItemOverdue,
  loadLiveEquipmentHistory,
  type LiveEquipmentHistoryItem,
} from "./equipmentPilotEvidence";
import { WorkEvidenceDetails } from "./EquipmentWorkEvidenceDetails";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  Metric,
  PageFrame,
  RefreshButton,
  formatDate,
  statusTone,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

${declarationText("readinessTone")}

${declarationText("average")}

${declarationText("reservationReadiness")}

${declarationText("LiveEquipmentWorkOrdersPilotView")}
`;

const history = `
import {
  ChevronDown,
  ChevronRight,
  History,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { LiveEquipmentRecord } from "./equipmentLiveTrust";
import {
  buildWorkEvidenceCitation,
  loadLiveEquipmentHistory,
} from "./equipmentPilotEvidence";
import { WorkEvidenceDetails } from "./EquipmentWorkEvidenceDetails";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  Metric,
  PageFrame,
  RefreshButton,
  formatDate,
  statusTone,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

${declarationText("LiveEquipmentHistoryView")}
`;

const documents = `
import {
  BookOpen,
  ChevronRight,
  FileSearch,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LiveEquipmentRecord } from "./equipmentLiveTrust";
import {
  buildDocumentCitation,
  loadLiveEquipmentDocuments,
} from "./equipmentPilotEvidence";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  Metric,
  PageFrame,
  RefreshButton,
  documentStatusTone,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

${declarationText("LiveEquipmentDocumentsView")}
`;

const documentViewer = `
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { LiveEquipmentRecord } from "./equipmentLiveTrust";
import {
  buildDocumentCitation,
  loadLiveEquipmentDocument,
  type LiveEquipmentDocument,
} from "./equipmentPilotEvidence";
import {
  AskVortaButton,
  EvidenceStateMessage,
  LoadingEvidence,
  PageFrame,
  RefreshButton,
  documentStatusTone,
  formatDate,
  safeExternalUrl,
  usePilotEvidence,
} from "./EquipmentPilotEvidenceShared";

${declarationText("LiveEquipmentDocumentViewerView")}
`;

write(
  "src/screens/Equipment/EquipmentPilotEvidenceShared.tsx",
  shared,
);
write(
  "src/screens/Equipment/EquipmentWorkEvidenceDetails.tsx",
  workEvidenceDetails,
);
write(
  "src/screens/Equipment/LiveEquipmentWorkOrdersPilotView.tsx",
  workOrders,
);
write(
  "src/screens/Equipment/LiveEquipmentHistoryView.tsx",
  history,
);
write(
  "src/screens/Equipment/LiveEquipmentDocumentsView.tsx",
  documents,
);
write(
  "src/screens/Equipment/LiveEquipmentDocumentViewerView.tsx",
  documentViewer,
);

const routesPath = join(equipmentDir, "EquipmentLiveRoutes.tsx");
let routes = readFileSync(routesPath, "utf8");
const oldPilotImport = `import {
  LiveEquipmentDocumentViewerView,
  LiveEquipmentDocumentsView,
  LiveEquipmentHistoryView,
  LiveEquipmentWorkOrdersPilotView,
} from "./EquipmentPilotEvidenceViews";`;
const directPilotImports = `import { LiveEquipmentDocumentViewerView } from "./LiveEquipmentDocumentViewerView";
import { LiveEquipmentDocumentsView } from "./LiveEquipmentDocumentsView";
import { LiveEquipmentHistoryView } from "./LiveEquipmentHistoryView";
import { LiveEquipmentWorkOrdersPilotView } from "./LiveEquipmentWorkOrdersPilotView";`;
assert.ok(routes.includes(oldPilotImport), "Expected pilot-evidence route import was not found.");
routes = routes.replace(oldPilotImport, directPilotImports);
writeFileSync(routesPath, routes, "utf8");

const postAuditPath = join(root, "scripts/post-audit-p0-contracts.mjs");
let postAudit = readFileSync(postAuditPath, "utf8");
const oldPilotRead = `  read("src/screens/Equipment/EquipmentPilotEvidenceViews.tsx"),`;
const newPilotRead = `  Promise.all([
    read("src/screens/Equipment/EquipmentPilotEvidenceShared.tsx"),
    read("src/screens/Equipment/EquipmentWorkEvidenceDetails.tsx"),
    read("src/screens/Equipment/LiveEquipmentWorkOrdersPilotView.tsx"),
    read("src/screens/Equipment/LiveEquipmentHistoryView.tsx"),
    read("src/screens/Equipment/LiveEquipmentDocumentsView.tsx"),
    read("src/screens/Equipment/LiveEquipmentDocumentViewerView.tsx"),
  ]).then((parts) => parts.join("\\n")),`;
assert.ok(postAudit.includes(oldPilotRead), "Expected pilot-evidence contract read was not found.");
postAudit = postAudit.replace(oldPilotRead, newPilotRead);
writeFileSync(postAuditPath, postAudit, "utf8");

const boundaryContract = `
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(\`../\${path}\`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");
const lineCount = (value) => value.trimEnd().split("\\n").length;

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
  assert.ok(lineCount(content) <= maximumLines, \`\${path} exceeds its focused module boundary of \${maximumLines} lines.\`);
  assert.doesNotMatch(content, /EquipmentPilotEvidenceViews/);
}

const routes = read("src/screens/Equipment/EquipmentLiveRoutes.tsx");
for (const moduleName of [
  "LiveEquipmentWorkOrdersPilotView",
  "LiveEquipmentHistoryView",
  "LiveEquipmentDocumentsView",
  "LiveEquipmentDocumentViewerView",
]) {
  assert.match(routes, new RegExp(\`from "\\./\${moduleName}"\`));
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
`;
write("scripts/equipment-module-boundary-contracts.mjs", boundaryContract);

const packagePath = join(root, "package.json");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const boundaryCommand = "node scripts/equipment-module-boundary-contracts.mjs";
if (!packageJson.scripts["test:contracts"].includes(boundaryCommand)) {
  packageJson.scripts["test:contracts"] = `${packageJson.scripts["test:contracts"]} && ${boundaryCommand}`;
}
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

write(
  "docs/equipment-evidence-module-boundaries.md",
  `# Equipment pilot-evidence module boundaries

The live Equipment pilot-evidence UI is split by user workflow rather than kept in one combined implementation file.

## Boundaries

- \`EquipmentPilotEvidenceShared.tsx\` owns the request-state hook, trusted page frame, shared metrics, evidence states and formatting helpers.
- \`EquipmentWorkEvidenceDetails.tsx\` owns confirmation, reservation and goods-movement detail rendering shared by Work Orders and History.
- \`LiveEquipmentWorkOrdersPilotView.tsx\` owns execution readiness and the work-order register.
- \`LiveEquipmentHistoryView.tsx\` owns searchable maintenance history.
- \`LiveEquipmentDocumentsView.tsx\` owns the controlled-document register.
- \`LiveEquipmentDocumentViewerView.tsx\` owns controlled-source and indexed-section viewing.

\`EquipmentLiveRoutes.tsx\` imports each route implementation directly. The former combined \`EquipmentPilotEvidenceViews.tsx\` module is intentionally removed rather than retained as a compatibility barrel.

## Change rules

Keep site scoping, evidence loading and fail-closed behaviour in their existing service modules. Do not move data fetching into route registration or merge the workflow views back together. Any shared UI added to the shared module must be used by more than one workflow.
`,
);

rmSync(sourcePath);

const references = [];
for (const path of [
  routesPath,
  postAuditPath,
  join(root, "src/screens/Equipment/index.ts"),
]) {
  if (!existsSync(path)) continue;
  const content = readFileSync(path, "utf8");
  if (content.includes("EquipmentPilotEvidenceViews")) {
    references.push(relative(root, path));
  }
}
assert.deepEqual(references, [], `Legacy pilot-evidence imports remain: ${references.join(", ")}`);

console.log("Equipment pilot-evidence module decomposition applied.");
