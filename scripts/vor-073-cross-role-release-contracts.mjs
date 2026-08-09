import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const browser = read("tests/browser/vor-073-cross-role-release.spec.ts");
const router = read("src/index.tsx");
const auth = read("src/lib/auth.tsx");
const workflow = read(".github/workflows/vor-073-cross-role-release.yml");
const runner = read("scripts/run-contract-suite.mjs");
const production = read("src/screens/ProductionManager/ProductionManagerPortal.tsx");
const operator = read("src/screens/OperatorPortal/OperatorPortal.tsx");
const contractor = read("src/screens/ContractorPortal/ContractorPortal.tsx");

const checks = [];
const check = (label, condition) => {
  checks.push({ label, condition: Boolean(condition) });
};

const roleCases = [
  ["engineer", "/engineer/dashboard", "/engineer/skills"],
  ["contractor_admin", "/contractor/dashboard", "/contractor/assignments"],
  ["contractor_engineer", "/contractor/dashboard", "/contractor/assignments"],
  ["production_manager", "/production/dashboard", "/production/risk"],
  ["operator", "/operator/dashboard", "/operator/shift"],
  ["maintenance_planner", "/planner/planner-dashboard", "/planner/support"],
  ["reliability_engineer", "/dashboard", "/historical-validation"],
  ["site_admin", "/dashboard", "/engineers"],
];

for (const [role, home, core] of roleCases) {
  check(`browser release matrix includes ${role}`, browser.includes(`role: "${role}"`));
  check(`${role} home is exercised`, browser.includes(`homePath: "${home}"`));
  check(`${role} core route is exercised`, browser.includes(`corePath: "${core}"`));
}

check(
  "browser proof establishes a real protected session in the active tab",
  browser.includes("await signInMaintenanceManager(page)"),
);
check(
  "browser proof removes only the demo-admin bypass before ordinary-role simulation",
  browser.includes("removeBrowserDemoAdminBypass") &&
    browser.includes("appMetadataValue.demo_admin = false"),
);
check(
  "sessionStorage is explicitly covered because storageState cannot preserve it",
  browser.includes("window.sessionStorage") && browser.includes("window.localStorage"),
);
check(
  "role simulation preserves real site rows and changes only browser responses",
  browser.includes("context.route(userSiteAccessRoute") &&
    browser.includes("context.route(profileRoute") &&
    browser.includes("route.fetch()") &&
    browser.includes("route.fulfill"),
);
check(
  "no browser proof mutates Supabase grants",
  !browser.match(/supabase\s*\.\s*from\([^)]*user_site_access[^)]*\)\s*\.\s*(insert|update|upsert|delete)/s),
);
check(
  "every role proves a forbidden cross-role redirect",
  browser.includes("forbiddenPath") &&
    browser.includes("await page.goto(roleCase.forbiddenPath)") &&
    browser.includes("routePattern(roleCase.homePath)"),
);
check(
  "core journeys use the shared portal navigation rather than URL-only smoke",
  browser.includes("clickPortalNavigation") &&
    browser.includes('name: "Open menu"') &&
    browser.includes('data-vorta-desktop-sidebar'),
);
check(
  "role journeys reject horizontal page overflow",
  browser.includes("expectNoPageOverflow(page)"),
);
check(
  "prototype roles require the explicit non-operational state",
  browser.includes('"Prototype · non-operational"') &&
    browser.includes('"Operational data is not connected for this role yet"'),
);
check(
  "prototype proof rejects known synthetic operational evidence",
  browser.includes("91% AI Confidence") &&
    browser.includes("Operator absence logged"),
);
check(
  "allowed and denied site RPC evidence is exercised",
  browser.includes("verifyAllowedAndDeniedSiteBoundary") &&
    browser.includes("p_site_id: allowedSiteId") &&
    browser.includes("p_site_id: deniedSiteId") &&
    browser.includes("expect(await denied.json()).toBeNull()"),
);
check(
  "browser token recovery covers the real sessionStorage policy",
  browser.includes("storedAccessToken") && browser.includes("currentSession?.access_token"),
);
check(
  "the 390px narrow-phone checkpoint is explicit",
  browser.includes("width: 390") && browser.includes("height: 844"),
);

check(
  "router still protects Engineer with the Engineer role",
  router.includes('path="/engineer/*"') && router.includes('<RequireRole role="engineer">'),
);
check(
  "router still protects both Contractor roles",
  router.includes('"contractor_admin"') && router.includes('"contractor_engineer"'),
);
check(
  "router still protects Production Manager, Operator and Planner separately",
  router.includes('role="production_manager"') &&
    router.includes('role="operator"') &&
    router.includes('role="maintenance_planner"'),
);
check(
  "maintenance boundary still accepts only the approved manager roles",
  router.includes('"maintenance_manager"') &&
    router.includes('"site_admin"') &&
    router.includes('"reliability_engineer"'),
);
check(
  "ordinary users still require a site context",
  auth.includes("!siteContext") && auth.includes("active Vorta site assignment"),
);
check(
  "global demo-admin bypass remains deliberate and explicit",
  auth.includes("resolveDemoAdmin") && auth.includes("hasGlobalAdminAccess"),
);

for (const [name, source] of [
  ["Production Manager", production],
  ["Operator", operator],
  ["Contractor", contractor],
]) {
  check(`${name} portal remains truth-gated`, source.includes("PrototypePortalUnavailable"));
}

for (const project of [
  "phone-360",
  "samsung-tablet-portrait",
  "samsung-tablet-landscape",
  "desktop-1920",
]) {
  check(`workflow runs ${project}`, workflow.includes(`--project=${project}`));
}
check(
  "workflow reruns the multi-site isolation contract",
  workflow.includes("vor-063-multi-site-context-contracts.mjs"),
);
check(
  "workflow reruns the future-role truth contract",
  workflow.includes("vor-071-future-role-data-truth-contracts.mjs"),
);
check(
  "workflow runs the dedicated browser matrix",
  workflow.includes("vor-073-cross-role-release.spec.ts"),
);
check(
  "cross-role release contract is permanent",
  runner.includes("vor-073-cross-role-release-contracts.mjs"),
);

const failed = checks.filter((item) => !item.condition);
for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} - ${item.label}`);
}

if (failed.length > 0) {
  console.error(`VOR-073 cross-role release contract failed: ${failed.length}/${checks.length}.`);
  process.exit(1);
}

console.log(`VOR-073 cross-role release contracts passed: ${checks.length}/${checks.length}.`);
