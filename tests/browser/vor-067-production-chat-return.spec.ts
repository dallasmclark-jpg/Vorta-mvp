import { expect, test } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const productionBaseUrl = process.env.VORTA_E2E_BASE_URL ?? "";
const isProduction = /^https:\/\/vorta-app\.netlify\.app\/?$/i.test(
  productionBaseUrl,
);
const question = "Vial filling sensor fault";
const equipmentId = "40000000-0000-0000-0000-000000000007";
const guideId = "dbd95c1f-08ab-4224-a0dc-ba50651150e8";

test("VOR-067 production Ask Vorta keeps one global Back to chat journey for every internal destination", async ({
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
  test.setTimeout(240_000);

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
  const activeQuestion = assistant
    .locator(".justify-end p")
    .filter({ hasText: question })
    .first();

  await expect(assistant).toBeVisible({ timeout: 30_000 });
  await expect(activeQuestion).toBeVisible({ timeout: 30_000 });

  // First use a real Ask Vorta evidence button. All evidence record types use
  // this same governed renderer, so the return behavior must not know or care
  // whether its destination is a document, work order, spare or another record.
  const guideLink = assistant
    .locator('[data-vorta-ai-evidence-links="true"]')
    .getByRole("button", {
      name: /VF-02 Reject Station Fault-Finding Guide/i,
    })
    .first();
  await expect(guideLink).toBeVisible({ timeout: 90_000 });
  await guideLink.click();

  await page.waitForURL(
    (url) => url.pathname === `/equipment/${equipmentId}/documents/${guideId}`,
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("button", {
      name: "Back to Ask Vorta chat",
      exact: true,
    }),
  ).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", {
    name: "Back to Ask Vorta chat",
    exact: true,
  }).click();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 30_000 });
  await expect(assistant).toBeVisible({ timeout: 30_000 });
  await expect(activeQuestion).toBeVisible({ timeout: 30_000 });

  // Then prove the application shell catches arbitrary same-origin links in the
  // live chat before navigation. These representative destinations deliberately
  // cross different Vorta record/page types; no route-specific return code exists.
  const destinations = [
    `/equipment/${equipmentId}/work-orders`,
    `/equipment/${equipmentId}/spares`,
    "/stores-inventory",
    "/skills-matrix",
    "/engineers",
  ];

  for (const [index, destination] of destinations.entries()) {
    await expect(assistant).toBeVisible({ timeout: 30_000 });
    await expect(activeQuestion).toBeVisible({ timeout: 30_000 });

    await page.evaluate((path) => {
      const surfaces = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-vorta-global-ai-panel="true"], [data-vorta-ai-workspace="true"]',
        ),
      );
      const surface = surfaces.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!surface) throw new Error("Visible Ask Vorta surface was not found.");

      const link = document.createElement("a");
      link.href = path;
      link.textContent = `VOR-067 verify ${path}`;
      surface.appendChild(link);
      link.click();
    }, destination);

    await page.waitForURL((url) => url.pathname === destination, {
      timeout: 30_000,
    });

    const backToChat = page.getByRole("button", {
      name: "Back to Ask Vorta chat",
      exact: true,
    });
    await expect(backToChat).toBeVisible({ timeout: 30_000 });

    // A hard refresh on a deep work-order route must not make the global return
    // control disappear. There is no query parameter to preserve or reconstruct.
    if (index === 0) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(backToChat).toBeVisible({ timeout: 30_000 });
    }

    await backToChat.click();
    await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 30_000 });
    await expect(assistant).toBeVisible({ timeout: 30_000 });
    await expect(activeQuestion).toBeVisible({ timeout: 30_000 });
  }
});
