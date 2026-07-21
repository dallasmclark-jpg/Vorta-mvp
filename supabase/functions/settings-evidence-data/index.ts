import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";

function text(value: unknown, fallback = "Not recorded"): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

Deno.serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId, profile } = await context(req);

    const [siteResult, organisationResult, settingsResult] = await Promise.all([
      db
        .from("sites")
        .select("id,organisation_id,name,address,postcode,region,criticality,timezone,fiscal_year_start_month,updated_at")
        .eq("id", siteId)
        .eq("organisation_id", organisationId)
        .maybeSingle(),
      db
        .from("organisations")
        .select("id,name,type,industry,location,status,updated_at")
        .eq("id", organisationId)
        .maybeSingle(),
      db
        .from("vorta_settings")
        .select("site_id,setting_group,setting_key,description,updated_at")
        .eq("is_active", true)
        .or(`site_id.eq.${siteId},site_id.is.null`)
        .order("setting_group", { ascending: true })
        .order("setting_key", { ascending: true }),
    ]);

    if (siteResult.error) throw siteResult.error;
    if (organisationResult.error) throw organisationResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (!siteResult.data || !organisationResult.data) {
      throw { status: 404, message: "Active site metadata could not be resolved" };
    }

    const settingKeys = (settingsResult.data ?? []).map((row) => ({
      group: text(row.setting_group, "Unspecified"),
      key: text(row.setting_key, "Unspecified"),
      description: nullableText(row.description),
      updatedAt: text(row.updated_at, new Date(0).toISOString()),
    }));

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
      site: {
        id: siteResult.data.id as string,
        name: text(siteResult.data.name),
        address: nullableText(siteResult.data.address),
        postcode: nullableText(siteResult.data.postcode),
        region: nullableText(siteResult.data.region),
        criticality: nullableText(siteResult.data.criticality),
        timezone: nullableText(siteResult.data.timezone),
        fiscalYearStartMonth: nullableNumber(siteResult.data.fiscal_year_start_month),
        updatedAt: text(siteResult.data.updated_at, new Date(0).toISOString()),
      },
      organisation: {
        id: organisationResult.data.id as string,
        name: text(organisationResult.data.name),
        type: nullableText(organisationResult.data.type),
        industry: nullableText(organisationResult.data.industry),
        location: nullableText(organisationResult.data.location),
        status: nullableText(organisationResult.data.status),
        updatedAt: text(organisationResult.data.updated_at, new Date(0).toISOString()),
      },
      access: {
        profileId: profile.id,
        fullName: profile.fullName,
        jobTitle: profile.jobTitle,
        profileRole: profile.profileRole || "unknown",
        appRole: profile.appRole,
        isDefault: profile.isDefault,
        grantedAt: profile.grantedAt,
      },
      configuration: {
        persistedSettingCount: settingKeys.length,
        groups: Array.from(new Set(settingKeys.map((row) => row.group))),
        keys: settingKeys,
      },
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status) || 500
      : 500;
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message)
        : "Settings evidence could not be loaded";
    console.error("settings-evidence-data", error);
    return response(req, { error: message }, status);
  }
});
