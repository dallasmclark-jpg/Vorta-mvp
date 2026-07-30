import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("Shift Handover renders SAP evidence across responsive layouts", async ({ page }) => {
  test.setTimeout(150_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");

  await expect(page.getByRole("heading", { name: "Shift Handover", exact: true })).toBeVisible();
  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();
  const reviewPeriod = page.getByLabel("Review period");
  await expect(reviewPeriod).toBeVisible();
  await expect(reviewPeriod).toHaveValue("12");
  await expect(reviewPeriod.locator("option")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Site", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Building", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Area", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mechanical", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Electrical", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Controls", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Facilities", exact: true })).toBeVisible();

  const cards = page.locator('[data-vorta-shift-handover-card="true"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(await cards.count()).toBeGreaterThan(0);

  const scrollContainer = page.locator('[data-vorta-portal-scroll-container="true"]');
  await scrollContainer.evaluate((element) => { element.scrollTop = 320; });
  const scrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);
  await reviewPeriod.selectOption("24");
  await expect(page).toHaveURL(/review=24/);
  await expect(reviewPeriod).toHaveValue("24");
  await expect(page.getByRole("heading", { name: "Activity from the last 24 hours" })).toBeVisible();
  await expect(page.locator('[data-vorta-shift-handover-date-group]').first()).toBeVisible();
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const scrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(scrollAfter).toBeGreaterThanOrEqual(Math.max(0, scrollBefore - 80));
  const totalMetric = page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first();
  await expect(totalMetric).toHaveText(String(await cards.count()));

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  if (viewportWidth < 1024) {
    const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
    await expect(filtersButton).toBeVisible();
    await filtersButton.click();
  }

  await reviewPeriod.selectOption("12");
  await expect(page.getByRole("heading", { name: "Previous shift activity for Last 12 hours" })).toBeVisible();
  await expect(page.getByLabel("Criticality")).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByLabel("Sort by")).toBeVisible();
  await page.getByLabel("Sort by").selectOption("breakdown");
  await expect(cards.first()).toBeVisible();

  await reviewPeriod.selectOption("24");
  await expect(page.getByRole("heading", { name: "Activity from the last 24 hours" })).toBeVisible();
  await expect(cards.first()).toBeVisible();
  await cards.first().click();
  if (viewportWidth < 1280) {
    const detailDialog = page.getByRole("dialog", { name: "Detail panel" });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.locator('[data-vorta-shift-handover-detail="true"]')).toBeVisible();
    await expect(detailDialog.getByText("Incoming shift action", { exact: true })).toBeVisible();
    await expect(detailDialog.getByRole("button", { name: "Open equipment work orders" })).toBeVisible();
    await detailDialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(detailDialog).toBeHidden();
  } else {
    await expect(page.locator('aside [data-vorta-shift-handover-detail="true"]')).toBeVisible();
    await expect(page.getByText("Incoming shift action", { exact: true })).toBeVisible();
  }

  await expect(reviewPeriod).toHaveValue("24");
  await expectNoPageOverflow(page);
});

test("Shift Handover sends every approved review period to the evidence boundary", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-360", "Exercise every period once; responsive presence is covered by all projects.");
  test.setTimeout(150_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");

  const reviewPeriod = page.getByLabel("Review period");
  await expect(reviewPeriod).toBeVisible();
  for (const [value, heading] of [
    ["24", "Activity from the last 24 hours"],
    ["36", "Activity from the last 36 hours"],
    ["48", "Activity from the last 48 hours"],
    ["96", "Activity from the last 4 days"],
    ["12", "Previous shift activity for Last 12 hours"],
  ] as const) {
    const evidenceRequest = page.waitForRequest((request) => {
      if (!/\/functions\/v1\/shift-handover-data(?:\?.*)?$/.test(request.url())) return false;
      if (request.method() !== "POST") return false;
      try {
        return Number(request.postDataJSON()?.reviewHours) === Number(value);
      } catch {
        return false;
      }
    });
    await reviewPeriod.selectOption(value);
    await evidenceRequest;
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(reviewPeriod).toHaveValue(value);
    await expectNoPageOverflow(page);
  }
});

test("Shift Handover refreshes the session after a wrapped 401", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-360", "Exercise mobile session recovery once.");
  test.setTimeout(120_000);
  await signInMaintenanceManager(page);

  let handoverPostAttempts = 0;
  await page.route(/\/functions\/v1\/shift-handover-data(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    handoverPostAttempts += 1;
    if (handoverPostAttempts === 1) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: 401, message: "Invalid JWT" }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto("/shift-handover");

  const cards = page.locator('[data-vorta-shift-handover-card="true"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(handoverPostAttempts).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expectNoPageOverflow(page);
});
