import { readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const distDirectory = resolve(process.cwd(), "dist");
const budgets = {
  totalJavaScriptBytes: 3_250_000,
  largestJavaScriptBytes: 625_000,
  totalCssBytes: 150_000,
  totalDistBytes: 3_500_000,
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
    console.error(`- ${label}: ${formatBytes(actual)} exceeds ${formatBytes(budget)}`);
  }
  process.exit(1);
}

console.log("Production bundle performance budgets passed.");
