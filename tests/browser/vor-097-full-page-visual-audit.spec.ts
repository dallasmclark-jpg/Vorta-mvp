import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const EQUIPMENT_ID = "40000000-0000-0000-0000-000000000007";

const routes = [
  ["dashboard", "/dashboard"],
  ["historical-validation", "/historical-validation"],
  ["shift-handover", "/shift-handover"],
  ["stores-inventory", "/stores-inventory"],
  ["equipment-register", "/equipment"],
  ["equipment-overview", `/equipment/${EQUIPMENT_ID}/overview`],
  ["equipment-notifications", `/equipment/${EQUIPMENT_ID}/notifications`],
  ["equipment-work-orders", `/equipment/${EQUIPMENT_ID}/work-orders`],
  ["equipment-pms", `/equipment/${EQUIPMENT_ID}/pms`],
  ["equipment-history", `/equipment/${EQUIPMENT_ID}/history`],
  ["equipment-skills", `/equipment/${EQUIPMENT_ID}/skills`],
  ["equipment-spares", `/equipment/${EQUIPMENT_ID}/spares`],
  ["equipment-documents", `/equipment/${EQUIPMENT_ID}/documents`],
  ["equipment-ai-insights", `/equipment/${EQUIPMENT_ID}/ai-insights`],
  ["shift-cover", "/maintenance/labour-risk/shift-cover"],
  ["skills-matrix", "/skills-matrix"],
  ["engineers", "/engineers"],
  ["requirements", "/requirements"],
  ["workforce-development", "/career"],
  ["training-plan", "/training"],
  ["training-providers", "/training-providers"],
  ["pilot-evidence", "/pilot-impact"],
  ["pilot-adoption", "/pilot-adoption"],
  ["capability-matching", "/ai-matching"],
  ["support", "/support"],
  ["settings", "/settings"],
  ["pilot-setup", "/settings/pilot-setup"],
  ["data-import", "/settings/data-import"],
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

  await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>("[data-vorta-portal-scroll-container='true']");
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, 0);
  }).catch(() => undefined);
}

test("capture complete Maintenance Manager visual consistency audit", async ({ page }, testInfo) => {
  test.setTimeout(8 * 60_000);
  await page.setViewportSize({ width: 1536, height: 960 });

  const outputDir = `visual-audit/${testInfo.project.name}`;
  mkdirSync(outputDir, { recursive: true });
  const manifest: Array<{
    name: string;
    requestedRoute: string;
    finalUrl: string;
    heading: string | null;
    bodyBackground: string;
    portalBackground: string | null;
  }> = [];

  for (const [name, route] of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await settle(page);

    const heading = await page.locator("h1, h2").first().innerText().catch(() => null);
    const bodyBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const portalBackground = await page
      .locator("[data-vorta-portal-shell='true']")
      .evaluate((element) => getComputedStyle(element).backgroundColor)
      .catch(() => null);

    await page.screenshot({
      path: `${outputDir}/${name}.png`,
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });

    manifest.push({
      name,
      requestedRoute: route,
      finalUrl: page.url(),
      heading,
      bodyBackground,
      portalBackground,
    });
  }

  writeFileSync(`${outputDir}/manifest.json`, JSON.stringify(manifest, null, 2));
  expect(manifest).toHaveLength(routes.length);
});
