import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const contracts = [
  ["Authentication routes", "scripts/auth-route-contracts.mjs"],
  ["Work-order overlays", "scripts/work-order-overlay-contracts.mjs"],
  ["Maintenance dashboard", "scripts/maintenance-dashboard-contracts.mjs"],
  ["Maintenance portal workflow", "scripts/maintenance-portal-workflow-contracts.mjs"],
  ["Requirements live evidence", "scripts/requirements-live-evidence-contracts.mjs"],
  ["Engineers live evidence", "scripts/engineers-live-evidence-contracts.mjs"],
  ["Skills Matrix", "scripts/skills-matrix-contracts.mjs"],
  ["Equipment people workflow", "scripts/equipment-people-workflow-contracts.mjs"],
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
  ["Repository hygiene", "scripts/repository-hygiene-contracts.mjs"],
];

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

  const result = spawnSync(process.execPath, [resolve(repositoryRoot, path)], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
  });

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (result.status === 0) {
    console.log(`✓ ${label} (${seconds}s)`);
    continue;
  }

  failures.push({
    label,
    path,
    status: result.status,
    signal: result.signal,
  });
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
