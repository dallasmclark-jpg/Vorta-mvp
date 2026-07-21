import { expect, test, type Page } from "@playwright/test";

const email = process.env.VORTA_E2E_EMAIL ?? "demo@vorta.network";
const password = process.env.VORTA_E2E_PASSWORD ?? "";
const allowedSiteId =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000001";
const deniedSiteId =
  process.env.VORTA_E2E_DENIED_SITE_ID ??
  "11000000-0000-0000-0000-000000000002";

async function signIn(page: Page): Promise<void> {
  expect(password, "VORTA_E2E_PASSWORD must be configured").not.toBe("");
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "The live Engineers page must not overflow the viewport").toBeLessThanOrEqual(2);
}

test("live Engineers is active-site scoped and derives availability from Shift Cover", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/engineers");

  const liveEngineers = page.locator('[data-vorta-live-engineers="true"]');
  await expect(liveEngineers).toBeVisible();
  await expect(liveEngineers).toHaveAttribute("data-vorta-active-site", allowedSiteId);
  await expect(page.getByRole("heading", { name: "Engineers", exact: true })).toBeVisible();
  await expect(page.getByText("ACTIVE-SITE VERIFIED", { exact: true })).toBeVisible();
  await expect(page.getByText("Scheduled today", { exact: true })).toBeVisible();
  await expect(page.getByText("Scheduled this week", { exact: true })).toBeVisible();
  await expect(page.getByText("Rota completeness", { exact: true })).toBeVisible();
  await expect(page.getByText("Verified weekly coverage", { exact: true })).toBeVisible();

  await expect(page.getByText("At-Risk Shifts This Month", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Training Conflicts", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Contractor Cover Required", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Engineer", exact: true })).toHaveCount(0);

  const review = page.getByRole("button", { name: /^Review .+/ }).first();
  await expect(review).toBeVisible();
  await review.focus();
  await expect(review).toBeFocused();
  await review.click();
  await expect(page.getByText("Verified workforce record", { exact: true })).toBeVisible();
  await expect(page.getByText("Verified rota evidence", { exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("malformed live Engineers evidence fails closed instead of becoming an empty workforce", async ({
  page,
}) => {
  await signIn(page);
  await page.route(/\/functions\/v1\/engineers-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        siteId: allowedSiteId,
        organisationId: "10000000-0000-0000-0000-000000000001",
        generatedAt: new Date().toISOString(),
        engineers: [{ id: "broken-engineer" }],
        assignments: [],
        trainingBookings: [],
        skillGaps: [],
        departments: [],
        sites: [],
        stats: {
          totalEngineers: 1,
          verifiedEngineers: 0,
          currentlyAvailable: 0,
          onShiftToday: 0,
          inTraining: 0,
          criticalHolders: 0,
          avgCompetencyScore: 0,
          certificationsExpiring30d: 0,
        },
      }),
    });
  });

  await page.goto("/engineers");
  await expect(
    page.getByText("Verified Engineers evidence is unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/expected a non-empty string/i)).toBeVisible();
  await expect(page.getByText("0 scoped workforce records", { exact: true })).toHaveCount(0);
});

test("a cross-site Engineers response is withheld", async ({ page }) => {
  await signIn(page);
  await page.route(/\/functions\/v1\/engineers-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        siteId: deniedSiteId,
        organisationId: "20000000-0000-0000-0000-000000000002",
        generatedAt: new Date().toISOString(),
        engineers: [],
        assignments: [],
        trainingBookings: [],
        skillGaps: [],
        departments: [],
        sites: [],
        stats: {
          totalEngineers: 0,
          verifiedEngineers: 0,
          currentlyAvailable: 0,
          onShiftToday: 0,
          inTraining: 0,
          criticalHolders: 0,
          avgCompetencyScore: 0,
          certificationsExpiring30d: 0,
        },
      }),
    });
  });

  await page.goto("/engineers");
  await expect(
    page.getByText("Verified Engineers evidence is unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/does not match the authorised site and organisation/i)).toBeVisible();
  await expect(page.getByText("ACTIVE-SITE VERIFIED", { exact: true })).toHaveCount(0);
});
