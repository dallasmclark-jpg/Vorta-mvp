import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const contracts = [
  ["Authentication routes", "scripts/auth-route-contracts.mjs"],
  ["Maintenance session recovery", "scripts/maintenance-session-recovery-contracts.mjs"],
  ["Work-order overlays", "scripts/work-order-overlay-contracts.mjs"],
  ["Maintenance dashboard", "scripts/maintenance-dashboard-contracts.mjs"],
  ["Dashboard deep links", "scripts/vor-004-dashboard-deep-links-contract.mjs"],
  ["VOR-007 to VOR-013 audit improvements", "scripts/vor-007-013-audit-improvements-contracts.mjs"],
  ["VOR-014 Stores Inventory", "scripts/vor-014-stores-inventory-contracts.mjs"],
  ["VOR-018 selected tab outlines", "scripts/vor-018-selected-tab-outline-contracts.mjs"],
  ["VOR-019 engineer summary filters", "scripts/vor-019-engineer-summary-filters-contracts.mjs"],
  ["VOR-032 dashboard critical spares", "scripts/vor-032-dashboard-critical-spares-contracts.mjs"],
  ["VOR-033 demo dataset credibility", "scripts/vor-033-demo-dataset-credibility-contracts.mjs"],
  ["VOR-033 connected demo storylines", "scripts/vor-033-demo-storyline-contracts.mjs"],
  ["VOR-033 Ask Vorta golden suite", "scripts/vor-033-ask-vorta-golden-contracts.mjs"],
  ["VOR-033 demo restore", "scripts/vor-033-demo-restore-contracts.mjs"],
  ["VOR-034 verified imagery", "scripts/vor-034-verified-images-contract.mjs"],
  ["VOR-037 unified Ask Vorta", "scripts/vor-037-unified-ask-vorta-contracts.mjs"],
  ["VOR-038 Ask Vorta intelligence", "scripts/vor-038-ask-vorta-intelligence-contracts.mjs"],
  ["VOR-039 Ask Vorta confidence and latency", "scripts/vor-039-ask-vorta-confidence-latency-contracts.mjs"],
  ["VOR-040 natural Ask Vorta questions", "scripts/vor-040-natural-question-contracts.mjs"],
  ["VOR-041 Ask Vorta workspace", "scripts/vor-041-ask-vorta-workspace-contracts.mjs"],
  ["VOR-042 Ask Vorta response hierarchy", "scripts/vor-042-ask-vorta-polish-contracts.mjs"],
  ["VOR-043 exact document intelligence", "scripts/vor-043-exact-document-intelligence-contracts.mjs"],
  ["VOR-044 operational value ranking", "scripts/vor-044-operational-value-ranking-contracts.mjs"],
  ["VOR-045 conversational context", "scripts/vor-045-conversation-context-contracts.mjs"],
  ["VOR-046 photo and OCR diagnosis", "scripts/vor-046-photo-ocr-contracts.mjs"],
  ["VOR-047 confirmed handover actions", "scripts/vor-047-confirmed-handover-contracts.mjs"],
  ["VOR-048 routing, telemetry and feedback", "scripts/vor-048-routing-telemetry-feedback-contracts.mjs"],
  ["VOR-049 decision-ready equipment", "scripts/vor-049-decision-ready-equipment-contracts.mjs"],
  ["VOR-050 live evaluation orchestration", "scripts/vor-050-live-eval-orchestration-contracts.mjs"],
  ["VOR-051 Maintenance Manager demo rehearsal", "scripts/vor-051-manager-demo-rehearsal-contracts.mjs"],
  ["VOR-052 Ask Vorta backend modularisation", "scripts/vor-052-backend-modularisation-contracts.mjs"],
  ["VOR-053 canonical Ask Vorta build", "scripts/vor-053-canonical-build-contracts.mjs"],
  ["VOR-055 Ask Vorta production verification", "scripts/vor-055-production-verification-contracts.mjs"],
  ["VOR-056 actionable backlog decisions", "scripts/vor-056-backlog-action-plan-contracts.mjs"],
  ["VOR-020 to VOR-024 audit actions", "scripts/vor-020-024-audit-actions-contracts.mjs"],
  ["Mobile dashboard", "scripts/mobile-dashboard-contracts.mjs"],
  ["Mobile portal audit", "scripts/mobile-portal-audit-contracts.mjs"],
  ["Final mobile portal polish", "scripts/mobile-portal-final-polish-contracts.mjs"],
  ["Mobile typography", "scripts/mobile-typography-contracts.mjs"],
  ["Shared card surfaces", "scripts/card-surface-contracts.mjs"],
  ["Tablet presentation recovery", "scripts/tablet-presentation-contracts.mjs"],
  ["Maintenance portal workflow", "scripts/maintenance-portal-workflow-contracts.mjs"],
  ["Requirements live evidence", "scripts/requirements-live-evidence-contracts.mjs"],
  ["Engineers live evidence", "scripts/engineers-live-evidence-contracts.mjs"],
  ["Skills Matrix", "scripts/skills-matrix-contracts.mjs"],
  ["Read-only training workflows", "scripts/read-only-training-workflow-contracts.mjs"],
  ["Live Career, Support and Settings", "scripts/live-career-support-settings-contracts.mjs"],
  ["Pilot release security", "scripts/pilot-release-security-contracts.mjs"],
  ["Pilot resilience and performance", "scripts/pilot-resilience-performance-contracts.mjs"],
  ["Equipment people workflow", "scripts/equipment-people-workflow-contracts.mjs"],
  ["Equipment tab continuity", "scripts/equipment-tab-continuity-contracts.mjs"],
  ["Maintenance P1 and P2", "scripts/maintenance-p1-p2-contracts.mjs"],
  ["Data trust", "scripts/data-trust-contracts.mjs"],
  ["Post-audit P0", "scripts/post-audit-p0-contracts.mjs"],
  ["Audit remediation", "scripts/audit-remediation-contracts.mjs"],
  ["Accessibility navigation", "scripts/accessibility-navigation-contracts.mjs"],
  ["RPC security manifest", "scripts/rpc-security-manifest-contracts.mjs"],
  ["Demo backend health", "scripts/demo-backend-health-contracts.mjs"],
  ["Live backend health gate", "scripts/live-backend-health-gate-contracts.mjs"],
  ["Equipment module boundaries", "scripts/equipment-module-boundary-contracts.mjs"],
  ["Equipment live service boundaries", "scripts/equipment-live-service-boundary-contracts.mjs"],
  ["Shift Handover", "scripts/shift-handover-contracts.mjs"],
  ["Ask Vorta agent", "scripts/ask-vorta-agent-contracts.mjs"],
  ["Repository hygiene", "scripts/repository-hygiene-contracts.mjs"],
];

const legacyAskVortaContractLabels = new Set([
  "VOR-033 Ask Vorta golden suite",
  "VOR-037 unified Ask Vorta",
  "VOR-038 Ask Vorta intelligence",
  "VOR-039 Ask Vorta confidence and latency",
  "VOR-040 natural Ask Vorta questions",
  "VOR-043 exact document intelligence",
  "Equipment people workflow",
  "Ask Vorta agent",
]);
const askVortaEntrypoint = resolve(repositoryRoot, "netlify/functions/ask-vorta.mts");
const askVortaModuleDirectory = resolve(repositoryRoot, "netlify/functions/ask-vorta");
const askVortaEntrypointSource = readFileSync(askVortaEntrypoint, "utf8");
const askVortaLegacyContractSurface = [
  askVortaEntrypointSource,
  ...readdirSync(askVortaModuleDirectory)
    .filter((name) => name.endsWith(".mts"))
    .sort()
    .map((name) => readFileSync(resolve(askVortaModuleDirectory, name), "utf8")),
].join("\n\n");

const filters = process.argv.slice(2).map((value) => value.trim().toLowerCase()).filter(Boolean);
const selectedContracts = filters.length === 0
  ? contracts
  : contracts.filter(([label, path]) => {
      const searchable = `${label} ${path}`.toLowerCase();
      return filters.some((filter) => searchable.includes(filter));
    });

if (selectedContracts.length === 0) {
  console.error(`No contract groups matched: ${filters.join(", ")}`);
  console.error("Available groups:");
  for (const [label] of contracts) console.error(`- ${label}`);
  process.exit(1);
}

const failures = [];
const suiteStartedAt = Date.now();

for (const [label, path] of selectedContracts) {
  const startedAt = Date.now();
  console.log(`\n▶ ${label}`);

  const useLegacyAskVortaSurface = legacyAskVortaContractLabels.has(label);
  let result;
  try {
    if (useLegacyAskVortaSurface) {
      writeFileSync(askVortaEntrypoint, askVortaLegacyContractSurface);
    }
    result = spawnSync(process.execPath, [resolve(repositoryRoot, path)], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
    });
  } finally {
    if (useLegacyAskVortaSurface) {
      writeFileSync(askVortaEntrypoint, askVortaEntrypointSource);
    }
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (result.status === 0) {
    console.log(`✓ ${label} (${seconds}s)`);
    continue;
  }

  failures.push({ label, path, status: result.status, signal: result.signal });
  console.error(`✗ ${label} (${seconds}s)`);
}

const suiteSeconds = ((Date.now() - suiteStartedAt) / 1000).toFixed(1);
console.log(`\nContract suite finished: ${selectedContracts.length - failures.length}/${selectedContracts.length} passed in ${suiteSeconds}s.`);

if (failures.length > 0) {
  console.error("\nFailed contract groups:");
  for (const failure of failures) {
    const reason = failure.signal ? `signal ${failure.signal}` : `exit ${failure.status ?? "unknown"}`;
    console.error(`- ${failure.label}: ${failure.path} (${reason})`);
  }
  process.exit(1);
}