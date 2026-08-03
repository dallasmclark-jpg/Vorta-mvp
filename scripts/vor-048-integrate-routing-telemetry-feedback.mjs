import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const backendPath = resolve(repositoryRoot, "netlify/functions/ask-vorta.mts");
const assistantPath = resolve(
  repositoryRoot,
  "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx",
);
const mobileHardeningPath = resolve(
  repositoryRoot,
  "src/screens/AiOperations/mobilePortalHardening.css",
);
const marker = 'type AskVortaPhase = "planner" | "evidence" | "answer";';
const feedbackMarker = 'data-vorta-ai-feedback="true"';
const mobileFeedbackSelector = '[data-vorta-ai-feedback="true"]';

const backendSource = readFileSync(backendPath, "utf8");
const assistantSource = readFileSync(assistantPath, "utf8");
const mobileHardeningSource = readFileSync(mobileHardeningPath, "utf8");
const fullyApplied =
  backendSource.includes(marker) &&
  assistantSource.includes(feedbackMarker) &&
  mobileHardeningSource.includes(mobileFeedbackSelector);
if (fullyApplied) {
  console.log("VOR-048 routing, telemetry and feedback integration is already applied.");
  process.exit(0);
}
if (backendSource.includes(marker)) {
  throw new Error(
    "VOR-048 integration is partially applied. Restore a clean source tree before rebuilding.",
  );
}

const scriptsDirectory = resolve(repositoryRoot, "scripts");
const patchNames = readdirSync(scriptsDirectory)
  .filter((name) => /^vor-048-\d{2}-.+\.patch$/.test(name))
  .sort();
if (patchNames.length === 0) {
  throw new Error("VOR-048 integration patches were not found.");
}

for (const patchName of patchNames) {
  const result = spawnSync(
    "git",
    ["apply", "--whitespace=nowarn", resolve(scriptsDirectory, patchName)],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `VOR-048 integration patch ${patchName} failed.${detail ? `\n${detail}` : ""}`,
    );
  }
}

const transformedAssistant = readFileSync(assistantPath, "utf8");
const feedbackAnchor = `{answer.responseId && (\n        <div className="space-y-2">`;
if (!transformedAssistant.includes(feedbackAnchor)) {
  throw new Error("VOR-048 feedback wrapper anchor was not found after integration.");
}
writeFileSync(
  assistantPath,
  transformedAssistant.replace(
    feedbackAnchor,
    `{answer.responseId && (\n        <div\n          data-vorta-ai-feedback="true"\n          className="space-y-2"\n        >`,
  ),
);

console.log("Applied VOR-048 Shift Cover routing, phase telemetry and feedback integration.");
