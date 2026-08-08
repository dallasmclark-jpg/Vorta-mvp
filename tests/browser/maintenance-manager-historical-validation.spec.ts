import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("Historical Validation tells the governed Site and Area history without layout regression", async ({
  page,
}) => {
  test.setTimeout(150_000);

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
  for (const kind of [
    "warning",
    "stockout",
    "breakdown",
    "intervention",
    "false-positive",
  ]) {
    await expect(timeline.locator(`[data-vorta-historical-legend="${kind}"]`)).toBeVisible();
    await expect(timeline.locator(`[data-vorta-historical-event="${kind}"]`).first()).toBeAttached();
  }

  const scopeTabs = root.getByRole("tablist", {
    name: "Historical validation scope",
  });
  const siteTab = scopeTabs.getByRole("tab", { name: /^Site\s+24$/ });
  await expect(siteTab).toHaveAttribute("aria-selected", "true");
  await expect(root).toHaveAttribute("data-vorta-historical-scope", "Site");

  const utilitiesTab = scopeTabs.getByRole("tab", { name: /^Utilities\s+6$/ });
  await expect(utilitiesTab).toBeVisible();
  await utilitiesTab.click();
  await expect(utilitiesTab).toHaveAttribute("aria-selected", "true");
  await expect(root).toHaveAttribute("data-vorta-historical-scope", "Utilities");
  await expect(briefing).toContainText("Across 6 historical validation cases in Utilities");
  await expect(briefing).toContainText("4 of 4 recorded breakdown cases");
  await expect(warningFinding).toContainText("4/4 breakdowns warned");

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

  await expectNoPageOverflow(page);
});
