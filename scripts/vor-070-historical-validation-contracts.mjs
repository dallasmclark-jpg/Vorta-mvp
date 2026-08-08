import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const page = readFileSync(
  resolve(root, "src/screens/HistoricalValidation/HistoricalValidationInteractiveExperience.tsx"),
  "utf8",
);
const index = readFileSync(
  resolve(root, "src/screens/HistoricalValidation/index.ts"),
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
      portal.includes("<HistoricalValidationSection />") &&
      index.includes("HistoricalValidationInteractiveExperience"),
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
    page.includes("siteContext?.siteId") && service.includes("data.siteId !== siteId"),
  ],
  [
    "Area scope filters governed cases and recomputes the complete summary",
    service.includes('item.equipment.area === scope') &&
      service.includes("summary: summariseHistoricalValidationCases(cases)") &&
      page.includes("scopeHistoricalValidation(result, scope)"),
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
    "Site and Area controls retain the portal tab contract and horizontal scrolling",
    page.includes('aria-label="Historical validation scope"') &&
      page.includes('role="tab"') &&
      page.includes("overflow-x-auto") &&
      page.includes('label="Site"'),
  ],
  [
    "Historical Risk Briefing is split into readable operational statements",
    page.includes("Historical Risk Briefing") &&
      page.includes('data-vorta-historical-briefing="true"') &&
      page.includes("buildBriefingLines") &&
      page.includes("recorded breakdown cases were preceded by elevated Vorta risk") &&
      page.includes("model-control evidence"),
  ],
  [
    "Historical Validation retains the five governed timeline event types",
    page.includes("Historical Risk Timeline") &&
      page.includes('data-vorta-historical-timeline="true"') &&
      [
        'kind: "warning"',
        'kind: "stockout"',
        'kind: "breakdown"',
        'kind: "intervention"',
        'kind: "false-positive"',
      ].every((token) => page.includes(token)) &&
      page.includes("item.timeframe.failureAt") &&
      page.includes("item.timeframe.interventionAt") &&
      page.includes("item.timeframe.validationWindowEnd"),
  ],
  [
    "Timeline supports Week Month Quarter and Year regrouping from governed timestamps",
    ['key: "week"', 'key: "month"', 'key: "quarter"', 'key: "year"'].every((token) =>
      page.includes(token),
    ) &&
      page.includes("buildTimelineBuckets") &&
      page.includes('useState<TimelineScale>("quarter")') &&
      page.includes("data-vorta-historical-scale-control"),
  ],
  [
    "Timeline dots are keyboard-accessible interactive evidence controls",
    page.includes('role="button"') &&
      page.includes("tabIndex={0}") &&
      page.includes("data-vorta-historical-event-control") &&
      page.includes('event.key === "Enter"') &&
      page.includes('event.key === " "'),
  ],
  [
    "Breakdown timeline evidence exposes the last recorded risk before failure",
    page.includes("Last Vorta risk before breakdown") &&
      page.includes("item.risk.preOutcomeScore ?? item.risk.warningScore") &&
      page.includes("item.risk.preOutcomeCapturedAt") &&
      page.includes("First elevated warning") &&
      page.includes("Primary risk driver"),
  ],
  [
    "Aggregated timeline dots expose their underlying events",
    page.includes("events in this period") &&
      page.includes("group.events.map") &&
      page.includes("onActiveIndexChange"),
  ],
  [
    "Timeline evidence opens in a modal right-side panel without route mutation",
    page.includes('data-vorta-historical-event-panel="true"') &&
      page.includes('role="dialog"') &&
      page.includes('aria-modal="true"') &&
      page.includes("absolute inset-y-0 right-0") &&
      page.includes("max-w-lg"),
  ],
  [
    "Timeline panel supports Escape dismissal and focus return",
    page.includes('event.key === "Escape"') &&
      page.includes("closeButtonRef.current?.focus()") &&
      page.includes("triggerRefs.current.get(key)?.focus()"),
  ],
  [
    "Timeline panel retains explicit causation and preventability boundaries",
    page.includes("This timeline proves sequence and recorded association only") &&
      page.includes("does not prove that the risk condition caused the breakdown") &&
      page.includes("recommended intervention would definitely have prevented it"),
  ],
  [
    "Nine isolated KPI tiles remain replaced by three grouped decision findings",
    [
      'keyName="warning"',
      'keyName="spares"',
      'keyName="controls"',
      "Warning performance",
      "Spares & recovery",
      "Interventions & controls",
    ].every((token) => page.includes(token)) &&
      !page.includes('data-vorta-historical-metric='),
  ],
  [
    "Evidence Register retains category tabs and adds search and sorting",
    [
      'key: "breakdowns"',
      'key: "interventions"',
      'key: "false-positives"',
      'key: "spares"',
      "Historical Evidence Register",
      "Search historical evidence",
      "Sort historical evidence",
      "Highest warning risk",
    ].every((token) => page.includes(token)),
  ],
  [
    "Synthetic demonstration evidence stays explicit while live mode fails closed",
    page.includes("Synthetic demonstration history · not imported pilot SAP history") &&
      page.includes('dataMode === "live"') &&
      page.includes("does not substitute synthetic demonstration history for a live site"),
  ],
  [
    "Loading empty error retry and area-empty states remain explicit",
    page.includes("Loading Historical Validation") &&
      page.includes("Historical validation could not be loaded") &&
      page.includes("No historical validation evidence is available") &&
      page.includes("No historical cases in") &&
      page.includes("Try again"),
  ],
  [
    "Detailed evidence remains auditable and links to Equipment History",
    page.includes('data-vorta-historical-case=') &&
      page.includes("`/equipment/${item.equipment.id}/history`") &&
      page.includes("Equipment history") &&
      page.includes("Linked evidence"),
  ],
  [
    "Historical Validation remains read-only",
    !page.includes("supabase.") &&
      !/\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.upsert\s*\(/.test(service),
  ],
];

let failures = 0;
for (const [label, passed] of assertions) {
  if (passed) console.log(`PASS - ${label}`);
  else {
    failures += 1;
    console.error(`FAIL - ${label}`);
  }
}

if (failures > 0) {
  console.error(`VOR-070 Historical Validation contract failed: ${failures}/${assertions.length}.`);
  process.exit(1);
}

console.log(`VOR-070 Historical Validation contracts passed: ${assertions.length}/${assertions.length}.`);
