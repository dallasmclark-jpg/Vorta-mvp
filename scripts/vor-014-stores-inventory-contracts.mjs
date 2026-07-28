import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");

const routeSource = read("src/screens/AiOperations/AiOperations.tsx");
const pageSource = read("src/screens/StoresInventory/StoresInventorySection.tsx");
const serviceSource = read("src/screens/StoresInventory/storesInventoryService.ts");

const failures = [];

const requireText = (source, text, message) => {
  if (!source.includes(text)) failures.push(message);
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
requireText(
  serviceSource,
  '.from("equipment_components")',
  "Inventory must use the existing equipment_components evidence source.",
);
requireText(
  serviceSource,
  '.eq("site_id", siteId)',
  "Inventory reads must be bounded to the active site.",
);
requireText(
  serviceSource,
  '.from("equipment_risk_profiles")',
  "Inventory exposure must use available affected-asset risk evidence.",
);
requireText(
  serviceSource,
  'if (stockState === "Covered" || stockState === "Excess") return 0;',
  "Covered or excess stock must not create operational shortage risk.",
);
requireText(
  serviceSource,
  "stockPoints +",
  "Exposure must include stock-gap consequence.",
);
requireText(
  serviceSource,
  "criticalityPoints +",
  "Exposure must include operational criticality.",
);
requireText(
  serviceSource,
  "leadTimePoints +",
  "Exposure must include lead-time risk.",
);
const scoreFunction = serviceSource.slice(
  serviceSource.indexOf("function calculateExposureScore"),
  serviceSource.indexOf("function recommendationFor"),
);
if (/unitCost|stockValue|excessValue/.test(scoreFunction)) {
  failures.push("Stock value must not be used as a risk-score driver.");
}
requireText(
  pageSource,
  'role="tablist"',
  "Area risk must use accessible tabs.",
);
requireText(
  pageSource,
  "Verified live inventory",
  "The page must distinguish verified live evidence.",
);
requireText(
  pageSource,
  "Stale inventory evidence",
  "The page must label stale evidence.",
);
requireText(
  pageSource,
  "Partial live evidence",
  "The page must label partial evidence.",
);
requireText(
  pageSource,
  "Refresh failed. The previous evidence remains visible",
  "A failed refresh must explain that the previous trusted snapshot remains visible.",
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
requireText(
  pageSource,
  'data-vorta-group-frame="true"',
  "Nested dashboard groups must use the semantic transparent frame.",
);
requireText(
  pageSource,
  'navigate(`/equipment/${item.equipmentId}/spares?',
  "Inventory records must deep-link to the affected equipment Spares workflow.",
);
requireText(
  pageSource,
  'record: item.partNumber',
  "The deep link must preserve the selected material reference.",
);
requireText(
  pageSource,
  'currency: "GBP"',
  "Inventory values must use the en-GB GBP locale.",
);
requireText(
  pageSource,
  'sm:px-6',
  "The page must include tablet-responsive spacing.",
);
requireText(
  pageSource,
  'lg:grid-cols',
  "The page must include desktop-responsive layouts.",
);
if (/mock|placeholder inventory|Math\.random/i.test(serviceSource)) {
  failures.push("The Stores Inventory service must not substitute mock inventory.");
}

if (failures.length > 0) {
  console.error("VOR-014 Stores Inventory contracts failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("VOR-014 Stores Inventory contracts passed.");
