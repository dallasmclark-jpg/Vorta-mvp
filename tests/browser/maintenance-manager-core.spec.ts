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

  const riskIntelligenceLabel = page.locator(
    '[data-vorta-risk-intelligence-label="true"]',
  );
  const workPlanSummary = page.locator(
    '[data-vorta-work-plan-summary="true"]',
  );

  if (isPhone) {
    await expect(riskIntelligenceLabel).toBeHidden();
    await expect(workPlanSummary).toBeHidden();
    await expect(
      page
        .locator('[data-vorta-mobile-risk-scope="true"]')
        .getByText("Today's Risk", { exact: true }),
    ).toBeVisible();
  } else {
    await expect(riskIntelligenceLabel).toBeVisible();
    await expect(workPlanSummary).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Site Risk Briefing",
        exact: true,
      }),
    ).toBeVisible();
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

    const riskScopeMenu = page.getByRole("listbox");
    await expect(riskScopeMenu).toBeVisible();

    const areaOption = riskScopeMenu.getByRole("option").nth(1);
    await expect(areaOption).toBeVisible();
    const areaLabel = await areaOption.locator("span").first().textContent();
    expect(areaLabel?.trim()).toBeTruthy();
    await areaOption.click();

    await expect(riskScopeMenu).toBeHidden();
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
    await aiInput.focus();
    const focusedInputPresentation = await aiInput.evaluate((input) => {
      const styles = window.getComputedStyle(input);
      return {
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
      };
    });
    expect(focusedInputPresentation).toEqual({
      outlineStyle: "none",
      outlineWidth: "0px",
      boxShadow: "none",
    });

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

test("Mobile work plan scrolls into view with compact action cards", async ({
  page,
}) => {
  const viewportWidth = page.viewportSize()?.width ?? 1366;
  test.skip(viewportWidth >= 640, "Phone-only dashboard behaviour.");

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-vorta-mobile-work-plan-scroll",
    "true",
  );

  await page.evaluate(() => {
    const app = document.getElementById("app");
    if (app) app.hidden = true;

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div id="synthetic-work-plan-summary">
          <div>
            <button type="button" aria-expanded="false">View work plan</button>
          </div>
        </div>
        <div id="synthetic-work-plan" class="border-t pt-4" style="margin-top: 1200px;">
          <div class="flex flex-col gap-5">
            <div></div>
            <div></div>
            <div>
              <div id="synthetic-work-plan-heading">
                <p>Recommended Work Queue</p>
                <p>Ranked explanatory copy</p>
              </div>
              <div class="flex flex-col gap-2">
                <button id="synthetic-work-plan-card" type="button">
                  <span id="synthetic-work-plan-rank">1</span>
                  <div class="min-w-0">
                    <div>
                      <p id="synthetic-work-plan-title">Complete the highest-value maintenance action with a deliberately long title</p>
                      <span id="synthetic-work-plan-driver">Calibration</span>
                    </div>
                    <div id="synthetic-work-plan-metadata">
                      <span>PM-261003</span>
                      <span>3h 0m</span>
                    </div>
                  </div>
                  <div>
                    <p id="synthetic-work-plan-risk-label">Asset risk</p>
                    <p>-9</p>
                    <p id="synthetic-work-plan-projected-score">to 78</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div style="height: 1200px;"></div>
      `,
    );
    window.scrollTo(0, 0);
  });

  await page.getByRole("button", { name: "View work plan", exact: true }).click();

  const workPlanPanel = page.locator("#synthetic-work-plan");
  await expect
    .poll(async () => {
      const box = await workPlanPanel.boundingBox();
      return box !== null && box.y >= 0 && box.y < 180;
    })
    .toBe(true);

  await expect(page.locator("#synthetic-work-plan-heading")).toBeHidden();
  await expect(page.locator("#synthetic-work-plan-rank")).toBeHidden();
  await expect(page.locator("#synthetic-work-plan-driver")).toBeVisible();
  await expect(page.locator("#synthetic-work-plan-metadata")).toBeHidden();
  await expect(page.locator("#synthetic-work-plan-risk-label")).toBeHidden();
  await expect(page.locator("#synthetic-work-plan-projected-score")).toBeHidden();

  const compactPresentation = await page
    .locator("#synthetic-work-plan-card")
    .evaluate((card) => ({
      alignItems: card.style.alignItems,
      gap: card.style.gap,
      gridTemplateColumns: card.style.gridTemplateColumns,
      padding: card.style.padding,
    }));
  expect(compactPresentation).toEqual({
    alignItems: "flex-start",
    gap: "0.625rem",
    gridTemplateColumns: "minmax(0px, 1fr) auto",
    padding: "0.75rem",
  });

  const titlePresentation = await page
    .locator("#synthetic-work-plan-title")
    .evaluate((title) => ({
      display: title.style.display,
      lineClamp: title.style.getPropertyValue("-webkit-line-clamp"),
    }));
  expect(titlePresentation).toEqual({
    display: "-webkit-box",
    lineClamp: "2",
  });
});
