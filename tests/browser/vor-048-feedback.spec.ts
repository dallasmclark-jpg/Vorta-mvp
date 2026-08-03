import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const responseId = "48000000-0000-4000-8000-000000000001";

const askVortaAnswer = {
  responseId,
  directAnswer:
    "The next shift has one validated-skill exposure. Confirm the proposed cover before releasing planned work.",
  decisionSummary: [
    { label: "Route", value: "Shift Cover" },
    { label: "First action", value: "Confirm the provisional cover package" },
  ],
  evidence: ["The dated Shift Cover decision pack checked the roster and validated skills."],
  findings: [
    {
      category: "cover",
      severity: "high",
      title: "Validated-skill exposure",
      detail: "One shift has fewer validated engineers than the recorded equipment requirement.",
    },
  ],
  coverOptions: [],
  recommendedActions: ["Confirm the provisional cover package."],
  actionPlan: [],
  followUpQuestions: [],
  sources: ["Shift Cover decision pack"],
  missingData: [],
  confidence: 88,
  intentLabel: "shift_cover",
  toolsUsed: ["get_shift_cover"],
  evidenceLinks: [
    {
      label: "Open Shift Cover",
      path: "/maintenance/labour-risk/shift-cover",
      recordType: "shift",
    },
  ],
  evidenceGeneratedAt: "2026-08-03T20:00:00.000Z",
};

type FeedbackPayload = {
  feedback?: unknown;
  feedback_category?: unknown;
  feedback_reason?: unknown;
};

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function activeAssistantMessages(page: Page): Locator {
  return page.locator('[data-vorta-global-ai-messages="true"]:visible').first();
}

function feedbackButton(page: Page, label: string): Locator {
  return activeAssistantMessages(page)
    .getByRole("button", { name: label })
    .first();
}

function feedbackText(page: Page, text: string): Locator {
  return activeAssistantMessages(page)
    .locator("span")
    .filter({ hasText: text })
    .first();
}

async function reveal(locator: Locator): Promise<void> {
  await expect(locator).toBeAttached({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
}

async function installFeedbackMocks(
  page: Page,
  captured: FeedbackPayload[],
): Promise<void> {
  await page.route("**/api/ask-vorta", (route) => json(route, askVortaAnswer));
  await page.route("**/rest/v1/ask_vorta_interactions?*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    const url = decodeURIComponent(route.request().url());
    expect(url).toContain(`id=eq.${responseId}`);
    captured.push(route.request().postDataJSON() as FeedbackPayload);
    await route.fulfill({ status: 204, body: "" });
  });
}

async function openMockedShiftCoverAnswer(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("vorta-global-ai-prompt", {
        detail: {
          question: "What are the shift cover issues today?",
          submit: true,
          role: "maintenance-manager",
        },
      }),
    );
  });
  await reveal(feedbackText(page, "Was this decision pack useful?"));
}

test("VOR-048 not-helpful feedback captures an optional bounded reason", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "laptop-1366",
    "The feedback detail journey is verified once at the approved desktop breakpoint.",
  );

  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");
  await page.locator('[data-vorta-maintenance-portal="true"]').waitFor();

  const captured: FeedbackPayload[] = [];
  await installFeedbackMocks(page, captured);
  await openMockedShiftCoverAnswer(page);

  const notHelpful = feedbackButton(
    page,
    "Mark this Ask Vorta response not helpful",
  );
  await reveal(notHelpful);
  await notHelpful.click();

  const prompt = activeAssistantMessages(page)
    .getByRole("group", { name: /What was not useful/i })
    .first();
  await reveal(prompt);
  await prompt.getByLabel("Reason").selectOption("wrong_route");
  await prompt.getByLabel("Brief detail").fill("It answered equipment history instead of the rota question.");
  await prompt.getByRole("button", { name: "Submit feedback" }).click();

  await reveal(feedbackText(page, "Thanks—this improves Ask Vorta."));
  expect(captured).toHaveLength(1);
  expect(captured[0]).toMatchObject({
    feedback: "not_helpful",
    feedback_category: "wrong_route",
    feedback_reason: "It answered equipment history instead of the rota question.",
  });
});

test("VOR-048 helpful feedback remains one tap on phone", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "phone-360",
    "The one-tap phone feedback path is verified at the smallest supported width.",
  );

  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");
  await page.locator('[data-vorta-maintenance-portal="true"]').waitFor();

  const captured: FeedbackPayload[] = [];
  await installFeedbackMocks(page, captured);
  await openMockedShiftCoverAnswer(page);

  const helpful = feedbackButton(
    page,
    "Mark this Ask Vorta response helpful",
  );
  await reveal(helpful);
  await helpful.click();

  await reveal(feedbackText(page, "Thanks—this improves Ask Vorta."));
  expect(captured).toHaveLength(1);
  expect(captured[0]).toMatchObject({
    feedback: "helpful",
    feedback_category: null,
    feedback_reason: null,
  });
});
