import { expect, test, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const hasAuthenticatedTestUser = Boolean(process.env.VORTA_E2E_PASSWORD);
const isPhoneProject = (projectName: string): boolean =>
  projectName === "phone-360";

const mockedAnswer = {
  responseId: "vor-041-browser-response",
  directAnswer:
    "The current cover picture needs action before the next shift.",
  decisionSummary: [
    {
      label: "Highest risk",
      value: "Red Shift night has one unresolved validated-skill gap.",
    },
    {
      label: "First action",
      value: "Confirm the proposed cover package before releasing planned work.",
    },
  ],
  evidence: [
    "Red Shift night has one unresolved validated-skill gap on VF-02.",
  ],
  findings: [
    {
      category: "cover",
      severity: "high",
      title: "Priority shift",
      detail: "Red Shift night requires confirmed validated cover for VF-02.",
    },
  ],
  coverOptions: [
    {
      engineerNames: ["Oliver Clarke", "Laura Davies"],
      shift: "Red Shift night",
      reason: "Strongest calculated package.",
      skillsCovered: ["PLC diagnostics"],
      assetsProtected: ["VF-02"],
      projectedImpact: "Closes the highest-priority skill gap.",
      remainingRisk: "Manager approval and rest compliance remain unconfirmed.",
      caveat: "Provisional only.",
    },
  ],
  recommendedActions: [
    "Confirm overtime acceptance, rest compliance and manager approval.",
  ],
  actionPlan: [
    {
      priority: "before_shift",
      action: "Confirm the proposed Red Shift cover package.",
      owner: "Maintenance Manager",
      expectedImpact: "Closes the highest-priority validated-skill gap.",
      verification: "Open Shift Cover and confirm the revised roster.",
    },
  ],
  followUpQuestions: [],
  sources: ["Shift Cover decision pack"],
  missingData: ["Overtime acceptance is not yet confirmed."],
  confidence: 82,
  intentLabel: "Shift cover decision",
  toolsUsed: ["get_shift_cover"],
  evidenceLinks: [
    {
      label: "Open Shift Cover",
      path: "/shift-cover",
      recordType: "shift",
    },
  ],
  evidenceGeneratedAt: "2026-08-02T20:00:00.000Z",
};

async function mockAskVorta(page: Page): Promise<void> {
  await page.route("**/api/ask-vorta", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockedAnswer),
    });
  });
}

async function openAskVorta(
  page: Page,
  projectName: string,
): Promise<void> {
  if (isPhoneProject(projectName)) {
    const sharedLauncher = page.locator(
      '[data-vorta-shared-mobile-ai-launcher="true"]',
    );
    await expect(sharedLauncher).toBeVisible();
    await sharedLauncher.evaluate((element: HTMLButtonElement) => element.click());
    return;
  }

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("vorta-global-ai-prompt"));
  });
}

test.describe("VOR-041 Ask Vorta workspace", () => {
  test.skip(
    !hasAuthenticatedTestUser,
    "The workspace browser contract requires the protected Maintenance Manager account.",
  );

  test("tablet and desktop expand into one persistent workspace", async ({
    page,
  }, testInfo) => {
    test.skip(isPhoneProject(testInfo.project.name));
    await mockAskVorta(page);
    await signInMaintenanceManager(page);
    await openAskVorta(page, testInfo.project.name);

    const panel = page.locator('[data-vorta-global-ai-panel="true"]');
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox?.width ?? 0).toBeGreaterThanOrEqual(480);

    const expand = page.locator('[data-vorta-global-ai-expand="true"]');
    await expect(expand).toBeVisible();
    await expand.evaluate((element: HTMLButtonElement) => element.click());

    const workspace = page.locator('[data-vorta-ai-workspace="true"]');
    await expect(workspace).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New conversation" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Conversation" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Evidence" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Actions" })).toBeVisible();

    const question = "Can the current shift cover the planned work?";
    const input = page.locator('[data-vorta-ai-workspace-input="true"]');
    await input.fill(question);
    const send = workspace.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(workspace.getByText(mockedAnswer.directAnswer)).toBeVisible();
    await expect(workspace.getByText(question, { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Evidence" }).click();
    await expect(workspace.getByText("Verified evidence")).toBeVisible();
    await expect(workspace.getByText("Shift Cover decision pack")).toBeVisible();
    await expect(
      workspace.getByText("Overtime acceptance is not yet confirmed."),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Actions" }).click();
    await expect(workspace.getByText("Recommended actions")).toBeVisible();
    await expect(
      workspace.getByText("Confirm the proposed Red Shift cover package."),
    ).toBeVisible();
    await expect(
      workspace.getByText("Oliver Clarke + Laura Davies"),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("ask-vorta-workspace-actions.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Compact" }).click();
    await expect(workspace).toBeHidden();
    await expect(panel).toBeVisible();
    await expect(panel.getByText(mockedAnswer.directAnswer)).toBeVisible();

    await expand.evaluate((element: HTMLButtonElement) => element.click());
    await expect(workspace).toBeVisible();
    await expect(workspace.getByText(question, { exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("ask-vorta-workspace-conversation.png"),
      fullPage: true,
    });
  });

  test("phone keeps the approved assistant without workspace controls", async ({
    page,
  }, testInfo) => {
    test.skip(!isPhoneProject(testInfo.project.name));
    await signInMaintenanceManager(page);
    await openAskVorta(page, testInfo.project.name);

    const panel = page.locator('[data-vorta-global-ai-panel="true"]');
    await expect(panel).toBeVisible();
    await expect(
      page.locator('[data-vorta-global-ai-header="true"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-vorta-global-ai-composer="true"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-vorta-global-ai-send="true"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-vorta-global-ai-expand="true"]'),
    ).toBeHidden();
    await expect(
      page.locator('[data-vorta-ai-workspace="true"]'),
    ).toHaveCount(0);

    const box = await panel.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(359);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(799);
    await page.screenshot({
      path: testInfo.outputPath("ask-vorta-phone-unchanged.png"),
      fullPage: true,
    });
  });
});