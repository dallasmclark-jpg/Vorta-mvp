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

interface EquipmentEvidenceCoverageRow {
  equipment_id: string;
  component_count: number | string | null;
  document_count: number | string | null;
  fault_code_count: number | string | null;
  work_order_count: number | string | null;
  maintenance_schedule_count: number | string | null;
  evidence_score: number | string | null;
  evidence_complete: boolean | null;
}

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

const countValue = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
};

export async function loadEquipmentEvidenceCoverage(
  equipmentIds: string[],
): Promise<Map<string, EquipmentEvidenceCoverage>> {
  const uniqueIds = Array.from(new Set(equipmentIds.filter(Boolean)));
  const coverage = new Map(
    uniqueIds.map((equipmentId) => [equipmentId, emptyCoverage(equipmentId)]),
  );

  if (uniqueIds.length === 0) return coverage;

  const { data, error } = await supabase.rpc(
    "vorta_get_equipment_evidence_coverage",
    { p_equipment_ids: uniqueIds },
  );

  if (error) {
    throw new Error(
      `Equipment evidence coverage could not be loaded: ${error.message}`,
    );
  }

  for (const row of (data ?? []) as EquipmentEvidenceCoverageRow[]) {
    if (!row.equipment_id || !coverage.has(row.equipment_id)) continue;

    const score = Math.min(5, countValue(row.evidence_score));
    coverage.set(row.equipment_id, {
      equipmentId: row.equipment_id,
      componentCount: countValue(row.component_count),
      documentCount: countValue(row.document_count),
      faultCodeCount: countValue(row.fault_code_count),
      workOrderCount: countValue(row.work_order_count),
      maintenanceScheduleCount: countValue(row.maintenance_schedule_count),
      score,
      complete: row.evidence_complete === true && score === 5,
    });
  }

  return coverage;
}
