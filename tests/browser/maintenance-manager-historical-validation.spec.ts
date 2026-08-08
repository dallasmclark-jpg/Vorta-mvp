import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("Historical Validation provides interactive scoped evidence without layout regression", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await signInMaintenanceManager(page);
  await page.goto("/historical-validation");

  const root = page.locator('[data-vorta-historical-validation="true"]');
  await expect(root).toBeVisible({ timeout: 45_000 });
  await expect(root.getByRole("heading", { name: "Historical Validation" })).toBeVisible();

  const provenance = root.locator('[data-vorta-historical-provenance="true"]');
  await expect(provenance).toContainText("Synthetic demonstration history");
  await expect(provenance).toContainText("not imported pilot SAP history");

  const briefing = root.locator('[data-vorta-historical-briefing="true"]');
  await expect(briefing).toBeVisible();
  await expect(briefing).toContainText("Across 24 historical validation cases in Site");
  await expect(briefing).toContainText("12 of 12 recorded breakdown cases");
  await expect(root.getByText("What this means:")).toBeVisible();
  await expect(root).toContainText("does not prove that Vorta would have prevented a breakdown");

  const warningFinding = root.locator('[data-vorta-historical-finding="warning"]');
  const sparesFinding = root.locator('[data-vorta-historical-finding="spares"]');
  const controlsFinding = root.locator('[data-vorta-historical-finding="controls"]');
  await expect(warningFinding).toContainText("12/12 breakdowns warned");
  await expect(warningFinding).toContainText("21.3 days");
  await expect(sparesFinding).toContainText("6 pre-failure stock-outs");
  await expect(sparesFinding).toContainText("10h 30m");
  await expect(controlsFinding).toContainText("6 successful interventions");
  await expect(controlsFinding).toContainText("6 false positives");

  const timeline = root.locator('[data-vorta-historical-timeline="true"]');
  await expect(timeline).toBeVisible();
  await expect(timeline.getByRole("img")).toBeVisible();
  await expect(timeline).toHaveAttribute("data-vorta-historical-scale", "quarter");

  const timelineScroll = timeline.locator('[data-vorta-historical-timeline-scroll="true"]');
  const timelineCanvas = timeline.locator('[data-vorta-historical-timeline-canvas="true"]');
  await expect(timelineScroll).toBeVisible();
  await expect(timelineCanvas).toBeVisible();

  const quarterControl = timeline.locator('[data-vorta-historical-scale-control="quarter"]');
  const monthControl = timeline.locator('[data-vorta-historical-scale-control="month"]');
  const weekControl = timeline.locator('[data-vorta-historical-scale-control="week"]');
  const yearControl = timeline.locator('[data-vorta-historical-scale-control="year"]');
  await expect(quarterControl).toHaveAttribute("aria-pressed", "true");

  const quarterGeometry = await timelineCanvas.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  expect(quarterGeometry.height).toBeGreaterThanOrEqual(314);
  expect(quarterGeometry.height).toBeLessThanOrEqual(316);

  await monthControl.click();
  await expect(timeline).toHaveAttribute("data-vorta-historical-scale", "month");
  await expect(monthControl).toHaveAttribute("aria-pressed", "true");
  const monthGeometry = await timelineCanvas.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  const monthOverflow = await timelineScroll.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(monthGeometry.height).toBe(quarterGeometry.height);
  expect(monthGeometry.width).toBeGreaterThan(quarterGeometry.width);
  expect(monthOverflow.scrollWidth).toBeGreaterThan(monthOverflow.clientWidth);

  await timelineScroll.evaluate((element) => {
    element.scrollLeft = Math.floor(element.scrollWidth / 2);
  });
  expect(await timelineScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await weekControl.click();
  await expect(timeline).toHaveAttribute("data-vorta-historical-scale", "week");
  await expect(weekControl).toHaveAttribute("aria-pressed", "true");
  const weekGeometry = await timelineCanvas.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  const weekOverflow = await timelineScroll.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(weekGeometry.height).toBe(quarterGeometry.height);
  expect(weekGeometry.width).toBeGreaterThan(monthGeometry.width);
  expect(weekOverflow.scrollWidth).toBeGreaterThan(weekOverflow.clientWidth);

  await yearControl.click();
  await expect(timeline).toHaveAttribute("data-vorta-historical-scale", "year");
  await expect(yearControl).toHaveAttribute("aria-pressed", "true");
  const yearGeometry = await timelineCanvas.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  expect(yearGeometry.height).toBe(quarterGeometry.height);

  await quarterControl.click();
  await expect(timeline).toHaveAttribute("data-vorta-historical-scale", "quarter");

  for (const kind of [
    "warning",
    "stockout",
    "breakdown",
    "intervention",
    "false-positive",
  ]) {
    await expect(timeline.locator(`[data-vorta-historical-event="${kind}"]`).first()).toBeVisible();
  }

  const breakdownControl = timeline.locator('[data-vorta-historical-event="breakdown"]').first();
  await expect(breakdownControl).toHaveAttribute("role", "button");
  await expect(breakdownControl).toHaveAttribute("tabindex", "0");
  await breakdownControl.focus();
  await page.keyboard.press("Enter");

  const panel = page.locator('[data-vorta-historical-event-panel="true"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("dialog")).toBeVisible();
  await expect(panel).toContainText("Last Vorta risk before breakdown");
  await expect(panel).toContainText("First elevated warning");
  await expect(panel).toContainText("Primary risk driver");
  await expect(panel).toContainText("Evidence boundary");
  await expect(panel).toContainText("does not prove that the risk condition caused the breakdown");
  await expect(panel.getByRole("button", { name: "Open equipment history" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(breakdownControl).toBeFocused();

  const aggregateBreakdown = timeline.locator(
    '[data-vorta-historical-event="breakdown"][aria-label^="2 breakdown"]',
  ).first();
  if (await aggregateBreakdown.count()) {
    await aggregateBreakdown.click();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("2 events in this period");
    await panel.getByRole("button", { name: "Close timeline evidence panel" }).click();
    await expect(panel).toBeHidden();
  }

  const scopeTabs = root.getByRole("tablist", {
    name: "Historical validation scope",
  });
  const siteTab = scopeTabs.getByRole("tab", { name: /^Site\s+24$/ });
  await expect(siteTab).toHaveAttribute("aria-selected", "true");
  await expect(root).toHaveAttribute("data-vorta-historical-scope", "Site");

  await weekControl.click();
  await expect(timeline).toHaveAttribute("data-vorta-historical-scale", "week");

  const utilitiesTab = scopeTabs.getByRole("tab", { name: /^Utilities\s+6$/ });
  await expect(utilitiesTab).toBeVisible();
  await utilitiesTab.click();
  await expect(utilitiesTab).toHaveAttribute("aria-selected", "true");
  await expect(root).toHaveAttribute("data-vorta-historical-scope", "Utilities");
  await expect(briefing).toContainText("Across 6 historical validation cases in Utilities");
  await expect(briefing).toContainText("4 of 4 recorded breakdown cases");
  await expect(warningFinding).toContainText("4/4 breakdowns warned");
  await expect(timeline).toHaveAttribute("data-vorta-historical-scale", "week");

  const selectedVisualState = await utilitiesTab.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      borderTopColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
      dark: document.documentElement.classList.contains("dark"),
    };
  });
  if (selectedVisualState.dark) {
    expect(selectedVisualState.borderTopColor).toMatch(/rgba?\(96, 165, 250/);
    expect(selectedVisualState.backgroundColor).toBe("rgb(13, 17, 23)");
  } else {
    expect(selectedVisualState.borderTopColor).toBe("rgb(37, 99, 235)");
    expect(selectedVisualState.backgroundColor).toBe("rgb(255, 255, 255)");
  }

  const evidenceTabs = root.getByRole("tablist", {
    name: "Historical validation evidence type",
  });
  const breakdownTab = evidenceTabs.getByRole("tab", { name: /^Breakdowns\s+4$/ });
  await expect(breakdownTab).toHaveAttribute("aria-selected", "true");
  await expect(root.locator("[data-vorta-historical-case]")).toHaveCount(4);

  const falsePositiveTab = evidenceTabs.getByRole("tab", {
    name: /^False positives\s+1$/,
  });
  await falsePositiveTab.click();
  await expect(falsePositiveTab).toHaveAttribute("aria-selected", "true");
  await expect(root.locator("[data-vorta-historical-case]")).toHaveCount(1);
  await expect(root.locator("[data-vorta-historical-case]").first()).toContainText("No breakdown");

  const searchInput = root.getByPlaceholder("Search equipment, work order, spare...");
  await searchInput.fill("GEA");
  await expect(root.locator("[data-vorta-historical-case]")).toHaveCount(0);
  await searchInput.fill("");
  await expect(root.locator("[data-vorta-historical-case]")).toHaveCount(1);

  const sparesTab = evidenceTabs.getByRole("tab", { name: /^Spares impact\s+/ });
  await sparesTab.click();
  await expect(sparesTab).toHaveAttribute("aria-selected", "true");
  const firstCase = root.locator("[data-vorta-historical-case]").first();
  await expect(firstCase).toBeVisible();
  await firstCase.locator("summary").click();
  await expect(firstCase.getByRole("button", { name: "Equipment history" })).toBeVisible();

  await siteTab.click();
  await expect(root).toHaveAttribute("data-vorta-historical-scope", "Site");
  await expect(briefing).toContainText("Across 24 historical validation cases in Site");
  await expect(timeline).toHaveAttribute("data-vorta-historical-scale", "week");

  await expectNoPageOverflow(page);
});
