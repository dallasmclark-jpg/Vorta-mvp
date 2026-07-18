import { supabase } from "../../lib/supabaseClient";

export type MaintenanceScheduleMode = "pm" | "calibration";

export interface MaintenanceScheduleRecord {
  id: string;
  reference: string;
  title: string;
  scheduleType: string;
  frequency: string | null;
  frequencyUnit: string | null;
  lastCompletedDate: string | null;
  nextDueDate: string | null;
  status: string;
  criticality: string | null;
  assignedEngineer: string | null;
  procedureReference: string | null;
  checklistReference: string | null;
  calibrationPoint: string | null;
  toleranceSpecification: string | null;
  lastResult: string | null;
  certificateReference: string | null;
  linkedWorkOrderNumber: string | null;
  linkedWorkOrderStatus: string | null;
  linkedWorkOrderDueDate: string | null;
}

interface LinkedWorkOrder {
  preventiveMaintenanceId: string;
  workOrderNumber: string;
  status: string;
  dueDate: string | null;
  completedDate: string | null;
  assignedEngineer: string | null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isClosed(status: string): boolean {
  const value = status.toUpperCase();
  return ["COMPLETED", "CLOSED", "TECO", "CLSD", "BUSINESS COMPLETE"].some(
    (token) => value.includes(token),
  );
}

function preferWorkOrder(
  current: LinkedWorkOrder | undefined,
  candidate: LinkedWorkOrder,
): LinkedWorkOrder {
  if (!current) return candidate;

  const currentClosed = isClosed(current.status);
  const candidateClosed = isClosed(candidate.status);
  if (currentClosed !== candidateClosed) {
    return candidateClosed ? current : candidate;
  }

  const currentDate = new Date(
    current.dueDate ?? current.completedDate ?? "1900-01-01",
  ).getTime();
  const candidateDate = new Date(
    candidate.dueDate ?? candidate.completedDate ?? "1900-01-01",
  ).getTime();
  return candidateDate > currentDate ? candidate : current;
}

export async function getEquipmentMaintenanceSchedules(
  equipmentId: string,
  mode: MaintenanceScheduleMode = "pm",
): Promise<MaintenanceScheduleRecord[]> {
  try {
    const { data, error } = await supabase
      .from("preventive_maintenance")
      .select(
        `
          id,
          pm_number,
          title,
          frequency,
          frequency_unit,
          pm_type,
          last_completed_date,
          next_due_date,
          status,
          criticality,
          assigned_engineer,
          procedure_ref,
          checklist_ref,
          calibration_point,
          tolerance_specification,
          last_calibration_result,
          certificate_reference
        `,
      )
      .eq("equipment_id", equipmentId)
      .order("next_due_date", { ascending: true });

    if (error) {
      console.warn("Equipment maintenance schedules could not be loaded:", error);
      return [];
    }

    const sourceRows: Record<string, unknown>[] = (
      Array.isArray(data) ? data : []
    )
      .filter((row) => typeof row === "object" && row !== null)
      .map((row) => row as unknown as Record<string, unknown>);
    const rows = sourceRows.filter((row) => {
      const type = String(row.pm_type ?? "").toUpperCase();
      const isCalibration = type.includes("CALIBRAT");
      return mode === "calibration" ? isCalibration : !isCalibration;
    });

    const scheduleIds = rows
      .map((row) => asString(row.id))
      .filter((value): value is string => Boolean(value));
    const workOrdersBySchedule = new Map<string, LinkedWorkOrder>();

    if (scheduleIds.length > 0) {
      const { data: workOrderData, error: workOrderError } = await supabase
        .from("work_orders")
        .select(
          `
            preventive_maintenance_id,
            wo_number,
            status,
            due_date,
            completed_date,
            assigned_engineer
          `,
        )
        .in("preventive_maintenance_id", scheduleIds);

      if (workOrderError) {
        console.warn(
          "Linked maintenance work orders could not be loaded:",
          workOrderError,
        );
      } else {
        for (const rawWorkOrder of Array.isArray(workOrderData)
          ? workOrderData
          : []) {
          if (typeof rawWorkOrder !== "object" || rawWorkOrder === null) continue;
          const workOrder = rawWorkOrder as Record<string, unknown>;
          const preventiveMaintenanceId = asString(
            workOrder.preventive_maintenance_id,
          );
          const workOrderNumber = asString(workOrder.wo_number);
          if (!preventiveMaintenanceId || !workOrderNumber) continue;

          const candidate: LinkedWorkOrder = {
            preventiveMaintenanceId,
            workOrderNumber,
            status: asString(workOrder.status) ?? "UNKNOWN",
            dueDate: asString(workOrder.due_date),
            completedDate: asString(workOrder.completed_date),
            assignedEngineer: asString(workOrder.assigned_engineer),
          };
          workOrdersBySchedule.set(
            preventiveMaintenanceId,
            preferWorkOrder(
              workOrdersBySchedule.get(preventiveMaintenanceId),
              candidate,
            ),
          );
        }
      }
    }

    return rows.map((row) => {
      const id = asString(row.id) ?? String(row.pm_number ?? "schedule");
      const linkedWorkOrder = workOrdersBySchedule.get(id);
      return {
        id,
        reference: asString(row.pm_number) ?? id,
        title: asString(row.title) ?? "Preventive maintenance schedule",
        scheduleType: asString(row.pm_type) ?? "Preventive Maintenance",
        frequency: asString(row.frequency),
        frequencyUnit: asString(row.frequency_unit),
        lastCompletedDate: asString(row.last_completed_date),
        nextDueDate: asString(row.next_due_date),
        status: asString(row.status) ?? "PLANNED",
        criticality: asString(row.criticality),
        assignedEngineer:
          linkedWorkOrder?.assignedEngineer ?? asString(row.assigned_engineer),
        procedureReference: asString(row.procedure_ref),
        checklistReference: asString(row.checklist_ref),
        calibrationPoint: asString(row.calibration_point),
        toleranceSpecification: asString(row.tolerance_specification),
        lastResult: asString(row.last_calibration_result),
        certificateReference: asString(row.certificate_reference),
        linkedWorkOrderNumber: linkedWorkOrder?.workOrderNumber ?? null,
        linkedWorkOrderStatus: linkedWorkOrder?.status ?? null,
        linkedWorkOrderDueDate:
          linkedWorkOrder?.dueDate ?? linkedWorkOrder?.completedDate ?? null,
      };
    });
  } catch (error) {
    console.warn("Equipment maintenance schedules failed:", error);
    return [];
  }
}
