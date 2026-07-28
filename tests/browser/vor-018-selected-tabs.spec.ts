import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const EQUIPMENT_ID = "40000000-0000-0000-0000-000000000007";

async function expectOutlinedSelectedTab(
  page: Page,
  tab: Locator,
  theme: "dark" | "light",
): Promise<void> {
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await expect(tab).toHaveAttribute("aria-selected", "true");

  if (theme === "dark") {
    await expect(tab).toHaveCSS("background-color", "rgb(13, 17, 23)");
    await expect(tab).toHaveCSS("border-top-color", "rgb(96, 165, 250)");
    await expect(tab).toHaveCSS("color", "rgb(219, 234, 254)");
  } else {
    await expect(tab).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(tab).toHaveCSS("border-top-color", "rgb(37, 99, 235)");
    await expect(tab).toHaveCSS("color", "rgb(29, 78, 216)");
  }

  await expect(tab).toHaveCSS("border-top-width", "1px");
  await expect(tab).toHaveCSS("border-right-width", "1px");
  await expect(tab).toHaveCSS("border-bottom-width", "1px");
  await expect(tab).toHaveCSS("border-left-width", "1px");
  await expect(tab).toHaveCSS("box-shadow", "none");

  await tab.focus();
  await expect(tab).toHaveCSS("outline-style", "solid");
  await expect(tab).toHaveCSS("outline-width", "2px");
  await expectNoPageOverflow(page);
}

test("selected tabs use one outlined state across Stores Inventory and Equipment", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signInMaintenanceManager(page);

  await page.goto("/stores-inventory");
  const inventoryTab = page.getByRole("tab", { name: /^All site\b/i });
  await expectOutlinedSelectedTab(page, inventoryTab, "dark");

  const inactiveInventoryTab = page.locator('[role="tab"][aria-selected="false"]').first();
  await expect(inactiveInventoryTab).toBeVisible();
  await expect(inactiveInventoryTab).not.toHaveCSS(
    "border-top-color",
    "rgb(96, 165, 250)",
  );

  await page.goto(`/equipment/${EQUIPMENT_ID}/overview`);
  const equipmentTab = page.getByRole("tab", { name: "Overview", exact: true });
  await expectOutlinedSelectedTab(page, equipmentTab, "dark");
});

test("selected tabs retain the same outlined treatment in light mode", async ({ page }) => {
  test.skip(test.info().project.name !== "phone-360", "Run the light-theme state once.");
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    window.localStorage.setItem("vorta:appearance", "light");
  });
  await signInMaintenanceManager(page);

  await page.goto("/stores-inventory");
  await expect(page.locator("html")).toHaveClass(/light/);
  const selectedTab = page.getByRole("tab", { name: /^All site\b/i });
  await expectOutlinedSelectedTab(page, selectedTab, "light");
});
