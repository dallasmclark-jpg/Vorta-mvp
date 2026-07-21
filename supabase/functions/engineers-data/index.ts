import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";
import { buildEngineerPayload } from "./transform.ts";

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);
    const [engineersResult, departmentsResult, sitesResult, gapsResult] = await Promise.all([
      db
        .from("engineers")
        .select(
          "id,full_name,employment_type,discipline,availability_status,verified,shift_pattern,department_id,site_id",
        )
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId)
        .order("full_name"),
      db.from("departments").select("id,name").eq("site_id", siteId),
      db.from("sites").select("id,name,region").eq("id", siteId),
      db
        .from("skill_gap_snapshots")
        .select(
          "id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation,snapshot_date",
        )
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId),
    ]);

    const firstError =
      engineersResult.error ??
      departmentsResult.error ??
      sitesResult.error ??
      gapsResult.error;
    if (firstError) throw firstError;

    const engineers = engineersResult.data ?? [];
    const engineerIds = engineers.map((row: { id: string }) => row.id);
    let assignments: Record<string, unknown>[] = [];
    let risks: Record<string, unknown>[] = [];
    let bookings: Record<string, unknown>[] = [];

    if (engineerIds.length > 0) {
      const [assignmentsResult, risksResult, bookingsResult] = await Promise.all([
        db
          .from("engineer_skills")
          .select(
            "engineer_id,skill_id,self_rating,manager_rating,validated_rating,training_required,verification_status,last_validated_at,expiry_date,years_experience",
          )
          .in("engineer_id", engineerIds),
        db
          .from("engineer_risk_profiles")
          .select("engineer_id,retirement_risk,leaving_risk,critical_knowledge_holder")
          .in("engineer_id", engineerIds),
        db
          .from("training_bookings")
          .select("engineer_id,course_id,status,booking_date")
          .eq("organisation_id", organisationId)
          .in("engineer_id", engineerIds),
      ]);

      const detailError =
        assignmentsResult.error ?? risksResult.error ?? bookingsResult.error;
      if (detailError) throw detailError;
      assignments = assignmentsResult.data ?? [];
      risks = risksResult.data ?? [];
      bookings = bookingsResult.data ?? [];
    }

    const skillIds = [
      ...new Set(
        [
          ...assignments.map((row: any) => row.skill_id),
          ...(gapsResult.data ?? []).map((row: any) => row.skill_id),
        ].filter(Boolean),
      ),
    ];
    const courseIds = [
      ...new Set(bookings.map((row: any) => row.course_id).filter(Boolean)),
    ];

    const [skillsResult, coursesResult] = await Promise.all([
      skillIds.length > 0
        ? db
            .from("skills")
            .select("id,name,category,is_critical,certification_required,skill_type")
            .in("id", skillIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length > 0
        ? db.from("training_courses").select("id,title").in("id", courseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (skillsResult.error || coursesResult.error) {
      throw skillsResult.error ?? coursesResult.error;
    }

    const payload = buildEngineerPayload({
      engineers,
      assignments,
      risks,
      bookings,
      courses: coursesResult.data ?? [],
      departments: departmentsResult.data ?? [],
      sites: sitesResult.data ?? [],
      gaps: gapsResult.data ?? [],
      skills: skillsResult.data ?? [],
    });

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
      ...payload,
    });
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status) || 500;
    if (status >= 500) console.error("engineers-data failed", error);
    return response(
      req,
      {
        error:
          status < 500
            ? String((error as { message?: unknown })?.message ?? "Access denied")
            : "Engineer data could not be loaded",
      },
      status,
    );
  }
});
