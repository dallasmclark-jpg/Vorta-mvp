import { expect, test, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const TEAM_LABELS = [
  "Blue Shift",
  "Red Shift",
  "Green Shift",
  "Yellow Shift",
  "Day Shift",
  "Calibration Team",
] as const;

async function openShiftHandover(page: Page): Promise<void> {
  const root = page.locator('[data-vorta-shift-handover="true"]');
  const reviewPeriod = page.getByRole("button", { name: "Review period", exact: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/shift-handover?review=96");
    const ready = await Promise.all([
      root.waitFor({ state: "visible", timeout: 30_000 }),
      reviewPeriod.waitFor({ state: "visible", timeout: 30_000 }),
    ]).then(() => true).catch(() => false);
    if (ready) return;
    await signInMaintenanceManager(page);
  }
  await expect(root).toBeVisible({ timeout: 30_000 });
  await expect(reviewPeriod).toBeVisible({ timeout: 30_000 });
}

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

  const workOrders = await cards.evaluateAll((elements) =>
    elements.map((element) =>
      element.querySelector("span.text-blue-300")?.textContent?.trim() ?? ""
    ),
  );
  expect(workOrders).toHaveLength(count);
  expect(workOrders.every(Boolean)).toBe(true);
  expect(new Set(workOrders).size).toBe(workOrders.length);

  for (const cardText of await cards.allTextContents()) {
    expect(expectedTeams.some((team) => cardText.includes(team))).toBe(true);
  }

  await expect(
    page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first(),
  ).toHaveText(String(count));
}

async function expectEmptyTeamResult(page: Page, team: string): Promise<void> {
  await expect(page.locator('[data-vorta-shift-handover-card="true"]')).toHaveCount(0);
  await expect(page.getByText(
    `No ${team} activity was recorded during the previous 8 shifts.`,
    { exact: true },
  )).toBeVisible();
  await expect(
    page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first(),
  ).toHaveText("0");
}

async function expectTeamResult(page: Page, team: string): Promise<void> {
  const cards = page.locator('[data-vorta-shift-handover-card="true"]');
  const empty = page.getByText(
    `No ${team} activity was recorded during the previous 8 shifts.`,
    { exact: true },
  );

  await expect.poll(async () => {
    const cardTexts = await cards.allTextContents();
    if (cardTexts.length > 0) {
      return cardTexts.every((cardText) => cardText.includes(team));
    }
    return empty.isVisible();
  }, { timeout: 30_000 }).toBe(true);

  if ((await cards.count()) === 0) await expectEmptyTeamResult(page, team);
  else await expectUniqueFilteredCards(page, [team]);
}

test("Maintenance team multi-select filters unique Shift Handover work orders", async ({ page }) => {
  test.setTimeout(300_000);
  await signInMaintenanceManager(page);
  await openShiftHandover(page);

  // The rolling demo refresh can legitimately move activity between teams.
  // Validate whichever truthful state the selected team currently produces.
  await expect(page.getByRole("button", { name: "Review period", exact: true })).toHaveAttribute(
    "data-value",
    "96",
  );
  await expect(page.getByRole("heading", { name: "Activity from the previous 8 shifts", exact: true })).toBeVisible();
  await expect(page.locator('[data-vorta-shift-handover-card="true"]').first()).toBeVisible({ timeout: 30_000 });
  await exposeTeamFilter(page);

  const initialListbox = await openTeamListbox(page);
  await expect(initialListbox).toHaveAttribute("aria-multiselectable", "true");
  await expect(initialListbox.getByRole("option", { name: "All maintenance teams", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  for (const team of TEAM_LABELS) {
    await expect(initialListbox.getByRole("option", { name: team, exact: true })).toBeVisible();
  }
  const viewport = page.viewportSize();
  const listboxBox = await initialListbox.boundingBox();
  expect(listboxBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(listboxBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((listboxBox?.x ?? 0) + (listboxBox?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 1920);
  expect((listboxBox?.y ?? 0) + (listboxBox?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 1080);
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
    await expectTeamResult(page, team);
  }

  await clearTeams(page);
  const finalCards = page.locator('[data-vorta-shift-handover-card="true"]');
  await expect(finalCards.first()).toBeVisible();
  await expect(
    page.locator('[data-vorta-shift-handover-metric="handover-items"] > p').first(),
  ).toHaveText(String(await finalCards.count()));
  await expectNoPageOverflow(page);
});
