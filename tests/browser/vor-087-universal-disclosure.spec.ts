import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const hasAuthenticatedTestUser = Boolean(process.env.VORTA_E2E_PASSWORD);
const isPhone = (projectName: string): boolean => projectName === "phone-360";
const isPortraitTablet = (projectName: string): boolean =>
  projectName === "samsung-tablet-portrait";

const answer = {
  responseId: "vor-087-universal-disclosure",
  directAnswer:
    "There are 25 spares risks across 8 assets: 8 out of stock and 17 low stock. RABS-01 has the highest-priority shortage.",
  decisionSummary: [
    {
      label: "Highest priority",
      value: "RABS-01 has a critical SIMATIC input module out of stock with a 90-day lead time.",
    },
    {
      label: "Next priority",
      value: "FD-03 has a critical digital input module out of stock.",
    },
    {
      label: "Third priority",
      value: "DH-01 has a critical digital input module out of stock.",
    },
  ],
  evidence: [
    "Checked equipment components for eight assets.",
    "RABS-01 stock is 0 against a minimum of 1.",
  ],
  findings: [],
  coverOptions: [],
  recommendedActions: [
    "Expedite the RABS-01 critical module and verify open work dependencies.",
    "Review the next two shortages before shift handover.",
  ],
  actionPlan: [],
  followUpQuestions: [],
  sources: ["equipment_components", "Equipment risk list"],
  missingData: [
    "Conversational reasoning is temporarily unavailable; this is the verified Vorta fallback response.",
  ],
  confidence: 91,
  intentLabel: "spares_risk_assessment",
  roleNote: "Manager note: this supports prioritisation and action ownership using available Vorta evidence.",
  toolsUsed: ["get_spares_priority"],
  evidenceLinks: [
    {
      label: "Open Stores Inventory",
      path: "/stores-inventory",
      recordType: "spare",
    },
  ],
  evidenceGeneratedAt: "2026-08-11T07:00:00.000Z",
};

async function mockAskVorta(page: Page): Promise<void> {
  await page.route("**/api/ask-vorta", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 550));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(answer),
    });
  });
}

async function openAskVorta(page: Page, projectName: string): Promise<Locator> {
  const panel = page.locator('[data-vorta-global-ai-panel="true"]');
  const workspace = page.locator('[data-vorta-ai-workspace="true"]');

  if (isPhone(projectName)) {
    const sharedLauncher = page.locator('[data-vorta-shared-mobile-ai-launcher="true"]');
    await expect(sharedLauncher).toBeVisible();
    await sharedLauncher.evaluate((element: HTMLButtonElement) => element.click());
    await expect(panel).toBeVisible();
    return panel;
  }

  if (isPortraitTablet(projectName)) {
    const portraitLauncher = page.getByRole("button", {
      name: "Ask Vorta AI",
      exact: true,
    });
    await expect(portraitLauncher).toBeVisible();
    await portraitLauncher.click();
    await expect(workspace).toBeVisible();
    return workspace;
  }

  const readinessControl = page.getByRole("button", {
    name: "Ask",
    exact: true,
  });
  await expect(readinessControl).toBeVisible();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("vorta-global-ai-prompt"));
  });

  const expand = page.locator('[data-vorta-global-ai-expand="true"]');
  await expect
    .poll(async () => (await workspace.isVisible()) || (await expand.isVisible()))
    .toBe(true);

  if (!(await workspace.isVisible()) && (await expand.isVisible())) {
    await expand.click();
  }
  await expect(workspace).toBeVisible();
  return workspace;
}

async function submitGenericQuestion(page: Page, scope: Locator): Promise<void> {
  const question = "Which spares risks need attention?";
  const compactInput = page.locator('[data-vorta-global-ai-input="true"]');

  if (await compactInput.isVisible()) {
    await compactInput.fill(question);
    await page.locator('[data-vorta-global-ai-send="true"]').click();
    return;
  }

  const input = page.locator('[data-vorta-ai-workspace-input="true"]');
  await input.fill(question);
  await scope.getByRole("button", { name: "Send", exact: true }).click();
}

async function expectAllHidden(locator: Locator): Promise<void> {
  const count = await locator.count();
  expect(count).toBeGreaterThan(0);
  await expect
    .poll(async () => locator.evaluateAll((elements) =>
      elements.every((element) => element.getClientRects().length === 0),
    ))
    .toBe(true);
}

test.describe("VOR-087 universal Ask Vorta progressive disclosure", () => {
  test.skip(
    !hasAuthenticatedTestUser,
    "VOR-087 requires the protected Maintenance Manager test account.",
  );

  test("uses the image-standard live status and concise decision-first answer on every responsive project", async ({ page }, testInfo) => {
    await mockAskVorta(page);
    await signInMaintenanceManager(page);
    await page.goto("/dashboard");
    const scope = await openAskVorta(page, testInfo.project.name);
    await submitGenericQuestion(page, scope);

    const liveStatus = page.locator(
      '[data-vorta-ai-live-evidence-activity="true"][data-vorta-ai-single-status="true"]',
    );
    await expect(liveStatus).toBeVisible();
    await expect(liveStatus.locator('[data-vorta-ai-single-status-label="true"]')).toBeVisible();
    await expect(page.getByText(/\d+\/\d+ checked/i)).toHaveCount(0);
    await expect(liveStatus.locator("[aria-label='Live Vorta evidence checks']")).toHaveCount(0);

    const liveStatusBox = await liveStatus.boundingBox();
    expect(liveStatusBox?.height).toBeGreaterThanOrEqual(42);
    expect(liveStatusBox?.height).toBeLessThanOrEqual(46);

    await expect(page.getByText(answer.directAnswer, { exact: true })).toBeVisible();
    await expect(page.getByText("Direct answer", { exact: true })).toHaveCount(0);

    await expect(scope.locator('[data-vorta-ai-primary-priority="true"]')).toBeVisible();
    await expect(scope.getByText("Highest priority", { exact: true })).toBeVisible();

    const nextPriorities = scope.locator('[data-vorta-ai-next-priorities="true"]');
    await expect(nextPriorities).toBeVisible();
    await expect(scope.getByText("Next priority:", { exact: true })).toBeHidden();
    await nextPriorities.locator("summary").click();
    await expect(scope.getByText("Next priority:", { exact: true })).toBeVisible();

    const evidence = scope.locator('[data-vorta-ai-supporting-evidence="true"]');
    await expect(evidence).toBeHidden();
    await expect(scope.getByText(answer.evidence[0], { exact: true })).toBeHidden();

    const actions = scope.getByText("Recommended actions", { exact: true });
    await expect(actions).toBeVisible();
    await expect(scope.getByText(answer.recommendedActions[0], { exact: true })).toBeHidden();
    await actions.locator("xpath=ancestor::summary").click();
    await expect(scope.getByText(answer.recommendedActions[0], { exact: true })).toBeVisible();

    await expectAllHidden(scope.getByText(answer.roleNote, { exact: true }));
    await expectAllHidden(scope.getByText(answer.missingData[0], { exact: true }));
    await expectAllHidden(scope.getByText(/91%.*confidence|Confidence 91%/i));
    await expectAllHidden(scope.getByText("Was this decision pack useful?", { exact: true }));

    const workspaceSourceSummary = page.locator('[data-vorta-ai-workspace-source-summary="true"]');
    if ((await workspaceSourceSummary.count()) > 0) {
      await expectAllHidden(workspaceSourceSummary);
    }

    if (isPhone(testInfo.project.name)) {
      const sourceDisclosure = scope.locator('[data-vorta-ai-source-disclosure="true"]');
      await expect(sourceDisclosure).toBeVisible();
      const label = sourceDisclosure.locator("summary > span").first();
      const generatedLabel = await label.evaluate((element) =>
        getComputedStyle(element, "::after").content,
      );
      expect(generatedLabel).toContain("Evidence & sources");
    }

    await expect(scope.getByRole("button", { name: "Open Stores Inventory", exact: true })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath(`vor-087-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });
});
