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

test("live Career renders site-wide workforce evidence without a fake personal profile", async ({ page }) => {
  await signIn(page);
  const body = await expectScopedResponse(page, "/career", "career-evidence-data");
  expect(Array.isArray(body.paths)).toBe(true);
  expect(Array.isArray(body.requirements)).toBe(true);

  await expect(page.getByRole("heading", { name: "Career Evidence", exact: true })).toBeVisible();
  await expect(page.getByText("Runtime-validated evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Career evidence was withheld", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Dallas Clark", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Maintenance & Reliability Director", { exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page, "Live Career evidence");
});

test("live Support renders operational evidence and a real support contact", async ({ page }) => {
  await signIn(page);
  const body = await expectScopedResponse(page, "/support", "support-evidence-data");
  expect(Array.isArray(body.requests)).toBe(true);

  await expect(page.getByRole("heading", { name: "Support Evidence", exact: true })).toBeVisible();
  await expect(page.getByText("Runtime-validated evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Support evidence was withheld", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Email Vorta Support", exact: true })).toHaveAttribute(
    "href",
    /mailto:support@vorta\.network/,
  );
  await expect(page.getByRole("button", { name: "Create Ticket", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send Reply", exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page, "Live Support evidence");
});

test("live Settings renders scoped access and health evidence without fake configuration controls", async ({ page }) => {
  await signIn(page);
  const body = await expectScopedResponse(page, "/settings", "settings-evidence-data");
  expect((body.site as { id?: unknown } | undefined)?.id).toBe(allowedSiteId);
  expect((body.organisation as { id?: unknown } | undefined)?.id).toBe(allowedOrganisationId);

  await expect(page.getByRole("heading", { name: "System & Access Evidence", exact: true })).toBeVisible();
  await expect(page.getByText("Runtime-validated evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Settings evidence was withheld", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send Invite", exact: true })).toHaveCount(0);
  await expectNoPageOverflow(page, "Live Settings evidence");
});

test("live boundary evidence pages fail closed when scope metadata is missing", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1920", "Fail-closed contracts are exercised once per run");
  await signIn(page);

  await page.route(/\/functions\/v1\/career-evidence-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ paths: [], requirements: [], stats: {} }),
    });
  });
  await page.goto("/career");
  await expect(page.getByText("Career evidence was withheld", { exact: true })).toBeVisible();
  await expect(page.getByText(/Career evidence\.siteId/i)).toBeVisible();

  await page.unroute(/\/functions\/v1\/career-evidence-data/);
  await page.route(/\/functions\/v1\/support-evidence-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ requests: [], stats: {} }),
    });
  });
  await page.goto("/support");
  await expect(page.getByText("Support evidence was withheld", { exact: true })).toBeVisible();
  await expect(page.getByText(/Support evidence\.siteId/i)).toBeVisible();

  await page.unroute(/\/functions\/v1\/support-evidence-data/);
  await page.route(/\/functions\/v1\/settings-evidence-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ site: {}, organisation: {}, access: {}, configuration: {} }),
    });
  });
  await page.goto("/settings");
  await expect(page.getByText("Settings evidence was withheld", { exact: true })).toBeVisible();
  await expect(page.getByText(/Settings evidence\.siteId/i)).toBeVisible();
});
