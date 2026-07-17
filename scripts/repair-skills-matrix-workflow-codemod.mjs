import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const scriptUrl = new URL(
  "./apply-skills-matrix-workflow-fix.mjs",
  import.meta.url,
);
const source = await readFile(scriptUrl, "utf8");
const lines = source.split("\n");

const engineerMatcherIndex = lines.findIndex((line) =>
  line.includes('/<td className=\\{`sticky left-0 z-10 min-w-\\[190px\\]')
);
const actionMatcherIndex = lines.findIndex(
  (line) =>
    line.includes('/<div className="flex items-center gap-2">') &&
    line.includes("risk\\.projectedScoreGain"),
);
const engineerFilterMatcherIndex = lines.findIndex(
  (line) =>
    line.includes('<div className="flex flex-wrap items-center gap-2">') &&
    line.includes('min-w-\\[160px\\] flex-1'),
);

assert.notEqual(
  engineerMatcherIndex,
  -1,
  "Skills Matrix engineer workflow matcher could not be located",
);
assert.notEqual(
  actionMatcherIndex,
  -1,
  "Skills Matrix action workflow matcher could not be located",
);
assert.notEqual(
  engineerFilterMatcherIndex,
  -1,
  "Engineers skill-filter workflow matcher could not be located",
);

const robustEngineerMatcher =
  '      /<td className=\\{`sticky left-0 z-10 min-w-\\[190px\\] px-4 py-2\\.5 \\$\\{rowBg\\}`\\}>\\s*<p className="truncate font-medium text-slate-200">\\{engineer\\.name\\}<\\/p>\\s*<p className="mt-0\\.5 truncate text-\\[11px\\] text-slate-500">\\{engineer\\.discipline\\}<\\/p>\\s*<\\/td>/,';
const robustActionMatcher =
  '      /<div className="flex items-center gap-2">\\s*<span className="rounded-md bg-blue-500\\/10 px-2 py-1 text-\\[11px\\] font-semibold text-blue-300">\\s*\\+\\{risk\\.projectedScoreGain\\} pts\\s*<\\/span>\\s*<button[\\s\\S]*?Equipment <ArrowRight className="h-3 w-3" \\/>\\s*<\\/button>\\s*<\\/div>/,';
const robustEngineerFilterMatcher =
  '      /<div className="flex flex-wrap items-center gap-2">\\s*<div className="relative min-w-\\[160px\\] flex-1">/,';

let changed = false;
for (const [index, replacement] of [
  [engineerMatcherIndex, robustEngineerMatcher],
  [actionMatcherIndex, robustActionMatcher],
  [engineerFilterMatcherIndex, robustEngineerFilterMatcher],
]) {
  if (lines[index] !== replacement) {
    lines[index] = replacement;
    changed = true;
  }
}

if (changed) {
  await writeFile(scriptUrl, lines.join("\n"));
  console.log("Skills Matrix workflow codemod matchers repaired.");
} else {
  console.log("Skills Matrix workflow codemod matchers already repaired.");
}
