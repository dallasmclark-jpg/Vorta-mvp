import { test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const EQUIPMENT_ID = "40000000-0000-0000-0000-000000000007";

const routes = [
  ["dashboard", "/dashboard"],
  ["historical-validation", "/historical-validation"],
  ["shift-handover", "/shift-handover"],
  ["shift-cover", "/maintenance/labour-risk/shift-cover"],
  ["stores-inventory", "/stores-inventory"],
  ["skills-matrix", "/skills-matrix"],
  ["engineers", "/engineers"],
  ["requirements", "/requirements"],
  ["workforce-development", "/career"],
  ["training-plan", "/training"],
  ["training-providers", "/training-providers"],
  ["pilot-impact", "/pilot-impact"],
  ["pilot-adoption", "/pilot-adoption"],
  ["support", "/support"],
  ["pilot-setup", "/settings/pilot-setup"],
  ["data-import", "/settings/data-import"],
  ["settings", "/settings"],
  ["equipment-list", "/equipment"],
  ["equipment-overview", `/equipment/${EQUIPMENT_ID}/overview`],
  ["equipment-work-orders", `/equipment/${EQUIPMENT_ID}/work-orders`],
  ["equipment-pms", `/equipment/${EQUIPMENT_ID}/pms`],
  ["equipment-history", `/equipment/${EQUIPMENT_ID}/history`],
  ["equipment-skills", `/equipment/${EQUIPMENT_ID}/skills`],
  ["equipment-spares", `/equipment/${EQUIPMENT_ID}/spares`],
  ["equipment-documents", `/equipment/${EQUIPMENT_ID}/documents`],
  ["equipment-ai-insights", `/equipment/${EQUIPMENT_ID}/ai-insights`],
] as const;

const visibleReadyText: Partial<Record<(typeof routes)[number][0], RegExp>> = {
  "skills-matrix": /Site Maintenance Capability/i,
  requirements: /Groninger Filling Lines/i,
  "training-plan": /Groninger Filling Lines/i,
  "pilot-impact": /Pilot evidence ready/i,
  "pilot-adoption": /Sustained adoption/i,
};

async function waitForPageEvidence(page: Page, name: (typeof routes)[number][0]): Promise<void> {
  const visibleTarget = visibleReadyText[name];
  if (visibleTarget) {
    await page.getByText(visibleTarget).first().waitFor({ state: "visible", timeout: 25_000 });
  }

  if (name === "shift-handover") {
    await page.waitForTimeout(2_500);
  }

  // The equipment capability briefing is intentionally hidden by the compact phone
  // presentation, so attachment plus a short settle is the cross-device readiness signal.
  if (name === "equipment-skills") {
    await page.getByText(/Capability Resilience Briefing/i).first().waitFor({ state: "attached", timeout: 25_000 });
    await page.waitForTimeout(1_500);
  }
}

async function settle(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  }).catch(() => undefined);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined);
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
  requestedPath: string,
): Promise<Record<string, unknown>> {
  await settle(page);
  const projectDir = path.join("visual-audit", "maintenance-manager", testInfo.project.name);
  fs.mkdirSync(projectDir, { recursive: true });
  const filePath = path.join(projectDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true, animations: "disabled", caret: "hide" });
  return {
    name,
    requestedPath,
    finalUrl: page.url(),
    screenshot: filePath,
    viewport: page.viewportSize(),
    title: await page.title(),
  };
}

test("capture Maintenance Manager visual quality audit", async ({ page }, testInfo) => {
  test.setTimeout(10 * 60_000);
  await signInMaintenanceManager(page);

  const manifest: Array<Record<string, unknown>> = [];
  for (const [name, route] of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await waitForPageEvidence(page, name);
    manifest.push(await capture(page, testInfo, name, route));
  }

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await settle(page);
  const width = page.viewportSize()?.width ?? 1366;
  const launcher = width < 640
    ? page.locator('[data-vorta-shared-mobile-ai-launcher="true"]')
    : page.getByRole("button", { name: "Ask Vorta AI", exact: true });
  await launcher.waitFor({ state: "visible", timeout: 30_000 });
  await launcher.click();
  await page.locator('[data-vorta-global-ai-panel="true"]:visible, [data-vorta-ai-workspace="true"]:visible').waitFor({ state: "visible", timeout: 20_000 });
  manifest.push(await capture(page, testInfo, "ask-vorta-open", "/dashboard#ask-vorta"));

  const projectDir = path.join("visual-audit", "maintenance-manager", testInfo.project.name);
  fs.writeFileSync(path.join(projectDir, "manifest.json"), JSON.stringify(manifest, null, 2));
});
