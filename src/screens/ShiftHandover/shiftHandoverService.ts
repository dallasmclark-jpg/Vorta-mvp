import type { VortaDataMode } from "../../lib/dataTrust";
import {
  clearMaintenancePortalDataCache,
  supabase,
} from "../../lib/supabaseClient";

export type ShiftHandoverStatus =
  | "completed"
  | "ongoing"
  | "temporarily_restored"
  | "waiting_on_parts"
  | "external_contractor"
  | "waiting_on_production"
  | "monitoring"
  | "deferred";

export type ShiftHandoverDiscipline =
  | "mechanical"
  | "electrical"
  | "controls"
  | "facilities";

export interface ShiftHandoverConfirmation {
  id: string;
  timestamp: string | null;
  text: string;
  confirmedBy: string | null;
  workCenter: string | null;
  actualWork: number;
  workUnit: string | null;
  actualDuration: number;
  durationUnit: string | null;
  finalConfirmation: boolean;
}

export interface ShiftHandoverSpareUsed {
  materialNumber: string;
  description: string;
  quantity: number;
  unit: string;
  storageLocation: string;
  postingDate: string | null;
}

export interface ShiftHandoverOutstandingMaterial {
  materialNumber: string;
  requiredQuantity: number;
  withdrawnQuantity: number;
  outstandingQuantity: number;
  unit: string;
  requirementDate: string | null;
  storageLocation: string;
  reservationStatus: string;
}

export interface ShiftHandoverItem {
  id: string;
  workOrderNumber: string;
  notificationNumber: string | null;
  description: string;
  workType: string;
  priority: string;
  criticality: "critical" | "high" | "medium" | "low" | "unknown";
  criticalityRank: number;
  status: ShiftHandoverStatus;
  statusLabel: string;
  sapStatus: string;
  systemStatusCodes: string[];
  userStatusCodes: string[];
  equipmentId: string;
  equipmentCode: string | null;
  equipmentName: string;
  area: string;
  line: string | null;
  building: string;
  department: string | null;
  functionalLocation: string | null;
  discipline: ShiftHandoverDiscipline;
  assignedEngineer: string | null;
  mainWorkCenter: string | null;
  breakdownMinutes: number;
  confirmedWorkHours: number;
  actualStartAt: string | null;
  actualFinishAt: string | null;
  lastActivityAt: string | null;
  latestConfirmationText: string | null;
  confirmations: ShiftHandoverConfirmation[];
  sparesUsed: ShiftHandoverSpareUsed[];
  outstandingMaterials: ShiftHandoverOutstandingMaterial[];
  contractor: boolean;
  nextAction: string;
  sourceSystem: string;
  sourceUpdatedAt: string | null;
}

export interface ShiftHandoverSnapshot {
  siteId: string;
  organisationId: string;
  site: {
    id: string;
    name: string;
    timezone: string;
  };
  window: {
    start: string;
    end: string;
    label: string;
    mode: "previous" | "latest";
  };
  items: ShiftHandoverItem[];
  scopeOptions: {
    buildings: string[];
    areas: string[];
    disciplines: ShiftHandoverDiscipline[];
  };
  summary: {
    total: number;
    ongoing: number;
    completed: number;
    waitingOnParts: number;
    externalContractor: number;
    unavailableEquipment: number;
    totalBreakdownMinutes: number;
    sparesUsed: number;
  };
  generatedAt: string;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseConfirmation(value: unknown): ShiftHandoverConfirmation | null {
  const row = objectValue(value);
  if (!row || !stringValue(row.id)) return null;
  return {
    id: stringValue(row.id),
    timestamp: stringValue(row.timestamp) || null,
    text: stringValue(row.text),
    confirmedBy: stringValue(row.confirmedBy) || null,
    workCenter: stringValue(row.workCenter) || null,
    actualWork: numberValue(row.actualWork),
    workUnit: stringValue(row.workUnit) || null,
    actualDuration: numberValue(row.actualDuration),
    durationUnit: stringValue(row.durationUnit) || null,
    finalConfirmation: Boolean(row.finalConfirmation),
  };
}

function parseItem(value: unknown): ShiftHandoverItem | null {
  const row = objectValue(value);
  if (!row || !stringValue(row.id) || !stringValue(row.workOrderNumber)) return null;

  const criticality = stringValue(row.criticality);
  const status = stringValue(row.status);
  const discipline = stringValue(row.discipline);
  const allowedCriticality = ["critical", "high", "medium", "low", "unknown"].includes(criticality)
    ? criticality as ShiftHandoverItem["criticality"]
    : "unknown";
  const allowedStatus = [
    "completed",
    "ongoing",
    "temporarily_restored",
    "waiting_on_parts",
    "external_contractor",
    "waiting_on_production",
    "monitoring",
    "deferred",
  ].includes(status)
    ? status as ShiftHandoverStatus
    : "ongoing";
  const allowedDiscipline = ["mechanical", "electrical", "controls", "facilities"].includes(discipline)
    ? discipline as ShiftHandoverDiscipline
    : "mechanical";

  const confirmations = Array.isArray(row.confirmations)
    ? row.confirmations.map(parseConfirmation).filter((item): item is ShiftHandoverConfirmation => Boolean(item))
    : [];

  const sparesUsed = Array.isArray(row.sparesUsed)
    ? row.sparesUsed.map((entry) => {
        const spare = objectValue(entry);
        if (!spare) return null;
        return {
          materialNumber: stringValue(spare.materialNumber),
          description: stringValue(spare.description),
          quantity: numberValue(spare.quantity),
          unit: stringValue(spare.unit),
          storageLocation: stringValue(spare.storageLocation),
          postingDate: stringValue(spare.postingDate) || null,
        } satisfies ShiftHandoverSpareUsed;
      }).filter((item): item is ShiftHandoverSpareUsed => Boolean(item))
    : [];

  const outstandingMaterials = Array.isArray(row.outstandingMaterials)
    ? row.outstandingMaterials.map((entry) => {
        const material = objectValue(entry);
        if (!material) return null;
        return {
          materialNumber: stringValue(material.materialNumber),
          requiredQuantity: numberValue(material.requiredQuantity),
          withdrawnQuantity: numberValue(material.withdrawnQuantity),
          outstandingQuantity: numberValue(material.outstandingQuantity),
          unit: stringValue(material.unit),
          requirementDate: stringValue(material.requirementDate) || null,
          storageLocation: stringValue(material.storageLocation),
          reservationStatus: stringValue(material.reservationStatus),
        } satisfies ShiftHandoverOutstandingMaterial;
      }).filter((item): item is ShiftHandoverOutstandingMaterial => Boolean(item))
    : [];

  return {
    id: stringValue(row.id),
    workOrderNumber: stringValue(row.workOrderNumber),
    notificationNumber: stringValue(row.notificationNumber) || null,
    description: stringValue(row.description),
    workType: stringValue(row.workType),
    priority: stringValue(row.priority),
    criticality: allowedCriticality,
    criticalityRank: numberValue(row.criticalityRank),
    status: allowedStatus,
    statusLabel: stringValue(row.statusLabel) || "Ongoing",
    sapStatus: stringValue(row.sapStatus),
    systemStatusCodes: stringArray(row.systemStatusCodes),
    userStatusCodes: stringArray(row.userStatusCodes),
    equipmentId: stringValue(row.equipmentId),
    equipmentCode: stringValue(row.equipmentCode) || null,
    equipmentName: stringValue(row.equipmentName) || "Unknown equipment",
    area: stringValue(row.area) || "Unassigned area",
    line: stringValue(row.line) || null,
    building: stringValue(row.building) || "Site",
    department: stringValue(row.department) || null,
    functionalLocation: stringValue(row.functionalLocation) || null,
    discipline: allowedDiscipline,
    assignedEngineer: stringValue(row.assignedEngineer) || null,
    mainWorkCenter: stringValue(row.mainWorkCenter) || null,
    breakdownMinutes: numberValue(row.breakdownMinutes),
    confirmedWorkHours: numberValue(row.confirmedWorkHours),
    actualStartAt: stringValue(row.actualStartAt) || null,
    actualFinishAt: stringValue(row.actualFinishAt) || null,
    lastActivityAt: stringValue(row.lastActivityAt) || null,
    latestConfirmationText: stringValue(row.latestConfirmationText) || null,
    confirmations,
    sparesUsed,
    outstandingMaterials,
    contractor: Boolean(row.contractor),
    nextAction: stringValue(row.nextAction),
    sourceSystem: stringValue(row.sourceSystem) || "SAP",
    sourceUpdatedAt: stringValue(row.sourceUpdatedAt) || null,
  };
}

function parseSnapshot(value: unknown): ShiftHandoverSnapshot {
  const root = objectValue(value);
  const site = objectValue(root?.site);
  const window = objectValue(root?.window);
  const summary = objectValue(root?.summary);
  const scopeOptions = objectValue(root?.scopeOptions);

  if (!root || !site || !window || !summary || !scopeOptions) {
    throw new Error("Shift handover evidence returned an invalid response.");
  }

  const items = Array.isArray(root.items)
    ? root.items.map(parseItem).filter((item): item is ShiftHandoverItem => Boolean(item))
    : [];

  return {
    siteId: stringValue(root.siteId) || stringValue(site.id),
    organisationId: stringValue(root.organisationId),
    site: {
      id: stringValue(site.id),
      name: stringValue(site.name),
      timezone: stringValue(site.timezone) || "Europe/London",
    },
    window: {
      start: stringValue(window.start),
      end: stringValue(window.end),
      label: stringValue(window.label),
      mode: window.mode === "latest" ? "latest" : "previous",
    },
    items,
    scopeOptions: {
      buildings: stringArray(scopeOptions.buildings),
      areas: stringArray(scopeOptions.areas),
      disciplines: stringArray(scopeOptions.disciplines).filter(
        (item): item is ShiftHandoverDiscipline =>
          ["mechanical", "electrical", "controls", "facilities"].includes(item),
      ),
    },
    summary: {
      total: numberValue(summary.total),
      ongoing: numberValue(summary.ongoing),
      completed: numberValue(summary.completed),
      waitingOnParts: numberValue(summary.waitingOnParts),
      externalContractor: numberValue(summary.externalContractor),
      unavailableEquipment: numberValue(summary.unavailableEquipment),
      totalBreakdownMinutes: numberValue(summary.totalBreakdownMinutes),
      sparesUsed: numberValue(summary.sparesUsed),
    },
    generatedAt: stringValue(root.generatedAt),
  };
}

export async function loadShiftHandoverSnapshot(
  dataMode: VortaDataMode,
  refresh = false,
): Promise<ShiftHandoverSnapshot> {
  if (dataMode === "unavailable") {
    throw new Error("Shift handover is unavailable because no authorised active site was resolved.");
  }

  if (refresh) clearMaintenancePortalDataCache("shift-handover-data");

  const { data, error } = await supabase.functions.invoke("shift-handover-data", {
    body: {
      windowMode: dataMode === "demo" ? "latest" : "previous",
      limit: 100,
    },
  });

  if (error) {
    throw new Error(error instanceof Error ? error.message : "Shift handover evidence could not be loaded.");
  }

  return parseSnapshot(data);
}
