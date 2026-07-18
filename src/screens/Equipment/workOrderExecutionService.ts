import { supabase } from "../../lib/supabaseClient";
import { getEquipmentIdentityById } from "./equipmentService";
import { validateWorkOrderRow } from "../../lib/runtimeContracts";

export interface WorkOrderExecutionHeader {
  id: string;
  workOrderNumber: string;
  equipmentId: string;
  siteId: string;
  description: string;
  priority: string;
  workType: string;
  status: string;
  outcome: string | null;
  assignedEngineer: string | null;
  requestedDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  scheduledStartAt: string | null;
  scheduledFinishAt: string | null;
  actualStartAt: string | null;
  actualFinishAt: string | null;
  technicalCompletionAt: string | null;
  orderTypeCode: string | null;
  maintenanceActivityTypeCode: string | null;
  mainWorkCenter: string | null;
  plannerGroup: string | null;
  sourceSystem: string;
  sourceUpdatedAt: string | null;
}

export interface WorkOrderConfirmationRecord {
  id: string;
  confirmationNumber: string | null;
  confirmationCounter: string | null;
  operationNumber: string | null;
  suboperationNumber: string | null;
  confirmationText: string | null;
  confirmedBy: string | null;
  personnelNumber: string | null;
  workCenter: string | null;
  postingDate: string | null;
  confirmationTimestamp: string | null;
  actualWork: number | null;
  workUnit: string | null;
  actualDuration: number | null;
  durationUnit: string | null;
  finalConfirmation: boolean;
  reversal: boolean;
  reasonCode: string | null;
  sourceSystem: string;
  sourceUpdatedAt: string | null;
}

export interface WorkOrderMaterialReservationRecord {
  id: string;
  materialNumber: string;
  materialDescription: string | null;
  reservationNumber: string | null;
  reservationItem: string | null;
  requirementDate: string | null;
  requiredQuantity: number;
  reservedQuantity: number;
  withdrawnQuantity: number;
  baseUnit: string | null;
  storageLocation: string | null;
  reservationStatus: string;
  finalIssue: boolean;
  sourceSystem: string;
  sourceUpdatedAt: string | null;
}

export interface WorkOrderGoodsMovementRecord {
  id: string;
  materialDocumentNumber: string | null;
  materialDocumentYear: string | null;
  documentItem: string | null;
  movementType: string | null;
  postingDate: string | null;
  documentDate: string | null;
  entryTimestamp: string | null;
  materialNumber: string | null;
  materialDescription: string | null;
  quantity: number;
  baseUnit: string | null;
  debitCreditIndicator: string | null;
  plantCode: string | null;
  storageLocation: string | null;
  batchNumber: string | null;
  reservationNumber: string | null;
  reservationItem: string | null;
  enteredBy: string | null;
  reversal: boolean;
  reversedDocumentNumber: string | null;
  sourceSystem: string;
  sourceUpdatedAt: string | null;
}

export interface WorkOrderExecutionDetail {
  header: WorkOrderExecutionHeader;
  confirmations: WorkOrderConfirmationRecord[];
  reservations: WorkOrderMaterialReservationRecord[];
  goodsMovements: WorkOrderGoodsMovementRecord[];
}

interface WorkOrderRow {
  id: string;
  wo_number: string;
  equipment_id: string;
  site_id: string;
  description: string;
  priority: string | null;
  work_type: string | null;
  status: string | null;
  outcome: string | null;
  assigned_engineer: string | null;
  requested_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  scheduled_start_at: string | null;
  scheduled_finish_at: string | null;
  actual_start_at: string | null;
  actual_finish_at: string | null;
  technical_completion_at: string | null;
  order_type_code: string | null;
  maintenance_activity_type_code: string | null;
  main_work_center: string | null;
  planner_group: string | null;
  source_system: string | null;
  source_updated_at: string | null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getWorkOrderExecutionDetail(
  equipmentRouteId: string,
  workOrderNumber: string,
): Promise<WorkOrderExecutionDetail> {
  const equipment = await getEquipmentIdentityById(equipmentRouteId);

  const { data: workOrderData, error: workOrderError } = await supabase
    .from("work_orders")
    .select(`
      id,
      wo_number,
      equipment_id,
      site_id,
      description,
      priority,
      work_type,
      status,
      outcome,
      assigned_engineer,
      requested_date,
      due_date,
      completed_date,
      scheduled_start_at,
      scheduled_finish_at,
      actual_start_at,
      actual_finish_at,
      technical_completion_at,
      order_type_code,
      maintenance_activity_type_code,
      main_work_center,
      planner_group,
      source_system,
      source_updated_at
    `)
    .eq("equipment_id", equipment.id)
    .eq("wo_number", workOrderNumber)
    .limit(1)
    .maybeSingle();

  if (workOrderError) {
    throw new Error(`Work order ${workOrderNumber} could not be loaded: ${workOrderError.message}`);
  }

  if (!workOrderData) {
    throw new Error(`Work order ${workOrderNumber} is not available for this equipment.`);
  }

  const workOrder = validateWorkOrderRow(workOrderData) as unknown as WorkOrderRow;

  const [confirmationResult, reservationResult, movementResult] = await Promise.all([
    supabase
      .from("work_order_confirmations")
      .select(`
        id,
        confirmation_number,
        confirmation_counter,
        operation_number,
        suboperation_number,
        confirmation_text,
        confirmed_by,
        personnel_number,
        work_center,
        posting_date,
        confirmation_timestamp,
        actual_work,
        work_unit,
        actual_duration,
        duration_unit,
        final_confirmation,
        reversal,
        reason_code,
        source_system,
        source_updated_at
      `)
      .eq("work_order_id", workOrder.id)
      .order("confirmation_timestamp", { ascending: false, nullsFirst: false })
      .order("posting_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("work_order_material_reservations")
      .select(`
        id,
        material_number,
        reservation_number,
        reservation_item,
        requirement_date,
        required_quantity,
        reserved_quantity,
        withdrawn_quantity,
        base_unit,
        storage_location,
        reservation_status,
        final_issue,
        source_system,
        source_updated_at
      `)
      .eq("work_order_id", workOrder.id)
      .order("requirement_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("work_order_goods_movements")
      .select(`
        id,
        material_document_number,
        material_document_year,
        document_item,
        movement_type,
        posting_date,
        document_date,
        entry_timestamp,
        material_number,
        material_description,
        quantity,
        base_unit,
        debit_credit_indicator,
        plant_code,
        storage_location,
        batch_number,
        reservation_number,
        reservation_item,
        entered_by,
        reversal,
        reversed_document_number,
        source_system,
        source_updated_at
      `)
      .eq("work_order_id", workOrder.id)
      .order("posting_date", { ascending: false, nullsFirst: false })
      .order("entry_timestamp", { ascending: false, nullsFirst: false }),
  ]);

  if (confirmationResult.error) {
    throw new Error(`SAP confirmation records could not be loaded: ${confirmationResult.error.message}`);
  }
  if (reservationResult.error) {
    throw new Error(`Reserved material records could not be loaded: ${reservationResult.error.message}`);
  }
  if (movementResult.error) {
    throw new Error(`Goods movement records could not be loaded: ${movementResult.error.message}`);
  }

  const reservationRows = reservationResult.data ?? [];
  const movementRows = movementResult.data ?? [];
  const materialNumbers = Array.from(
    new Set(
      [
        ...reservationRows.map((row) => row.material_number as string | null),
        ...movementRows.map((row) => row.material_number as string | null),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const stockDescriptions = new Map<string, string>();
  if (materialNumbers.length > 0) {
    const { data: stockRows, error: stockError } = await supabase
      .from("site_material_stock")
      .select("material_number, material_description")
      .eq("site_id", workOrder.site_id)
      .in("material_number", materialNumbers);

    if (!stockError) {
      for (const row of stockRows ?? []) {
        const materialNumber = row.material_number as string | null;
        const description = row.material_description as string | null;
        if (materialNumber && description && !stockDescriptions.has(materialNumber)) {
          stockDescriptions.set(materialNumber, description);
        }
      }
    }
  }

  return {
    header: {
      id: workOrder.id,
      workOrderNumber: workOrder.wo_number,
      equipmentId: workOrder.equipment_id,
      siteId: workOrder.site_id,
      description: workOrder.description,
      priority: workOrder.priority ?? "Unknown",
      workType: workOrder.work_type ?? "Maintenance",
      status: workOrder.status ?? "Unknown",
      outcome: workOrder.outcome,
      assignedEngineer: workOrder.assigned_engineer,
      requestedDate: workOrder.requested_date,
      dueDate: workOrder.due_date,
      completedDate: workOrder.completed_date,
      scheduledStartAt: workOrder.scheduled_start_at,
      scheduledFinishAt: workOrder.scheduled_finish_at,
      actualStartAt: workOrder.actual_start_at,
      actualFinishAt: workOrder.actual_finish_at,
      technicalCompletionAt: workOrder.technical_completion_at,
      orderTypeCode: workOrder.order_type_code,
      maintenanceActivityTypeCode: workOrder.maintenance_activity_type_code,
      mainWorkCenter: workOrder.main_work_center,
      plannerGroup: workOrder.planner_group,
      sourceSystem: workOrder.source_system ?? "SAP",
      sourceUpdatedAt: workOrder.source_updated_at,
    },
    confirmations: (confirmationResult.data ?? []).map((row) => ({
      id: row.id as string,
      confirmationNumber: row.confirmation_number as string | null,
      confirmationCounter: row.confirmation_counter as string | null,
      operationNumber: row.operation_number as string | null,
      suboperationNumber: row.suboperation_number as string | null,
      confirmationText: row.confirmation_text as string | null,
      confirmedBy: row.confirmed_by as string | null,
      personnelNumber: row.personnel_number as string | null,
      workCenter: row.work_center as string | null,
      postingDate: row.posting_date as string | null,
      confirmationTimestamp: row.confirmation_timestamp as string | null,
      actualWork: row.actual_work == null ? null : numberValue(row.actual_work),
      workUnit: row.work_unit as string | null,
      actualDuration: row.actual_duration == null ? null : numberValue(row.actual_duration),
      durationUnit: row.duration_unit as string | null,
      finalConfirmation: Boolean(row.final_confirmation),
      reversal: Boolean(row.reversal),
      reasonCode: row.reason_code as string | null,
      sourceSystem: (row.source_system as string | null) ?? "SAP",
      sourceUpdatedAt: row.source_updated_at as string | null,
    })),
    reservations: reservationRows.map((row) => ({
      id: row.id as string,
      materialNumber: row.material_number as string,
      materialDescription: stockDescriptions.get(row.material_number as string) ?? null,
      reservationNumber: row.reservation_number as string | null,
      reservationItem: row.reservation_item as string | null,
      requirementDate: row.requirement_date as string | null,
      requiredQuantity: numberValue(row.required_quantity),
      reservedQuantity: numberValue(row.reserved_quantity),
      withdrawnQuantity: numberValue(row.withdrawn_quantity),
      baseUnit: row.base_unit as string | null,
      storageLocation: row.storage_location as string | null,
      reservationStatus: (row.reservation_status as string | null) ?? "planned",
      finalIssue: Boolean(row.final_issue),
      sourceSystem: (row.source_system as string | null) ?? "SAP",
      sourceUpdatedAt: row.source_updated_at as string | null,
    })),
    goodsMovements: movementRows.map((row) => ({
      id: row.id as string,
      materialDocumentNumber: row.material_document_number as string | null,
      materialDocumentYear: row.material_document_year as string | null,
      documentItem: row.document_item as string | null,
      movementType: row.movement_type as string | null,
      postingDate: row.posting_date as string | null,
      documentDate: row.document_date as string | null,
      entryTimestamp: row.entry_timestamp as string | null,
      materialNumber: row.material_number as string | null,
      materialDescription:
        (row.material_description as string | null) ??
        (row.material_number ? stockDescriptions.get(row.material_number as string) ?? null : null),
      quantity: numberValue(row.quantity),
      baseUnit: row.base_unit as string | null,
      debitCreditIndicator: row.debit_credit_indicator as string | null,
      plantCode: row.plant_code as string | null,
      storageLocation: row.storage_location as string | null,
      batchNumber: row.batch_number as string | null,
      reservationNumber: row.reservation_number as string | null,
      reservationItem: row.reservation_item as string | null,
      enteredBy: row.entered_by as string | null,
      reversal: Boolean(row.reversal),
      reversedDocumentNumber: row.reversed_document_number as string | null,
      sourceSystem: (row.source_system as string | null) ?? "SAP",
      sourceUpdatedAt: row.source_updated_at as string | null,
    })),
  };
}
