import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const scenarios = JSON.parse(
  readFileSync(resolve(root, "tests/evals/ask-vorta-live-golden.json"), "utf8"),
);
const baseUrl = process.env.VORTA_EVAL_BASE_URL || "https://vorta-app.netlify.app";
let token = process.env.VORTA_EVAL_TOKEN;
const siteId =
  process.env.VORTA_EVAL_SITE_ID || "11000000-0000-0000-0000-000000000001";
const limit = Math.max(
  1,
  Math.min(scenarios.length, Number(process.env.VORTA_EVAL_LIMIT || scenarios.length)),
);

if (!token) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.VORTA_E2E_EMAIL;
  const password = process.env.VORTA_E2E_PASSWORD;
  if (!supabaseUrl || !anonKey || !email || !password) {
    console.error(
      "Provide VORTA_EVAL_TOKEN or the protected VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VORTA_E2E_EMAIL and VORTA_E2E_PASSWORD variables.",
    );
    process.exit(2);
  }
  const signIn = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });
  const session = await signIn.json().catch(() => null);
  token = session?.access_token;
  if (!signIn.ok || !token) {
    console.error("The protected Ask Vorta evaluation user could not sign in.");
    process.exit(2);
  }
}

function answerText(answer) {
  return [
    answer.directAnswer,
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
    ...(answer.actionPlan || []).flatMap((item) => [
      item.action,
      item.owner,
      item.expectedImpact,
      item.verification,
    ]),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

const results = [];
for (const scenario of scenarios.slice(0, limit)) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/ask-vorta`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      question: scenario.question,
      role: "maintenance-manager",
      siteId,
      history: [],
      pageContext: { path: "/dashboard", timezone: "Europe/London" },
    }),
  });
  const payload = await response.json().catch(() => null);
  const failures = [];
  if (!response.ok || !payload) {
    failures.push(`HTTP ${response.status}: ${payload?.error || "invalid JSON"}`);
  } else {
    const text = answerText(payload);
    const usedTools = new Set(payload.toolsUsed || []);
    for (const tool of scenario.expectedTools) {
      if (!usedTools.has(tool)) failures.push(`missing tool ${tool}`);
    }
    for (const phrase of scenario.mustMention) {
      if (!text.includes(phrase.toLowerCase())) failures.push(`missing "${phrase}"`);
    }
    if (
      scenario.mustMentionAny?.length &&
      !scenario.mustMentionAny.some((phrase) => text.includes(phrase.toLowerCase()))
    ) {
      failures.push(`missing any of: ${scenario.mustMentionAny.join(", ")}`);
    }
    for (const phrase of scenario.mustNotMention || []) {
      if (text.includes(phrase.toLowerCase())) failures.push(`unsafe phrase "${phrase}"`);
    }
    if (!Array.isArray(payload.findings) || payload.findings.length === 0) {
      failures.push("no structured findings");
    }
    if (!Array.isArray(payload.actionPlan) || payload.actionPlan.length === 0) {
      failures.push("no action plan");
    }
    if (!Array.isArray(payload.evidenceLinks)) failures.push("no evidence links");
    if (!payload.responseId) failures.push("no traceable response ID");
  }
  results.push({
    id: scenario.id,
    passed: failures.length === 0,
    durationMs: Date.now() - startedAt,
    failures,
  });
  console.log(
    `${failures.length ? "FAIL" : "PASS"} ${scenario.id} (${Date.now() - startedAt}ms)${
      failures.length ? ` — ${failures.join("; ")}` : ""
    }`,
  );
}

const passed = results.filter((item) => item.passed).length;
console.log(`Ask Vorta live eval: ${passed}/${results.length} passed.`);
if (passed !== results.length) process.exit(1);
