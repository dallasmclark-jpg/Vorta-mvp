import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://vorta-app.netlify.app",
  "https://main--vorta-app.netlify.app",
  "https://vorta.network",
  "https://www.vorta.network",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function normaliseRole(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";
}

function response(req: Request, body: unknown, status = 200): Response {
  const origin = req.headers.get("origin");
  const allowOrigin = origin && (ORIGINS.has(origin) || /^https:\/\/deploy-preview-\d+--vorta-app\.netlify\.app$/.test(origin));
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
      Vary: "Origin",
      ...(allowOrigin ? { "Access-Control-Allow-Origin": origin } : {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return response(req, null, 204);
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  const authorization = req.headers.get("authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !url || !anonKey) {
    return response(req, { error: "Authentication required" }, 401);
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await supabase.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) {
    return response(req, { error: "Authentication could not be verified" }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,organisation_id,role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.organisation_id) {
    return response(req, { error: "Engineer access could not be verified" }, 403);
  }

  const { data: accessRows, error: accessError } = await supabase
    .from("user_site_access")
    .select("site_id,organisation_id,app_role,is_default,created_at")
    .eq("user_id", user.id)
    .eq("organisation_id", profile.organisation_id)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (accessError) {
    return response(req, { error: "Engineer access could not be verified" }, 403);
  }

  const access = (accessRows ?? []).find(
    (row) => normaliseRole(row.app_role ?? profile.role) === "engineer",
  );
  if (!access?.site_id) {
    return response(req, { error: "Engineer role access is required" }, 403);
  }

  const { data: engineer, error: engineerError } = await supabase
    .from("engineers")
    .select("id,full_name,employment_type,discipline,availability_status,verified,shift_pattern,department_id,site_id,organisation_id,avatar_url")
    .eq("profile_id", user.id)
    .eq("site_id", access.site_id)
    .eq("organisation_id", access.organisation_id)
    .maybeSingle();
  if (engineerError) {
    return response(req, { error: "Engineer profile could not be loaded" }, 500);
  }
  if (!engineer?.id) {
    return response(
      req,
      {
        linked: false,
        error: "Engineer profile is not linked to this authenticated account",
      },
      409,
    );
  }

  const [assignmentResult, riskResult, bookingResult] = await Promise.all([
    supabase
      .from("engineer_skills")
      .select("engineer_id,skill_id,self_rating,manager_rating,validated_rating,training_required,verification_status,last_validated_at,expiry_date,years_experience")
      .eq("engineer_id", engineer.id),
    supabase
      .from("engineer_risk_profiles")
      .select("engineer_id,retirement_risk,leaving_risk,critical_knowledge_holder")
      .eq("engineer_id", engineer.id)
      .maybeSingle(),
    supabase
      .from("training_bookings")
      .select("id,engineer_id,course_id,status,requested_date,approved_at,booking_date,cost,currency")
      .eq("engineer_id", engineer.id)
      .order("booking_date", { ascending: false, nullsFirst: false }),
  ]);

  if (assignmentResult.error || riskResult.error || bookingResult.error) {
    console.error("engineer-self-data evidence query failed", {
      assignmentError: assignmentResult.error?.message,
      riskError: riskResult.error?.message,
      bookingError: bookingResult.error?.message,
    });
    return response(req, { error: "Engineer evidence could not be loaded" }, 500);
  }

  const assignments = assignmentResult.data ?? [];
  const skillIds = [...new Set(assignments.map((row) => row.skill_id).filter(Boolean))];
  let skills: unknown[] = [];
  if (skillIds.length > 0) {
    const skillResult = await supabase
      .from("skills")
      .select("id,name,category,is_critical,certification_required,skill_type")
      .in("id", skillIds);
    if (skillResult.error) {
      return response(req, { error: "Engineer skill metadata could not be loaded" }, 500);
    }
    skills = skillResult.data ?? [];
  }

  return response(req, {
    linked: true,
    scope: "self",
    siteId: access.site_id,
    organisationId: access.organisation_id,
    engineer,
    assignments,
    skills,
    risk: riskResult.data ?? null,
    bookings: bookingResult.data ?? [],
    generatedAt: new Date().toISOString(),
  });
});
