import { supabase } from "../../lib/supabaseClient";
import type {
  EquipmentComponentsResult,
  EquipmentListItem,
} from "./equipmentService";

export type LiveDataState<T> =
  | { status: "ready"; data: T }
  | { status: "empty"; message: string }
  | { status: "unavailable"; message: string };

export interface LiveEquipmentListPayload {
  items: EquipmentListItem[];
  excludedWithoutRiskProfile: number;
}

const riskSegments = [
  ["PM Backlog", "pm_backlog_pct", "#f97316", "bg-orange-500"],
  ["Asset Criticality", "asset_criticality_pct", "#dc2626", "bg-red-600"],
  ["Calibration", "calibration_pct", "#06b6d4", "bg-cyan-400"],
  ["Labour Coverage", "skills_pct", "#eab308", "bg-yellow-400"],
  ["Spares", "spares_pct", "#6366f1", "bg-indigo-500"],
] as const;

function firstRiskProfile(row: any): any | null {
  const raw = row?.equipment_risk_profiles;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function verifiedBreakdown(profile: any): EquipmentListItem["breakdown"] {
  return riskSegments
    .map(([label, key, color, dotClass]) => ({
      label,
      pct: Number(profile?.[key] ?? 0),
      color,
      dotClass,
    }))
    .filter((segment) => Number.isFinite(segment.pct) && segment.pct > 0);
}

function riskLevel(value: unknown): EquipmentListItem["riskLevel"] {
  return value === "Critical" ||
    value === "High" ||
    value === "Medium" ||
    value === "Low" ||
    value === "Minimal"
    ? value
    : "Minimal";
}

export async function loadLiveEquipmentList(): Promise<
  LiveDataState<LiveEquipmentListPayload>
> {
  try {
    const { data, error } = await supabase
      .from("equipment_assets")
      .select(`
        id,
        equipment_code,
        name,
        equipment_type,
        area,
        oem,
        criticality,
        status,
        equipment_risk_profiles (
          risk_score,
          risk_level,
          pm_backlog_pct,
          asset_criticality_pct,
          calibration_pct,
          skills_pct,
          spares_pct,
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
          no_engineer_override
        )
      `)
      .order("name");

    if (error) {
      return {
        status: "unavailable",
        message: `Live equipment records could not be loaded: ${error.message}`,
      };
    }

    if (!data || data.length === 0) {
      return {
        status: "empty",
        message: "No authorised equipment records are configured for this site.",
      };
    }

    let excludedWithoutRiskProfile = 0;
    const items: EquipmentListItem[] = [];

    for (const row of data as any[]) {
      const profile = firstRiskProfile(row);
      if (!profile) {
        excludedWithoutRiskProfile += 1;
        continue;
      }

      items.push({
        id: String(row.id),
        name: row.name ?? "Unnamed equipment",
        assetNumber: row.equipment_code ?? String(row.id).slice(0, 8).toUpperCase(),
        type: String(row.equipment_type ?? "Equipment").toUpperCase(),
        area: row.area ?? "—",
        riskScore: Number(profile.risk_score ?? 0),
        riskLevel: riskLevel(profile.risk_level),
        breakdown: verifiedBreakdown(profile),
        operationalRiskScore: Number(profile.operational_risk_score ?? 0),
        labourRiskScore: Number(profile.labour_risk_score ?? 0),
        scheduledEngineerCount: Number(profile.scheduled_engineer_count ?? 0),
        qualifiedEngineerCount: Number(profile.qualified_engineer_count ?? 0),
        missingSkillCount: Number(profile.missing_skill_count ?? 0),
        labourShiftDate: profile.labour_shift_date ?? null,
        labourShiftType: profile.labour_shift_type ?? null,
        noEngineerOverride: Boolean(profile.no_engineer_override),
        status: row.status ?? undefined,
        oem: row.oem ?? "—",
        criticality: row.criticality ?? "Unknown",
        overduePmCount: Number(profile.overdue_pm_count ?? 0),
        openWorkOrderCount: Number(profile.open_work_order_count ?? 0),
        calibrationOverdueCount: Number(
          profile.calibration_overdue_count ?? 0,
        ),
      });
    }

    if (items.length === 0) {
      return {
        status: "empty",
        message:
          "Equipment records exist, but none has a verified risk profile. Risk scores are withheld rather than generated from names or criticality.",
      };
    }

    items.sort((left, right) => right.riskScore - left.riskScore);
    return {
      status: "ready",
      data: { items, excludedWithoutRiskProfile },
    };
  } catch (error) {
    return {
      status: "unavailable",
      message:
        error instanceof Error
          ? error.message
          : "Live equipment records could not be loaded.",
    };
  }
}

export async function loadLiveEquipmentRiskProfile(
  equipmentId: string,
): Promise<LiveDataState<{ equipmentId: string }>> {
  try {
    const { data, error } = await supabase
      .from("equipment_risk_profiles")
      .select("equipment_id, risk_score, risk_level")
      .eq("equipment_id", equipmentId)
      .maybeSingle();

    if (error) {
      return {
        status: "unavailable",
        message: `Verified equipment risk could not be loaded: ${error.message}`,
      };
    }

    if (!data) {
      return {
        status: "empty",
        message:
          "This equipment has no verified risk profile. Vorta has not generated a replacement score or risk-driver breakdown.",
      };
    }

    return { status: "ready", data: { equipmentId: data.equipment_id } };
  } catch (error) {
    return {
      status: "unavailable",
      message:
        error instanceof Error
          ? error.message
          : "Verified equipment risk could not be loaded.",
    };
  }
}

export async function loadLiveEquipmentComponents(
  equipmentId: string,
): Promise<LiveDataState<EquipmentComponentsResult>> {
  try {
    const { data, error } = await supabase
      .from("equipment_components")
      .select(
        "component_name, component_code, quantity_available, quantity_target, minimum_quantity, availability_status, vendor_name, maker_name, storage_location, criticality, unit_cost, lead_days",
      )
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

    const inventory = data.map((row: any) => ({
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
      status: "ready",
      data: {
        inventory,
        criticalComponents,
        stockSummary: {
          totalComponents: inventory.length,
          outOfStock,
          lowStock,
          okStock: inventory.length - outOfStock - lowStock,
        },
      },
    };
  } catch (error) {
    return {
      status: "unavailable",
      message:
        error instanceof Error
          ? error.message
          : "Live component inventory could not be loaded.",
    };
  }
}
