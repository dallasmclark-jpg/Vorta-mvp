import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getStoredSupabaseAccessToken,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

type GoldenScenario = {
  id: string;
  question: string;
  expectedTools: string[];
  mustMention: string[];
  mustMentionAny: string[];
  mustNotMention: string[];
};

type AskVortaAnswer = {
  directAnswer?: unknown;
  decisionSummary?: Array<{ label?: unknown; value?: unknown }>;
  evidence?: unknown[];
  findings?: Array<{ title?: unknown; detail?: unknown }>;
  coverOptions?: Array<{
    engineerNames?: unknown[];
    shift?: unknown;
    reason?: unknown;
    skillsCovered?: unknown[];
    assetsProtected?: unknown[];
    projectedImpact?: unknown;
    remainingRisk?: unknown;
    caveat?: unknown;
  }>;
  actionPlan?: Array<{
    action?: unknown;
    owner?: unknown;
    expectedImpact?: unknown;
    verification?: unknown;
  }>;
  evidenceLinks?: unknown[];
  toolsUsed?: unknown[];
  responseId?: unknown;
  error?: unknown;
};

const scenarios = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/evals/vor-033-demo-golden.json"), "utf8"),
) as GoldenScenario[];

const baseUrl = (process.env.VORTA_EVAL_BASE_URL ?? "https://vorta-app.netlify.app").replace(/\/$/, "");
const siteId = process.env.VORTA_EVAL_SITE_ID ?? "11000000-0000-0000-0000-000000000001";

function textValues(values: unknown[] | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === "string");
}

function answerText(answer: AskVortaAnswer): string {
  return [
    typeof answer.directAnswer === "string" ? answer.directAnswer : undefined,
    ...(answer.decisionSummary ?? []).flatMap((item) => [item.label, item.value]),
    ...(answer.evidence ?? []),
    ...(answer.findings ?? []).flatMap((item) => [item.title, item.detail]),
    ...(answer.coverOptions ?? []).flatMap((item) => [
      ...(item.engineerNames ?? []),
      item.shift,
      item.reason,
      ...(item.skillsCovered ?? []),
      ...(item.assetsProtected ?? []),
      item.projectedImpact,
      item.remainingRisk,
      item.caveat,
    ]),
    ...(answer.actionPlan ?? []).flatMap((item) => [
      item.action,
      item.owner,
      item.expectedImpact,
      item.verification,
    ]),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n")
    .toLowerCase();
}

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil(percentileValue * sorted.length) - 1);
  return sorted[index];
}

test("VOR-033 live Ask Vorta answers stay grounded across all six demo storylines", async ({ page }) => {
  test.setTimeout(1_200_000);

  await signInMaintenanceManager(page);
  const accessToken = await getStoredSupabaseAccessToken(page);
  const failures: string[] = [];
  const durations: number[] = [];

  for (const scenario of scenarios) {
    const startedAt = Date.now();
    const response = await page.request.post(`${baseUrl}/api/ask-vorta`, {
      timeout: 65_000,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      data: {
        question: scenario.question,
        role: "maintenance-manager",
        siteId,
        history: [],
        pageContext: { path: "/dashboard", timezone: "Europe/London" },
      },
    });
    const durationMs = Date.now() - startedAt;
    durations.push(durationMs);

    let payload: AskVortaAnswer | null = null;
    try {
      payload = (await response.json()) as AskVortaAnswer;
    } catch {
      failures.push(`${scenario.id}: HTTP ${response.status()} returned invalid JSON`);
      continue;
    }

    const scenarioFailures: string[] = [];
    if (!response.ok()) {
      scenarioFailures.push(`HTTP ${response.status()}: ${String(payload?.error ?? "request failed")}`);
    } else if (payload) {
      const text = answerText(payload);
      const toolsUsed = new Set(textValues(payload.toolsUsed));

      for (const tool of scenario.expectedTools) {
        if (!toolsUsed.has(tool)) scenarioFailures.push(`missing tool ${tool}`);
      }
      for (const phrase of scenario.mustMention) {
        if (!text.includes(phrase.toLowerCase())) scenarioFailures.push(`missing \"${phrase}\"`);
      }
      if (
        scenario.mustMentionAny.length > 0 &&
        !scenario.mustMentionAny.some((phrase) => text.includes(phrase.toLowerCase()))
      ) {
        scenarioFailures.push(`missing any of: ${scenario.mustMentionAny.join(", ")}`);
      }
      for (const phrase of scenario.mustNotMention) {
        if (text.includes(phrase.toLowerCase())) scenarioFailures.push(`unsafe phrase \"${phrase}\"`);
      }
      if (!Array.isArray(payload.findings) || payload.findings.length === 0) {
        scenarioFailures.push("no structured findings");
      }
      if (!Array.isArray(payload.actionPlan) || payload.actionPlan.length === 0) {
        scenarioFailures.push("no action plan");
      }
      if (!Array.isArray(payload.evidenceLinks) || payload.evidenceLinks.length === 0) {
        scenarioFailures.push("no evidence links");
      }
      if (typeof payload.responseId !== "string" || payload.responseId.length === 0) {
        scenarioFailures.push("no traceable response ID");
      }
      if (durationMs > 60_000) scenarioFailures.push(`response exceeded 60 seconds (${durationMs}ms)`);
    }

    const result = scenarioFailures.length === 0 ? "PASS" : "FAIL";
    console.log(`${result} ${scenario.id} (${durationMs}ms)${scenarioFailures.length ? ` — ${scenarioFailures.join("; ")}` : ""}`);
    failures.push(...scenarioFailures.map((failure) => `${scenario.id}: ${failure}`));
  }

  const p50 = percentile(durations, 0.5);
  const p95 = percentile(durations, 0.95);
  const maximum = Math.max(...durations);
  console.log(`VOR-033 Ask Vorta latency: p50=${p50}ms p95=${p95}ms max=${maximum}ms across ${durations.length} questions.`);

  expect(durations, "All golden questions must execute.").toHaveLength(scenarios.length);
  expect(p95, `Ask Vorta p95 latency must remain below 45 seconds; measured ${p95}ms.`).toBeLessThan(45_000);
  expect(failures, failures.join("\n")).toEqual([]);
});
