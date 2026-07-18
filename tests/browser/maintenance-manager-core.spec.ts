import { expect, test, type Locator, type Page } from "@playwright/test";

const email = process.env.VORTA_E2E_EMAIL ?? "demo@vorta.network";
const password = process.env.VORTA_E2E_PASSWORD ?? "";

async function expectNoPageOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
      })),
    )
    .toMatchObject({
      viewport: await page.evaluate(() => window.innerWidth),
    });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "The portal must not overflow the viewport").toBeLessThanOrEqual(2);
}

async function expectOperationalTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, "Operational control must be visible").not.toBeNull();
  expect(box?.height ?? 0, "Operational control must be at least 40px high").toBeGreaterThanOrEqual(39.5);
}

async function openFirstDifferentAiWorkOrder(
  historyButtons: Locator,
  currentWorkOrder: string,
): Promise<string> {
  const count = await historyButtons.count();
  expect(count, "Ask Vorta must return at least one linked work order").toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const candidate = historyButtons.nth(index);
    const workOrderNumber =
      (await candidate.locator("span").first().textContent())?.trim() ?? "";
    if (/^WO-/i.test(workOrderNumber) && workOrderNumber !== currentWorkOrder) {
      await candidate.click();
      return workOrderNumber;
    }
  }

  throw new Error("Ask Vorta did not return a different linked work order.");
}

test("authenticated Maintenance Manager core workflow remains in context", async ({ page }) => {
  expect(
    password,
    "VORTA_E2E_PASSWORD must be configured as a protected CI secret",
  ).not.toBe("");

  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  await expectNoPageOverflow(page);

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  if (viewportWidth <= 420) {
    const riskScopeSelect = page.getByLabel("Risk scope", { exact: true });
    await expect(riskScopeSelect).toBeVisible();
    const areaOption = riskScopeSelect.locator('option:not([value="site"])').first();
    const areaValue = await areaOption.getAttribute("value");
    expect(areaValue).not.toBeNull();
    await riskScopeSelect.selectOption(areaValue ?? "");
    await expect(riskScopeSelect).toHaveValue(areaValue ?? "");
  } else {
    const riskScopeTabs = page.getByRole("tablist", {
      name: "Risk intelligence scope",
    });
    await expect(riskScopeTabs).toBeVisible();
    const areaTab = riskScopeTabs
      .getByRole("tab")
      .filter({ hasNotText: /^\s*Site Risk/i })
      .first();
    await expect(areaTab).toBeVisible();
    await expectOperationalTouchTarget(areaTab);
    await areaTab.click();
    await expect(areaTab).toHaveAttribute("aria-selected", "true");
  }

  const shiftCoverCard = page
    .getByRole("heading", { name: "Shift Cover", exact: true })
    .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')][1]");
  await expect(shiftCoverCard).toBeVisible();
  await shiftCoverCard.click();
  await page.waitForURL(/\/maintenance\/labour-risk\/shift-cover(?:\?.*)?$/);
  await expect(
    page.getByRole("heading", { name: "Shift Cover Risk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Operational Rota Risk Map", exact: true }),
  ).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Ask Vorta AI", exact: true }),
  ).toBeHidden();

  const openMenu = page.getByRole("button", { name: "Open menu", exact: true });
  if (await openMenu.isVisible()) {
    await expectOperationalTouchTarget(openMenu);
    await openMenu.click();
  }

  const equipmentNavigation = page.getByRole("link", {
    name: "Equipment",
    exact: true,
  });
  await expect(equipmentNavigation).toBeVisible();
  await expectOperationalTouchTarget(equipmentNavigation);
  await equipmentNavigation.click();
  await page.waitForURL(/\/equipment(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Equipment", exact: true })).toBeVisible();
  await expectNoPageOverflow(page);

  const equipmentButton = page
    .locator('div[role="button"][aria-expanded] button')
    .first();
  await expect(equipmentButton).toBeVisible();
  await expectOperationalTouchTarget(equipmentButton);
  await equipmentButton.click();

  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);
  const equipmentRouteMatch = page.url().match(/\/equipment\/([^/]+)\/overview/);
  expect(equipmentRouteMatch).not.toBeNull();
  const equipmentId = equipmentRouteMatch?.[1] ?? "";
  await expectNoPageOverflow(page);

  const equipmentSections = page.locator('[aria-label="Equipment sections"]');
  const workOrdersTab = equipmentSections.getByRole("button", {
    name: "Work Orders",
    exact: true,
  });
  await expect(workOrdersTab).toBeVisible();
  await expectOperationalTouchTarget(workOrdersTab);
  await workOrdersTab.click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/work-orders(?:\\?.*)?$`));
  await expect(
    page.getByRole("heading", { name: "Complete equipment work history" }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await expect(
    page.getByRole("button", { name: "Ask Vorta AI", exact: true }),
  ).toBeHidden();

  const firstWorkOrderButton = page
    .locator('#work-order-register tbody button')
    .first();
  await expect(firstWorkOrderButton).toBeVisible();
  await expectOperationalTouchTarget(firstWorkOrderButton);
  const firstWorkOrder = (await firstWorkOrderButton.textContent())?.trim() ?? "";
  expect(firstWorkOrder).not.toBe("");

  const workOrdersUrl = page.url();
  await firstWorkOrderButton.click();

  const executionDialog = page.getByRole("dialog", {
    name: firstWorkOrder,
    exact: true,
  });
  await expect(executionDialog).toBeVisible();
  await expect(
    executionDialog.getByText("Engineer confirmations", { exact: true }),
  ).toBeVisible();
  await expect(
    executionDialog.getByText("Goods movements", { exact: true }),
  ).toBeVisible();

  const closeWorkOrder = executionDialog
    .getByRole("button", { name: "Close work order information", exact: true })
    .last();
  await expectOperationalTouchTarget(closeWorkOrder);
  await closeWorkOrder.click();
  await expect(executionDialog).toBeHidden();
  await expect(page).toHaveURL(workOrdersUrl);

  const askInput = page.getByPlaceholder(/Ask Vorta about .* work execution/i);
  await expect(askInput).toBeVisible();
  await askInput.fill(
    "Show the fault history for this equipment and the linked work orders with source evidence.",
  );
  const askButton = page.getByRole("button", { name: "Ask Vorta", exact: true });
  await expectOperationalTouchTarget(askButton);
  await askButton.click();

  const historyHeading = page.getByRole("heading", {
    name: "Recent matching history",
  });
  await expect(historyHeading).toBeVisible({ timeout: 30_000 });
  const historySection = historyHeading.locator("xpath=ancestor::section[1]");
  const historyButtons = historySection.getByRole("button", { name: /^WO-/ });
  const secondWorkOrder = await openFirstDifferentAiWorkOrder(
    historyButtons,
    firstWorkOrder,
  );

  const secondExecutionDialog = page.getByRole("dialog", {
    name: secondWorkOrder,
    exact: true,
  });
  await expect(secondExecutionDialog).toBeVisible();
  await expect(
    secondExecutionDialog.getByText("Engineer confirmations", { exact: true }),
  ).toBeVisible();
  await expect(
    secondExecutionDialog.getByText("Goods movements", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(workOrdersUrl);
  await expectNoPageOverflow(page);
});
