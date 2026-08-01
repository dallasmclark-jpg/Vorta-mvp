from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:100]!r}")
    target.write_text(content.replace(old, new, 1))


opportunities = "src/screens/AiOperations/sections/DashboardOverviewSection/RiskOpportunityCards.tsx"
contracts = "scripts/vor-032-dashboard-critical-spares-contracts.mjs"

replace_once(
    opportunities,
    'import type { KeyboardEvent } from "react";\n',
    'import { useEffect, type KeyboardEvent } from "react";\n',
)
replace_once(
    opportunities,
    'import { getRiskPlanActionRoute } from "../../riskActionRouting";\n',
    'import { getRiskPlanActionRoute } from "../../riskActionRouting";\n'
    'import {\n'
    '  restoreDashboardScrollPosition,\n'
    '  saveDashboardScrollPosition,\n'
    '} from "./dashboardScrollState";\n',
)
replace_once(
    opportunities,
    '''function openAction(
  plan: SiteRiskReductionPlan,
  action: SiteRiskReductionAction,
  onNavigate: (path: string) => void,
): void {
  const workOrderNumber = action.workOrderNumbers[0] ?? null;''',
    '''function openAction(
  plan: SiteRiskReductionPlan,
  action: SiteRiskReductionAction,
  onNavigate: (path: string) => void,
): void {
  saveDashboardScrollPosition();
  const workOrderNumber = action.workOrderNumbers[0] ?? null;''',
)
replace_once(
    opportunities,
    '''interface RiskOpportunityProps {
  plan: SiteRiskReductionPlan | null;
  onNavigate: (path: string) => void;
}
''',
    '''function useDashboardScrollRestoration(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;
    return restoreDashboardScrollPosition();
  }, [enabled]);
}

interface RiskOpportunityProps {
  plan: SiteRiskReductionPlan | null;
  onNavigate: (path: string) => void;
}
''',
)
replace_once(
    opportunities,
    '''  const action = getLeadingRiskAction(plan);
  if (!plan || !action) return null;''',
    '''  const action = getLeadingRiskAction(plan);
  useDashboardScrollRestoration(Boolean(plan && action));
  if (!plan || !action) return null;''',
)
replace_once(
    opportunities,
    '''  const action = getLeadingSpareRiskAction(plan);
  if (!plan || !action) return null;''',
    '''  const action = getLeadingSpareRiskAction(plan);
  useDashboardScrollRestoration(Boolean(plan && action));
  if (!plan || !action) return null;''',
)
replace_once(
    contracts,
    '''const opportunities = read("src/screens/AiOperations/sections/DashboardOverviewSection/RiskOpportunityCards.tsx");
''',
    '''const opportunities = read("src/screens/AiOperations/sections/DashboardOverviewSection/RiskOpportunityCards.tsx");
const scrollState = read("src/screens/AiOperations/sections/DashboardOverviewSection/dashboardScrollState.ts");
''',
)
replace_once(
    contracts,
    '''  [opportunities.includes("getRiskPlanActionRoute") && opportunities.includes("openWorkOrderDetail"), "Opportunity navigation must reuse the established Vorta intervention routes."],
''',
    '''  [opportunities.includes("getRiskPlanActionRoute") && opportunities.includes("openWorkOrderDetail"), "Opportunity navigation must reuse the established Vorta intervention routes."],
  [opportunities.includes("saveDashboardScrollPosition") && opportunities.includes("restoreDashboardScrollPosition"), "Dashboard action links must preserve and restore the previous scroll position."],
  [scrollState.includes("sessionStorage") && scrollState.includes("requestAnimationFrame") && scrollState.includes("data-vorta-portal-scroll-container"), "Scroll restoration must wait for the asynchronous dashboard content inside the portal scroller."],
''',
)

print("VOR-032 scroll restoration patch applied")
