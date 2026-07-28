import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  expectOperationalTouchTarget,
  openFirstDifferentAiWorkOrder,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("Equipment work-order overlays and Ask Vorta remain on the originating page", async ({
  page,
}) => {
  await signInMaintenanceManager(page);
  await page.goto("/equipment");
  await page.waitForURL(/\/equipment(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Equipment", exact: true })).toBeVisible();
  await expectNoPageOverflow(page);

  const isMobileEquipmentNavigation = (page.viewportSize()?.width ?? 1024) < 640;
  const equipmentButton = isMobileEquipmentNavigation
    ? page
        .locator('[data-vorta-mobile-equipment="true"] button[aria-label^="Open overview for "]')
        .first()
    : page.locator('div[role="button"][aria-expanded] button').first();
  await expect(equipmentButton).toBeVisible();
  await expectOperationalTouchTarget(equipmentButton);
  await equipmentButton.click();

  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);
  const equipmentRouteMatch = page.url().match(/\/equipment\/([^/]+)\/overview/);
  expect(equipmentRouteMatch).not.toBeNull();
  const equipmentId = equipmentRouteMatch?.[1] ?? "";
  await expectNoPageOverflow(page);

  const equipmentSections = page.getByRole("tablist", {
    name: "Equipment sections",
  });
  const workOrdersTab = equipmentSections.getByRole("tab", {
    name: "Work Orders",
    exact: true,
  });
  await expect(workOrdersTab).toBeVisible();
  await expectOperationalTouchTarget(workOrdersTab);
  await workOrdersTab.click();

  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/work-orders(?:\\?.*)?$`));
  await expectNoPageOverflow(page);

  if (isMobileEquipmentNavigation) {
    const mobileRegister = page.locator('[data-vorta-mobile-work-orders="true"]');
    await expect(mobileRegister).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Work-order register view" })).toBeVisible();

    const openWorkOrder = page.getByRole("button", { name: "Open work order", exact: true }).first();
    await expect(openWorkOrder).toBeVisible({ timeout: 30_000 });
    await expectOperationalTouchTarget(openWorkOrder);
    const workOrderCard = openWorkOrder.locator("xpath=ancestor::article[1]");
    const firstWorkOrder = (await workOrderCard.locator("p.font-mono").textContent())?.trim() ?? "";
    expect(firstWorkOrder).not.toBe("");

    const workOrdersUrl = page.url();
    await openWorkOrder.click();
    const executionDialog = page.getByRole("dialog", { name: firstWorkOrder, exact: true });
    await expect(executionDialog).toBeVisible();
    await expect(executionDialog.getByText("Engineer confirmations", { exact: true })).toBeVisible();
    await expect(executionDialog.getByText("Goods movements", { exact: true })).toBeVisible();
    const closeWorkOrder = executionDialog
      .getByRole("button", { name: "Close work order information", exact: true })
      .last();
    await expectOperationalTouchTarget(closeWorkOrder);
    await closeWorkOrder.click();
    await expect(executionDialog).toBeHidden();
    await expect(page).toHaveURL(workOrdersUrl);

    await expect(page.getByPlaceholder(/Ask Vorta about .* work execution/i)).toBeHidden();
    const askVorta = page.locator('[data-vorta-shared-mobile-ai-launcher="true"]');
    await expect(askVorta).toHaveCount(1);
    await expect(askVorta).toBeVisible();
    await expectOperationalTouchTarget(askVorta);
    await askVorta.click();
    await expect(page.getByRole("button", { name: "Close global assistant" })).toBeVisible();
    await expect(page).toHaveURL(workOrdersUrl);

    await expectNoPageOverflow(page);
    return;
  }

  await expect(
    page.getByRole("heading", { name: "Work Execution Briefing", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask Vorta AI", exact: true }),
  ).toBeHidden();

  const firstWorkOrderButton = page.locator("#work-order-register tbody button").first();
  await expect(firstWorkOrderButton).toBeVisible({ timeout: 30_000 });
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
  await expect(executionDialog.getByText("Goods movements", { exact: true })).toBeVisible();

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
