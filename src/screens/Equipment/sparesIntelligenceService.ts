import { supabase } from "../../lib/supabaseClient";
import type {
  EquipmentComponent,
  EquipmentComponentsResult,
  EquipmentRecommendedWorkAction,
  EquipmentRecommendedWorkQueue,
} from "./equipmentService";

export interface VerifiedComponentsResult extends EquipmentComponentsResult {
  sourceSystem: string | null;
  sourceUpdatedAt: string | null;
  checkedAt: string;
}

export interface VerifiedWorkQueueResult {
  queue: EquipmentRecommendedWorkQueue | null;
  checkedAt: string;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const valid = values
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter(Number.isFinite);
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid)).toISOString();
}

export async function getVerifiedEquipmentComponents(
  equipmentId: string,
): Promise<VerifiedComponentsResult> {
  const checkedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("equipment_components")
    .select(
      "component_name,component_code,quantity_available,quantity_target,minimum_quantity,availability_status,vendor_name,maker_name,storage_location,criticality,unit_cost,lead_days,source_system,source_updated_at,updated_at",
    )
    .eq("equipment_id", equipmentId)
    .order("component_name");

  if (error) {
    throw new Error(`Verified spares inventory could not be loaded: ${error.message}`);
  }

  const inventory: EquipmentComponent[] = (data ?? []).map((row) => ({
    name: row.component_name ?? "",
    partNumber: row.component_code ?? "",
    stock: Number(row.quantity_available ?? 0),
    max: Number(row.quantity_target ?? 0),
    minimumQuantity: Number(row.minimum_quantity ?? 0),
    status: row.availability_status ?? "",
    supplier: row.vendor_name ?? "",
    manufacturer: row.maker_name ?? "",
    location: row.storage_location ?? "",
    criticality: row.criticality ?? "",
    unitCost: Number(row.unit_cost ?? 0),
    leadDays: Number(row.lead_days ?? 0),
  }));
  const criticalComponents = inventory.filter((component) => {
    const status = component.status.toLowerCase();
    return status.includes("out of stock") || status.includes("low stock");
  });
  const outOfStock = inventory.filter((component) =>
    component.status.toLowerCase().includes("out of stock"),
  ).length;
  const lowStock = inventory.filter((component) =>
    component.status.toLowerCase().includes("low stock"),
  ).length;

  return {
    inventory,
    criticalComponents,
    stockSummary: {
      totalComponents: inventory.length,
      outOfStock,
      lowStock,
      okStock: inventory.length - outOfStock - lowStock,
    },
    sourceSystem: data?.find((row) => row.source_system)?.source_system ?? null,
    sourceUpdatedAt: latestTimestamp(
      (data ?? []).flatMap((row) => [row.source_updated_at, row.updated_at]),
    ),
    checkedAt,
  };
}

function parseAction(value: unknown): EquipmentRecommendedWorkAction | null {
  if (!value || typeof value !== "object") return null;
  const action = value as Record<string, unknown>;
  const priority = Number(action.priority ?? 0);
  const calculatedReduction = Number(action.calculatedReduction ?? 0);
  const projectedScore = Number(action.projectedScore ?? 0);
  if (!Number.isFinite(priority) || !Number.isFinite(calculatedReduction) || !Number.isFinite(projectedScore)) {
    return null;
  }

  return {
    priority,
    driver: String(action.driver ?? ""),
    action: String(action.action ?? ""),
    detail: typeof action.detail === "string" ? action.detail : null,
    status: typeof action.status === "string" ? action.status : null,
    actionType: typeof action.actionType === "string" ? action.actionType : null,
    calculatedReduction,
    projectedScore,
    workOrderNumber: typeof action.workOrderNumber === "string" ? action.workOrderNumber : null,
    workOrderDescription: typeof action.workOrderDescription === "string" ? action.workOrderDescription : null,
    workOrderStatus: typeof action.workOrderStatus === "string" ? action.workOrderStatus : null,
    workOrderPriority: typeof action.workOrderPriority === "string" ? action.workOrderPriority : null,
    workOrderDueDate: typeof action.workOrderDueDate === "string" ? action.workOrderDueDate : null,
    orderTypeCode: typeof action.orderTypeCode === "string" ? action.orderTypeCode : null,
    orderTypeDescription: typeof action.orderTypeDescription === "string" ? action.orderTypeDescription : null,
    pmNumber: typeof action.pmNumber === "string" ? action.pmNumber : null,
    pmTitle: typeof action.pmTitle === "string" ? action.pmTitle : null,
    pmStatus: typeof action.pmStatus === "string" ? action.pmStatus : null,
    pmDueDate: typeof action.pmDueDate === "string" ? action.pmDueDate : null,
    pmCriticality: typeof action.pmCriticality === "string" ? action.pmCriticality : null,
    procedureRef: typeof action.procedureRef === "string" ? action.procedureRef : null,
    checklistRef: typeof action.checklistRef === "string" ? action.checklistRef : null,
    durationMinutes: Number(action.durationMinutes ?? action.estimatedDurationMinutes ?? 0),
    sparePartNumber: typeof action.sparePartNumber === "string" ? action.sparePartNumber : null,
    partName: typeof action.partName === "string" ? action.partName : null,
    stockOnHand: nullableNumber(action.stockOnHand),
    minimumStock: nullableNumber(action.minimumStock),
    targetStock: nullableNumber(action.targetStock),
    leadTimeDays: Number(action.leadTimeDays ?? action.procurementLeadDays ?? 0),
    partAvailabilityStatus: typeof action.partAvailabilityStatus === "string" ? action.partAvailabilityStatus : null,
    partCriticality: typeof action.partCriticality === "string" ? action.partCriticality : null,
    storageLocation: typeof action.storageLocation === "string" ? action.storageLocation : null,
    supplierName: typeof action.supplierName === "string" ? action.supplierName : null,
  };
}

export async function getVerifiedEquipmentWorkQueue(
  equipmentId: string,
): Promise<VerifiedWorkQueueResult> {
  const checkedAt = new Date().toISOString();
  const { data, error } = await supabase.rpc(
    "vorta_get_equipment_recommended_work_queue",
    { p_equipment_id: equipmentId },
  );
  if (error) {
    throw new Error(`Verified spares intervention could not be loaded: ${error.message}`);
  }

  const row = Array.isArray(data) && data.length > 0
    ? data[0] as Record<string, unknown>
    : null;
  if (!row) return { queue: null, checkedAt };

  const actions = (Array.isArray(row.actions) ? row.actions : [])
    .map(parseAction)
    .filter((action): action is EquipmentRecommendedWorkAction => Boolean(action))
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 3);

  const currentRiskScore = Number(row.current_risk_score);
  const projectedRiskScore = Number(row.projected_risk_score);
  const totalCalculatedReduction = Number(row.total_calculated_reduction);
  if (
    !Number.isFinite(currentRiskScore) ||
    !Number.isFinite(projectedRiskScore) ||
    !Number.isFinite(totalCalculatedReduction) ||
    projectedRiskScore > currentRiskScore
  ) {
    throw new Error("Verified spares intervention returned an invalid risk projection.");
  }

  return {
    checkedAt,
    queue: {
      equipmentId: String(row.equipment_id ?? equipmentId),
      equipmentName: String(row.equipment_name ?? "Unnamed equipment"),
      equipmentCode: String(row.equipment_code ?? ""),
      currentRiskScore,
      currentRiskLevel: String(row.current_risk_level ?? "Minimal"),
      projectedRiskScore,
      projectedRiskLevel: String(row.projected_risk_level ?? "Minimal"),
      totalCalculatedReduction,
      actions,
    },
  };
}
