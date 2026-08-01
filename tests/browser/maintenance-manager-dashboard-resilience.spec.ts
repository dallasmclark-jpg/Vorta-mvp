import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("a failed dashboard refresh preserves the previous snapshot and disables projected actions", async ({ page }) => {
  await signInMaintenanceManager(page);
  const originalViewport = page.viewportSize() ?? { width: 1366, height: 768 };
  const isPhone = originalViewport.width < 640;
  const heading = isPhone
    ? page.locator('[data-vorta-mobile-risk-scope="true"]').getByText("Today's Risk", { exact: true })
    : page.getByRole("heading", { name: "Site Risk Briefing", exact: true });
  await expect(heading).toBeVisible();

  await page.route(/\/rest\/v1\/rpc\/vorta_refresh_and_get_operational_dashboard/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "simulated operational refresh failure" }),
    });
  });

  const refresh = page.getByRole("button", {
    name: "Refresh risk intelligence",
    exact: true,
  });
  const stale = page.locator('[data-vorta-dashboard-evidence-state="stale"]');

  if (isPhone) {
    // Mobile deliberately omits the manual refresh control. Trigger the same application
    // workflow through the rendered desktop control, then return to the phone layout to
    // verify that stale evidence remains honest and projected actions stay disabled.
    await expect(refresh).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: Math.max(800, originalViewport.height) });
    await expect(refresh).toBeVisible();
    await refresh.click();
    await expect(stale).toBeVisible();
    await page.setViewportSize(originalViewport);
    await expect(heading).toBeVisible();
  } else {
    await refresh.click();
  }

  await expect(stale).toContainText(/last successful snapshot/i);
  await expect(stale).toContainText(/projected actions are disabled/i);
  const workPlan = page.getByRole("button", { name: "View work plan", exact: true });
  await expect(workPlan).toBeDisabled();
  await expect(workPlan).toHaveAttribute("title", /disabled until the operational snapshot/i);
});

test("calculated Spares Risk matches Stores Inventory across phone, tablet and desktop", async ({ page }) => {
  test.setTimeout(300_000);
  await signInMaintenanceManager(page);

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 800, height: 1280 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    await test.step(`${viewport.width}x${viewport.height}`, async () => {
      await page.setViewportSize(viewport);
      await page.goto("/dashboard");

      const heading = page.getByRole("heading", { name: /Spares & Labour Risks$/ });
      await expect(heading).toBeVisible({ timeout: 60_000 });

      const opportunity = page.locator('[data-vorta-biggest-reduction-opportunity="true"]');
      if (!(await opportunity.isVisible())) {
        const openPlan = page.getByRole("button", {
          name: "View work plan",
          exact: true,
          includeHidden: true,
        });
        if (await openPlan.isVisible()) await openPlan.click();
        else await openPlan.evaluate((button: HTMLButtonElement) => button.click());
      }
      await expect(opportunity).toContainText(/−\d+(?:\.\d+)? points/, { timeout: 60_000 });

      const rail = page.locator('[data-vorta-card-rail="labour-risk"]');
      const labour = rail.locator('[data-vorta-labour-risk-card]:not([data-vorta-spares-risk-card])').first();
      const spares = rail.locator('[data-vorta-spares-risk-card="true"]');
      await expect(labour).toBeVisible({ timeout: 60_000 });
      await expect(spares).toBeVisible({ timeout: 60_000 });
      expect(await spares.evaluate((element) => element.parentElement?.dataset.vortaCardRail)).toBe("labour-risk");

      const scoreMetric = spares.locator('[data-vorta-primary-metric="true"]');
      await expect(scoreMetric).toContainText("Overall risk score");
      const scoreValue = scoreMetric.locator("p").nth(1);
      await expect(scoreValue).toHaveText(/\d+\.\d/, { timeout: 60_000 });
      const dashboardScore = Number.parseFloat((await scoreValue.textContent()) ?? "");
      expect(Number.isFinite(dashboardScore)).toBe(true);

      const affected = spares.getByText("Affected assets", { exact: true }).locator("..");
      const actionable = spares.getByText("Action-required parts", { exact: true }).locator("..");
      await expect(affected.locator("span").last()).toHaveText(/\d+/);
      await expect(actionable.locator("span").last()).toHaveText(/\d+/);
      await expect(spares.getByText("Potential site-risk reduction", { exact: true })).toHaveCount(0);
      await expect(spares.getByText(/^Part\s/)).toHaveCount(0);

      const labourBox = await labour.boundingBox();
      const sparesBox = await spares.boundingBox();
      expect(labourBox).not.toBeNull();
      expect(sparesBox).not.toBeNull();
      expect(Math.abs((sparesBox?.width ?? 0) - (labourBox?.width ?? 0))).toBeLessThanOrEqual(2);
      if (viewport.width < 640) {
        expect(Math.abs((sparesBox?.height ?? 0) - (labourBox?.height ?? 0))).toBeLessThanOrEqual(24);
        await expect(spares.getByText("Open inventory →", { exact: true })).toBeVisible();
      }
      expect(await spares.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expectNoPageOverflow(page);

      await spares.scrollIntoViewIfNeeded();
      const scroller = page.locator('[data-vorta-portal-scroll-container="true"]');
      const usesScroller = (await scroller.count()) > 0;
      const scrollBefore = usesScroller
        ? await scroller.evaluate((element) => element.scrollTop)
        : await page.evaluate(() => window.scrollY);
      expect(scrollBefore).toBeGreaterThan(0);

      await spares.click();
      await page.waitForURL(/\/stores-inventory(?:\?|$)/);
      const url = new URL(page.url());
      expect(url.searchParams.get("from")).toBe("dashboard");
      expect(url.searchParams.get("filter")).toBe("attention");

      const inventory = page.locator('[data-vorta-inventory-risk-card="true"]');
      await expect(inventory).toBeVisible({ timeout: 60_000 });
      const inventoryScore = (await inventory.textContent())?.match(/(\d+)\s*\/100/);
      expect(Number(inventoryScore?.[1])).toBe(Math.round(dashboardScore));

      await page.goBack();
      await expect(spares).toBeVisible({ timeout: 60_000 });
      await expect.poll(async () =>
        usesScroller
          ? scroller.evaluate((element) => element.scrollTop)
          : page.evaluate(() => window.scrollY),
      ).toBeGreaterThanOrEqual(Math.max(1, scrollBefore - 2));
      await expectNoPageOverflow(page);
    });
  }
});
