import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

async function metricValue(
  page: Parameters<typeof expectNoPageOverflow>[0],
  key: string,
): Promise<string> {
  const metric = page.locator(`[data-vorta-historical-metric="${key}"]`);
  await expect(metric).toBeVisible();
  return (await metric.locator("p").nth(1).textContent())?.trim() ?? "";
}

test("Historical Validation scopes governed evidence by Site and Area without layout regression", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await signInMaintenanceManager(page);
  await page.goto("/historical-validation");

  const root = page.locator('[data-vorta-historical-validation="true"]');
  await expect(root).toBeVisible({ timeout: 30_000 });
  await expect(root.getByRole("heading", { name: "Historical Validation" })).toBeVisible();
  await expect(root.locator('[data-vorta-historical-provenance="true"]')).toContainText(
    "Historical demonstration evidence",
  );
  await expect(root.locator('[data-vorta-historical-provenance="true"]')).toContainText(
    "do not prove breakdown causation or guaranteed preventability",
  );

  const scopeTabs = root.getByRole("tablist", {
    name: "Historical validation scope",
  });
  const siteTab = scopeTabs.getByRole("tab", { name: /^Site\s+24$/ });
  await expect(siteTab).toBeVisible();
  await expect(siteTab).toHaveAttribute("aria-selected", "true");
  await expect(root).toHaveAttribute("data-vorta-historical-scope", "Site");
  expect(await metricValue(page, "scenarios")).toBe("24");
  expect(await metricValue(page, "breakdown-warnings")).toBe("12/12");

  const utilitiesTab = scopeTabs.getByRole("tab", { name: /^Utilities\s+6$/ });
  await expect(utilitiesTab).toBeVisible();
  await utilitiesTab.click();
  await expect(utilitiesTab).toHaveAttribute("aria-selected", "true");
  await expect(root).toHaveAttribute("data-vorta-historical-scope", "Utilities");
  expect(await metricValue(page, "scenarios")).toBe("6");
  expect(await metricValue(page, "breakdown-warnings")).toBe("4/4");

  const selectedVisualState = await utilitiesTab.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      borderTopColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
      dark: document.documentElement.classList.contains("dark"),
    };
  });
  expect(selectedVisualState.borderTopColor).toBe(
    selectedVisualState.dark ? "rgb(96, 165, 250)" : "rgb(37, 99, 235)",
  );
  expect(selectedVisualState.backgroundColor).toBe(
    selectedVisualState.dark ? "rgb(13, 17, 23)" : "rgb(255, 255, 255)",
  );

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
  await expect(root.locator("[data-vorta-historical-case]").first()).toContainText("Utilities");
  await expect(root.locator("[data-vorta-historical-case]").first()).toContainText(
    "No breakdown",
  );

  const sparesTab = evidenceTabs.getByRole("tab", { name: /^Spares impact\s+/ });
  await sparesTab.click();
  await expect(sparesTab).toHaveAttribute("aria-selected", "true");
  await expect(root.locator("[data-vorta-historical-case]").first()).toBeVisible();
  await expect(root.getByRole("button", { name: "Equipment history" }).first()).toBeVisible();

  await siteTab.click();
  await expect(root).toHaveAttribute("data-vorta-historical-scope", "Site");
  expect(await metricValue(page, "scenarios")).toBe("24");

  await expectNoPageOverflow(page);
});
