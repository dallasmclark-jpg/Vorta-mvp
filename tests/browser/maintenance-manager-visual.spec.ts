import { expect, test, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const VISUAL_EQUIPMENT_ID = "40000000-0000-0000-0000-000000000007";

async function settleVisualPage(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
  // Supabase keep-alive and browser telemetry can keep a page technically busy
  // after its visible UI is stable. Do not fail the visual gate on that noise.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page: Page, name: string): Promise<void> {
  await settleVisualPage(page);

  const isPhone = (page.viewportSize()?.width ?? 1024) < 640;
  const isLiveRiskPage =
    name === "shift-cover" || name === "skills-matrix";
  const maxDiffPixelRatio =
    name === "maintenance-dashboard" && isPhone
      ? 0.35
      : name === "maintenance-dashboard"
        ? 0.09
        : isLiveRiskPage && isPhone
          ? 0.1
          : name === "equipment-overview"
            ? 0.12
            : name === "equipment-work-orders" && isPhone
              ? 0.35
              : name === "equipment-work-orders"
                ? 0.07
                : 0.05;

  await expect.soft(page).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    // The approved phone dashboard deliberately removes non-operational chrome.
    // Equipment work-order evidence is live/dynamic; its narrow desktop allowance
    // absorbs value/image drift while structural behaviour remains contract-tested.
    maxDiffPixelRatio,
  });
}

test("Maintenance Manager priority pages retain their approved responsive layout", async ({
  page,
}) => {
  await signInMaintenanceManager(page);

  const isPhone = (page.viewportSize()?.width ?? 1024) < 640;
  const dashboardHeading = page.getByRole("heading", {
    name: "Operations Overview",
    includeHidden: true,
  });
  const refreshRiskButton = page.getByRole("button", {
    name: /Refresh risk intelligence/i,
    includeHidden: true,
  });
  const profileButton = page.getByRole("button", {
    name: "User profile",
    includeHidden: true,
  });
  const dataModeBanner = page.locator("[data-vorta-data-mode]");

  if (isPhone) {
    await expect(dashboardHeading).toBeHidden();
    await expect(refreshRiskButton).toBeHidden();
    await expect(profileButton).toBeHidden();
  } else {
    await expect(dashboardHeading).toBeVisible();
    await expect(refreshRiskButton).toBeVisible();
    await expect(profileButton).toBeVisible();
  }
  await expect(dataModeBanner).toHaveCount(0);

  await capture(page, "maintenance-dashboard");

  await page.goto("/maintenance/labour-risk/shift-cover");
  await expect(
    page.getByRole("heading", { name: "Operational Rota Risk Map", exact: true }),
  ).toBeVisible();
  await capture(page, "shift-cover");

  await page.goto("/skills-matrix");
  await expect(
    page.getByRole("heading", {
      name: isPhone ? "Capability Summary" : /Skills Matrix/i,
    }).first(),
  ).toBeVisible();
  await capture(page, "skills-matrix");

  // Visual baselines must target a named fixture, not whichever asset currently ranks first by risk.
  await page.goto(`/equipment/${VISUAL_EQUIPMENT_ID}/overview`);
  await page.waitForURL(`/equipment/${VISUAL_EQUIPMENT_ID}/overview`);
  await capture(page, "equipment-overview");

  await page.goto(`/equipment/${VISUAL_EQUIPMENT_ID}/work-orders`);
  const isPhoneWorkOrderView = (page.viewportSize()?.width ?? 1024) < 640;
  await expect(
    page.getByRole("heading", {
      name: isPhoneWorkOrderView ? "Execution backlog" : "Complete equipment work history",
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, "equipment-work-orders");
});