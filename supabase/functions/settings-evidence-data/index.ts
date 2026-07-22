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

function numberValue(value: unknown, fallback = 0): number {
  const result = Number(value ?? fallback);
  return Number.isFinite(result) ? result : fallback;
}

function numericRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      numberValue(entry),
    ]),
  );
}

Deno.serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, userDb, siteId, organisationId, profile } = await context(req);

    const [
      siteResult,
      organisationResult,
      settingsResult,
      healthSummaryResult,
      healthIncidentsResult,
      recoveryResult,
    ] = await Promise.all([
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
      userDb.rpc("vorta_get_system_health_summary"),
      userDb.rpc("vorta_get_system_health_incidents", { p_limit: 50 }),
      userDb.rpc("vorta_get_latest_recovery_manifest"),
    ]);

    if (siteResult.error) throw siteResult.error;
    if (organisationResult.error) throw organisationResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (healthSummaryResult.error) throw healthSummaryResult.error;
    if (healthIncidentsResult.error) throw healthIncidentsResult.error;
    if (recoveryResult.error) throw recoveryResult.error;
    if (!siteResult.data || !organisationResult.data) {
      throw { status: 404, message: "Active site metadata could not be resolved" };
    }

    const healthRow = Array.isArray(healthSummaryResult.data)
      ? healthSummaryResult.data[0]
      : null;
    const recoveryRow = Array.isArray(recoveryResult.data)
      ? recoveryResult.data[0]
      : null;
    if (!healthRow || !recoveryRow) {
      throw { status: 503, message: "System health evidence is not available for this site" };
    }
    if (healthRow.site_id !== siteId || recoveryRow.site_id !== siteId) {
      throw { status: 403, message: "System health response scope did not match the active site" };
    }

    const settingKeys = (settingsResult.data ?? []).map((row) => ({
      group: text(row.setting_group, "Unspecified"),
      key: text(row.setting_key, "Unspecified"),
      description: nullableText(row.description),
      updatedAt: text(row.updated_at, new Date(0).toISOString()),
    }));

    const health = {
      summary: {
        siteId: text(healthRow.site_id),
        overallStatus: text(healthRow.overall_status, "critical"),
        latestHealthRunId: nullableText(healthRow.latest_health_run_id),
        latestHealthStatus: nullableText(healthRow.latest_health_status),
        latestHealthFinishedAt: nullableText(healthRow.latest_health_finished_at),
        passedCount: numberValue(healthRow.passed_count),
        failedCount: numberValue(healthRow.failed_count),
        warningCount: numberValue(healthRow.warning_count),
        riskLastRefreshedAt: nullableText(healthRow.risk_last_refreshed_at),
        riskAgeMinutes: nullableNumber(healthRow.risk_age_minutes),
        latestImportStatus: nullableText(healthRow.latest_import_status),
        latestImportAt: nullableText(healthRow.latest_import_at),
        latestImportFileName: nullableText(healthRow.latest_import_file_name),
        openIncidentCount: numberValue(healthRow.open_incident_count),
        criticalIncidentCount: numberValue(healthRow.critical_incident_count),
        highIncidentCount: numberValue(healthRow.high_incident_count),
        mediumIncidentCount: numberValue(healthRow.medium_incident_count),
        latestMonitorRunAt: nullableText(healthRow.latest_monitor_run_at),
      },
      incidents: (healthIncidentsResult.data ?? []).map((row: Record<string, unknown>) => ({
        id: text(row.id),
        monitorKey: nullableText(row.monitor_key),
        title: text(row.title),
        description: nullableText(row.description),
        severity: text(row.severity, "unknown"),
        status: text(row.status, "unknown"),
        source: nullableText(row.source),
        firstObservedAt: text(row.first_observed_at, new Date(0).toISOString()),
        lastObservedAt: text(row.last_observed_at, new Date(0).toISOString()),
        occurrenceCount: numberValue(row.occurrence_count, 1),
        details: {},
        acknowledgedAt: nullableText(row.acknowledged_at),
        resolvedAt: nullableText(row.resolved_at),
      })),
      recoveryManifest: {
        manifestId: text(recoveryRow.manifest_id),
        siteId: text(recoveryRow.site_id),
        status: text(recoveryRow.status, "partial"),
        migrationVersion: text(recoveryRow.migration_version),
        migrationName: nullableText(recoveryRow.migration_name),
        schemaMigrationCount: numberValue(recoveryRow.schema_migration_count),
        latestHealthRunId: nullableText(recoveryRow.latest_health_run_id),
        riskRefreshedAt: nullableText(recoveryRow.risk_refreshed_at),
        datasetCounts: numericRecord(recoveryRow.dataset_counts),
        datasetFingerprints: {},
        manifestFingerprint: "withheld",
        createdAt: text(recoveryRow.created_at, new Date(0).toISOString()),
        ageHours: numberValue(recoveryRow.age_hours),
      },
    };

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
      health,
    });
  } catch (error) {
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status?: unknown }).status) || 500
        : 500;
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message)
          : "Settings evidence could not be loaded";
    console.error("settings-evidence-data", error);
    return response(req, { error: message }, status);
  }
});
