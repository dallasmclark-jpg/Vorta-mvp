import { supabase } from "../../lib/supabaseClient";
import type { EquipmentListItem } from "./equipmentService";

export type LiveDataState<T> =
  | { status: "ready"; data: T }
  | { status: "empty"; message: string }
  | { status: "unavailable"; message: string };

export interface LiveRiskProfile {
  score: number;
  level: EquipmentListItem["riskLevel"];
  updatedAt: string;
  breakdown: EquipmentListItem["breakdown"];
  operationalRiskScore: number;
  labourRiskScore: number;
  scheduledEngineerCount: number;
  qualifiedEngineerCount: number;
  missingSkillCount: number;
  labourShiftDate: string | null;
  labourShiftType: string | null;
  noEngineerOverride: boolean;
  overduePmCount: number;
  openWorkOrderCount: number;
  calibrationOverdueCount: number;
  riskSummary: string | null;
  priorityAction: string | null;
}

export interface LiveEquipmentRecord {
  id: string;
  siteId: string;
  name: string;
  assetNumber: string;
  type: string;
  area: string;
  oem: string;
  model: string;
  criticality: string;
  status: string;
  imageUrl: string | null;
  sourceSystem: string;
  sourceUpdatedAt: string | null;
  risk: LiveRiskProfile;
}

export interface LiveEquipmentListPayload {
  items: EquipmentListItem[];
  records: LiveEquipmentRecord[];
  excludedWithoutRiskProfile: number;
  excludedInvalidRiskProfile: number;
}

export interface LiveComponent {
  name: string;
  partNumber: string;
  stock: number;
  target: number;
  minimum: number;
  importedStatus: string;
  derivedStatus: "Out of stock" | "Low stock" | "Below target" | "Covered";
  supplier: string;
  manufacturer: string;
  location: string;
  criticality: string;
  unitCost: number;
  leadDays: number;
  updatedAt: string | null;
}

export interface LiveComponentsPayload {
  inventory: LiveComponent[];
  outOfStock: number;
  lowStock: number;
  belowTarget: number;
  covered: number;
  targetUnits: number;
  coveredTargetUnits: number;
  stockResilience: number | null;
}

export interface LiveWorkItem {
  id: string;
  workOrderNumber: string;
  description: string;
  priority: string;
  workType: string;
  status: string;
  assignedEngineer: string;
  requestedDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  ageLabel: string;
  overdue: boolean;
  pmNumber: string | null;
  pmTitle: string | null;
  pmType: string | null;
  pmStatus: string | null;
  pmNextDueDate: string | null;
  notificationNumber: string | null;
  orderTypeCode: string | null;
  orderTypeDescription: string | null;
  orderOrigin: string | null;
}

export interface LiveCalibration {
  id: string;
  number: string;
  title: string;
  point: string | null;
  tolerance: string | null;
  lastCompletedDate: string | null;
  nextDueDate: string | null;
  scheduleStatus: string;
  criticality: string | null;
  assignedEngineer: string | null;
  procedureReference: string | null;
  checklistReference: string | null;
  lastResult: string | null;
  resultAt: string | null;
  certificateReference: string | null;
  linkedWorkOrderNumber: string | null;
  linkedWorkOrderStatus: string | null;
  linkedWorkOrderDueDate: string | null;
  riskState: string | null;
}

export interface LiveSkillsPayload {
  requiredSkillCount: number;
  primarySmeCount: number;
  backupSmeCount: number;
  developingBackupCount: number;
  peopleResilienceScore: number;
  requiredSkills: Array<Record<string, unknown>>;
  engineers: Array<Record<string, unknown>>;
  operators: Array<Record<string, unknown>>;
  developmentPaths: Array<Record<string, unknown>>;
  shiftCoverage: Array<Record<string, unknown>>;
}

export interface LiveNotification {
  id: string;
  number: string;
  typeCode: string | null;
  typeDescription: string | null;
  shortText: string;
  longText: string | null;
  priorityCode: string | null;
  priorityDescription: string | null;
  sourceStatus: string;
  workflowStatus: string;
  breakdownIndicator: boolean;
  reportedBy: string | null;
  requiredStartDate: string | null;
  requiredEndDate: string | null;
  reportedAt: string | null;
  ageDays: number;
  riskPoints: number;
  riskReason: string | null;
  linkedWorkOrderNumber: string | null;
  linkedWorkOrderStatus: string | null;
  linkedWorkOrderPriority: string | null;
  linkedWorkOrderDueDate: string | null;
  linkedWorkOrderOverdue: boolean;
}

const MAX_RISK_PROFILE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const riskSegments = [
  ["PM Backlog", "pm_backlog_pct", "#f97316", "bg-orange-500"],
  ["Asset Criticality", "asset_criticality_pct", "#dc2626", "bg-red-600"],
  ["Calibration", "calibration_pct", "#06b6d4", "bg-cyan-400"],
  ["Labour Coverage", "skills_pct", "#eab308", "bg-yellow-400"],
  ["Spares", "spares_pct", "#6366f1", "bg-indigo-500"],
  ["Notifications", "notification_pct", "#a855f7", "bg-purple-500"],
] as const;

const numberValue = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const stringValue = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const asRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is Record<string, unknown> => typeof row === "object" && row !== null,
    );
  }
  return typeof value === "object" && value !== null
    ? [value as Record<string, unknown>]
    : [];
};
const failure = <T>(error: unknown, fallback: string): LiveDataState<T> => ({
  status: "unavailable",
  message: error instanceof Error ? error.message : fallback,
});

function expectedRiskLevel(score: number): EquipmentListItem["riskLevel"] {
  if (score >= 85) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  if (score >= 20) return "Low";
  return "Minimal";
}

function firstProfile(row: Record<string, unknown>): Record<string, unknown> | null {
  const profiles = asRows(row.equipment_risk_profiles).sort(
    (left, right) =>
      new Date(String(right.updated_at ?? 0)).getTime() -
      new Date(String(left.updated_at ?? 0)).getTime(),
  );
  return profiles[0] ?? null;
}

function validateRiskProfile(
  profile: Record<string, unknown> | null,
): LiveDataState<LiveRiskProfile> {
  if (!profile) {
    return { status: "empty", message: "No stored equipment risk profile is available." };
  }

  const score = numberValue(profile.risk_score);
  if (score === null || score < 0 || score > 100) {
    return {
      status: "unavailable",
      message: "The stored equipment risk score is invalid and has been withheld.",
    };
  }

  const level = expectedRiskLevel(score);
  if (profile.risk_level !== level) {
    return {
      status: "unavailable",
      message: `The stored risk level does not match the verified ${score.toFixed(1)} score band.`,
    };
  }

  const updatedAt = stringValue(profile.updated_at) ?? "";
  const updatedTime = new Date(updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) {
    return {
      status: "unavailable",
      message: "The equipment risk profile has no valid calculation timestamp.",
    };
  }
  const age = Date.now() - updatedTime;
  if (age < -MAX_FUTURE_CLOCK_SKEW_MS) {
    return {
      status: "unavailable",
      message: "The equipment risk profile timestamp is in the future and cannot be trusted.",
    };
  }
  if (age > MAX_RISK_PROFILE_AGE_MS) {
    return {
      status: "unavailable",
      message: "The equipment risk profile is more than seven days old and must be recalculated.",
    };
  }

  const breakdown = riskSegments.map(([label, key, color, dotClass]) => ({
    label,
    pct: numberValue(profile[key]) ?? 0,
    color,
    dotClass,
  }));
  if (breakdown.some((segment) => segment.pct < 0 || segment.pct > 100)) {
    return {
      status: "unavailable",
      message: "One or more stored risk-driver percentages are invalid.",
    };
  }
  const driverTotal = breakdown.reduce((total, segment) => total + segment.pct, 0);
  if (Math.abs(driverTotal - 100) > 1) {
    return {
      status: "unavailable",
      message: `Stored risk drivers total ${driverTotal.toFixed(1)}%, not 100%.`,
    };
  }

  return {
    status: "ready",
    data: {
      score,
      level,
      updatedAt,
      breakdown: breakdown.filter((segment) => segment.pct > 0),
      operationalRiskScore: numberValue(profile.operational_risk_score) ?? 0,
      labourRiskScore: numberValue(profile.labour_risk_score) ?? 0,
      scheduledEngineerCount: numberValue(profile.scheduled_engineer_count) ?? 0,
      qualifiedEngineerCount: numberValue(profile.qualified_engineer_count) ?? 0,
      missingSkillCount: numberValue(profile.missing_skill_count) ?? 0,
      labourShiftDate: stringValue(profile.labour_shift_date),
      labourShiftType: stringValue(profile.labour_shift_type),
      noEngineerOverride: profile.no_engineer_override === true,
      overduePmCount: numberValue(profile.overdue_pm_count) ?? 0,
      openWorkOrderCount: numberValue(profile.open_work_order_count) ?? 0,
      calibrationOverdueCount: numberValue(profile.calibration_overdue_count) ?? 0,
      riskSummary: stringValue(profile.risk_summary),
      priorityAction: stringValue(profile.priority_action),
    },
  };
}

function mapEquipment(
  row: Record<string, unknown>,
  risk: LiveRiskProfile,
): LiveEquipmentRecord {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    name: stringValue(row.name) ?? "Unnamed equipment",
    assetNumber:
      stringValue(row.equipment_code) ?? String(row.id).slice(0, 8).toUpperCase(),
    type: String(row.equipment_type ?? "Equipment").toUpperCase(),
    area: stringValue(row.area) ?? "—",
    oem: stringValue(row.oem) ?? "—",
    model: stringValue(row.model) ?? "—",
    criticality: stringValue(row.criticality) ?? "Unknown",
    status: stringValue(row.status) ?? "Unknown",
    imageUrl: stringValue(row.image_url),
    sourceSystem: stringValue(row.source_system) ?? "Unknown",
    sourceUpdatedAt: stringValue(row.source_updated_at),
    risk,
  };
}

const EQUIPMENT_SELECT = `
  id, site_id, equipment_code, name, equipment_type, area, oem, model,
  criticality, status, image_url, source_system, source_updated_at,
  equipment_risk_profiles (
    risk_score, risk_level, pm_backlog_pct, asset_criticality_pct,
    calibration_pct, skills_pct, spares_pct, notification_pct,
    overdue_pm_count, open_work_order_count, calibration_overdue_count,
    operational_risk_score, labour_risk_score, scheduled_engineer_count,
    qualified_engineer_count, missing_skill_count, labour_shift_date,
    labour_shift_type, no_engineer_override, risk_summary, priority_action,
    updated_at
  )
`;

export async function loadLiveEquipmentList(
  siteId: string,
): Promise<LiveDataState<LiveEquipmentListPayload>> {
  if (!siteId) return { status: "unavailable", message: "No active site was supplied." };
  try {
    const { data, error } = await supabase
      .from("equipment_assets")
      .select(EQUIPMENT_SELECT)
      .eq("site_id", siteId)
      .order("name");
    if (error) throw new Error(`Active-site equipment records could not be loaded: ${error.message}`);
    if (!data?.length) {
      return { status: "empty", message: "No equipment records are configured for the active site." };
    }

    const records: LiveEquipmentRecord[] = [];
    let excludedWithoutRiskProfile = 0;
    let excludedInvalidRiskProfile = 0;
    for (const row of data as unknown as Record<string, unknown>[]) {
      const riskState = validateRiskProfile(firstProfile(row));
      if (riskState.status === "empty") excludedWithoutRiskProfile += 1;
      else if (riskState.status === "unavailable") excludedInvalidRiskProfile += 1;
      else records.push(mapEquipment(row, riskState.data));
    }
    if (!records.length) {
      return {
        status: "empty",
        message:
          "Equipment records exist for the active site, but none has a current valid risk profile.",
      };
    }
    records.sort((left, right) => right.risk.score - left.risk.score);
    return {
      status: "ready",
      data: {
        records,
        excludedWithoutRiskProfile,
        excludedInvalidRiskProfile,
        items: records.map((record) => ({
          id: record.id,
          name: record.name,
          assetNumber: record.assetNumber,
          type: record.type,
          area: record.area,
          riskScore: record.risk.score,
          riskLevel: record.risk.level,
          breakdown: record.risk.breakdown,
          operationalRiskScore: record.risk.operationalRiskScore,
          labourRiskScore: record.risk.labourRiskScore,
          scheduledEngineerCount: record.risk.scheduledEngineerCount,
          qualifiedEngineerCount: record.risk.qualifiedEngineerCount,
          missingSkillCount: record.risk.missingSkillCount,
          labourShiftDate: record.risk.labourShiftDate,
          labourShiftType: record.risk.labourShiftType,
          noEngineerOverride: record.risk.noEngineerOverride,
          status: record.status,
          oem: record.oem,
          criticality: record.criticality,
          overduePmCount: record.risk.overduePmCount,
          openWorkOrderCount: record.risk.openWorkOrderCount,
          calibrationOverdueCount: record.risk.calibrationOverdueCount,
        })),
      },
    };
  } catch (error) {
    return failure(error, "Active-site equipment records could not be loaded.");
  }
}

export async function loadLiveEquipmentRecord(
  siteId: string,
  equipmentId: string,
): Promise<LiveDataState<LiveEquipmentRecord>> {
  if (!siteId || !equipmentId) {
    return {
      status: "unavailable",
      message: "An active site and equipment identifier are required.",
    };
  }
  try {
    const { data, error } = await supabase
      .from("equipment_assets")
      .select(EQUIPMENT_SELECT)
      .eq("site_id", siteId)
      .eq("id", equipmentId)
      .maybeSingle();
    if (error) throw new Error(`The active-site equipment record could not be verified: ${error.message}`);
    if (!data) {
      return {
        status: "empty",
        message: "This equipment does not belong to the authorised active site.",
      };
    }
    const row = data as unknown as Record<string, unknown>;
    const riskState = validateRiskProfile(firstProfile(row));
    return riskState.status === "ready"
      ? { status: "ready", data: mapEquipment(row, riskState.data) }
      : riskState;
  } catch (error) {
    return failure(error, "The active-site equipment record could not be verified.");
  }
}

export async function loadLiveEquipmentComponents(
  siteId: string,
  equipmentId: string,
): Promise<LiveDataState<LiveComponentsPayload>> {
  try {
    const { data, error } = await supabase
      .from("equipment_components")
      .select(
        "component_name, component_code, quantity_available, quantity_target, minimum_quantity, availability_status, vendor_name, maker_name, storage_location, criticality, unit_cost, lead_days, updated_at",
      )
      .eq("site_id", siteId)
      .eq("equipment_id", equipmentId)
      .order("component_name");
    if (error) throw new Error(`Live component inventory could not be loaded: ${error.message}`);
    if (!data?.length) {
      return {
        status: "empty",
        message:
          "No component inventory is configured for this equipment. Stock resilience is unavailable, not 100%.",
      };
    }

    const inventory: LiveComponent[] = data.map((row: Record<string, unknown>) => {
      const stock = Math.max(0, numberValue(row.quantity_available) ?? 0);
      const target = Math.max(0, numberValue(row.quantity_target) ?? 0);
      const minimum = Math.max(0, numberValue(row.minimum_quantity) ?? 0);
      const derivedStatus: LiveComponent["derivedStatus"] =
        stock <= 0
          ? "Out of stock"
          : stock < minimum
            ? "Low stock"
            : stock < target
              ? "Below target"
              : "Covered";
      return {
        name: stringValue(row.component_name) ?? "Unnamed component",
        partNumber: stringValue(row.component_code) ?? "—",
        stock,
        target,
        minimum,
        importedStatus: stringValue(row.availability_status) ?? "",
        derivedStatus,
        supplier: stringValue(row.vendor_name) ?? "—",
        manufacturer: stringValue(row.maker_name) ?? "—",
        location: stringValue(row.storage_location) ?? "—",
        criticality: stringValue(row.criticality) ?? "Unknown",
        unitCost: Math.max(0, numberValue(row.unit_cost) ?? 0),
        leadDays: Math.max(0, numberValue(row.lead_days) ?? 0),
        updatedAt: stringValue(row.updated_at),
      };
    });
    const targetUnits = inventory.reduce((sum, item) => sum + item.target, 0);
    const coveredTargetUnits = inventory.reduce(
      (sum, item) => sum + Math.min(item.stock, item.target),
      0,
    );
    return {
      status: "ready",
      data: {
        inventory,
        outOfStock: inventory.filter((item) => item.derivedStatus === "Out of stock").length,
        lowStock: inventory.filter((item) => item.derivedStatus === "Low stock").length,
        belowTarget: inventory.filter((item) => item.derivedStatus === "Below target").length,
        covered: inventory.filter((item) => item.derivedStatus === "Covered").length,
        targetUnits,
        coveredTargetUnits,
        stockResilience:
          targetUnits > 0 ? Math.round((coveredTargetUnits / targetUnits) * 100) : null,
      },
    };
  } catch (error) {
    return failure(error, "Live component inventory could not be loaded.");
  }
}

export async function loadLiveEquipmentWorkItems(
  equipmentId: string,
): Promise<LiveDataState<LiveWorkItem[]>> {
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_work_items", {
      p_equipment_id: equipmentId,
    });
    if (error) throw new Error(`Work items could not be loaded: ${error.message}`);
    const rows = asRows(data);
    if (!rows.length) return { status: "empty", message: "No work orders are recorded for this equipment." };
    return {
      status: "ready",
      data: rows.map((row) => ({
        id: String(row.work_order_id ?? row.work_order_number ?? ""),
        workOrderNumber: String(row.work_order_number ?? "—"),
        description: String(row.description ?? "No description"),
        priority: String(row.priority ?? "Unknown"),
        workType: String(row.work_type ?? "Unknown"),
        status: String(row.status ?? "Unknown"),
        assignedEngineer: String(row.assigned_engineer ?? "Unassigned"),
        requestedDate: stringValue(row.requested_date),
        dueDate: stringValue(row.due_date),
        completedDate: stringValue(row.completed_date),
        ageLabel: String(row.age_label ?? "—"),
        overdue: row.is_overdue === true,
        pmNumber: stringValue(row.pm_number),
        pmTitle: stringValue(row.pm_title),
        pmType: stringValue(row.pm_type),
        pmStatus: stringValue(row.pm_status),
        pmNextDueDate: stringValue(row.pm_next_due_date),
        notificationNumber: stringValue(row.notification_number),
        orderTypeCode: stringValue(row.order_type_code),
        orderTypeDescription: stringValue(row.order_type_description),
        orderOrigin: stringValue(row.order_origin),
      })),
    };
  } catch (error) {
    return failure(error, "Work items could not be loaded.");
  }
}

export async function loadLiveEquipmentCalibrations(
  equipmentId: string,
): Promise<LiveDataState<LiveCalibration[]>> {
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_calibrations", {
      p_equipment_id: equipmentId,
    });
    if (error) throw new Error(`Calibrations could not be loaded: ${error.message}`);
    const rows = asRows(data);
    if (!rows.length) {
      return { status: "empty", message: "No calibration records are configured for this equipment." };
    }
    return {
      status: "ready",
      data: rows.map((row) => ({
        id: String(row.calibration_id ?? row.calibration_number ?? ""),
        number: String(row.calibration_number ?? "—"),
        title: String(row.title ?? "Calibration"),
        point: stringValue(row.calibration_point),
        tolerance: stringValue(row.tolerance_specification),
        lastCompletedDate: stringValue(row.last_completed_date),
        nextDueDate: stringValue(row.next_due_date),
        scheduleStatus: String(row.schedule_status ?? "Unknown"),
        criticality: stringValue(row.criticality),
        assignedEngineer: stringValue(row.assigned_engineer),
        procedureReference: stringValue(row.procedure_reference),
        checklistReference: stringValue(row.checklist_reference),
        lastResult: stringValue(row.last_result),
        resultAt: stringValue(row.result_at),
        certificateReference: stringValue(row.certificate_reference),
        linkedWorkOrderNumber: stringValue(row.linked_work_order_number),
        linkedWorkOrderStatus: stringValue(row.linked_work_order_status),
        linkedWorkOrderDueDate: stringValue(row.linked_work_order_due_date),
        riskState: stringValue(row.risk_state),
      })),
    };
  } catch (error) {
    return failure(error, "Calibrations could not be loaded.");
  }
}

export async function loadLiveEquipmentSkills(
  equipmentId: string,
): Promise<LiveDataState<LiveSkillsPayload>> {
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_skills_showcase", {
      p_equipment_id: equipmentId,
    });
    if (error) throw new Error(`Skills evidence could not be loaded: ${error.message}`);
    const row = asRows(data)[0];
    if (!row) return { status: "empty", message: "No skills evidence is configured for this equipment." };
    return {
      status: "ready",
      data: {
        requiredSkillCount: numberValue(row.required_skill_count) ?? 0,
        primarySmeCount: numberValue(row.primary_sme_count) ?? 0,
        backupSmeCount: numberValue(row.backup_sme_count) ?? 0,
        developingBackupCount: numberValue(row.developing_backup_count) ?? 0,
        peopleResilienceScore: numberValue(row.people_resilience_score) ?? 0,
        requiredSkills: asRows(row.required_skills),
        engineers: asRows(row.engineers),
        operators: asRows(row.operators),
        developmentPaths: asRows(row.development_paths),
        shiftCoverage: asRows(row.shift_coverage),
      },
    };
  } catch (error) {
    return failure(error, "Skills evidence could not be loaded.");
  }
}

export async function loadLiveEquipmentNotifications(
  equipmentId: string,
): Promise<LiveDataState<LiveNotification[]>> {
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_notifications", {
      p_equipment_id: equipmentId,
    });
    if (error) throw new Error(`Maintenance notifications could not be loaded: ${error.message}`);
    const rows = asRows(data);
    if (!rows.length) {
      return {
        status: "empty",
        message: "No maintenance notifications are recorded for this equipment.",
      };
    }
    return {
      status: "ready",
      data: rows.map((row) => ({
        id: String(row.notification_id ?? row.notification_number ?? ""),
        number: String(row.notification_number ?? "—"),
        typeCode: stringValue(row.notification_type_code),
        typeDescription: stringValue(row.notification_type_description),
        shortText: String(row.short_text ?? "Maintenance notification"),
        longText: stringValue(row.long_text),
        priorityCode: stringValue(row.priority_code),
        priorityDescription: stringValue(row.priority_description),
        sourceStatus: String(row.source_status ?? "Unknown"),
        workflowStatus: String(row.workflow_status ?? "Unknown"),
        breakdownIndicator: row.breakdown_indicator === true,
        reportedBy: stringValue(row.reported_by),
        requiredStartDate: stringValue(row.required_start_date),
        requiredEndDate: stringValue(row.required_end_date),
        reportedAt: stringValue(row.reported_at),
        ageDays: numberValue(row.age_days) ?? 0,
        riskPoints: numberValue(row.risk_points) ?? 0,
        riskReason: stringValue(row.risk_reason),
        linkedWorkOrderNumber: stringValue(row.linked_work_order_number),
        linkedWorkOrderStatus: stringValue(row.linked_work_order_status),
        linkedWorkOrderPriority: stringValue(row.linked_work_order_priority),
        linkedWorkOrderDueDate: stringValue(row.linked_work_order_due_date),
        linkedWorkOrderOverdue: row.linked_work_order_overdue === true,
      })),
    };
  } catch (error) {
    return failure(error, "Maintenance notifications could not be loaded.");
  }
}
