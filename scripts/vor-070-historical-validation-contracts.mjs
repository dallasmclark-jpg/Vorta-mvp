import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const page = readFileSync(
  resolve(root, "src/screens/HistoricalValidation/HistoricalValidationSection.tsx"),
  "utf8",
);
const service = readFileSync(
  resolve(root, "src/screens/HistoricalValidation/historicalValidationService.ts"),
  "utf8",
);
const portal = readFileSync(
  resolve(root, "src/screens/AiOperations/AiOperations.tsx"),
  "utf8",
);

const assertions = [
  [
    "Historical Validation is a first-class Maintenance Manager navigation item",
    (portal.match(/label: "Historical Validation"/g) ?? []).length === 2 &&
      portal.includes('to: "/historical-validation"'),
  ],
  [
    "Historical Validation has a protected portal route",
    portal.includes('path="historical-validation"') &&
      portal.includes("<HistoricalValidationSection />"),
  ],
  [
    "Historical Validation loads the canonical VOR-069 governed RPC",
    service.includes('supabase.rpc("vorta_get_historical_backtest"') &&
      service.includes("VOR_069_BACKTEST_DATASET_VERSION") &&
      service.includes("VOR_069_BACKTEST_VALIDATION_DAYS") &&
      service.includes("p_equipment_id: null"),
  ],
  [
    "Site access comes from the authenticated active-site context",
    page.includes("siteContext?.siteId") &&
      service.includes("data.siteId !== siteId"),
  ],
  [
    "Area scope filters governed cases and recomputes the complete summary",
    service.includes('item.equipment.area === scope') &&
      service.includes("summary: summariseHistoricalValidationCases(cases)") &&
      service.includes("scenarioCount: cases.length"),
  ],
  [
    "Summary logic retains VOR-069 evidence classifications",
    [
      "elevated_risk_preceded_breakdown",
      "intervention_plausibly_relevant",
      "stockout_preceded_breakdown",
      "stockout_materially_extended_recovery",
      "successful_intervention",
      "false_positive",
      "preventability_supported",
    ].every((code) => service.includes(code)),
  ],
  [
    "Site and Area controls use the portal tab contract and horizontal scrolling",
    page.includes('role="tablist"') &&
      page.includes('aria-label="Historical validation scope"') &&
      page.includes('role="tab"') &&
      page.includes("overflow-x-auto") &&
      page.includes('label="Site"'),
  ],
  [
    "Historical evidence views cover breakdowns interventions false positives and spares",
    [
      'key: "breakdowns"',
      'key: "interventions"',
      'key: "false-positives"',
      'key: "spares"',
    ].every((token) => page.includes(token)),
  ],
  [
    "Historical summary exposes the requested decision metrics",
    [
      'key: "scenarios"',
      'key: "breakdown-warnings"',
      'key: "median-warning"',
      'key: "prefailure-stockouts"',
      'key: "recovery-delays"',
      'key: "material-wait"',
      'key: "interventions"',
      'key: "false-positives"',
    ].every((token) => page.includes(token)),
  ],
  [
    "Synthetic demonstration evidence is explicit and causation is bounded",
    page.includes("Historical demonstration evidence") &&
      page.includes("not imported pilot-site SAP history") &&
      page.includes("do not prove breakdown causation or guaranteed preventability"),
  ],
  [
    "Live mode fails closed instead of showing synthetic evidence",
    page.includes('dataMode === "live"') &&
      page.includes("does not substitute synthetic demonstration history for a live site"),
  ],
  [
    "Loading empty error retry and area-empty states are explicit",
    page.includes("Loading Historical Validation") &&
      page.includes("Historical validation could not be loaded") &&
      page.includes("No historical validation evidence is available") &&
      page.includes("No historical cases in") &&
      page.includes("Try again"),
  ],
  [
    "Evidence cases link back to existing Equipment History",
    page.includes("`/equipment/${item.equipment.id}/history`") &&
      page.includes("Equipment history"),
  ],
  [
    "Historical Validation remains read-only",
    !/\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/.test(service + page),
  ],
];

let failures = 0;
for (const [label, passed] of assertions) {
  if (passed) {
    console.log(`PASS - ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${label}`);
  }
}

if (failures > 0) {
  console.error(`VOR-070 Historical Validation contract failed: ${failures}/${assertions.length}.`);
  process.exit(1);
}

console.log(`VOR-070 Historical Validation contracts passed: ${assertions.length}/${assertions.length}.`);
