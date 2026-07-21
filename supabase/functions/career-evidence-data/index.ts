import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";

const COMPLETE_STATUSES = new Set(["complete", "completed", "met", "verified"]);
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function text(value: unknown, fallback = "Not recorded"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

Deno.serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  if (!['GET', 'POST'].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);

    const { data: engineerRows, error: engineerError } = await db
      .from("engineers")
      .select("id,full_name,avatar_url")
      .eq("site_id", siteId)
      .eq("organisation_id", organisationId)
      .order("full_name", { ascending: true });
    if (engineerError) throw engineerError;

    const engineerIds = (engineerRows ?? []).map((row) => row.id as string);
    const engineerById = new Map(
      (engineerRows ?? []).map((row) => [
        row.id as string,
        {
          name: text(row.full_name, "Engineer name unavailable"),
          avatarUrl: nullableText(row.avatar_url),
        },
      ]),
    );

    if (engineerIds.length === 0) {
      return response(req, {
        siteId,
        organisationId,
        generatedAt: new Date().toISOString(),
        stats: {
          activePathCount: 0,
          engineerCount: 0,
          averageReadiness: 0,
          readySoonCount: 0,
          requirementCount: 0,
          completedRequirementCount: 0,
        },
        paths: [],
        requirements: [],
      });
    }

    const { data: pathRows, error: pathError } = await db
      .from("engineer_career_paths")
      .select("id,engineer_id,current_job_role,target_job_role,path_name,pathway_category,readiness_score,estimated_timeframe,status,updated_at,evidence_items_required,evidence_items_completed,supervised_interventions_required,supervised_interventions_completed,target_completion_date,development_summary")
      .in("engineer_id", engineerIds)
      .order("readiness_score", { ascending: false })
      .order("updated_at", { ascending: false });
    if (pathError) throw pathError;

    const activePathRows = (pathRows ?? []).filter((row) => {
      const status = text(row.status, "active").toLowerCase();
      return status === "active";
    });
    const pathIds = activePathRows.map((row) => row.id as string);

    const { data: requirementRows, error: requirementError } = pathIds.length > 0
      ? await db
          .from("engineer_career_path_requirements")
          .select("id,career_path_id,requirement_type,name,current_level,target_level,status,priority,impact_score,evidence_required,notes,updated_at")
          .in("career_path_id", pathIds)
          .order("updated_at", { ascending: false })
      : { data: [], error: null };
    if (requirementError) throw requirementError;

    const pathById = new Map(
      activePathRows.map((row) => [row.id as string, row]),
    );
    const requirementCountByPath = new Map<string, number>();
    const completedCountByPath = new Map<string, number>();

    for (const row of requirementRows ?? []) {
      const pathId = row.career_path_id as string;
      requirementCountByPath.set(pathId, (requirementCountByPath.get(pathId) ?? 0) + 1);
      if (COMPLETE_STATUSES.has(text(row.status, "unknown").toLowerCase())) {
        completedCountByPath.set(pathId, (completedCountByPath.get(pathId) ?? 0) + 1);
      }
    }

    const paths = activePathRows.map((row) => {
      const engineer = engineerById.get(row.engineer_id as string);
      return {
        id: row.id as string,
        engineerId: row.engineer_id as string,
        engineerName: engineer?.name ?? "Engineer name unavailable",
        avatarUrl: engineer?.avatarUrl ?? null,
        currentJobRole: text(row.current_job_role),
        targetJobRole: text(row.target_job_role),
        pathName: text(row.path_name),
        pathwayCategory: text(row.pathway_category, "Unspecified"),
        readinessScore: Math.max(0, Math.min(100, numberValue(row.readiness_score))),
        estimatedTimeframe: nullableText(row.estimated_timeframe),
        status: text(row.status, "active"),
        updatedAt: text(row.updated_at, new Date(0).toISOString()),
        requirementCount: requirementCountByPath.get(row.id as string) ?? 0,
        completedRequirementCount: completedCountByPath.get(row.id as string) ?? 0,
        evidenceItemsRequired: numberValue(row.evidence_items_required),
        evidenceItemsCompleted: numberValue(row.evidence_items_completed),
        interventionsRequired: numberValue(row.supervised_interventions_required),
        interventionsCompleted: numberValue(row.supervised_interventions_completed),
        targetCompletionDate: nullableText(row.target_completion_date),
        developmentSummary: nullableText(row.development_summary),
      };
    });

    const requirements = (requirementRows ?? [])
      .map((row) => {
        const path = pathById.get(row.career_path_id as string);
        const engineer = path ? engineerById.get(path.engineer_id as string) : null;
        return {
          id: row.id as string,
          careerPathId: row.career_path_id as string,
          engineerName: engineer?.name ?? "Engineer name unavailable",
          name: text(row.name),
          requirementType: text(row.requirement_type, "unspecified"),
          currentLevel: row.current_level === null ? null : numberValue(row.current_level),
          targetLevel: row.target_level === null ? null : numberValue(row.target_level),
          status: text(row.status, "unknown"),
          priority: text(row.priority, "Unspecified"),
          impactScore: numberValue(row.impact_score),
          evidenceRequired: row.evidence_required === true,
          notes: nullableText(row.notes),
        };
      })
      .sort((a, b) => {
        const priorityDifference =
          (PRIORITY_ORDER[a.priority.toLowerCase()] ?? 9) -
          (PRIORITY_ORDER[b.priority.toLowerCase()] ?? 9);
        return priorityDifference || b.impactScore - a.impactScore;
      });

    const readinessTotal = paths.reduce((total, row) => total + row.readinessScore, 0);
    const completedRequirementCount = requirements.filter((row) =>
      COMPLETE_STATUSES.has(row.status.toLowerCase())
    ).length;

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
      stats: {
        activePathCount: paths.length,
        engineerCount: new Set(paths.map((row) => row.engineerId)).size,
        averageReadiness: paths.length ? readinessTotal / paths.length : 0,
        readySoonCount: paths.filter((row) => row.readinessScore >= 80).length,
        requirementCount: requirements.length,
        completedRequirementCount,
      },
      paths,
      requirements,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : "Career evidence could not be loaded";
    console.error("career-evidence-data", error);
    return response(req, { error: message }, status);
  }
});
