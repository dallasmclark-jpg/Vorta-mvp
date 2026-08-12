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
  await page.waitForTimeout(3_500);
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
  const viewport = page.viewportSize();
  return {
    name,
    requestedPath,
    finalUrl: page.url(),
    screenshot: filePath,
    viewport,
    title: await page.title(),
  };
}

async function openAskVorta(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 1366;
  const candidates = width < 640
    ? [
        page.locator('[data-vorta-shared-mobile-ai-launcher="true"]'),
        page.getByRole("button", { name: "Ask Vorta AI", exact: true }),
      ]
    : [page.getByRole("button", { name: "Ask Vorta AI", exact: true })];

  for (const candidate of candidates) {
    try {
      await candidate.waitFor({ state: "visible", timeout: 20_000 });
      await candidate.click();
      return;
    } catch {
      // Try the next valid launcher. The visual audit should not fail because
      // responsive shell hydration swaps one equivalent launcher for another.
    }
  }

  throw new Error("Ask Vorta launcher did not become visible");
}

test("capture Maintenance Manager visual quality audit", async ({ page }, testInfo) => {
  test.setTimeout(12 * 60_000);
  await signInMaintenanceManager(page);

  const manifest: Array<Record<string, unknown>> = [];
  for (const [name, route] of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    manifest.push(await capture(page, testInfo, name, route));
  }

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await settle(page);
  await openAskVorta(page);
  await page.locator('[data-vorta-global-ai-panel="true"]:visible, [data-vorta-ai-workspace="true"]:visible').waitFor({ state: "visible", timeout: 20_000 });
  manifest.push(await capture(page, testInfo, "ask-vorta-open", "/dashboard#ask-vorta"));

  const projectDir = path.join("visual-audit", "maintenance-manager", testInfo.project.name);
  fs.writeFileSync(path.join(projectDir, "manifest.json"), JSON.stringify(manifest, null, 2));
});
