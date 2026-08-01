import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const dashboard = read("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx");
const labour = read("src/screens/AiOperations/sections/DashboardOverviewSection/LabourRiskSection.tsx");
const opportunities = read("src/screens/AiOperations/sections/DashboardOverviewSection/RiskOpportunityCards.tsx");
const inventory = read("src/screens/StoresInventory/storesInventoryService.ts");
const scrollState = read("src/screens/AiOperations/sections/DashboardOverviewSection/dashboardScrollState.ts");

const checks = [
  [dashboard.includes("<BiggestReductionOpportunity") && dashboard.includes("plan={riskReductionPlan}"), "The expanded work plan must retain the leading calculated intervention."],
  [dashboard.indexOf("<BiggestReductionOpportunity") < dashboard.indexOf("Recommended Work Queue"), "The leading intervention must remain above the full recommended work queue."],
  [dashboard.includes("riskReductionPlan={riskReductionPlan}"), "The verified risk-reduction plan must remain available to the combined risk section."],
  [labour.includes('"Spares & Labour Risks"') && labour.includes("Spares & Labour Risks`"), "The combined section heading must remain correct for site and area scopes."],
  [labour.includes("loadStoresInventorySnapshot") && labour.includes("summariseStoresInventory"), "Dashboard Spares Risk must reuse the canonical Stores Inventory reader and summary calculation."],
  [inventory.includes("function calculateExposureScore") && inventory.includes("stockState") && inventory.includes("componentCriticality") && inventory.includes("equipmentCriticality") && inventory.includes("leadDays") && inventory.includes("assetRiskScore"), "Part exposure must continue to use stock state, component and equipment criticality, lead time and linked asset risk."],
  [inventory.includes("maximum * 0.7") && inventory.includes("topAverage * 0.3") && inventory.includes(".slice(0, 5)"), "Scoped inventory risk must remain 70% of maximum exposure plus 30% of the top-five average."],
  [labour.includes("isSiteRiskScope || !activeScopeArea") && labour.includes("item.area.trim().toLowerCase() === normalisedArea"), "Spares Risk must use all site inventory for site scope and only selected-area inventory for area scope."],
  [labour.includes('title: "Spares Risk"') && labour.includes('metricLabel: "Affected assets"') && labour.includes('extraLabel: "Action-required parts"'), "The card must present a score-first category summary rather than one spare-part record."],
  [labour.includes('data-vorta-spares-risk-card=') && labour.includes('data-vorta-dashboard-card="labour-risk"') && labour.includes('data-vorta-labour-risk-card={item.slug}'), "Spares Risk must inherit the same rail-card sizing and responsive hooks as labour cards."],
  [labour.includes("Overall risk score") && labour.includes("<RiskMeter") && labour.includes("spareSummary?.riskScore"), "Spares Risk must expose its calculated score and the standard risk meter."],
  [labour.includes('displayScore: spareScore === null ? "Not calculated"') && !labour.includes('displayScore: spareScore === null ? "0'), "Unavailable evidence must never be converted into a misleading zero score."],
  [labour.includes('"loading"') && labour.includes('"partial"') && labour.includes('"stale"') && labour.includes('"empty"') && labour.includes('"unavailable"'), "Loading, partial, stale, empty and unavailable inventory evidence states must remain explicit."],
  [labour.includes("trustedInventoryRef") && labour.includes('window.addEventListener("online"'), "The last trusted inventory snapshot must be preserved and network recovery must retry the calculation."],
  [labour.includes('filter: "attention"') && labour.includes('return `/stores-inventory?') && labour.includes('params.set("area", activeScopeArea)'), "Opening Spares Risk must retain dashboard origin, action-required filtering and selected-area scope."],
  [labour.includes("saveDashboardScrollPosition") && scrollState.includes("sessionStorage") && scrollState.includes("requestAnimationFrame"), "Dashboard return position and asynchronous restoration must remain intact."],
  [labour.includes("getLeadingSpareRiskAction") && opportunities.includes('action.target === "spares"'), "The current leading spare intervention must remain available as supporting action context."],
  [opportunities.includes("data-vorta-biggest-reduction-opportunity") && opportunities.includes("Site-risk reduction") && opportunities.includes("text-emerald-400"), "The detailed leading intervention must still show its calculated reduction in the expanded work plan."],
  [!labour.includes("Critical spare shortage") && !labour.includes("Potential site-risk reduction") && !labour.includes("partReference"), "The rail card must not regress to a featured spare-part detail card."],
  [!opportunities.includes("CriticalSpareRiskCard") && !opportunities.includes("data-vorta-critical-spare-risk-card"), "The obsolete spare-detail rail component must remain removed."],
  [!labour.includes("RABS-01") && !opportunities.includes("RABS-01") && !inventory.includes("RABS-01"), "The dashboard and risk calculation must not hard-code the current demonstration spare."],
  [(labour.match(/kind: "labour"/g) ?? []).length >= 1 && labour.includes("[...labourItems, spareItem].sort"), "Existing labour cards must remain present and all category cards must be ordered by calculated score."],
];

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error("VOR-032 calculated dashboard Spares Risk contracts failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`VOR-032 calculated dashboard Spares Risk contracts passed (${checks.length} checks).`);
