import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const dashboard = read("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx");
const labour = read("src/screens/AiOperations/sections/DashboardOverviewSection/LabourRiskSection.tsx");
const opportunities = read("src/screens/AiOperations/sections/DashboardOverviewSection/RiskOpportunityCards.tsx");

const checks = [
  [dashboard.includes("<BiggestReductionOpportunity") && dashboard.includes("plan={riskReductionPlan}"), "The expanded dashboard work plan must render the compact biggest-reduction opportunity from the live plan."],
  [dashboard.indexOf("<BiggestReductionOpportunity") < dashboard.indexOf("Recommended Work Queue"), "The compact opportunity must appear before the full recommended work queue."],
  [dashboard.includes("riskReductionPlan={riskReductionPlan}"), "The live risk-reduction plan must be passed into the combined spares and labour section."],
  [labour.includes('"Spares & Labour Risks"') && labour.includes("Spares & Labour Risks`"), "The dashboard section heading must be renamed for site and area scopes."],
  [labour.includes("<CriticalSpareRiskCard") && labour.includes("plan={riskReductionPlan}"), "The detailed critical spare card must complement the existing labour cards inside the renamed section."],
  [opportunities.includes("getLeadingRiskAction") && opportunities.includes("right.calculatedReduction - left.calculatedReduction"), "The leading opportunity must be selected dynamically by calculated reduction."],
  [opportunities.includes('action.target === "spares"') && opportunities.includes("getLeadingSpareRiskAction"), "The detailed card must select the highest calculated spare intervention."],
  [opportunities.includes("data-vorta-biggest-reduction-opportunity") && opportunities.includes("data-vorta-critical-spare-risk-card"), "Both new dashboard surfaces need stable semantic test hooks."],
  [opportunities.includes("getRiskPlanActionRoute") && opportunities.includes("openWorkOrderDetail"), "Opportunity navigation must reuse the established Vorta intervention routes."],
  [opportunities.includes("text-emerald-400") && opportunities.includes("Potential site-risk reduction"), "The calculated reduction must remain visibly green without opening the card."],
  [opportunities.includes("[overflow-wrap:anywhere]") && opportunities.includes("min-h-11"), "Long spare descriptions and touch targets must remain usable on narrow layouts."],
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
