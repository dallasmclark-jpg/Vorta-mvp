import { existsSync, readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const backendPaths = [
  "netlify/functions/ask-vorta.mts",
  "netlify/functions/ask-vorta/contracts.mts",
  "netlify/functions/ask-vorta/phase-runtime.mts",
  "netlify/functions/ask-vorta/route-planning.mts",
  "netlify/functions/ask-vorta/decision-answer.mts",
  "netlify/functions/ask-vorta/runtime.mts",
  "netlify/functions/ask-vorta/telemetry.mts",
];
const backend = backendPaths
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const telemetry = readFileSync("netlify/functions/ask-vorta/telemetry.mts", "utf8");
const ratePolicy = readFileSync(
  "netlify/functions/ask-vorta/rate-limit-policy.mts",
  "utf8",
);
const service = readFileSync("src/screens/AiOperations/vortaAgentService.ts", "utf8");
const assistant = readFileSync("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260803202500_vor_048_route_latency_feedback.sql",
  "utf8",
);
const evals = JSON.parse(
  readFileSync("tests/evals/vor-048-shift-cover-routing.json", "utf8"),
);
const browser = readFileSync("tests/browser/vor-048-feedback.spec.ts", "utf8");

const lifecycle = [
  packageJson.scripts.predev,
  packageJson.scripts["build:metadata"],
  packageJson.scripts["test:contracts"],
].join("\n");

const checks = [
  [!lifecycle.includes("vor-048-integrate-routing-telemetry-feedback.mjs"), "VOR-048 behaviour is canonical source rather than a build transform"],
  [backend.includes('type AskVortaPhase = "planner" | "evidence" | "answer"'), "planner, evidence and answer phases are explicit"],
  [backend.includes("Promise.race([operation(controller.signal), timeoutPromise])"), "phase timeouts reject even when an evidence client ignores abort"],
  [backend.includes('intent === "shift_cover_risk"'), "Shift Cover has a deterministic evidence answer"],
  [backend.includes('"shift_cover",\n      "shift_cover_risk",\n      "get_shift_cover"'), "natural Shift Cover requests use one canonical tool route"],
  [backend.includes('!/\\bshift-cover\\b/.test(request.pageContext.path)') && backend.includes("site_threat_prioritization") && backend.includes("shiftCoverPageContext"), "Shift Cover page context deterministically outranks the broad site-priority route"],
  [backend.includes("inheritedShiftCoverContext"), "dated Shift Cover follow-ups retain their operational context"],
  [backend.includes("document cover|insurance cover|cover image|cover photo|cover page"), "non-maintenance cover wording is excluded"],
  [telemetry.includes("route_key: input.routeKey") && telemetry.includes("routing_mode:") && telemetry.includes("planner_ms: input.plannerMs") && telemetry.includes("evidence_ms: input.evidenceMs") && telemetry.includes("answer_ms: input.answerMs"), "canonical route and phase telemetry are persisted"],
  [telemetry.includes("tool_count: input.toolCount") && telemetry.includes("tool_round_count: input.toolRoundCount"), "tool counts and rounds are persisted"],
  [backend.includes('status: "rate_limited"') && backend.includes('"timed_out"'), "rate-limited and timed-out requests remain traceable"],
  [ratePolicy.includes("ASK_VORTA_RATE_LIMIT_WINDOW_MINUTES = 5") && ratePolicy.includes("ASK_VORTA_RATE_LIMIT_REQUESTS = 60"), "Ask Vorta allows a high-volume interactive burst without acting as a practical daily cap"],
  [telemetry.includes('.neq("status", "rate_limited")'), "blocked retries do not count toward subsequent Ask Vorta capacity checks"],
  [migration.includes("feedback_category") && migration.includes("ask_vorta_interactions_route_key_check"), "database enforces bounded route and feedback values"],
  [migration.includes("revoke all on table public.ask_vorta_interactions from authenticated") && migration.includes("grant select, insert, update"), "authenticated interaction grants are reduced to minimum required"],
  [service.includes("export type AskVortaFeedbackCategory") && service.includes("feedback_category"), "frontend service sends a bounded feedback category"],
  [assistant.includes("What was not useful?") && assistant.includes("Skip reason") && assistant.includes("Submit feedback"), "not-helpful feedback offers optional category and detail"],
  [assistant.includes('onClick={() => void recordFeedback("helpful")}'), "helpful feedback remains one tap"],
  [assistant.includes('data-vorta-ai-feedback="true"') && assistant.includes("<section") && assistant.includes("</section>"), "phone feedback renders outside compact div pruning without extra CSS"],
  [browser.includes("feedback_category") && browser.includes("feedback_reason"), "authenticated browser coverage checks the feedback payload"],
  [Array.isArray(evals) && evals.length >= 6, "permanent Shift Cover route and latency scenarios exist"],
  [evals.every((scenario) => scenario.expectedTools?.includes("get_shift_cover")), "all VOR-048 scenarios require Shift Cover evidence"],
  [evals.some((scenario) => scenario.expectedTools?.includes("get_site_maintenance_plan")), "plan feasibility retains its justified second tool"],
  [evals.every((scenario) => scenario.maxDurationMs <= 12_000), "VOR-048 live scenarios enforce a tighter post-change Shift Cover budget"],
];

const failures = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} - ${label}`);
}
if (failures.length) process.exit(1);
console.log(`VOR-048 routing, telemetry and feedback contracts passed: ${checks.length}/${checks.length}.`);
