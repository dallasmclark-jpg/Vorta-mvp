import { expect, test } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

test("a failed dashboard refresh preserves the previous snapshot and disables projected actions", async ({
  page,
}) => {
  await signInMaintenanceManager(page);

  const siteRiskHeading = page.getByRole("heading", {
    name: "Site Risk Briefing",
    exact: true,
  });
  await expect(siteRiskHeading).toBeVisible();

  await page.route(
    /\/rest\/v1\/rpc\/vorta_refresh_and_get_operational_dashboard/,
    async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "simulated operational refresh failure" }),
      });
    },
  );

  await page
    .getByRole("button", { name: "Refresh risk intelligence", exact: true })
    .click();

  const staleNotice = page.locator(
    '[data-vorta-dashboard-evidence-state="stale"]',
  );
  await expect(staleNotice).toBeVisible();
  await expect(staleNotice).toContainText(/last successful snapshot/i);
  await expect(staleNotice).toContainText(/projected actions are disabled/i);
  await expect(siteRiskHeading).toBeVisible();

  const workPlanButton = page.getByRole("button", {
    name: "View work plan",
    exact: true,
  });
  await expect(workPlanButton).toBeDisabled();
  await expect(workPlanButton).toHaveAttribute(
    "title",
    /disabled until the operational snapshot and work plan are verified/i,
  );
});
