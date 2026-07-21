import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://vorta-app.netlify.app",
  "https://vorta.network",
  "https://www.vorta.network",
  "http://localhost:5173",
  "http://localhost:3000",
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

function normaliseRole(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";
}

export function headers(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...(origin && ORIGINS.has(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
  };
}

export function response(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: origin && !ORIGINS.has(origin) ? 403 : 204,
    headers: headers(req),
  });
}

export async function context(req: Request): Promise<{
  db: ReturnType<typeof createClient>;
  siteId: string;
  organisationId: string;
}> {
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
  if (userError || !user) throw { status: 401, message: "Authentication could not be verified" };

  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,organisation_id,role")
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
    siteId: access.site_id as string,
    organisationId: access.organisation_id as string,
  };
}
