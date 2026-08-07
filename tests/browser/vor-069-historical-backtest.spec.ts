import { expect, test } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const BACKTEST_EQUIPMENT_ID = "46a2317f-ec89-4b70-bbcb-ae8624a3e220";

test("VOR-069 historical validation renders governed evidence without responsive overflow", async ({
  page,
}) => {
  await signInMaintenanceManager(page);
  await page.goto(`/equipment/${BACKTEST_EQUIPMENT_ID}/history`);
  await page.waitForURL(`/equipment/${BACKTEST_EQUIPMENT_ID}/history`);

  const panel = page.getByText("Historical risk validation", { exact: true }).first();
  await expect(panel).toBeVisible();
  await panel.scrollIntoViewIfNeeded();

  await expect(page.getByText("Synthetic demo evidence", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Backtest: did Vorta surface risk before later outcomes?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/12 of 12 controlled breakdown cases had elevated Vorta risk beforehand/i),
  ).toBeVisible();
  await expect(page.getByText("Breakdowns warned", { exact: true })).toBeVisible();
  await expect(page.getByText("Median warning", { exact: true })).toBeVisible();
  await expect(page.getByText("Pre-failure stock-outs", { exact: true })).toBeVisible();
  await expect(page.getByText("Recovery impacts", { exact: true })).toBeVisible();
  await expect(page.getByText("Successful interventions", { exact: true })).toBeVisible();
  await expect(page.getByText("False positives", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Preventability is not established from sequence alone/i),
  ).toBeVisible();

  await expect(
    page.getByText("Breakdown with material-constrained recovery", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Fedegari Depyrogenation Oven DO-01/i).first()).toBeVisible();
  await expect(page.getByText(/630 min|10h 30m/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask Vorta about evidence" }).first()).toBeVisible();

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.page).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);
});
