import { expect, test, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const TEAM_LABELS = [
  "Blue Shift",
  "Red Shift",
  "Green Shift",
  "Yellow Shift",
  "Day Shift",
  "Calibration Team",
] as const;

async function exposeTeamFilter(page: Page): Promise<void> {
  const teamTrigger = page.getByRole("button", { name: "Maintenance team", exact: true });
  if (!(await teamTrigger.isVisible())) {
    await page.getByRole("button", { name: /^Filters(?: · \d+)?$/ }).click();
  }
  await expect(teamTrigger).toBeVisible();
}

async function openTeamListbox(page: Page) {
  const trigger = page.getByRole("button", { name: "Maintenance team", exact: true });
  await trigger.click();
  const listbox = page.getByRole("listbox", { name: "Maintenance team options" });
  await expect(listbox).toBeVisible();
  return listbox;
}

async function clearTeams(page: Page): Promise<void> {
  const listbox = await openTeamListbox(page);
  await listbox.getByRole("option", { name: "All maintenance teams", exact: true }).click();
  await expect(page.getByRole("button", { name: "Maintenance team", exact: true })).toContainText(
    "All maintenance teams",
  );
}

async function selectTeams(page: Page, labels: readonly string[]): Promise<void> {
  const listbox = await openTeamListbox(page);
  for (const label of labels) {
    await listbox.getByRole("option", { name: label, exact: true }).click();
  }
  await page.keyboard.press("Escape");
  await expect(listbox).toBeHidden();
}

async function expectUniqueFilteredCards(
  page: Page,
  expectedTeams: readonly string[],
): Promise<void> {
  const cards = page.locator('[data-vorta-shift-handover-card="true"]');
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  const workOrders = (await cards.allTextContents())
    .map((text) => text.match(/WO-\d+/)?.[0] ?? "")
    .filter(Boolean);
  expect(new Set(workOrders).size).toBe(workOrders.length);

  for (const cardText of await cards.allTextContents()) {
    expect(expectedTeams.some((team) => cardText.includes(team))).toBe(true);
  }

  await expect(
    page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first(),
  ).toHaveText(String(count));
}

test("Maintenance team multi-select filters unique Shift Handover work orders", async ({ page }) => {
  test.setTimeout(180_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");
  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();
  await exposeTeamFilter(page);

  const initialListbox = await openTeamListbox(page);
  await expect(initialListbox.getByRole("option", { name: "All maintenance teams", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  for (const team of TEAM_LABELS) {
    await expect(initialListbox.getByRole("option", { name: team, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");

  await selectTeams(page, ["Blue Shift", "Red Shift"]);
  await expect(page.getByRole("button", { name: "Maintenance team", exact: true })).toContainText(
    "Blue Shift + Red Shift",
  );
  if ((page.viewportSize()?.width ?? 1366) < 1024) {
    await expect(page.getByRole("button", { name: "Filters · 1", exact: true })).toBeVisible();
  }
  await expectUniqueFilteredCards(page, ["Blue Shift", "Red Shift"]);

  await clearTeams(page);
  await selectTeams(page, ["Day Shift", "Calibration Team"]);
  await expect(page.getByRole("button", { name: "Maintenance team", exact: true })).toContainText(
    "Day Shift + Calibration Team",
  );
  await expectUniqueFilteredCards(page, ["Day Shift", "Calibration Team"]);

  for (const team of TEAM_LABELS) {
    await clearTeams(page);
    await selectTeams(page, [team]);
    await expect(page.getByRole("button", { name: "Maintenance team", exact: true })).toContainText(team);
    await expectUniqueFilteredCards(page, [team]);
  }

  await clearTeams(page);
  const finalCards = page.locator('[data-vorta-shift-handover-card="true"]');
  await expect(finalCards.first()).toBeVisible();
  await expect(
    page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first(),
  ).toHaveText(String(await finalCards.count()));
});
