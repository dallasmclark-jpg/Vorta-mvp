import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const summaryLabels = ["On shift", "Available", "Critical SME", "At risk"] as const;

test("Mobile Engineers summary tabs prioritise matching engineers without hiding the register", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const viewportWidth = page.viewportSize()?.width ?? 1366;
  test.skip(viewportWidth >= 640, "Phone-only Engineers summary workflow.");

  await signInMaintenanceManager(page);
  await page.goto("/engineers");

  const engineersPage = page.locator('[data-vorta-mobile-engineers="true"]');
  const summaryTabs = engineersPage.locator(
    '[data-vorta-engineer-summary-tabs="true"]',
  );
  const register = engineersPage.locator('[data-vorta-engineer-register="true"]');

  await expect(summaryTabs).toBeVisible({ timeout: 30_000 });
  await expect(register).toBeVisible();

  const registerCards = register.locator(
    '[data-vorta-engineer-card-context="register"]',
  );
  const initialRegisterCount = await registerCards.count();
  expect(initialRegisterCount).toBeGreaterThan(0);

  let populatedTab: (typeof summaryLabels)[number] | null = null;
  for (const label of summaryLabels) {
    const tab = summaryTabs.getByRole("tab", { name: label, exact: true });
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute("aria-selected", "false");
    const box = await tab.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    const count = Number(
      await tab.getAttribute("data-vorta-engineer-summary-count"),
    );
    expect(Number.isFinite(count)).toBe(true);
    if (count > 0 && populatedTab === null) populatedTab = label;
  }

  expect(populatedTab).not.toBeNull();
  const selectedTab = summaryTabs.getByRole("tab", {
    name: populatedTab ?? "On shift",
    exact: true,
  });
  const expectedCount = Number(
    await selectedTab.getAttribute("data-vorta-engineer-summary-count"),
  );

  await selectedTab.click();
  await expect(selectedTab).toHaveAttribute("aria-selected", "true");

  const priorityPanel = engineersPage.locator(
    '[data-vorta-engineer-priority-panel]',
  );
  await expect(priorityPanel).toBeVisible();
  await expect(priorityPanel).toHaveAttribute(
    "data-vorta-engineer-priority-count",
    String(expectedCount),
  );
  await expect(
    priorityPanel.locator('[data-vorta-engineer-card-context="priority"]'),
  ).toHaveCount(expectedCount);
  await expect(registerCards).toHaveCount(initialRegisterCount);

  await selectedTab.click();
  await expect(selectedTab).toHaveAttribute("aria-selected", "false");
  await expect(priorityPanel).toHaveCount(0);

  const availableTab = summaryTabs.getByRole("tab", {
    name: "Available",
    exact: true,
  });
  await availableTab.click();
  await expect(availableTab).toHaveAttribute("aria-selected", "true");
  await expect(priorityPanel).toBeVisible();

  const clearButton = priorityPanel.getByRole("button", {
    name: "All engineers",
    exact: true,
  });
  await expect(clearButton).toBeVisible();
  const clearBox = await clearButton.boundingBox();
  expect(clearBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await clearButton.click();
  await expect(priorityPanel).toHaveCount(0);
  await expect(registerCards).toHaveCount(initialRegisterCount);

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 860 });
    await expectNoPageOverflow(page);
  }

  await page.reload();
  await expect(summaryTabs).toBeVisible({ timeout: 30_000 });
  await expect(registerCards.first()).toBeVisible();
});
