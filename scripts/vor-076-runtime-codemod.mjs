import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Missing VOR-076 runtime anchor: ${label}`);
  return source.replace(before, after);
}

const backtestPath = "netlify/functions/ask-vorta/runtime-backtest.mts";
let backtest = readFileSync(backtestPath, "utf8");
backtest = replaceOnce(
  backtest,
  'import { jsonResponse } from "./request-context.mjs";',
  'import { jsonResponse } from "./request-context.mjs";\nimport {\n  handleSparePhotoIdentification,\n  shouldHandleSparePhotoPayload,\n} from "./spare-photo-identification.mjs";',
  "backtest spare route import",
);
backtest = replaceOnce(
  backtest,
  `  const routeRequest = req.clone();\n  const raw = await routeRequest.json().catch(() => null);\n  const question = isRecord(raw) ? text(raw.question) : "";`,
  `  const routeRequest = req.clone();\n  const raw = await routeRequest.json().catch(() => null);\n  if (shouldHandleSparePhotoPayload(raw)) {\n    return handleSparePhotoIdentification(req, context);\n  }\n  const question = isRecord(raw) ? text(raw.question) : "";`,
  "backtest spare route dispatch",
);
writeFileSync(backtestPath, backtest);

const documentPath = "netlify/functions/ask-vorta/runtime-document-links.mts";
let documentRuntime = readFileSync(documentPath, "utf8");
documentRuntime = replaceOnce(
  documentRuntime,
  `import coreHandler, {\n  ASK_VORTA_SPARE_PHOTO_REVISION,\n} from "./runtime-spare-photo.mjs";`,
  `import coreHandler, {\n  ASK_VORTA_BACKTEST_REVISION,\n} from "./runtime-backtest.mjs";`,
  "restore canonical document runtime import",
);
documentRuntime = replaceOnce(
  documentRuntime,
  `if (ASK_VORTA_SPARE_PHOTO_REVISION !== "vor-076-spare-photo-top-five-v1") {\n  throw new Error("Ask Vorta spare-photo runtime revision mismatch.");\n}`,
  `if (ASK_VORTA_BACKTEST_REVISION !== "vor-069-historical-backtest-intelligence-v1") {\n  throw new Error("Ask Vorta historical backtest runtime revision mismatch.");\n}`,
  "restore canonical document runtime revision guard",
);
writeFileSync(documentPath, documentRuntime);

console.log("VOR-076 runtime integration applied without changing the canonical document wrapper contract.");
