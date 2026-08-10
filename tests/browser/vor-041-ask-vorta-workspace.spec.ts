// Final VOR-041 verification covers four device classes and stable Recent conversations.
// Visual-refinement coverage protects the welcome, evidence and mobile prompt states.
import { expect, test, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const hasAuthenticatedTestUser = Boolean(process.env.VORTA_E2E_PASSWORD);
const isPhoneProject = (projectName: string): boolean =>
  projectName === "phone-360";
const isPortraitTabletProject = (projectName: string): boolean =>
  projectName === "samsung-tablet-portrait";

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
    { label: "Scheduled", value: "Four engineers are currently rostered." },
    { label: "Absence", value: "No recorded absence is visible." },
    { label: "Best provisional cover", value: "Oliver Clarke and Laura Davies." },
    { label: "Calculated impact", value: "Closes the highest-priority gap." },
    { label: "Residual risk", value: "Approval and rest compliance remain open." },
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
  intentLabel: "check_shift_cover",
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

  const readinessControl = page.getByRole("button", {
    name: "Ask",
    exact: true,
  });
  await expect(readinessControl).toBeVisible();

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
    await page.evaluate(() => window.localStorage.removeItem("vorta:ask-vorta:recent-conversations:v1"));
    await page.evaluate(() => window.sessionStorage.removeItem("vorta:ask-vorta:active-conversation:v1"));
    await openAskVorta(page, testInfo.project.name);

    const panel = page.locator('[data-vorta-global-ai-panel="true"]');
    const workspace = page.locator('[data-vorta-ai-workspace="true"]');
    const expand = page.locator('[data-vorta-global-ai-expand="true"]');

    await expect
      .poll(
        async () => (await workspace.isVisible()) || (await expand.isVisible()),
        { message: "Ask Vorta should expose the full workspace or its Expand control" },
      )
      .toBe(true);

    if (!(await workspace.isVisible()) && (await expand.isVisible())) {
      await expand.evaluate((element: HTMLButtonElement) => element.click());
    }

    await expect(workspace).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New conversation" }),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Conversation" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Evidence" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Actions" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What can I help with?", exact: true }),
    ).toBeVisible();
    await expect(
      workspace.locator('button').filter({ hasText: /risk|equipment|shift|work|spares/i }).first(),
    ).toBeVisible();
    await expect(
      workspace.getByRole("button", { name: "Collapse recent conversations", exact: true }),
    ).toBeVisible();

    const question = "Can the current shift cover the planned work?";
    const input = page.locator('[data-vorta-ai-workspace-input="true"]');
    await input.fill(question);
    const send = workspace.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeEnabled();
    await send.click();
    await expect(workspace.getByText(mockedAnswer.directAnswer)).toBeVisible();
    const liveEvidenceStatus = workspace.getByText("Live evidence", {
      exact: true,
    });
    if (isPortraitTabletProject(testInfo.project.name)) {
      await expect(liveEvidenceStatus).toBeHidden();
    } else {
      await expect(liveEvidenceStatus).toBeVisible();
    }
    await expect(workspace.getByText("check_shift_cover", { exact: true })).toHaveCount(0);
    await expect(workspace.getByText("Strategic maintenance response", { exact: true })).toHaveCount(0);
    await expect(workspace.getByText("Maintenance Manager", { exact: true })).toHaveCount(0);
    await expect(
      workspace.getByText("I can answer Maintenance Manager questions", { exact: false }),
    ).toHaveCount(0);
    await expect(
      workspace.getByText(question, { exact: true }).last(),
    ).toBeVisible();
    const sourceSummary = workspace.getByRole("button", {
      name: "1 verified Vorta source",
      exact: true,
    });
    await expect(sourceSummary).toBeVisible();
    await sourceSummary.click();
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

    const collapse = workspace.getByRole("button", {
      name: "Return to compact Ask Vorta panel",
      exact: true,
    });
    await collapse.evaluate((element: HTMLButtonElement) => element.click());
    await expect(workspace).toBeHidden();
    await expect(panel).toBeVisible();
    await expect(panel.getByText(mockedAnswer.directAnswer)).toBeVisible();
    const compactSummary = panel.locator(
      'section[aria-labelledby="ask-vorta-decision-summary"]',
    );
    await expect(compactSummary.locator("li")).toHaveCount(4);

    await expect(expand).toBeVisible();
    await expand.evaluate((element: HTMLButtonElement) => element.click());
    await expect(workspace).toBeVisible();
    const recentTitle = question.replace(/[?.!]+$/, "");
    await expect(
      workspace.locator("aside").getByText(recentTitle, { exact: true }),
    ).toHaveCount(1);
    await page.getByRole("tab", { name: "Conversation" }).click();
    await expect(
      workspace.getByText(question, { exact: true }).last(),
    ).toBeVisible();
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
    await page.evaluate(() => window.localStorage.removeItem("vorta:ask-vorta:recent-conversations:v1"));
    await page.evaluate(() => window.sessionStorage.removeItem("vorta:ask-vorta:active-conversation:v1"));
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
    const visiblePrompts = panel.locator(
    '[data-vorta-global-ai-prompt-button="true"]:visible',
  );
  await expect(visiblePrompts).toHaveCount(2);
  const firstPromptBox = await visiblePrompts.nth(0).boundingBox();
  const secondPromptBox = await visiblePrompts.nth(1).boundingBox();
  expect(firstPromptBox).not.toBeNull();
  expect(secondPromptBox).not.toBeNull();
  expect((secondPromptBox?.y ?? 0)).toBeGreaterThan(
    (firstPromptBox?.y ?? 0) + (firstPromptBox?.height ?? 0) - 1,
  );
  const promptRegion = page.locator('[data-vorta-global-ai-prompts="true"]');
  const promptOverflow = await promptRegion.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(promptOverflow).toBeLessThanOrEqual(1);
  await expect(panel.getByText("Risk-reduction plan", { exact: true })).toHaveCount(0);

    const box = await panel.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(359);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(799);
    await page.screenshot({
      path: testInfo.outputPath("ask-vorta-phone-unchanged.png"),
      fullPage: true,
    });
  });
});