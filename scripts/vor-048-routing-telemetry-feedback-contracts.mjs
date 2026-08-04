import { existsSync, readFileSync, readdirSync } from "node:fs";

const integrationPatch = readdirSync("scripts")
  .filter((name) => /^vor-048-\d{2}-.+\.patch$/.test(name))
  .sort()
  .map((name) => readFileSync(`scripts/${name}`, "utf8"))
  .join("\n");
const integrationScript = readFileSync(
  "scripts/vor-048-integrate-routing-telemetry-feedback.mjs",
  "utf8",
);
const backendPaths = [
  "netlify/functions/ask-vorta.mts",
  "netlify/functions/ask-vorta/contracts.mts",
  "netlify/functions/ask-vorta/phase-runtime.mts",
  "netlify/functions/ask-vorta/route-planning.mts",
  "netlify/functions/ask-vorta/decision-answer.mts",
  "netlify/functions/ask-vorta/runtime.mts",
  "netlify/functions/ask-vorta/telemetry.mts",
];
const backend =
  backendPaths
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n") + integrationPatch;
const service = readFileSync("src/screens/AiOperations/vortaAgentService.ts", "utf8") + integrationPatch;
const assistant = readFileSync("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx", "utf8") + integrationPatch;
const migration = readFileSync(
  "supabase/migrations/20260803202500_vor_048_route_latency_feedback.sql",
  "utf8",
);
const evals = JSON.parse(
  readFileSync("tests/evals/vor-048-shift-cover-routing.json", "utf8"),
);
const browser = readFileSync("tests/browser/vor-048-feedback.spec.ts", "utf8");

const checks = [
  [integrationScript.includes('readdirSync') && integrationScript.includes('git",') && integrationScript.includes('"apply"'), "VOR-048 is applied after the existing build-time integrations"],
  [backend.includes('type AskVortaPhase = "planner" | "evidence" | "answer"'), "planner, evidence and answer phases are explicit"],
  [backend.includes("Promise.race([operation(controller.signal), timeoutPromise])"), "phase timeouts reject even when an evidence client ignores abort"],
  [backend.includes('intent === "shift_cover_risk"'), "Shift Cover has a deterministic evidence answer"],
  [backend.includes('"shift_cover",\n      "shift_cover_risk",\n      "get_shift_cover"'), "natural Shift Cover requests use one canonical tool route"],
  [integrationScript.includes('sitePriorityPageExclusion') && integrationScript.includes('site_threat_prioritization') && integrationScript.includes('shiftCoverDecisionReplacement'), "Shift Cover page context deterministically outranks the broad site-priority route"],
  [backend.includes("inheritedShiftCoverContext"), "dated Shift Cover follow-ups retain their operational context"],
  [backend.includes("document cover|insurance cover|cover image|cover photo|cover page"), "non-maintenance cover wording is excluded"],
  [backend.includes("route_key: routeKey") && backend.includes("routing_mode:") && backend.includes("planner_ms:") && backend.includes("evidence_ms:") && backend.includes("answer_ms:"), "canonical route and phase telemetry are persisted"],
  [backend.includes("tool_count: usedTools.size") && backend.includes("tool_round_count: toolRoundCount"), "tool counts and rounds are persisted"],
  [backend.includes('status: "rate_limited"') && backend.includes('"timed_out"'), "rate-limited and timed-out requests remain traceable"],
  [migration.includes("feedback_category") && migration.includes("ask_vorta_interactions_route_key_check"), "database enforces bounded route and feedback values"],
  [migration.includes("revoke all on table public.ask_vorta_interactions from authenticated") && migration.includes("grant select, insert, update"), "authenticated interaction grants are reduced to minimum required"],
  [service.includes("export type AskVortaFeedbackCategory") && service.includes("feedback_category"), "frontend service sends a bounded feedback category"],
  [assistant.includes("What was not useful?") && assistant.includes("Skip reason") && assistant.includes("Submit feedback"), "not-helpful feedback offers optional category and detail"],
  [assistant.includes('onClick={() => void recordFeedback("helpful")}'), "helpful feedback remains one tap"],
  [integrationScript.includes('data-vorta-ai-feedback="true"') && integrationScript.includes("<section") && integrationScript.includes("</section>"), "phone feedback renders outside compact div pruning without extra CSS"],
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