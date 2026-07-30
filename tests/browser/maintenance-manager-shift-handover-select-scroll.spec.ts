import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

// Production regression: Android Chrome must scroll portalled listboxes internally.
async function expectInternalMenuScroll(
  page: Page,
  listbox: Locator,
): Promise<void> {
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveCSS("touch-action", "pan-y");

  const before = await listbox.evaluate((element) => ({
    scrollTop: element.scrollTop,
    overflow: element.scrollHeight - element.clientHeight,
  }));
  expect(
    before.overflow,
    "The mobile listbox must have internally scrollable content",
  ).toBeGreaterThan(4);

  const pageScroller = page.locator('[data-vorta-portal-scroll-container="true"]');
  const pageScrollBefore = await pageScroller.evaluate((element) => element.scrollTop);
  const box = await listbox.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + Math.min((box?.height ?? 0) / 2, 120),
  );

  const scrollTowardsStart = before.scrollTop >= before.overflow / 2;
  const delta = Math.max(12, Math.min(120, before.overflow));
  await page.mouse.wheel(0, scrollTowardsStart ? -delta : delta);

  await expect.poll(
    () => listbox.evaluate((element) => element.scrollTop),
    {
      message: "Internal menu scrolling must not snap back to the focused option",
      timeout: 5_000,
    },
  ).toSatisfy((scrollTop) => scrollTowardsStart
    ? scrollTop < before.scrollTop - 2
    : scrollTop > before.scrollTop + 2);
  await expect(listbox).toBeVisible();

  const pageScrollAfter = await pageScroller.evaluate((element) => element.scrollTop);
  expect(
    Math.abs(pageScrollAfter - pageScrollBefore),
    "Scrolling a portalled dropdown must not move the Shift Handover page",
  ).toBeLessThanOrEqual(2);
}

test("Shift Handover portalled dropdowns scroll on a narrow mobile viewport", async ({ page }) => {
  test.setTimeout(150_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");
  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();

  const reviewTrigger = page.getByRole("button", { name: "Review period", exact: true });
  await expect(reviewTrigger).toBeVisible();
  await reviewTrigger.click();
  const reviewListbox = page.getByRole("listbox", { name: "Review period options" });
  await expectInternalMenuScroll(page, reviewListbox);
  await page.keyboard.press("Escape");
  await expect(reviewListbox).toBeHidden();

  const teamTrigger = page.getByRole("button", { name: "Maintenance team", exact: true });
  if (!(await teamTrigger.isVisible())) {
    await page.getByRole("button", { name: /^Filters(?: · \d+)?$/ }).click();
  }
  await expect(teamTrigger).toBeVisible();
  await teamTrigger.click();
  const teamListbox = page.getByRole("listbox", { name: "Maintenance team options" });
  await expectInternalMenuScroll(page, teamListbox);
  await page.keyboard.press("Escape");
  await expect(teamListbox).toBeHidden();
});
