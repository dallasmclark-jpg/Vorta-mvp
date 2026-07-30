import { expect, test, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

async function chooseVortaSelect(
  page: Page,
  label: string,
  optionLabel: string,
): Promise<void> {
  const trigger = page.getByRole("button", { name: label, exact: true });
  await trigger.click();
  const listbox = page.getByRole("listbox", { name: `${label} options` });
  await expect(listbox).toBeVisible();
  await listbox.getByRole("option", { name: optionLabel, exact: true }).click();
}

test("Shift Handover renders SAP evidence across responsive layouts", async ({ page }) => {
  test.setTimeout(150_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");

  await expect(page.getByRole("heading", { name: "Shift Handover", exact: true })).toBeVisible();
  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();
  const reviewPeriod = page.getByRole("button", { name: "Review period", exact: true });
  await expect(reviewPeriod).toBeVisible();
  await expect(reviewPeriod).toHaveAttribute("data-value", "12");
  await expect(page.locator('[data-vorta-shift-handover-review-period="true"] [data-vorta-select-selected-supporting-items="true"]')).toBeVisible();
  await reviewPeriod.click();
  const reviewListbox = page.getByRole("listbox", { name: "Review period options" });
  await expect(reviewListbox).toBeVisible();
  await expect(reviewListbox.getByRole("option")).toHaveCount(5);
  await expect(reviewListbox.locator('[data-vorta-select-supporting-items="true"]')).toHaveCount(5);
  await expect(reviewListbox.locator('[data-vorta-select-supporting-items="true"] span').filter({ hasText: /(?:Yellow|Red|Green|Blue|Days) · (?:Day|Night)/ }).first()).toBeVisible();
  await expect(reviewListbox).toHaveAttribute("data-vorta-select-placement", /top|bottom/);
  await expect(page.locator("html")).toHaveAttribute("data-vorta-select-open", "true");
  const openingViewportWidth = page.viewportSize()?.width ?? 1366;
  const viewportBounds = await page.evaluate(() => {
    const visualViewport = window.visualViewport;
    return {
      top: visualViewport?.offsetTop ?? 0,
      bottom: (visualViewport?.offsetTop ?? 0) + (visualViewport?.height ?? window.innerHeight),
    };
  });
  const reviewMenuBox = await reviewListbox.boundingBox();
  expect(reviewMenuBox?.y ?? -1).toBeGreaterThanOrEqual(viewportBounds.top - 1);
  expect((reviewMenuBox?.y ?? 0) + (reviewMenuBox?.height ?? 0)).toBeLessThanOrEqual(viewportBounds.bottom + 1);
  if (openingViewportWidth < 640) {
    await expect(reviewListbox).toHaveAttribute("data-vorta-select-compact", "true");
    expect(reviewMenuBox?.height ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(210);
    for (const option of await reviewListbox.getByRole("option").all()) {
      const optionBox = await option.boundingBox();
      expect(optionBox?.height ?? 0).toBeGreaterThanOrEqual(36);
      expect(optionBox?.height ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(40);
    }
  }
  const askVortaLauncher = page.locator('[data-vorta-shared-mobile-ai-launcher="true"]');
  if (await askVortaLauncher.count()) {
    await expect(askVortaLauncher).toHaveCSS("visibility", "hidden");
  }
  await page.keyboard.press("Escape");
  await expect(reviewListbox).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-vorta-select-open", "true");
  if (await askVortaLauncher.count()) {
    await expect(askVortaLauncher).not.toHaveCSS("visibility", "hidden");
  }

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  const searchInput = page.getByPlaceholder("Search work order or equipment");
  const maintenanceTeamSelect = page.getByRole("button", { name: "Maintenance team", exact: true });
  const criticalitySelect = page.getByRole("button", { name: "Criticality", exact: true });
  const statusSelect = page.getByRole("button", { name: "Status", exact: true });
  const sortSelect = page.getByRole("button", { name: "Sort by", exact: true });
  const scopeTabs = page.locator('[data-vorta-shift-handover-scope-tabs="true"]');
  await expect(scopeTabs).toBeVisible();
  await expect(scopeTabs.getByRole("tab", { name: "Site", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Building", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Area", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mechanical", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Electrical", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Controls", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Facilities", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-vorta-shift-handover-metric="contractor"]')).toHaveCount(0);
  await expect(page.locator('[data-vorta-shift-handover-metric="breakdown"]')).toHaveCount(0);
  await expect(searchInput).toBeVisible();

  if (viewportWidth < 1024) {
    const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
    await expect(filtersButton).toBeVisible();
    await expect(maintenanceTeamSelect).toBeHidden();
    await expect(criticalitySelect).toBeHidden();
    await expect(statusSelect).toBeHidden();
    await expect(sortSelect).toBeHidden();

    const reviewBox = await reviewPeriod.boundingBox();
    const searchBox = await searchInput.boundingBox();
    const filtersBox = await filtersButton.boundingBox();
    expect(reviewBox?.y ?? 0).toBeLessThan(searchBox?.y ?? Number.MAX_SAFE_INTEGER);
    expect(searchBox?.y ?? 0).toBeLessThan(filtersBox?.y ?? Number.MAX_SAFE_INTEGER);
  } else {
    await expect(maintenanceTeamSelect).toBeVisible();
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
    const optionTabs = scopeTabs.getByRole("tab");
    const optionCount = await optionTabs.count();
    expect(optionCount).toBeGreaterThan(0);
    if (optionCount > 1) {
      const selectedOption = optionTabs.last();
      const selectedArea = (await selectedOption.textContent())?.trim() ?? "";
      expect(selectedArea).not.toBe("");
      await selectedOption.click();
      await expect(selectedOption).toHaveAttribute("aria-selected", "true");
      await expect.poll(async () => {
        const containerBox = await scopeTabs.boundingBox();
        const selectedBox = await selectedOption.boundingBox();
        if (!containerBox || !selectedBox) return false;
        return selectedBox.x >= containerBox.x - 1
&& selectedBox.x + selectedBox.width <= containerBox.x + containerBox.width + 1;
      }).toBe(true);
      for (const cardText of await cards.allTextContents()) {
        expect(cardText).toContain(selectedArea);
      }
    }
    await scopeTabs.getByRole("tab", { name: "Site", exact: true }).click();
    const scopeScrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
    expect(scopeScrollAfter).toBeGreaterThanOrEqual(Math.max(0, scopeScrollBefore - 80));
  }

  await scrollContainer.evaluate((element) => { element.scrollTop = 320; });
  const scrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);
  await chooseVortaSelect(page, "Review period", "Previous 2 shifts · 24 hours");
  await expect(page).toHaveURL(/review=24/);
  await expect(page.getByRole("heading", { name: "Activity from the previous 2 shifts", exact: true })).toBeVisible();
  await expect(page.locator('[data-vorta-shift-handover-date-group]').first()).toBeVisible();
  await expect(reviewPeriod).toBeEnabled({ timeout: 30_000 });
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const scrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(scrollAfter).toBeGreaterThanOrEqual(Math.max(0, scrollBefore - 80));

  const totalMetric = page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first();
  await expect(totalMetric).toHaveText(String(await cards.count()));
  if (viewportWidth < 1024) {
    await page.getByRole("button", { name: "Filters", exact: true }).click();
  }

  await chooseVortaSelect(page, "Review period", "Previous shift · 12 hours");
  await expect(page.getByRole("heading", { name: "Previous shift activity", exact: true })).toBeVisible();
  await expect(reviewPeriod).toBeEnabled({ timeout: 30_000 });
  await expect(criticalitySelect).toBeVisible();
  await expect(statusSelect).toBeVisible();
  await expect(sortSelect).toBeVisible();

  const sortScrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);
  await chooseVortaSelect(page, "Sort by", "Longest breakdown");
  const sortScrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(sortScrollAfter).toBeGreaterThanOrEqual(Math.max(0, sortScrollBefore - 80));

  if (viewportWidth < 1024) {
    await chooseVortaSelect(page, "Criticality", "High");
    await expect(page.getByRole("button", { name: "Filters · 1", exact: true })).toBeVisible();
    await chooseVortaSelect(page, "Status", "Completed");
    await expect(page.getByRole("button", { name: "Filters · 2", exact: true })).toBeVisible();
    await chooseVortaSelect(page, "Sort by", "Criticality");
    await expect(page.getByRole("button", { name: "Filters · 2", exact: true })).toBeVisible();
    const clearFilters = page.getByRole("button", { name: "Clear filters", exact: true });
    await expect(clearFilters).toBeVisible();
    await clearFilters.click();
    await expect(criticalitySelect).toHaveAttribute("data-value", "all");
    await expect(statusSelect).toHaveAttribute("data-value", "all");
    await expect(sortSelect).toHaveAttribute("data-value", "recent");
    await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeVisible();
    await expect(clearFilters).toBeHidden();
  }
  await expect(cards.first()).toBeVisible();
  await expect(cards.first().locator('[data-vorta-shift-handover-team-badges="true"]')).toBeVisible();

  await chooseVortaSelect(page, "Review period", "Previous 2 shifts · 24 hours");
  await expect(page.getByRole("heading", { name: "Activity from the previous 2 shifts", exact: true })).toBeVisible();
  await expect(reviewPeriod).toBeEnabled({ timeout: 30_000 });
  await expect(cards.first()).toBeVisible();
  const visibleStatuses = await cards.evaluateAll((nodes) => nodes.map((node) =>
    node.querySelector<HTMLElement>("[data-vorta-shift-handover-card-status]")?.dataset.vortaShiftHandoverCardStatus ?? "",
  ));
  const completedCount = visibleStatuses.filter((status) => status === "completed").length;
  const ongoingCount = visibleStatuses.filter((status) => status === "ongoing").length;
  const waitingCount = visibleStatuses.filter((status) => status === "waiting_on_parts").length;
  await expect(page.locator('[data-vorta-shift-handover-metric="completed"] > p').first()).toHaveText(String(completedCount));
  await expect(page.locator('[data-vorta-shift-handover-metric="ongoing"] > p').first()).toHaveText(String(ongoingCount));
  await expect(page.locator('[data-vorta-shift-handover-metric="waiting-parts"] > p').first()).toHaveText(String(waitingCount));

  const selectedCardStatus = await cards.first().locator("[data-vorta-shift-handover-card-status]").getAttribute("data-vorta-shift-handover-card-status");
  await cards.first().click();
  const detailPanel = viewportWidth < 1280
    ? page.getByRole("dialog", { name: "Detail panel" })
    : page.locator('aside [data-vorta-shift-handover-detail="true"]').first();
  await expect(detailPanel).toBeVisible();
  await expect(detailPanel.locator('[data-vorta-shift-handover-detail="true"]')).toBeVisible();
  await expect(detailPanel.getByText("Incoming shift action", { exact: true })).toBeVisible();
  await expect(detailPanel.getByRole("button", { name: "Open equipment work orders" })).toBeVisible();
  await expect(detailPanel.locator("[data-vorta-shift-handover-detail-status]")).toHaveAttribute(
    "data-vorta-shift-handover-detail-status",
    selectedCardStatus ?? "",
  );
  const detailStatus = await detailPanel.locator("[data-vorta-shift-handover-detail-status]").getAttribute("data-vorta-shift-handover-detail-status");
  const summaryText = (await detailPanel.locator("[data-vorta-shift-handover-confirmation-summary]").textContent())?.toLowerCase() ?? "";
  if (detailStatus === "completed") {
    expect(summaryText).not.toContain("remains open");
  }
  const historyItems = detailPanel.locator("[data-vorta-shift-handover-confirmation-history-item]");
  for (let index = 0; index < await historyItems.count(); index += 1) {
    const historyItem = historyItems.nth(index);
    await expect(historyItem.locator("[data-vorta-shift-handover-confirmation-body]")).toHaveCount(1);
    expect(await historyItem.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await expect(detailPanel.locator('[data-vorta-shift-handover-location="true"]')).toBeVisible();
  if (viewportWidth < 1280) {
    await detailPanel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(detailPanel).toBeHidden();
  }

  await expect(reviewPeriod).toHaveAttribute("data-value", "24");
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

  const reviewPeriod = page.getByRole("button", { name: "Review period", exact: true });
  await expect(reviewPeriod).toBeVisible();
  for (const [value, optionLabel, heading] of [
    ["24", "Previous 2 shifts · 24 hours", "Previous 2 shifts: Activity from the previous 2 shifts"],
    ["36", "Previous 3 shifts · 36 hours", "Previous 3 shifts: Activity from the previous 3 shifts"],
    ["48", "Previous 4 shifts · 48 hours", "Previous 4 shifts: Activity from the previous 4 shifts"],
    ["96", "Previous 8 shifts · 4 days", "Previous 8 shifts: Activity from the previous 8 shifts"],
    ["12", "Previous shift · 12 hours", "Previous shift: Previous shift activity"],
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
    await chooseVortaSelect(page, "Review period", optionLabel);
    await evidenceRequest;
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(reviewPeriod).toHaveAttribute("data-value", value);
    await expectNoPageOverflow(page);
  }
});


test("Shift Handover mobile dropdowns remain compact, viewport safe and fully clearable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-360", "Exercise compact Android-sized controls once; responsive presence is covered elsewhere.");
  test.setTimeout(180_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");

  const scrollContainer = page.locator('[data-vorta-portal-scroll-container="true"]');
  const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
  const criticalitySelect = page.getByRole("button", { name: "Criticality", exact: true });
  const statusSelect = page.getByRole("button", { name: "Status", exact: true });
  const sortSelect = page.getByRole("button", { name: "Sort by", exact: true });
  const reviewPeriod = page.getByRole("button", { name: "Review period", exact: true });
  const searchInput = page.getByPlaceholder("Search work order or equipment");

  await filtersButton.click();
  await expect(criticalitySelect).toBeVisible();
  await expect(statusSelect).toBeVisible();
  await expect(sortSelect).toBeVisible();

  await criticalitySelect.evaluate((element) => {
    const container = document.querySelector<HTMLElement>('[data-vorta-portal-scroll-container="true"]');
    if (!container) return;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const rect = element.getBoundingClientRect();
    container.scrollTop += rect.bottom - viewportHeight + 24;
  });
  await page.waitForTimeout(100);
  const triggerBox = await criticalitySelect.boundingBox();
  const visualHeight = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
  expect(triggerBox?.y ?? 0).toBeGreaterThan(visualHeight * 0.45);
  const scrollBeforeOpen = await scrollContainer.evaluate((element) => element.scrollTop);
  await criticalitySelect.click();
  const criticalityListbox = page.getByRole("listbox", { name: "Criticality options" });
  await expect(criticalityListbox).toBeVisible();
  await expect(criticalityListbox).toHaveAttribute("data-vorta-select-placement", "top");
  const listboxBox = await criticalityListbox.boundingBox();
  const viewport = await page.evaluate(() => ({
    top: window.visualViewport?.offsetTop ?? 0,
    bottom: (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight),
  }));
  expect(listboxBox?.y ?? -1).toBeGreaterThanOrEqual(viewport.top - 1);
  expect((listboxBox?.y ?? 0) + (listboxBox?.height ?? 0)).toBeLessThanOrEqual(viewport.bottom + 1);
  expect(listboxBox?.height ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(210);
  const selectedOption = criticalityListbox.getByRole("option", { name: "All criticalities", exact: true });
  await expect(selectedOption).toBeFocused();
  const selectedBox = await selectedOption.boundingBox();
  expect(selectedBox?.y ?? -1).toBeGreaterThanOrEqual((listboxBox?.y ?? 0) - 1);
  expect((selectedBox?.y ?? 0) + (selectedBox?.height ?? 0)).toBeLessThanOrEqual((listboxBox?.y ?? 0) + (listboxBox?.height ?? 0) + 1);
  const scrollAfterOpen = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(Math.abs(scrollAfterOpen - scrollBeforeOpen)).toBeLessThanOrEqual(2);
  const askVortaLauncher = page.locator('[data-vorta-shared-mobile-ai-launcher="true"]');
  if (await askVortaLauncher.count()) {
    await expect(askVortaLauncher).toHaveCSS("visibility", "hidden");
  }
  await criticalityListbox.getByRole("option", { name: "High", exact: true }).click();
  if (await askVortaLauncher.count()) {
    await expect(askVortaLauncher).not.toHaveCSS("visibility", "hidden");
  }

  for (const [label, value] of [
    ["Critical", "critical"],
    ["High", "high"],
    ["Medium", "medium"],
    ["Low", "low"],
    ["All criticalities", "all"],
  ] as const) {
    await chooseVortaSelect(page, "Criticality", label);
    await expect(criticalitySelect).toHaveAttribute("data-value", value);
  }
  for (const [label, value] of [
    ["Active / ongoing", "active"],
    ["Waiting / deferred", "waiting"],
    ["External contractor", "contractor"],
    ["Completed", "completed"],
    ["All statuses", "all"],
  ] as const) {
    await chooseVortaSelect(page, "Status", label);
    await expect(statusSelect).toHaveAttribute("data-value", value);
  }
  for (const [label, value] of [
    ["Criticality", "priority"],
    ["Longest breakdown", "breakdown"],
    ["Most recent", "recent"],
  ] as const) {
    await chooseVortaSelect(page, "Sort by", label);
    await expect(sortSelect).toHaveAttribute("data-value", value);
  }

  await searchInput.fill("VF");
  await chooseVortaSelect(page, "Criticality", "High");
  await expect(page.getByRole("button", { name: "Filters · 1", exact: true })).toBeVisible();
  await chooseVortaSelect(page, "Status", "Completed");
  await expect(page.getByRole("button", { name: "Filters · 2", exact: true })).toBeVisible();
  await chooseVortaSelect(page, "Sort by", "Criticality");
  const clearFilters = page.getByRole("button", { name: "Clear filters", exact: true });
  await expect(clearFilters).toBeVisible();
  const scrollBeforeClear = await scrollContainer.evaluate((element) => element.scrollTop);
  await clearFilters.click();
  await expect(criticalitySelect).toHaveAttribute("data-value", "all");
  await expect(statusSelect).toHaveAttribute("data-value", "all");
  await expect(sortSelect).toHaveAttribute("data-value", "recent");
  await expect(searchInput).toHaveValue("VF");
  await expect(reviewPeriod).toHaveAttribute("data-value", "12");
  await expect(clearFilters).toBeHidden();
  const scrollAfterClear = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(scrollAfterClear).toBeGreaterThanOrEqual(Math.max(0, scrollBeforeClear - 80));

  await searchInput.fill("");
  const statusDisclosure = page.getByRole("button", { name: "How handover statuses are calculated", exact: true });
  await statusDisclosure.scrollIntoViewIfNeeded();
  await expect(statusDisclosure).toHaveAttribute("aria-expanded", "false");
  const disclosureScrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);
  await statusDisclosure.click();
  await expect(statusDisclosure).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Handover status is normalised from SAP work-order status", { exact: false })).toBeVisible();
  const disclosureScrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(disclosureScrollAfter).toBeGreaterThanOrEqual(Math.max(0, disclosureScrollBefore - 20));
  await statusDisclosure.click();
  await expect(statusDisclosure).toHaveAttribute("aria-expanded", "false");
  await expectNoPageOverflow(page);
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
