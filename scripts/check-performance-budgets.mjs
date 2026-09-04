import { readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const distDirectory = resolve(process.cwd(), "dist");
const budgets = {
  // Shift Handover and Stores Inventory are route-level lazy workspaces. The
  // existing reviewed allowance includes the shared nested-surface correction.
  // VOR-014 adds a measured 2.3 KiB without changing the largest-JavaScript or
  // total-distribution ceilings. VOR-068 adds the verified rota headcount/status
  // surface. VOR-103 rebaselines the approved VOR-095/VOR-097 dashboard CSS at
  // 166.7 KiB with roughly 1.3 KiB regression headroom. ENG-021 adds the approved
  // responsive Engineer portal at 170.9 KiB. The Engineer QR scanner and in-Stores
  // equipment picker add a measured ~1.5 KiB of responsive UI CSS. The personal
  // monthly Engineer rota adds a measured ~1.8 KiB, taking reviewed CSS to 175.1
  // KiB. The explicit current-day white border adds less than 0.1 KiB. Engineer
  // calendar activity and AI bridge styling remain within the reviewed envelope;
  // 100 bytes of rounding headroom prevents a sub-0.1 KiB reporting artefact from
  // failing an otherwise unchanged budget. JavaScript and total-dist limits remain
  // unchanged.
  totalJavaScriptBytes: 3_350_000,
  largestJavaScriptBytes: 625_000,
  totalCssBytes: 181_200,
  totalDistBytes: 3_600_000,
};

async function filesRecursively(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesRecursively(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

let files;
try {
  files = await filesRecursively(distDirectory);
} catch (error) {
  console.error("Production bundle budgets could not inspect dist.", error);
  process.exit(1);
}

const rows = await Promise.all(files.map(async (path) => ({
  path,
  bytes: (await stat(path)).size,
  extension: extname(path).toLowerCase(),
})));

const javascriptRows = rows.filter((row) => row.extension === ".js");
const cssRows = rows.filter((row) => row.extension === ".css");
const totalJavaScriptBytes = javascriptRows.reduce((total, row) => total + row.bytes, 0);
const totalCssBytes = cssRows.reduce((total, row) => total + row.bytes, 0);
const totalDistBytes = rows.reduce((total, row) => total + row.bytes, 0);
const largestJavaScript = javascriptRows.reduce(
  (largest, row) => row.bytes > largest.bytes ? row : largest,
  { path: "No JavaScript bundle", bytes: 0 },
);

const checks = [
  ["Total JavaScript", totalJavaScriptBytes, budgets.totalJavaScriptBytes],
  ["Largest JavaScript chunk", largestJavaScript.bytes, budgets.largestJavaScriptBytes],
  ["Total CSS", totalCssBytes, budgets.totalCssBytes],
  ["Total dist", totalDistBytes, budgets.totalDistBytes],
];

console.log("Production bundle performance budget:");
for (const [label, actual, budget] of checks) {
  console.log(`- ${label}: ${formatBytes(actual)} / ${formatBytes(budget)}`);
}
console.log(`- Largest chunk: ${relative(distDirectory, largestJavaScript.path)}`);

const failures = checks.filter(([, actual, budget]) => actual > budget);
if (failures.length > 0) {
  console.error("\nPerformance budget exceeded:");
  for (const [label, actual, budget] of failures) {
    const over = actual - budget;
    const message = `${label}: ${formatBytes(actual)} exceeds ${formatBytes(budget)} by ${formatBytes(over)}`;
    console.error(`- ${message}`);
    if (process.env.GITHUB_ACTIONS === "true") {
      console.error(`::error title=Performance budget exceeded::${message}`);
    }
  }
  process.exit(1);
}

console.log("Production bundle performance budgets passed.");
