import { expect, test, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const siteId =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000001";
const organisationId =
  process.env.VORTA_E2E_ORGANISATION_ID ??
  "10000000-0000-0000-0000-000000000001";

function previewPayload({
  includePreview = true,
  assets = [
    {
      equipmentId: "asset-1",
      equipmentCode: "VF-02",
      equipmentName: "Bosch Vial Filler",
      area: "Fill Finish",
      line: "Vial Line 2",
      criticality: "Critical",
      status: "Moderate",
      assetCompetenceScore: 72,
      minimumQualified: 2,
      requiredSkillCount: 4,
      pmTaskCount: 5,
      calibrationTaskCount: 2,
      pmEvidenceCoverage: 5,
      engineers: [
        {
          engineerId: "engineer-1",
          engineerName: "Preview Engineer",
          discipline: "Mechanical",
          assetCompetenceScore: 74,
          status: "Moderate",
          requirementFitScore: 80,
          explicitCapabilityLevel: 4,
          pmExperienceScore: 3,
          pmTaskCount: 5,
          pmTasksWithEvidence: 1,
          confirmedPmCount: 3,
          lastPmCompletedAt: "2020-01-01",
          recencyStatus: "stale",
        },
      ],
    },
  ],
}: {
  includePreview?: boolean;
  assets?: unknown[];
} = {}) {
  const overall = {
    id: "overall",
    code: "OVERALL",
    name: "Site Capability",
    memberCount: 2,
    score: 81,
    status: "Moderate",
    previewOnly: true,
    scoreAuthority: "current-capability-v3",
    scoreModel: "core-asset-preview-v1",
    coreCapabilityScore: 76,
    assetCompetenceScore: 68,
    proposedSkillsReadinessScore: 71,
    pmExperienceCoverage: assets.length > 0 ? 5 : 0,
    pmEvidenceCount: assets.length > 0 ? 3 : 0,
    assetsAssessed: assets.length,
    coreEngineersAssessed: 2,
  };

  return {
    siteId,
    organisationId,
    generatedAt: new Date().toISOString(),
    sourceUpdatedAt: new Date().toISOString(),
    site: { id: siteId, name: "Wrexham Sterile Fill-Finish" },
    overall,
    teams: [],
    departments: [],
    areaSkills: {},
    details: {
      overall: includePreview
        ? {
            capabilityPreview: {
              modelStatus: "preview",
              scoreModel: "core-asset-preview-v1",
              explanation: "Comparison-only evidence model",
              coreCapability: {
                score: 76,
                engineersAssessed: 2,
                engineers: [
                  {
                    engineerId: "engineer-1",
                    engineerName: "Preview Engineer",
                    score: 78,
                    assessedSkillCount: 5,
                  },
                ],
              },
              assetCompetence: {
                score: 68,
                pmExperienceCoverage: assets.length > 0 ? 5 : 0,
                pmEvidenceCount: assets.length > 0 ? 3 : 0,
                assets,
              },
            },
          }
        : {},
    },
  };
}

async function mockSkillsPreview(page: Page, body: unknown): Promise<void> {
  await page.route(/\/functions\/v1\/skills-matrix-data/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("enabled Core and Asset Skills Matrix works across responsive viewports", async ({
  page,
}, testInfo) => {
  await signInMaintenanceManager(page);

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/functions/v1/skills-matrix-data") &&
      response.request().method() === "POST",
  );
  await page.goto("/skills-matrix");

  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.details?.[body.overall?.id]?.capabilityPreview?.modelStatus).toBe(
    "preview",
  );
  expect(body.overall?.proposedSkillsReadinessScore).toBeCloseTo(
    body.overall?.coreCapabilityScore * 0.4 +
      body.overall?.assetCompetenceScore * 0.6,
    0,
  );

  await expect(
    page.getByRole("heading", { name: "Skills Matrix", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Core + Asset Preview", { exact: true })).toBeVisible();
  await expect(page.getByText("Comparison model only", { exact: true })).toBeVisible();
  await expect(page.getByText("Skills Readiness", { exact: true })).toBeVisible();
  await expect(page.getByText("Core Capability", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Asset Competence", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("Full engineer-task evidence saturation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Historical SAP evidence audit", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/must not be read as .* competent/i),
  ).toBeVisible();

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  const assetButtons = page.locator("button").filter({ hasText: /\d+ PMs/ });
  await expect.poll(() => assetButtons.count()).toBeGreaterThan(0);
  const assetButtonCount = await assetButtons.count();
  const selectedAssetButton = assetButtons.nth(assetButtonCount > 1 ? 1 : 0);
  await selectedAssetButton.click();

  if (viewportWidth < 1280) {
    await expect(
      page.getByRole("button", { name: "Back to assets", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-vorta-mobile-asset-list]")).toBeHidden();
    await expect(page.locator("[data-vorta-mobile-asset-detail]")).toBeVisible();
    await expect(
      page.getByPlaceholder("Search equipment, code or area"),
    ).toBeHidden();
    await page
      .getByRole("button", { name: "Back to assets", exact: true })
      .click();
    await expect(page.locator("[data-vorta-mobile-asset-list]")).toBeVisible();
  } else {
    await expect(selectedAssetButton).toHaveClass(/border-blue-500/);
  }

  await expect(page.getByText("PM score capped at 5", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Historical PM evidence is read-only", { exact: false }),
  ).toBeVisible();

  const assetSearch = page.getByPlaceholder("Search equipment, code or area");
  await expect(assetSearch).toBeVisible();
  await assetSearch.fill("no-equipment-should-match-this-value");
  await expect(
    page.getByText("No asset matches the current search.", { exact: true }),
  ).toBeVisible();
  await assetSearch.clear();
  await expect(
    page.getByText("No asset matches the current search.", { exact: true }),
  ).toHaveCount(0);

  const scopeSelect = page.getByLabel("Select workforce scope", { exact: true });
  await expect(scopeSelect).toBeVisible();
  const options = scopeSelect.locator("option");
  await expect.poll(() => options.count()).toBeGreaterThan(1);
  const nextScopeValue = await options.nth(1).getAttribute("value");
  expect(nextScopeValue).not.toBeNull();
  await scopeSelect.selectOption(nextScopeValue ?? "");
  await expect(scopeSelect).toHaveValue(nextScopeValue ?? "");

  if (viewportWidth <= 420) {
    const previewSection = page.locator("[data-vorta-skills-preview]");
    const paddingBottom = await previewSection.evaluate((element) =>
      Number.parseFloat(window.getComputedStyle(element).paddingBottom),
    );
    expect(
      paddingBottom,
      "Mobile preview needs clearance above the fixed Ask Vorta control",
    ).toBeGreaterThanOrEqual(120);

    const footer = page.locator("[data-vorta-skills-preview-footer]");
    await footer.scrollIntoViewIfNeeded();
    const aiButton = page.getByRole("button", {
      name: "Ask Vorta AI",
      exact: true,
    });
    if (await aiButton.isVisible()) {
      const [footerBox, aiBox] = await Promise.all([
        footer.boundingBox(),
        aiButton.boundingBox(),
      ]);
      expect(footerBox).not.toBeNull();
      expect(aiBox).not.toBeNull();
      const overlaps =
        Boolean(footerBox && aiBox) &&
        footerBox!.x < aiBox!.x + aiBox!.width &&
        footerBox!.x + footerBox!.width > aiBox!.x &&
        footerBox!.y < aiBox!.y + aiBox!.height &&
        footerBox!.y + footerBox!.height > aiBox!.y;
      expect(
        overlaps,
        "The fixed Ask Vorta control must not obscure the final evidence notice",
      ).toBe(false);
    }
  }

  await expectNoPageOverflow(page);
  await testInfo.attach(`core-asset-preview-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("enabled preview fails closed when comparison evidence is missing", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1920",
    "Missing-evidence state is exercised once per workflow",
  );
  await signInMaintenanceManager(page);
  await mockSkillsPreview(page, previewPayload({ includePreview: false }));
  await page.goto("/skills-matrix");
  await expect(
    page.getByRole("heading", {
      name: "Skills preview could not be loaded",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/preview data is unavailable/i)).toBeVisible();
});

test("enabled preview shows an honest empty asset-evidence state", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1920",
    "Empty-evidence state is exercised once per workflow",
  );
  await signInMaintenanceManager(page);
  await mockSkillsPreview(page, previewPayload({ assets: [] }));
  await page.goto("/skills-matrix");
  await expect(
    page.getByText("No asset matches the current search.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Select an asset to inspect competence evidence.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("enabled preview marks sparse and stale PM evidence without hiding history", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-1920",
    "Sparse and stale evidence are exercised once per workflow",
  );
  await signInMaintenanceManager(page);
  await mockSkillsPreview(page, previewPayload());
  await page.goto("/skills-matrix");

  await expect(
    page.getByText(
      "Sparse linked history is an evidence-quality warning, not proof that engineers lack competence on this asset.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Strict denominator: 10 possible engineer-PM pairs.", {
      exact: false,
    }),
  ).toBeVisible();

  const staleDate = page.getByText("01 Jan 2020", { exact: true });
  await expect(staleDate).toBeVisible();
  await expect(staleDate).toHaveClass(/text-red-400/);
  await expect(page.getByText("3.0 / 5", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true }).last()).toBeVisible();
});
