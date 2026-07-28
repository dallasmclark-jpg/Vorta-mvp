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

export type RiskPlanBacklogTarget = "pm" | "calibrations" | "spares";

const firstReference = (values: string[]): string | null =>
  values.find((value) => value.trim().length > 0)?.trim() ?? null;

export function getRiskPlanActionRoute(
  equipmentId: string,
  action: Pick<
    SiteRiskReductionAction,
    "target" | "pmNumbers" | "sparePartNumbers"
  >,
): string {
  const route = TARGET_ROUTE[action.target];
  const base = `/equipment/${encodeURIComponent(equipmentId)}/${route}`;
  const params = new URLSearchParams({ from: "dashboard" });

  if (action.target === "skills") {
    params.set("returnTo", "/dashboard");
  } else if (action.target === "calibrations") {
    const calibrationReference = firstReference(action.pmNumbers);
    if (calibrationReference) params.set("record", calibrationReference);
  } else if (action.target === "spares") {
    const spareReference = firstReference(action.sparePartNumbers);
    if (spareReference) params.set("record", spareReference);
  }

  return `${base}?${params.toString()}`;
}

export function getRiskPlanBacklogRoute(
  equipmentId: string,
  target: RiskPlanBacklogTarget,
): string {
  const encodedEquipmentId = encodeURIComponent(equipmentId);
  const destination =
    target === "pm"
      ? "work-orders"
      : target === "calibrations"
        ? "pms"
        : "spares";
  const view =
    target === "pm"
      ? "pm-backlog"
      : target === "spares"
        ? "out-of-stock"
        : "backlog";
  const params = new URLSearchParams({ from: "dashboard", view });

  return `/equipment/${encodedEquipmentId}/${destination}?${params.toString()}`;
}
