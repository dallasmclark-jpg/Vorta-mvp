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
const MANAGER_ROLES = new Set([
  "vorta_admin",
  "site_admin",
  "maintenance_manager",
  "engineering_manager",
  "reliability_engineer",
  "team_leader",
]);
function roleKey(value: unknown): string { return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : ""; }
function allowedOrigin(origin: string | null): boolean { if (!origin) return true; return ORIGINS.has(origin) || /^https:\/\/deploy-preview-\d+--vorta-app\.netlify\.app$/.test(origin); }
function headers(req: Request): Record<string, string> { const origin = req.headers.get("origin"); return { "Content-Type": "application/json", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey", "Access-Control-Max-Age": "86400", Vary: "Origin", ...(origin && allowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}) }; }
function json(req: Request, body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: headers(req) }); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: allowedOrigin(req.headers.get("origin")) ? 204 : 403, headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

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

    const payload = await req.json().catch(() => ({}));
    const assessmentId = typeof payload?.assessmentId === "string" ? payload.assessmentId.trim() : "";
    const action = payload?.action === "reject" ? "reject" : "validate";
    let equipmentId = typeof payload?.equipmentId === "string" ? payload.equipmentId.trim() : "";
    let engineerId = typeof payload?.engineerId === "string" ? payload.engineerId.trim() : "";
    let assessmentLevel = Number(payload?.assessmentLevel);
    let evidenceReference = typeof payload?.evidenceReference === "string" ? payload.evidenceReference.trim().slice(0, 1000) : null;
    let notes = typeof payload?.notes === "string" ? payload.notes.trim().slice(0, 2000) : null;

    const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await db.from("profiles").select("id,organisation_id,role").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.organisation_id) return json(req, { error: "Portal access could not be verified" }, 403);

    let pendingAssessment: any = null;
    if (assessmentId) {
      const { data, error } = await db
        .from("equipment_competency_assessments")
        .select("id,site_id,equipment_id,engineer_id,assessment_level,assessment_status,evidence_reference,notes,assessor_profile_id")
        .eq("id", assessmentId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(req, { error: "Pending assessment was not found" }, 404);
      if (data.assessment_status !== "pending") return json(req, { error: "This competency proposal is no longer pending" }, 409);
      pendingAssessment = data;
      equipmentId = String(data.equipment_id);
      engineerId = String(data.engineer_id);
      assessmentLevel = Number(data.assessment_level);
      evidenceReference = evidenceReference || data.evidence_reference || null;
      notes = notes || data.notes || null;
    }

    if (!equipmentId || !engineerId || !Number.isInteger(assessmentLevel) || assessmentLevel < 1 || assessmentLevel > 5) {
      return json(req, { error: "Equipment, engineer and an assessment level from 1 to 5 are required" }, 400);
    }
    if (action === "reject" && !assessmentId) return json(req, { error: "A pending assessment is required for rejection" }, 400);

    const { data: equipment, error: equipmentError } = await db.from("equipment_assets").select("id,site_id,name,equipment_code").eq("id", equipmentId).maybeSingle();
    if (equipmentError || !equipment?.site_id) return json(req, { error: "Equipment was not found" }, 404);
    const { data: site, error: siteError } = await db.from("sites").select("id,organisation_id").eq("id", equipment.site_id).maybeSingle();
    if (siteError || !site || site.organisation_id !== profile.organisation_id) return json(req, { error: "Equipment access could not be verified" }, 403);
    if (pendingAssessment && pendingAssessment.site_id !== equipment.site_id) return json(req, { error: "Pending assessment site does not match the equipment" }, 409);

    const { data: targetEngineer, error: targetError } = await db.from("engineers").select("id,full_name,site_id,organisation_id,profile_id").eq("id", engineerId).maybeSingle();
    if (targetError || !targetEngineer || targetEngineer.site_id !== equipment.site_id || targetEngineer.organisation_id !== profile.organisation_id) return json(req, { error: "Target engineer is not assigned to this site" }, 400);

    const { data: accessRows, error: accessError } = await db.from("user_site_access").select("site_id,organisation_id,app_role,active").eq("user_id", user.id).eq("site_id", equipment.site_id).eq("organisation_id", profile.organisation_id).eq("active", true).limit(1);
    if (accessError) return json(req, { error: "Site access could not be verified" }, 403);
    const access = accessRows?.[0] ?? null;
    const role = roleKey(access?.app_role ?? profile.role);

    const { data: assessorEngineer } = await db.from("engineers").select("id,full_name,site_id,organisation_id").eq("profile_id", user.id).eq("site_id", equipment.site_id).eq("organisation_id", profile.organisation_id).maybeSingle();
    if (assessorEngineer?.id === engineerId || pendingAssessment?.assessor_profile_id === user.id) return json(req, { error: "Engineers cannot review their own equipment competency proposal" }, 403);

    let assessorAuthority = "";
    const assessorEngineerId: string | null = assessorEngineer?.id ?? null;
    if (access && MANAGER_ROLES.has(role)) {
      assessorAuthority = role.toUpperCase();
    } else {
      if (!assessorEngineer?.id) return json(req, { error: "Authorised manager or qualified peer access is required" }, 403);
      const { data: peerCapability, error: peerError } = await db.from("equipment_engineer_capabilities").select("competency_level,capability_status,validation_status,practice_authority,valid_from,valid_until").eq("equipment_id", equipmentId).eq("engineer_id", assessorEngineer.id).maybeSingle();
      if (peerError || !peerCapability) return json(req, { error: "You are not a validated assessor for this equipment" }, 403);
      const today = new Date().toISOString().slice(0, 10);
      const current = peerCapability.capability_status === "ACTIVE" && peerCapability.validation_status === "VALIDATED" && (!peerCapability.valid_from || peerCapability.valid_from <= today) && (!peerCapability.valid_until || peerCapability.valid_until >= today);
      const authorityOkay = assessmentLevel >= 4 ? peerCapability.practice_authority === "AUTHORISER" : ["INDEPENDENT", "AUTHORISER"].includes(peerCapability.practice_authority);
      if (!current || Number(peerCapability.competency_level) < assessmentLevel || !authorityOkay) return json(req, { error: "Your validated equipment level or practice authority is not sufficient for this assessment" }, 403);
      assessorAuthority = "QUALIFIED_PEER";
    }

    if (action === "reject") {
      const { data: result, error: rejectError } = await db.rpc("vorta_reject_equipment_competency_self_assessment", {
        p_assessment_id: assessmentId,
        p_reviewer_profile_id: user.id,
        p_reviewer_engineer_id: assessorEngineerId,
        p_review_notes: notes,
      });
      if (rejectError) throw rejectError;
      return json(req, { assessment: result, action: "rejected", assessorAuthority, scoreRefreshed: false });
    }

    const { data: result, error: applyError } = await db.rpc("vorta_apply_equipment_competency_assessment", {
      p_site_id: equipment.site_id,
      p_equipment_id: equipmentId,
      p_engineer_id: engineerId,
      p_assessor_profile_id: user.id,
      p_assessor_engineer_id: assessorEngineerId,
      p_assessment_level: assessmentLevel,
      p_assessor_authority: assessorAuthority,
      p_evidence_reference: evidenceReference,
      p_notes: notes,
    });
    if (applyError) throw applyError;

    const { error: refreshError } = await db.rpc("vorta_refresh_engineer_equipment_scores", { p_site_id: equipment.site_id });
    if (refreshError) console.error("equipment score refresh failed after assessment", refreshError);

    return json(req, {
      assessment: result,
      action: "validated",
      equipment: { id: equipment.id, name: equipment.name, equipmentCode: equipment.equipment_code },
      engineer: { id: targetEngineer.id, name: targetEngineer.full_name },
      assessorAuthority,
      scoreRefreshed: !refreshError,
    });
  } catch (error) {
    console.error("equipment-competency-assessment failed", error);
    return json(req, { error: "Equipment competency review could not be saved" }, 500);
  }
});
