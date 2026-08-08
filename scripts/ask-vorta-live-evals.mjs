import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scenarioFile = process.argv[2] || process.env.VORTA_EVAL_SCENARIOS || "tests/evals/ask-vorta-live-golden.json";
const scenarios = JSON.parse(readFileSync(resolve(root, scenarioFile), "utf8"));
const baseUrl = process.env.VORTA_EVAL_BASE_URL || "https://vorta-app.netlify.app";
let token = process.env.VORTA_EVAL_TOKEN;
const siteId = process.env.VORTA_EVAL_SITE_ID || "11000000-0000-0000-0000-000000000001";
const offset = Math.max(0, Math.min(scenarios.length, Number(process.env.VORTA_EVAL_OFFSET || 0)));
const limit = Math.max(1, Math.min(scenarios.length - offset || 1, Number(process.env.VORTA_EVAL_LIMIT || scenarios.length)));
const delayMs = Math.max(0, Number(process.env.VORTA_EVAL_DELAY_MS || 0));
const rateLimitRetryMs = Math.max(
  0,
  Number(process.env.VORTA_EVAL_RATE_LIMIT_RETRY_MS || 0),
);
const rateLimitMaxRetries = Math.max(
  0,
  Math.min(5, Number(process.env.VORTA_EVAL_RATE_LIMIT_MAX_RETRIES || 0)),
);
const selectedScenarios = scenarios.slice(offset, offset + limit);
const authConfig = {
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY,
  email: process.env.VORTA_E2E_EMAIL,
  password: process.env.VORTA_E2E_PASSWORD,
};

function hasProtectedAuthConfig() {
  return Boolean(
    authConfig.supabaseUrl &&
      authConfig.anonKey &&
      authConfig.email &&
      authConfig.password,
  );
}

async function signInEvaluationUser() {
  if (!hasProtectedAuthConfig()) return null;
  const signIn = await fetch(`${authConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: authConfig.anonKey },
    body: JSON.stringify({ email: authConfig.email, password: authConfig.password }),
  });
  const session = await signIn.json().catch(() => null);
  if (!signIn.ok || !session?.access_token) return null;
  return session.access_token;
}

if (!token) {
  if (!hasProtectedAuthConfig()) {
    console.error(
      "Provide VORTA_EVAL_TOKEN or the protected VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VORTA_E2E_EMAIL and VORTA_E2E_PASSWORD variables.",
    );
    process.exit(2);
  }
  token = await signInEvaluationUser();
  if (!token) {
    console.error("The protected Ask Vorta evaluation user could not sign in.");
    process.exit(2);
  }
}

function visibleDecisionText(answer) {
  return [
    answer?.directAnswer,
    ...(answer?.decisionSummary || []).flatMap((item) => [item?.label, item?.value]),
    ...(answer?.findings || []).flatMap((item) => [item?.title, item?.detail]),
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

function visibleDecisionContradictions(answer) {
  const visible = visibleDecisionText(answer);
  const evidence = (answer?.evidence || [])
    .filter((value) => typeof value === "string")
    .join("\n")
    .toLowerCase();
  const failures = [];
  if (
    /(?:cannot|can’t|can't|unable to) (?:confirm|verify|identify)[^.]{0,120}(?:engineer|qualified|capability)/.test(visible) &&
    /priority capability evidence/.test(evidence)
  ) {
    failures.push("visible answer denies capability evidence present in the response");
  }
  if (
    /(?:cannot|can’t|can't|unable to) (?:confirm|verify|identify)[^.]{0,120}(?:spare|part|blocking)/.test(visible) &&
    /priority spare evidence/.test(evidence)
  ) {
    failures.push("visible answer denies spare evidence present in the response");
  }
  if (
    /(?:decision pack|equipment evidence|authorised result)[^.]{0,120}(?:unavailable|too large)/.test(visible) &&
    /priority (?:capability|spare|document) evidence|work evidence/.test(evidence)
  ) {
    failures.push("visible answer claims the equipment decision is unavailable despite decisive evidence");
  }
  return failures;
}

function answerText(answer) {
  return [
    answer.directAnswer,
    ...(answer.decisionSummary || []).flatMap((item) => [item.label, item.value]),
    ...(answer.evidence || []),
    ...(answer.findings || []).flatMap((item) => [item.title, item.detail]),
    ...(answer.coverOptions || []).flatMap((item) => [
      ...(item.engineerNames || []),
      item.shift,
      item.reason,
      ...(item.skillsCovered || []),
      ...(item.assetsProtected || []),
      item.projectedImpact,
      item.remainingRisk,
      item.caveat,
    ]),
    ...(answer.recommendedActions || []),
    ...(answer.actionPlan || []).flatMap((item) => [
      item.action,
      item.owner,
      item.expectedImpact,
      item.verification,
    ]),
  ].filter(Boolean).join("\n").toLowerCase();
}

function boundedAnswerSnapshot(answer) {
  if (!answer || typeof answer !== "object") return null;
  const text = (value, limit = 2_000) =>
    typeof value === "string" ? value.slice(0, limit) : null;
  const objectItems = (value, limit) =>
    Array.isArray(value)
      ? value.slice(0, limit).filter((item) => item && typeof item === "object")
      : [];
  const textItems = (value, limit) =>
    Array.isArray(value)
      ? value
          .filter((item) => typeof item === "string")
          .slice(0, limit)
          .map((item) => item.slice(0, 1_000))
      : [];

  return {
    responseId: text(answer.responseId, 200),
    directAnswer: text(answer.directAnswer),
    decisionSummary: objectItems(answer.decisionSummary, 5).map((item) => ({
      label: text(item.label, 300),
      value: text(item.value, 1_500),
    })),
    findings: objectItems(answer.findings, 8).map((item) => ({
      category: text(item.category, 100),
      severity: text(item.severity, 100),
      title: text(item.title, 500),
      detail: text(item.detail, 1_500),
    })),
    actionPlan: objectItems(answer.actionPlan, 6).map((item) => ({
      priority: text(item.priority, 100),
      action: text(item.action, 1_000),
      owner: text(item.owner, 300),
      expectedImpact: text(item.expectedImpact, 1_000),
      verification: text(item.verification, 1_000),
    })),
    missingData: textItems(answer.missingData, 8),
    followUpQuestions: textItems(answer.followUpQuestions, 3),
  };
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function executeScenarioRequest(scenario, bearerToken, requestTimeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/ask-vorta`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${bearerToken}` },
      body: JSON.stringify({
        question: scenario.question,
        role: "maintenance-manager",
        siteId,
        history: scenario.history || [],
        pageContext: {
          path: scenario.path || "/dashboard",
          timezone: scenario.timezone || "Europe/London",
        },
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    return { response, payload, error: null };
  } catch (error) {
    return {
      response: null,
      payload: null,
      error: error instanceof Error ? error.message : "request failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function retryDelayForRateLimit(requestResult) {
  const retryAfterValue =
    requestResult.response?.headers.get("retry-after") ||
    requestResult.payload?.retryAfterSeconds ||
    null;
  const retryAfterMs = Number.isFinite(Number(retryAfterValue))
    ? Math.max(0, Number(retryAfterValue) * 1_000 + 1_000)
    : 0;
  return Math.max(rateLimitRetryMs, retryAfterMs);
}

function isUsageExceeded(requestResult) {
  return (
    requestResult.response?.status === 503 &&
    String(requestResult.payload?.error ?? "").trim().toLowerCase() ===
      "usage_exceeded"
  );
}

function isRetryableCapacityResponse(requestResult) {
  return requestResult.response?.status === 429 || isUsageExceeded(requestResult);
}

const results = [];
let blockedByRateLimit = false;
let blockedByCapacity = false;
for (const [batchIndex, scenario] of selectedScenarios.entries()) {
  if (batchIndex > 0 && delayMs > 0) await sleep(delayMs);

  const startedAt = Date.now();
  const requestTimeoutMs = Math.max(
    5_000,
    Number(scenario.requestTimeoutMs || 45_000),
  );
  const failures = [];
  let reauthentications = 0;
  let rateLimitRetries = 0;
  let rateLimitWaitMs = 0;
  let requestResult = await executeScenarioRequest(scenario, token, requestTimeoutMs);

  if (requestResult.response?.status === 401 && hasProtectedAuthConfig()) {
    const recoveredToken = await signInEvaluationUser();
    if (recoveredToken) {
      token = recoveredToken;
      reauthentications += 1;
      requestResult = await executeScenarioRequest(scenario, token, requestTimeoutMs);
    }
  }

  while (
    isRetryableCapacityResponse(requestResult) &&
    rateLimitRetries < rateLimitMaxRetries
  ) {
    const pauseMs = retryDelayForRateLimit(requestResult);
    const capacityLabel = isUsageExceeded(requestResult)
    ? "Netlify usage capacity"
    : "Rate limit";
    rateLimitRetries += 1;
    rateLimitWaitMs += pauseMs;
    console.warn(
      `${capacityLabel} reached for ${scenario.id}; waiting ${pauseMs}ms before retry ${rateLimitRetries}/${rateLimitMaxRetries}.`,
    );
    await sleep(pauseMs);
    requestResult = await executeScenarioRequest(scenario, token, requestTimeoutMs);
    if (requestResult.response?.status === 401 && hasProtectedAuthConfig()) {
      const recoveredToken = await signInEvaluationUser();
      if (recoveredToken) {
        token = recoveredToken;
        reauthentications += 1;
        requestResult = await executeScenarioRequest(
          scenario,
          token,
          requestTimeoutMs,
        );
      }
    }
  }

  const { response, payload, error } = requestResult;
  if (error) failures.push(`request failed: ${error}`);

  if (isUsageExceeded(requestResult)) {
  blockedByCapacity = true;
  failures.push("platform usage capacity exceeded after configured retries");
} else if (response?.status === 429) {
    const retryAfter = response.headers.get("retry-after") || payload?.retryAfterSeconds || null;
    blockedByRateLimit = true;
    failures.push(`rate limited${retryAfter ? `; retry after ${retryAfter}s` : ""}`);
  } else if (response && (!response.ok || !payload)) {
    failures.push(`HTTP ${response.status}: ${payload?.error || "invalid JSON"}`);
  } else if (!response && failures.length === 0) {
    failures.push("request failed without a response");
  }

  const activeDurationMs = Math.max(
    0,
    Date.now() - startedAt - rateLimitWaitMs,
  );

  if (response?.ok && payload) {
    const text = answerText(payload);
    const visibleText = visibleDecisionText(payload);
    const requireVisibleDecision =
      scenario.requireVisibleDecision === true ||
      /vor-033-demo-golden\.json$/.test(scenarioFile);
    const assertionText = requireVisibleDecision ? visibleText : text;
    const directAnswerText = String(payload.directAnswer ?? "").toLowerCase();
    const usedTools = new Set(payload.toolsUsed || []);
    // Decision-pack covered tools count as satisfied evidence without inflating actual tool-call limits.
    const coveredTools = new Set(payload.coveredTools || []);
    const hasEvidenceTool = (tool) =>
      usedTools.has(tool) || coveredTools.has(tool);
    for (const tool of scenario.expectedTools || []) {
      if (!hasEvidenceTool(tool)) failures.push(`missing tool ${tool}`);
    }
    if (scenario.expectedAnyTools?.length && !scenario.expectedAnyTools.some((tool) => hasEvidenceTool(tool))) {
      failures.push(`missing any tool: ${scenario.expectedAnyTools.join(", ")}`);
    }
    if (scenario.minimumToolCount && usedTools.size < scenario.minimumToolCount) {
      failures.push(`used ${usedTools.size} tools; expected at least ${scenario.minimumToolCount}`);
    }
    for (const phrase of scenario.mustMention || []) {
      if (!assertionText.includes(phrase.toLowerCase())) failures.push(`missing "${phrase}"`);
    }
    if (
      scenario.mustMentionAny?.length &&
      !scenario.mustMentionAny.some((phrase) => assertionText.includes(phrase.toLowerCase()))
    ) {
      failures.push(`missing any of: ${scenario.mustMentionAny.join(", ")}`);
    }
    for (const phrase of scenario.directAnswerMustMention || []) {
      if (!directAnswerText.includes(phrase.toLowerCase())) {
        failures.push(`direct answer missing "${phrase}"`);
      }
    }
    if (
      scenario.directAnswerMustMentionAny?.length &&
      !scenario.directAnswerMustMentionAny.some((phrase) =>
        directAnswerText.includes(phrase.toLowerCase()),
      )
    ) {
      failures.push(
        `direct answer missing any of: ${scenario.directAnswerMustMentionAny.join(", ")}`,
      );
    }
    for (const phrase of scenario.directAnswerMustNotMention || []) {
      if (directAnswerText.includes(phrase.toLowerCase())) {
        failures.push(`unsafe direct-answer phrase "${phrase}"`);
      }
    }
    for (const phrase of scenario.mustNotMention || []) {
      if (assertionText.includes(phrase.toLowerCase())) failures.push(`unsafe phrase "${phrase}"`);
    }
    if (requireVisibleDecision) {
      failures.push(...visibleDecisionContradictions(payload));
      if (
        /(?:decision pack|equipment evidence|authorised result)[^.]{0,120}(?:unavailable|too large)/.test(
          visibleText,
        )
      ) {
        failures.push("visible decision layer reports an unavailable or oversized equipment pack");
      }
    }

    if (
      scenario.requireFindings !== false &&
      (!Array.isArray(payload.findings) || payload.findings.length === 0)
    ) {
      failures.push("no structured findings");
    }
    if (
      scenario.requireActionPlan !== false &&
      (!Array.isArray(payload.actionPlan) || payload.actionPlan.length === 0)
    ) {
      failures.push("no action plan");
    }
    if (Number.isFinite(scenario.confidenceMin) && Number(payload.confidence) < Number(scenario.confidenceMin)) {
      failures.push(`confidence ${payload.confidence}; expected at least ${scenario.confidenceMin}`);
    }
    if (Number.isFinite(scenario.maxToolCount) && usedTools.size > Number(scenario.maxToolCount)) {
      failures.push(`used ${usedTools.size} tools; expected at most ${scenario.maxToolCount}`);
    }
    if (Number.isFinite(scenario.maxDecisionSummaryItems) && (payload.decisionSummary || []).length > Number(scenario.maxDecisionSummaryItems)) {
      failures.push(`decision summary has ${(payload.decisionSummary || []).length} items; expected at most ${scenario.maxDecisionSummaryItems}`);
    }
    if (Number.isFinite(scenario.maxFollowUpQuestions) && (payload.followUpQuestions || []).length > Number(scenario.maxFollowUpQuestions)) {
      failures.push(`follow-ups have ${(payload.followUpQuestions || []).length} items; expected at most ${scenario.maxFollowUpQuestions}`);
    }
    if (Number.isFinite(scenario.maxDurationMs) && activeDurationMs > Number(scenario.maxDurationMs)) {
      failures.push(`active duration ${activeDurationMs}ms; expected at most ${scenario.maxDurationMs}ms`);
    }
    if (!Array.isArray(payload.evidenceLinks)) failures.push("no evidence links");
    if (!payload.responseId) failures.push("no traceable response ID");
  }

  const durationMs = activeDurationMs;
  const elapsedDurationMs = Date.now() - startedAt;
  const observed = {
    intent: payload?.intent || payload?.questionPlan?.intent || null,
    tools: payload?.toolsUsed || [],
    coveredTools: payload?.coveredTools || [],
    sources: payload?.sources || [],
    confidence: Number.isFinite(Number(payload?.confidence)) ? Number(payload.confidence) : null,
    missingDataCount: Array.isArray(payload?.missingData) ? payload.missingData.length : null,
    decisionSummaryItems: Array.isArray(payload?.decisionSummary) ? payload.decisionSummary.length : null,
    followUpQuestions: Array.isArray(payload?.followUpQuestions) ? payload.followUpQuestions.length : null,
    reauthentications,
    rateLimitRetries,
    rateLimitWaitMs,
    elapsedDurationMs,
  };
  results.push({
    index: offset + batchIndex,
    id: scenario.id,
    passed: failures.length === 0,
    durationMs,
    failures,
    observed,
    visibleAnswer: boundedAnswerSnapshot(payload),
  });
  console.log(
    `${failures.length ? "FAIL" : "PASS"} ${scenario.id} (${durationMs}ms active; ${elapsedDurationMs}ms elapsed) ` +
      `${JSON.stringify(observed)}${failures.length ? ` — ${failures.join("; ")}` : ""}`,
  );

  if (blockedByRateLimit || blockedByCapacity) {
  console.error(
    blockedByCapacity
      ? "Evaluation stopped because Netlify usage capacity remained unavailable after all configured retries."
      : "Evaluation stopped because the authenticated test account reached the production rate limit after all configured retries.",
  );
  break;
}
}

const passed = results.filter((item) => item.passed).length;
console.log(`Ask Vorta live eval (${scenarioFile}, offset ${offset}): ${passed}/${results.length} passed.`);
console.log(JSON.stringify({ scenarioFile, offset, requested: selectedScenarios.length, blockedByRateLimit, blockedByCapacity, results }, null, 2));
if (blockedByRateLimit || blockedByCapacity) process.exit(3);
if (passed !== results.length) process.exit(1);
