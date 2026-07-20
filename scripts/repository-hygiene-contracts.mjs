import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const resolve = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(resolve(path), "utf8");

const readme = read("README.md");
assert.doesNotMatch(readme, /automatically generated|animaapp/i);
for (const requiredText of [
  "Maintenance Manager",
  "VITE_VORTA_DATA_MODE",
  "npm run test:contracts",
  "Data trust modes",
  "Netlify",
  "docs/development-and-release.md",
]) {
  assert.match(readme, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

const environmentExample = read(".env.example");
for (const variable of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_VORTA_DATA_MODE",
  "VORTA_E2E_EMAIL",
  "VORTA_E2E_PASSWORD",
  "VORTA_E2E_BASE_URL",
]) {
  assert.match(environmentExample, new RegExp(`^${variable}=`, "m"));
}
assert.doesNotMatch(environmentExample, /sb_service_role|service_role\s*=/i);

const gitignore = read(".gitignore");
assert.match(gitignore, /^\.env$/m);
assert.match(gitignore, /^\.env\.\*$/m);
assert.match(gitignore, /^!\.env\.example$/m);

const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.scripts["test:contracts"], "node scripts/run-contract-suite.mjs");
assert.doesNotMatch(packageJson.scripts["test:contracts"], /&&/);

const contractRunner = read("scripts/run-contract-suite.mjs");
const expectedContracts = [
  "auth-route-contracts.mjs",
  "work-order-overlay-contracts.mjs",
  "maintenance-dashboard-contracts.mjs",
  "maintenance-portal-workflow-contracts.mjs",
  "skills-matrix-contracts.mjs",
  "equipment-people-workflow-contracts.mjs",
  "maintenance-p1-p2-contracts.mjs",
  "data-trust-contracts.mjs",
  "post-audit-p0-contracts.mjs",
  "audit-remediation-contracts.mjs",
  "accessibility-navigation-contracts.mjs",
  "rpc-security-manifest-contracts.mjs",
  "demo-backend-health-contracts.mjs",
  "live-backend-health-gate-contracts.mjs",
  "equipment-module-boundary-contracts.mjs",
  "equipment-live-service-boundary-contracts.mjs",
  "repository-hygiene-contracts.mjs",
];
for (const contract of expectedContracts) assert.match(contractRunner, new RegExp(contract.replaceAll(".", "\\.")));
assert.equal(new Set(expectedContracts).size, expectedContracts.length);
assert.match(contractRunner, /filters\.some/);
assert.match(contractRunner, /Failed contract groups/);

for (const requiredFile of [
  "docs/development-and-release.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug-report.yml",
  ".github/ISSUE_TEMPLATE/improvement.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
]) {
  assert.equal(existsSync(resolve(requiredFile)), true, `${requiredFile} must exist.`);
}

const developmentGuide = read("docs/development-and-release.md");
assert.match(developmentGuide, /exact head commit/i);
assert.match(developmentGuide, /commit_ref/);
assert.match(developmentGuide, /fail closed/i);

const pullRequestTemplate = read(".github/PULL_REQUEST_TEMPLATE.md");
for (const heading of ["Summary", "Scope", "Data trust", "Regression protection", "Validation", "Deployment verification"]) {
  assert.match(pullRequestTemplate, new RegExp(heading, "i"));
}

console.log("Repository documentation, issue intake and contract-runner hygiene passed.");
