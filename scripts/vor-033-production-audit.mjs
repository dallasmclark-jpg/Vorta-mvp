import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scenarios = JSON.parse(
  readFileSync(resolve(root, "tests/evals/vor-033-demo-golden.json"), "utf8"),
);
const baseUrl = (process.env.VORTA_EVAL_BASE_URL || "https://vorta-app.netlify.app").replace(/\/$/, "");
const siteId = process.env.VORTA_EVAL_SITE_ID || "11000000-0000-0000-0000-000000000001";
const delayMs = Math.max(0, Number(process.env.VORTA_EVAL_DELAY_MS || 10_000));
const outputPath = resolve(root, "artifacts/vor-033-production-audit.json");
const authConfig = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY,
  email: process.env.VORTA_E2E_EMAIL,
  password: process.env.VORTA_E2E_PASSWORD,
};

mkdirSync(resolve(root, "artifacts"), { recursive: true });

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function answerText(answer) {
  return [
    answer?.directAnswer,
    ...(answer?.decisionSummary || []).flatMap((item) => [item?.label, item?.value]),
    ...(answer?.evidence || []),
    ...(answer?.findings || []).flatMap((item) => [item?.title, item?.detail]),
    ...(answer?.coverOptions || []).flatMap((item) => [
      ...(item?.engineerNames || []),
      item?.shift,
      item?.reason,
      ...(item?.skillsCovered || []),
      ...(item?.assetsProtected || []),
      item?.projectedImpact,
      item?.remainingRisk,
      item?.caveat,
    ]),
    ...(answer?.recommendedActions || []),
    ...(answer?.actionPlan || []).flatMap((item) => [
      item?.action,
      item?.owner,
      item?.expectedImpact,
      item?.verification,
    ]),
  ]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join("\n")
    .toLowerCase();
}

async function signIn() {
  const missing = Object.entries(authConfig).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing protected auth configuration: ${missing.join(", ")}`);
  const response = await fetch(`${authConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: authConfig.anonKey },
    body: JSON.stringify({ email: authConfig.email, password: authConfig.password }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Protected evaluation user sign-in failed with HTTP ${response.status}`);
  }
  return payload.access_token;
}

async function ask(question, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await fetch(`${baseUrl}/api/ask-vorta`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        question,
        role: "maintenance-manager",
        siteId,
        history: [],
        pageContext: { path: "/dashboard", timezone: "Europe/London" },
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    return { response, payload, error: null };
  } catch (error) {
    return { response: null, payload: null, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function selectedAnswer(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    directAnswer: payload.directAnswer ?? null,
    decisionSummary: payload.decisionSummary ?? [],
    evidence: payload.evidence ?? [],
    findings: payload.findings ?? [],
    coverOptions: payload.coverOptions ?? [],
    recommendedActions: payload.recommendedActions ?? [],
    actionPlan: payload.actionPlan ?? [],
    evidenceLinks: payload.evidenceLinks ?? [],
    sources: payload.sources ?? [],
    missingData: payload.missingData ?? [],
    followUpQuestions: payload.followUpQuestions ?? [],
  };
}

const report = {
  audit: "VOR-033 exact 24-question authenticated production verification",
  sourceCommit: process.env.GITHUB_SHA || null,
  productionUrl: baseUrl,
  siteId,
  startedAt: new Date().toISOString(),
  completedAt: null,
  summary: null,
  results: [],
};

function persist() {
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}

let token = await signIn();

for (let index = 0; index < scenarios.length; index += 1) {
  const scenario = scenarios[index];
  if (index > 0) await sleep(delayMs);
  const startedAt = Date.now();
  let request = await ask(scenario.question, token);
  let reauthenticated = false;
  let rateLimitRetry = false;

  if (request.response?.status === 401) {
    token = await signIn();
    reauthenticated = true;
    request = await ask(scenario.question, token);
  }

  if (request.response?.status === 429) {
    const retryAfterSeconds = Math.max(
      15,
      Math.min(180, Number(request.response.headers.get("retry-after") || request.payload?.retryAfterSeconds || 60)),
    );
    await sleep((retryAfterSeconds + 5) * 1000);
    rateLimitRetry = true;
    request = await ask(scenario.question, token);
  }

  const durationMs = Date.now() - startedAt;
  const failures = [];
  const { response, payload, error } = request;
  if (error) failures.push(`request failed: ${error}`);
  if (!response) failures.push("no HTTP response");
  if (response && !response.ok) failures.push(`HTTP ${response.status}: ${payload?.error || "request failed"}`);

  if (response?.ok && payload) {
    const text = answerText(payload);
    const usedTools = new Set(payload.toolsUsed || []);
    const coveredTools = new Set(payload.coveredTools || []);
    const hasTool = (tool) => usedTools.has(tool) || coveredTools.has(tool);
    for (const tool of scenario.expectedTools || []) {
      if (!hasTool(tool)) failures.push(`missing tool ${tool}`);
    }
    for (const phrase of scenario.mustMention || []) {
      if (!text.includes(phrase.toLowerCase())) failures.push(`missing \"${phrase}\"`);
    }
    if (
      scenario.mustMentionAny?.length &&
      !scenario.mustMentionAny.some((phrase) => text.includes(phrase.toLowerCase()))
    ) {
      failures.push(`missing any of: ${scenario.mustMentionAny.join(", ")}`);
    }
    for (const phrase of scenario.mustNotMention || []) {
      if (text.includes(phrase.toLowerCase())) failures.push(`unsafe phrase \"${phrase}\"`);
    }
    if (!Array.isArray(payload.findings) || payload.findings.length === 0) failures.push("no structured findings");
    if (!Array.isArray(payload.actionPlan) || payload.actionPlan.length === 0) failures.push("no action plan");
    if (!Array.isArray(payload.evidenceLinks) || payload.evidenceLinks.length === 0) failures.push("no evidence links");
    if (!payload.responseId) failures.push("no traceable response ID");
  }

  const result = {
    index: index + 1,
    id: scenario.id,
    question: scenario.question,
    passed: failures.length === 0,
    durationMs,
    httpStatus: response?.status ?? null,
    failures,
    expected: {
      tools: scenario.expectedTools || [],
      mustMention: scenario.mustMention || [],
      mustMentionAny: scenario.mustMentionAny || [],
      mustNotMention: scenario.mustNotMention || [],
    },
    observed: {
      intent: payload?.intent || payload?.questionPlan?.intent || null,
      routeKey: payload?.routeKey || null,
      routingMode: payload?.routingMode || null,
      toolsUsed: payload?.toolsUsed || [],
      coveredTools: payload?.coveredTools || [],
      confidence: Number.isFinite(Number(payload?.confidence)) ? Number(payload.confidence) : null,
      responseId: payload?.responseId || null,
      reauthenticated,
      rateLimitRetry,
    },
    answer: selectedAnswer(payload),
  };
  report.results.push(result);
  persist();
  console.log(`${result.passed ? "PASS" : "FAIL"} ${String(index + 1).padStart(2, "0")}/24 ${scenario.id} (${durationMs}ms)${failures.length ? ` — ${failures.join("; ")}` : ""}`);
}

const durations = report.results.map((item) => item.durationMs);
const passed = report.results.filter((item) => item.passed).length;
report.completedAt = new Date().toISOString();
report.summary = {
  requested: scenarios.length,
  executed: report.results.length,
  passed,
  failed: report.results.length - passed,
  p50Ms: percentile(durations, 0.5),
  p95Ms: percentile(durations, 0.95),
  maximumMs: durations.length ? Math.max(...durations) : null,
  rateLimitRetries: report.results.filter((item) => item.observed.rateLimitRetry).length,
  reauthentications: report.results.filter((item) => item.observed.reauthenticated).length,
};
persist();
console.log(JSON.stringify(report.summary, null, 2));
if (passed !== scenarios.length) process.exit(1);
