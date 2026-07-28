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

  await expect(workspace.locator(":scope > header")).toBeHidden();
  await expect(
    workspace.getByText("Site and area risk", { exact: true }),
  ).toBeHidden();
  await expect(
    workspace.getByText("Areas are ordered by current inventory exposure.", {
      exact: true,
    }),
  ).toBeHidden();
  await expect(workspace.getByText(/^\d+ materials$/)).toBeHidden();

  const evidenceStatus = workspace.locator(':scope > [role="status"]');
  if ((await evidenceStatus.count()) > 0) {
    await expect(evidenceStatus).toBeVisible();
    const areaTabsBox = await areaTabs.boundingBox();
    const evidenceStatusBox = await evidenceStatus.boundingBox();
    expect(areaTabsBox).not.toBeNull();
    expect(evidenceStatusBox).not.toBeNull();
    expect(evidenceStatusBox!.y).toBeGreaterThan(
      areaTabsBox!.y + areaTabsBox!.height,
    );
  }

  const phoneViewport = (page.viewportSize()?.width ?? 1280) < 640;
  const riskCard = workspace.locator(
    '[data-vorta-inventory-risk-card="true"]',
  );
  const previousWeek = riskCard.locator(
    '[data-vorta-inventory-week-comparison="true"]',
  );
  const riskIcon = riskCard.locator(
    '[data-vorta-inventory-risk-icon="true"]',
  );

  await expect(riskCard).toBeVisible();
  if (phoneViewport) {
    await expect(previousWeek).toBeVisible();
    await expect(riskIcon).toBeHidden();
    await expect(
      previousWeek.getByText("Previous week", { exact: true }),
    ).toBeVisible();
    await expect(previousWeek).toContainText(
      /No prior score|\d+\/100/,
    );
  } else {
    await expect(previousWeek).toBeHidden();
    await expect(riskIcon).toBeVisible();
  }

  const inventoryKpis = workspace.locator(
    '[data-vorta-inventory-kpi="true"]',
  );
  await expect(inventoryKpis).toHaveCount(6);

  if (phoneViewport) {
    for (const label of [
      "Critical stock-outs",
      "Low stock",
      "Long lead 42+ days",
      "Affected assets",
      "On-hand stock value",
      "Excess stock value",
    ]) {
      await expect(
        workspace
          .locator('[data-vorta-inventory-kpi-mobile-label="true"]')
          .filter({ hasText: label }),
      ).toBeVisible();
    }

    const heights: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const card = inventoryKpis.nth(index);
      await expect(card).toBeVisible();
      await expectOperationalTouchTarget(card);
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      heights.push(box!.height);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(Math.max(...heights)).toBeLessThanOrEqual(102);
    await expect(
      workspace.locator('[data-vorta-inventory-kpi-detail="true"]').first(),
    ).toBeHidden();
  } else {
    await expect(
      workspace.locator('[data-vorta-inventory-kpi-detail="true"]').first(),
    ).toBeVisible();
  }

  const excessValueKpi = inventoryKpis.nth(5);
  if ((await excessValueKpi.textContent())?.includes("Not calculated")) {
    await expect(excessValueKpi).toHaveAttribute(
      "aria-label",
      /No calculable excess value/i,
    );
  }

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
