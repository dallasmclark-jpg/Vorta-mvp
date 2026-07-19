import { supabase } from "../../lib/supabaseClient";

export interface EquipmentEvidenceCoverage {
  equipmentId: string;
  componentCount: number;
  documentCount: number;
  faultCodeCount: number;
  workOrderCount: number;
  maintenanceScheduleCount: number;
  score: number;
  complete: boolean;
}

type EvidenceCounterKey =
  | "componentCount"
  | "documentCount"
  | "faultCodeCount"
  | "workOrderCount"
  | "maintenanceScheduleCount";

const emptyCoverage = (equipmentId: string): EquipmentEvidenceCoverage => ({
  equipmentId,
  componentCount: 0,
  documentCount: 0,
  faultCodeCount: 0,
  workOrderCount: 0,
  maintenanceScheduleCount: 0,
  score: 0,
  complete: false,
});

function increment(
  coverage: Map<string, EquipmentEvidenceCoverage>,
  equipmentId: unknown,
  key: EvidenceCounterKey,
): void {
  if (typeof equipmentId !== "string" || !coverage.has(equipmentId)) return;
  const current = coverage.get(equipmentId) ?? emptyCoverage(equipmentId);
  coverage.set(equipmentId, { ...current, [key]: current[key] + 1 });
}

export async function loadEquipmentEvidenceCoverage(
  equipmentIds: string[],
): Promise<Map<string, EquipmentEvidenceCoverage>> {
  const uniqueIds = Array.from(new Set(equipmentIds.filter(Boolean)));
  const coverage = new Map(
    uniqueIds.map((equipmentId) => [equipmentId, emptyCoverage(equipmentId)]),
  );

  if (uniqueIds.length === 0) return coverage;

  const [components, documents, faultCodes, workOrders, schedules] =
    await Promise.all([
      supabase
        .from("equipment_components")
        .select("equipment_id")
        .in("equipment_id", uniqueIds),
      supabase
        .from("knowledge_documents")
        .select("equipment_id")
        .in("equipment_id", uniqueIds)
        .eq("is_current", true),
      supabase
        .from("equipment_fault_codes")
        .select("equipment_id")
        .in("equipment_id", uniqueIds)
        .eq("is_active", true),
      supabase
        .from("work_orders")
        .select("equipment_id")
        .in("equipment_id", uniqueIds),
      supabase
        .from("preventive_maintenance")
        .select("equipment_id")
        .in("equipment_id", uniqueIds),
    ]);

  const failed = [components, documents, faultCodes, workOrders, schedules].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new Error(`Equipment evidence coverage could not be loaded: ${failed.error.message}`);
  }

  for (const row of components.data ?? []) {
    increment(coverage, row.equipment_id, "componentCount");
  }
  for (const row of documents.data ?? []) {
    increment(coverage, row.equipment_id, "documentCount");
  }
  for (const row of faultCodes.data ?? []) {
    increment(coverage, row.equipment_id, "faultCodeCount");
  }
  for (const row of workOrders.data ?? []) {
    increment(coverage, row.equipment_id, "workOrderCount");
  }
  for (const row of schedules.data ?? []) {
    increment(coverage, row.equipment_id, "maintenanceScheduleCount");
  }

  for (const [equipmentId, current] of coverage) {
    const score = [
      current.componentCount > 0,
      current.documentCount > 0,
      current.faultCodeCount > 0,
      current.workOrderCount > 0,
      current.maintenanceScheduleCount > 0,
    ].filter(Boolean).length;
    coverage.set(equipmentId, {
      ...current,
      score,
      complete: score === 5,
    });
  }

  return coverage;
}
