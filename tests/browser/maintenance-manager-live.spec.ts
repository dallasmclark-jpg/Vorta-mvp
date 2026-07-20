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

async function expectNoPageOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "The live portal must not overflow the viewport").toBeLessThanOrEqual(2);
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

test("live Equipment routes remain active-site scoped and expose verified History and Documents", async ({
  page,
}) => {
  await signIn(page);
  const equipmentId = await openLiveEquipment(page);

  await expect(page.getByText("LIVE SITE EVIDENCE", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/No demonstration values|No legacy demonstration record/)).toHaveCount(0);

  const sections = page.locator('[aria-label="Equipment sections"]');
  const historyTab = sections.getByRole("button", { name: "History", exact: true });
  const documentsTab = sections.getByRole("button", { name: "Documents", exact: true });
  await expect(historyTab).toBeEnabled();
  await expect(documentsTab).toBeEnabled();

  const navigationAskVorta = sections.getByRole("button", {
    name: "Ask Vorta",
    exact: true,
  });
  await expect(navigationAskVorta).toBeVisible();

  await sections.getByRole("button", { name: "Work Orders", exact: true }).click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/work-orders$`));
  await expect(page.getByRole("heading", { name: "Work Orders", exact: true })).toBeVisible();
  await expect(page.getByText("Execution readiness", { exact: true }).first()).toBeVisible();

  await historyTab.click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/history$`));
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  await expect(page.getByText("Work records", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmations", { exact: true }).first()).toBeVisible();

  await documentsTab.click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/documents$`));
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  await expect(page.getByText("Available documents", { exact: true })).toBeVisible();
  const openDocument = page.getByRole("button", { name: "Open controlled document" }).first();
  await expect(openDocument).toBeVisible();
  await openDocument.click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/documents/[^/]+$`));
  await expect(page.getByRole("button", { name: "Back to documents", exact: true })).toBeVisible();
  await expect(page.getByText(/Source:/).first()).toBeVisible();

  await page.getByRole("button", { name: "Back to documents", exact: true }).click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/documents$`));

  await sections.getByRole("button", { name: "Skills & Engineers", exact: true }).click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/skills$`));
  await expect(page.getByRole("heading", { name: "Skills & Engineers", exact: true })).toBeVisible();

  await sections.getByRole("button", { name: "Spares", exact: true }).click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/spares$`));
  await expect(page.getByRole("heading", { name: "Spares", exact: true })).toBeVisible();

  const pageAskVorta = page
    .getByRole("button", { name: "Ask Vorta", exact: true })
    .first();
  await pageAskVorta.click();
  const closeAssistant = page.getByRole("button", { name: "Close global assistant" });
  await expect(closeAssistant).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/equipment/${equipmentId}/spares$`));
  await closeAssistant.click();
  await expect(closeAssistant).toBeHidden();

  await navigationAskVorta.click();
  await page.waitForURL(new RegExp(`/equipment/${equipmentId}/overview$`));
  await expect(page.getByRole("button", { name: "Close global assistant" })).toBeVisible();
  await expectNoPageOverflow(page);
});

test("live Work Orders show unavailable readiness instead of perfect readiness after a source failure", async ({
  page,
}) => {
  await signIn(page);
  const equipmentId = await openLiveEquipment(page);

  await page.route(/\/rest\/v1\/rpc\/vorta_get_equipment_work_items/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "simulated work-order reader failure" }),
    });
  });

  await page.goto(`/equipment/${equipmentId}/work-orders`);
  await expect(page.getByText("Live evidence unavailable", { exact: true }).first()).toBeVisible();
  const readinessCard = page
    .getByText("Execution readiness", { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(readinessCard).toContainText("—");
  await expect(readinessCard).not.toContainText("100%");
  await expect(page.getByText(/Work-order evidence unavailable|Work source unavailable/).first()).toBeVisible();
});

test("rejected live History evidence resolves to an unavailable state instead of spinning forever", async ({
  page,
}) => {
  await signIn(page);
  const equipmentId = await openLiveEquipment(page);

  await page.route(/\/rest\/v1\/rpc\/vorta_get_equipment_history/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "simulated history reader failure" }),
    });
  });

  await page.goto(`/equipment/${equipmentId}/history`);
  await expect(page.getByText("Live evidence unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText(/Equipment history could not be loaded/i)).toBeVisible();
  await expect(page.getByText("Loading verified maintenance history…", { exact: true })).toHaveCount(0);
});

test("live Shift Cover adapts to the viewport and reports genuine completeness", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/maintenance/labour-risk/shift-cover");

  await expect(page.getByRole("heading", { name: "Shift Cover Risk", exact: true })).toBeVisible();
  await expect(page.getByText("LIVE ROTA", { exact: true })).toBeVisible();

  const completenessCard = page
    .getByText("Rota completeness", { exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(completenessCard).toContainText(/\d+%/);
  await expect(completenessCard).toContainText(/\d+\/\d+ shifts assigned and staffed/);

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  if (viewportWidth < 1024) {
    await expect(page.locator('[data-vorta-mobile-rota="true"]')).toBeVisible();
    await expect(page.locator('[data-vorta-desktop-rota="true"]')).toBeHidden();
    const nextDay = page.getByRole("button", { name: "Next day", exact: true });
    await expect(nextDay).toBeVisible();
    if (await nextDay.isEnabled()) await nextDay.click();
  } else {
    await expect(page.locator('[data-vorta-desktop-rota="true"]')).toBeVisible();
    await expect(page.locator('[data-vorta-mobile-rota="true"]')).toBeHidden();
  }

  if (viewportWidth >= 1360) {
    const equipmentLabel = page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByText("Equipment", { exact: true });
    await expect(equipmentLabel).toBeVisible();
  }

  await expectNoPageOverflow(page);
});

test("malformed live Shift Cover evidence fails closed instead of becoming zero risk", async ({
  page,
}) => {
  await signIn(page);

  await page.route(
    /\/rest\/v1\/rpc\/vorta_get_shift_cover_snapshot/,
    async (route) => {
      const today = new Date();
      const day = today.getUTCDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      today.setUTCDate(today.getUTCDate() + mondayOffset);
      const shiftDate = today.toISOString().slice(0, 10);
      const timestamp = new Date().toISOString();

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "live",
          siteId: allowedSiteId,
          generatedAt: timestamp,
          sourceUpdatedAt: timestamp,
          calendar: [
            {
              shiftDate,
              shiftType: "day",
              teamNames: ["Shift A"],
              engineerNames: ["Test Engineer"],
              scheduledEngineerCount: 1,
              contractorEngineerCount: 0,
              labourRiskScore: "not-a-number",
              labourRiskLevel: "Low",
              coverageStatus: "covered",
              equipmentWithMissingCover: 0,
              missingSkillCount: 0,
            },
          ],
          teams: [],
          completeness: {
            activeTeamCount: 1,
            activeMemberCount: 1,
            engineerCount: 1,
            skillRecordCount: 1,
          },
        }),
      });
    },
  );

  await page.goto("/maintenance/labour-risk/shift-cover");
  await expect(
    page.getByText("Verified Shift Cover data is unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/labourRiskScore must be finite/i)).toBeVisible();
  await expect(page.getByText("0.0", { exact: true })).toHaveCount(0);
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

test("live Spares distinguishes empty inventory and service failure from 100 percent", async ({
  page,
}) => {
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
