import { expect, test, type Page } from "@playwright/test";

const email = process.env.VORTA_E2E_EMAIL ?? "demo@vorta.network";
const password = process.env.VORTA_E2E_PASSWORD ?? "";

async function signIn(page: Page): Promise<void> {
  expect(password, "VORTA_E2E_PASSWORD must be configured").not.toBe("");
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
}

async function expectNoPageOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `${label} must not overflow the phone viewport`).toBeLessThanOrEqual(2);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone-360", "Mobile workforce composition is phone-only");
  await signIn(page);
});

test("mobile Engineers uses verified rota evidence and semantic engineer actions", async ({ page }) => {
  await page.goto("/engineers");

  const mobilePage = page.locator('[data-vorta-mobile-engineers="true"]');
  await expect(mobilePage).toBeVisible();
  await expect(page.getByRole("heading", { name: "Engineers", exact: true })).toBeVisible();
  await expect(page.getByText("Verified shift cover", { exact: true })).toBeVisible();
  await expect(page.getByText("At-Risk Shifts This Month", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Training Conflicts", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Contractor Cover Required", { exact: true })).toHaveCount(0);

  const reviewEngineer = page.getByRole("button", { name: /^Review .+/ }).first();
  await expect(reviewEngineer).toBeVisible();
  await reviewEngineer.focus();
  await expect(reviewEngineer).toBeFocused();
  await reviewEngineer.click();
  await expect(page.getByRole("dialog", { name: "Detail panel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open shift cover", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  await expectNoPageOverflow(page, "Mobile Engineers");
});

test("mobile Requirements uses risk cards and a contained filter workflow", async ({ page }) => {
  await page.goto("/requirements");

  const mobilePage = page.locator('[data-vorta-mobile-requirements="true"]');
  await expect(mobilePage).toBeVisible();
  await expect(page.getByRole("heading", { name: "Requirements", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Requirement filters", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Critical", exact: true }).click();
  await page.getByRole("button", { name: /Show \d+/ }).click();

  const requirement = page.getByRole("button", { name: /^Review .+/ }).first();
  if (await requirement.isVisible()) {
    await requirement.click();
    await expect(page.getByRole("button", { name: "Open AI Matching", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }

  await expectNoPageOverflow(page, "Mobile Requirements");
});

test("mobile Training separates priorities, plan and courses without desktop registers", async ({ page }) => {
  await page.goto("/training");

  const mobilePage = page.locator('[data-vorta-mobile-training="true"]');
  await expect(mobilePage).toBeVisible();
  await expect(page.getByRole("heading", { name: "Training Plan", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Training mobile sections" })).toBeVisible();

  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Current training plan", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Courses", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Recommended courses", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Training", exact: true })).toHaveCount(0);

  await expectNoPageOverflow(page, "Mobile Training");
});
