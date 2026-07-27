from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label} count={count}")
    return text.replace(old, new, 1)


dashboard_path = Path(
    "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"
)
dashboard = dashboard_path.read_text()
dashboard = replace_once(
    dashboard,
    """                              riskReductionPlan.projectedSiteRisk <
                              riskReductionPlan.currentSiteRisk""",
    """                              safeProjectedSiteRisk <
                              Number(riskReductionPlan.currentSiteRisk)""",
    "site projection colour comparison",
)
dashboard_path.write_text(dashboard)

contract_path = Path("scripts/maintenance-dashboard-contracts.mjs")
contracts = contract_path.read_text()
contracts = replace_once(
    contracts,
    'dashboard.includes("safeProjectedSiteRisk") &&\n',
    'dashboard.includes("safeProjectedSiteRisk") &&\n'
    '    dashboard.includes("safeProjectedSiteRisk <") &&\n',
    "site projection colour contract",
)
contract_path.write_text(contracts)

Path("scripts/apply-risk-projection-site-colour-fix.py").unlink()
