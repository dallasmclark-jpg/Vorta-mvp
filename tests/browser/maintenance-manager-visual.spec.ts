import { expect, test, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

async function settleVisualPage(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page: Page, name: string): Promise<void> {
  await settleVisualPage(page);
  await expect.soft(page).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    maxDiffPixelRatio: 0.05,
  });
}

test("Maintenance Manager priority pages retain their approved responsive layout", async ({
  page,
}) => {
  await signInMaintenanceManager(page);
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  await capture(page, "maintenance-dashboard");

  await page.goto("/maintenance/labour-risk/shift-cover");
  await expect(
    page.getByRole("heading", { name: "Operational Rota Risk Map", exact: true }),
  ).toBeVisible();
  await capture(page, "shift-cover");

  await page.goto("/skills-matrix");
  await expect(page.getByRole("heading", { name: /Skills Matrix/i }).first()).toBeVisible();
  await capture(page, "skills-matrix");

  await page.goto("/equipment");
  await expect(page.getByRole("heading", { name: "Equipment", exact: true })).toBeVisible();
  const equipmentButton = page
    .locator('div[role="button"][aria-expanded] button')
    .first();
  await expect(equipmentButton).toBeVisible();
  await equipmentButton.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview/);
  await capture(page, "equipment-overview");

  const equipmentId = page.url().match(/\/equipment\/([^/]+)\/overview/)?.[1] ?? "";
  await page.goto(`/equipment/${equipmentId}/work-orders`);
  await expect(
    page.getByRole("heading", { name: "Complete equipment work history" }),
  ).toBeVisible();
  await capture(page, "equipment-work-orders");
});
