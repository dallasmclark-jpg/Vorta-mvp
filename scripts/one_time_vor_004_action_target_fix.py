from pathlib import Path


dashboard_path = Path(
    "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"
)
dashboard = dashboard_path.read_text()
key = 'key={`${action.priority}-${action.action}`}'
key_index = dashboard.index(key)
old = "if (workOrder) {"
old_index = dashboard.index(old, key_index)
dashboard = dashboard[:old_index] + 'if (action.target === "work-orders" && workOrder) {' + dashboard[old_index + len(old):]
dashboard_path.write_text(dashboard)

contract_path = Path("scripts/vor-004-dashboard-deep-links-contract.mjs")
contract = contract_path.read_text()
anchor = 'check("all three backlog summaries are accessible buttons", ["pm", "calibrations", "spares"].every((value) => dashboard.includes(`data-vorta-dashboard-backlog-card="${value}"`)));\n'
addition = 'check("calibration and spare actions do not get diverted to linked work orders", dashboard.includes(\'action.target === "work-orders" && workOrder\'));\n'
if contract.count(anchor) != 1:
    raise RuntimeError("Focused contract anchor changed")
contract_path.write_text(contract.replace(anchor, anchor + addition, 1))

Path("scripts/one_time_vor_004_action_target_fix.py").unlink()
