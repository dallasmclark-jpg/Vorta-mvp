import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("./vor-025-apply.mjs", import.meta.url);
let content = readFileSync(path, "utf8");
const label = '    "page sort lock for grouped periods",\n  );';
const labelIndex = content.indexOf(label);
if (labelIndex < 0) throw new Error("Sort patch label not found");
const callStart = content.lastIndexOf("  content = replaceOnce(", labelIndex);
if (callStart < 0) throw new Error("Sort patch call start not found");
const callEnd = labelIndex + label.length;
const replacement = `  content = replaceOnce(\n    content,\n    \`                  value={sortMode}\\n                  onChange={(event) => setSortMode(event.target.value as SortMode)}\\n                  className=\"min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60\"\`,\n    \`                  value={reviewHours > 12 ? \"recent\" : sortMode}\\n                  onChange={(event) => setSortMode(event.target.value as SortMode)}\\n                  disabled={reviewHours > 12}\\n                  className=\"min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-60\"\`,\n    \"page sort lock for grouped periods\",\n  );`;
content = content.slice(0, callStart) + replacement + content.slice(callEnd);
writeFileSync(path, content);
