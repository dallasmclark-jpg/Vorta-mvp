import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const workflowDirectory = ".github/workflows";
const outputDirectory = "vor-064-workflow-output";
const protectedWorkflows = new Set([
  "maintenance-manager-quality.yml",
  "maintenance-manager-production.yml",
  "netlify-daily-release.yml",
  "vor-048-validation.yml",
  "vor-049-validation.yml",
  "vor-051-validation.yml",
]);
const actionPins = new Map([
  ["actions/checkout", ["11d5960a326750d5838078e36cf38b85af677262", "v4"]],
  ["actions/setup-node", ["49933ea5288caeca8642d1e84afbd3f7d6820020", "v4"]],
  ["actions/upload-artifact", ["ea165f8d65b6e75b540449e92b4886f43607fa02", "v4"]],
]);

function removeDynamicPlaywrightSteps(source) {
  const lines = source.split("\n");
  const output = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (!/^ {6}- name:/.test(line)) {
      output.push(line);
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < lines.length && !/^ {6}- name:/.test(lines[end])) end += 1;
    const block = lines.slice(index, end);
    const joined = block.join("\n");
    if (/npm\s+(?:install|i)[^\n]*@playwright\/test/i.test(joined)) {
      while (output.length > 0 && output.at(-1) === "") output.pop();
      output.push("");
      index = end;
      continue;
    }

    output.push(...block);
    index = end;
  }
  return output.join("\n");
}

function pinProtectedActions(source) {
  return source
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\s*uses:\s*)([^\s#]+)(?:\s*#.*)?$/);
      if (!match) return line;
      const action = match[2];
      const separator = action.lastIndexOf("@");
      if (separator <= 0) return line;
      const ownerRepo = action.slice(0, separator);
      const pin = actionPins.get(ownerRepo);
      if (!pin) return line;
      return `${match[1]}${ownerRepo}@${pin[0]} # ${pin[1]}`;
    })
    .join("\n");
}

mkdirSync(outputDirectory, { recursive: true });
const changed = [];
for (const name of readdirSync(workflowDirectory).sort()) {
  if (!name.endsWith(".yml") && !name.endsWith(".yaml")) continue;
  const path = join(workflowDirectory, name);
  const original = readFileSync(path, "utf8");
  let transformed = removeDynamicPlaywrightSteps(original);
  if (protectedWorkflows.has(name)) transformed = pinProtectedActions(transformed);
  if (transformed === original) continue;
  writeFileSync(join(outputDirectory, basename(name)), transformed);
  changed.push(name);
}

writeFileSync(
  join(outputDirectory, "changed-files.json"),
  `${JSON.stringify(changed, null, 2)}\n`,
);
console.log(`Prepared ${changed.length} workflow replacements:`);
for (const name of changed) console.log(`- ${name}`);
