import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://vorta-app.netlify.app",
  "https://main--vorta-app.netlify.app",
  "https://vorta.network",
  "https://www.vorta.network",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  ...(Deno.env.get("VORTA_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);

const ALLOWED_ROLES = new Set([
  "vorta_admin",
  "site_admin",
  "maintenance_manager",
  "reliability_engineer",
]);

const SAFE_PUBLIC_ERROR_STATUSES = new Set([400, 401, 403, 404, 405, 409, 422, 429]);

function normaliseRole(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return ORIGINS.has(origin) || /^https:\/\/deploy-preview-\d+--vorta-app\.netlify\.app$/.test(origin);
}

function publicResponseBody(body: unknown, status: number): unknown {
  if (status < 500 || SAFE_PUBLIC_ERROR_STATUSES.has(status)) return body;

  const correlationId = crypto.randomUUID();
  console.error("Settings evidence returned an unexpected server failure.", {
    correlationId,
    status,
    body,
  });

  return {
    error: "Verified system and access evidence is temporarily unavailable.",
    correlationId,
  };
}

export function headers(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...(origin && isAllowedOrigin(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  };
}

export function response(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(publicResponseBody(body, status)), {
    status,
    headers: headers(req),
  });
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: isAllowedOrigin(origin) ? 204 : 403,
    headers: headers(req),
  });
}

export async function context(req: Request) {
  const authorization = req.headers.get("authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authorization) throw { status: 401, message: "Authentication required" };
  if (!url || !anonKey || !serviceRoleKey) {
    throw { status: 500, message: "Function configuration is incomplete" };
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw { status: 401, message: "Authentication required" };

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult, error: userError } = await authClient.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user) {
    throw { status: 401, message: "Authentication could not be verified" };
  }

  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userDb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,organisation_id,full_name,job_title,role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile?.organisation_id) {
    throw { status: 403, message: "Portal access could not be verified" };
  }

  const { data: accessRows, error: accessError } = await db
    .from("user_site_access")
    .select("site_id,organisation_id,app_role,is_default,created_at")
    .eq("user_id", user.id)
    .eq("organisation_id", profile.organisation_id)
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);
  if (accessError) throw { status: 403, message: "Portal access could not be verified" };

  const access = accessRows?.[0];
  const role = normaliseRole(access?.app_role ?? profile.role);
  if (!access?.site_id || !access.organisation_id || !ALLOWED_ROLES.has(role)) {
    throw { status: 403, message: "Maintenance Manager access required" };
  }

  return {
    db,
    userDb,
    userId: user.id as string,
    siteId: access.site_id as string,
    organisationId: access.organisation_id as string,
    profile: {
      id: profile.id as string,
      fullName:
        typeof profile.full_name === "string" && profile.full_name.trim()
          ? profile.full_name
          : user.email ?? "Signed-in user",
      jobTitle: typeof profile.job_title === "string" ? profile.job_title : null,
      profileRole: normaliseRole(profile.role),
      appRole: role,
      isDefault: access.is_default === true,
      grantedAt: access.created_at as string,
    },
  };
}
