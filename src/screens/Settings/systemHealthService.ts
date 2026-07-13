import { supabase } from "../../lib/supabaseClient";

export type SystemHealthStatus =
  | "healthy"
  | "degraded"
  | "critical";

export type RecoveryManifestStatus =
  | "complete"
  | "partial";

export interface RecoveryManifest {
  manifestId: string;
  siteId: string;
  status: RecoveryManifestStatus;
  migrationVersion: string;
  migrationName: string | null;
  schemaMigrationCount: number;
  latestHealthRunId: string | null;
  riskRefreshedAt: string | null;
  datasetCounts: Record<
    string,
    number
  >;
  datasetFingerprints: Record<
    string,
    string
  >;
  manifestFingerprint: string;
  createdAt: string;
  ageHours: number;
}

export interface SystemHealthSummary {
  siteId: string;
  overallStatus: SystemHealthStatus;
  latestHealthRunId: string | null;
  latestHealthStatus: string | null;
  latestHealthFinishedAt: string | null;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  riskLastRefreshedAt: string | null;
  riskAgeMinutes: number | null;
  latestImportStatus: string | null;
  latestImportAt: string | null;
  latestImportFileName: string | null;
  openIncidentCount: number;
  criticalIncidentCount: number;
  highIncidentCount: number;
  mediumIncidentCount: number;
  latestMonitorRunAt: string | null;
}

export interface SystemHealthIncident {
  id: string;
  monitorKey: string | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  occurrenceCount: number;
  details: Record<string, unknown>;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface SystemHealthData {
  summary: SystemHealthSummary;
  incidents: SystemHealthIncident[];
  recoveryManifest: RecoveryManifest;
}

interface RawSystemHealthSummary {
  site_id: string;
  overall_status: SystemHealthStatus;
  latest_health_run_id: string | null;
  latest_health_status: string | null;
  latest_health_finished_at: string | null;
  passed_count: number;
  failed_count: number;
  warning_count: number;
  risk_last_refreshed_at: string | null;
  risk_age_minutes: number | null;
  latest_import_status: string | null;
  latest_import_at: string | null;
  latest_import_file_name: string | null;
  open_incident_count: number;
  critical_incident_count: number;
  high_incident_count: number;
  medium_incident_count: number;
  latest_monitor_run_at: string | null;
}

interface RawSystemHealthIncident {
  id: string;
  monitor_key: string | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  source: string | null;
  first_observed_at: string;
  last_observed_at: string;
  occurrence_count: number;
  details: Record<string, unknown> | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

interface RawRecoveryManifest {
  manifest_id: string;
  site_id: string;
  status: RecoveryManifestStatus;
  migration_version: string;
  migration_name: string | null;
  schema_migration_count:
    | number
    | string;
  latest_health_run_id:
    | string
    | null;
  risk_refreshed_at:
    | string
    | null;
  dataset_counts:
    | Record<
        string,
        unknown
      >
    | null;
  dataset_fingerprints:
    | Record<
        string,
        unknown
      >
    | null;
  manifest_fingerprint: string;
  created_at: string;
  age_hours:
    | number
    | string;
}

const mapNumericRecord = (
  value:
    | Record<
        string,
        unknown
      >
    | null,
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(
      value ?? {},
    ).map(
      ([
        key,
        entryValue,
      ]) => [
        key,
        Number(
          entryValue ?? 0,
        ),
      ],
    ),
  );

const mapStringRecord = (
  value:
    | Record<
        string,
        unknown
      >
    | null,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(
      value ?? {},
    ).map(
      ([
        key,
        entryValue,
      ]) => [
        key,
        String(
          entryValue ?? "",
        ),
      ],
    ),
  );

const mapSummary = (
  row: RawSystemHealthSummary,
): SystemHealthSummary => ({
  siteId: row.site_id,
  overallStatus: row.overall_status,
  latestHealthRunId:
    row.latest_health_run_id,
  latestHealthStatus:
    row.latest_health_status,
  latestHealthFinishedAt:
    row.latest_health_finished_at,
  passedCount: Number(
    row.passed_count ?? 0,
  ),
  failedCount: Number(
    row.failed_count ?? 0,
  ),
  warningCount: Number(
    row.warning_count ?? 0,
  ),
  riskLastRefreshedAt:
    row.risk_last_refreshed_at,
  riskAgeMinutes:
    row.risk_age_minutes === null
      ? null
      : Number(row.risk_age_minutes),
  latestImportStatus:
    row.latest_import_status,
  latestImportAt:
    row.latest_import_at,
  latestImportFileName:
    row.latest_import_file_name,
  openIncidentCount: Number(
    row.open_incident_count ?? 0,
  ),
  criticalIncidentCount: Number(
    row.critical_incident_count ?? 0,
  ),
  highIncidentCount: Number(
    row.high_incident_count ?? 0,
  ),
  mediumIncidentCount: Number(
    row.medium_incident_count ?? 0,
  ),
  latestMonitorRunAt:
    row.latest_monitor_run_at,
});

const mapIncident = (
  row: RawSystemHealthIncident,
): SystemHealthIncident => ({
  id: row.id,
  monitorKey: row.monitor_key,
  title: row.title,
  description: row.description,
  severity: row.severity,
  status: row.status,
  source: row.source,
  firstObservedAt:
    row.first_observed_at,
  lastObservedAt:
    row.last_observed_at,
  occurrenceCount: Number(
    row.occurrence_count ?? 1,
  ),
  details: row.details ?? {},
  acknowledgedAt:
    row.acknowledged_at,
  resolvedAt: row.resolved_at,
});

const mapRecoveryManifest = (
  row: RawRecoveryManifest,
): RecoveryManifest => ({
  manifestId:
    row.manifest_id,
  siteId:
    row.site_id,
  status:
    row.status,
  migrationVersion:
    row.migration_version,
  migrationName:
    row.migration_name,
  schemaMigrationCount:
    Number(
      row.schema_migration_count ??
        0,
    ),
  latestHealthRunId:
    row.latest_health_run_id,
  riskRefreshedAt:
    row.risk_refreshed_at,
  datasetCounts:
    mapNumericRecord(
      row.dataset_counts,
    ),
  datasetFingerprints:
    mapStringRecord(
      row.dataset_fingerprints,
    ),
  manifestFingerprint:
    row.manifest_fingerprint,
  createdAt:
    row.created_at,
  ageHours:
    Number(
      row.age_hours ?? 0,
    ),
});

export const getSystemHealth =
  async (): Promise<SystemHealthData> => {
    const [
      summaryResponse,
      incidentsResponse,
      recoveryResponse,
    ] = await Promise.all([
      supabase.rpc(
        "vorta_get_system_health_summary",
      ),
      supabase.rpc(
        "vorta_get_system_health_incidents",
        {
          p_limit: 50,
        },
      ),
      supabase.rpc(
        "vorta_get_latest_recovery_manifest",
      ),
    ]);

    if (summaryResponse.error) {
      throw new Error(
        summaryResponse.error.message,
      );
    }

    if (incidentsResponse.error) {
      throw new Error(
        incidentsResponse.error.message,
      );
    }

    if (recoveryResponse.error) {
      throw new Error(
        recoveryResponse.error.message,
      );
    }

    const summaryRows =
      summaryResponse.data as
        | RawSystemHealthSummary[]
        | null;

    const summaryRow =
      summaryRows?.[0];

    if (!summaryRow) {
      throw new Error(
        "System health is not available for this site.",
      );
    }

    const incidentRows =
      incidentsResponse.data as
        | RawSystemHealthIncident[]
        | null;

    const recoveryRows =
      recoveryResponse.data as
        | RawRecoveryManifest[]
        | null;

    const recoveryRow =
      recoveryRows?.[0];

    if (!recoveryRow) {
      throw new Error(
        "Recovery validation is not available for this site.",
      );
    }

    return {
      summary:
        mapSummary(
          summaryRow,
        ),
      incidents:
        incidentRows?.map(
          mapIncident,
        ) ?? [],
      recoveryManifest:
        mapRecoveryManifest(
          recoveryRow,
        ),
    };
  };
