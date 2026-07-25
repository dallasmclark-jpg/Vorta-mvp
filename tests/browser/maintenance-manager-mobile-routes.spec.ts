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

test("Maintenance Manager mobile routes retain context and avoid page overflow", async ({
  page,
}) => {
  const viewportWidth = page.viewportSize()?.width ?? 1366;
  test.skip(viewportWidth >= 640, "Phone-only route matrix.");

  await signInMaintenanceManager(page);

  const mobileTopBar = page.locator(
    '[data-vorta-portal-shell="true"] > section > div.md\\:hidden',
  );

  for (const [path, label] of mobileRoutes) {
    await page.goto(path);
    await expect(mobileTopBar).toHaveAttribute("data-vorta-mobile-page-title", label);
    await expectNoPageOverflow(page);
  }

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
