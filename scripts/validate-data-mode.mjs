const context = String(process.env.CONTEXT ?? "").trim().toLowerCase();
const mode = String(process.env.VITE_VORTA_DATA_MODE ?? "")
  .trim()
  .toLowerCase();
const validModes = new Set(["live", "demo", "unavailable"]);

if (context !== "production") {
  console.log("Data-mode validation skipped outside the Netlify production context.");
  process.exit(0);
}

if (!validModes.has(mode)) {
  throw new Error(
    "Netlify production requires an explicit VITE_VORTA_DATA_MODE of live, demo or unavailable. Missing configuration is not treated as live.",
  );
}

console.log(`Validated Netlify production data mode: ${mode}.`);
