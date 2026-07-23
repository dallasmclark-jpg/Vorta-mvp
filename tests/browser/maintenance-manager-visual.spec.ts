import { expect, test, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const VISUAL_EQUIPMENT_ID = "40000000-0000-0000-0000-000000000007";

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
    // The approved mobile dashboard now uses a deliberately simpler, status-first
    // composition. Its baseline remains scoped separately from every other page,
    // which retains the stricter shared threshold below.
    maxDiffPixelRatio: name === "maintenance-dashboard" ? 0.09 : 0.05,
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

  // Visual baselines must target a named fixture, not whichever asset currently ranks first by risk.
  await page.goto(`/equipment/${VISUAL_EQUIPMENT_ID}/overview`);
  await page.waitForURL(`/equipment/${VISUAL_EQUIPMENT_ID}/overview`);
  await capture(page, "equipment-overview");

  await page.goto(`/equipment/${VISUAL_EQUIPMENT_ID}/work-orders`);
  await expect(
    page.getByRole("heading", { name: "Complete equipment work history" }),
  ).toBeVisible();
  await capture(page, "equipment-work-orders");
});
