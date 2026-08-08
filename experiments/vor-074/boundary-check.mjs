import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const rootPackage = JSON.parse(read("package.json"));
const productionFiles = [
  "netlify/functions/ask-vorta.mts",
  "netlify/functions/ask-vorta/runtime.mts",
  "netlify/functions/ask-vorta/contracts.mts",
  "netlify/functions/ask-vorta/route-planning.mts",
  "netlify/functions/ask-vorta/tool-execution.mts",
  "netlify/functions/ask-vorta/response-validation.mts",
];

const failures = [];
const rootDependencies = {
  ...(rootPackage.dependencies ?? {}),
  ...(rootPackage.devDependencies ?? {}),
};
if (rootDependencies["@openai/agents"]) {
  failures.push("Root production package must not depend on @openai/agents during VOR-074.");
}

for (const relativePath of productionFiles) {
  const source = read(relativePath);
  if (/experiments\/vor-074|@openai\/agents|VOR074_SHADOW_REVISION/.test(source)) {
    failures.push(`${relativePath} imports or references the VOR-074 shadow experiment.`);
  }
}

const shadowPackage = JSON.parse(read("experiments/vor-074/package.json"));
if (!shadowPackage.private) {
  failures.push("The VOR-074 experiment package must remain private.");
}
if (!shadowPackage.dependencies?.["@openai/agents"]) {
  failures.push("The isolated experiment must pin @openai/agents itself.");
}

if (failures.length > 0) {
  console.error("VOR-074 boundary check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "VOR-074 boundary check passed: Agents SDK remains isolated from the production Ask Vorta dependency and import graph.",
);
