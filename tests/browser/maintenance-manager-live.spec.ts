import { expect, test, type Page } from "@playwright/test";

const email = process.env.VORTA_E2E_EMAIL ?? "demo@vorta.network";
const password = process.env.VORTA_E2E_PASSWORD ?? "";
const allowedSiteId =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000001";
const deniedEquipmentId =
  process.env.VORTA_E2E_DENIED_EQUIPMENT_ID ??
  "40000000-0000-0000-0000-000000000013";

async function signIn(page: Page): Promise<void> {
  expect(password, "VORTA_E2E_PASSWORD must be configured").not.toBe("");
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
}

async function openLiveEquipment(page: Page): Promise<string> {
  await page.goto("/equipment");
  const liveList = page.locator('[data-vorta-live-equipment-list="true"]');
  await expect(liveList).toBeVisible();
  await expect(liveList).toHaveAttribute("data-vorta-active-site", allowedSiteId);
  await expect(page.getByText("ACTIVE-SITE VERIFIED", { exact: true })).toBeVisible();
  const openButton = page.getByRole("button", { name: "Open verified equipment" }).first();
  await expect(openButton).toBeVisible();
  await openButton.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview$/);
  const match = page.url().match(/\/equipment\/([^/]+)\/overview$/);
  expect(match).not.toBeNull();
  return match?.[1] ?? "";
}

test("live Equipment routes remain active-site scoped and preserve Ask Vorta", async ({ page }) => {
  await signIn(page);
  const equipmentId = await openLiveEquipment(page);

  await expect(page.getByText("LIVE SITE EVIDENCE", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/No demonstration values|No legacy demonstration record/)).toHaveCount(0);

  const sections = page.locator('[aria-label="Equipment sections"]');
  await sections.getByRole("button", { name: "Work Orders", exact: true }).click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/work-orders$`));
  await expect(page.getByRole("heading", { name: "Work Orders", exact: true })).toBeVisible();

  await sections.getByRole("button", { name: "Skills & Engineers", exact: true }).click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/skills$`));
  await expect(page.getByRole("heading", { name: "Skills & Engineers", exact: true })).toBeVisible();

  await sections.getByRole("button", { name: "Spares", exact: true }).click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/spares$`));
  await expect(page.getByRole("heading", { name: "Spares", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ask Vorta", exact: true }).click();
  const closeAssistant = page.getByRole("button", { name: "Close global assistant" });
  await expect(closeAssistant).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/equipment/${equipmentId}/spares$`));
  await closeAssistant.click();
  await expect(closeAssistant).toBeHidden();

  await sections.getByRole("button", { name: "AI Insights", exact: true }).click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/overview$`));
  await expect(page.getByRole("button", { name: "Close global assistant" })).toBeVisible();
});

test("a direct Equipment URL for another site fails closed", async ({ page }) => {
  await signIn(page);
  await page.goto(`/equipment/${deniedEquipmentId}/overview`);
  await expect(
    page.getByRole("heading", { name: "Equipment not available for this site" }),
  ).toBeVisible();
  await expect(page.getByText(/does not belong to the authorised active site/i)).toBeVisible();
  await expect(page.getByText("LIVE SITE EVIDENCE", { exact: true })).toHaveCount(0);
});

test("live Spares distinguishes empty inventory and service failure from 100 percent", async ({ page }) => {
  await signIn(page);
  const equipmentId = await openLiveEquipment(page);
  const componentsPattern = /\/rest\/v1\/equipment_components\?/;

  await page.route(componentsPattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
      headers: { "content-range": "0-0/0" },
    });
  });
  await page.goto(`/equipment/${equipmentId}/spares`);
  await expect(page.getByText("No configured evidence", { exact: true })).toBeVisible();
  await expect(page.getByText(/Stock resilience is unavailable, not 100%/i)).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toHaveCount(0);

  await page.unroute(componentsPattern);
  await page.route(componentsPattern, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "simulated component service failure" }),
    });
  });
  await page.reload();
  await expect(page.getByText("Live evidence unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText(/component inventory could not be loaded/i)).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toHaveCount(0);
});
