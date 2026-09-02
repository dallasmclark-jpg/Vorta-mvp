import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const EQUIPMENT_ID = "40000000-0000-0000-0000-000000000007";
const OUTPUT_DIR = "evidence/vor-097-production-pages";

const pages = [
  ["17-equipment-overview", `/equipment/${EQUIPMENT_ID}/overview`],
  ["18-equipment-notifications", `/equipment/${EQUIPMENT_ID}/notifications`],
  ["19-equipment-work-orders", `/equipment/${EQUIPMENT_ID}/work-orders`],
  ["20-equipment-pms", `/equipment/${EQUIPMENT_ID}/pms`],
  ["21-equipment-history", `/equipment/${EQUIPMENT_ID}/history`],
  ["22-equipment-skills", `/equipment/${EQUIPMENT_ID}/skills`],
  ["23-equipment-spares", `/equipment/${EQUIPMENT_ID}/spares`],
  ["24-equipment-documents", `/equipment/${EQUIPMENT_ID}/documents`],
  ["25-equipment-ai-insights", `/equipment/${EQUIPMENT_ID}/ai-insights`],
  ["26-shift-cover", "/maintenance/labour-risk/shift-cover"],
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
    expect(new URL(page.url()).pathname).toBe(path);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toBeEmpty();
    await page.screenshot({ path: join(OUTPUT_DIR, `${name}-1536x864.png`), fullPage: false });
  } finally {
    await context.close();
  }
}

test("VOR-097 captures equipment and labour-risk audit pages with fresh authenticated sessions", async ({ browser }) => {
  test.setTimeout(15 * 60_000);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const [name, path] of pages) {
    await test.step(`${name} ${path}`, async () => {
      await captureFreshSession(browser, name, path);
    });
  }
});
