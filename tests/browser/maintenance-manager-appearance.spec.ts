import { expect, test, type Page } from "@playwright/test";

const email = process.env.VORTA_E2E_EMAIL ?? "demo@vorta.network";
const password = process.env.VORTA_E2E_PASSWORD ?? "";

async function signIn(page: Page): Promise<void> {
  expect(password, "VORTA_E2E_PASSWORD must be configured").not.toBe("");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.removeItem("vorta:appearance"));
  await page.reload();
  await signIn(page);
});

test("appearance control switches theme and persists the chosen mode", async ({ page }) => {
  const root = page.locator("html");
  const trigger = page.getByRole("button", { name: "Appearance: Dark", exact: true });

  await expect(trigger).toBeVisible();
  await expect(root).toHaveClass(/dark/);

  await trigger.click();
  await page.getByRole("menuitemradio", { name: /^Light/ }).click();

  await expect(root).toHaveClass(/light/);
  await expect(page.getByRole("button", { name: "Appearance: Light", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("vorta:appearance"))).toBe("light");

  await page.reload();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
  await expect(root).toHaveClass(/light/);
  await expect(page.getByRole("button", { name: "Appearance: Light", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Appearance: Light", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /^System/ }).click();

  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("vorta:appearance"))).toBe("system");
  await expect(root).toHaveAttribute("data-theme-preference", "system");
});
