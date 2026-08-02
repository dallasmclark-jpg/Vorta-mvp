import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  expectOperationalTouchTarget,
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
    await expect(page.locator('[data-vorta-fault-panel="true"]')).toHaveCount(0);
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
  const coverQuestion = "What are the shift cover issues today?";
  await askInput.fill(coverQuestion);
  const askButton = page.getByRole("button", { name: "Ask Vorta", exact: true });
  await expectOperationalTouchTarget(askButton);
  await askButton.click();

  const unifiedAssistant = page.locator('[data-vorta-global-ai-panel="true"]');
  await expect(unifiedAssistant).toBeVisible();
  await expect(page.locator('[data-vorta-fault-panel="true"]')).toHaveCount(0);
  await expect(unifiedAssistant.getByText(coverQuestion)).toBeVisible();

  const loadingMessage = unifiedAssistant.getByText(
    "Choosing and checking the relevant Vorta sources...",
    { exact: true },
  );
  await expect(loadingMessage).toBeHidden({ timeout: 60_000 });

  const latestAssistantMessage = unifiedAssistant
    .locator('[data-vorta-global-ai-messages="true"] > div.justify-start')
    .last();
  await expect(latestAssistantMessage).toBeVisible();
  await expect(latestAssistantMessage).not.toContainText(
    "Vorta could not complete this analysis",
  );
  await expect(latestAssistantMessage).toContainText(/cover|shift/i);
  await expect(latestAssistantMessage).not.toContainText("Recent matching history");
  await expect(latestAssistantMessage).not.toContainText("Equipment SME");
  await expect(latestAssistantMessage).not.toContainText("Corresponding documentation");

  await expect(page).toHaveURL(workOrdersUrl);
  await expectNoPageOverflow(page);
});
