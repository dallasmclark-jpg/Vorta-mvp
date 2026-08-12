import { test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const EQUIPMENT_ID = "40000000-0000-0000-0000-000000000007";

const routes = [
  ["dashboard", "/dashboard"],
  ["settings", "/settings"],
  ["requirements", "/requirements"],
  ["historical-validation", "/historical-validation"],
  ["equipment-overview", `/equipment/${EQUIPMENT_ID}/overview`],
  ["equipment-history", `/equipment/${EQUIPMENT_ID}/history`],
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
  const projectDir = path.join("visual-audit", "vor-090", testInfo.project.name);
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
      // Responsive shell hydration can swap equivalent launchers.
    }
  }

  throw new Error("Ask Vorta launcher did not become visible");
}

test("capture VOR-090 Chrome polish", async ({ page }, testInfo) => {
  test.setTimeout(10 * 60_000);
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

  const projectDir = path.join("visual-audit", "vor-090", testInfo.project.name);
  fs.writeFileSync(path.join(projectDir, "manifest.json"), JSON.stringify(manifest, null, 2));
});
