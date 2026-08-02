import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
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

async function expectContentOnlyCardPadding(page: Page, pageName: string): Promise<void> {
  const content = page
    .locator('[data-vorta-card="true"] > [class~="pt-0"]:first-child')
    .first();
  await expect(content, `${pageName} must expose a content-only card`).toBeVisible();
  const paddingTop = await content.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).paddingTop),
  );
  expect(
    paddingTop,
    `${pageName} content-only cards must retain visible top breathing room`,
  ).toBeGreaterThanOrEqual(20);
}

async function expectCapabilityBorder(
  card: Locator,
  expectedTopColour: string,
  label: string,
): Promise<void> {
  await expect(card, `${label} capability card must be visible`).toBeVisible();
  const border = await card.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      top: style.borderTopColor,
      left: style.borderLeftColor,
      right: style.borderRightColor,
      bottom: style.borderBottomColor,
    };
  });

  expect(border.top, `${label} top edge must use its team colour`).toBe(expectedTopColour);
  expect(border.left, `${label} left edge must not be neutral`).not.toBe(border.bottom);
  expect(border.right, `${label} right edge must not be neutral`).not.toBe(border.bottom);
}

test("VOR-035 Samsung desktop-site touch view keeps the original rota", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("samsung-tablet"),
    "VOR-035 recovery evidence is Samsung tablet-only.",
  );

  const viewport = page.viewportSize();
  const browserProfile = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: window.matchMedia("(any-pointer: coarse)").matches,
    noHover: window.matchMedia("(hover: none)").matches,
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  expect(browserProfile.width).toBe(viewport?.width);
  expect(browserProfile.height).toBe(viewport?.height);
  expect(browserProfile.maxTouchPoints).toBeGreaterThan(0);

  if (testInfo.project.name === "samsung-tablet-landscape") {
    expect(browserProfile.width).toBe(1536);
    expect(browserProfile.height).toBe(959);
    expect(browserProfile.userAgent).not.toContain("Android");
  }

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
  const askButton = embeddedAi.getByRole("button", { name: "Ask", exact: true });
  await expect(askButton).toBeVisible();
  const askButtonSize = await askButton.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      minWidth: Number.parseFloat(style.minWidth),
      minHeight: Number.parseFloat(style.minHeight),
    };
  });
  expect(askButtonSize.minWidth).toBeGreaterThanOrEqual(96);
  expect(askButtonSize.minHeight).toBeGreaterThanOrEqual(48);
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "dashboard-samsung");

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
  await captureEvidence(page, testInfo, "shift-handover-samsung");

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

  await expectCapabilityBorder(
    page.locator('button[aria-pressed][class~="border-t-red-500"]').first(),
    "rgb(239, 68, 68)",
    "Red Shift",
  );
  await expectCapabilityBorder(
    page.locator('button[aria-pressed][class~="border-t-emerald-500"]').first(),
    "rgb(16, 185, 129)",
    "Green Shift",
  );
  await expectCapabilityBorder(
    page.locator('button[aria-pressed][class~="border-t-blue-500"]').first(),
    "rgb(59, 130, 246)",
    "Blue Shift",
  );
  await expectCapabilityBorder(
    page.locator('button[aria-pressed][class~="border-t-yellow-400"]').first(),
    "rgb(250, 204, 21)",
    "Yellow Shift",
  );

  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "skills-matrix-samsung");

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
  await expect(page.locator('[data-vorta-live-engineers="true"]')).toHaveCount(0);

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
  await captureEvidence(page, testInfo, "engineers-original-rota-samsung");

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
  await captureEvidence(page, testInfo, "stores-inventory-samsung");

  await page.goto("/equipment");
  await expect(
    page.getByRole("heading", { name: "Equipment", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Loading equipment/i)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expectContentOnlyCardPadding(page, "Equipment");
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "equipment-samsung");

  await page.goto("/training-providers");
  await expect(
    page.getByRole("heading", { name: "Training Providers", exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expectContentOnlyCardPadding(page, "Training Providers");
  await expectNoGenericDataFailure(page);
  await expectNoPageOverflow(page);
  await captureEvidence(page, testInfo, "training-providers-samsung");
});
