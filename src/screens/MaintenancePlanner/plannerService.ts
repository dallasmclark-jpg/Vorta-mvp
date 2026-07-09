import { supabase } from "../../lib/supabaseClient";

export interface ResourceStrategyRow {
  role: string;
  engineersRequired: number;
  estimatedHours: number;
  internalCovered: number;
  contractorRequired: boolean;
}

export interface PlannerReadinessScore {
  area: string;
  proposedDate: string;
  proposedShift: string;
  readinessScore: number;
  readinessLevel: string;
  labourRequiredHours: number;
  labourAvailableHours: number;
  labourStatus: string;
  skillsRequired: number;
  skillsCovered: number;
  skillsStatus: string;
  sparesRequired: number;
  sparesReady: number;
  sparesStatus: string;
  workloadClashHours: number;
  warnings: string[];
  recommendation: string | null;
  resourceStrategy: ResourceStrategyRow[];
  contractorRequired: boolean;
  contractorRecommendation: string | null;
}

export interface PlannerDailyResourceLoad {
  area: string;
  loadDate: string;
  shift: string;
  resourceName: string;
  resourceType: "Internal" | "Contractor";
  primarySkill: string;
  plannedHours: number;
  capacityHours: number;
  availableHours: number;
  trainedForSelectedWork: boolean;
  status: string;
  assignedWorkRefs: string[];
  notes: string | null;
}

export async function getPlannerReadinessScores(area?: string): Promise<PlannerReadinessScore[]> {
  let query = supabase
    .from("planner_readiness_scores")
    .select(`
      area,
      proposed_date,
      proposed_shift,
      readiness_score,
      readiness_level,
      labour_required_hours,
      labour_available_hours,
      labour_status,
      skills_required,
      skills_covered,
      skills_status,
      spares_required,
      spares_ready,
      spares_status,
      workload_clash_hours,
      warnings,
      recommendation,
      resource_strategy,
      contractor_required,
      contractor_recommendation
    `)
    .order("proposed_date", { ascending: true });

  if (area) query = query.eq("area", area);

  const { data, error } = await query;

  if (error || !data) {
    if (error) console.warn("planner_readiness_scores fetch failed:", error.message);
    return [];
  }

  return data.map((row) => ({
    area: row.area,
    proposedDate: row.proposed_date,
    proposedShift: row.proposed_shift,
    readinessScore: row.readiness_score ?? 0,
    readinessLevel: row.readiness_level ?? "Unknown",
    labourRequiredHours: Number(row.labour_required_hours ?? 0),
    labourAvailableHours: Number(row.labour_available_hours ?? 0),
    labourStatus: row.labour_status ?? "Unknown",
    skillsRequired: row.skills_required ?? 0,
    skillsCovered: row.skills_covered ?? 0,
    skillsStatus: row.skills_status ?? "Unknown",
    sparesRequired: row.spares_required ?? 0,
    sparesReady: row.spares_ready ?? 0,
    sparesStatus: row.spares_status ?? "Unknown",
    workloadClashHours: Number(row.workload_clash_hours ?? 0),
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    recommendation: row.recommendation ?? null,
    resourceStrategy: Array.isArray(row.resource_strategy) ? row.resource_strategy : [],
    contractorRequired: row.contractor_required ?? false,
    contractorRecommendation: row.contractor_recommendation ?? null,
  }));
}

export async function getPlannerDailyResourceLoad(
  area: string,
  loadDate: string,
  shift: string,
): Promise<PlannerDailyResourceLoad[]> {
  const { data, error } = await supabase
    .from("planner_daily_resource_load")
    .select(`
      area,
      load_date,
      shift,
      resource_name,
      resource_type,
      primary_skill,
      planned_hours,
      capacity_hours,
      available_hours,
      trained_for_selected_work,
      status,
      assigned_work_refs,
      notes
    `)
    .eq("area", area)
    .eq("load_date", loadDate)
    .eq("shift", shift)
    .order("resource_type", { ascending: true })
    .order("resource_name", { ascending: true });

  if (error || !data) {
    if (error) console.warn("planner_daily_resource_load fetch failed:", error.message);
    return [];
  }

  return data.map((row) => ({
    area: row.area,
    loadDate: row.load_date,
    shift: row.shift,
    resourceName: row.resource_name,
    resourceType: row.resource_type as "Internal" | "Contractor",
    primarySkill: row.primary_skill,
    plannedHours: Number(row.planned_hours ?? 0),
    capacityHours: Number(row.capacity_hours ?? 0),
    availableHours: Number(row.available_hours ?? 0),
    trainedForSelectedWork: Boolean(row.trained_for_selected_work),
    status: row.status ?? "Unknown",
    assignedWorkRefs: Array.isArray(row.assigned_work_refs) ? row.assigned_work_refs : [],
    notes: row.notes ?? null,
  }));
}
