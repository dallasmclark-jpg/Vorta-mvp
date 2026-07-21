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

test("live Skills Matrix returns active-site capability evidence", async ({ page }) => {
  await signIn(page);
  const responsePromise = waitForFunctionResponse(page, "skills-matrix-data");
  await page.goto("/skills-matrix");

  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.siteId).toBe(allowedSiteId);
  expect(body.organisationId).toBe(allowedOrganisationId);
  expect(body.site?.id).toBe(allowedSiteId);
  expect(typeof body.generatedAt).toBe("string");
  expect(typeof body.sourceUpdatedAt).toBe("string");

  await expect(page.getByRole("heading", { name: "Skills Matrix", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Skills capability data could not be loaded",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByText("Capability intelligence", { exact: true })).toBeVisible();
  await expectNoPageOverflow(page, "Live Skills Matrix");
});

test("live Requirements returns active-site requirement evidence", async ({ page }) => {
  await signIn(page);
  const responsePromise = waitForFunctionResponse(page, "requirements-data");
  await page.goto("/requirements");

  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.siteId).toBe(allowedSiteId);
  expect(body.organisationId).toBe(allowedOrganisationId);
  expect(typeof body.generatedAt).toBe("string");

  await expect(page.getByRole("heading", { name: "Requirements", exact: true })).toBeVisible();
  await expect(page.getByText("Runtime-validated evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Requirements evidence was withheld", { exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page, "Live Requirements");
});

test("workforce pages fail closed when required evidence metadata is missing", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1920", "Fail-closed contract is exercised once per run");
  await signIn(page);

  await page.route(/\/functions\/v1\/skills-matrix-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        sourceUpdatedAt: new Date().toISOString(),
        site: { id: allowedSiteId, name: "Maintenance site" },
        overall: {},
        teams: [],
        departments: [],
        areaSkills: {},
        details: {},
      }),
    });
  });

  await page.goto("/skills-matrix");
  await expect(
    page.getByRole("heading", {
      name: "Skills capability data could not be loaded",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Skills matrix\.siteId/i)).toBeVisible();

  await page.unroute(/\/functions\/v1\/skills-matrix-data/);
  await page.route(/\/functions\/v1\/requirements-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requirements: [],
        coverageByGroup: [],
        certExpiries: [],
        actionRows: [],
        departments: [],
        stats: {
          totalReqs: 0,
          fullyCovered: 0,
          skillsAtRisk: 0,
          criticalGaps: 0,
        },
      }),
    });
  });

  await page.goto("/requirements");
  await expect(page.getByText("Requirements evidence was withheld", { exact: true })).toBeVisible();
  await expect(page.getByText(/Requirements\.siteId/i)).toBeVisible();
});
