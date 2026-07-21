import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";
import { build } from "./transform.ts";

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);
    const [gapsResult, departmentsResult, engineersResult] = await Promise.all([
      db.from("skill_gap_snapshots")
        .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation,snapshot_date")
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId),
      db.from("departments")
        .select("id,name")
        .eq("site_id", siteId),
      db.from("engineers")
        .select("id,full_name")
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId)
        .order("full_name"),
    ]);
    const baseError = gapsResult.error ?? departmentsResult.error ?? engineersResult.error;
    if (baseError) throw baseError;

    const engineers = engineersResult.data ?? [];
    const engineerIds = engineers.map((row: any) => row.id);
    const assignmentsResult = engineerIds.length
      ? await db.from("engineer_skills")
          .select("engineer_id,skill_id,validated_rating,manager_rating,self_rating,training_required,verification_status,expiry_date")
          .in("engineer_id", engineerIds)
      : { data: [], error: null };
    if (assignmentsResult.error) throw assignmentsResult.error;

    const skillIds = [...new Set([
      ...(gapsResult.data ?? []).map((row: any) => row.skill_id),
      ...(assignmentsResult.data ?? []).map((row: any) => row.skill_id),
    ].filter(Boolean))];
    const skillsResult = skillIds.length
      ? await db.from("skills")
          .select("id,name,category,is_critical,certification_required,skill_type")
          .in("id", skillIds)
      : { data: [], error: null };
    if (skillsResult.error) throw skillsResult.error;

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
      ...build({
        gaps: gapsResult.data ?? [],
        departments: departmentsResult.data ?? [],
        engineers,
        assignments: assignmentsResult.data ?? [],
        skills: skillsResult.data ?? [],
      }),
    });
  } catch (error) {
    const status = Number((error as any)?.status) || 500;
    if (status >= 500) console.error("requirements-data failed", error);
    return response(
      req,
      {
        error: status < 500
          ? String((error as any)?.message ?? "Access denied")
          : "Requirements data could not be loaded",
      },
      status,
    );
  }
});
