import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("VOR-095 uses the approved navy canvas, lighter cards and transparent risk badges", async ({ page }, testInfo) => {
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

    const cardBackground = "rgb(37, 42, 48)";
    const raisedBackground = "rgb(45, 51, 58)";

    return {
      pageToken: rootStyle.getPropertyValue("--vorta-surface-page").trim(),
      cardToken: rootStyle.getPropertyValue("--vorta-surface-card").trim(),
      raisedToken: rootStyle.getPropertyValue("--vorta-surface-raised").trim(),
      pageBackground: pageContent ? getComputedStyle(pageContent).backgroundColor : "",
      cardCount: visible.filter((element) => getComputedStyle(element).backgroundColor === cardBackground).length,
      raisedCount: visible.filter((element) => getComputedStyle(element).backgroundColor === raisedBackground).length,
    };
  });

  expect(hierarchy.pageToken).toBe("#081a2c");
  expect(hierarchy.cardToken).toBe("#252a30");
  expect(hierarchy.raisedToken).toBe("#2d333a");
  expect(hierarchy.pageBackground).toBe("rgb(8, 26, 44)");
  expect(hierarchy.cardCount, "Dashboard must render the approved lighter card surface").toBeGreaterThan(0);
  expect(hierarchy.raisedCount, "Dashboard must retain nested surface hierarchy").toBeGreaterThan(0);

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
