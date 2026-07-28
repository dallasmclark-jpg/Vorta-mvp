import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  expectOperationalTouchTarget,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("Stores Inventory loads trusted site evidence across supported layouts", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signInMaintenanceManager(page);
  await page.goto("/stores-inventory");

  const workspace = page.locator('[data-vorta-stores-inventory="true"]');
  await expect(workspace).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Stores Inventory", exact: true }),
  ).toBeVisible();
  await expect(
    workspace.getByText(
      /Verified live inventory|Stale inventory evidence|Partial live evidence|Demo inventory evidence/,
    ),
  ).toBeVisible();

  const areaTabs = workspace.getByRole("tablist", {
    name: "Inventory area risk",
  });
  await expect(areaTabs).toBeVisible();
  const allSiteTab = areaTabs.getByRole("tab", { name: /All site/ });
  await expect(allSiteTab).toHaveAttribute("aria-selected", "true");
  expect(await areaTabs.getByRole("tab").count()).toBeGreaterThan(1);

  for (const label of [
    "Critical stock-outs",
    "Below minimum",
    "Long-lead shortages",
    "Affected assets",
  ]) {
    const metric = workspace.getByRole("button", { name: new RegExp(label, "i") });
    await expect(metric).toBeVisible();
    await expectOperationalTouchTarget(metric);
  }

  const search = workspace.getByRole("searchbox", {
    name: "Search stores inventory",
  });
  const filter = workspace.getByRole("combobox", {
    name: "Filter stores inventory",
  });
  await expect(search).toBeVisible();
  await expect(filter).toBeVisible();
  await expectOperationalTouchTarget(search);
  await expectOperationalTouchTarget(filter);

  const firstItem = workspace.getByRole("button", { name: /^Open .+ for .+$/ }).first();
  await expect(firstItem).toBeVisible({ timeout: 30_000 });
  await expectOperationalTouchTarget(firstItem);
  await expectNoPageOverflow(page);

  const scopedAreaTab = areaTabs.getByRole("tab").nth(1);
  const scopedAreaName = (await scopedAreaTab.textContent())?.split("Risk")[0]?.trim();
  await scopedAreaTab.click();
  await expect(scopedAreaTab).toHaveAttribute("aria-selected", "true");
  if (scopedAreaName) {
    await expect
      .poll(() => new URL(page.url()).searchParams.get("area"))
      .toBe(scopedAreaName);
  }
  await expectNoPageOverflow(page);

  await allSiteTab.click();
  await filter.selectOption("stockout");
  await expect(page).toHaveURL(/filter=stockout/);
  await expect(
    workspace.getByRole("button", { name: /^Open .+ for .+$/ }).first(),
  ).toBeVisible();

  await workspace
    .getByRole("button", { name: /^Open .+ for .+$/ })
    .first()
    .click();
  await page.waitForURL(
    /\/equipment\/[^/]+\/spares\?[^#]*record=[^&]+[^#]*from=stores-inventory/,
  );
  await expectNoPageOverflow(page);
});
