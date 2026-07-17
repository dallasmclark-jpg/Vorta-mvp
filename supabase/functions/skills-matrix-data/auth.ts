import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGINS = new Set([
  "https://vorta-app.netlify.app",
  "https://vorta.network",
  "https://www.vorta.network",
  "http://localhost:5173",
  "http://localhost:3000",
  ...(Deno.env.get("VORTA_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);

export function headers(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    ...(origin && ORIGINS.has(origin)
      ? { "Access-Control-Allow-Origin": origin }
      : {}),
  };
}

export function response(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers(req),
  });
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("origin");
  return new Response(null, {
    status: origin && !ORIGINS.has(origin) ? 403 : 204,
    headers: headers(req),
  });
}

export async function context(req: Request) {
  const authorization = req.headers.get("authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization) {
    throw { status: 401, message: "Authentication required" };
  }
  if (!url || !key) {
    throw { status: 500, message: "Function configuration is incomplete" };
  }

  const db = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .rpc("vorta_get_function_context")
    .maybeSingle();
  if (error) {
    throw { status: 403, message: "Portal access could not be verified" };
  }
  if (!data?.site_id || !data?.organisation_id) {
    throw { status: 403, message: "Maintenance Manager access required" };
  }
  return {
    db,
    siteId: data.site_id as string,
    organisationId: data.organisation_id as string,
  };
}
