import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const mobileRoutes = [
  ["/dashboard", "Dashboard"],
  ["/equipment", "Equipment"],
  ["/skills-matrix", "Skills Matrix"],
  ["/engineers", "Engineers"],
  ["/requirements", "Requirements"],
  ["/training", "Training"],
  ["/training-providers", "Training Providers"],
  ["/ai-matching", "Capability Matching"],
  ["/career", "Workforce Development"],
  ["/pilot-impact", "Pilot Evidence"],
  ["/pilot-adoption", "Pilot Evidence"],
  ["/support", "Support"],
  ["/settings", "Settings"],
] as const;

test("Maintenance Manager mobile routes retain one shell and one Ask Vorta entry", async ({
  page,
}) => {
  test.setTimeout(210_000);
  const viewportWidth = page.viewportSize()?.width ?? 1366;
  test.skip(viewportWidth >= 640, "Phone-only route matrix.");

  await signInMaintenanceManager(page);

  const mobileTopBar = page.locator(
    '[data-vorta-portal-shell="true"] > section > div.md\\:hidden',
  );
  const mobileLogo = mobileTopBar.locator(":scope > :not(button)").first();
  const mobileMenu = mobileTopBar.getByRole("button", { name: "Open menu" });
  const sharedLauncher = page.locator(
    '[data-vorta-shared-mobile-ai-launcher="true"]',
  );

  for (const [path, label] of mobileRoutes) {
    await page.goto(path);
    await expect(mobileTopBar).toHaveAttribute("data-vorta-mobile-page-title", label);
    await expect(mobileTopBar).toHaveCSS("display", "grid");
    await expect(mobileLogo).toBeVisible();
    await expect(mobileMenu).toBeVisible();

    const logoBox = await mobileLogo.boundingBox();
    const menuBox = await mobileMenu.boundingBox();
    expect(logoBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(logoBox?.x ?? 9999).toBeLessThan(menuBox?.x ?? 0);

    await expect(sharedLauncher).toHaveCount(1);
    await expect(sharedLauncher).toBeVisible();
    await expect(sharedLauncher).toHaveAccessibleName("Ask Vorta");
    await expectNoPageOverflow(page);
  }

  await page.goto("/equipment");
  const equipmentButton = page
    .locator('[data-vorta-mobile-equipment="true"] button')
    .filter({ hasText: "Open" })
    .first();
  await expect(equipmentButton).toBeVisible({ timeout: 30_000 });
  await equipmentButton.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);

  await expect(page.locator('[data-vorta-equipment-mobile-actions="true"]')).toHaveCount(0);
  await expect(sharedLauncher).toHaveCount(1);
  const finalAction = page.getByRole("button", { name: /View work and actions/ });
  await expect(finalAction).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-vorta-mobile-ai-safe-area="true"]').scrollIntoViewIfNeeded();

  const finalActionBox = await finalAction.boundingBox();
  const launcherBox = await sharedLauncher.boundingBox();
  expect(finalActionBox).not.toBeNull();
  expect(launcherBox).not.toBeNull();
  expect(finalActionBox?.y ?? 9999).toBeLessThan(launcherBox?.y ?? 0);

  const calibrationTab = page.getByRole("tab", { name: "Calibrations", exact: true });
  await calibrationTab.click();
  await page.waitForURL(/\/equipment\/[^/]+\/pms(?:\?.*)?$/);
  await expect(page.locator('input[placeholder*="calibration risk"]')).toBeHidden();
  await expect(sharedLauncher).toHaveCount(1);
  await expectNoPageOverflow(page);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
  for (const label of ["Light", "Dark", "System"]) {
    const appearanceOption = page.getByRole("button", { name: new RegExp(`^${label}`) });
    await expect(appearanceOption).toBeVisible();
    const box = await appearanceOption.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await page.goto("/pilot-impact");
  await expect(page.getByRole("navigation", { name: "Pilot evidence views" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Impact/ })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: /Adoption/ }).click();
  await page.waitForURL(/\/pilot-adoption$/);
  await expect(page.getByRole("link", { name: /Adoption/ })).toHaveAttribute("aria-current", "page");
});
