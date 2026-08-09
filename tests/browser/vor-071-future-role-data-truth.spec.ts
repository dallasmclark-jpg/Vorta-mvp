import { expect, test } from "@playwright/test";
import { expectNoPageOverflow } from "./maintenance-manager-test-helpers";

const representativeRoutes = [
  "/production/dashboard",
  "/production/risk",
  "/operator/dashboard",
  "/operator/shift",
  "/contractor/dashboard",
  "/contractor/assignments",
];

test("future role routes fail honest instead of presenting prototype data as live evidence", async ({ page }) => {
  for (const route of representativeRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll("/", "\\/")}(?:\\?.*)?$`));

    await expect(
      page.getByText("Prototype · non-operational", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Operational data is not connected for this role yet",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Evidence state", { exact: true })).toBeVisible();
    await expect(page.getByText("Access boundary", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/No approved live role-specific data feed is connected/i),
    ).toBeVisible();

    await expect(page.getByText(/91% AI Confidence/i)).toHaveCount(0);
    await expect(page.getByText(/Line 3 changeover understaffed/i)).toHaveCount(0);
    await expect(page.getByText(/Operator absence logged/i)).toHaveCount(0);
    await expect(page.getByText(/synthetic|mock data/i)).toHaveCount(0);

    await expectNoPageOverflow(page);
  }
});
