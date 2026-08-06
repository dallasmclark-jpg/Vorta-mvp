import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const expectedPlaywrightVersion = "1.55.0";

assert.equal(
  packageJson.devDependencies?.["@playwright/test"],
  expectedPlaywrightVersion,
  "@playwright/test must be an exact reviewed devDependency",
);
assert.equal(
  packageLock.packages?.[""]?.devDependencies?.["@playwright/test"],
  expectedPlaywrightVersion,
  "The lockfile root must retain the exact Playwright dependency",
);
assert.equal(
  packageLock.packages?.["node_modules/@playwright/test"]?.version,
  expectedPlaywrightVersion,
  "The lockfile must resolve the reviewed Playwright runtime",
);

const workflowDirectory = ".github/workflows";
const workflowFiles = readdirSync(workflowDirectory)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();
const workflowSources = new Map(
  workflowFiles.map((name) => [
    name,
    readFileSync(join(workflowDirectory, name), "utf8"),
  ]),
);

const dynamicPlaywrightInstallers = [...workflowSources]
  .filter(([, source]) =>
    /npm\s+(?:install|i)[^\n]*@playwright\/test/i.test(source),
  )
  .map(([name]) => name);
assert.deepEqual(
  dynamicPlaywrightInstallers,
  [],
  `Browser-test dependencies must come from npm ci; dynamic installers remain in: ${dynamicPlaywrightInstallers.join(", ")}`,
);

const browserWorkflows = [
  "maintenance-manager-quality.yml",
  "maintenance-manager-production.yml",
  "vor-048-validation.yml",
  "vor-051-validation.yml",
];
for (const name of browserWorkflows) {
  const source = workflowSources.get(name);
  assert.ok(source, `Missing protected browser workflow ${name}`);
  assert.ok(
    source.includes("npx playwright install --with-deps chromium"),
    `${name} must retain the explicit Chromium installation step`,
  );
}

const protectedWorkflows = [
  "maintenance-manager-quality.yml",
  "maintenance-manager-production.yml",
  "vor-048-validation.yml",
  "vor-049-validation.yml",
  "vor-051-validation.yml",
];
const expectedActionPins = new Map([
  ["actions/checkout", "11d5960a326750d5838078e36cf38b85af677262"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
  ["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"],
]);

for (const name of protectedWorkflows) {
  const source = workflowSources.get(name);
  assert.ok(source, `Missing protected workflow ${name}`);
  const externalUses = [...source.matchAll(/^\s*uses:\s*([^\s#]+)\s*(?:#.*)?$/gm)]
    .map((match) => match[1])
    .filter((value) => !value.startsWith("./"));
  for (const action of externalUses) {
    const separator = action.lastIndexOf("@");
    assert.ok(separator > 0, `${name} contains an invalid action reference: ${action}`);
    const ownerRepo = action.slice(0, separator);
    const ref = action.slice(separator + 1);
    assert.match(
      ref,
      /^[0-9a-f]{40}$/,
      `${name} must pin ${ownerRepo} to an immutable commit SHA`,
    );
    const expectedPin = expectedActionPins.get(ownerRepo);
    if (expectedPin) {
      assert.equal(
        ref,
        expectedPin,
        `${name} must use the reviewed ${ownerRepo} commit`,
      );
    }
  }
}

const documentation = readFileSync("docs/locked-ci-dependencies.md", "utf8");
for (const phrase of [
  "npm ci",
  "40-character commit SHAs",
  "Update procedure",
  "Netlify automatically builds the merged `main` commit",
]) {
  assert.ok(
    documentation.includes(phrase),
    `Locked CI dependency documentation is missing: ${phrase}`,
  );
}
assert.doesNotMatch(
  documentation,
  /single daily Netlify release marker|one Netlify production deployment per/i,
  "Locked dependency documentation must not reintroduce the removed daily deployment gate",
);

const suite = readFileSync("scripts/run-contract-suite.mjs", "utf8");
assert.ok(
  suite.includes("scripts/vor-064-locked-browser-runtime-contracts.mjs"),
  "The permanent contract suite must include VOR-064",
);

console.log("VOR-064 locked browser runtime contracts passed.");
