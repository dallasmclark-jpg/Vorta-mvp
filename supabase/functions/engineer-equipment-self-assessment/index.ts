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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...(origin && allowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function roleKey(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
}

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
    const equipmentId = typeof payload?.equipmentId === "string" ? payload.equipmentId.trim() : "";
    const assessmentLevel = Number(payload?.assessmentLevel);
    const evidenceReference = typeof payload?.evidenceReference === "string" ? payload.evidenceReference.trim().slice(0, 1000) : "";
    const notes = typeof payload?.notes === "string" ? payload.notes.trim().slice(0, 2000) : "";
    if (!equipmentId || !Number.isInteger(assessmentLevel) || assessmentLevel < 1 || assessmentLevel > 5) {
      return json(req, { error: "Equipment and a proposed competency level from 1 to 5 are required" }, 400);
    }

    const db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,organisation_id,role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.organisation_id) return json(req, { error: "Engineer profile access could not be verified" }, 403);

    const { data: engineer, error: engineerError } = await db
      .from("engineers")
      .select("id,full_name,site_id,organisation_id,profile_id")
      .eq("profile_id", user.id)
      .eq("organisation_id", profile.organisation_id)
      .maybeSingle();
    if (engineerError || !engineer?.site_id) return json(req, { error: "No engineer record is linked to this account" }, 403);

    const { data: accessRows, error: accessError } = await db
      .from("user_site_access")
      .select("app_role,active")
      .eq("user_id", user.id)
      .eq("site_id", engineer.site_id)
      .eq("organisation_id", profile.organisation_id)
      .eq("active", true)
      .limit(1);
    if (accessError) throw accessError;
    if (!accessRows?.[0] || roleKey(accessRows[0].app_role) !== "engineer") {
      return json(req, { error: "Active engineer access to this site is required" }, 403);
    }

    const { data: equipment, error: equipmentError } = await db
      .from("equipment_assets")
      .select("id,name,equipment_code,site_id")
      .eq("id", equipmentId)
      .eq("site_id", engineer.site_id)
      .maybeSingle();
    if (equipmentError || !equipment) return json(req, { error: "Equipment is not available in the authorised site" }, 404);

    const { data: result, error: submitError } = await db.rpc("vorta_submit_equipment_competency_self_assessment", {
      p_site_id: engineer.site_id,
      p_equipment_id: equipment.id,
      p_engineer_id: engineer.id,
      p_profile_id: user.id,
      p_assessment_level: assessmentLevel,
      p_evidence_reference: evidenceReference || null,
      p_notes: notes || null,
    });
    if (submitError) throw submitError;

    return json(req, {
      assessment: result,
      equipment: { id: equipment.id, name: equipment.name, equipmentCode: equipment.equipment_code },
      engineer: { id: engineer.id, name: engineer.full_name },
      pendingIndependentReview: true,
      authoritativeCapabilityUnchanged: true,
    });
  } catch (error) {
    console.error("engineer-equipment-self-assessment failed", error);
    return json(req, { error: "Equipment competency proposal could not be saved" }, 500);
  }
});
