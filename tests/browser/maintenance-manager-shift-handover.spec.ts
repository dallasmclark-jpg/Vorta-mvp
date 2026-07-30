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

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  const searchInput = page.getByPlaceholder("Search work order or equipment");
  const criticalitySelect = page.getByLabel("Criticality");
  const statusSelect = page.getByLabel("Status");
  const sortSelect = page.getByLabel("Sort by");
  await expect(page.getByRole("button", { name: "Site", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Building", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Area", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mechanical", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Electrical", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Controls", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Facilities", exact: true })).toBeVisible();
  await expect(searchInput).toBeVisible();

  if (viewportWidth < 1024) {
    const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
    await expect(filtersButton).toBeVisible();
    await expect(criticalitySelect).toBeHidden();
    await expect(statusSelect).toBeHidden();
    await expect(sortSelect).toBeHidden();

    const reviewBox = await reviewPeriod.boundingBox();
    const disciplineBox = await page.getByText("Discipline", { exact: true }).boundingBox();
    const searchBox = await searchInput.boundingBox();
    const filtersBox = await filtersButton.boundingBox();
    expect(reviewBox?.y ?? 0).toBeLessThan(disciplineBox?.y ?? Number.MAX_SAFE_INTEGER);
    expect(disciplineBox?.y ?? 0).toBeLessThan(searchBox?.y ?? Number.MAX_SAFE_INTEGER);
    expect(searchBox?.y ?? 0).toBeLessThan(filtersBox?.y ?? Number.MAX_SAFE_INTEGER);
  } else {
    await expect(criticalitySelect).toBeVisible();
    await expect(statusSelect).toBeVisible();
    await expect(sortSelect).toBeVisible();
  }

  const cards = page.locator('[data-vorta-shift-handover-card="true"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  expect(await cards.count()).toBeGreaterThan(0);
  const scrollContainer = page.locator('[data-vorta-portal-scroll-container="true"]');

  if (viewportWidth < 1024) {
    await scrollContainer.evaluate((element) => { element.scrollTop = 280; });
    const scopeScrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);
    await page.getByRole("button", { name: "Building", exact: true }).click();
    const scopeOptions = page.locator('[data-vorta-shift-handover-scope-options="true"]');
    await expect(scopeOptions).toBeVisible();
    const optionButtons = scopeOptions.getByRole("button");
    if (await optionButtons.count() > 1) {
      const selectedOption = optionButtons.last();
      await selectedOption.click();
      await expect.poll(async () => {
        const containerBox = await scopeOptions.boundingBox();
        const selectedBox = await selectedOption.boundingBox();
        if (!containerBox || !selectedBox) return false;
        return selectedBox.x >= containerBox.x - 1
&& selectedBox.x + selectedBox.width <= containerBox.x + containerBox.width + 1;
      }).toBe(true);
    }
    await page.getByRole("button", { name: "Site", exact: true }).click();
    const scopeScrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
    expect(scopeScrollAfter).toBeGreaterThanOrEqual(Math.max(0, scopeScrollBefore - 80));
  }

  await scrollContainer.evaluate((element) => { element.scrollTop = 320; });
  const scrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);
  await reviewPeriod.selectOption("24");
  await expect(page).toHaveURL(/review=24/);
  await expect(page.getByRole("heading", { name: "Activity from the last 24 hours" })).toBeVisible();
  await expect(page.locator('[data-vorta-shift-handover-date-group]').first()).toBeVisible();
  await expect(reviewPeriod).toBeEnabled({ timeout: 30_000 });
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const scrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(scrollAfter).toBeGreaterThanOrEqual(Math.max(0, scrollBefore - 80));

  const totalMetric = page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first();
  await expect(totalMetric).toHaveText(String(await cards.count()));
  const breakdownMetric = page.locator('[data-vorta-shift-handover-metric="breakdown"]');
  const breakdownValue = breakdownMetric.locator("p").first();
  const breakdownText = (await breakdownValue.textContent())?.trim() ?? "";
  if (breakdownText === "0 hrs") {
    await expect(breakdownValue).not.toHaveClass(/text-orange-300/);
  } else {
    expect(breakdownText).toMatch(/^\d+(?:\.\d)? hrs$/);
    await expect(breakdownValue).toHaveClass(/text-orange-300/);
  }

  if (viewportWidth < 1024) {
    await page.getByRole("button", { name: "Filters", exact: true }).click();
  }

  await reviewPeriod.selectOption("12");
  await expect(page.getByRole("heading", { name: "Previous shift activity for Last 12 hours" })).toBeVisible();
  await expect(reviewPeriod).toBeEnabled({ timeout: 30_000 });
  await expect(criticalitySelect).toBeVisible();
  await expect(statusSelect).toBeVisible();
  await expect(sortSelect).toBeVisible();

  const sortScrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);
  await sortSelect.selectOption("breakdown");
  const sortScrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(sortScrollAfter).toBeGreaterThanOrEqual(Math.max(0, sortScrollBefore - 80));

  if (viewportWidth < 1024) {
    await criticalitySelect.selectOption("high");
    await expect(page.getByRole("button", { name: "Filters · 1", exact: true })).toBeVisible();
    await statusSelect.selectOption("completed");
    await expect(page.getByRole("button", { name: "Filters · 2", exact: true })).toBeVisible();
    await sortSelect.selectOption("priority");
    await expect(page.getByRole("button", { name: "Filters · 2", exact: true })).toBeVisible();
    await criticalitySelect.selectOption("all");
    await statusSelect.selectOption("all");
    await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeVisible();
  }
  await expect(cards.first()).toBeVisible();

  await reviewPeriod.selectOption("24");
  await expect(page.getByRole("heading", { name: "Activity from the last 24 hours" })).toBeVisible();
  await expect(reviewPeriod).toBeEnabled({ timeout: 30_000 });
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
  await expect(searchInput).toBeVisible();
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
