import type {
  RiskActionTarget,
  SiteRiskReductionAction,
} from "../Equipment/equipmentService";

const TARGET_ROUTE: Record<RiskActionTarget, string> = {
  spares: "spares",
  skills: "skills",
  calibrations: "pms",
  "work-orders": "work-orders",
  overview: "overview",
};

export function getRiskPlanActionRoute(
  equipmentId: string,
  action: Pick<SiteRiskReductionAction, "target">,
): string {
  const route = TARGET_ROUTE[action.target];
  const base = `/equipment/${encodeURIComponent(equipmentId)}/${route}`;
  return action.target === "skills"
    ? `${base}?from=dashboard&returnTo=%2Fdashboard`
    : base;
}
