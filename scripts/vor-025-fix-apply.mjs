import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("./vor-025-apply.mjs", import.meta.url);
let content = readFileSync(path, "utf8");

const sortLabel = '    "page sort lock for grouped periods",\n  );';
const sortLabelIndex = content.indexOf(sortLabel);
if (sortLabelIndex < 0) throw new Error("Sort patch label not found");
const sortCallStart = content.lastIndexOf("  content = replaceOnce(", sortLabelIndex);
if (sortCallStart < 0) throw new Error("Sort patch call start not found");
const sortCallEnd = sortLabelIndex + sortLabel.length;
const sortReplacement = `  content = replaceOnce(\n    content,\n    \`                  value={sortMode}\\n                  onChange={(event) => setSortMode(event.target.value as SortMode)}\\n                  className=\"min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60\"\`,\n    \`                  value={reviewHours > 12 ? \"recent\" : sortMode}\\n                  onChange={(event) => setSortMode(event.target.value as SortMode)}\\n                  disabled={reviewHours > 12}\\n                  className=\"min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-60\"\`,\n    \"page sort lock for grouped periods\",\n  );`;
content = content.slice(0, sortCallStart) + sortReplacement + content.slice(sortCallEnd);

const windowStartMarker = "  content = content.replaceAll(\n    `windowStart={snapshot.window.start}";
const windowStart = content.indexOf(windowStartMarker);
if (windowStart < 0) throw new Error("Workflow window patch start not found");
const windowEndMarker = "  content = replaceOnce(\n    content,\n    `             Building the previous-shift handover";
const windowEnd = content.indexOf(windowEndMarker, windowStart);
if (windowEnd < 0) throw new Error("Workflow window patch end not found");
const windowReplacement = `  content = content.replace(\n    /windowStart=\\{snapshot\\.window\\.start\\}\\n(\\s*)windowEnd=\\{snapshot\\.window\\.end\\}/g,\n    (_match, indentation) => \`windowStart={selectedItem.handoverWindowStart}\\n\${indentation}windowEnd={selectedItem.handoverWindowEnd}\`,\n  );\n  if (content.includes(\"windowStart={snapshot.window.start}\")) {\n    throw new Error(\"VOR-025 page still writes workflow actions against the aggregate review window\");\n  }\n`;
content = content.slice(0, windowStart) + windowReplacement + content.slice(windowEnd);

writeFileSync(path, content);
