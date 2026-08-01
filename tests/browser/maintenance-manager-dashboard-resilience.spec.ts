import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("a failed dashboard refresh preserves the previous snapshot and disables projected actions", async ({
  page,
}) => {
  await signInMaintenanceManager(page);

  const isPhone = (page.viewportSize()?.width ?? 1366) < 640;
  const riskBriefingLabel = isPhone
    ? page
        .locator('[data-vorta-mobile-risk-scope="true"]')
        .getByText("Today's Risk", { exact: true })
    : page.getByRole("heading", {
        name: "Site Risk Briefing",
        exact: true,
      });
  await expect(riskBriefingLabel).toBeVisible();

  await page.route(
    /\/rest\/v1\/rpc\/vorta_refresh_and_get_operational_dashboard/,
    async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "simulated operational refresh failure" }),
      });
    },
  );

  const refreshRiskButton = page.getByRole("button", {
    name: "Refresh risk intelligence",
    exact: true,
    includeHidden: true,
  });
  if (isPhone) {
    await expect(refreshRiskButton).toBeHidden();
    await refreshRiskButton.evaluate((button: HTMLButtonElement) => button.click());
  } else {
    await refreshRiskButton.click();
  }

  const staleNotice = page.locator(
    '[data-vorta-dashboard-evidence-state="stale"]',
  );
  await expect(staleNotice).toBeVisible();
  await expect(staleNotice).toContainText(/last successful snapshot/i);
  await expect(staleNotice).toContainText(/projected actions are disabled/i);
  await expect(riskBriefingLabel).toBeVisible();

  const workPlanButton = page.getByRole("button", {
    name: "View work plan",
    exact: true,
  });
  await expect(workPlanButton).toBeDisabled();
  await expect(workPlanButton).toHaveAttribute(
    "title",
    /disabled until the operational snapshot and work plan are verified/i,
  );
});

test("calculated Spares Risk matches Stores Inventory across phone, tablet and desktop", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signInMaintenanceManager(page);

  const viewports = [
    { name: "phone", width: 360, height: 800 },
    { name: "tablet portrait", width: 800, height: 1280 },
    { name: "tablet landscape", width: 1280, height: 800 },
    { name: "desktop", width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/dashboard");

      const combinedHeading = page.getByRole("heading", {
        name: /Spares & Labour Risks$/,
      });
      await expect(combinedHeading).toBeVisible({ timeout: 60_000 });

      const opportunity = page.locator(
        '[data-vorta-biggest-reduction-opportunity="true"]',
      );
      if (!(await opportunity.isVisible())) {
        const viewWorkPlan = page.getByRole("button", {
          name: "View work plan",
          exact: true,
          includeHidden: true,
        });
        await expect(viewWorkPlan).toHaveCount(1);
        if (await viewWorkPlan.isVisible()) {
          await viewWorkPlan.click();
        } else {
          await viewWorkPlan.evaluate((button: HTMLButtonElement) => button.click());
        }
      }

      await expect(opportunity).toBeVisible({ timeout: 60_000 });
      await expect(opportunity).toContainText("Biggest reduction opportunity");
      await expect(opportunity).toContainText(/Site-risk reduction/i);
      await expect(opportunity).toContainText(/−\d+(?:\.\d+)? points/);

      const rail = page.locator('[data-vorta-card-rail="labour-risk"]');
      const labourCard = rail
        .locator(
          '[data-vorta-labour-risk-card]:not([data-vorta-spares-risk-card])',
        )
        .first();
      const spareCard = rail.locator(
        '[data-vorta-spares-risk-card="true"]',
      );

      await expect(rail).toBeVisible({ timeout: 60_000 });
      await expect(labourCard).toBeVisible({ timeout: 60_000 });
      await expect(spareCard).toBeVisible({ timeout: 60_000 });
      expect(
        await spareCard.evaluate(
          (element) => element.parentElement?.dataset.vortaCardRail,
        ),
      ).toBe("labour-risk");

      await expect(spareCard).toContainText("Spares Risk");
      const scoreMetric = spareCard.locator(
        '[data-vorta-primary-metric="true"]',
      );
      await expect(scoreMetric).toContainText("Overall risk score");
      const scoreValue = scoreMetric.locator("p").nth(1);
      await expect(scoreValue).toHaveText(/\d+\.\d/, {
        timeout: 60_000,
      });
      const dashboardScoreText = await scoreValue.textContent();
      const dashboardScore = Number.parseFloat(dashboardScoreText ?? "");
      expect(Number.isFinite(dashboardScore)).toBe(true);

      await expect(spareCard).toContainText(/Affected assets\s+\d+/);
      await expect(spareCard).toContainText(/Action-required parts\s+\d+/);
      await expect(
        spareCard.getByText("Potential site-risk reduction", { exact: true }),
      ).toHaveCount(0);
      await expect(spareCard.getByText(/^Part\s/)).toHaveCount(0);
      await expect(spareCard.getByText("View spare →", { exact: true })).toHaveCount(0);

      const mobileAction = spareCard.getByText("Open inventory →", {
        exact: true,
      });
      if (viewport.width < 640) {
        await expect(mobileAction).toBeVisible();
      }

      const labourSize = await labourCard.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      }));
      const spareSize = await spareCard.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
      }));
      expect(Math.abs(spareSize.width - labourSize.width)).toBeLessThanOrEqual(2);
      if (viewport.width < 640) {
        expect(Math.abs(spareSize.height - labourSize.height)).toBeLessThanOrEqual(24);
      }

      await spareCard.scrollIntoViewIfNeeded();
      const cardBounds = await spareCard.boundingBox();
      expect(cardBounds).not.toBeNull();
      expect(cardBounds?.x ?? -1).toBeGreaterThanOrEqual(-1);
      expect((cardBounds?.x ?? 0) + (cardBounds?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width + 1,
      );
      expect(cardBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(
        await spareCard.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await expectNoPageOverflow(page);

      const portalScroller = page.locator(
        '[data-vorta-portal-scroll-container="true"]',
      );
      const usesPortalScroller = (await portalScroller.count()) > 0;
      const scrollBefore = usesPortalScroller
        ? await portalScroller.evaluate((element) => element.scrollTop)
        : await page.evaluate(() => window.scrollY);
      expect(scrollBefore).toBeGreaterThan(0);

      await spareCard.click();
      await page.waitForURL(/\/stores-inventory(?:\?|$)/);
      const inventoryUrl = new URL(page.url());
      expect(inventoryUrl.searchParams.get("from")).toBe("dashboard");
      expect(inventoryUrl.searchParams.get("filter")).toBe("attention");

      const inventoryRiskCard = page.locator(
        '[data-vorta-inventory-risk-card="true"]',
      );
      await expect(inventoryRiskCard).toBeVisible({ timeout: 60_000 });
      const inventoryRiskText = await inventoryRiskCard.textContent();
      const inventoryScoreMatch = inventoryRiskText?.match(/(\d+)\s*\/100/);
      expect(inventoryScoreMatch).not.toBeNull();
      expect(Number(inventoryScoreMatch?.[1])).toBe(Math.round(dashboardScore));

      await page.goBack();
      await expect(combinedHeading).toBeVisible({ timeout: 60_000 });
      await expect(opportunity).toBeVisible({ timeout: 60_000 });
      await expect(spareCard).toBeVisible({ timeout: 60_000 });
      await expect
        .poll(
          async () =>
            usesPortalScroller
              ? portalScroller.evaluate((element) => element.scrollTop)
              : page.evaluate(() => window.scrollY),
          { timeout: 15_000 },
        )
        .toBeGreaterThanOrEqual(Math.max(1, scrollBefore - 2));
      await expectNoPageOverflow(page);
    });
  }
});
