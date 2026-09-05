import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient, type User } from "jsr:@supabase/supabase-js@2";

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

function responseHeaders(req: Request): Record<string, string> {
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
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(req) });
}

function roleKey(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";
}

async function resolveEngineer(
  db: SupabaseClient,
  user: User,
  organisationId: string,
): Promise<Record<string, any>> {
  const select = "id,full_name,discipline,department_id,site_id,organisation_id,profile_id";
  const { data: linked, error } = await db
    .from("engineers")
    .select(select)
    .eq("profile_id", user.id)
    .eq("organisation_id", organisationId)
    .limit(2);
  if (error) throw error;
  if ((linked?.length ?? 0) > 1) {
    throw Object.assign(new Error("Engineer identity is ambiguous."), { status: 409 });
  }

  const profileEngineer = linked?.[0] ?? null;
  const metadataEngineerId =
    typeof user.app_metadata?.engineer_id === "string"
      ? user.app_metadata.engineer_id.trim()
      : "";

  if (profileEngineer) {
    if (metadataEngineerId && metadataEngineerId !== profileEngineer.id) {
      throw Object.assign(
        new Error("Engineer identity is inconsistent between profile link and server metadata."),
        { status: 409 },
      );
    }
    return profileEngineer;
  }

  if (!metadataEngineerId) {
    throw Object.assign(new Error("No engineer record is linked to this account."), { status: 403 });
  }

  const { data: fallback, error: fallbackError } = await db
    .from("engineers")
    .select(select)
    .eq("id", metadataEngineerId)
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (fallbackError) throw fallbackError;
  if (!fallback) {
    throw Object.assign(new Error("The server-controlled engineer mapping is invalid."), { status: 403 });
  }
  return fallback;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: allowedOrigin(req.headers.get("origin")) ? 204 : 403,
      headers: responseHeaders(req),
    });
  }
  if (!["GET", "POST"].includes(req.method)) {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization || !url || !anonKey || !serviceRoleKey) {
      return json(req, { error: "Authentication required" }, 401);
    }

    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResult, error: userError } = await authClient.auth.getUser(token);
    const user = userResult.user;
    if (userError || !user) {
      return json(req, { error: "Authentication could not be verified" }, 401);
    }

    const db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("id,organisation_id,role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.organisation_id) {
      return json(req, { error: "Engineer profile access could not be verified" }, 403);
    }

    const engineer = await resolveEngineer(db, user, String(profile.organisation_id));
    const siteId = String(engineer.site_id ?? "");
    if (!siteId) {
      return json(req, { error: "The engineer profile has no authorised site" }, 403);
    }

    const { data: accessRows, error: accessError } = await db
      .from("user_site_access")
      .select("site_id,organisation_id,app_role,active")
      .eq("user_id", user.id)
      .eq("site_id", siteId)
      .eq("organisation_id", profile.organisation_id)
      .eq("active", true)
      .limit(2);
    if (accessError) throw accessError;
    const access = accessRows?.[0] ?? null;
    if (!access || roleKey(access.app_role) !== "engineer") {
      return json(req, { error: "Active engineer access to this site is required" }, 403);
    }

    const { data: workOrders, error: workError } = await db
      .from("work_orders")
      .select(
        "id,equipment_id,wo_number,priority,description,work_type,status,assigned_engineer,requested_date,due_date,completed_date,downtime_minutes,is_overdue,fault_code,site_id,order_type_code,order_type_description,maintenance_activity_type_code,maintenance_activity_type_description,main_work_center,planner_group,basic_start_date,basic_finish_date,scheduled_start_at,scheduled_finish_at,actual_start_at,actual_finish_at,system_status_codes,user_status_codes,source_updated_at",
      )
      .eq("site_id", siteId)
      .ilike("assigned_engineer", String(engineer.full_name))
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(100);
    if (workError) throw workError;

    const equipmentIds = [
      ...new Set((workOrders ?? []).map((row: any) => row.equipment_id).filter(Boolean)),
    ];
    const equipmentResult = equipmentIds.length
      ? await db
          .from("equipment_assets")
          .select("id,equipment_code,name,area,line,equipment_type,criticality,status,site_id")
          .eq("site_id", siteId)
          .in("id", equipmentIds)
      : { data: [], error: null };
    if (equipmentResult.error) throw equipmentResult.error;

    const equipmentMap = new Map(
      (equipmentResult.data ?? []).map((asset: any) => [String(asset.id), asset]),
    );
    const scopedWorkOrders = (workOrders ?? []).map((row: any) => ({
      ...row,
      equipment: row.equipment_id ? equipmentMap.get(String(row.equipment_id)) ?? null : null,
    }));

    return json(req, {
      siteId,
      organisationId: profile.organisation_id,
      engineer: {
        id: engineer.id,
        fullName: engineer.full_name,
        discipline: engineer.discipline ?? null,
      },
      workOrders: scopedWorkOrders,
      generatedAt: new Date().toISOString(),
      scope: "self",
    });
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status) || 500;
    if (status >= 500) console.error("engineer-work-data failed", error);
    return json(
      req,
      {
        error:
          status < 500
            ? String((error as Error)?.message ?? "Engineer work access denied")
            : "Engineer work data could not be loaded",
      },
      status,
    );
  }
});
