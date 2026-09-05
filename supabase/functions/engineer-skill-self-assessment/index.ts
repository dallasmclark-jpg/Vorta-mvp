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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: allowedOrigin(req.headers.get("origin")) ? 204 : 403, headers: headers(req) });
  }
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
    const skillId = typeof payload?.skillId === "string" ? payload.skillId.trim() : "";
    const selfRating = Number(payload?.selfRating);
    const evidence = typeof payload?.evidence === "string" ? payload.evidence.trim().slice(0, 2000) : "";
    const notes = typeof payload?.notes === "string" ? payload.notes.trim().slice(0, 2000) : "";
    if (!skillId || !Number.isInteger(selfRating) || selfRating < 1 || selfRating > 5) {
      return json(req, { error: "Skill and self-rating from 1 to 5 are required" }, 400);
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
      .select("id,site_id,organisation_id,profile_id")
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

    const { data: requiredRows, error: requiredError } = await db
      .from("equipment_required_skills")
      .select("skill_id,equipment_assets!inner(site_id)")
      .eq("skill_id", skillId)
      .eq("equipment_assets.site_id", engineer.site_id)
      .limit(1);
    if (requiredError) throw requiredError;
    if (!requiredRows?.length) return json(req, { error: "This skill is not part of the authorised site competency model" }, 400);

    const now = new Date().toISOString();
    const { data: saved, error: saveError } = await db
      .from("engineer_skills")
      .upsert({
        engineer_id: engineer.id,
        skill_id: skillId,
        self_rating: selfRating,
        verification_status: "pending",
        verified_by: null,
        verified_at: null,
        evidence: evidence || null,
        notes: notes || null,
        updated_at: now,
      }, { onConflict: "engineer_id,skill_id" })
      .select("engineer_id,skill_id,self_rating,verification_status,updated_at")
      .single();
    if (saveError) throw saveError;

    return json(req, {
      assessment: saved,
      pendingVerification: true,
      authoritativeRatingsUnchanged: true,
    });
  } catch (error) {
    console.error("engineer-skill-self-assessment failed", error);
    return json(req, { error: "Skill self-assessment could not be saved" }, 500);
  }
});
