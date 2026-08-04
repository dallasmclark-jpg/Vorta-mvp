import { expect, test, type Page, type Route } from "@playwright/test";
import { writeFileSync } from "node:fs";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const responseId = "51000000-0000-4000-8000-000000000001";
const question =
  "Why is FD-03 one of the highest-risk assets and what should we do first?";
const expectedEntities = [
  "FD-03",
  "FD-03-PLC-01",
  "WO-260706",
  "Gareth Owen",
  "Sophie Bennett",
  "Vacuum Systems",
  "FD-03 Approved Fault-Finding Guide",
] as const;
const unsafeOperationalClaims = [
  "create a maintenance notification",
  "create a work order",
  "submit to sap",
  "vorta work request",
  "safe to release without testing",
] as const;

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function activeAssistantMessages(page: Page) {
  return page.locator('[data-vorta-global-ai-messages="true"]:visible').first();
}

async function scrollAssistantToEnd(page: Page): Promise<void> {
  const messages = activeAssistantMessages(page);
  await expect(messages).toBeVisible({ timeout: 20_000 });
  await messages.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(100);
}

async function resolveFd03EquipmentId(
  page: Page,
  projectName: string,
): Promise<string> {
  await page.goto("/equipment");
  await page.locator('[data-vorta-maintenance-portal="true"]').waitFor();

  if (projectName === "phone-360") {
    await page.locator('[data-vorta-mobile-equipment="true"]').waitFor();
    const search = page.locator('input[placeholder*="Search"]').first();
    await expect(search).toBeVisible();
    await search.fill("FD-03");
    await page
      .getByRole("button", { name: /Open overview for .*FD-03/i })
      .first()
      .click();
  } else {
    await page.locator('[data-vorta-production-equipment-list="true"]').waitFor();
    await page
      .getByPlaceholder(
        "Search equipment, asset number, area, manufacturer or production line...",
      )
      .fill("FD-03");
    await page.getByRole("button", { name: "FD-03", exact: true }).click();
  }

  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);
  const match = new URL(page.url()).pathname.match(/^\/equipment\/([^/]+)\/overview$/);
  expect(match?.[1], "FD-03 must resolve to one stable equipment ID").toBeTruthy();
  return decodeURIComponent(match?.[1] ?? "");
}

function askVortaAnswer(equipmentId: string) {
  return {
    responseId,
    directAnswer:
      "FD-03 is a high-priority asset because the vacuum-system exposure is tied to an unresolved PLC intervention and an unavailable critical spare. First, control the current exposure under WO-260706, then restore FD-03-PLC-01 stock before the permanent repair.",
    decisionSummary: [
      {
        label: "Asset",
        value: "FD-03 vacuum system",
      },
      {
        label: "First action",
        value:
          "Use WO-260706 to control the immediate vacuum exposure and procure FD-03-PLC-01 for the permanent intervention.",
      },
      {
        label: "Validated capability",
        value:
          "Gareth Owen and Sophie Bennett hold validated Vacuum Systems capability.",
      },
      {
        label: "Approved evidence",
        value: "FD-03 Approved Fault-Finding Guide",
      },
    ],
    evidence: [
      "The FD-03 decision pack links WO-260706 to the current vacuum-system exposure.",
      "FD-03-PLC-01 is the exact critical spare required for the permanent intervention.",
      "Gareth Owen and Sophie Bennett have validated Vacuum Systems capability.",
      "Use the FD-03 Approved Fault-Finding Guide before intrusive work.",
    ],
    findings: [
      {
        category: "equipment",
        severity: "high",
        title: "Vacuum-system exposure",
        detail:
          "FD-03 remains exposed until WO-260706 controls the fault and FD-03-PLC-01 is available for permanent correction.",
      },
      {
        category: "capability",
        severity: "medium",
        title: "Validated intervention capability",
        detail:
          "Gareth Owen and Sophie Bennett are the validated Vacuum Systems engineers for this decision.",
      },
    ],
    coverOptions: [],
    recommendedActions: [
      "Review WO-260706 before intrusive work.",
      "Restore stock of FD-03-PLC-01.",
      "Use the FD-03 Approved Fault-Finding Guide and validated Vacuum Systems capability.",
    ],
    actionPlan: [],
    followUpQuestions: [],
    sources: [
      "Equipment decision pack",
      "Work-order history",
      "Spares inventory",
      "Skills matrix",
      "Approved maintenance documents",
    ],
    missingData: [],
    confidence: 92,
    intentLabel: "equipment_decision",
    toolsUsed: ["get_equipment_decision_pack"],
    coveredTools: [
      "get_equipment_risk",
      "get_equipment_work",
      "get_equipment_spares",
      "get_equipment_skills",
      "get_equipment_history",
      "get_equipment_documents",
    ],
    evidenceLinks: [
      {
        label: "Open FD-03 spares",
        path: `/equipment/${encodeURIComponent(
          equipmentId,
        )}/spares?record=FD-03-PLC-01&from=ai`,
        recordType: "spare",
        recordId: "FD-03-PLC-01",
      },
      {
        label: "Open FD-03 work orders",
        path: `/equipment/${encodeURIComponent(
          equipmentId,
        )}/work-orders?record=WO-260706&from=ai`,
        recordType: "work_order",
        recordId: "WO-260706",
      },
      {
        label: "Open FD-03 skills",
        path: `/equipment/${encodeURIComponent(equipmentId)}/skills?from=ai`,
        recordType: "skill",
      },
      {
        label: "Open FD-03 documents",
        path: `/equipment/${encodeURIComponent(equipmentId)}/documents?from=ai`,
        recordType: "document",
      },
    ],
    evidenceGeneratedAt: "2026-08-04T12:00:00.000Z",
  };
}

async function capture(
  page: Page,
  path: string,
): Promise<void> {
  await page.screenshot({ path, fullPage: true });
}

test("VOR-051 Maintenance Manager demo stays coherent from risk to exact evidence", async ({
  page,
}, testInfo) => {
  test.skip(
    !["phone-360", "laptop-1366"].includes(testInfo.project.name),
    "The golden demo is rehearsed at the approved phone and laptop breakpoints.",
  );
  test.setTimeout(180_000);

  await signInMaintenanceManager(page);
  const equipmentId = await resolveFd03EquipmentId(page, testInfo.project.name);
  const answer = askVortaAnswer(equipmentId);
  let capturedRequest: Record<string, unknown> | null = null;

  await page.route("**/api/ask-vorta", async (route) => {
    capturedRequest = route.request().postDataJSON() as Record<string, unknown>;
    await json(route, answer);
  });

  await page.goto("/dashboard");
  await page.locator('[data-vorta-dashboard-root="true"]').waitFor();
  await expect(page.getByText("Operations Overview", { exact: true })).toBeVisible();

  const fillFinish = page.getByRole("tab", { name: /Fill Finish/i }).first();
  await expect(fillFinish).toBeVisible({ timeout: 20_000 });
  await fillFinish.click();
  await expect(fillFinish).toHaveAttribute("aria-selected", "true");

  const workPlanButton = page.getByRole("button", { name: /View work plan/i });
  await expect(workPlanButton).toBeEnabled({ timeout: 20_000 });
  await workPlanButton.click();
  await expect(page.getByText("Recommended Work Queue", { exact: true })).toBeVisible();
  await expect(page.getByText("FD-03", { exact: false }).first()).toBeVisible();

  const dashboardScreenshot = testInfo.outputPath("01-dashboard-work-plan.png");
  await capture(page, dashboardScreenshot);

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

  const messages = activeAssistantMessages(page);
  await expect(
    messages.getByText(answer.directAnswer, { exact: true }),
  ).toBeAttached({ timeout: 20_000 });
  await scrollAssistantToEnd(page);

  for (const entity of expectedEntities) {
    await expect(messages.getByText(entity, { exact: false }).first()).toBeAttached();
  }
  for (const unsafeClaim of unsafeOperationalClaims) {
    await expect(messages).not.toContainText(unsafeClaim, { ignoreCase: true });
  }
  await expect(
    messages.getByRole("button", { name: /Prepare action draft/i }),
  ).toHaveCount(0);

  expect(capturedRequest).toMatchObject({
    question,
    role: "maintenance-manager",
    pageContext: { path: "/dashboard" },
  });

  const answerScreenshot = testInfo.outputPath("02-ask-vorta-decision.png");
  await capture(page, answerScreenshot);

  await messages
    .getByRole("button", { name: "Open FD-03 spares", exact: true })
    .click();
  await page.waitForURL(
    new RegExp(
      `/equipment/${equipmentId}/spares\\?(?:[^#]*&)?record=FD-03-PLC-01(?:&|$)`,
    ),
  );

  const closeAssistant = page.getByRole("button", {
    name: "Close global assistant",
    exact: true,
  });
  if (await closeAssistant.isVisible().catch(() => false)) {
    await closeAssistant.click();
  }

  await expect(page.getByText("FD-03-PLC-01", { exact: false }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expectNoPageOverflow(page);

  const evidenceScreenshot = testInfo.outputPath("03-fd03-spares.png");
  await capture(page, evidenceScreenshot);

  const buildResponse = await page.request.get(
    new URL("/vorta-build.json", page.url()).toString(),
  );
  expect(buildResponse.ok(), "Exact preview build metadata must be readable").toBe(true);
  const buildMetadata = (await buildResponse.json()) as Record<string, unknown>;
  const expectedHeadSha = process.env.EXPECTED_HEAD_SHA ?? "";
  if (expectedHeadSha) {
    expect(JSON.stringify(buildMetadata)).toContain(expectedHeadSha);
  }

  await page.goBack();
  await page.waitForURL(/\/dashboard(?:\?.*)?$/);
  await expect(page.locator('[data-vorta-dashboard-root="true"]')).toBeVisible();
  await expect(page.getByRole("tab", { name: /Fill Finish/i }).first()).toBeVisible();

  const manifest = {
    rehearsal: "VOR-051 Maintenance Manager golden journey",
    project: testInfo.project.name,
    expectedHeadSha: expectedHeadSha || null,
    buildMetadata,
    equipmentId,
    question,
    responseId,
    dashboardScope: "Fill Finish",
    visibleAnswer: {
      directAnswer: answer.directAnswer,
      decisionSummary: answer.decisionSummary,
      findings: answer.findings,
      recommendedActions: answer.recommendedActions,
    },
    expectedEntities,
    destination: `/equipment/${equipmentId}/spares?record=FD-03-PLC-01&from=ai`,
    screenshots: [
      "01-dashboard-work-plan.png",
      "02-ask-vorta-decision.png",
      "03-fd03-spares.png",
    ],
    verifiedAt: new Date().toISOString(),
  };
  const manifestPath = testInfo.outputPath(
    `vor-051-${testInfo.project.name}-manifest.json`,
  );
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  await testInfo.attach("VOR-051 rehearsal manifest", {
    path: manifestPath,
    contentType: "application/json",
  });
  await testInfo.attach("Dashboard work plan", {
    path: dashboardScreenshot,
    contentType: "image/png",
  });
  await testInfo.attach("Ask Vorta decision", {
    path: answerScreenshot,
    contentType: "image/png",
  });
  await testInfo.attach("FD-03 spare evidence", {
    path: evidenceScreenshot,
    contentType: "image/png",
  });
});
