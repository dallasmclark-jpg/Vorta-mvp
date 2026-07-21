import { expect, test, type Page } from "@playwright/test";

const email = process.env.VORTA_E2E_EMAIL ?? "demo@vorta.network";
const password = process.env.VORTA_E2E_PASSWORD ?? "";
const allowedSiteId =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000001";
const allowedOrganisationId =
  process.env.VORTA_E2E_ORGANISATION_ID ??
  "10000000-0000-0000-0000-000000000001";

async function signIn(page: Page): Promise<void> {
  expect(password, "VORTA_E2E_PASSWORD must be configured").not.toBe("");
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
}

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
  await signIn(page);
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

test("live AI Matching renders decision-support evidence without assignment actions", async ({ page }) => {
  await signIn(page);
  const body = await expectScopedResponse(page, "/ai-matching", "ai-matching-data");
  expect(Array.isArray(body.matchResults)).toBe(true);
  expect(Array.isArray(body.gapRecs)).toBe(true);

  await expect(page.getByRole("heading", { name: "AI Matching Evidence", exact: true })).toBeVisible();
  await expect(page.getByText("Runtime-validated evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("AI matching evidence was withheld", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Accept Recommendation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dismiss", exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page, "Live AI Matching evidence");
});

test("live Training Providers renders catalogue evidence without fake enquiries", async ({ page }) => {
  await signIn(page);
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
  await signIn(page);

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
  await page.route(/\/functions\/v1\/ai-matching-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        matchResults: [],
        gapRecs: [],
        departments: [],
        skills: [],
        certifications: [],
        stats: {},
      }),
    });
  });
  await page.goto("/ai-matching");
  await expect(page.getByText("AI matching evidence was withheld", { exact: true })).toBeVisible();
  await expect(page.getByText(/AI matching\.siteId/i)).toBeVisible();

  await page.unroute(/\/functions\/v1\/ai-matching-data/);
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
