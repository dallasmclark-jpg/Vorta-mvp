from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label} count={count}")
    return text.replace(old, new, 1)


dashboard_path = Path(
    "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"
)
dashboard = dashboard_path.read_text()

anchor = """const formatSiteRisk = (value: number): string =>
  Number(value).toFixed(1);
"""
helper = """
const normaliseProjectedRisk = (
  currentValue: number,
  projectedValue: number,
): number => {
  const current = Number(currentValue);
  const projected = Number(projectedValue);

  if (!Number.isFinite(current)) {
    return 0;
  }

  if (
    !Number.isFinite(projected) ||
    projected < 0 ||
    projected > 100
  ) {
    return current;
  }

  return Math.min(current, projected);
};
"""
dashboard = replace_once(dashboard, anchor, anchor + helper, "format helper anchor")

pattern = re.compile(
    r"  const siteRiskReduction = riskReductionPlan\n"
    r"    \? Math\.max\(\n"
    r"        0,\n"
    r"        Math\.round\(\n"
    r"          \(Number\(riskReductionPlan\.currentSiteRisk\) -\n"
    r"            Number\(riskReductionPlan\.projectedSiteRisk\)\) \*\n"
    r"            10,\n"
    r"        \) / 10,\n"
    r"      \)\n"
    r"    : 0;\n"
)
derived = """  const safeProjectedSiteRisk = riskReductionPlan
    ? normaliseProjectedRisk(
        riskReductionPlan.currentSiteRisk,
        riskReductionPlan.projectedSiteRisk,
      )
    : 0;

  const safeProjectedAreaRisk = riskReductionPlan
    ? normaliseProjectedRisk(
        riskReductionPlan.currentAreaRisk,
        riskReductionPlan.projectedAreaRisk,
      )
    : 0;

  const siteRiskReduction = riskReductionPlan
    ? Math.max(
        0,
        Math.round(
          (Number(riskReductionPlan.currentSiteRisk) -
            safeProjectedSiteRisk) *
            10,
        ) / 10,
      )
    : 0;

  const areaRiskReduction = riskReductionPlan
    ? Math.max(
        0,
        Number(riskReductionPlan.currentAreaRisk) -
          safeProjectedAreaRisk,
      )
    : 0;
"""
dashboard, count = pattern.subn(derived, dashboard, count=1)
if count != 1:
    raise SystemExit(f"site risk reduction substitutions={count}")

summary_start = (
    '                  {riskReductionPlan\n'
    '                    ? `${riskReductionPlan.highestArea}'
)
summary_end = '                    : activeRiskScope?.priorityAction ??\n'
start = dashboard.find(summary_start)
end = dashboard.find(summary_end, start)
if start < 0 or end < 0:
    raise SystemExit(f"summary bounds start={start} end={end}")
end += len(summary_end)
summary = """                  {riskReductionPlan
                    ? areaRiskReduction > 0
                      ? `${riskReductionPlan.highestArea}: complete the highest-value work queue to reduce area risk from ${riskReductionPlan.currentAreaRisk} to ${safeProjectedAreaRisk}.`
                      : `${riskReductionPlan.equipmentName}: complete the highest-value work queue. Asset exposure reduces, while ${riskReductionPlan.highestArea} area risk remains ${riskReductionPlan.currentAreaRisk} until the next leading exposure is cleared.`
                    : activeRiskScope?.priorityAction ??
"""
dashboard = dashboard[:start] + summary + dashboard[end:]

old_area = """                          <span className="text-emerald-400">
                            {riskReductionPlan.projectedAreaRisk}
                          </span>"""
new_area = """                          <span
                            data-vorta-risk-projection="area"
                            className={
                              areaRiskReduction > 0
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {safeProjectedAreaRisk}
                          </span>"""
dashboard = replace_once(dashboard, old_area, new_area, "area projection")

dashboard = replace_once(
    dashboard,
    "{formatSiteRisk(riskReductionPlan.projectedSiteRisk)}",
    "{formatSiteRisk(safeProjectedSiteRisk)}",
    "site projection",
)
dashboard_path.write_text(dashboard)

contract_path = Path("scripts/maintenance-dashboard-contracts.mjs")
contracts = contract_path.read_text()
import_anchor = 'const maintenanceActions = read("../src/lib/maintenanceActions.ts");\n'
import_addition = '''const riskProjectionMigration = read(
  "../supabase/migrations/20260727214000_fix_risk_plan_projection_integrity.sql",
);
'''
contracts = replace_once(
    contracts,
    import_anchor,
    import_anchor + import_addition,
    "contract import anchor",
)
check_anchor = '''check(
  "Desktop KPI cards render as a comparison grid",
'''
integrity_check = '''check(
  "Risk reduction projections fail closed and never colour an increase as improvement",
  dashboard.includes("normaliseProjectedRisk") &&
    dashboard.includes("safeProjectedSiteRisk") &&
    dashboard.includes("safeProjectedAreaRisk") &&
    dashboard.includes("areaRiskReduction > 0") &&
    dashboard.includes('data-vorta-risk-projection="area"') &&
    riskProjectionMigration.includes("vorta_safe_projected_risk") &&
    riskProjectionMigration.includes("least(p_current, p_projected)") &&
    !riskProjectionMigration.includes("select private.vorta_refresh_dashboard_scope_plan_cache();")
);

'''
contracts = replace_once(
    contracts,
    check_anchor,
    integrity_check + check_anchor,
    "contract check anchor",
)
contract_path.write_text(contracts)

migration_path = Path(
    "supabase/migrations/20260727214000_fix_risk_plan_projection_integrity.sql"
)
migration = migration_path.read_text()
marker = "select private.vorta_refresh_dashboard_scope_plan_cache();\n\ndo $validation$"
if marker not in migration:
    raise SystemExit("migration cache refresh marker changed")
prefix, _ = migration.split(marker, 1)
validation = '''do $validation$
begin
  if private.vorta_safe_projected_risk(68.4, 87.7) <> 68.4
     or private.vorta_safe_projected_risk(80, 82) <> 80
     or private.vorta_safe_projected_risk(70, 62) <> 62
     or private.vorta_risk_level(68.4) <> 'High' then
    raise exception 'Risk projection integrity helpers failed validation';
  end if;
end;
$validation$;
'''
migration_path.write_text(prefix + validation)

for temporary_path in (
    Path(".github/workflows/apply-risk-projection-integrity-fix.yml"),
    Path(".github/risk-projection-trigger"),
    Path("scripts/apply-risk-projection-fix.py"),
):
    if temporary_path.exists():
        temporary_path.unlink()
