import { expect, test } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

test("Maintenance Manager navigation supports keyboard focus and selected-state semantics", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "laptop-1366",
    "The keyboard contract runs once at the supported laptop breakpoint.",
  );

  await signInMaintenanceManager(page);
  await page.goto("/equipment");

  const openEquipment = page
    .getByRole("button", { name: /View full asset intelligence/i })
    .first();
  await expect(openEquipment).toBeVisible();
  await openEquipment.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview$/);

  const primaryNavigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(primaryNavigation.locator('[aria-current="page"]')).toHaveCount(1);

  const equipmentTabs = page.getByRole("tablist", {
    name: "Equipment sections",
  });
  await expect(equipmentTabs).toBeVisible();

  const tabs = equipmentTabs.getByRole("tab");
  await expect(tabs).toHaveCount(9);

  const overview = equipmentTabs.getByRole("tab", {
    name: "Overview",
    exact: true,
  });
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(overview).toHaveAttribute("tabindex", "0");

  await overview.focus();
  await overview.press("End");
  await expect(tabs.last()).toBeFocused();

  await tabs.last().press("Home");
  await expect(overview).toBeFocused();

  await overview.press("ArrowRight");
  const notifications = equipmentTabs.getByRole("tab", {
    name: "Notifications",
    exact: true,
  });
  await expect(notifications).toBeFocused();
  await expect(notifications).toHaveAttribute("tabindex", "-1");

  await notifications.press("Enter");
  await page.waitForURL(/\/equipment\/[^/]+\/notifications$/);
  await expect(notifications).toHaveAttribute("aria-selected", "true");
  await expect(notifications).toHaveAttribute("tabindex", "0");
  await expect(notifications).toBeFocused();

  const focusedOutline = await notifications.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: style.outlineWidth,
    };
  });
  expect(focusedOutline.style).not.toBe("none");
  expect(focusedOutline.width).not.toBe("0px");

  await page.goto("/maintenance/labour-risk/shift-cover");
  await expect(
    page.getByRole("heading", { name: "Shift Cover Risk", exact: true }),
  ).toBeVisible();

  const visibleRota = page.locator('[data-vorta-desktop-rota="true"]');
  await expect(visibleRota).toBeVisible();
  const shiftButtons = visibleRota.locator('button[aria-pressed]');
  await expect(shiftButtons.first()).toBeVisible();
  await expect(visibleRota.locator('button[aria-pressed="true"]')).toHaveCount(1);

  if ((await shiftButtons.count()) > 1) {
    await shiftButtons.nth(1).click();
    await expect(visibleRota.locator('button[aria-pressed="true"]')).toHaveCount(1);
  }
});
