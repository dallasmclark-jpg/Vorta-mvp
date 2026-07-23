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

  const isMobileEquipmentNavigation = (page.viewportSize()?.width ?? 1024) < 640;

  if (isMobileEquipmentNavigation) {
    const mobileEquipmentSections = page.getByRole("combobox", {
      name: "Equipment section",
    });
    await expect(mobileEquipmentSections).toBeVisible();
    await expectOperationalTouchTarget(mobileEquipmentSections);
    await mobileEquipmentSections.selectOption("work-orders");
  } else {
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
  }

  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/work-orders(?:\\?.*)?$`));
  await expect(
    page.getByRole("heading", {
      name: /Work Execution Briefing|Complete equipment work history/,
    }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
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
