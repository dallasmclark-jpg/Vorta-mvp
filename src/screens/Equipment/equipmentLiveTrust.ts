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

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is Record<string, unknown> => typeof row === "object" && row !== null,
    );
  }
  if (typeof value === "object" && value !== null) {
    return [value as Record<string, unknown>];
  }
  return [];
}

function expectedRiskLevel(score: number): EquipmentListItem["riskLevel"] {
  if (score >= 85) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  if (score >= 20) return "Low";
  return "Minimal";
}

function firstProfile(row: Record<string, unknown>): Record<string, unknown> | null {
  const raw = row.equipment_risk_profiles;
  if (Array.isArray(raw)) {
    const profiles = raw
      .filter(
        (profile): profile is Record<string, unknown> =>
          typeof profile === "object" && profile !== null,
      )
      .sort(
        (left, right) =>
          new Date(String(right.updated_at ?? 0)).getTime() -
          new Date(String(left.updated_at ?? 0)).getTime(),
      );
    return profiles[0] ?? null;
  }
  return typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>)
    : null;
}

function validateRiskProfile(
  profile: Record<string, unknown> | null,
): LiveDataState<LiveRiskProfile> {
  if (!profile) {
    return {
      status: "empty",
      message: "No stored equipment risk profile is available.",
    };
  }

  const score = asNumber(profile.risk_score);
  const level = profile.risk_level;
  const updatedAt = typeof profile.updated_at === "string" ? profile.updated_at : "";
  const updatedTime = new Date(updatedAt).getTime();

  if (score === null || score < 0 || score > 100) {
    return {
      status: "unavailable",
      message: "The stored equipment risk score is invalid and has been withheld.",
    };
  }

  if (level !== expectedRiskLevel(score)) {
    return {
      status: "unavailable",
      message: `The stored risk level does not match the verified ${score.toFixed(1)} score band.`,
    };
  }

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
    pct: asNumber(profile[key]) ?? 0,
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
      operationalRiskScore: asNumber(profile.operational_risk_score) ?? 0,
      labourRiskScore: asNumber(profile.labour_risk_score) ?? 0,
      scheduledEngineerCount: asNumber(profile.scheduled_engineer_count) ?? 0,
      qualifiedEngineerCount: asNumber(profile.qualified_engineer_count) ?? 0,
      missingSkillCount: asNumber(profile.missing_skill_count) ?? 0,
      labourShiftDate:
        typeof profile.labour_shift_date === "string" ? profile.labour_shift_date : null,
      labourShiftType:
        typeof profile.labour_shift_type === "string" ? profile.labour_shift_type : null,
      noEngineerOverride: profile.no_engineer_override === true,
      overduePmCount: asNumber(profile.overdue_pm_count) ?? 0,
      openWorkOrderCount: asNumber(profile.open_work_order_count) ?? 0,
      calibrationOverdueCount: asNumber(profile.calibration_overdue_count) ?? 0,
      riskSummary: typeof profile.risk_summary === "string" ? profile.risk_summary : null,
      priorityAction:
        typeof profile.priority_action === "string" ? profile.priority_action : null,
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
    name: typeof row.name === "string" ? row.name : "Unnamed equipment",
    assetNumber:
      typeof row.equipment_code === "string"
        ? row.equipment_code
        : String(row.id).slice(0, 8).toUpperCase(),
    type: String(row.equipment_type ?? "Equipment").toUpperCase(),
    area: typeof row.area === "string" ? row.area : "—",
    oem: typeof row.oem === "string" ? row.oem : "—",
    model: typeof row.model === "string" ? row.model : "—",
    criticality: typeof row.criticality === "string" ? row.criticality : "Unknown",
    status: typeof row.status === "string" ? row.status : "Unknown",
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    sourceSystem: typeof row.source_system === "string" ? row.source_system : "Unknown",
    sourceUpdatedAt:
      typeof row.source_updated_at === "string" ? row.source_updated_at : null,
    risk,
  };
}

const EQUIPMENT_SELECT = `
  id,
  site_id,
  equipment_code,
  name,
  equipment_type,
  area,
  oem,
  model,
  criticality,
  status,
  image_url,
  source_system,
  source_updated_at,
  equipment_risk_profiles (
    risk_score,
    risk_level,
    pm_backlog_pct,
    asset_criticality_pct,
    calibration_pct,
    skills_pct,
    spares_pct,
    notification_pct,
    overdue_pm_count,
    open_work_order_count,
    calibration_overdue_count,
    operational_risk_score,
    labour_risk_score,
    scheduled_engineer_count,
    qualified_engineer_count,
    missing_skill_count,
    labour_shift_date,
    labour_shift_type,
    no_engineer_override,
    risk_summary,
    priority_action,
    updated_at
  )
`;

export async function loadLiveEquipmentList(
  siteId: string,
): Promise<LiveDataState<LiveEquipmentListPayload>> {
  if (!siteId) {
    return { status: "unavailable", message: "No active site was supplied." };
  }

  try {
    const { data, error } = await supabase
      .from("equipment_assets")
      .select(EQUIPMENT_SELECT)
      .eq("site_id", siteId)
      .order("name");

    if (error) {
      return {
        status: "unavailable",
        message: `Active-site equipment records could not be loaded: ${error.message}`,
      };
    }
    if (!data || data.length === 0) {
      return {
        status: "empty",
        message: "No equipment records are configured for the active site.",
      };
    }

    const records: LiveEquipmentRecord[] = [];
    let excludedWithoutRiskProfile = 0;
    let excludedInvalidRiskProfile = 0;

    for (const raw of data as unknown as Record<string, unknown>[]) {
      const riskState = validateRiskProfile(firstProfile(raw));
      if (riskState.status === "empty") {
        excludedWithoutRiskProfile += 1;
        continue;
      }
      if (riskState.status === "unavailable") {
        excludedInvalidRiskProfile += 1;
        continue;
      }
      records.push(mapEquipment(raw, riskState.data));
    }

    if (records.length === 0) {
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
    return {
      status: "unavailable",
      message:
        error instanceof Error ? error.message : "Active-site equipment records could not be loaded.",
    };
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

    if (error) {
      return {
        status: "unavailable",
        message: `The active-site equipment record could not be verified: ${error.message}`,
      };
    }
    if (!data) {
      return {
        status: "empty",
        message: "This equipment does not belong to the authorised active site.",
      };
    }

    const row = data as unknown as Record<string, unknown>;
    const riskState = validateRiskProfile(firstProfile(row));
    if (riskState.status !== "ready") return riskState;
    return { status: "ready", data: mapEquipment(row, riskState.data) };
  } catch (error) {
    return {
      status: "unavailable",
      message:
        error instanceof Error ? error.message : "The active-site equipment record could not be verified.",
    };
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

    if (error) {
      return {
        status: "unavailable",
        message: `Live component inventory could not be loaded: ${error.message}`,
      };
    }
    if (!data || data.length === 0) {
      return {
        status: "empty",
        message:
          "No component inventory is configured for this equipment. Stock resilience is unavailable, not 100%.",
      };
    }

    const inventory: LiveComponent[] = data.map((row: Record<string, unknown>) => {
      const stock = Math.max(0, asNumber(row.quantity_available) ?? 0);
      const target = Math.max(0, asNumber(row.quantity_target) ?? 0);
      const minimum = Math.max(0, asNumber(row.minimum_quantity) ?? 0);
      const derivedStatus: LiveComponent["derivedStatus"] =
        stock <= 0
          ? "Out of stock"
          : stock < minimum
            ? "Low stock"
            : stock < target
              ? "Below target"
              : "Covered";
      return {
        name: String(row.component_name ?? "Unnamed component"),
        partNumber: String(row.component_code ?? "—"),
        stock,
        target,
        minimum,
        importedStatus: String(row.availability_status ?? ""),
        derivedStatus,
        supplier: String(row.vendor_name ?? "—"),
        manufacturer: String(row.maker_name ?? "—"),
        location: String(row.storage_location ?? "—"),
        criticality: String(row.criticality ?? "Unknown"),
        unitCost: Math.max(0, asNumber(row.unit_cost) ?? 0),
        leadDays: Math.max(0, asNumber(row.lead_days) ?? 0),
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
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
    return {
      status: "unavailable",
      message:
        error instanceof Error ? error.message : "Live component inventory could not be loaded.",
    };
  }
}

export async function loadLiveEquipmentWorkItems(
  equipmentId: string,
): Promise<LiveDataState<LiveWorkItem[]>> {
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_work_items", {
      p_equipment_id: equipmentId,
    });
    if (error) {
      return { status: "unavailable", message: `Work items could not be loaded: ${error.message}` };
    }
    const rows = asRows(data);
    if (rows.length === 0) {
      return { status: "empty", message: "No work orders are recorded for this equipment." };
    }
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
        requestedDate: typeof row.requested_date === "string" ? row.requested_date : null,
        dueDate: typeof row.due_date === "string" ? row.due_date : null,
        completedDate: typeof row.completed_date === "string" ? row.completed_date : null,
        ageLabel: String(row.age_label ?? "—"),
        overdue: row.is_overdue === true,
        pmNumber: typeof row.pm_number === "string" ? row.pm_number : null,
        pmTitle: typeof row.pm_title === "string" ? row.pm_title : null,
        pmType: typeof row.pm_type === "string" ? row.pm_type : null,
        pmStatus: typeof row.pm_status === "string" ? row.pm_status : null,
        pmNextDueDate: typeof row.pm_next_due_date === "string" ? row.pm_next_due_date : null,
        notificationNumber:
          typeof row.notification_number === "string" ? row.notification_number : null,
        orderTypeCode: typeof row.order_type_code === "string" ? row.order_type_code : null,
        orderTypeDescription:
          typeof row.order_type_description === "string" ? row.order_type_description : null,
        orderOrigin: typeof row.order_origin === "string" ? row.order_origin : null,
      })),
    };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Work items could not be loaded.",
    };
  }
}

export async function loadLiveEquipmentCalibrations(
  equipmentId: string,
): Promise<LiveDataState<LiveCalibration[]>> {
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_calibrations", {
      p_equipment_id: equipmentId,
    });
    if (error) {
      return { status: "unavailable", message: `Calibrations could not be loaded: ${error.message}` };
    }
    const rows = asRows(data);
    if (rows.length === 0) {
      return { status: "empty", message: "No calibration records are configured for this equipment." };
    }
    return {
      status: "ready",
      data: rows.map((row) => ({
        id: String(row.calibration_id ?? row.calibration_number ?? ""),
        number: String(row.calibration_number ?? "—"),
        title: String(row.title ?? "Calibration"),
        point: typeof row.calibration_point === "string" ? row.calibration_point : null,
        tolerance:
          typeof row.tolerance_specification === "string"
            ? row.tolerance_specification
            : null,
        lastCompletedDate:
          typeof row.last_completed_date === "string" ? row.last_completed_date : null,
        nextDueDate: typeof row.next_due_date === "string" ? row.next_due_date : null,
        scheduleStatus: String(row.schedule_status ?? "Unknown"),
        criticality: typeof row.criticality === "string" ? row.criticality : null,
        assignedEngineer:
          typeof row.assigned_engineer === "string" ? row.assigned_engineer : null,
        procedureReference:
          typeof row.procedure_reference === "string" ? row.procedure_reference : null,
        checklistReference:
          typeof row.checklist_reference === "string" ? row.checklist_reference : null,
        lastResult: typeof row.last_result === "string" ? row.last_result : null,
        resultAt: typeof row.result_at === "string" ? row.result_at : null,
        certificateReference:
          typeof row.certificate_reference === "string" ? row.certificate_reference : null,
        linkedWorkOrderNumber:
          typeof row.linked_work_order_number === "string"
            ? row.linked_work_order_number
            : null,
        linkedWorkOrderStatus:
          typeof row.linked_work_order_status === "string"
            ? row.linked_work_order_status
            : null,
        linkedWorkOrderDueDate:
          typeof row.linked_work_order_due_date === "string"
            ? row.linked_work_order_due_date
            : null,
        riskState: typeof row.risk_state === "string" ? row.risk_state : null,
      })),
    };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Calibrations could not be loaded.",
    };
  }
}

export async function loadLiveEquipmentSkills(
  equipmentId: string,
): Promise<LiveDataState<LiveSkillsPayload>> {
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_skills_showcase", {
      p_equipment_id: equipmentId,
    });
    if (error) {
      return { status: "unavailable", message: `Skills evidence could not be loaded: ${error.message}` };
    }
    const row = asRows(data)[0];
    if (!row) {
      return { status: "empty", message: "No skills evidence is configured for this equipment." };
    }
    return {
      status: "ready",
      data: {
        requiredSkillCount: asNumber(row.required_skill_count) ?? 0,
        primarySmeCount: asNumber(row.primary_sme_count) ?? 0,
        backupSmeCount: asNumber(row.backup_sme_count) ?? 0,
        developingBackupCount: asNumber(row.developing_backup_count) ?? 0,
        peopleResilienceScore: asNumber(row.people_resilience_score) ?? 0,
        requiredSkills: asRows(row.required_skills),
        engineers: asRows(row.engineers),
        operators: asRows(row.operators),
        developmentPaths: asRows(row.development_paths),
        shiftCoverage: asRows(row.shift_coverage),
      },
    };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Skills evidence could not be loaded.",
    };
  }
}

export async function loadLiveEquipmentNotifications(
  equipmentId: string,
): Promise<LiveDataState<LiveNotification[]>> {
  try {
    const { data, error } = await supabase.rpc("vorta_get_equipment_notifications", {
      p_equipment_id: equipmentId,
    });
    if (error) {
      return {
        status: "unavailable",
        message: `Maintenance notifications could not be loaded: ${error.message}`,
      };
    }
    const rows = asRows(data);
    if (rows.length === 0) {
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
        typeCode:
          typeof row.notification_type_code === "string" ? row.notification_type_code : null,
        typeDescription:
          typeof row.notification_type_description === "string"
            ? row.notification_type_description
            : null,
        shortText: String(row.short_text ?? "Maintenance notification"),
        longText: typeof row.long_text === "string" ? row.long_text : null,
        priorityCode: typeof row.priority_code === "string" ? row.priority_code : null,
        priorityDescription:
          typeof row.priority_description === "string" ? row.priority_description : null,
        sourceStatus: String(row.source_status ?? "Unknown"),
        workflowStatus: String(row.workflow_status ?? "Unknown"),
        breakdownIndicator: row.breakdown_indicator === true,
        reportedBy: typeof row.reported_by === "string" ? row.reported_by : null,
        requiredStartDate:
          typeof row.required_start_date === "string" ? row.required_start_date : null,
        requiredEndDate:
          typeof row.required_end_date === "string" ? row.required_end_date : null,
        reportedAt: typeof row.reported_at === "string" ? row.reported_at : null,
        ageDays: asNumber(row.age_days) ?? 0,
        riskPoints: asNumber(row.risk_points) ?? 0,
        riskReason: typeof row.risk_reason === "string" ? row.risk_reason : null,
        linkedWorkOrderNumber:
          typeof row.linked_work_order_number === "string"
            ? row.linked_work_order_number
            : null,
        linkedWorkOrderStatus:
          typeof row.linked_work_order_status === "string"
            ? row.linked_work_order_status
            : null,
        linkedWorkOrderPriority:
          typeof row.linked_work_order_priority === "string"
            ? row.linked_work_order_priority
            : null,
        linkedWorkOrderDueDate:
          typeof row.linked_work_order_due_date === "string"
            ? row.linked_work_order_due_date
            : null,
        linkedWorkOrderOverdue: row.linked_work_order_overdue === true,
      })),
    };
  } catch (error) {
    return {
      status: "unavailable",
      message:
        error instanceof Error ? error.message : "Maintenance notifications could not be loaded.",
    };
  }
}
