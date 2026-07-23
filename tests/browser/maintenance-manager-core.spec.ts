import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  expectOperationalTouchTarget,
  signInMaintenanceManager,
  verifyCrossSiteIsolation,
} from "./maintenance-manager-test-helpers";

test("Maintenance Manager dashboard and Shift Cover remain in context", async ({
  page,
}) => {
  await signInMaintenanceManager(page);

  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  await expect(page.locator("[data-vorta-data-mode]")).toBeVisible();
  await expectNoPageOverflow(page);

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  if (viewportWidth === 1366) {
    await verifyCrossSiteIsolation(page);
  }

  if (viewportWidth <= 420) {
    const riskScopeTrigger = page
      .locator('[data-vorta-mobile-risk-scope="true"] button')
      .first();
    await expect(riskScopeTrigger).toBeVisible();
    await expectOperationalTouchTarget(riskScopeTrigger);
    await riskScopeTrigger.click();

    const riskScopeDialog = page.getByRole("dialog", {
      name: "Risk scope",
    });
    await expect(riskScopeDialog).toBeVisible();

    const areaOption = riskScopeDialog
      .locator('button[aria-pressed="false"]')
      .first();
    await expect(areaOption).toBeVisible();
    const areaLabel = await areaOption.locator("span").nth(1).textContent();
    expect(areaLabel?.trim()).toBeTruthy();
    await areaOption.click();

    await expect(riskScopeDialog).toBeHidden();
    await expect(riskScopeTrigger).toContainText(areaLabel?.trim() ?? "");
  } else {
    const riskScopeTabs = page.getByRole("tablist", {
      name: "Risk intelligence scope",
    });
    await expect(riskScopeTabs).toBeVisible();
    const areaTab = riskScopeTabs
      .getByRole("tab")
      .filter({ hasNotText: /^\s*Site Risk/i })
      .first();
    await expect(areaTab).toBeVisible();
    await expectOperationalTouchTarget(areaTab);
    await areaTab.click();
    await expect(areaTab).toHaveAttribute("aria-selected", "true");
  }

  const shiftCoverCard = page.locator(
    '[data-vorta-labour-risk-card="shift-cover"]',
  );
  await expect(shiftCoverCard).toBeVisible();
  await shiftCoverCard.click();
  await page.waitForURL(/\/maintenance\/labour-risk\/shift-cover(?:\?.*)?$/);
  await expect(
    page.getByRole("heading", { name: "Shift Cover Risk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Operational Rota Risk Map", exact: true }),
  ).toBeVisible();

  const shiftCoverMode = page.locator("[data-vorta-shift-cover-mode]");
  const resolvedShiftCoverMode = await shiftCoverMode.getAttribute(
    "data-vorta-shift-cover-mode",
  );
  expect(["demo", "live"]).toContain(resolvedShiftCoverMode);
  await expect(
    page.getByText(
      resolvedShiftCoverMode === "live" ? "LIVE ROTA" : "DEMO ROTA",
      { exact: true },
    ),
  ).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask Vorta AI", exact: true }),
  ).toBeHidden();
});
