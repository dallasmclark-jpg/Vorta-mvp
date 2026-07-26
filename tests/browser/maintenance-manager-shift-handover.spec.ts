import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("Shift Handover renders SAP evidence across responsive layouts", async ({ page }) => {
  test.setTimeout(150_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");

  await expect(page.getByRole("heading", { name: "Shift Handover", exact: true })).toBeVisible();
  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();
  await expect(page.getByText(/SAP EVIDENCE/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Site", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Building", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Area", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mechanical", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Electrical", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Controls", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Facilities", exact: true })).toBeVisible();

  const cards = page.locator('[data-vorta-shift-handover-card="true"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(await cards.count()).toBeGreaterThan(0);

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  if (viewportWidth < 1024) {
    const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
    await expect(filtersButton).toBeVisible();
    await filtersButton.click();
  }

  await expect(page.getByLabel("Criticality")).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByLabel("Sort by")).toBeVisible();
  await page.getByLabel("Sort by").selectOption("breakdown");
  await expect(cards.first()).toBeVisible();

  await cards.first().click();
  if (viewportWidth < 1280) {
    const detailDialog = page.getByRole("dialog", { name: "Detail panel" });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('[data-vorta-shift-handover-detail="true"]')).toBeVisible();
    await expect(detailDialog.getByText("Incoming shift action", { exact: true })).toBeVisible();
    await expect(detailDialog.getByRole("button", { name: "Open equipment work orders" })).toBeVisible();
    await detailDialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(detailDialog).toBeHidden();
  } else {
    await expect(page.locator('aside [data-vorta-shift-handover-detail="true"]')).toBeVisible();
    await expect(page.getByText("Incoming shift action", { exact: true })).toBeVisible();
  }

  await expectNoPageOverflow(page);
});
