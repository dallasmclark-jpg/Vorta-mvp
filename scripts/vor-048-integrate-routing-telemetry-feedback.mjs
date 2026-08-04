import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptsDirectory = resolve(repositoryRoot, "scripts");
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

function applyPatches(patchNames) {
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
}

function applyFeedbackWrapper(source) {
  if (source.includes(feedbackMarker) && source.includes("<section")) {
    return { source, changed: false };
  }

  const feedbackOpenAnchor = `{answer.responseId && (\n        <div className="space-y-2">`;
  const feedbackOpenIndex = source.indexOf(feedbackOpenAnchor);
  if (feedbackOpenIndex < 0) {
    throw new Error("VOR-048 feedback wrapper anchor was not found after integration.");
  }
  let transformed = source.replace(
    feedbackOpenAnchor,
    `{answer.responseId && (\n        <section\n          data-vorta-ai-feedback="true"\n          className="space-y-2"\n        >`,
  );

  const feedbackCloseAnchor = `          )}\n        </div>\n      )}\n    </div>`;
  const feedbackCloseIndex = transformed.indexOf(
    feedbackCloseAnchor,
    feedbackOpenIndex,
  );
  if (feedbackCloseIndex < 0) {
    throw new Error("VOR-048 feedback wrapper closing anchor was not found.");
  }
  transformed =
    transformed.slice(0, feedbackCloseIndex) +
    feedbackCloseAnchor.replace("</div>", "</section>") +
    transformed.slice(feedbackCloseIndex + feedbackCloseAnchor.length);
  return { source: transformed, changed: true };
}

const backendSource = readFileSync(backendPath, "utf8");
const assistantSource = readFileSync(assistantPath, "utf8");
const modularEntrypoint = 'export { default, config } from "./ask-vorta/runtime.mjs";';
if (backendSource.includes(modularEntrypoint)) {
  const contractsPath = resolve(repositoryRoot, "netlify/functions/ask-vorta/contracts.mts");
  const routePlanningPath = resolve(repositoryRoot, "netlify/functions/ask-vorta/route-planning.mts");
  const telemetryPath = resolve(repositoryRoot, "netlify/functions/ask-vorta/telemetry.mts");
  for (const modulePath of [contractsPath, routePlanningPath, telemetryPath]) {
    if (!existsSync(modulePath)) {
      throw new Error(`VOR-048 modular Ask Vorta source is missing ${modulePath}.`);
    }
  }

  const contractsSource = readFileSync(contractsPath, "utf8");
  const routePlanningSource = readFileSync(routePlanningPath, "utf8");
  const telemetrySource = readFileSync(telemetryPath, "utf8");
  const requiredMarkers = [
    [contractsSource, marker, contractsPath],
    [routePlanningSource, sitePriorityPageExclusion, routePlanningPath],
    [routePlanningSource, deterministicPageContextMarker, routePlanningPath],
    [telemetrySource, '.from("ask_vorta_interactions")', telemetryPath],
  ];
  for (const [moduleSource, requiredMarker, modulePath] of requiredMarkers) {
    if (!moduleSource.includes(requiredMarker)) {
      throw new Error(`VOR-048 modular integration is missing ${requiredMarker} in ${modulePath}.`);
    }
  }

  if (!assistantSource.includes(feedbackMarker)) {
    const frontendPatchNames = readdirSync(scriptsDirectory)
      .filter((name) => /^vor-048-(?:06|07|08)-.+\.patch$/.test(name))
      .sort();
    if (frontendPatchNames.length !== 3) {
      throw new Error(
        `VOR-048 expected three frontend patches (06-08), found ${frontendPatchNames.length}.`,
      );
    }
    applyPatches(frontendPatchNames);
  }

  const feedback = applyFeedbackWrapper(readFileSync(assistantPath, "utf8"));
  if (feedback.changed) writeFileSync(assistantPath, feedback.source);
  console.log(
    assistantSource.includes(feedbackMarker) && !feedback.changed
      ? "VOR-048 routing, telemetry and feedback integration is already applied in focused modules."
      : "Applied VOR-048 service, UI and feedback integration while preserving the modular Ask Vorta backend.",
  );
  process.exit(0);
}

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

const patchNames = readdirSync(scriptsDirectory)
  .filter((name) => /^vor-048-\d{2}-.+\.patch$/.test(name))
  .sort();
if (patchNames.length === 0) {
  throw new Error("VOR-048 integration patches were not found.");
}
applyPatches(patchNames);

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

const feedback = applyFeedbackWrapper(readFileSync(assistantPath, "utf8"));
if (feedback.changed) writeFileSync(assistantPath, feedback.source);

console.log("Applied VOR-048 Shift Cover routing, phase telemetry and feedback integration.");