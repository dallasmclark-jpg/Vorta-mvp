import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(2);
}

test.describe("self-service site onboarding public boundary", () => {
  test("login Sign up entry point opens the customer site activation flow", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#vorta-signup-tab").click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(
      page.getByRole("heading", { name: "Set up your Vorta account" }),
    ).toBeVisible();
  });

  test("signup form exposes the required organisation, site and owner fields", async ({
    page,
  }) => {
    await page.goto("/signup");

    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByLabel("Company name")).toBeVisible();
    await expect(page.getByLabel("Industry")).toBeVisible();
    await expect(page.getByLabel("Country")).toBeVisible();
    await expect(page.getByLabel("Site name")).toBeVisible();
    await expect(page.getByLabel("Location")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Create Vorta site" }),
    ).toBeDisabled();

    await expectNoHorizontalOverflow(page);
  });

  test("unauthenticated users cannot open People & Access", async ({ page }) => {
    await page.goto("/admin/site");
    await page.waitForURL(/\/$/);

    await expect(
      page.getByRole("heading", { name: "Log in to your account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "People & access" }),
    ).toHaveCount(0);
  });
});
