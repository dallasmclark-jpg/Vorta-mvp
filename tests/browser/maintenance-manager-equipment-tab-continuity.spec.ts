import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("Equipment tab changes preserve vertical position and one mobile hero", async ({
  page,
}) => {
  test.skip(test.info().project.name !== "phone-360", "Run equipment phone continuity once.");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 700, height: 900 });
  await signInMaintenanceManager(page);

  await page.goto("/equipment");
  const equipmentButton = page
    .locator('[data-vorta-mobile-equipment="true"] button')
    .filter({ hasText: "Open" })
    .first();
  await expect(equipmentButton).toBeVisible({ timeout: 30_000 });
  await equipmentButton.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);

  const sharedHero = page.locator(
    '[data-vorta-equipment-shared-mobile-hero="true"]',
  );
  await expect(sharedHero).toHaveCount(1);
  await expect(sharedHero).toBeVisible();
  await expect(
    page.locator(
      '[data-vorta-equipment-mobile-route-content="true"] [data-vorta-equipment-mobile-tabs="true"]',
    ),
  ).toHaveCount(0);

  const equipmentName = (await sharedHero.locator("h1").textContent())?.trim();
  expect(equipmentName).toBeTruthy();

  await page.evaluate(() => {
    const maximum = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    window.scrollTo(0, Math.min(320, maximum));
  });
  const scrollPositionBeforeTabChange = await page.evaluate(() => window.scrollY);
  expect(scrollPositionBeforeTabChange).toBeGreaterThan(0);

  await sharedHero
    .getByRole("tab", { name: "Work Orders", exact: true })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForURL(/\/equipment\/[^/]+\/work-orders(?:\?.*)?$/);
  await expect(sharedHero).toBeVisible();
  await expect(sharedHero.locator("h1")).toHaveText(equipmentName ?? "");
  await page.waitForTimeout(220);

  const workOrderScrollPosition = await page.evaluate(() => window.scrollY);
  expect(
    Math.abs(workOrderScrollPosition - scrollPositionBeforeTabChange),
  ).toBeLessThanOrEqual(4);

  await sharedHero
    .getByRole("tab", { name: "Calibrations", exact: true })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForURL(/\/equipment\/[^/]+\/pms(?:\?.*)?$/);
  await expect(sharedHero).toBeVisible();
  await expect(sharedHero.locator("h1")).toHaveText(equipmentName ?? "");
  await page.waitForTimeout(220);

  const calibrationScrollPosition = await page.evaluate(() => window.scrollY);
  expect(
    Math.abs(calibrationScrollPosition - workOrderScrollPosition),
  ).toBeLessThanOrEqual(4);
  await expectNoPageOverflow(page);
});
