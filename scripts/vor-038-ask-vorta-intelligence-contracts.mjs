import { readFileSync } from "node:fs";

const source = readFileSync("netlify/functions/ask-vorta.mts", "utf8");
const runner = readFileSync("scripts/run-contract-suite.mjs", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const evals = JSON.parse(readFileSync("tests/evals/vor-038-intelligence.json", "utf8"));

const checks = [
  [source.includes('const MODEL = "gpt-5.6-terra"'), "balanced GPT-5.6 reasoning model is the backend default"],
  [source.includes('const PLANNER_MODEL = "gpt-5.6-luna"'), "separate efficient semantic planner exists"],
  [source.includes('reasoning: { effort: "low" }'), "planner reasoning effort is explicit"],
  [source.includes("answerReasoningEffort(questionPlan)"), "answer reasoning effort is adaptive"],
  [source.includes("buildQuestionPlan"), "semantic planning stage is called"],
  [source.includes("get_site_operational_snapshot"), "broad cross-domain site tool exists"],
  [source.includes("get_equipment_decision_pack"), "broad cross-domain equipment tool exists"],
  [source.includes("missingPlannedTools"), "server enforces planned evidence completeness"],
  [source.includes("MAX_TOOL_ROUNDS = 8"), "multi-step tool budget is increased"],
  [source.includes("matching prepared questions"), "instructions prohibit prepared-question matching"],
  [runner.includes("VOR-038 Ask Vorta intelligence"), "permanent contract is in the main suite"],
  [packageJson.scripts["eval:ask-vorta:vor038"]?.includes("vor-038-intelligence.json"), "live intelligence eval command exists"],
  [Array.isArray(evals) && evals.length >= 12, "at least twelve semantic intelligence scenarios exist"],
  [evals.some((item) => item.history?.length), "follow-up conversation context is evaluated"],
  [evals.some((item) => /rik|cud|nxt/.test(item.question)), "misspelt shorthand is evaluated"],
  [evals.some((item) => item.minimumToolCount >= 2), "mixed-domain tool orchestration is evaluated"],
];

const failures = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) {
  console.log((passed ? "PASS" : "FAIL") + " - " + label);
}
if (failures.length) process.exit(1);
console.log("VOR-038 Ask Vorta intelligence contract passed: " + checks.length + "/" + checks.length + ".");
