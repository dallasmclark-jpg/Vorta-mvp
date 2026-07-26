import { expect, test, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";
const allowedSiteId =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000001";
const allowedOrganisationId =
  process.env.VORTA_E2E_ORGANISATION_ID ??
  "10000000-0000-0000-0000-000000000001";

async function expectNoPageOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label} must not overflow the viewport`).toBeLessThanOrEqual(2);
}

async function waitForFunctionResponse(page: Page, slug: string) {
  return page.waitForResponse(
    (response) =>
      response.url().includes(`/functions/v1/${slug}`) &&
      response.request().method() === "POST",
  );
}

async function expectScopedResponse(
  page: Page,
  path: string,
  slug: string,
): Promise<Record<string, unknown>> {
  const responsePromise = waitForFunctionResponse(page, slug);
  await page.goto(path);
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.siteId).toBe(allowedSiteId);
  expect(body.organisationId).toBe(allowedOrganisationId);
  expect(typeof body.generatedAt).toBe("string");
  return body;
}

test("live Training renders verified read-only evidence", async ({ page }) => {
  await signInMaintenanceManager(page);
  const body = await expectScopedResponse(page, "/training", "training-data");
  expect(Array.isArray(body.recentActivity)).toBe(true);
  expect(Array.isArray(body.priorityRows)).toBe(true);

  await expect(page.getByRole("heading", { name: "Training Evidence", exact: true })).toBeVisible();
  await expect(page.getByText("Runtime-validated evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Training evidence was withheld", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve Booking", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark Completed", exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page, "Live Training evidence");
});

test("live Capability Matching is withheld and returns users to Requirements", async ({ page }) => {
  await signInMaintenanceManager(page);
  await page.goto("/ai-matching");
  await page.waitForURL(/\/requirements$/);

  await expect(page.getByRole("heading", { name: "Requirements", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Matching Evidence", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept Recommendation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dismiss", exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page, "Withheld live Capability Matching route");
});

test("live Training Providers renders catalogue evidence without fake enquiries", async ({ page }) => {
  await signInMaintenanceManager(page);
  const body = await expectScopedResponse(
    page,
    "/training-providers",
    "training-providers-data",
  );
  expect(Array.isArray(body.providers)).toBe(true);
  expect(Array.isArray(body.gapMatches)).toBe(true);

  await expect(page.getByRole("heading", { name: "Training Provider Evidence", exact: true })).toBeVisible();
  await expect(page.getByText("Runtime-validated evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Provider evidence was withheld", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Shortlist Provider", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request Availability", exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page, "Live provider evidence");
});

test("live training workflow pages fail closed when evidence scope metadata is missing", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1920", "Fail-closed contracts are exercised once per run");
  await signInMaintenanceManager(page);

  await page.route(/\/functions\/v1\/training-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        recentActivity: [],
        priorityRows: [],
        certRiskRows: [],
        recommendedCourses: [],
        trainingPartners: [],
        departments: [],
        spendByMonth: [],
        bookingsByDept: [],
        insights: [],
        stats: {},
      }),
    });
  });
  await page.goto("/training");
  await expect(page.getByText("Training evidence was withheld", { exact: true })).toBeVisible();
  await expect(page.getByText(/Training\.siteId/i)).toBeVisible();

  await page.unroute(/\/functions\/v1\/training-data/);
  await page.route(/\/functions\/v1\/training-providers-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ providers: [], gapMatches: [], stats: {} }),
    });
  });
  await page.goto("/training-providers");
  await expect(page.getByText("Provider evidence was withheld", { exact: true })).toBeVisible();
  await expect(page.getByText(/Training providers\.siteId/i)).toBeVisible();
});
