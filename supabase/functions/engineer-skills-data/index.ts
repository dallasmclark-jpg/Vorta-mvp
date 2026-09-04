import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://vorta-app.netlify.app",
  "https://main--vorta-app.netlify.app",
  "https://pilot-live--vorta-app.netlify.app",
  "https://vorta.network",
  "https://www.vorta.network",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function allowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return ORIGINS.has(origin) || /^https:\/\/deploy-preview-\d+--vorta-app\.netlify\.app$/.test(origin);
}

function headers(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...(origin && allowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: allowedOrigin(req.headers.get("origin")) ? 204 : 403, headers: headers(req) });
  if (!["GET", "POST"].includes(req.method)) return json(req, { error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization || !url || !anonKey || !serviceRoleKey) return json(req, { error: "Authentication required" }, 401);

    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userResult, error: userError } = await authClient.auth.getUser(token);
    const user = userResult.user;
    if (userError || !user) return json(req, { error: "Authentication could not be verified" }, 401);

    const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await db.from("profiles").select("id,organisation_id,role").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.organisation_id) return json(req, { error: "Engineer profile access could not be verified" }, 403);

    const { data: engineer, error: engineerError } = await db
      .from("engineers")
      .select("id,full_name,avatar_url,discipline,shift_pattern,availability_status,department_id,site_id,organisation_id,profile_id")
      .eq("profile_id", user.id)
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();
    if (engineerError || !engineer?.id || !engineer.site_id) return json(req, { error: "No engineer record is linked to this account" }, 403);

    const siteId = engineer.site_id as string;
    const { data: equipmentRows, error: equipmentError } = await db
      .from("equipment_assets")
      .select("id,equipment_code,name,equipment_type,area,line,criticality,status")
      .eq("site_id", siteId)
      .order("area")
      .order("name");
    if (equipmentError) throw equipmentError;
    const equipment = equipmentRows ?? [];
    const equipmentIds = equipment.map((row: any) => row.id);

    const [assignmentsResult, requirementsResult, scoresResult] = await Promise.all([
      db.from("engineer_skills")
        .select("engineer_id,skill_id,self_rating,manager_rating,validated_rating,target_rating,years_experience,last_used_date,expiry_date,last_validated_at,verification_status,training_required,practice_authority,priority_level,evidence,evidence_url")
        .eq("engineer_id", engineer.id),
      equipmentIds.length
        ? db.from("equipment_required_skills")
            .select("equipment_id,skill_id,required_level,criticality,minimum_qualified_engineers,execution_authority,validation_required")
            .in("equipment_id", equipmentIds)
        : Promise.resolve({ data: [], error: null }),
      equipmentIds.length
        ? db.from("engineer_equipment_score_snapshots")
            .select("engineer_id,equipment_id,score_version,vorta_score,score_status,evidence_confidence,confidence_score,evidence_coverage_pct,skill_score,training_score,corrective_score,pm_score,calibration_score,required_skill_count,corrective_order_count,pm_order_count,calibration_order_count,latest_evidence_at,component_detail,calculated_at")
            .eq("site_id", siteId)
            .eq("engineer_id", engineer.id)
            .eq("score_version", "vorta-equipment-v1")
            .in("equipment_id", equipmentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const detailError = assignmentsResult.error ?? requirementsResult.error ?? scoresResult.error;
    if (detailError) throw detailError;

    const assignments = assignmentsResult.data ?? [];
    const requirements = requirementsResult.data ?? [];
    const skillIds = [...new Set([
      ...assignments.map((row: any) => row.skill_id),
      ...requirements.map((row: any) => row.skill_id),
    ].filter(Boolean))];
    const skillsResult = skillIds.length
      ? await db.from("skills").select("id,name,category,subcategory,description,is_critical,skill_type,ai_weight").in("id", skillIds)
      : { data: [], error: null };
    if (skillsResult.error) throw skillsResult.error;

    const scoreMap = new Map((scoresResult.data ?? []).map((row: any) => [String(row.equipment_id), row]));
    const requirementMap = new Map<string, any[]>();
    for (const row of requirements) {
      const key = String((row as any).equipment_id);
      const current = requirementMap.get(key) ?? [];
      current.push(row);
      requirementMap.set(key, current);
    }
    const assignmentMap = new Map(assignments.map((row: any) => [String(row.skill_id), row]));
    const skillMap = new Map((skillsResult.data ?? []).map((row: any) => [String(row.id), row]));

    const equipmentProfiles = equipment.map((asset: any) => {
      const requiredSkills = (requirementMap.get(String(asset.id)) ?? []).map((requirement: any) => {
        const assignment: any = assignmentMap.get(String(requirement.skill_id));
        const skill: any = skillMap.get(String(requirement.skill_id));
        const effectiveLevel = assignment?.verification_status === "validated" && assignment?.validated_rating != null
          ? assignment.validated_rating
          : assignment?.manager_rating ?? assignment?.self_rating ?? null;
        return {
          skillId: requirement.skill_id,
          name: skill?.name ?? "Unknown skill",
          category: skill?.category ?? "General",
          requiredLevel: requirement.required_level ?? 1,
          criticality: requirement.criticality,
          selfLevel: assignment?.self_rating ?? null,
          managerLevel: assignment?.manager_rating ?? null,
          verifiedLevel: assignment?.validated_rating ?? null,
          effectiveLevel,
          verificationStatus: assignment?.verification_status ?? "not_uploaded",
          trainingRequired: Boolean(assignment?.training_required),
        };
      });
      return { equipment: asset, score: scoreMap.get(String(asset.id)) ?? null, requiredSkills };
    });

    return json(req, {
      siteId,
      organisationId: profile.organisation_id,
      engineer,
      engineers: [engineer],
      heatmapAssignments: assignments,
      heatmapSkills: skillsResult.data ?? [],
      equipment,
      requirements,
      equipmentScores: scoresResult.data ?? [],
      equipmentProfiles,
      scoreModel: {
        version: "vorta-equipment-v1",
        weights: { verifiedSkills: 25, training: 20, corrective: 25, pm: 20, calibration: 10 },
        authorityOrder: ["validated", "manager", "self"],
        selfEvidenceFactor: 0.45,
        managerEvidenceFactor: 0.80,
        validatedEvidenceFactor: 1.0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("engineer-skills-data failed", error);
    return json(req, { error: "Engineer skills data could not be loaded" }, 500);
  }
});
