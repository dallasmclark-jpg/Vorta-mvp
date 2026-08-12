import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const screenshotDir = "card-style-screenshots";

async function settle(page: Page): Promise<void> {
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
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page: Page, projectName: string, pageName: string): Promise<void> {
  await settle(page);
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: `${screenshotDir}/${projectName}-${pageName}.png`,
    fullPage: false,
  });
}

test("capture premium card geometry for visual review", async ({ page }, testInfo) => {
  await signInMaintenanceManager(page);

  await capture(page, testInfo.project.name, "dashboard");

  await page.goto("/skills-matrix");
  const isPhone = (page.viewportSize()?.width ?? 1024) < 640;
  await expect(
    page.getByRole("heading", {
      name: isPhone ? "Capability Summary" : /Skills Matrix/i,
    }).first(),
  ).toBeVisible();
  await capture(page, testInfo.project.name, "skills-matrix");
});
