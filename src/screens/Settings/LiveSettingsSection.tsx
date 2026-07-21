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
import {
  RuntimeContractError,
  validateSettingsEvidencePayload,
  validateSystemHealthData,
} from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";
import {
  getSystemHealth,
  type RecoveryManifest,
  type SystemHealthIncident,
  type SystemHealthSummary,
} from "./systemHealthService";

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
};

type LiveSettingsState = {
  settings: SettingsPayload;
  health: {
    summary: SystemHealthSummary;
    incidents: SystemHealthIncident[];
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

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Freshness unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: string): string {
  const value = status.trim().toLowerCase();
  if (["healthy", "complete", "passed", "active"].includes(value)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (["degraded", "partial", "warning"].includes(value)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  if (["critical", "failed", "error"].includes(value)) {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  return "border-slate-700 bg-slate-800/60 text-slate-300";
}

function roleLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LiveSettingsSection(): JSX.Element {
  const { siteContext } = useAuth();
  const [state, setState] = useState<LiveSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false): Promise<void> => {
    if (!siteContext?.siteId || !siteContext.organisationId) {
      setState(null);
      setError("An active maintenance site could not be resolved for this account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [settingsResponse, healthResponse] = await Promise.all([
        supabase.functions.invoke("settings-evidence-data", {
          body: { schemaVersion: "settings-evidence-v1" },
        }),
        getSystemHealth(),
      ]);

      if (settingsResponse.error || !settingsResponse.data) {
        throw settingsResponse.error ?? new Error("Settings evidence was empty");
      }

      const settings = validateSettingsEvidencePayload(
        settingsResponse.data,
      ) as unknown as SettingsPayload;
      const health = validateSystemHealthData(healthResponse) as unknown as LiveSettingsState["health"];

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

      setState({ settings, health });
    } catch (loadError) {
      setState(null);
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
    () => state?.health.incidents.filter((incident) => ["open", "acknowledged"].includes(incident.status.toLowerCase())).slice(0, 8) ?? [],
    [state],
  );

  const recoveryRowCount = useMemo(
    () => state
      ? Object.values(state.health.recoveryManifest.datasetCounts).reduce(
          (total, count) => total + Number(count ?? 0),
          0,
        )
      : 0,
    [state],
  );

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Read-only live pilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">System &amp; Access Evidence</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Authenticated site identity, organisation access, persisted configuration metadata and backend health. Editable settings remain withheld until changes can be stored and audited.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading || refreshing}
          aria-label="Refresh verified system and access evidence"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto"
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
          <button
            type="button"
            onClick={() => void load(false)}
            className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && state ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3 text-xs text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-blue-300" aria-hidden="true" />
            <span className="font-semibold text-blue-200">Runtime-validated evidence</span>
            <span>Active site: {state.settings.siteId}</span>
            <span>Generated: {formatGeneratedAt(state.settings.generatedAt)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["System health", roleLabel(state.health.summary.overallStatus), Activity, state.health.summary.overallStatus === "healthy" ? "text-emerald-300" : state.health.summary.overallStatus === "degraded" ? "text-amber-300" : "text-red-300"],
              ["Active incidents", activeIncidents.length, AlertTriangle, activeIncidents.length ? "text-amber-300" : "text-emerald-300"],
              ["Persisted settings", state.settings.configuration.persistedSettingCount, Database, state.settings.configuration.persistedSettingCount ? "text-blue-300" : "text-slate-400"],
              ["Recovery rows tracked", recoveryRowCount, ShieldCheck, "text-slate-100"],
            ].map(([label, value, Icon, valueClass]) => {
              const MetricIcon = Icon as typeof Activity;
              return (
                <Card key={String(label)} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-400">{String(label)}</p>
                      <MetricIcon className="h-4 w-4 text-slate-600" aria-hidden="true" />
                    </div>
                    <p className={`mt-3 text-2xl font-semibold tabular-nums ${String(valueClass)}`}>{String(value)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-300" aria-hidden="true" />
                  <h2 className="font-semibold text-slate-50">Active site</h2>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-xs text-slate-600">Name</dt><dd className="mt-0.5 font-medium text-slate-200">{state.settings.site.name}</dd></div>
                  <div><dt className="text-xs text-slate-600">Region</dt><dd className="mt-0.5 text-slate-400">{state.settings.site.region ?? "Not recorded"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Address</dt><dd className="mt-0.5 text-slate-400">{[state.settings.site.address, state.settings.site.postcode].filter(Boolean).join(", ") || "Not recorded"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Timezone</dt><dd className="mt-0.5 text-slate-400">{state.settings.site.timezone ?? "Not recorded"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Criticality</dt><dd className="mt-0.5 text-slate-400">{state.settings.site.criticality ?? "Not recorded"}</dd></div>
                </dl>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-violet-300" aria-hidden="true" />
                  <h2 className="font-semibold text-slate-50">Organisation</h2>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-xs text-slate-600">Name</dt><dd className="mt-0.5 font-medium text-slate-200">{state.settings.organisation.name}</dd></div>
                  <div><dt className="text-xs text-slate-600">Industry</dt><dd className="mt-0.5 text-slate-400">{state.settings.organisation.industry ?? "Not recorded"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Location</dt><dd className="mt-0.5 text-slate-400">{state.settings.organisation.location ?? "Not recorded"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Type</dt><dd className="mt-0.5 text-slate-400">{state.settings.organisation.type ?? "Not recorded"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Status</dt><dd className="mt-1"><Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(state.settings.organisation.status ?? "unknown")}`}>{state.settings.organisation.status ?? "unknown"}</Badge></dd></div>
                </dl>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <h2 className="font-semibold text-slate-50">Signed-in access</h2>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-xs text-slate-600">Profile</dt><dd className="mt-0.5 font-medium text-slate-200">{state.settings.access.fullName}</dd></div>
                  <div><dt className="text-xs text-slate-600">Job title</dt><dd className="mt-0.5 text-slate-400">{state.settings.access.jobTitle ?? "Not recorded"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Portal role</dt><dd className="mt-0.5 text-slate-400">{roleLabel(state.settings.access.appRole)}</dd></div>
                  <div><dt className="text-xs text-slate-600">Default site</dt><dd className="mt-0.5 text-slate-400">{state.settings.access.isDefault ? "Yes" : "No"}</dd></div>
                  <div><dt className="text-xs text-slate-600">Access granted</dt><dd className="mt-0.5 text-slate-400">{formatDateTime(state.settings.access.grantedAt)}</dd></div>
                </dl>
              </CardContent>
            </Card>
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
                    <p className="mt-1 text-xs text-slate-500">Backend evidence from the active site health register.</p>
                  </div>
                  <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(state.health.summary.overallStatus)}`}>
                    {state.health.summary.overallStatus}
                  </Badge>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-800 bg-[#111620] p-3"><p className="text-xs text-slate-600">Checks passed</p><p className="mt-1 text-xl font-semibold text-emerald-300">{state.health.summary.passedCount}</p></div>
                  <div className="rounded-lg border border-gray-800 bg-[#111620] p-3"><p className="text-xs text-slate-600">Checks failed</p><p className="mt-1 text-xl font-semibold text-red-300">{state.health.summary.failedCount}</p></div>
                  <div className="rounded-lg border border-gray-800 bg-[#111620] p-3"><p className="text-xs text-slate-600">Latest import</p><p className="mt-1 text-sm font-semibold text-slate-300">{state.health.summary.latestImportStatus ?? "Not recorded"}</p><p className="mt-1 text-xs text-slate-600">{formatDateTime(state.health.summary.latestImportAt)}</p></div>
                  <div className="rounded-lg border border-gray-800 bg-[#111620] p-3"><p className="text-xs text-slate-600">Risk refreshed</p><p className="mt-1 text-sm font-semibold text-slate-300">{formatDateTime(state.health.summary.riskLastRefreshedAt)}</p></div>
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
                    <p className="mt-1 text-xs text-slate-500">Latest recovery manifest and tracked dataset footprint.</p>
                  </div>
                  <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(state.health.recoveryManifest.status)}`}>
                    {state.health.recoveryManifest.status}
                  </Badge>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-slate-600">Migration version</dt><dd className="mt-1 font-medium text-slate-300">{state.health.recoveryManifest.migrationVersion}</dd></div>
                  <div><dt className="text-xs text-slate-600">Schema migrations</dt><dd className="mt-1 font-medium text-slate-300">{state.health.recoveryManifest.schemaMigrationCount}</dd></div>
                  <div><dt className="text-xs text-slate-600">Datasets tracked</dt><dd className="mt-1 font-medium text-slate-300">{Object.keys(state.health.recoveryManifest.datasetCounts).length}</dd></div>
                  <div><dt className="text-xs text-slate-600">Manifest created</dt><dd className="mt-1 font-medium text-slate-300">{formatDateTime(state.health.recoveryManifest.createdAt)}</dd></div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 p-5">
                <h2 className="font-semibold text-slate-50">Active health incidents</h2>
                <p className="mt-1 text-xs text-slate-500">Open and acknowledged backend incidents for this site.</p>
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
                  {state.settings.configuration.persistedSettingCount > 0
                    ? `${state.settings.configuration.persistedSettingCount} persisted setting records are registered, but their values are not exposed or editable from the live pilot.`
                    : "No persisted site-setting records are currently registered. Demo toggles, approval thresholds, invites and billing fields are therefore withheld from live mode."}
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
