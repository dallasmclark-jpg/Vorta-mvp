import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("VOR-094 renders a navy page with neutral graphite card hierarchy", async ({ page }, testInfo) => {
  await signInMaintenanceManager(page);
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);

  const root = page.locator("html");
  await expect(root).toHaveClass(/dark/);
  await expect(page.locator('[data-vorta-page-content="true"]')).toBeVisible();

  const hierarchy = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const pageContent = document.querySelector<HTMLElement>('[data-vorta-page-content="true"]');
    const sidebar = document.querySelector<HTMLElement>('[data-vorta-sidebar="true"]');
    const isVisible = (element: Element) => {
      const node = element as HTMLElement;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const visibleSurfaces = pageContent
      ? Array.from(pageContent.querySelectorAll("*")).filter(isVisible)
      : [];

    const backgroundCount = (background: string) =>
      visibleSurfaces.filter((element) => getComputedStyle(element).backgroundColor === background).length;

    return {
      pageToken: rootStyle.getPropertyValue("--vorta-surface-page").trim(),
      cardToken: rootStyle.getPropertyValue("--vorta-surface-card").trim(),
      raisedToken: rootStyle.getPropertyValue("--vorta-surface-raised").trim(),
      sidebarToken: rootStyle.getPropertyValue("--vorta-sidebar").trim(),
      pageBackground: pageContent ? getComputedStyle(pageContent).backgroundColor : "",
      sidebarBackground: sidebar ? getComputedStyle(sidebar).backgroundColor : "",
      graphiteCardCount: backgroundCount("rgb(37, 42, 48)"),
      graphiteRaisedCount: backgroundCount("rgb(45, 51, 58)"),
    };
  });

  expect(hierarchy.pageToken).toBe("#081a2c");
  expect(hierarchy.cardToken).toBe("#252a30");
  expect(hierarchy.raisedToken).toBe("#2d333a");
  expect(hierarchy.sidebarToken).toBe("#0d1219");
  expect(hierarchy.pageBackground).toBe("rgb(8, 26, 44)");
  expect(hierarchy.sidebarBackground).toBe("rgb(13, 18, 25)");
  expect(hierarchy.graphiteCardCount, "Dashboard must render visible neutral graphite cards").toBeGreaterThan(0);
  expect(hierarchy.graphiteRaisedCount, "Dashboard must render visible raised graphite surfaces").toBeGreaterThan(0);

  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath(`vor-094-dashboard-${testInfo.project.name}.png`),
    fullPage: false,
  });
});
