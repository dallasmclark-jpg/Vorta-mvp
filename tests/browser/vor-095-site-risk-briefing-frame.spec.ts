import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("VOR-095 removes the Site Risk Briefing outer frame without changing its contents", async ({ page }) => {
  await signInMaintenanceManager(page);
  await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);

  const briefingFrame = page.locator('[data-vorta-group-frame="true"]').first();
  await expect(briefingFrame).toBeVisible();
  await expect(briefingFrame).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await expect(briefingFrame).toHaveCSS("border-right-color", "rgba(0, 0, 0, 0)");
  await expect(briefingFrame).toHaveCSS("border-bottom-color", "rgba(0, 0, 0, 0)");
  await expect(briefingFrame).toHaveCSS("border-left-color", "rgba(0, 0, 0, 0)");
  await expect(briefingFrame).toHaveCSS("box-shadow", "none");

  await expect(
    briefingFrame.locator("p").filter({ hasText: /^Site Risk Briefing$/ }).first(),
  ).toBeVisible();
  await expect(
    briefingFrame.locator("p").filter({ hasText: /^Site Risk$/ }).first(),
  ).toBeVisible();
  await expect(page.locator('[data-vorta-embedded-ai="true"]')).toBeVisible();
  await expect(page.locator('[data-vorta-work-plan-summary="true"]')).toBeVisible();

  await expectNoPageOverflow(page);
});
