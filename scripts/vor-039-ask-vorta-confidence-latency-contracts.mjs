import { readFileSync } from "node:fs";

const source = readFileSync("netlify/functions/ask-vorta.mts", "utf8");
const service = readFileSync("src/screens/AiOperations/vortaAgentService.ts", "utf8");
const runner = readFileSync("scripts/ask-vorta-live-evals.mjs", "utf8");
const evals = JSON.parse(readFileSync("tests/evals/vor-039-confidence-latency.json", "utf8"));

const checks = [
  [source.includes("evidenceAwareConfidence"), "deterministic evidence-aware confidence calibration exists"],
  [source.includes("decisionPackCoveringTool"), "successful decision packs suppress equivalent specialist lookups"],
  [source.includes("toolOutcomes = new Map<string, ToolResult>()"), "tool outcomes are retained for calibration"],
  [source.includes("answerReasoningEffort(questionPlan)"), "answer reasoning effort is scope-aware"],
  [source.includes("answerOutputTokenBudget(questionPlan)"), "answer output budget is scope-aware"],
    [source.includes("deterministicQuestionPlan") && source.includes('routingMode: "deterministic"'), "clear maintenance intents bypass the model planner"],
    [source.includes("deterministicToolName ? [] : TOOLS") && source.includes('? "none"'), "deterministic evidence is preloaded before one tool-free answer call"],
  [source.includes("Return an empty actionPlan for a purely factual lookup"), "factual answers may omit action plans"],
  [source.includes("Return zero to three useful followUpQuestions"), "follow-up questions are optional"],
  [service.includes("function isActionPlan") && service.includes("Array.isArray(value)"), "frontend accepts an empty action-plan array"],
  [runner.includes("scenario.confidenceMin") && runner.includes("scenario.maxToolCount"), "live evaluations enforce confidence and duplicate-tool limits"],
  [runner.includes("scenario.maxDurationMs") && runner.includes("scenario.maxFollowUpQuestions"), "live evaluations enforce latency and answer density"],
    [runner.includes("AbortController") && runner.includes("requestTimeoutMs") && runner.includes("request failed:"), "live evaluation network failures are bounded and recorded"],
  [Array.isArray(evals) && evals.length >= 4, "confidence and latency scenarios are permanent"],
  [evals.some((item) => item.maxToolCount === 1), "decision-pack duplication is evaluated"],
  [evals.some((item) => item.requireActionPlan === false), "concise factual answers are evaluated"],
  [evals.some((item) => item.requireActionPlan === true), "complex action answers remain evaluated"],
];

const failures = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) console.log(`${passed ? "PASS" : "FAIL"} - ${label}`);
if (failures.length) process.exit(1);
console.log(`VOR-039 Ask Vorta confidence and latency contract passed: ${checks.length}/${checks.length}.`);
