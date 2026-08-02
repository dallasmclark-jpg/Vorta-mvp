import { existsSync, readFileSync } from "node:fs";

const sourcePath = "netlify/functions/ask-vorta.mts";
const source = readFileSync(sourcePath, "utf8");

if (source.includes('const MODEL = "gpt-5.6-terra"')) {
  console.log("VOR-038 intelligence source is already applied in this worktree.");
  process.exit(0);
}

if (!existsSync("scripts/apply-vor-038-intelligence.mjs")) {
  throw new Error("VOR-038 source is not patched and the patch module is missing.");
}

await import("./apply-vor-038-intelligence.mjs");
