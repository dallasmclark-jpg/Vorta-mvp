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
  const select = "id,full_name,discipline,site_id,organisation_id,profile_id";
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

    const { data: equipmentRows, error: equipmentError } = await db
      .from("equipment_assets")
      .select(
        "id,equipment_code,name,equipment_type,area,line,oem,model,manufacturer,serial_number,install_date,criticality,status,image_url,site_id,organisation_id",
      )
      .eq("site_id", siteId)
      .eq("organisation_id", profile.organisation_id)
      .order("area")
      .order("name");
    if (equipmentError) throw equipmentError;

    const equipmentIds = (equipmentRows ?? []).map((row: any) => row.id);
    const [riskResult, componentResult] = await Promise.all([
      equipmentIds.length
        ? db
            .from("equipment_risk_profiles")
            .select(
              "equipment_id,risk_score,risk_level,overdue_pm_count,open_work_order_count,calibration_overdue_count,repeat_breakdown_count,single_point_skill_gap,critical_spares_missing,risk_summary,priority_action,operational_risk_score,labour_risk_score,scheduled_engineer_count,qualified_engineer_count,missing_skill_count,labour_shift_date,labour_shift_type,no_engineer_override,updated_at",
            )
            .in("equipment_id", equipmentIds)
        : Promise.resolve({ data: [], error: null }),
      equipmentIds.length
        ? db
            .from("equipment_components")
            .select(
              "equipment_id,component_name,component_code,quantity_available,quantity_target,minimum_quantity,availability_status,vendor_name,maker_name,storage_location,criticality,unit_cost,lead_days,updated_at",
            )
            .in("equipment_id", equipmentIds)
            .order("component_name")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (riskResult.error) throw riskResult.error;
    if (componentResult.error) throw componentResult.error;

    const riskMap = new Map(
      (riskResult.data ?? []).map((row: any) => [String(row.equipment_id), row]),
    );
    const equipment = (equipmentRows ?? []).map((row: any) => ({
      ...row,
      risk: riskMap.get(String(row.id)) ?? null,
    }));

    return json(req, {
      siteId,
      organisationId: profile.organisation_id,
      engineer: {
        id: engineer.id,
        fullName: engineer.full_name,
        discipline: engineer.discipline ?? null,
      },
      equipment,
      components: componentResult.data ?? [],
      generatedAt: new Date().toISOString(),
      scope: "site",
    });
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status) || 500;
    if (status >= 500) console.error("engineer-equipment-data failed", error);
    return json(
      req,
      {
        error:
          status < 500
            ? String((error as Error)?.message ?? "Engineer equipment access denied")
            : "Engineer equipment data could not be loaded",
      },
      status,
    );
  }
});
