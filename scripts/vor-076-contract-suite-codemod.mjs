import { readFileSync, writeFileSync } from "node:fs";

const path = "scripts/run-contract-suite.mjs";
let source = readFileSync(path, "utf8");
const before = `  ["VOR-070 Historical Validation", "scripts/vor-070-historical-validation-contracts.mjs"],`;
const after = `${before}\n  ["VOR-076 spare photo stock matching", "scripts/vor-076-spare-photo-contracts.mjs"],`;
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Missing VOR-076 contract-suite anchor.");
  source = source.replace(before, after);
}
writeFileSync(path, source);
