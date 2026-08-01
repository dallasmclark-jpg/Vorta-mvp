import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const dashboard = read("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx");
const labour = read("src/screens/AiOperations/sections/DashboardOverviewSection/LabourRiskSection.tsx");
const opportunities = read("src/screens/AiOperations/sections/DashboardOverviewSection/RiskOpportunityCards.tsx");
const scrollState = read("src/screens/AiOperations/sections/DashboardOverviewSection/dashboardScrollState.ts");

const labourRailIndex = labour.indexOf('data-vorta-card-rail="labour-risk"');
const spareCardIndex = labour.indexOf("<CriticalSpareRiskCard");
const labourRailClosingIndex = labour.indexOf("\n      </div>\n    </section>", labourRailIndex);

const checks = [
  [dashboard.includes("<BiggestReductionOpportunity") && dashboard.includes("plan={riskReductionPlan}"), "The expanded dashboard work plan must render the compact biggest-reduction opportunity from the live plan."],
  [dashboard.indexOf("<BiggestReductionOpportunity") < dashboard.indexOf("Recommended Work Queue"), "The compact opportunity must appear before the full recommended work queue."],
  [dashboard.includes("riskReductionPlan={riskReductionPlan}"), "The live risk-reduction plan must be passed into the combined spares and labour section."],
  [labour.includes('"Spares & Labour Risks"') && labour.includes("Spares & Labour Risks`"), "The dashboard section heading must be renamed for site and area scopes."],
  [labourRailIndex >= 0 && spareCardIndex > labourRailIndex && spareCardIndex < labourRailClosingIndex, "The critical spare card must be a direct compact item inside the existing labour-risk card rail, not a separate full-width panel."],
  [opportunities.includes('data-vorta-dashboard-card="spare-risk"') && opportunities.includes('className="flex h-full flex-col gap-3 p-4"'), "The spare card must reuse the labour-card height, spacing and content hierarchy."],
  [!opportunities.includes("<dl") && !opportunities.includes("Operational consequence"), "The compact spare card must not contain the previous multi-panel detailed breakdown."],
  [opportunities.includes("getLeadingRiskAction") && opportunities.includes("right.calculatedReduction - left.calculatedReduction"), "The leading opportunity must be selected dynamically by calculated reduction."],
  [opportunities.includes('action.target === "spares"') && opportunities.includes("getLeadingSpareRiskAction"), "The compact card must select the highest calculated spare intervention."],
  [opportunities.includes("data-vorta-biggest-reduction-opportunity") && opportunities.includes("data-vorta-critical-spare-risk-card"), "Both dashboard surfaces need stable semantic test hooks."],
  [opportunities.includes("getRiskPlanActionRoute") && opportunities.includes("openWorkOrderDetail"), "Opportunity navigation must reuse the established Vorta intervention routes."],
  [opportunities.includes("saveDashboardScrollPosition") && opportunities.includes("restoreDashboardScrollPosition"), "Dashboard action links must preserve and restore the previous scroll position."],
  [scrollState.includes("sessionStorage") && scrollState.includes("requestAnimationFrame") && scrollState.includes("data-vorta-portal-scroll-container"), "Scroll restoration must wait for the asynchronous dashboard content inside the portal scroller."],
  [dashboard.includes("restoreDashboardWorkPlanExpanded") && dashboard.includes("useState(isRiskDetailOpen)"), "Returning from an intervention must reopen the expanded work plan before restoring its previous scroll position."],
  [scrollState.includes("DASHBOARD_WORK_PLAN_KEY") && scrollState.includes("data-vorta-biggest-reduction-opportunity"), "Dashboard return state must preserve whether the risk work plan was expanded."],
  [opportunities.includes("text-emerald-400") && opportunities.includes("Potential site-risk reduction"), "The calculated reduction must remain visibly green without opening the card."],
  [opportunities.includes("line-clamp-3") && opportunities.includes("[overflow-wrap:anywhere]") && opportunities.includes("min-h-11"), "Long spare descriptions and mobile touch targets must remain usable on narrow layouts."],
  [opportunities.includes('data-vorta-mobile-card-action="true"') && opportunities.includes("View spare →"), "The compact spare card must expose the same mobile action treatment as the labour cards."],
  [!opportunities.includes("RABS-01") && !opportunities.includes("control I/O module"), "The dashboard must not hard-code the current demonstration spare or equipment."],
  [!labour.includes("No current spare") && !opportunities.includes("No current spare"), "No empty spare-risk placeholder may be displayed when the live plan has no spare intervention."],
  [(labour.match(/data-vorta-labour-risk-card/g) ?? []).length >= 1, "Existing labour-risk cards and navigation must remain present."],
];

const failures = checks.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  console.error("VOR-032 dashboard critical-spares contracts failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`VOR-032 dashboard critical-spares contracts passed (${checks.length} checks).`);
