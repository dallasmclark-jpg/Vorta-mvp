import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const EQUIPMENT_FIXTURE_ID = "40000000-0000-0000-0000-000000000007";

const pageCases = [
  ["/equipment", "Equipment", "Equipment"],
  ["/skills-matrix", "Capability", "Capability Summary"],
  ["/engineers", "Engineers", "Engineers"],
  ["/shift-handover", "Shift Handover", "Shift Handover"],
] as const;

test("phone pages use the shared top bar title and remove the duplicate visual heading", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 1366) >= 768, "Phone-only header contract.");
  test.setTimeout(150_000);
  await signInMaintenanceManager(page);

  const topBar = page.locator(
    '[data-vorta-portal-shell="true"] > section > div.md\\:hidden',
  );

  for (const [path, title, duplicateHeading] of pageCases) {
    await page.goto(path);
    await expect(topBar).toHaveAttribute("data-vorta-mobile-header-title", title);
    await expect(topBar).toHaveCSS("min-height", "64px");

    const visualTitle = await topBar.evaluate((element) =>
      window.getComputedStyle(element, "::after").content,
    );
    expect(visualTitle).toBe(`"${title}"`);

    const heading = page.getByRole("heading", {
      name: duplicateHeading,
      exact: true,
      includeHidden: true,
    }).first();
    await expect(heading).toHaveAttribute("data-vorta-mobile-duplicate-page-title", "true");
    await expect(heading).toHaveCSS("position", "absolute");
    await expect(heading).toHaveCSS("width", "1px");
    await expectNoPageOverflow(page);
  }
});

test("equipment detail keeps the asset identity while the top bar says Equipment", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 1366) >= 768, "Phone-only header contract.");
  await signInMaintenanceManager(page);
  await page.goto(`/equipment/${EQUIPMENT_FIXTURE_ID}/overview`);

  const topBar = page.locator(
    '[data-vorta-portal-shell="true"] > section > div.md\\:hidden',
  );
  await expect(topBar).toHaveAttribute("data-vorta-mobile-header-title", "Equipment");

  const assetHeading = page.locator("h1").filter({ hasText: /RABS|FD-|equipment/i }).first();
  await expect(assetHeading).toBeVisible({ timeout: 30_000 });
  await expect(assetHeading).not.toHaveAttribute("data-vorta-mobile-duplicate-page-title", "true");
  await expectNoPageOverflow(page);
});
