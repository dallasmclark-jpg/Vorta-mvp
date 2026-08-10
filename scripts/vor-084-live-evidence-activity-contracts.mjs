import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const entry = read("netlify/functions/ask-vorta.mts");
const progress = read("netlify/functions/ask-vorta/progress-events.mts");
const documentRuntime = read("netlify/functions/ask-vorta/runtime-document-links.mts");
const toolExecution = read("netlify/functions/ask-vorta/tool-execution.mts");
const sparePhoto = read("netlify/functions/ask-vorta/spare-photo-identification.mts");
const service = read("src/screens/AiOperations/vortaAgentService.ts");
const workspace = read("src/screens/AiOperations/AskVortaWorkspaceBase.tsx");
const shell = read("index.html");

assert.match(
  progress,
  /new AsyncLocalStorage<AskVortaProgressSink>\(\)/,
  "Progress delivery must be request-scoped rather than process-global",
);
assert.match(progress, /emitAskVortaProgress/);
assert.match(progress, /Checking Stores Inventory/);
assert.match(progress, /Checking work-order history/);
assert.match(progress, /Checking equipment BOM and spares/);
assert.doesNotMatch(
  progress,
  /setInterval\s*\(/,
  "Source activity must not be driven by a cosmetic timer",
);

assert.ok(
  entry.split("\n").length <= 40,
  "The canonical Netlify entrypoint must remain compact",
);
assert.match(
  entry,
  /runtime-document-links\.mjs/,
  "The canonical entrypoint must retain the validated runtime chain",
);

for (const marker of [
  'includes("application/x-ndjson")',
  "withAskVortaProgressSink",
  'type: "progress"',
  'type: "result"',
  '"Cache-Control": "no-store"',
]) {
  assert.ok(
    documentRuntime.includes(marker),
    `Progress transport is missing ${marker}`,
  );
}
assert.match(
  documentRuntime,
  /wantsProgressStream\(req\)[\s\S]*?progressStreamResponse\(req, context\)[\s\S]*?: documentLinkResponse\(req, context\)/,
  "NDJSON must be opt-in while the existing JSON response path remains available",
);

for (const marker of [
  "askVortaProgressLabelForTool",
  "askVortaProgressDetailForTool",
  'state: "active"',
  'state: result.status === "unavailable" ? "failed" : "complete"',
]) {
  assert.ok(toolExecution.includes(marker), `Tool activity wrapper is missing ${marker}`);
}
assert.match(
  toolExecution,
  /const result = await executeToolInternal\(name, args, supabase, request\)/,
  "Displayed source activity must wrap the actual evidence tool execution",
);

for (const marker of [
  'label: "Reading the uploaded image"',
  'label: "Checking Stores Inventory"',
  'label: "Comparing verified stock images"',
  'label: "Preparing the closest stock match"',
]) {
  assert.ok(sparePhoto.includes(marker), `Spare-photo activity is missing ${marker}`);
}
assert.doesNotMatch(
  sparePhoto,
  /label: "Checking work-order history"|label: "Checking equipment BOM/,
  "The spare-photo route must not claim evidence sources it does not execute",
);

for (const marker of [
  'ASK_VORTA_PROGRESS_EVENT = "vorta-ask-vorta-progress"',
  'ASK_VORTA_PROGRESS_RESET_EVENT = "vorta-ask-vorta-progress-reset"',
  'Accept: "application/x-ndjson, application/json;q=0.9"',
  "readAskVortaStream",
  "dispatchProgress(parsed.event)",
]) {
  assert.ok(service.includes(marker), `Client progress handling is missing ${marker}`);
}

for (const marker of [
  'data-vorta-ai-live-evidence-activity="true"',
  "Checking Vorta evidence",
  "MAX_VISIBLE_PROGRESS_STEPS = 6",
  "ASK_VORTA_PROGRESS_EVENT",
  "ASK_VORTA_PROGRESS_RESET_EVENT",
  "<CheckCircle2",
]) {
  assert.ok(workspace.includes(marker), `Workspace live activity is missing ${marker}`);
}
assert.doesNotMatch(
  workspace,
  /Choosing and checking the relevant Vorta sources/,
  "The old opaque loading message must be retired from desktop/tablet",
);
assert.match(
  workspace,
  /className="fixed inset-0 z-\[70\] hidden min-h-0 bg-gray-950 md:flex"/,
  "The live activity enhancement must remain inside the desktop/tablet workspace boundary",
);

for (const marker of [
  "@keyframes vorta-evidence-sweep",
  '[data-vorta-ai-live-evidence-activity="true"] .min-h-7{display:none!important}',
  '[data-vorta-ai-live-evidence-activity="true"] .min-h-7:last-child{display:block!important',
  '[data-vorta-ai-live-evidence-activity="true"] .min-h-7:last-child>svg{display:none!important}',
  '[data-vorta-ask-vorta-stock-loading-rail="true"]{display:none!important}',
]) {
  assert.ok(shell.includes(marker), `VOR-085 single-status presentation is missing ${marker}`);
}
assert.match(
  shell,
  /@media\(min-width:769px\)/,
  "VOR-085 presentation changes must remain desktop/tablet-only",
);
assert.doesNotMatch(
  shell,
  /\.min-h-7::after\{content:"";display:block;flex:0 0 22px/,
  "The previous multi-stage connector rail must not return",
);

console.log(
  "VOR-084/VOR-085 live Ask Vorta evidence contracts passed: source-driven progress, truthful spare-photo stages, JSON compatibility, single-status loading and desktop/tablet-only presentation are protected.",
);