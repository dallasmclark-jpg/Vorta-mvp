import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("VOR-095 uses the mock-up navy cards and focused Ask Vorta layout", async ({ page }, testInfo) => {
  await signInMaintenanceManager(page);
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);

  const root = page.locator("html");
  await expect(root).toHaveClass(/dark/);
  await expect(page.locator('[data-vorta-page-content="true"]')).toBeVisible();

  const hierarchy = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const pageContent = document.querySelector<HTMLElement>('[data-vorta-page-content="true"]');
    const visible = pageContent
      ? Array.from(pageContent.querySelectorAll<HTMLElement>("*")).filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
      : [];

    const cardBackground = "rgb(3, 12, 29)";
    const raisedBackground = "rgb(7, 23, 43)";
    const askVortaWrapper = document.querySelector<HTMLElement>(
      '[data-vorta-embedded-ai="true"] > [data-vorta-card="true"]',
    );
    const riskIntelligenceLabel = document.querySelector<HTMLElement>(
      '[data-vorta-risk-intelligence-label="true"]',
    );
    const workPlanSummary = document.querySelector<HTMLElement>(
      '[data-vorta-work-plan-summary="true"]',
    );
    const workPlanCard = workPlanSummary?.parentElement ?? null;
    const scopeTabList = document.querySelector<HTMLElement>(
      '[aria-label="Risk intelligence scope"]',
    );
    const scopeFrame = scopeTabList?.closest<HTMLElement>(
      '[data-vorta-mobile-risk-scope="true"]',
    ) ?? null;
    const firstScopeTab = scopeTabList?.querySelector<HTMLElement>('[role="tab"]') ?? null;

    return {
      viewportWidth: window.innerWidth,
      pageToken: rootStyle.getPropertyValue("--vorta-surface-page").trim(),
      cardToken: rootStyle.getPropertyValue("--vorta-surface-card").trim(),
      raisedToken: rootStyle.getPropertyValue("--vorta-surface-raised").trim(),
      pageBackground: pageContent ? getComputedStyle(pageContent).backgroundColor : "",
      cardCount: visible.filter((element) => getComputedStyle(element).backgroundColor === cardBackground).length,
      raisedCount: visible.filter((element) => getComputedStyle(element).backgroundColor === raisedBackground).length,
      cardImages: visible
        .filter((element) => element.matches('[data-vorta-card="true"]:not([data-vorta-group-frame="true"])'))
        .map((element) => getComputedStyle(element).backgroundImage),
      askVortaWrapper: askVortaWrapper
        ? {
            background: getComputedStyle(askVortaWrapper).backgroundColor,
            borderTopWidth: getComputedStyle(askVortaWrapper).borderTopWidth,
            boxShadow: getComputedStyle(askVortaWrapper).boxShadow,
          }
        : null,
      riskIntelligenceLabel: riskIntelligenceLabel
        ? {
            color: getComputedStyle(riskIntelligenceLabel).color,
            background: getComputedStyle(riskIntelligenceLabel).backgroundColor,
          }
        : null,
      workPlanBorderColor: workPlanCard
        ? getComputedStyle(workPlanCard).borderTopColor
        : null,
      scopeRail: scopeTabList && firstScopeTab && scopeFrame
        ? {
            gap: getComputedStyle(scopeTabList).columnGap,
            paddingRight: getComputedStyle(scopeTabList).paddingRight,
            tabPaddingLeft: getComputedStyle(firstScopeTab).paddingLeft,
            tabPaddingRight: getComputedStyle(firstScopeTab).paddingRight,
            continuationFade: getComputedStyle(scopeFrame, "::after").backgroundImage,
            fadePointerEvents: getComputedStyle(scopeFrame, "::after").pointerEvents,
          }
        : null,
    };
  });

  expect(hierarchy.pageToken).toBe("#081a2c");
  expect(hierarchy.cardToken).toBe("#030c1d");
  expect(hierarchy.raisedToken).toBe("#07172b");
  expect(hierarchy.pageBackground).toBe("rgb(8, 26, 44)");
  expect(hierarchy.cardCount, "Dashboard must render the approved lighter card surface").toBeGreaterThan(0);
  expect(hierarchy.raisedCount, "Dashboard must retain nested surface hierarchy").toBeGreaterThan(0);
  expect(hierarchy.cardImages.length, "Dashboard must render at least one canonical card").toBeGreaterThan(0);
  expect(hierarchy.cardImages.every((image) => image.includes("linear-gradient"))).toBe(true);
  expect(hierarchy.askVortaWrapper).toEqual({
    background: "rgba(0, 0, 0, 0)",
    borderTopWidth: "0px",
    boxShadow: "none",
  });
  await expect(page.locator('[data-vorta-embedded-ai="true"] [data-vorta-embedded-ask="true"]')).toBeVisible();

  expect(hierarchy.riskIntelligenceLabel).not.toBeNull();
  expect(hierarchy.riskIntelligenceLabel?.color).toBe("rgb(96, 165, 250)");
  expect(hierarchy.riskIntelligenceLabel?.background).toBe("rgb(7, 23, 43)");

  if (hierarchy.viewportWidth >= 768) {
    expect(hierarchy.workPlanBorderColor).toBe("rgba(148, 163, 184, 0.16)");
  }

  if (hierarchy.viewportWidth >= 1280) {
    expect(hierarchy.scopeRail).not.toBeNull();
    expect(hierarchy.scopeRail?.gap).toBe("6px");
    expect(hierarchy.scopeRail?.paddingRight).toBe("12px");
    expect(hierarchy.scopeRail?.tabPaddingLeft).toBe("10px");
    expect(hierarchy.scopeRail?.tabPaddingRight).toBe("10px");
    expect(hierarchy.scopeRail?.continuationFade).toContain("linear-gradient");
    expect(hierarchy.scopeRail?.fadePointerEvents).toBe("none");
  }

  const riskBadges = page.locator(
    '[data-vorta-page-content="true"] span[class~="bg-red-500/20"][class~="text-red-400"], ' +
    '[data-vorta-page-content="true"] span[class~="bg-orange-500/20"][class~="text-orange-400"], ' +
    '[data-vorta-page-content="true"] span[class~="bg-yellow-500/20"][class~="text-yellow-400"], ' +
    '[data-vorta-page-content="true"] span[class~="bg-emerald-500/20"][class~="text-emerald-400"], ' +
    '[data-vorta-page-content="true"] span[class~="bg-cyan-500/20"][class~="text-cyan-400"]',
  );

  await expect(riskBadges.first()).toBeVisible();
  const badgeBackgrounds = await riskBadges.evaluateAll((badges) =>
    badges.map((badge) => getComputedStyle(badge).backgroundColor),
  );
  expect(badgeBackgrounds.length).toBeGreaterThan(0);
  for (const background of badgeBackgrounds) {
    expect(background).toBe("rgba(0, 0, 0, 0)");
  }

  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`vor-095-dashboard-${testInfo.project.name}.png`),
    fullPage: false,
  });
});
