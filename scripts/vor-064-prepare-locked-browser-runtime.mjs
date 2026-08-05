import { readFileSync, unlinkSync, writeFileSync } from "node:fs";

const suitePath = "scripts/run-contract-suite.mjs";
const suiteSource = readFileSync(suitePath, "utf8");
const suiteEntry =
  '  ["VOR-064 locked browser runtime", "scripts/vor-064-locked-browser-runtime-contracts.mjs"],\n';

if (!suiteSource.includes(suiteEntry)) {
  const anchor =
    '  ["VOR-057 daily Netlify release", "scripts/netlify-daily-deploy-contracts.mjs"],\n';
  if (!suiteSource.includes(anchor)) {
    throw new Error("Could not locate the VOR-057 contract-suite anchor");
  }
  writeFileSync(suitePath, suiteSource.replace(anchor, anchor + suiteEntry));
}

unlinkSync(new URL(import.meta.url));
