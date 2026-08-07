import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const source = readFileSync(
  "src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
  "utf8",
);
const documentRuntime = readFileSync(
  "netlify/functions/ask-vorta/runtime-document-links.mts",
  "utf8",
);
const documentOrigin = readFileSync(
  "netlify/functions/ask-vorta/document-link-origin.mts",
  "utf8",
);

for (const marker of [
  "ASK_VORTA_DOCUMENT_ROUTE",
  'new URLSearchParams(location.search).get("from") === "ai"',
  "data-vorta-back-to-ask-vorta",
  'aria-label="Back to Ask Vorta chat"',
  "navigate(-1)",
  'navigate("/dashboard", { replace: true })',
  "openMaintenanceAiAssistant({ submit: false })",
  "const showDesktopAssistantLauncher = !isPhone;",
  'data-vorta-shared-mobile-ai-launcher="true"',
]) {
  assert.ok(source.includes(marker), `Missing VOR-067 navigation marker: ${marker}`);
}

for (const marker of [
  'import { withAskVortaDocumentOrigin } from "./document-link-origin.mjs"',
  "path: withAskVortaDocumentOrigin(link.path)",
  '"vor-067-production-chat-return-v2"',
]) {
  assert.ok(
    documentRuntime.includes(marker),
    `Missing VOR-067 production document-origin marker: ${marker}`,
  );
}

for (const marker of [
  'export const ASK_VORTA_DOCUMENT_ORIGIN = "ai"',
  'params.set("from", ASK_VORTA_DOCUMENT_ORIGIN)',
]) {
  assert.ok(
    documentOrigin.includes(marker),
    `Missing VOR-067 document-origin helper marker: ${marker}`,
  );
}

assert.match(
  source,
  /const openedFromAskVorta =\s*ASK_VORTA_DOCUMENT_ROUTE\.test\(location\.pathname\) &&\s*new URLSearchParams\(location\.search\)\.get\("from"\) === "ai";/,
  "Back to chat must be restricted to an internal Ask Vorta-origin document route",
);

const returnFunction = source.match(
  /const returnToAskVortaChat = useCallback\(\(\): void => \{[\s\S]*?\n  \}, \[navigate\]\);/,
)?.[0];
assert.ok(returnFunction, "The governed Back to chat handler must exist");
assert.match(
  returnFunction,
  /navigate\(-1\)[\s\S]*?navigate\("\/dashboard", \{ replace: true \}\)[\s\S]*?openMaintenanceAiAssistant\(\{ submit: false \}\)/,
  "Returning from a document must use internal history with a safe dashboard fallback and reopen Ask Vorta without submitting a question",
);
assert.ok(
  !returnFunction.includes("question:") && !returnFunction.includes("submit: true"),
  "Back to chat must never manufacture or submit a question",
);

assert.match(
  source,
  /\{openedFromAskVorta \? \([\s\S]*?data-vorta-back-to-ask-vorta="true"[\s\S]*?Back to chat[\s\S]*?\) : null\}/,
  "The Back to chat control must render only for Ask Vorta-origin document views",
);
assert.match(
  source,
  /showLauncher=\{showDesktopAssistantLauncher\}/,
  "The existing governed assistant must remain the desktop and tablet direct-open entry point",
);

const temp = mkdtempSync(join(tmpdir(), "vorta-ask-vorta-document-origin-"));
try {
  const bundle = join(temp, "document-link-origin.mjs");
  await build({
    entryPoints: ["netlify/functions/ask-vorta/document-link-origin.mts"],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: bundle,
    logLevel: "silent",
  });
  const origin = await import(`${pathToFileURL(bundle).href}?revision=${Date.now()}`);

  const equipmentId = "40000000-0000-0000-0000-000000000007";
  const guideId = "dbd95c1f-08ab-4224-a0dc-ba50651150e8";
  const bareGuidePath = `/equipment/${equipmentId}/documents/${guideId}`;
  const pageGuidePath = `${bareGuidePath}?page=12`;

  assert.equal(
    origin.withAskVortaDocumentOrigin(bareGuidePath),
    `${bareGuidePath}?from=ai`,
    "The production VF-02 guide route must retain Ask Vorta origin even when the stored source has no page query",
  );
  assert.equal(
    origin.withAskVortaDocumentOrigin(pageGuidePath),
    `${pageGuidePath}&from=ai`,
    "The production VF-02 guide page must preserve page 12 and add Ask Vorta origin",
  );
  assert.equal(
    new URL(
      origin.withAskVortaDocumentOrigin(pageGuidePath),
      "https://vorta-app.netlify.app",
    ).searchParams.get("from"),
    "ai",
    "The document viewer must receive the exact from=ai signal used to render Back to chat",
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log(
  "VOR-067 Ask Vorta navigation contracts passed: real document evidence links carry from=ai into the viewer, AI-origin documents return to the active chat, desktop/tablet can open the assistant directly, and no artificial question is submitted.",
);
