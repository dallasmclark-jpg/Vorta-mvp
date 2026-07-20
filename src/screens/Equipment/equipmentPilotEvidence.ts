import { supabase } from "../../lib/supabaseClient";
import type { LiveDataState, LiveWorkItem } from "./equipmentLiveTrust";

export interface LiveWorkOrderConfirmation {
  id: string;
  confirmationNumber: string | null;
  confirmationCounter: string | null;
  operationNumber: string | null;
  suboperationNumber: string | null;
  text: string | null;
  confirmedBy: string | null;
  workCenter: string | null;
  postingDate: string | null;
  confirmedAt: string | null;
  actualWork: number | null;
  workUnit: string | null;
  actualDuration: number | null;
  durationUnit: string | null;
  finalConfirmation: boolean;
  sourceSystem: string | null;
  sourceUpdatedAt: string | null;
}

export interface LiveWorkOrderReservation {
  id: string;
  materialNumber: string;
  reservationNumber: string | null;
  reservationItem: string | null;
  requirementDate: string | null;
  requiredQuantity: number;
  reservedQuantity: number;
  withdrawnQuantity: number;
  baseUnit: string | null;
  storageLocation: string | null;
  status: string;
  finalIssue: boolean;
  sourceSystem: string | null;
  sourceUpdatedAt: string | null;
}

export interface LiveWorkOrderGoodsMovement {
  id: string;
  materialDocumentNumber: string | null;
  materialDocumentYear: string | null;
  documentItem: string | null;
  movementType: string | null;
  postingDate: string | null;
  documentDate: string | null;
  enteredAt: string | null;
  materialNumber: string | null;
  materialDescription: string | null;
  quantity: number;
  baseUnit: string | null;
  storageLocation: string | null;
  batchNumber: string | null;
  reservationNumber: string | null;
  reservationItem: string | null;
  enteredBy: string | null;
  sourceSystem: string | null;
  sourceUpdatedAt: string | null;
}

export interface LiveEquipmentHistoryItem {
  workOrderId: string;
  workOrderNumber: string;
  eventDate: string | null;
  description: string;
  workType: string;
  priority: string;
  status: string;
  assignedEngineer: string | null;
  requestedDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  downtimeMinutes: number | null;
  mttrHours: number | null;
  outcome: string | null;
  faultCode: string | null;
  sourceSystem: string | null;
  sourceUpdatedAt: string | null;
  confirmationCount: number;
  latestConfirmationText: string | null;
  latestConfirmedBy: string | null;
  latestConfirmationAt: string | null;
  reservationCount: number;
  goodsMovementCount: number;
  confirmations: LiveWorkOrderConfirmation[];
  reservations: LiveWorkOrderReservation[];
  goodsMovements: LiveWorkOrderGoodsMovement[];
}

export interface LiveEquipmentDocumentSummary {
  documentId: string;
  title: string;
  documentType: string;
  revision: string | null;
  approvalStatus: string;
  isCurrent: boolean;
  effectiveDate: string | null;
  ownerDepartment: string | null;
  summary: string | null;
  sourceSystem: string;
  sourceDocumentId: string;
  sourcePath: string | null;
  sourceUrl: string | null;
  fileId: string | null;
  externalReference: string | null;
  drawingNumber: string | null;
  sheetNumber: string | null;
  manualSection: string | null;
  pageNumber: number | null;
  faultCodes: string[];
  componentTags: string[];
  oem: string | null;
  status: string;
  lastIndexedAt: string | null;
  updatedAt: string;
  chunkCount: number;
  firstSectionTitle: string | null;
  firstPageNumber: number | null;
}

export interface LiveEquipmentDocumentChunk {
  id: string;
  reference: string;
  sectionTitle: string | null;
  text: string;
  pageNumber: number | null;
  keywords: string[];
  drawingNumber: string | null;
  sheetNumber: string | null;
  faultCodes: string[];
  componentTags: string[];
  sourceUrl: string | null;
  externalReference: string | null;
}

export interface LiveEquipmentDocument extends LiveEquipmentDocumentSummary {
  chunks: LiveEquipmentDocumentChunk[];
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is Record<string, unknown> => typeof row === "object" && row !== null,
    );
  }
  return typeof value === "object" && value !== null
    ? [value as Record<string, unknown>]
    : [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === "string");
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function failure<T>(error: unknown, fallback: string): LiveDataState<T> {
  return {
    status: "unavailable",
    message: error instanceof Error ? error.message : fallback,
  };
}

function mapConfirmation(value: unknown): LiveWorkOrderConfirmation | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    confirmationNumber: stringValue(row.confirmationNumber),
    confirmationCounter: stringValue(row.confirmationCounter),
    operationNumber: stringValue(row.operationNumber),
    suboperationNumber: stringValue(row.suboperationNumber),
    text: stringValue(row.text),
    confirmedBy: stringValue(row.confirmedBy),
    workCenter: stringValue(row.workCenter),
    postingDate: stringValue(row.postingDate),
    confirmedAt: stringValue(row.confirmedAt),
    actualWork: numberValue(row.actualWork),
    workUnit: stringValue(row.workUnit),
    actualDuration: numberValue(row.actualDuration),
    durationUnit: stringValue(row.durationUnit),
    finalConfirmation: booleanValue(row.finalConfirmation),
    sourceSystem: stringValue(row.sourceSystem),
    sourceUpdatedAt: stringValue(row.sourceUpdatedAt),
  };
}

function mapReservation(value: unknown): LiveWorkOrderReservation | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    materialNumber: String(row.materialNumber ?? "—"),
    reservationNumber: stringValue(row.reservationNumber),
    reservationItem: stringValue(row.reservationItem),
    requirementDate: stringValue(row.requirementDate),
    requiredQuantity: numberValue(row.requiredQuantity) ?? 0,
    reservedQuantity: numberValue(row.reservedQuantity) ?? 0,
    withdrawnQuantity: numberValue(row.withdrawnQuantity) ?? 0,
    baseUnit: stringValue(row.baseUnit),
    storageLocation: stringValue(row.storageLocation),
    status: String(row.status ?? "Unknown"),
    finalIssue: booleanValue(row.finalIssue),
    sourceSystem: stringValue(row.sourceSystem),
    sourceUpdatedAt: stringValue(row.sourceUpdatedAt),
  };
}

function mapGoodsMovement(value: unknown): LiveWorkOrderGoodsMovement | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    materialDocumentNumber: stringValue(row.materialDocumentNumber),
    materialDocumentYear: stringValue(row.materialDocumentYear),
    documentItem: stringValue(row.documentItem),
    movementType: stringValue(row.movementType),
    postingDate: stringValue(row.postingDate),
    documentDate: stringValue(row.documentDate),
    enteredAt: stringValue(row.enteredAt),
    materialNumber: stringValue(row.materialNumber),
    materialDescription: stringValue(row.materialDescription),
    quantity: numberValue(row.quantity) ?? 0,
    baseUnit: stringValue(row.baseUnit),
    storageLocation: stringValue(row.storageLocation),
    batchNumber: stringValue(row.batchNumber),
    reservationNumber: stringValue(row.reservationNumber),
    reservationItem: stringValue(row.reservationItem),
    enteredBy: stringValue(row.enteredBy),
    sourceSystem: stringValue(row.sourceSystem),
    sourceUpdatedAt: stringValue(row.sourceUpdatedAt),
  };
}

function mapHistoryRow(row: Record<string, unknown>): LiveEquipmentHistoryItem {
  return {
    workOrderId: String(row.work_order_id ?? ""),
    workOrderNumber: String(row.work_order_number ?? "—"),
    eventDate: stringValue(row.event_date),
    description: String(row.description ?? "No description"),
    workType: String(row.work_type ?? "Unknown"),
    priority: String(row.priority ?? "Unknown"),
    status: String(row.status ?? "Unknown"),
    assignedEngineer: stringValue(row.assigned_engineer),
    requestedDate: stringValue(row.requested_date),
    dueDate: stringValue(row.due_date),
    completedDate: stringValue(row.completed_date),
    downtimeMinutes: numberValue(row.downtime_minutes),
    mttrHours: numberValue(row.mttr_hours),
    outcome: stringValue(row.outcome),
    faultCode: stringValue(row.fault_code),
    sourceSystem: stringValue(row.source_system),
    sourceUpdatedAt: stringValue(row.source_updated_at),
    confirmationCount: numberValue(row.confirmation_count) ?? 0,
    latestConfirmationText: stringValue(row.latest_confirmation_text),
    latestConfirmedBy: stringValue(row.latest_confirmed_by),
    latestConfirmationAt: stringValue(row.latest_confirmation_at),
    reservationCount: numberValue(row.reservation_count) ?? 0,
    goodsMovementCount: numberValue(row.goods_movement_count) ?? 0,
    confirmations: asArray(row.confirmations)
      .map(mapConfirmation)
      .filter((item): item is LiveWorkOrderConfirmation => Boolean(item)),
    reservations: asArray(row.reservations)
      .map(mapReservation)
      .filter((item): item is LiveWorkOrderReservation => Boolean(item)),
    goodsMovements: asArray(row.goods_movements)
      .map(mapGoodsMovement)
      .filter((item): item is LiveWorkOrderGoodsMovement => Boolean(item)),
  };
}

function mapDocumentSummary(row: Record<string, unknown>): LiveEquipmentDocumentSummary {
  return {
    documentId: String(row.document_id ?? ""),
    title: String(row.title ?? "Untitled document"),
    documentType: String(row.document_type ?? "Document"),
    revision: stringValue(row.revision),
    approvalStatus: String(row.approval_status ?? "Unknown"),
    isCurrent: booleanValue(row.is_current),
    effectiveDate: stringValue(row.effective_date),
    ownerDepartment: stringValue(row.owner_department),
    summary: stringValue(row.summary),
    sourceSystem: String(row.source_system ?? "Unknown"),
    sourceDocumentId: String(row.source_document_id ?? ""),
    sourcePath: stringValue(row.source_path),
    sourceUrl: stringValue(row.source_url),
    fileId: stringValue(row.file_id),
    externalReference: stringValue(row.external_reference),
    drawingNumber: stringValue(row.drawing_number),
    sheetNumber: stringValue(row.sheet_number),
    manualSection: stringValue(row.manual_section),
    pageNumber: numberValue(row.page_number),
    faultCodes: asStringArray(row.fault_codes),
    componentTags: asStringArray(row.component_tags),
    oem: stringValue(row.oem),
    status: String(row.status ?? "Unknown"),
    lastIndexedAt: stringValue(row.last_indexed_at),
    updatedAt: String(row.updated_at ?? ""),
    chunkCount: numberValue(row.chunk_count) ?? 0,
    firstSectionTitle: stringValue(row.first_section_title),
    firstPageNumber: numberValue(row.first_page_number),
  };
}

function mapDocumentChunk(value: unknown): LiveEquipmentDocumentChunk | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    reference: String(row.reference ?? "Evidence section"),
    sectionTitle: stringValue(row.sectionTitle),
    text: String(row.text ?? ""),
    pageNumber: numberValue(row.pageNumber),
    keywords: asStringArray(row.keywords),
    drawingNumber: stringValue(row.drawingNumber),
    sheetNumber: stringValue(row.sheetNumber),
    faultCodes: asStringArray(row.faultCodes),
    componentTags: asStringArray(row.componentTags),
    sourceUrl: stringValue(row.sourceUrl),
    externalReference: stringValue(row.externalReference),
  };
}

export async function loadLiveEquipmentHistory(
  equipmentId: string,
): Promise<LiveDataState<LiveEquipmentHistoryItem[]>> {
  if (!equipmentId) {
    return { status: "unavailable", message: "No equipment identifier was supplied." };
  }
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_history", {
      p_equipment_id: equipmentId,
    });
    if (error) throw new Error(`Equipment history could not be loaded: ${error.message}`);
    const rows = asRows(data);
    if (!rows.length) {
      return {
        status: "empty",
        message: "No authorised maintenance history is recorded for this equipment.",
      };
    }
    return { status: "ready", data: rows.map(mapHistoryRow) };
  } catch (error) {
    return failure(error, "Equipment history could not be loaded.");
  }
}

export async function loadLiveEquipmentDocuments(
  equipmentId: string,
): Promise<LiveDataState<LiveEquipmentDocumentSummary[]>> {
  if (!equipmentId) {
    return { status: "unavailable", message: "No equipment identifier was supplied." };
  }
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_documents", {
      p_equipment_id: equipmentId,
    });
    if (error) throw new Error(`Controlled documents could not be loaded: ${error.message}`);
    const rows = asRows(data);
    if (!rows.length) {
      return {
        status: "empty",
        message: "No controlled documents are available for this equipment and active site.",
      };
    }
    return { status: "ready", data: rows.map(mapDocumentSummary) };
  } catch (error) {
    return failure(error, "Controlled documents could not be loaded.");
  }
}

export async function loadLiveEquipmentDocument(
  equipmentId: string,
  documentId: string,
): Promise<LiveDataState<LiveEquipmentDocument>> {
  if (!equipmentId || !documentId) {
    return {
      status: "unavailable",
      message: "An equipment and document identifier are required.",
    };
  }
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_document", {
      p_equipment_id: equipmentId,
      p_document_id: documentId,
    });
    if (error) throw new Error(`The controlled document could not be opened: ${error.message}`);
    const row = asRows(data)[0];
    if (!row) {
      return {
        status: "empty",
        message: "This document is not available for the authorised equipment and site.",
      };
    }
    return {
      status: "ready",
      data: {
        ...mapDocumentSummary({
          ...row,
          chunk_count: asArray(row.chunks).length,
          first_section_title:
            typeof asArray(row.chunks)[0] === "object" && asArray(row.chunks)[0] !== null
              ? (asArray(row.chunks)[0] as Record<string, unknown>).sectionTitle
              : null,
          first_page_number:
            typeof asArray(row.chunks)[0] === "object" && asArray(row.chunks)[0] !== null
              ? (asArray(row.chunks)[0] as Record<string, unknown>).pageNumber
              : null,
        }),
        chunks: asArray(row.chunks)
          .map(mapDocumentChunk)
          .filter((item): item is LiveEquipmentDocumentChunk => Boolean(item)),
      },
    };
  } catch (error) {
    return failure(error, "The controlled document could not be opened.");
  }
}

export function isLiveWorkItemCompleted(workItem: LiveWorkItem): boolean {
  return Boolean(
    workItem.completedDate || /completed|closed|cancelled|canceled|technically complete/i.test(workItem.status),
  );
}

export function isLiveWorkItemOverdue(
  workItem: LiveWorkItem,
  referenceDate: Date = new Date(),
): boolean {
  if (isLiveWorkItemCompleted(workItem) || !workItem.dueDate) return false;
  const dueDate = new Date(`${workItem.dueDate}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

export function buildWorkEvidenceCitation(item: LiveEquipmentHistoryItem): string {
  const references = [
    `WO ${item.workOrderNumber}`,
    item.confirmations[0]?.confirmationNumber
      ? `confirmation ${item.confirmations[0].confirmationNumber}`
      : null,
    item.reservations[0]?.reservationNumber
      ? `reservation ${item.reservations[0].reservationNumber}`
      : null,
    item.goodsMovements[0]?.materialDocumentNumber
      ? `material document ${item.goodsMovements[0].materialDocumentNumber}`
      : null,
  ].filter((value): value is string => Boolean(value));
  return references.join(" · ");
}

export function buildDocumentCitation(document: LiveEquipmentDocumentSummary): string {
  return [
    document.title,
    document.revision ? `rev ${document.revision}` : null,
    document.externalReference ?? document.sourceDocumentId,
    document.firstPageNumber ? `page ${document.firstPageNumber}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}
