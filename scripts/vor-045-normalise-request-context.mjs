import { readFileSync, writeFileSync } from "node:fs";

const path = "netlify/functions/ask-vorta.mts";
let source = readFileSync(path, "utf8");

if (
  source.includes("interface PageContext {") &&
  source.includes("  pageContext: PageContext;")
) {
  console.log("VOR-045 Ask Vorta request context type is already normalised.");
  process.exit(0);
}

const requestMarker = "interface AskVortaRequest {\n";
const inlinePageContext = [
  "  pageContext: {",
  "    path: string;",
  "    timezone: string;",
  "  };",
].join("\n");

if (!source.includes(requestMarker)) {
  throw new Error("VOR-045 could not locate the AskVortaRequest interface.");
}
if (!source.includes(inlinePageContext)) {
  throw new Error("VOR-045 could not locate the inline pageContext type.");
}

source = source.replace(
  requestMarker,
  [
    "interface PageContext {",
    "  path: string;",
    "  timezone: string;",
    "}",
    "",
    requestMarker.trimEnd(),
  ].join("\n") + "\n",
);
source = source.replace(inlinePageContext, "  pageContext: PageContext;");

writeFileSync(path, source);
console.log("Normalised VOR-045 Ask Vorta request context type.");
