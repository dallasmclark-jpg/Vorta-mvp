import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const proof = JSON.parse(readFileSync(resolve(here, "proof-contract.json"), "utf8"));
const scenarioFile = process.argv[2] || "tests/evals/vor-040-natural-questions.json";
const baselineUrl = process.env.VOR074_BASELINE_URL || "https://vorta-app.netlify.app";
const candidateUrl = process.env.VOR074_CANDIDATE_URL;

if (!candidateUrl) {
  console.error("Set VOR074_CANDIDATE_URL to the isolated shadow endpoint. Production is never used as the candidate implicitly.");
  process.exit(2);
}

if (!proof.permanentScenarioSets.includes(scenarioFile)) {
  console.error(`${scenarioFile} is not one of the pinned VOR-074 permanent scenario sets.`);
  process.exit(2);
}

function extractEvalJson(stdout) {
  const marker = '\n{\n  "scenarioFile"';
  const start = stdout.lastIndexOf(marker);
  if (start < 0) throw new Error("Could not find the final Ask Vorta eval JSON payload.");
  return JSON.parse(stdout.slice(start + 1));
}

function runEval(label, baseUrl) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [resolve(root, "scripts/ask-vorta-live-evals.mjs"), scenarioFile], {
      cwd: root,
      env: {
        ...process.env,
        VORTA_EVAL_BASE_URL: baseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(`[${label}] ${text}`);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(`[${label}] ${text}`);
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      try {
        const payload = extractEvalJson(stdout);
        resolvePromise({ label, code, stdout, stderr, payload });
      } catch (error) {
        rejectPromise(error);
      }
    });
  });
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function summarize(run) {
  const results = run.payload.results || [];
  const durations = results.map((item) => Number(item.durationMs)).filter(Number.isFinite);
  const toolCounts = results.map((item) => Array.isArray(item.observed?.tools) ? item.observed.tools.length : 0);
  return {
    requested: run.payload.requested,
    completed: results.length,
    passed: results.filter((item) => item.passed).length,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    totalTools: toolCounts.reduce((sum, value) => sum + value, 0),
    failures: Object.fromEntries(results.filter((item) => !item.passed).map((item) => [item.id, item.failures])),
  };
}

function percentDelta(candidate, baseline) {
  if (!Number.isFinite(candidate) || !Number.isFinite(baseline) || baseline <= 0) return null;
  return ((candidate - baseline) / baseline) * 100;
}

const baseline = await runEval("baseline", baselineUrl);
if (baseline.payload.blockedByRateLimit || baseline.payload.blockedByCapacity) {
  console.error("Baseline was capacity/rate limited. Do not compare a partial run.");
  process.exit(3);
}

const candidate = await runEval("candidate", candidateUrl);
if (candidate.payload.blockedByRateLimit || candidate.payload.blockedByCapacity) {
  console.error("Candidate was capacity/rate limited. Do not compare a partial run.");
  process.exit(3);
}

const baselineSummary = summarize(baseline);
const candidateSummary = summarize(candidate);
const gates = proof.adoptionGates;
const p50DeltaPercent = percentDelta(candidateSummary.p50Ms, baselineSummary.p50Ms);
const p95DeltaPercent = percentDelta(candidateSummary.p95Ms, baselineSummary.p95Ms);
const failures = [];

for (const result of candidate.payload.results || []) {
  const baselineResult = (baseline.payload.results || []).find((item) => item.id === result.id);
  if (baselineResult?.passed && !result.passed) {
    failures.push(`new candidate failure: ${result.id}`);
  }
  const baselineToolCount = Array.isArray(baselineResult?.observed?.tools) ? baselineResult.observed.tools.length : 0;
  const candidateToolCount = Array.isArray(result.observed?.tools) ? result.observed.tools.length : 0;
  if (candidateToolCount > baselineToolCount + Number(gates.toolRoundDeltaMax ?? 0)) {
    failures.push(`tool-count increase: ${result.id} ${baselineToolCount} -> ${candidateToolCount}`);
  }
}

if (candidateSummary.passed < baselineSummary.passed) {
  failures.push(`pass count regressed: ${baselineSummary.passed} -> ${candidateSummary.passed}`);
}
if (p50DeltaPercent !== null && p50DeltaPercent > Number(gates.p50LatencyDeltaPercentMax)) {
  failures.push(`p50 latency regressed ${p50DeltaPercent.toFixed(1)}%`);
}
if (p95DeltaPercent !== null && p95DeltaPercent > Number(gates.p95LatencyDeltaPercentMax)) {
  failures.push(`p95 latency regressed ${p95DeltaPercent.toFixed(1)}%`);
}

const comparison = {
  revision: proof.revision,
  scenarioFile,
  baselineUrl,
  candidateUrl,
  baseline: baselineSummary,
  candidate: candidateSummary,
  deltas: {
    p50LatencyPercent: p50DeltaPercent,
    p95LatencyPercent: p95DeltaPercent,
    toolExecutions: candidateSummary.totalTools - baselineSummary.totalTools,
  },
  tokenModelCost: "not measured by endpoint comparator; must be supplied by Vorta/OpenAI telemetry before adoption",
  passed: failures.length === 0,
  failures,
};

console.log(JSON.stringify(comparison, null, 2));
if (failures.length > 0) process.exit(1);
