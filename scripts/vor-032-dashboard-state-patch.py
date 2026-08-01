from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:120]!r}")
    target.write_text(content.replace(old, new, 1))


dashboard = "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"
contracts = "scripts/vor-032-dashboard-critical-spares-contracts.mjs"

replace_once(
    dashboard,
    'import { BiggestReductionOpportunity } from "./RiskOpportunityCards";\n',
    'import { BiggestReductionOpportunity } from "./RiskOpportunityCards";\n'
    'import { restoreDashboardWorkPlanExpanded } from "./dashboardScrollState";\n',
)

replace_once(
    dashboard,
    '''  const [isRiskDetailOpen, setIsRiskDetailOpen] = useState(false);
  const [
    hasOpenedRiskPlan,
    setHasOpenedRiskPlan,
  ] = useState(false);''',
    '''  const [isRiskDetailOpen, setIsRiskDetailOpen] = useState(
    restoreDashboardWorkPlanExpanded,
  );
  const [
    hasOpenedRiskPlan,
    setHasOpenedRiskPlan,
  ] = useState(isRiskDetailOpen);''',
)

replace_once(
    contracts,
    '''  [scrollState.includes("sessionStorage") && scrollState.includes("requestAnimationFrame") && scrollState.includes("data-vorta-portal-scroll-container"), "Scroll restoration must wait for the asynchronous dashboard content inside the portal scroller."],
''',
    '''  [scrollState.includes("sessionStorage") && scrollState.includes("requestAnimationFrame") && scrollState.includes("data-vorta-portal-scroll-container"), "Scroll restoration must wait for the asynchronous dashboard content inside the portal scroller."],
  [dashboard.includes("restoreDashboardWorkPlanExpanded") && dashboard.includes("useState(isRiskDetailOpen)"), "Returning from an intervention must reopen the expanded work plan before restoring its previous scroll position."],
  [scrollState.includes("DASHBOARD_WORK_PLAN_KEY") && scrollState.includes("data-vorta-biggest-reduction-opportunity"), "Dashboard return state must preserve whether the risk work plan was expanded."],
''',
)

print("VOR-032 expanded dashboard state patch applied")
