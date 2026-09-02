import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const OUTPUT_DIR = "evidence/vor-097-page-parity";

const routes = [
  ["01-dashboard", "/dashboard"],
  ["02-historical-validation", "/historical-validation"],
  ["03-shift-handover", "/shift-handover"],
  ["04-equipment", "/equipment"],
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
  ["15-settings", "/settings"],
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

async function openFresh(browser: Browser, path: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    viewport: { width: 1536, height: 864 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await signInMaintenanceManager(page);
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.locator('[data-vorta-page-content="true"]')).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe(path);
  return { page, close: () => context.close() };
}

test("VOR-097 Maintenance Manager pages use the Dashboard visual system", async ({ browser }) => {
  test.setTimeout(20 * 60_000);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const evidence: unknown[] = [];

  for (const [name, path] of routes) {
    await test.step(`${name} ${path}`, async () => {
      const session = await openFresh(browser, path);
      try {
        const audit = await session.page.evaluate(() => {
          const legacyColours = new Set([
            "rgb(20, 24, 32)",
            "rgb(16, 20, 27)",
            "rgb(13, 17, 23)",
            "rgb(13, 13, 13)",
          ]);
          const pageRoot = document.querySelector<HTMLElement>('[data-vorta-page-content="true"]');
          const visible = (element: Element): element is HTMLElement => {
            if (!(element instanceof HTMLElement)) return false;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          };
          const structural = pageRoot ? Array.from(pageRoot.querySelectorAll<HTMLElement>("div,section,article,aside")) : [];
          const largeLegacySurfaces = structural.filter((element) => {
            if (!visible(element)) return false;
            const rect = element.getBoundingClientRect();
            return rect.width >= 160 && rect.height >= 64 && legacyColours.has(getComputedStyle(element).backgroundColor);
          });
          const largeBlueSlabs = structural.filter((element) => {
            if (!visible(element)) return false;
            const rect = element.getBoundingClientRect();
            if (rect.width < 180 || rect.height < 72) return false;
            const colour = getComputedStyle(element).backgroundColor;
            return /rgba?\(59, 130, 246(?:,|\))/.test(colour) || /rgba?\(37, 99, 235(?:,|\))/.test(colour);
          });
          const muted = pageRoot ? Array.from(pageRoot.querySelectorAll<HTMLElement>(".text-slate-500,.text-gray-500")).filter(visible) : [];
          const incorrectMuted = muted.filter((element) => getComputedStyle(element).color !== "rgb(148, 163, 184)");
          const cards = pageRoot ? Array.from(pageRoot.querySelectorAll<HTMLElement>('[data-vorta-card="true"]')).filter(visible) : [];

          return {
            title: document.title,
            largeLegacySurfaceCount: largeLegacySurfaces.length,
            largeBlueSlabCount: largeBlueSlabs.length,
            mutedTextCount: muted.length,
            incorrectMutedTextCount: incorrectMuted.length,
            cardBackgrounds: [...new Set(cards.map((element) => getComputedStyle(element).backgroundColor))],
            largeLegacySamples: largeLegacySurfaces.slice(0, 5).map((element) => ({
              className: element.className,
              background: getComputedStyle(element).backgroundColor,
            })),
            largeBlueSamples: largeBlueSlabs.slice(0, 5).map((element) => ({
              className: element.className,
              background: getComputedStyle(element).backgroundColor,
            })),
          };
        });

        evidence.push({ name, path, ...audit });
        expect(audit.largeLegacySurfaceCount, `${path} must not expose large legacy charcoal surfaces`).toBe(0);
        expect(audit.largeBlueSlabCount, `${path} must not expose large decorative blue slabs`).toBe(0);
        expect(audit.incorrectMutedTextCount, `${path} muted metadata must use the Dashboard muted token`).toBe(0);
        await session.page.screenshot({
          path: join(OUTPUT_DIR, `${name}-1536x864.png`),
          fullPage: false,
        });
      } finally {
        await session.close();
      }
    });
  }

  writeFileSync(join(OUTPUT_DIR, "visual-token-audit.json"), JSON.stringify(evidence, null, 2));
});
