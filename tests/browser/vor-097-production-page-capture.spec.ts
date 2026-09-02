import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const OUTPUT_DIR = "evidence/vor-097-production-pages";

const equipmentTabs = [
  ["17-equipment-overview", "overview"],
  ["18-equipment-notifications", "notifications"],
  ["19-equipment-work-orders", "work-orders"],
  ["20-equipment-pms", "pms"],
  ["21-equipment-history", "history"],
  ["22-equipment-skills", "skills"],
  ["23-equipment-spares", "spares"],
  ["24-equipment-documents", "documents"],
  ["25-equipment-ai-insights", "ai-insights"],
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

async function freshPage(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await signInMaintenanceManager(page);
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  return { page, close: () => context.close() };
}

async function capturePath(browser: Browser, name: string, path: string): Promise<void> {
  const session = await freshPage(browser);
  try {
    await session.page.goto(path, { waitUntil: "domcontentloaded" });
    await settle(session.page);
    expect(new URL(session.page.url()).pathname).toBe(path);
    await session.page.screenshot({ path: join(OUTPUT_DIR, `${name}-1536x864.png`), fullPage: false });
  } finally {
    await session.close();
  }
}

test("VOR-097 captures production equipment tabs and shift cover", async ({ browser }) => {
  test.setTimeout(15 * 60_000);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const discovery = await freshPage(browser);
  let equipmentId = "";
  try {
    await discovery.page.goto("/equipment", { waitUntil: "domcontentloaded" });
    await settle(discovery.page);
    const detailLink = discovery.page.locator('a[href*="/equipment/"]').filter({ hasNot: discovery.page.locator('[href="/equipment"]') }).first();
    const href = await detailLink.getAttribute("href", { timeout: 20_000 });
    const match = href?.match(/\/equipment\/([^/?#]+)/);
    if (!match) throw new Error(`Could not discover an equipment id from href: ${href}`);
    equipmentId = match[1];
  } finally {
    await discovery.close();
  }

  for (const [name, tab] of equipmentTabs) {
    await test.step(`${name} ${tab}`, async () => {
      await capturePath(browser, name, `/equipment/${equipmentId}/${tab}`);
    });
  }

  await capturePath(browser, "26-shift-cover", "/maintenance/labour-risk/shift-cover");
});
