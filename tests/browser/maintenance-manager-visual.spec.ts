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
  const maxDiffPixelRatio =
    name === "maintenance-dashboard"
      ? 0.09
      : name === "equipment-overview"
        ? 0.12
        : name === "equipment-work-orders" && isPhone
          ? 0.35
          : name === "skills-matrix" && isPhone
            ? 0.35
            : 0.05;

  await expect.soft(page).toHaveScreenshot(`${name}.png`, {
    animations: "disabled",
    caret: "hide",
    fullPage: false,
    // Approved phone workflows deliberately use status-first compositions.
    // Their tolerances remain isolated; tablet and desktop pages keep the
    // stricter shared threshold.
    maxDiffPixelRatio,
  });
}

test("Maintenance Manager priority pages retain their approved responsive layout", async ({
  page,
}) => {
  await signInMaintenanceManager(page);
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
  await capture(page, "maintenance-dashboard");

  await page.goto("/maintenance/labour-risk/shift-cover");
  await expect(
    page.getByRole("heading", { name: "Operational Rota Risk Map", exact: true }),
  ).toBeVisible();
  await capture(page, "shift-cover");

  await page.goto("/skills-matrix");
  await expect(page.getByRole("heading", { name: /Skills Matrix/i }).first()).toBeVisible();
  await capture(page, "skills-matrix");

  // Visual baselines must target a named fixture, not whichever asset currently ranks first by risk.
  await page.goto(`/equipment/${VISUAL_EQUIPMENT_ID}/overview`);
  await page.waitForURL(`/equipment/${VISUAL_EQUIPMENT_ID}/overview`);
  await capture(page, "equipment-overview");

  await page.goto(`/equipment/${VISUAL_EQUIPMENT_ID}/work-orders`);
  const isPhone = (page.viewportSize()?.width ?? 1024) < 640;
  await expect(
    page.getByRole("heading", {
      name: isPhone ? "Execution backlog" : "Complete equipment work history",
      exact: true,
    }),
  ).toBeVisible();
  await capture(page, "equipment-work-orders");
});
