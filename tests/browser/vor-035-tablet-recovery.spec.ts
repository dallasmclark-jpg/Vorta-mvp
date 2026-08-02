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

test("VOR-035 Samsung tablet demo journey remains authoritative and polished", async ({
  page,
}, testInfo) => {
  const viewportWidth = page.viewportSize()?.width ?? 0;
  test.skip(
    viewportWidth < 768 || viewportWidth > 1439,
    "VOR-035 recovery evidence is tablet-only.",
  );

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
  await expect(embeddedAi).toHaveCSS("border-radius", "16px");
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
  const tabletEngineers = page.locator('[data-vorta-tablet-engineers="true"]');
  await expect(tabletEngineers).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByText("Loading workforce and rota evidence…", { exact: true }),
  ).toHaveCount(0, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Engineers", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Failed to load engineers", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Weekend", { exact: true })).toHaveCount(0);
  await expect
    .poll(async () =>
      page.getByText(/^(Blue|Red|Green|Yellow)( Shift)?$/i).count(),
      { timeout: 30_000 },
    )
    .toBeGreaterThanOrEqual(4);
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "engineers-tablet");

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
