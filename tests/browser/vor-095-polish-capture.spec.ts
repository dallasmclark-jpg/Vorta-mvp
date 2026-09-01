import { expect, test } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const captures = [
  ["desktop-1536x864", 1536, 864],
  ["phone-360x800", 360, 800],
  ["samsung-tablet-portrait-1024x1536", 1024, 1536],
  ["samsung-tablet-landscape-1536x959", 1536, 959],
] as const;

test("capture VOR-095 polished deploy preview across approved layouts", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await signInMaintenanceManager(page);

  for (const [name, width, height] of captures) {
    await page.setViewportSize({ width, height });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    await page.evaluate(() => document.fonts.ready);

    const riskLabel = page.locator("[data-vorta-risk-intelligence-label]");
    if (width >= 640) {
      await expect(riskLabel).toBeVisible();
      await expect(riskLabel).toHaveCSS("color", "rgb(96, 165, 250)");
    }

    await page.screenshot({
      path: `evidence/vor-095-${name}.png`,
      fullPage: false,
    });
  }
});
