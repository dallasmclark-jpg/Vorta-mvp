import { expect, test, type Page } from "@playwright/test";
import {
  maintenanceManagerEmail,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const CEREAL_SITE_ID =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000004";
const CEREAL_EMAIL = "cereal@vorta.network";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "Cereal production page must fit the active viewport").toBeLessThanOrEqual(2);
}

function isEquipmentApi(url: string): boolean {
  return url.includes("/rest/v1/equipment_assets?");
}

test.beforeEach(() => {
  expect(
    maintenanceManagerEmail.toLowerCase(),
    "VOR-093 acceptance must use the cereal demo account",
  ).toBe(CEREAL_EMAIL);
  expect(CEREAL_SITE_ID).toBe("11000000-0000-0000-0000-000000000004");
});

test("VOR-093 cereal equipment exposes real, loading and empty states", async ({ page }) => {
  await signInMaintenanceManager(page);

  let delayed = false;
  await page.route("**/rest/v1/equipment_assets?*", async (route) => {
    if (!delayed && isEquipmentApi(route.request().url())) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    }
    await route.continue();
  });

  const navigation = page.goto("/equipment");
  await expect(
    page.getByText("Loading active-site equipment risk records…", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
  await navigation;

  const list = page.locator('[data-vorta-live-equipment-list="true"]');
  await expect(list).toBeVisible({ timeout: 30_000 });
  await expect(list).toHaveAttribute("data-vorta-active-site", CEREAL_SITE_ID);
  await expect(list.locator("article")).toHaveCount(35, { timeout: 30_000 });
  await expect(page.getByText("BE-201", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/sterile|fill-finish|autoclave|purification/i)).toHaveCount(0);

  const search = page.getByPlaceholder("Search equipment");
  await search.fill("__VORTA_NO_CEREAL_MATCH__");
  await expect(page.getByText("No matching verified equipment", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("VOR-093 cereal equipment error state recovers without placeholder data", async ({ page }) => {
  await signInMaintenanceManager(page);

  let failedOnce = false;
  await page.route("**/rest/v1/equipment_assets?*", async (route) => {
    if (!failedOnce && isEquipmentApi(route.request().url())) {
      failedOnce = true;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "VOR093_TEST_NETWORK_FAILURE",
          message: "Controlled VOR-093 production acceptance network failure",
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/equipment");
  await expect(page.getByRole("heading", { name: "Equipment data unavailable", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText(
      "No demonstration record, generated score or optimistic percentage has been substituted.",
      { exact: true },
    ),
  ).toBeVisible();

  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const list = page.locator('[data-vorta-live-equipment-list="true"]');
  await expect(list).toBeVisible({ timeout: 30_000 });
  await expect(list).toHaveAttribute("data-vorta-active-site", CEREAL_SITE_ID);
  await expect(list.locator("article")).toHaveCount(35, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Equipment data unavailable", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
