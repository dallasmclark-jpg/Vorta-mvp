import { expect, test } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

test("VOR-095 Site Risk Briefing group frame is visually transparent", async ({ page }) => {
  await signInMaintenanceManager(page);
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);

  const briefingFrame = page.locator('[data-vorta-group-frame="true"]').first();
  await expect(briefingFrame).toBeVisible();
  await expect(briefingFrame).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(briefingFrame).toHaveCSS("background-image", "none");
  await expect(briefingFrame).toHaveCSS("box-shadow", "none");

  const frameStyle = await briefingFrame.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderTopColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
    };
  });

  expect(frameStyle).toEqual({
    borderTopColor: "rgba(0, 0, 0, 0)",
    backgroundColor: "rgba(0, 0, 0, 0)",
    backgroundImage: "none",
  });

  const metricCards = briefingFrame.locator('div[class*="rounded-lg"][class*="border"][class*="bg-[#0d1117]"]');
  await expect(metricCards.first()).toBeVisible();
});
