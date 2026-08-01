import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("dashboard surfaces the leading intervention and critical spare without responsive overflow", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signInMaintenanceManager(page);
  await page.goto("/dashboard");

  const combinedHeading = page.getByRole("heading", {
    name: /Spares & Labour Risks$/,
  });
  await expect(combinedHeading).toBeVisible({ timeout: 60_000 });

  const viewWorkPlan = page.getByRole("button", {
    name: "View work plan",
    exact: true,
  });
  if (await viewWorkPlan.isVisible()) await viewWorkPlan.click();

  const opportunity = page.locator(
    '[data-vorta-biggest-reduction-opportunity="true"]',
  );
  await expect(opportunity).toBeVisible({ timeout: 60_000 });
  await expect(opportunity).toContainText("Biggest reduction opportunity");
  await expect(opportunity).toContainText(/Site-risk reduction/i);
  await expect(opportunity).toContainText(/−\d+(?:\.\d+)? points/);

  const spareCard = page.locator(
    '[data-vorta-critical-spare-risk-card="true"]',
  );
  await expect(spareCard).toBeVisible({ timeout: 60_000 });
  await expect(spareCard).toContainText("Critical spare shortage");
  await expect(spareCard).toContainText(/Potential site-risk reduction/i);
  await expect(spareCard).toContainText(/−\d+(?:\.\d+)? points/);
  await expect(spareCard.getByText("View spare", { exact: true })).toBeVisible();

  const viewport = page.viewportSize();
  const layout = await spareCard.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    rect: element.getBoundingClientRect().toJSON(),
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.rect.x).toBeGreaterThanOrEqual(-1);
  expect(layout.rect.width).toBeLessThanOrEqual((viewport?.width ?? 1920) + 1);
  expect(layout.rect.x + layout.rect.width).toBeLessThanOrEqual(
    (viewport?.width ?? 1920) + 1,
  );

  await expectNoPageOverflow(page);

  await spareCard.scrollIntoViewIfNeeded();
  const portalScroller = page.locator(
    '[data-vorta-portal-scroll-container="true"]',
  );
  const scrollBefore = await portalScroller.evaluate(
    (element) => element.scrollTop,
  );
  expect(scrollBefore).toBeGreaterThan(0);

  await spareCard.click();
  await page.waitForURL(/\/equipment\/[^/]+\/spares\?[^#]*from=dashboard/);
  expect(page.url()).toMatch(/[?&]record=/);

  await page.goBack();
  await expect(combinedHeading).toBeVisible({ timeout: 60_000 });
  await expect(spareCard).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(
      async () =>
        portalScroller.evaluate((element) => element.scrollTop),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  await expectNoPageOverflow(page);
});
