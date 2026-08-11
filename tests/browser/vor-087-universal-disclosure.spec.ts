import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const hasAuthenticatedTestUser = Boolean(process.env.VORTA_E2E_PASSWORD);

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
  missingData: [],
  confidence: 91,
  intentLabel: "spares_risk_assessment",
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

async function openAskVorta(page: Page): Promise<Locator> {
  const panel = page.locator('[data-vorta-global-ai-panel="true"]');
  const workspace = page.locator('[data-vorta-ai-workspace="true"]');
  const sharedLauncher = page.locator('[data-vorta-shared-mobile-ai-launcher="true"]');

  if (await sharedLauncher.isVisible()) {
    await sharedLauncher.evaluate((element: HTMLButtonElement) => element.click());
    await expect(panel).toBeVisible();
    return panel;
  }

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("vorta-global-ai-prompt"));
  });

  const expand = page.locator('[data-vorta-global-ai-expand="true"]');
  await expect
    .poll(async () => (await workspace.isVisible()) || (await expand.isVisible()) || (await panel.isVisible()))
    .toBe(true);

  if (await workspace.isVisible()) return workspace;
  if (await expand.isVisible()) {
    await expand.evaluate((element: HTMLButtonElement) => element.click());
    await expect(workspace).toBeVisible();
    return workspace;
  }

  await expect(panel).toBeVisible();
  return panel;
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

test.describe("VOR-087 universal Ask Vorta progressive disclosure", () => {
  test.skip(
    !hasAuthenticatedTestUser,
    "VOR-087 requires the protected Maintenance Manager test account.",
  );

  test("uses one decision-first hierarchy on every responsive project", async ({ page }, testInfo) => {
    await mockAskVorta(page);
    await signInMaintenanceManager(page);
    await page.goto("/dashboard");
    const scope = await openAskVorta(page);
    await submitGenericQuestion(page, scope);

    await expect(page.locator('[data-vorta-ai-live-evidence-activity="true"]')).toBeVisible();
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
    await expect(evidence).toBeVisible();
    await expect(scope.getByText(answer.evidence[0], { exact: true })).toBeHidden();
    await evidence.locator("summary").click();
    await expect(scope.getByText(answer.evidence[0], { exact: true })).toBeVisible();

    const actions = scope.getByText("Recommended actions", { exact: true });
    await expect(actions).toBeVisible();
    await expect(scope.getByText(answer.recommendedActions[0], { exact: true })).toBeHidden();
    await actions.locator("xpath=ancestor::summary").click();
    await expect(scope.getByText(answer.recommendedActions[0], { exact: true })).toBeVisible();

    await expect(scope.getByRole("button", { name: "Open Stores Inventory", exact: true })).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath(`vor-087-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });
});