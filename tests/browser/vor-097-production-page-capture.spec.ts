import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const EQUIPMENT_ID = "40000000-0000-0000-0000-000000000007";
const OUTPUT_DIR = "evidence/vor-097-production-pages";

const pages = [
  ["01-dashboard", "/dashboard"],
  ["02-historical-validation", "/historical-validation"],
  ["03-shift-handover", "/shift-handover"],
  ["04-equipment-list", "/equipment"],
  ["05-stores-inventory", "/stores-inventory"],
  ["06-skills-matrix", "/skills-matrix"],
  ["07-engineers", "/engineers"],
  ["08-requirements", "/requirements"],
  ["09-career", "/career"],
  ["10-training", "/training"],
  ["11-training-providers", "/training-providers"],
  ["12-pilot-impact", "/pilot-impact"],
  ["13-pilot-adoption", "/pilot-adoption"],
  ["14-support", "/support"],
  ["15-pilot-setup", "/settings/pilot-setup"],
  ["16-data-import", "/settings/data-import"],
  ["17-settings", "/settings"],
  ["18-design-system", "/design-system"],
  ["19-equipment-overview", `/equipment/${EQUIPMENT_ID}/overview`],
  ["20-equipment-notifications", `/equipment/${EQUIPMENT_ID}/notifications`],
  ["21-equipment-work-orders", `/equipment/${EQUIPMENT_ID}/work-orders`],
  ["22-equipment-pms", `/equipment/${EQUIPMENT_ID}/pms`],
  ["23-equipment-history", `/equipment/${EQUIPMENT_ID}/history`],
  ["24-equipment-skills", `/equipment/${EQUIPMENT_ID}/skills`],
  ["25-equipment-spares", `/equipment/${EQUIPMENT_ID}/spares`],
  ["26-equipment-documents", `/equipment/${EQUIPMENT_ID}/documents`],
  ["27-equipment-ai-insights", `/equipment/${EQUIPMENT_ID}/ai-insights`],
  ["28-shift-cover", "/maintenance/labour-risk/shift-cover"],
] as const;

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      caret-color: transparent !important;
    }
  ` });
}

async function captureFreshSession(browser: Browser, name: string, path: string): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  try {
    await signInMaintenanceManager(page);
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await settle(page);
    await expect(page.locator('[data-vorta-page-content="true"]')).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe(path);
    await page.screenshot({ path: join(OUTPUT_DIR, `${name}-1536x864.png`), fullPage: false });
  } finally {
    await context.close();
  }
}

test("VOR-097 captures every Maintenance Manager audit page with a fresh authenticated session", async ({ browser }) => {
  test.setTimeout(28 * 60_000);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [name, path] of pages) {
    await test.step(`${name} ${path}`, async () => {
      await captureFreshSession(browser, name, path);
    });
  }
});
