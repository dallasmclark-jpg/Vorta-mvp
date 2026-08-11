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
const liveActivity = read("src/screens/AiOperations/AskVortaLiveEvidenceActivity.tsx");
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
  'label: "Checking the uploaded image"',
  'label: "Checking Stores Inventory"',
  'label: "Comparing verified stock images"',
  'label: "Preparing the closest stock match"',
]) {
  assert.ok(sparePhoto.includes(marker), `Spare-photo activity is missing ${marker}`);
}
assert.doesNotMatch(
  sparePhoto,
  /label: "Reading the uploaded image"/,
  "The slower legacy image-stage wording must not return",
);
assert.doesNotMatch(
  sparePhoto,
  /label: "Checking work-order history"|label: "Checking equipment BOM/,
  "The spare-photo route must not claim evidence sources it does not execute",
);

const earlyImageStatus = sparePhoto.indexOf('label: "Checking the uploaded image"');
const authenticationStart = sparePhoto.indexOf("authenticateAskVortaRequest(req)");
assert.ok(
  earlyImageStatus >= 0 && authenticationStart > earlyImageStatus,
  "Known spare-photo requests must emit the first specific image status before authentication and telemetry work can delay the UI",
);
for (const marker of [
  "const extractionPromise = extractAskVortaImageEvidence",
  "const imageResultPromise = supabase",
  "await Promise.all([",
  "extractionPromise",
  "imageResultPromise",
]) {
  assert.ok(
    sparePhoto.includes(marker),
    `Spare-photo image and Stores overlap is missing ${marker}`,
  );
}
const extractionStart = sparePhoto.indexOf(
  "const extractionPromise = extractAskVortaImageEvidence",
);
const storesActive = sparePhoto.indexOf(
  'id: "spare-photo-stores",\n    label: "Checking Stores Inventory",\n    state: "active"',
  extractionStart,
);
const parallelWait = sparePhoto.indexOf("await Promise.all([", extractionStart);
assert.ok(
  extractionStart >= 0 &&
    storesActive > extractionStart &&
    parallelWait > storesActive,
  "Stores Inventory must visibly start while image extraction is already in flight, before the shared wait",
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
  'data-vorta-ai-single-status="true"',
  'data-vorta-ai-single-status-icon="true"',
  'data-vorta-ai-single-status-label="true"',
  "currentProgressStep",
  "ASK_VORTA_PROGRESS_EVENT",
  "ASK_VORTA_PROGRESS_RESET_EVENT",
  "Starting the relevant evidence checks",
]) {
  assert.ok(liveActivity.includes(marker), `Shared live activity is missing ${marker}`);
}
assert.doesNotMatch(
  liveActivity,
  /completedCount|checked\s*<|MAX_VISIBLE_PROGRESS_STEPS|rounded-full border px-2 py-1/,
  "Ask Vorta loading must stay a single live status rather than reintroducing counters, step pills or a multi-stage rail",
);
assert.ok(
  workspace.includes("SharedAskVortaLiveEvidenceActivity"),
  "Desktop/tablet workspace must render the shared live evidence activity",
);
assert.doesNotMatch(
  workspace,
  /Choosing and checking the relevant Vorta sources/,
  "The old opaque loading message must be retired from desktop/tablet",
);

for (const marker of [
  "@property --vorta-evidence-pulse-angle",
  "@keyframes vorta-evidence-border-pulse",
  "conic-gradient(from var(--vorta-evidence-pulse-angle)",
  '[data-vorta-ai-live-evidence-activity="true"][data-vorta-ai-single-status="true"]',
  'data-vorta-ai-single-status-icon="true"',
  'data-vorta-ai-single-status-label="true"',
  "max-width:440px!important",
  "height:44px!important",
  '[data-vorta-ask-vorta-stock-loading-rail="true"]{display:none!important}',
]) {
  assert.ok(shell.includes(marker), `Universal branded single-status presentation is missing ${marker}`);
}
const singleStatusStyle = shell.indexOf(
  '[data-vorta-ai-live-evidence-activity="true"][data-vorta-ai-single-status="true"]',
);
const desktopOnlyMedia = shell.indexOf("@media(min-width:769px){");
assert.ok(
  singleStatusStyle >= 0 && desktopOnlyMedia > singleStatusStyle,
  "The single-status Vorta pulse must be defined before the desktop-only media block so phone, tablet and desktop share the same loading standard",
);
assert.doesNotMatch(
  shell,
  /vorta-evidence-sweep|\.min-h-7::after\{content:"";display:block;flex:0 0 22px/,
  "Legacy progress-line or multi-stage connector treatments must not return",
);

console.log(
  "VOR-084/VOR-085 live Ask Vorta evidence contracts passed: source-driven progress, truthful spare-photo stages, overlapping Stores lookup, JSON compatibility and one branded live status across phone, tablet and desktop are protected.",
);
