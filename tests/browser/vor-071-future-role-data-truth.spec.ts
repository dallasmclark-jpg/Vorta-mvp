import { expect, test, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const futureRoleRoutes = [
  "/production/dashboard",
  "/production/risk",
  "/operator/dashboard",
  "/operator/shift",
  "/contractor/dashboard",
  "/contractor/assignments",
] as const;

function routePattern(route: string): RegExp {
  return new RegExp(`${route.replaceAll("/", "\\/")}(?:\\?.*)?$`);
}

async function expectHonestUnavailableState(page: Page): Promise<void> {
  await expect(
    page.getByText("Prototype · non-operational", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Operational data is not connected for this role yet", {
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

test("authenticated demo administrator sees only honest non-operational future-role evidence", async ({ page }) => {
  // The protected demo account deliberately has the global demo-admin bypass so
  // one authenticated rehearsal user can inspect every portal. That makes it the
  // correct browser identity for proving the future-role presentation itself,
  // not an ordinary-role isolation identity. Permanent auth contracts continue
  // to protect the role boundaries, while VOR-073 adds dedicated cross-role
  // release coverage with non-admin role evidence.
  //
  // Sign in on the actual test page because non-remembered Supabase sessions are
  // stored in sessionStorage and Playwright storageState does not serialise them.
  await signInMaintenanceManager(page);

  for (const route of futureRoleRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(routePattern(route));
    await expectHonestUnavailableState(page);
  }
});
