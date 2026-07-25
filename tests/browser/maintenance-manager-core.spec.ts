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

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  const isPhone = viewportWidth < 640;
  const dashboardHeading = page.getByRole("heading", {
    name: "Operations Overview",
    includeHidden: true,
  });
  const dataModeBanner = page.locator("[data-vorta-data-mode]");

  if (isPhone) {
    await expect(dashboardHeading).toBeHidden();
    await expect(dataModeBanner).toBeHidden();
  } else {
    await expect(dashboardHeading).toBeVisible();
    await expect(dataModeBanner).toBeVisible();
  }
  await expectNoPageOverflow(page);

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

  const embeddedAi = page.locator('[data-vorta-embedded-ai="true"]');
  const selectedRiskSummaryCard = page
    .locator('header:has([data-vorta-embedded-ai="true"]) + div.grid > div')
    .first();
  const standaloneAskButton = embeddedAi.getByRole("button", {
    name: "Ask",
    exact: true,
    includeHidden: true,
  });

  if (isPhone) {
    await expect(selectedRiskSummaryCard).toBeHidden();
    await expect(standaloneAskButton).toBeHidden();

    const aiInput = embeddedAi.locator('input[type="text"]').first();
    await aiInput.fill("What needs attention today?");
    await aiInput.press("Enter");

    const closeGlobalAssistant = page.getByRole("button", {
      name: "Close global assistant",
      exact: true,
    });
    await expect(closeGlobalAssistant).toBeVisible();
    await closeGlobalAssistant.click();
    await expect(closeGlobalAssistant).toBeHidden();
  } else {
    await expect(selectedRiskSummaryCard).toBeVisible();
    await expect(standaloneAskButton).toBeVisible();
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
  if (isPhone) {
    await expect(dashboardHeading).toBeHidden();
  } else {
    await expect(dashboardHeading).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Ask Vorta AI", exact: true }),
  ).toBeHidden();
});
