import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  expectOperationalTouchTarget,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-360", "Mobile Skills Matrix is phone-only");
  await signInMaintenanceManager(page);
  await page.goto("/skills-matrix");
});

test("mobile Skills Matrix uses focused priorities, people and asset workflows", async ({ page }) => {
  const mobileMatrix = page.locator('[data-vorta-mobile-skills-matrix="true"]');
  await expect(mobileMatrix).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skills Matrix", exact: true })).toBeVisible();
  await expect(page.getByLabel("Select workforce scope")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Skills Matrix mobile sections" })).toBeVisible();
  await expect(page.getByText("Current score", { exact: true })).toBeVisible();
  await expect(page.getByText("Core skills", { exact: true })).toBeVisible();
  await expect(page.getByText("Asset competence", { exact: true }).first()).toBeVisible();

  const peopleTab = page.getByRole("button", { name: "People", exact: true });
  await expectOperationalTouchTarget(peopleTab);
  await peopleTab.click();
  await expect(page.getByRole("heading", { name: "Engineer capability", exact: true })).toBeVisible();

  const person = page.getByRole("button", { name: /^Review .+/ }).first();
  await expect(person).toBeVisible();
  await person.focus();
  await expect(person).toBeFocused();
  await person.click();
  await expect(page.getByRole("dialog", { name: "Detail panel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review training plan", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  const assetsTab = page.getByRole("button", { name: "Assets", exact: true });
  await assetsTab.click();
  await expect(page.getByRole("heading", { name: "Asset competence", exact: true })).toBeVisible();

  const assetCard = mobileMatrix.locator("button").filter({ has: page.locator("h3") }).first();
  if (await assetCard.isVisible()) {
    await assetCard.click();
    await expect(page.getByRole("button", { name: "Back to assets", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open equipment skills", exact: true })).toBeVisible();
  }

  await expectNoPageOverflow(page);
});
