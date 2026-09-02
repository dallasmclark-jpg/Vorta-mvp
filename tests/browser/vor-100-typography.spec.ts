import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const OUTPUT_ROOT = "evidence/vor-100-typography";
const ROUTES = [
  ["dashboard", "/dashboard"],
  ["historical-validation", "/historical-validation"],
  ["equipment", "/equipment"],
  ["stores-inventory", "/stores-inventory"],
  ["engineers", "/engineers"],
  ["support", "/support"],
  ["settings", "/settings"],
] as const;

type Viewport = { width: number; height: number };
type ProjectOptions = {
  viewport: Viewport;
  hasTouch?: boolean;
  userAgent?: string;
};

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
  expect(new URL(page.url()).pathname).toBe(path);
  return { page, close: () => context.close() };
}

test("VOR-100 governed typography stays distinctive and responsive", async ({ browser }, testInfo) => {
  test.setTimeout(15 * 60_000);

  const configuredViewport = testInfo.project.use.viewport;
  const viewport: Viewport = configuredViewport ?? { width: 1536, height: 864 };
  const project: ProjectOptions = {
    viewport,
    hasTouch: Boolean(testInfo.project.use.hasTouch),
    userAgent: testInfo.project.use.userAgent,
  };
  const outputDir = join(OUTPUT_ROOT, testInfo.project.name);
  mkdirSync(outputDir, { recursive: true });

  const evidence: unknown[] = [];
  const failures: string[] = [];

  for (const [name, path] of ROUTES) {
    await test.step(`${name} ${path}`, async () => {
      const session = await openFresh(browser, path, project);
      try {
        const audit = await session.page.evaluate(() => {
          const root = document.querySelector<HTMLElement>('[data-vorta-page-content="true"]');
          const visible = (element: Element): element is HTMLElement => {
            if (!(element instanceof HTMLElement)) return false;
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          };
          const h1 = root ? Array.from(root.querySelectorAll("h1")).find(visible) ?? null : null;
          const h2s = root ? Array.from(root.querySelectorAll("h2")).filter(visible) : [];
          const rootStyle = root ? getComputedStyle(root) : null;
          const h1Style = h1 ? getComputedStyle(h1) : null;
          const h2Styles = h2s.slice(0, 8).map((heading) => ({
            text: heading.innerText.trim().replace(/\s+/g, " ").slice(0, 100),
            family: getComputedStyle(heading).fontFamily,
            weight: getComputedStyle(heading).fontWeight,
            tracking: getComputedStyle(heading).letterSpacing,
          }));
          const kpiCandidates = root
            ? Array.from(root.querySelectorAll<HTMLElement>('[data-risk-kpi-card] [class~="text-xl"], [data-risk-kpi-card] [class~="text-2xl"], [data-risk-kpi-card] [class~="text-3xl"]')).filter(visible)
            : [];
          const kpis = kpiCandidates.slice(0, 12).map((element) => ({
            text: element.innerText.trim().replace(/\s+/g, " ").slice(0, 80),
            family: getComputedStyle(element).fontFamily,
            weight: getComputedStyle(element).fontWeight,
            numerals: getComputedStyle(element).fontVariantNumeric,
          }));
          const technicalLabel = root?.querySelector<HTMLElement>('[data-vorta-risk-intelligence-label="true"]');
          const technicalStyle = technicalLabel && visible(technicalLabel) ? getComputedStyle(technicalLabel) : null;

          return {
            pathname: window.location.pathname,
            typographyStyleInstalled: Boolean(document.getElementById("vorta-typography-system")),
            displayFontLinkInstalled: Boolean(document.getElementById("vorta-inter-tight-font")),
            displayFontReady: document.fonts.check('600 20px "Inter Tight"'),
            rootNumerals: rootStyle?.fontVariantNumeric ?? "",
            h1: h1 ? {
              text: h1.innerText.trim().replace(/\s+/g, " ").slice(0, 120),
              family: h1Style?.fontFamily ?? "",
              weight: h1Style?.fontWeight ?? "",
              tracking: h1Style?.letterSpacing ?? "",
            } : null,
            h2s: h2Styles,
            kpis,
            technicalLabel: technicalLabel && technicalStyle ? {
              text: technicalLabel.innerText.trim().replace(/\s+/g, " ").slice(0, 100),
              weight: technicalStyle.fontWeight,
              tracking: technicalStyle.letterSpacing,
              transform: technicalStyle.textTransform,
            } : null,
            horizontalOverflow: Boolean(root && root.scrollWidth > window.innerWidth + 2),
            scrollWidth: root?.scrollWidth ?? 0,
            viewportWidth: window.innerWidth,
          };
        });

        evidence.push({ name, path, viewport, ...audit });
        await session.page.screenshot({
          path: join(outputDir, `${name}-${viewport.width}x${viewport.height}.png`),
          fullPage: false,
        });

        const approvedPhoneDashboardWithoutH1 = viewport.width <= 360 && path === "/dashboard";

        if (!audit.typographyStyleInstalled) failures.push(`${path}: shared typography style was not installed`);
        if (!audit.displayFontLinkInstalled) failures.push(`${path}: Inter Tight display font link was not installed`);
        if (!audit.h1 && !approvedPhoneDashboardWithoutH1) failures.push(`${path}: no visible page h1 was found`);
        if (approvedPhoneDashboardWithoutH1 && audit.h2s.length === 0) failures.push(`${path}: approved phone Dashboard has no visible h1, so at least one governed section h2 must remain visible`);
        if (audit.h1 && !audit.h1.family.includes("Inter Tight")) failures.push(`${path}: page h1 does not use Inter Tight (${audit.h1.family})`);
        if (audit.h1 && audit.h1.weight !== "600") failures.push(`${path}: page h1 weight is ${audit.h1.weight}, expected 600`);
        if (audit.h1 && (audit.h1.tracking === "normal" || Number.parseFloat(audit.h1.tracking) >= 0)) failures.push(`${path}: page h1 tracking is not tightened (${audit.h1.tracking})`);
        if (!audit.rootNumerals.includes("tabular-nums") || !audit.rootNumerals.includes("lining-nums")) failures.push(`${path}: page shell does not use lining tabular numerals (${audit.rootNumerals})`);
        if (audit.h2s.some((heading) => !heading.family.includes("Inter Tight") || heading.weight !== "600")) failures.push(`${path}: one or more visible h2 headings are outside the governed display treatment`);
        if (audit.horizontalOverflow) failures.push(`${path}: page root overflows ${viewport.width}px (${audit.scrollWidth}px scroll width)`);

        if (path === "/dashboard") {
          if (audit.kpis.length === 0) failures.push(`${path}: no visible risk KPI typography candidates were found`);
          if (audit.kpis.some((kpi) => !kpi.family.includes("Inter Tight") || kpi.weight !== "600")) failures.push(`${path}: one or more risk KPIs are outside the display/600 treatment`);
          if (audit.kpis.some((kpi) => !kpi.numerals.includes("tabular-nums") || !kpi.numerals.includes("lining-nums"))) failures.push(`${path}: one or more risk KPIs do not use lining tabular numerals`);
          if (audit.technicalLabel && (audit.technicalLabel.weight !== "600" || audit.technicalLabel.transform !== "uppercase")) failures.push(`${path}: the Risk Intelligence technical label is outside the governed eyebrow treatment`);
        }
      } finally {
        await session.close();
      }
    });
  }

  writeFileSync(
    join(outputDir, "typography-audit.json"),
    JSON.stringify({ project: testInfo.project.name, viewport, evidence, failures }, null, 2),
  );

  expect(
    failures,
    failures.length ? `VOR-100 ${testInfo.project.name} typography failures:\n${failures.join("\n")}` : undefined,
  ).toEqual([]);
});
