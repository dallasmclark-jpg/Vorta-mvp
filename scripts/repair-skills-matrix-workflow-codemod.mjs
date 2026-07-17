import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const scriptUrl = new URL(
  "./apply-skills-matrix-workflow-fix.mjs",
  import.meta.url,
);
const source = await readFile(scriptUrl, "utf8");
const lines = source.split("\n");
const matcherIndex = lines.findIndex((line) =>
  line.includes('/<td className=\\{`sticky left-0 z-10 min-w-\\[190px\\]')
);

assert.notEqual(
  matcherIndex,
  -1,
  "Skills Matrix workflow codemod matcher could not be located",
);

const robustMatcher =
  '      /<td className=\\{`sticky left-0 z-10 min-w-\\[190px\\] px-4 py-2\\.5 \\$\\{rowBg\\}`\\}>\\s*<p className="truncate font-medium text-slate-200">\\{engineer\\.name\\}<\\/p>\\s*<p className="mt-0\\.5 truncate text-\\[11px\\] text-slate-500">\\{engineer\\.discipline\\}<\\/p>\\s*<\\/td>/,';

if (lines[matcherIndex] !== robustMatcher) {
  lines[matcherIndex] = robustMatcher;
  await writeFile(scriptUrl, lines.join("\n"));
  console.log("Skills Matrix workflow codemod matcher repaired.");
} else {
  console.log("Skills Matrix workflow codemod matcher already repaired.");
}
