import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scenarios = JSON.parse(
  readFileSync(resolve(root, "tests/evals/vor-033-demo-golden.json"), "utf8"),
);
if (!Array.isArray(scenarios) || scenarios.length !== 24) {
  throw new Error(`Expected exactly 24 VOR-033 golden scenarios, found ${scenarios?.length ?? 0}.`);
}

const baseUrl = (process.env.VORTA_EVAL_BASE_URL || "https://vorta-app.netlify.app").replace(/\/$/, "");
const siteId = process.env.VORTA_EVAL_SITE_ID || "11000000-0000-0000-0000-000000000001";
const expectedProductionCommit = String(process.env.VORTA_EXPECTED_PRODUCTION_COMMIT || "").trim();
const delayMs = Math.max(15_000, Number(process.env.VORTA_EVAL_DELAY_MS || 15_000));
const outputPath = resolve(root, "artifacts/vor-033-production-golden-human-quality.json");
const auth = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY,
  email: process.env.VORTA_E2E_EMAIL,
  password: process.env.VORTA_E2E_PASSWORD,
};

mkdirSync(resolve(root, "artifacts"), { recursive: true });
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function strings(values) {
  return values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim());
}

function visibleDecisionText(answer) {
  return strings([
    answer?.directAnswer,
    ...(answer?.decisionSummary || []).flatMap((item) => [item?.label, item?.value]),
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
  ]).join("\n").toLowerCase();
}

function allAnswerText(answer) {
  return `${visibleDecisionText(answer)}\n${strings(answer?.evidence || []).join("\n")}\n${strings(
    (answer?.sources || []).flatMap((item) =>
      typeof item === "string" ? [item] : [item?.label, item?.title, item?.source],
    ),
  ).join("\n")}`.toLowerCase();
}

async function signIn() {
  const missing = Object.entries(auth).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Missing protected auth configuration: ${missing.join(", ")}`);
  const response = await fetch(`${auth.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: auth.anonKey },
    body: JSON.stringify({ email: auth.email, password: auth.password }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Protected evaluation user sign-in failed with HTTP ${response.status}`);
  }
  return payload.access_token;
}

async function productionBuild() {
  const response = await fetch(`${baseUrl}/vorta-build.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Production build metadata failed with HTTP ${response.status}`);
  const payload = await response.json();
  const commit = String(payload?.commit || payload?.gitCommit || payload?.sha || "").trim();
  if (expectedProductionCommit && commit !== expectedProductionCommit) {
    throw new Error(`Production commit drift: expected ${expectedProductionCommit}, received ${commit || "none"}.`);
  }
  return payload;
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
    return {
      response: null,
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function askWithRecovery(question, initialToken) {
  let token = initialToken;
  let reauthenticated = false;
  let rateLimitRetries = 0;
  let result = await ask(question, token);
  if (result.response?.status === 401) {
    token = await signIn();
    reauthenticated = true;
    result = await ask(question, token);
  }
  while (result.response?.status === 429 && rateLimitRetries < 5) {
    const retryAfterSeconds = Math.max(
      15,
      Math.min(
        310,
        Number(result.response.headers.get("retry-after") || result.payload?.retryAfterSeconds || 65),
      ),
    );
    await sleep((retryAfterSeconds + 5) * 1000);
    rateLimitRetries += 1;
    result = await ask(question, token);
  }
  return { ...result, token, reauthenticated, rateLimitRetries };
}

function selectedAnswer(payload) {
  if (!payload || typeof payload !== "object") return null;
  return {
    directAnswer: payload.directAnswer ?? null,
    decisionSummary: payload.decisionSummary ?? [],
    findings: payload.findings ?? [],
    recommendedActions: payload.recommendedActions ?? [],
    actionPlan: payload.actionPlan ?? [],
    evidence: payload.evidence ?? [],
    evidenceLinks: payload.evidenceLinks ?? [],
    sources: payload.sources ?? [],
    missingData: payload.missingData ?? [],
    followUpQuestions: payload.followUpQuestions ?? [],
  };
}

const report = {
  audit: "VOR-033 refreshed-dataset 24-question production visible-decision quality",
  auditSourceCommit: process.env.GITHUB_SHA || null,
  productionUrl: baseUrl,
  productionBuild: await productionBuild(),
  siteId,
  startedAt: new Date().toISOString(),
  completedAt: null,
  summary: null,
  results: [],
};
const persist = () => writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
persist();

let token = await signIn();
const contradictionPattern = /\b(?:too large|could not (?:support|determine|identify|confirm)|cannot (?:determine|identify|confirm)|unable to (?:determine|identify|confirm)|insufficient evidence|evidence (?:is )?unavailable|decision pack (?:is )?unavailable)\b/i;

for (let index = 0; index < scenarios.length; index += 1) {
  const scenario = scenarios[index];
  if (index > 0) await sleep(delayMs);
  const startedAt = Date.now();
  const request = await askWithRecovery(scenario.question, token);
  token = request.token;
  const durationMs = Date.now() - startedAt;
  const failures = [];
  const { response, payload, error } = request;

  if (error) failures.push(`request failed: ${error}`);
  if (!response) failures.push("no HTTP response");
  if (response && !response.ok) failures.push(`HTTP ${response.status}: ${payload?.error || "request failed"}`);

  if (response?.ok && payload) {
    const visible = visibleDecisionText(payload);
    const complete = allAnswerText(payload);
    const usedTools = new Set(payload.toolsUsed || []);
    const coveredTools = new Set(payload.coveredTools || []);
    const hasTool = (tool) => usedTools.has(tool) || coveredTools.has(tool);

    for (const tool of scenario.expectedTools || []) {
      if (!hasTool(tool)) failures.push(`missing tool ${tool}`);
    }
    for (const phrase of scenario.mustMention || []) {
      if (!visible.includes(phrase.toLowerCase())) {
        failures.push(`visible decision missing \"${phrase}\"`);
      }
    }
    if (
      scenario.mustMentionAny?.length &&
      !scenario.mustMentionAny.some((phrase) => visible.includes(phrase.toLowerCase()))
    ) {
      failures.push(`visible decision missing any of: ${scenario.mustMentionAny.join(", ")}`);
    }
    for (const phrase of scenario.mustNotMention || []) {
      if (complete.includes(phrase.toLowerCase())) failures.push(`unsafe phrase \"${phrase}\"`);
    }
    if (contradictionPattern.test(String(payload.directAnswer || ""))) {
      failures.push("visible direct answer contains a fail-closed/insufficient-evidence contradiction despite complete governed storyline evidence");
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
    observed: {
      intent: payload?.intent || payload?.questionPlan?.intent || null,
      routeKey: payload?.routeKey || null,
      routingMode: payload?.routingMode || null,
      toolsUsed: payload?.toolsUsed || [],
      coveredTools: payload?.coveredTools || [],
      confidence: Number.isFinite(Number(payload?.confidence)) ? Number(payload.confidence) : null,
      responseId: payload?.responseId || null,
      reauthenticated: request.reauthenticated,
      rateLimitRetries: request.rateLimitRetries,
    },
    expected: {
      tools: scenario.expectedTools || [],
      mustMention: scenario.mustMention || [],
      mustMentionAny: scenario.mustMentionAny || [],
      mustNotMention: scenario.mustNotMention || [],
    },
    answer: selectedAnswer(payload),
  };
  report.results.push(result);
  persist();
  console.log(
    `${result.passed ? "PASS" : "FAIL"} ${String(index + 1).padStart(2, "0")}/24 ${scenario.id} (${durationMs}ms, retries=${request.rateLimitRetries})${failures.length ? ` — ${failures.join("; ")}` : ""}`,
  );
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
  rateLimitRetries: report.results.reduce((total, item) => total + item.observed.rateLimitRetries, 0),
  reauthentications: report.results.filter((item) => item.observed.reauthenticated).length,
  visibleDecisionContradictions: report.results.filter((item) =>
    item.failures.some((failure) => failure.includes("contradiction")),
  ).length,
};
persist();
console.log(JSON.stringify(report.summary, null, 2));
if (passed !== scenarios.length) process.exit(1);
