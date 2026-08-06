import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const routePath = "netlify/functions/ask-vorta/route-planning.mts";
const contractPath = "scripts/vor-058-site-priority-performance-contracts.mjs";

const routeSource = readFileSync(routePath, "utf8");
const oldPriorityPattern = String.raw`/\b(?:top|main|biggest|highest|current)\s+(?:site\s+|maintenance\s+)?(?:risks?|threats?|priorities|problems?)\b/.test(question)`;
const newPriorityPattern = String.raw`/\b(?:top|main|biggest|highest|current)\s+(?:(?:current|site|maintenance)\s+){0,2}(?:risks?|threats?|priorities|problems?)\b/.test(question)`;
const oldLikelyPattern = String.raw`/\b(?:things?|issues?|risks?|problems?)\s+(?:most\s+)?likely to\s+(?:hurt|stop|disrupt|bite)(?:\s+us|\s+the site)?\b/.test(question)`;
const newLikelyPattern = String.raw`/\b(?:things?|issues?|risks?|problems?)\s+(?:are\s+)?(?:most\s+)?likely to\s+(?:hurt|stop|disrupt|bite)(?:\s+us|\s+the site)?\b/.test(question)`;

assert.equal(
  routeSource.split(oldPriorityPattern).length - 1,
  1,
  "Expected one site-priority modifier matcher",
);
assert.equal(
  routeSource.split(oldLikelyPattern).length - 1,
  1,
  "Expected one likely-threat matcher",
);
writeFileSync(
  routePath,
  routeSource
    .replace(oldPriorityPattern, newPriorityPattern)
    .replace(oldLikelyPattern, newLikelyPattern),
);

const contractSource = readFileSync(contractPath, "utf8");
const contractAnchor = `  "most\\\\s+)?likely to",\n  "where should",`;
const contractReplacement = `  "(?:are\\\\s+)?(?:most\\\\s+)?likely to",\n  "(?:current|site|maintenance)\\\\s+){0,2}",\n  "where should",`;
assert.equal(
  contractSource.split(contractAnchor).length - 1,
  1,
  "Expected one VOR-058 natural matcher contract anchor",
);
writeFileSync(
  contractPath,
  contractSource.replace(contractAnchor, contractReplacement),
);

console.log("Tightened VOR-058 natural site-priority matchers.");
