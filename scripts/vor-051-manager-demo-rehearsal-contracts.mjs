import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const browserTest = read("tests/browser/vor-051-manager-demo-rehearsal.spec.ts");
const workflow = read(".github/workflows/vor-051-validation.yml");
const playwright = read("playwright.config.ts");
const packageJson = JSON.parse(read("package.json"));

for (const marker of [
  '"phone-360"',
  '"laptop-1366"',
  'data-vorta-dashboard-root="true"',
  "Fill Finish",
  "View work plan",
  "Recommended Work Queue",
  "FD-03",
  "FD-03-PLC-01",
  "WO-260706",
  "Gareth Owen",
  "Sophie Bennett",
  "Vacuum Systems",
  "FD-03 Approved Fault-Finding Guide",
  "Open FD-03 spares",
  "record=FD-03-PLC-01&from=ai",
  "Close global assistant",
  "expectNoPageOverflow",
  "vorta-build.json",
  "EXPECTED_HEAD_SHA",
]) {
  assert.ok(
    browserTest.includes(marker),
    `Missing VOR-051 rehearsal marker: ${marker}`,
  );
}

assert.ok(
  browserTest.includes("resolveFd03EquipmentId") &&
    browserTest.includes("const match = new URL(page.url()).pathname.match") &&
    browserTest.includes("return decodeURIComponent"),
  "The rehearsal must resolve the real equipment route rather than hard-code a database UUID",
);
assert.match(
  browserTest,
  /page\.route\("\*\*\/api\/ask-vorta"/,
  "The browser rehearsal must isolate UI continuity from the separately throttled live-answer gate",
);
assert.match(
  browserTest,
  /capturedRequest[\s\S]*?pageContext: \{ path: "\/dashboard" \}/,
  "Ask Vorta must receive the dashboard context used in the manager journey",
);
assert.match(
  browserTest,
  /actionPlan: \[\]/,
  "The rehearsal answer must not expose an operational action-draft control",
);
assert.match(
  browserTest,
  /Prepare action draft[\s\S]*?toHaveCount\(0\)/,
  "The rehearsal must fail if an unapproved action-draft control appears",
);
for (const unsafeClaim of [
  "create a maintenance notification",
  "create a work order",
  "submit to sap",
  "vorta work request",
  "safe to release without testing",
]) {
  assert.ok(
    browserTest.includes(unsafeClaim),
    `The rehearsal must reject unsafe operational wording: ${unsafeClaim}`,
  );
}
assert.ok(
  browserTest.includes("await page.goBack();") &&
    browserTest.includes("await page.waitForURL(/\\/dashboard"),
  "Evidence review must return to the manager dashboard context",
);
assert.match(
  browserTest,
  /writeFileSync\(manifestPath, JSON\.stringify\(manifest, null, 2\)\)/,
  "The rehearsal must preserve a machine-readable journey manifest",
);
assert.ok(
  (browserTest.match(/testInfo\.attach/g) ?? []).length >= 4,
  "The successful rehearsal must retain its manifest and three visual checkpoints",
);

assert.match(
  playwright,
  /name: "phone-360"/,
  "The approved phone project must remain available",
);
assert.match(
  playwright,
  /name: "laptop-1366"/,
  "The approved laptop project must remain available",
);
assert.equal(
  packageJson.scripts["test:browser:vor051"],
  "playwright test --config=playwright.config.ts tests/browser/vor-051-manager-demo-rehearsal.spec.ts --project=phone-360 --project=laptop-1366",
);

for (const marker of [
  "Wait for exact Netlify preview commit",
  "EXPECTED_HEAD_SHA",
  "VORTA_E2E_BASE_URL",
  "tests/browser/vor-051-manager-demo-rehearsal.spec.ts",
  "--project=phone-360",
  "--project=laptop-1366",
  "dist/vorta-build.json",
  "playwright-report",
  "test-results",
]) {
  assert.ok(workflow.includes(marker), `Missing VOR-051 workflow marker: ${marker}`);
}
assert.ok(
  workflow.indexOf("Wait for exact Netlify preview commit") <
    workflow.indexOf("Run authenticated phone and laptop manager rehearsal"),
  "The browser rehearsal must run only after the exact preview head is published",
);
assert.doesNotMatch(
  workflow,
  /eval:ask-vorta:vor0(?:48|49)/,
  "VOR-051 must not compete with the central authenticated live-evaluation account",
);
assert.match(
  workflow,
  /cancel-in-progress: true/,
  "Superseded rehearsal runs must not consume preview and browser capacity",
);

console.log("VOR-051 Maintenance Manager demo rehearsal contracts passed.");
