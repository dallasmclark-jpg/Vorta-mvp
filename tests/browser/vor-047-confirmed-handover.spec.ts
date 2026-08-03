import { expect, test, type Page, type Route } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

const siteId =
  process.env.VORTA_E2E_SITE_ID ??
  "11000000-0000-0000-0000-000000000001";
const responseId = "47000000-0000-4000-8000-000000000001";
const workOrderId = "47000000-0000-4000-8000-000000000002";
const draftId = "47000000-0000-4000-8000-000000000003";
const resultId = "47000000-0000-4000-8000-000000000004";

const recommendation = {
  priority: "before_shift",
  action: "Prepare a shift handover for the incoming maintenance team.",
  owner: "Maintenance Manager",
  expectedImpact: "The incoming shift receives one verified action against the existing work order.",
  verification: "Confirm the linked work order and the saved Vorta handover action.",
} as const;

const askVortaAnswer = {
  responseId,
  directAnswer:
    "Prepare a controlled Vorta shift handover against the existing open work order. SAP remains unchanged.",
  decisionSummary: [
    { label: "Recommended action", value: "Prepare shift handover" },
  ],
  evidence: ["WO-470047 remains open and requires an incoming-shift action."],
  findings: [
    {
      category: "work",
      severity: "high",
      title: "Incoming-shift action required",
      detail: "The open work order needs a clear handover owner and due time.",
    },
  ],
  coverOptions: [],
  recommendedActions: [recommendation.action],
  actionPlan: [recommendation],
  followUpQuestions: [],
  sources: ["Shift handover and open work-order evidence"],
  missingData: [],
  confidence: 96,
  intentLabel: "Shift handover",
  toolsUsed: ["get_shift_handover"],
  evidenceLinks: [
    {
      label: "Open Shift Handover",
      path: "/shift-handover",
      recordType: "handover",
    },
  ],
  evidenceGeneratedAt: "2026-08-03T18:00:00.000Z",
};

type MockCounters = {
  createDraft: number;
  cancelDraft: number;
  confirmDraft: number;
};

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": "0-0/*" },
    body: JSON.stringify(body),
  });
}

async function installControlledActionMocks(
  page: Page,
  counters: MockCounters,
): Promise<void> {
  await page.route("**/api/ask-vorta", (route) => json(route, askVortaAnswer));

  await page.route("**/rest/v1/work_orders?*", async (route) => {
    const decodedUrl = decodeURIComponent(route.request().url());
    if (!decodedUrl.includes("wo_number") || !decodedUrl.includes("technical_completion_at")) {
      await route.continue();
      return;
    }

    await json(route, [
      {
        id: workOrderId,
        wo_number: "WO-470047",
        description: "Verify filler guarding before incoming shift",
        status: "INPR",
        priority: "2",
        equipment_id: "47000000-0000-4000-8000-000000000005",
        due_date: "2026-08-04",
        updated_at: "2026-08-03T18:00:00.000Z",
        technical_completion_at: null,
        business_completion_at: null,
        system_status_codes: ["REL", "INPR"],
      },
    ]);
  });

  await page.route("**/rest/v1/shift_handover_actions?*", async (route) => {
    const decodedUrl = decodeURIComponent(route.request().url());
    if (!decodedUrl.includes("work_order_id") || !decodedUrl.includes("window_start")) {
      await route.continue();
      return;
    }
    await json(route, []);
  });

  await page.route(
    "**/rest/v1/rpc/vorta_create_ask_vorta_action_draft",
    async (route) => {
      counters.createDraft += 1;
      const request = route.request().postDataJSON() as Record<string, unknown>;
      expect(request.p_action_kind).toBe("handover_note");
      expect(request.p_target_type).toBe("work_order");
      expect(request.p_target_id).toBe(workOrderId);

      await json(route, {
        id: draftId,
        interactionId: responseId,
        siteId,
        priority: recommendation.priority,
        action: recommendation.action,
        owner: recommendation.owner,
        expectedImpact: recommendation.expectedImpact,
        verification: recommendation.verification,
        status: "draft",
        actionKind: "handover_note",
        targetType: "work_order",
        targetId: workOrderId,
        proposedChanges: request.p_proposed_changes ?? {},
        evidence: request.p_evidence ?? {},
        version: 1,
        supported: true,
        resultType: null,
        resultId: null,
        resultPayload: null,
        failureReason: null,
        events: [],
        createdAt: "2026-08-03T18:01:00.000Z",
        updatedAt: "2026-08-03T18:01:00.000Z",
      });
    },
  );

  await page.route(
    "**/rest/v1/rpc/vorta_cancel_ask_vorta_action",
    async (route) => {
      counters.cancelDraft += 1;
      await json(route, {
        id: draftId,
        interactionId: responseId,
        siteId,
        priority: recommendation.priority,
        action: recommendation.action,
        owner: recommendation.owner,
        expectedImpact: recommendation.expectedImpact,
        verification: recommendation.verification,
        status: "cancelled",
        actionKind: "handover_note",
        targetType: "work_order",
        targetId: workOrderId,
        proposedChanges: {},
        evidence: {},
        version: 2,
        supported: true,
        resultType: null,
        resultId: null,
        resultPayload: null,
        failureReason: null,
        events: [],
        createdAt: "2026-08-03T18:01:00.000Z",
        updatedAt: "2026-08-03T18:02:00.000Z",
      });
    },
  );

  await page.route(
    "**/rest/v1/rpc/vorta_confirm_ask_vorta_action",
    async (route) => {
      counters.confirmDraft += 1;
      await json(route, {
        id: draftId,
        interactionId: responseId,
        siteId,
        status: "confirmed",
        actionKind: "handover_note",
        targetType: "work_order",
        targetId: workOrderId,
        version: 2,
        supported: true,
        resultType: "shift_handover_action",
        resultId,
        resultPayload: { id: resultId },
        events: [],
      });
    },
  );
}

async function openMockedHandoverRecommendation(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("vorta-global-ai-prompt", {
        detail: {
          question: "Prepare the incoming-shift handover action.",
          submit: true,
          role: "maintenance-manager",
        },
      }),
    );
  });

  await expect(
    page.getByRole("button", { name: "Prepare action draft" }).first(),
  ).toBeVisible({ timeout: 20_000 });
}

test("VOR-047 desktop review shows exact handover changes and cancellation stays source-neutral", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "laptop-1366",
    "The controlled review journey is verified once at the approved desktop breakpoint.",
  );
  test.setTimeout(120_000);

  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");
  await page.locator('[data-vorta-maintenance-portal="true"]').waitFor();

  const counters: MockCounters = {
    createDraft: 0,
    cancelDraft: 0,
    confirmDraft: 0,
  };
  await installControlledActionMocks(page, counters);
  await openMockedHandoverRecommendation(page);

  await page
    .getByRole("button", { name: "Prepare action draft" })
    .first()
    .click();

  const actionDialog = page.getByRole("dialog", {
    name: "Prepare a handover action for confirmation",
  });
  await expect(actionDialog).toBeVisible();
  await expect(actionDialog).toContainText("Vorta remains read-only from SAP");
  await expect(actionDialog.getByRole("combobox", { name: "Open work order" })).toHaveValue(
    workOrderId,
  );

  await actionDialog.getByRole("button", { name: "Review exact changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Review exact proposed handover" }),
  ).toBeVisible();
  await expect(actionDialog).toContainText("WO-470047");
  await expect(actionDialog).toContainText("Prepare a shift handover");
  await expect(actionDialog).toContainText(
    "It does not change SAP or create a parallel maintenance request.",
  );

  await page.screenshot({
    path: testInfo.outputPath("vor-047-controlled-handover-review.png"),
    fullPage: false,
  });

  await actionDialog.getByRole("button", { name: "Cancel draft" }).click();
  await expect(actionDialog).toHaveCount(0);
  expect(counters).toEqual({
    createDraft: 1,
    cancelDraft: 1,
    confirmDraft: 0,
  });
});

test("VOR-047 phone keeps the approved recommendation-only action presentation", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "phone-360",
    "The mobile boundary is verified only on the approved phone project.",
  );
  test.setTimeout(120_000);

  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");
  await page.locator('[data-vorta-maintenance-portal="true"]').waitFor();

  const counters: MockCounters = {
    createDraft: 0,
    cancelDraft: 0,
    confirmDraft: 0,
  };
  await installControlledActionMocks(page, counters);
  await openMockedHandoverRecommendation(page);

  const mobileBoundary = page.waitForEvent("dialog");
  await page
    .getByRole("button", { name: "Prepare action draft" })
    .first()
    .click();
  const browserDialog = await mobileBoundary;
  expect(browserDialog.message()).toContain(
    "approved mobile Ask Vorta experience remains recommendation-only",
  );
  await browserDialog.accept();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(counters).toEqual({
    createDraft: 0,
    cancelDraft: 0,
    confirmDraft: 0,
  });

  await page.screenshot({
    path: testInfo.outputPath("vor-047-mobile-recommendation-only.png"),
    fullPage: false,
  });
});
