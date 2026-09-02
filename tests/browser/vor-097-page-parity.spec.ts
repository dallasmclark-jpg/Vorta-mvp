import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const OUTPUT_ROOT = "evidence/vor-097-page-parity";

type Viewport = { width: number; height: number };
type ProjectOptions = {
  viewport: Viewport;
  hasTouch?: boolean;
  userAgent?: string;
};

function routesForEquipment(equipmentId: string): ReadonlyArray<readonly [string, string]> {
  const equipmentBase = `/equipment/${encodeURIComponent(equipmentId)}`;
  return [
    ["01-dashboard", "/dashboard"],
    ["02-historical-validation", "/historical-validation"],
    ["03-shift-handover", "/shift-handover"],
    ["04-equipment", "/equipment"],
    ["05-equipment-overview", `${equipmentBase}/overview`],
    ["06-equipment-notifications", `${equipmentBase}/notifications`],
    ["07-equipment-work-orders", `${equipmentBase}/work-orders`],
    ["08-equipment-pms", `${equipmentBase}/pms`],
    ["09-equipment-history", `${equipmentBase}/history`],
    ["10-equipment-skills", `${equipmentBase}/skills`],
    ["11-equipment-spares", `${equipmentBase}/spares`],
    ["12-equipment-documents", `${equipmentBase}/documents`],
    ["13-equipment-ai-insights", `${equipmentBase}/ai-insights`],
    ["14-stores-inventory", "/stores-inventory"],
    ["15-skills-matrix", "/skills-matrix"],
    ["16-engineers", "/engineers"],
    ["17-requirements", "/requirements"],
    ["18-career", "/career"],
    ["19-training", "/training"],
    ["20-training-providers", "/training-providers"],
    ["21-pilot-impact", "/pilot-impact"],
    ["22-pilot-adoption", "/pilot-adoption"],
    ["23-pilot-setup", "/settings/pilot-setup"],
    ["24-data-import", "/settings/data-import"],
    ["25-support", "/support"],
    ["26-settings", "/settings"],
    ["27-shift-cover", "/maintenance/labour-risk/shift-cover"],
  ] as const;
}

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

async function openFresh(
  browser: Browser,
  path: string,
  project: ProjectOptions,
  expectedPath = path,
): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    viewport: project.viewport,
    deviceScaleFactor: 1,
    hasTouch: project.hasTouch,
    userAgent: project.userAgent,
  });
  const page = await context.newPage();
  await signInMaintenanceManager(page);
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await settle(page);
  await expect(page.locator('[data-vorta-page-content="true"]')).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe(expectedPath);
  return { page, close: () => context.close() };
}

async function resolveVerifiedEquipmentId(
  browser: Browser,
  project: ProjectOptions,
): Promise<string> {
  const session = await openFresh(browser, "/equipment", project);
  try {
    const liveDesktopAction = session.page.getByRole("button", { name: /Open verified equipment/i }).first();
    const demoDesktopAction = session.page.getByRole("button", { name: /View full asset intelligence/i }).first();
    const phoneAction = session.page.getByRole("button", { name: /Open overview for/i }).first();

    if (await liveDesktopAction.isVisible({ timeout: 12_000 }).catch(() => false)) {
      await liveDesktopAction.click();
    } else if (await demoDesktopAction.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await demoDesktopAction.click();
    } else {
      await expect(phoneAction).toBeVisible({ timeout: 20_000 });
      await phoneAction.click();
    }

    await expect(session.page).toHaveURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/, { timeout: 30_000 });
    const parts = new URL(session.page.url()).pathname.split("/").filter(Boolean);
    expect(parts[0]).toBe("equipment");
    expect(parts[1]).toBeTruthy();
    return decodeURIComponent(parts[1]);
  } finally {
    await session.close();
  }
}

test("VOR-097 Maintenance Manager pages use the Dashboard visual system", async ({ browser }, testInfo) => {
  test.setTimeout(30 * 60_000);

  const configuredViewport = testInfo.project.use.viewport;
  const viewport: Viewport = configuredViewport ?? { width: 1536, height: 864 };
  const project: ProjectOptions = {
    viewport,
    hasTouch: Boolean(testInfo.project.use.hasTouch),
    userAgent: testInfo.project.use.userAgent,
  };
  const outputDir = join(OUTPUT_ROOT, testInfo.project.name);
  mkdirSync(outputDir, { recursive: true });

  const equipmentId = await resolveVerifiedEquipmentId(browser, project);
  const routes = routesForEquipment(equipmentId);
  expect(routes).toHaveLength(27);

  const evidence: unknown[] = [];
  const failures: string[] = [];

  for (const [name, path] of routes) {
    await test.step(`${name} ${path}`, async () => {
      const restrictedOnPhone =
        viewport.width <= 767 &&
        (path === "/settings/pilot-setup" || path === "/settings/data-import");
      const expectedPath = restrictedOnPhone ? "/settings" : path;
      const session = await openFresh(browser, path, project, expectedPath);
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
          const describe = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
              tagName: element.tagName,
              className: element.className,
              background: style.backgroundColor,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              text: element.innerText.trim().replace(/\s+/g, " ").slice(0, 180),
            };
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
          const mutedSelector = ["text", "slate", "500"].join("-");
          const grayMutedSelector = ["text", "gray", "500"].join("-");
          const muted = pageRoot
            ? Array.from(pageRoot.querySelectorAll<HTMLElement>(`.${mutedSelector},.${grayMutedSelector}`)).filter(visible)
            : [];
          const incorrectMuted = muted.filter((element) => getComputedStyle(element).color !== "rgb(148, 163, 184)");
          const cards = pageRoot ? Array.from(pageRoot.querySelectorAll<HTMLElement>('[data-vorta-card="true"]')).filter(visible) : [];
          const rootRect = pageRoot?.getBoundingClientRect();

          return {
            title: document.title,
            pathname: window.location.pathname,
            rootWidth: rootRect ? Math.round(rootRect.width) : 0,
            scrollWidth: pageRoot?.scrollWidth ?? 0,
            viewportWidth: window.innerWidth,
            horizontalOverflow: Boolean(pageRoot && pageRoot.scrollWidth > window.innerWidth + 2),
            largeLegacySurfaceCount: largeLegacySurfaces.length,
            largeBlueSlabCount: largeBlueSlabs.length,
            mutedTextCount: muted.length,
            incorrectMutedTextCount: incorrectMuted.length,
            cardBackgrounds: [...new Set(cards.map((element) => getComputedStyle(element).backgroundColor))],
            largeLegacySamples: largeLegacySurfaces.slice(0, 5).map(describe),
            largeBlueSamples: largeBlueSlabs.slice(0, 5).map(describe),
            incorrectMutedSamples: incorrectMuted.slice(0, 5).map(describe),
          };
        });

        evidence.push({ name, path, expectedPath, restrictedOnPhone, equipmentId, viewport, ...audit });
        await session.page.screenshot({
          path: join(outputDir, `${name}-${viewport.width}x${viewport.height}.png`),
          fullPage: false,
        });

        if (restrictedOnPhone) {
          return;
        }
        if (audit.largeLegacySurfaceCount > 0) {
          failures.push(`${path}: ${audit.largeLegacySurfaceCount} large legacy charcoal surface(s)`);
        }
        if (audit.largeBlueSlabCount > 0) {
          failures.push(`${path}: ${audit.largeBlueSlabCount} large decorative blue slab(s)`);
        }
        if (audit.incorrectMutedTextCount > 0) {
          failures.push(`${path}: ${audit.incorrectMutedTextCount} muted metadata element(s) outside the Dashboard token`);
        }
        if (audit.horizontalOverflow) {
          failures.push(`${path}: page root overflows the ${viewport.width}px viewport (${audit.scrollWidth}px scroll width)`);
        }
      } finally {
        await session.close();
      }
    });
  }

  writeFileSync(
    join(outputDir, "visual-token-audit.json"),
    JSON.stringify({ project: testInfo.project.name, viewport, equipmentId, evidence, failures }, null, 2),
  );
  expect(
    failures,
    failures.length ? `VOR-097 ${testInfo.project.name} page parity failures:\n${failures.join("\n")}` : undefined,
  ).toEqual([]);
});
