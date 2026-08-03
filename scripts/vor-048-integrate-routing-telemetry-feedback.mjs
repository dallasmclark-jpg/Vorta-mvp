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
const marker = 'type AskVortaPhase = "planner" | "evidence" | "answer";';
const feedbackMarker = 'data-vorta-ai-feedback="true"';
const sitePriorityPageExclusion =
  '!/\\bshift-cover\\b/.test(request.pageContext.path)';
const deterministicPageContextMarker =
  "    (shiftCoverPageContext ||\n      (asksForCoverDecision &&";

const backendSource = readFileSync(backendPath, "utf8");
const assistantSource = readFileSync(assistantPath, "utf8");
const fullyApplied =
  backendSource.includes(marker) &&
  backendSource.includes(sitePriorityPageExclusion) &&
  backendSource.includes(deterministicPageContextMarker) &&
  assistantSource.includes(feedbackMarker) &&
  assistantSource.includes("<section");
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

let transformedBackend = readFileSync(backendPath, "utf8");
const sitePriorityIntent = '      "site_threat_prioritization",';
const sitePriorityIntentIndex = transformedBackend.indexOf(sitePriorityIntent);
const sitePriorityIfIndex = transformedBackend.lastIndexOf(
  "  if (",
  sitePriorityIntentIndex,
);
if (sitePriorityIntentIndex < 0 || sitePriorityIfIndex < 0) {
  throw new Error("VOR-048 could not locate the broad site-priority route.");
}
transformedBackend =
  transformedBackend.slice(0, sitePriorityIfIndex) +
  `  if (\n    ${sitePriorityPageExclusion} &&\n    ` +
  transformedBackend.slice(sitePriorityIfIndex + "  if (".length);

const shiftCoverDecisionAnchor =
  "    asksForCoverDecision &&\n" +
  "    (explicitShiftCoverQuestion || datedWorkforceQuestion || shiftCoverPageContext || inheritedShiftCoverContext) &&";
const shiftCoverDecisionReplacement =
  "    (shiftCoverPageContext ||\n" +
  "      (asksForCoverDecision &&\n" +
  "        (explicitShiftCoverQuestion || datedWorkforceQuestion || inheritedShiftCoverContext))) &&";
if (!transformedBackend.includes(shiftCoverDecisionAnchor)) {
  throw new Error("VOR-048 could not locate the Shift Cover decision condition.");
}
transformedBackend = transformedBackend.replace(
  shiftCoverDecisionAnchor,
  shiftCoverDecisionReplacement,
);
writeFileSync(backendPath, transformedBackend);

let transformedAssistant = readFileSync(assistantPath, "utf8");
const feedbackOpenAnchor = `{answer.responseId && (\n        <div className="space-y-2">`;
const feedbackOpenIndex = transformedAssistant.indexOf(feedbackOpenAnchor);
if (feedbackOpenIndex < 0) {
  throw new Error("VOR-048 feedback wrapper anchor was not found after integration.");
}
transformedAssistant = transformedAssistant.replace(
  feedbackOpenAnchor,
  `{answer.responseId && (\n        <section\n          data-vorta-ai-feedback="true"\n          className="space-y-2"\n        >`,
);

const feedbackCloseAnchor = `          )}\n        </div>\n      )}\n    </div>`;
const feedbackCloseIndex = transformedAssistant.indexOf(
  feedbackCloseAnchor,
  feedbackOpenIndex,
);
if (feedbackCloseIndex < 0) {
  throw new Error("VOR-048 feedback wrapper closing anchor was not found.");
}
transformedAssistant =
  transformedAssistant.slice(0, feedbackCloseIndex) +
  feedbackCloseAnchor.replace("</div>", "</section>") +
  transformedAssistant.slice(feedbackCloseIndex + feedbackCloseAnchor.length);
writeFileSync(assistantPath, transformedAssistant);

console.log("Applied VOR-048 Shift Cover routing, phase telemetry and feedback integration.");
