import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "Samsung tablet pages must not overflow the viewport").toBeLessThanOrEqual(2);
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function expectNoGenericDataFailure(page: Page): Promise<void> {
  await expect(
    page.getByText("Edge Function returned a non-2xx status code", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Failed to load|could not be loaded/i)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Vorta could not verify your access", exact: true }),
  ).toHaveCount(0);
}

test("VOR-035 real Tab S9 Ultra journey keeps the original rota", async ({
  page,
}, testInfo) => {
  const viewport = page.viewportSize();
  const viewportWidth = viewport?.width ?? 0;
  test.skip(
    viewportWidth < 768 || viewportWidth > 1600,
    "VOR-035 recovery evidence is Samsung tablet-only.",
  );

  const deviceProfile = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  expect(deviceProfile.userAgent).toContain("Android");
  expect(deviceProfile.maxTouchPoints).toBeGreaterThan(0);
  expect(deviceProfile.width).toBe(viewport?.width);
  expect(deviceProfile.height).toBe(viewport?.height);

  await signInMaintenanceManager(page);

  await page.goto("/dashboard");
  await expect(page.locator("[data-vorta-data-mode]")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Operations Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Refresh risk intelligence/i }),
  ).toBeVisible({ timeout: 30_000 });
  const embeddedAi = page.locator('[data-vorta-embedded-ai="true"]');
  await expect(embeddedAi).toBeVisible();
  await expect(embeddedAi).toHaveCSS("border-top-style", "solid");
  await expect(
    embeddedAi.getByRole("button", { name: "Ask", exact: true }),
  ).toBeVisible();
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "dashboard-tablet");

  await page.goto("/shift-handover");
  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();
  await expect(
    page.getByText(/Loading activity from the previous/i),
  ).toHaveCount(0, { timeout: 30_000 });
  await expect(
    page.locator("[data-vorta-shift-handover-metric]").first(),
  ).toBeVisible();
  await expect(
    page.getByText("Shift handover unavailable", { exact: true }),
  ).toHaveCount(0);
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "shift-handover-tablet");

  await page.goto("/skills-matrix");
  await expect(
    page.getByRole("heading", { name: /Skills Matrix/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Loading capability data", { exact: true }),
  ).toHaveCount(0, { timeout: 30_000 });
  await expect(
    page.locator('button[aria-pressed="true"]').first(),
  ).toBeVisible();
  await expect(
    page.getByText("Skills capability data could not be loaded", { exact: true }),
  ).toHaveCount(0);
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "skills-matrix-tablet");

  await page.goto("/engineers");
  const originalRota = page.locator('[data-vorta-original-shift-rota="true"]');
  await expect(originalRota).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Shift Cover Risk", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Operational Rota Risk Map", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Verified weekly coverage", { exact: true })).toHaveCount(0);

  for (const team of [
    "Yellow Shift",
    "Red Shift",
    "Green Shift",
    "Blue Shift",
    "Days",
  ]) {
    await expect(page.getByText(team, { exact: true }).first()).toBeVisible();
  }

  for (const legend of [
    "Fully Covered",
    "Reduced Cover",
    "Critical Gap",
    "Contractor Cover",
    "Off Shift",
    "Missing Skill",
    "Reduced Resilience",
    "SME Dependency",
    "Contractor Involved",
  ]) {
    await expect(page.getByText(legend, { exact: true }).first()).toBeVisible();
  }

  await expect(page.getByText("Tonight's Risk", { exact: true })).toBeVisible();
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "engineers-original-rota-tablet");

  await page
    .getByRole("button", { name: "Resolve Tonight's Cover", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Tonight's Risk Summary", exact: true }),
  ).toBeVisible();

  await page.goto("/stores-inventory");
  await expect(page.locator('[data-vorta-stores-inventory="true"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inventory", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("[data-vorta-data-mode]")).toHaveCount(0);
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "stores-inventory-tablet");

  await page.goto("/equipment");
  await expect(
    page.getByRole("heading", { name: "Equipment", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Loading equipment/i)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "equipment-tablet");
});
