import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const browserTest = read("tests/browser/vor-051-manager-demo-rehearsal.spec.ts");
const dataTrustBanner = read("src/components/DataTrustBanner.tsx");
const workflow = read(".github/workflows/vor-051-validation.yml");
const playwright = read("playwright.config.ts");
const transformedAssistant = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");
const evidenceLinkIntegration = transformedAssistant;
const packageJson = JSON.parse(read("package.json"));

for (const marker of [
  '"phone-360"',
  '"laptop-1366"',
  'data-vorta-dashboard-root="true"',
  "Lyophilisation",
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
]) assert.ok(browserTest.includes(marker), `Missing VOR-051 rehearsal marker: ${marker}`);

assert.doesNotMatch(browserTest, /dashboardScope: "Fill Finish"/);
assert.match(browserTest, /dashboardScope: "Lyophilisation"/);
assert.match(browserTest, /data-vorta-data-mode=\\?"unavailable\\?"[\s\S]*?toHaveCount\(0/);

for (const marker of [
  "getProtectedEvidenceToken",
  "VORTA_E2E_EMAIL",
  "VORTA_E2E_PASSWORD",
  "auth/v1/token?grant_type=password",
  'email: protectedEmail',
  'password: protectedPassword',
  "payload?.access_token",
  "rest/v1/equipment_assets",
  'site_id: `eq.${siteId}`',
  'equipment_code: "eq.FD-03"',
  'Authorization: `Bearer ${accessToken}`',
  "expect(rows).toHaveLength(1)",
  'expect(rows[0]?.equipment_code).toBe("FD-03")',
]) assert.ok(browserTest.includes(marker), `Missing protected evidence marker: ${marker}`);

assert.doesNotMatch(browserTest, /getStoredSupabaseAccessToken/);
assert.ok(
  browserTest.indexOf('await page.goto("/dashboard")') <
    browserTest.indexOf("const equipmentId = await resolveFd03EquipmentId(page)"),
);
assert.doesNotMatch(browserTest, /page\.goto\("\/equipment"\)/);
assert.match(browserTest, /data-vorta-mobile-page-title=\\?"true\\?"[\s\S]*?toBeAttached\(\)[\s\S]*?toHaveText\("Operations Overview"\)/);
assert.match(browserTest, /locator\("h1:visible"\)[\s\S]*?Operations Overview[\s\S]*?toBeVisible\(\)/);
assert.match(browserTest, /page\.route\("\*\*\/api\/ask-vorta"/);
assert.match(browserTest, /capturedRequest[\s\S]*?pageContext: \{ path: "\/dashboard" \}/);
assert.match(browserTest, /actionPlan: \[\]/);
assert.match(browserTest, /Prepare action draft[\s\S]*?toHaveCount\(0\)/);
for (const unsafeClaim of [
  "create a maintenance notification",
  "create a work order",
  "submit to sap",
  "vorta work request",
  "safe to release without testing",
]) assert.ok(browserTest.includes(unsafeClaim));
assert.ok(browserTest.includes("await page.goBack();") && browserTest.includes("await page.waitForURL(/\\/dashboard"));
assert.match(browserTest, /writeFileSync\(manifestPath, JSON\.stringify\(manifest, null, 2\)\)/);
assert.ok((browserTest.match(/testInfo\.attach/g) ?? []).length >= 4);
assert.doesNotMatch(browserTest, /visibleAnswer:[\s\S]*?protectedPassword/);

for (const marker of [
  "getConfiguredDataMode",
  "data-vorta-data-unavailable-reason",
  '"deployment-mode"',
  '"active-site"',
  "verified the active site",
  "no verified active-site context",
]) assert.ok(dataTrustBanner.includes(marker));

for (const marker of [
  "evidenceLinks?: VortaAgentEvidenceLink[];",
  "evidenceLinks: agentAnswer.evidenceLinks,",
  "answer.evidenceLinks && answer.evidenceLinks.length > 0",
  'data-vorta-ai-evidence-links="true"',
  "Open in Vorta",
]) {
  assert.ok(transformedAssistant.includes(marker), `Missing canonical evidence marker: ${marker}`);
  assert.ok(evidenceLinkIntegration.includes(marker));
}
assert.match(
  transformedAssistant,
  /answer\.evidenceLinks[\s\S]*?<section[^>]*data-vorta-ai-evidence-links="true"/,
);
assert.equal(
  packageJson.scripts.predev,
  "node scripts/vor-053-canonical-build-contracts.mjs --quick",
);
assert.equal(
  packageJson.scripts["build:metadata"],
  "node scripts/write-build-metadata.mjs",
);

assert.match(playwright, /name: "phone-360"/);
assert.match(playwright, /name: "laptop-1366"/);
assert.equal(
  packageJson.scripts["test:browser:vor051"],
  "playwright test --config=playwright.config.ts tests/browser/vor-051-manager-demo-rehearsal.spec.ts --project=phone-360 --project=laptop-1366",
);

for (const marker of [
  "Wait for exact Netlify preview commit",
  "EXPECTED_HEAD_SHA",
  "VORTA_E2E_BASE_URL",
  "npm run test:browser:vor051",
  "dist/vorta-build.json",
  "playwright-report",
  "test-results",
  '"src/screens/AiOperations/**"',
]) assert.ok(workflow.includes(marker), `Missing VOR-051 workflow marker: ${marker}`);
assert.ok(
  workflow.indexOf("Wait for exact Netlify preview commit") <
    workflow.indexOf("Run authenticated phone and laptop manager rehearsal"),
);
assert.doesNotMatch(workflow, /eval:ask-vorta:vor0(?:48|49)/);
assert.match(workflow, /cancel-in-progress: true/);

console.log("VOR-051 Maintenance Manager demo rehearsal contracts passed.");