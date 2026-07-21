import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  KeyRound,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserCircle,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { invokeEvidenceFunction } from "../../lib/invokeEvidenceFunction";
import {
  validateSettingsEvidencePayload,
  validateSystemHealthData,
} from "../../lib/liveEvidenceContracts";
import { RuntimeContractError } from "../../lib/runtimeContracts";

type HealthSummary = {
  siteId: string;
  overallStatus: string;
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
};

type HealthIncident = {
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
};

type RecoveryManifest = {
  manifestId: string;
  siteId: string;
  status: string;
  migrationVersion: string;
  migrationName: string | null;
  schemaMigrationCount: number;
  latestHealthRunId: string | null;
  riskRefreshedAt: string | null;
  datasetCounts: Record<string, number>;
  datasetFingerprints: Record<string, string>;
  manifestFingerprint: string;
  createdAt: string;
  ageHours: number;
};

type SettingsPayload = {
  siteId: string;
  organisationId: string;
  generatedAt: string;
  site: {
    id: string;
    name: string;
    address: string | null;
    postcode: string | null;
    region: string | null;
    criticality: string | null;
    timezone: string | null;
    fiscalYearStartMonth: number | null;
    updatedAt: string;
  };
  organisation: {
    id: string;
    name: string;
    type: string | null;
    industry: string | null;
    location: string | null;
    status: string | null;
    updatedAt: string;
  };
  access: {
    profileId: string;
    fullName: string;
    jobTitle: string | null;
    profileRole: string;
    appRole: string;
    isDefault: boolean;
    grantedAt: string;
  };
  configuration: {
    persistedSettingCount: number;
    groups: string[];
    keys: Array<{
      group: string;
      key: string;
      description: string | null;
      updatedAt: string;
    }>;
  };
  health: {
    summary: HealthSummary;
    incidents: HealthIncident[];
    recoveryManifest: RecoveryManifest;
  };
};

function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "healthy":
    case "complete":
    case "passed":
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "degraded":
    case "partial":
    case "warning":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "critical":
    case "failed":
    case "error":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    default:
      return "border-slate-700 bg-slate-800/60 text-slate-300";
  }
}

export function LiveSettingsSection(): JSX.Element {
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false): Promise<void> => {
    if (!siteContext?.siteId || !siteContext.organisationId) {
      setPayload(null);
      setError("An active maintenance site could not be resolved for this account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const data = await invokeEvidenceFunction<unknown>(
        "settings-evidence-data",
        { schemaVersion: "settings-evidence-v2" },
      );
      const settings = validateSettingsEvidencePayload(data) as unknown as SettingsPayload;
      const health = validateSystemHealthData(settings.health) as unknown as SettingsPayload["health"];
      if (
        settings.siteId !== siteContext.siteId ||
        settings.organisationId !== siteContext.organisationId ||
        settings.site.id !== siteContext.siteId ||
        settings.organisation.id !== siteContext.organisationId ||
        health.summary.siteId !== siteContext.siteId ||
        health.recoveryManifest.siteId !== siteContext.siteId
      ) {
        throw new RuntimeContractError(
          "Settings evidence",
          "response scope did not match the authenticated site",
        );
      }
      setPayload({ ...settings, health });
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Verified settings evidence is unavailable.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteContext?.organisationId, siteContext?.siteId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const activeIncidents = useMemo(
    () => payload?.health.incidents
      .filter((incident) => ["open", "acknowledged"].includes(incident.status.toLowerCase()))
      .slice(0, 8) ?? [],
    [payload],
  );

  const recoveryRows = useMemo(
    () => payload
      ? Object.values(payload.health.recoveryManifest.datasetCounts).reduce(
          (total, count) => total + Number(count ?? 0),
          0,
        )
      : 0,
    [payload],
  );

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Read-only live pilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">System &amp; Access Evidence</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Authenticated site identity, access metadata and backend health. Editable settings remain withheld until changes can be stored and audited.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading || refreshing}
          aria-label="Refresh verified system and access evidence"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-100 hover:bg-white/15 disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading settings evidence">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5 sm:flex-row sm:items-center" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-100">Settings evidence was withheld</p>
              <p className="mt-1 text-xs leading-5 text-red-100/75">{error}</p>
            </div>
          </div>
          <button type="button" onClick={() => void load(false)} className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10">Retry</button>
        </div>
      ) : null}

      {!loading && payload ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3 text-xs text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-blue-300" aria-hidden="true" />
            <span className="font-semibold text-blue-200">Runtime-validated evidence</span>
            <span>Active site: {payload.siteId}</span>
            <span>Generated: {formatDateTime(payload.generatedAt)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["System health", label(payload.health.summary.overallStatus), Activity, payload.health.summary.overallStatus === "healthy" ? "text-emerald-300" : payload.health.summary.overallStatus === "degraded" ? "text-amber-300" : "text-red-300"],
              ["Active incidents", activeIncidents.length, AlertTriangle, activeIncidents.length ? "text-amber-300" : "text-emerald-300"],
              ["Persisted settings", payload.configuration.persistedSettingCount, Database, payload.configuration.persistedSettingCount ? "text-blue-300" : "text-slate-400"],
              ["Recovery rows tracked", recoveryRows, ShieldCheck, "text-slate-100"],
            ].map(([metricLabel, value, Icon, valueClass]) => {
              const MetricIcon = Icon as typeof Activity;
              return (
                <Card key={String(metricLabel)} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-400">{String(metricLabel)}</p>
                      <MetricIcon className="h-4 w-4 text-slate-600" aria-hidden="true" />
                    </div>
                    <p className={`mt-3 text-2xl font-semibold tabular-nums ${String(valueClass)}`}>{String(value)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <EvidenceCard icon={Building2} title="Active site" rows={[
              ["Name", payload.site.name],
              ["Region", payload.site.region ?? "Not recorded"],
              ["Address", [payload.site.address, payload.site.postcode].filter(Boolean).join(", ") || "Not recorded"],
              ["Timezone", payload.site.timezone ?? "Not recorded"],
            ]} />
            <EvidenceCard icon={MapPin} title="Organisation" rows={[
              ["Name", payload.organisation.name],
              ["Industry", payload.organisation.industry ?? "Not recorded"],
              ["Location", payload.organisation.location ?? "Not recorded"],
              ["Status", payload.organisation.status ?? "Not recorded"],
            ]} />
            <EvidenceCard icon={UserCircle} title="Signed-in access" rows={[
              ["Profile", payload.access.fullName],
              ["Job title", payload.access.jobTitle ?? "Not recorded"],
              ["Portal role", label(payload.access.appRole)],
              ["Access granted", formatDateTime(payload.access.grantedAt)],
            ]} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-300" aria-hidden="true" />
                      <h2 className="font-semibold text-slate-50">System health</h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Caller-scoped backend evidence returned through the secured settings function.</p>
                  </div>
                  <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(payload.health.summary.overallStatus)}`}>
                    {payload.health.summary.overallStatus}
                  </Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MetricBox label="Checks passed" value={payload.health.summary.passedCount} valueClass="text-emerald-300" />
                  <MetricBox label="Checks failed" value={payload.health.summary.failedCount} valueClass="text-red-300" />
                  <MetricBox label="Latest import" value={payload.health.summary.latestImportStatus ?? "Not recorded"} helper={formatDateTime(payload.health.summary.latestImportAt)} />
                  <MetricBox label="Risk refreshed" value={formatDateTime(payload.health.summary.riskLastRefreshedAt)} />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                      <h2 className="font-semibold text-slate-50">Recovery evidence</h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Latest recovery manifest and dataset footprint.</p>
                  </div>
                  <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(payload.health.recoveryManifest.status)}`}>
                    {payload.health.recoveryManifest.status}
                  </Badge>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <EvidenceValue label="Migration version" value={payload.health.recoveryManifest.migrationVersion} />
                  <EvidenceValue label="Schema migrations" value={String(payload.health.recoveryManifest.schemaMigrationCount)} />
                  <EvidenceValue label="Datasets tracked" value={String(Object.keys(payload.health.recoveryManifest.datasetCounts).length)} />
                  <EvidenceValue label="Manifest created" value={formatDateTime(payload.health.recoveryManifest.createdAt)} />
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 p-5">
                <h2 className="font-semibold text-slate-50">Active health incidents</h2>
                <p className="mt-1 text-xs text-slate-500">Open and acknowledged incidents for this site.</p>
              </div>
              <div className="divide-y divide-gray-800/80">
                {activeIncidents.length === 0 ? (
                  <div className="flex items-center gap-3 p-5 text-sm text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    No active system-health incidents are recorded.
                  </div>
                ) : activeIncidents.map((incident) => (
                  <div key={incident.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{incident.title}</p>
                      {incident.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{incident.description}</p> : null}
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        Last observed {formatDateTime(incident.lastObservedAt)} · {incident.occurrenceCount} occurrence{incident.occurrenceCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Badge className={`h-auto shrink-0 rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(incident.severity)}`}>
                      {incident.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-5">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-amber-100">Configuration remains read-only</p>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
                  {payload.configuration.persistedSettingCount > 0
                    ? `${payload.configuration.persistedSettingCount} setting records are registered, but values are not exposed or editable in the live pilot.`
                    : "No persisted site-setting records are registered. Demo toggles, approval thresholds, invites and billing fields are withheld."}
                </p>
                <a href="mailto:support@vorta.network?subject=Vorta%20pilot%20configuration" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-300 hover:text-blue-200">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Request a controlled configuration change
                </a>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function EvidenceCard({
  icon: Icon,
  title,
  rows,
}: {
  icon: typeof Building2;
  title: string;
  rows: Array<[string, string]>;
}): JSX.Element {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-blue-300" aria-hidden="true" />
          <h2 className="font-semibold text-slate-50">{title}</h2>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          {rows.map(([rowLabel, value]) => (
            <div key={rowLabel}>
              <dt className="text-xs text-slate-600">{rowLabel}</dt>
              <dd className="mt-0.5 text-slate-300">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function MetricBox({
  label: metricLabel,
  value,
  helper,
  valueClass = "text-slate-300",
}: {
  label: string;
  value: string | number;
  helper?: string;
  valueClass?: string;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-800 bg-[#111620] p-3">
      <p className="text-xs text-slate-600">{metricLabel}</p>
      <p className={`mt-1 text-sm font-semibold ${valueClass}`}>{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-600">{helper}</p> : null}
    </div>
  );
}

function EvidenceValue({ label: valueLabel, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-xs text-slate-600">{valueLabel}</dt>
      <dd className="mt-1 font-medium text-slate-300">{value}</dd>
    </div>
  );
}
