import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  expectOperationalTouchTarget,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("Stores Inventory reuses Vorta dashboard and disclosure patterns across supported layouts", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signInMaintenanceManager(page);
  await page.goto("/stores-inventory");

  const workspace = page.locator('[data-vorta-stores-inventory="true"]');
  await expect(workspace).toBeVisible({ timeout: 30_000 });
  await expect(
    workspace.locator("h1").filter({ hasText: "Stores Inventory" }),
  ).toHaveCount(1);

  for (const removedCopy of [
    "Site-wide stock intelligence",
    "Demo inventory evidence",
    "Verified live inventory",
    "Refresh inventory",
  ]) {
    await expect(workspace.getByText(removedCopy, { exact: true })).toHaveCount(0);
  }

  const areaTabs = workspace.getByRole("tablist", {
    name: "Inventory area risk",
  });
  await expect(areaTabs).toBeVisible();
  const allSiteTab = areaTabs.getByRole("tab", { name: /All site/ });
  await expect(allSiteTab).toHaveAttribute("aria-selected", "true");
  await expect(allSiteTab.locator('[data-vorta-risk-dot="true"]')).toBeVisible();
  expect(await areaTabs.getByRole("tab").count()).toBeGreaterThan(1);

  for (const label of [
    "Critical stock-outs",
    "Low stock",
    "Long lead",
    "Affected assets",
  ]) {
    const metric = workspace
      .getByRole("button", { name: new RegExp(label, "i") })
      .first();
    await expect(metric).toBeVisible();
    await expectOperationalTouchTarget(metric);
  }

  const search = workspace.getByRole("searchbox", {
    name: "Search stores inventory",
  });
  await expect(search).toBeVisible();
  await expectOperationalTouchTarget(search);

  const stockFilters = workspace.getByRole("tablist", {
    name: "Inventory stock status",
  });
  await expect(stockFilters).toBeVisible();
  for (const label of [
    "Action required",
    "Out of stock",
    "Low stock",
    "Long lead",
    "Excess",
    "All",
  ]) {
    const filterTab = stockFilters.getByRole("tab", { name: new RegExp(`^${label}`) });
    await expect(filterTab).toBeVisible();
    await expectOperationalTouchTarget(filterTab);
  }

  const firstDisclosure = workspace
    .locator('[data-vorta-inventory-disclosure="true"]')
    .first();
  await expect(firstDisclosure).toBeVisible({ timeout: 30_000 });
  await expect(firstDisclosure).not.toHaveAttribute("open", "");
  const firstSummary = firstDisclosure.locator("summary");
  await expect(firstSummary).toBeVisible();
  await expectOperationalTouchTarget(firstSummary);
  await expect(
    firstDisclosure.getByRole("button", { name: /^Open .+ for .+$/ }),
  ).toBeHidden();
  await expectNoPageOverflow(page);

  const scopedAreaTab = areaTabs.getByRole("tab").nth(1);
  const scopedAreaName = (await scopedAreaTab.textContent())
    ?.replace(/\d+\s*$/, "")
    .trim();
  await scopedAreaTab.click();
  await expect(scopedAreaTab).toHaveAttribute("aria-selected", "true");
  if (scopedAreaName) {
    await expect
      .poll(() => new URL(page.url()).searchParams.get("area"))
      .toBe(scopedAreaName);
  }
  await expectNoPageOverflow(page);

  await allSiteTab.click();
  const outOfStockFilter = stockFilters.getByRole("tab", {
    name: /^Out of stock/,
  });
  await outOfStockFilter.click();
  await expect(page).toHaveURL(/filter=stockout/);
  await expect(outOfStockFilter).toHaveAttribute("aria-selected", "true");

  const filteredDisclosure = workspace
    .locator('[data-vorta-inventory-disclosure="true"]')
    .first();
  await expect(filteredDisclosure).toBeVisible();
  await filteredDisclosure.locator("summary").click();
  await expect(filteredDisclosure).toHaveAttribute("open", "");

  const openSpares = filteredDisclosure.getByRole("button", {
    name: /^Open .+ for .+$/,
  });
  await expect(openSpares).toBeVisible();
  await expectOperationalTouchTarget(openSpares);
  await openSpares.click();
  await page.waitForURL(
    /\/equipment\/[^/]+\/spares\?[^#]*record=[^&]+[^#]*from=stores-inventory/,
  );
  await expectNoPageOverflow(page);
});
