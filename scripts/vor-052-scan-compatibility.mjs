import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, ".vor-052", "compatibility.json");
const ignoredDirectories = new Set([".git", "node_modules", "dist", ".netlify"]);

function walk(directory, results = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, results);
    else results.push(absolute);
  }
  return results;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function extractStringValues(source, variableName) {
  const marker = new RegExp(`(?:const|let|var)\\s+${variableName}\\s*=\\s*\\[`);
  const match = marker.exec(source);
  if (!match) return [];
  const start = match.index + match[0].length;
  let depth = 1;
  let quote = null;
  let escaped = false;
  let end = start;
  for (; end < source.length; end += 1) {
    const character = source[end];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = source.slice(start, end);
  return [...body.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/gms)].map((item) => item[2]);
}

const files = walk(root);
const integrationScripts = files
  .filter((file) => /scripts\/vor-\d+-.*integrat.*\.mjs$/i.test(relative(file)))
  .map((file) => {
    const source = fs.readFileSync(file, "utf8");
    const targetPaths = new Set();
    for (const pattern of [
      /(?:targetPath|path)\s*=\s*["'`]([^"'`]+)["'`]/g,
      /(?:readFileSync|writeFileSync)\(\s*["'`]([^"'`]+)["'`]/g,
    ]) {
      for (const match of source.matchAll(pattern)) targetPaths.add(match[1]);
    }
    const explicitMarkers = [
      ...extractStringValues(source, "integratedMarkers"),
      ...extractStringValues(source, "markers"),
    ];
    const askVortaMarkers = [...source.matchAll(/source\.includes\(\s*["'`]([^"'`]{8,})["'`]\s*\)/g)]
      .map((match) => match[1])
      .filter((value) => /ask vorta|get_|vorta_|decision|evidence|questionPlan|response/i.test(value));
    return {
      path: relative(file),
      targetPaths: [...targetPaths].sort(),
      explicitMarkers: [...new Set(explicitMarkers)].sort(),
      askVortaMarkers: [...new Set(askVortaMarkers)].sort(),
      referencesAskVortaFunction: source.includes("netlify/functions/ask-vorta.mts"),
      characterCount: source.length,
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const actionTerms = [
  "handover_note",
  "ask_vorta_action",
  "ask-vorta-action",
  "askVortaAction",
  "confirmed action",
  "action draft",
  "vorta_save_shift_handover_action",
];
const actionFiles = [];
for (const file of files) {
  if (!/\.(?:ts|tsx|mts|js|mjs|sql|json|yml|yaml|md)$/i.test(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  const matches = actionTerms.filter((term) => source.toLowerCase().includes(term.toLowerCase()));
  if (matches.length > 0) {
    actionFiles.push({
      path: relative(file),
      terms: matches,
      characterCount: source.length,
    });
  }
}
actionFiles.sort((a, b) => a.path.localeCompare(b.path));

const report = {
  generatedFromCommit: process.env.GITHUB_SHA ?? null,
  integrationScripts,
  askVortaFunctionIntegrators: integrationScripts
    .filter((script) => script.referencesAskVortaFunction)
    .map((script) => script.path),
  actionFiles,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Wrote ${relative(outputPath)} with ${integrationScripts.length} integration scripts, ` +
    `${report.askVortaFunctionIntegrators.length} Ask Vorta backend integrators and ${actionFiles.length} action-related files.`,
);
