import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");

const routeSource = read("src/screens/AiOperations/AiOperations.tsx");
const dashboardSource = read(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
);
const pageSource = read("src/screens/StoresInventory/StoresInventorySection.tsx");
const serviceSource = read("src/screens/StoresInventory/storesInventoryService.ts");
const surfaceSource = read("src/card-surfaces.css");

const failures = [];

const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message);
};
const rejectText = (source, text, message) => {
  if (source.includes(text)) failures.push(message);
};

requireText(
  routeSource,
  '{ label: "Stores Inventory", icon: Warehouse, to: "/stores-inventory" }',
  "Stores Inventory must be present in Maintenance Manager navigation.",
);
if (
  routeSource.match(
    /\{ label: "Stores Inventory", icon: Warehouse, to: "\/stores-inventory" \}/g,
  )?.length !== 2
) {
  failures.push("Stores Inventory must be available in both demo and live navigation.");
}
requireText(
  routeSource,
  '<Route path="stores-inventory" element={<StoresInventorySection />} />',
  "The Stores Inventory route is missing.",
);

for (const [text, message] of [
  ['.from("equipment_components")', "Inventory must use the existing equipment_components evidence source."],
  ['.eq("site_id", siteId)', "Inventory reads must be bounded to the active site."],
  ['.from("equipment_risk_profiles")', "Inventory exposure must use available affected-asset risk evidence."],
  ['if (stockState === "Covered" || stockState === "Excess") return 0;', "Covered or excess stock must not create operational shortage risk."],
  ["stockPoints +", "Exposure must include stock-gap consequence."],
  ["criticalityPoints +", "Exposure must include operational criticality."],
  ["leadTimePoints +", "Exposure must include lead-time risk."],
]) {
  requireText(serviceSource, text, message);
}
const scoreFunction = serviceSource.slice(
  serviceSource.indexOf("function calculateExposureScore"),
  serviceSource.indexOf("function recommendationFor"),
);
if (/unitCost|stockValue|excessValue/.test(scoreFunction)) {
  failures.push("Stock value must not be used as a risk-score driver.");
}
if (/mock|placeholder inventory|Math\.random/i.test(serviceSource)) {
  failures.push("The Stores Inventory service must not substitute mock inventory.");
}

for (const removedCopy of [
  "Site-wide stock intelligence",
  "Demo inventory evidence",
  "Verified live inventory",
  "Refresh inventory",
  "DataTrustBanner",
]) {
  rejectText(
    pageSource,
    removedCopy,
    `Stores Inventory must remove the bespoke '${removedCopy}' presentation.`,
  );
}

for (const [text, message] of [
  [
    '[data-vorta-stores-inventory="true"] > header',
    "Stores Inventory must hide the duplicate desktop content header above the area tabs.",
  ],
  [
    '> section[aria-labelledby="area-risk-heading"]',
    "Stores Inventory must target the introductory area-risk copy above the tabs.",
  ],
  [
    '> div:first-child',
    "Stores Inventory must hide the area-risk heading, helper copy and material count.",
  ],
  [
    '[data-vorta-stores-inventory="true"] > [role="status"]',
    "Stores Inventory must retain evidence status outside the tabs-first opening layout.",
  ],
  ["order: 99", "Inventory evidence status must appear after the operational content."],
]) {
  requireText(surfaceSource, text, message);
}

for (const [text, message] of [
  [
    'data-vorta-inventory-week-comparison="true"',
    "The mobile inventory risk card must expose the previous-week comparison.",
  ],
  ["Previous week", "The comparison must use the requested Previous week label."],
  ["No prior score", "Missing compatible history must fail closed with No prior score."],
  ["`↑ ${difference} worse`", "A higher current inventory risk must be labelled worse."],
  [
    "`↓ ${Math.abs(difference)} better`",
    "A lower current inventory risk must be labelled better.",
  ],
  ["text-red-300", "A worsened previous-week comparison must use red styling."],
  ["text-emerald-300", "An improved previous-week comparison must use green styling."],
  ["No change", "An unchanged previous-week comparison must use neutral copy."],
  [
    'data-vorta-inventory-risk-icon="true"',
    "The existing risk icon needs a stable tablet/desktop hook.",
  ],
  [
    "md:inline-flex",
    "The existing risk icon must remain available from tablet layouts upward.",
  ],
]) {
  requireText(pageSource, text, message);
}

if (/previousWeekRiskScore\s*[:=]\s*\d/.test(pageSource + serviceSource)) {
  failures.push("The previous-week inventory risk score must never be hardcoded.");
}
for (const mismatchedHistorySource of [
  'maintenance_parts_readiness_snapshots',
  'site_risk_history',
]) {
  rejectText(
    pageSource + serviceSource,
    mismatchedHistorySource,
    `Stores Inventory must not present ${mismatchedHistorySource} as the same inventory-risk metric.`,
  );
}

const metricCardStart = pageSource.indexOf("function MetricCard");
const metricCardEnd = pageSource.indexOf("function LoadingState", metricCardStart);
const metricCardSource = pageSource.slice(metricCardStart, metricCardEnd);
for (const [text, message] of [
  [
    'data-vorta-inventory-kpi="true"',
    "Inventory KPI cards need a stable responsive test hook.",
  ],
  ["block md:hidden", "Inventory KPI cards must use a dedicated compact phone layout."],
  ["hidden md:contents", "Tablet and desktop KPI content must retain its current layout."],
  [
    "h-[100px] rounded-xl border p-3",
    "Phone KPI cards must use the reviewed compact equal-height treatment.",
  ],
  [
    "md:h-auto md:min-h-[132px] md:p-4",
    "Tablet and desktop KPI sizing must remain unchanged.",
  ],
  [
    'data-vorta-inventory-kpi-detail="true"',
    "Desktop KPI descriptions must retain a stable visibility hook.",
  ],
]) {
  requireText(metricCardSource, text, message);
}

for (const mobileKpiLabel of [
  "Critical stock-outs",
  "Low stock",
  "Long lead 42+ days",
  "Affected assets",
  "On-hand stock value",
  "Excess stock value",
]) {
  requireText(
    pageSource,
    `mobileLabel="${mobileKpiLabel}"`,
    `Missing compact phone KPI label: ${mobileKpiLabel}`,
  );
}
requireText(
  pageSource,
  '? "Not calculated"',
  "Unavailable excess value must display Not calculated.",
);
requireText(
  pageSource,
  "No calculable excess value is available",
  "Not-calculated excess value must retain an accessible explanation.",
);

for (const sharedTabToken of [
  "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors",
  "border-blue-500/40 bg-blue-600 text-white",
  "border-gray-800 bg-[#0d1117] text-slate-400 hover:border-gray-700 hover:bg-gray-800 hover:text-slate-200",
  'data-vorta-risk-dot="true"',
]) {
  requireText(
    dashboardSource,
    sharedTabToken,
    `Maintenance dashboard is missing the expected selector token: ${sharedTabToken}`,
  );
  requireText(
    pageSource,
    sharedTabToken,
    `Stores Inventory must reuse the Maintenance dashboard selector token: ${sharedTabToken}`,
  );
}
requireText(pageSource, 'aria-label="Inventory area risk"', "Area risk must use accessible tabs.");
requireText(pageSource, 'aria-label="Inventory stock status"', "Stock filters must use an accessible existing tab pattern.");

for (const filterLabel of [
  "Action required",
  "Out of stock",
  "Low stock",
  "Long lead",
  "Excess",
  "All",
]) {
  requireText(pageSource, `label: "${filterLabel}"`, `Missing stock filter: ${filterLabel}`);
}
requireText(pageSource, 'item.stockState === "Below minimum" ||', "Low-stock filter must include below-minimum stock.");
requireText(pageSource, 'item.stockState === "Below target"', "Low-stock filter must include below-target stock.");
rejectText(pageSource, "<select", "Stores Inventory must not fall back to a bespoke/default select filter.");

requireText(pageSource, "<details", "Inventory materials must use the existing details disclosure pattern.");
requireText(pageSource, "<summary", "Inventory materials must use an accessible summary control.");
requireText(pageSource, 'data-vorta-inventory-disclosure="true"', "Inventory disclosure needs a stable semantic hook.");
const summaryStart = pageSource.indexOf("<summary");
const summaryEnd = pageSource.indexOf("</summary>", summaryStart);
const compactSummary = pageSource.slice(summaryStart, summaryEnd);
for (const requiredSummaryField of ["item.partName", "item.partNumber", "item.stockState"]) {
  requireText(
    compactSummary,
    requiredSummaryField,
    `Collapsed material summary must show ${requiredSummaryField}.`,
  );
}
if (/item\.(equipmentName|equipmentCode|leadDays|supplier|storageLocation|minimum|target|recommendedAction|exposureScore)/.test(compactSummary)) {
  failures.push("Collapsed material summary must contain only description, part number and stock status.");
}
const disclosureBody = pageSource.slice(summaryEnd);
for (const expandedField of [
  "item.stock",
  "item.minimum",
  "item.target",
  "item.leadDays",
  "item.supplier",
  "item.storageLocation",
  "item.equipmentName",
  "item.recommendedAction",
]) {
  requireText(
    disclosureBody,
    expandedField,
    `Expanded material details must retain ${expandedField}.`,
  );
}

requireText(
  pageSource,
  "Inventory could not be updated. Previous verified values remain visible.",
  "An unavailable refresh must explain that the previous trusted snapshot remains visible.",
);
const failureHandling = pageSource.slice(
  pageSource.indexOf('if (result.status === "empty")'),
  pageSource.indexOf("  }, [dataMode, siteContext?.siteId]);"),
);
if ((failureHandling.match(/setPayload\(null\)/g) ?? []).length !== 1) {
  failures.push(
    "Only a verified empty result may clear inventory; an unavailable refresh must preserve the previous snapshot.",
  );
}
requireText(pageSource, 'data-vorta-group-frame="true"', "Nested dashboard groups must use the semantic transparent frame.");
requireText(
  pageSource,
  'navigate(`/equipment/${item.equipmentId}/spares?',
  "Expanded inventory details must deep-link to the affected Equipment Spares workflow.",
);
requireText(pageSource, "record: item.partNumber", "The deep link must preserve the selected material reference.");
requireText(pageSource, 'currency: "GBP"', "Inventory values must use the en-GB GBP locale.");
requireText(pageSource, "md:px-6", "The page must include tablet-responsive spacing.");
requireText(pageSource, "lg:grid-cols", "The page must include desktop-responsive layouts.");

if (failures.length > 0) {
  console.error("VOR-014 Stores Inventory contracts failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("VOR-014 Stores Inventory contracts passed.");
