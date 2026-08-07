import { expect, test } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const productionBaseUrl = process.env.VORTA_E2E_BASE_URL ?? "";
const isProduction = /^https:\/\/vorta-app\.netlify\.app\/?$/i.test(
  productionBaseUrl,
);
const question = "Vial filling sensor fault";
const equipmentId = "40000000-0000-0000-0000-000000000007";
const guideId = "dbd95c1f-08ab-4224-a0dc-ba50651150e8";

test("VOR-067 production Ask Vorta document returns to the same chat", async ({
  page,
}, testInfo) => {
  test.skip(
    !isProduction,
    "This gate deliberately verifies the real Netlify production journey after deployment.",
  );
  test.skip(
    testInfo.project.name !== "samsung-tablet-landscape",
    "The production regression is verified once on the Samsung tablet landscape profile that reproduced the defect.",
  );
  test.setTimeout(180_000);

  await signInMaintenanceManager(page);
  await page.goto("/dashboard");
  await page.locator('[data-vorta-dashboard-root="true"]').waitFor();

  await page.evaluate((prompt) => {
    window.dispatchEvent(
      new CustomEvent("vorta-global-ai-prompt", {
        detail: {
          question: prompt,
          submit: true,
          role: "maintenance-manager",
        },
      }),
    );
  }, question);

  const assistant = page
    .locator(
      '[data-vorta-global-ai-panel="true"]:visible, [data-vorta-ai-workspace="true"]:visible',
    )
    .first();
  await expect(assistant).toBeVisible({ timeout: 30_000 });
  await expect(
    assistant.locator(".justify-end p").filter({ hasText: question }).first(),
  ).toBeVisible({ timeout: 30_000 });

  const guideLink = assistant
    .locator('[data-vorta-ai-evidence-links="true"]')
    .getByRole("button", {
      name: /VF-02 Reject Station Fault-Finding Guide/i,
    })
    .first();
  await expect(guideLink).toBeVisible({ timeout: 90_000 });
  await guideLink.click();

  await page.waitForURL(
    (url) =>
      url.pathname === `/equipment/${equipmentId}/documents/${guideId}` &&
      url.searchParams.get("from") === "ai",
    { timeout: 30_000 },
  );
  expect(new URL(page.url()).searchParams.get("from")).toBe("ai");
  await expect(page.getByText("Page 12 of 20", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const backToChat = page.getByRole("button", {
    name: "Back to Ask Vorta chat",
    exact: true,
  });
  await expect(backToChat).toBeVisible({ timeout: 15_000 });
  await backToChat.click();

  await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 30_000 });
  const restoredAssistant = page
    .locator(
      '[data-vorta-global-ai-panel="true"]:visible, [data-vorta-ai-workspace="true"]:visible',
    )
    .first();
  await expect(restoredAssistant).toBeVisible({ timeout: 30_000 });
  await expect(
    restoredAssistant.locator(".justify-end p").filter({ hasText: question }).first(),
  ).toBeVisible({ timeout: 30_000 });
});
