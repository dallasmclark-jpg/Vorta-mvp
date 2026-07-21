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

    const [
      siteResult,
      engineersResult,
      departmentsResult,
      teamsResult,
      equipmentResult,
      gapsResult,
    ] = await Promise.all([
      db.from("sites")
        .select("id,name,updated_at")
        .eq("id", siteId)
        .maybeSingle(),
      db.from("engineers")
        .select("id,full_name,avatar_url,discipline,shift_pattern,availability_status,department_id,employment_type,updated_at")
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId)
        .order("full_name"),
      db.from("departments")
        .select("id,name")
        .eq("site_id", siteId)
        .order("name"),
      db.from("maintenance_shift_teams")
        .select("id,code,name,pattern_type,cycle_offset,active")
        .eq("site_id", siteId)
        .eq("active", true),
      db.from("equipment_assets")
        .select("id,equipment_code,name,area,criticality,status,department_id,updated_at")
        .eq("site_id", siteId),
      db.from("skill_gap_snapshots")
        .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,sme_engineer_id,risk_level,recommendation,snapshot_date")
        .eq("site_id", siteId)
        .eq("organisation_id", organisationId),
    ]);

    const baseError =
      siteResult.error ??
      engineersResult.error ??
      departmentsResult.error ??
      teamsResult.error ??
      equipmentResult.error ??
      gapsResult.error;
    if (baseError) throw baseError;

    const engineers = engineersResult.data ?? [];
    const engineerIds = engineers.map((row: any) => row.id);
    const teams = teamsResult.data ?? [];
    const teamIds = teams.map((row: any) => row.id);
    const equipment = equipmentResult.data ?? [];
    const equipmentIds = equipment.map((row: any) => row.id);

    const [
      assignmentsResult,
      risksResult,
      membersResult,
      requirementsResult,
      capabilitiesResult,
    ] = await Promise.all([
      engineerIds.length
        ? db.from("engineer_skills")
            .select("engineer_id,skill_id,validated_rating,manager_rating,self_rating,target_rating,years_experience,last_used_date,expiry_date,last_validated_at,verification_status,training_required,practice_authority,priority_level,evidence,evidence_url")
            .in("engineer_id", engineerIds)
        : Promise.resolve({ data: [], error: null }),
      engineerIds.length
        ? db.from("engineer_risk_profiles")
            .select("engineer_id,retirement_risk,leaving_risk,critical_knowledge_holder,reviewed_at")
            .in("engineer_id", engineerIds)
        : Promise.resolve({ data: [], error: null }),
      teamIds.length
        ? db.from("maintenance_shift_team_members")
            .select("team_id,engineer_id,active_from,active_to")
            .in("team_id", teamIds)
        : Promise.resolve({ data: [], error: null }),
      equipmentIds.length
        ? db.from("equipment_required_skills")
            .select("equipment_id,skill_id,required_level,criticality,minimum_qualified_engineers,execution_authority,validation_required,evidence_reference")
            .in("equipment_id", equipmentIds)
        : Promise.resolve({ data: [], error: null }),
      equipmentIds.length && engineerIds.length
        ? db.from("equipment_engineer_capabilities")
            .select("equipment_id,engineer_id,competency_level,capability_role,capability_status,practice_authority,validation_status,specialism,evidence_reference,valid_from,valid_until")
            .in("equipment_id", equipmentIds)
            .in("engineer_id", engineerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const detailError =
      assignmentsResult.error ??
      risksResult.error ??
      membersResult.error ??
      requirementsResult.error ??
      capabilitiesResult.error;
    if (detailError) throw detailError;

    const skillIds = [...new Set([
      ...(assignmentsResult.data ?? []).map((row: any) => row.skill_id),
      ...(requirementsResult.data ?? []).map((row: any) => row.skill_id),
      ...(gapsResult.data ?? []).map((row: any) => row.skill_id),
    ].filter(Boolean))];

    const skillsResult = skillIds.length
      ? await db.from("skills")
          .select("id,name,category,subcategory,description,is_critical,certification_required,expiry_required,display_order")
          .in("id", skillIds)
      : { data: [], error: null };
    if (skillsResult.error) throw skillsResult.error;

    const payload = build({
      generatedAt: new Date().toISOString(),
      site: siteResult.data ?? {
        id: siteId,
        name: "Maintenance site",
        updated_at: null,
      },
      engineers,
      departments: departmentsResult.data ?? [],
      shiftTeams: teams,
      shiftMembers: membersResult.data ?? [],
      assignments: assignmentsResult.data ?? [],
      risks: risksResult.data ?? [],
      equipment,
      requirements: requirementsResult.data ?? [],
      capabilities: capabilitiesResult.data ?? [],
      gaps: gapsResult.data ?? [],
      skills: skillsResult.data ?? [],
    });

    return response(req, {
      siteId,
      organisationId,
      ...payload,
    });
  } catch (error) {
    const status = Number((error as any)?.status) || 500;
    if (status >= 500) console.error("skills-matrix-data failed", error);
    return response(
      req,
      {
        error: status < 500
          ? String((error as any)?.message ?? "Access denied")
          : "Skills matrix data could not be loaded",
      },
      status,
    );
  }
});
