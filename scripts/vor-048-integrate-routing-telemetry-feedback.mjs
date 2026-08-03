import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const backendPath = resolve(repositoryRoot, "netlify/functions/ask-vorta.mts");
const marker = 'type AskVortaPhase = "planner" | "evidence" | "answer";';

if (readFileSync(backendPath, "utf8").includes(marker)) {
  console.log("VOR-048 routing, telemetry and feedback integration is already applied.");
  process.exit(0);
}

const scriptsDirectory = resolve(repositoryRoot, "scripts");
const patchNames = readdirSync(scriptsDirectory)
  .filter((name) => /^vor-048-\d{2}-.+\.patch$/.test(name))
  .sort();
if (patchNames.length === 0) {
  throw new Error("VOR-048 integration patches were not found.");
}

for (const patchName of patchNames) {
  const result = spawnSync(
    "git",
    ["apply", "--whitespace=nowarn", resolve(scriptsDirectory, patchName)],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `VOR-048 integration patch ${patchName} failed.${detail ? `\n${detail}` : ""}`,
    );
  }
}
console.log("Applied VOR-048 Shift Cover routing, phase telemetry and feedback integration.");
