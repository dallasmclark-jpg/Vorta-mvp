import { supabase } from "../../lib/supabaseClient";

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
      recommendation
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
  }));
}
