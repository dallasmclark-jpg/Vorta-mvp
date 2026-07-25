import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Database,
  KeyRound,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MobilePageHeader } from "../../components/MobilePageHeader";
import { canAdministerPilot, canImportSapData } from "../../lib/accessControl";
import { useAuth } from "../../lib/auth";
import type { VortaDataMode } from "../../lib/dataTrust";
import { invokeEvidenceFunction } from "../../lib/invokeEvidenceFunction";
import {
  validateSettingsEvidencePayload,
  validateSystemHealthData,
} from "../../lib/liveEvidenceContracts";
import { RuntimeContractError } from "../../lib/runtimeContracts";
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "../../lib/theme";

type SettingsPayload = {
  siteId: string;
  organisationId: string;
  generatedAt: string;
  site: {
    name: string;
    address: string | null;
    postcode: string | null;
    region: string | null;
    timezone: string | null;
  };
  organisation: {
    name: string;
    industry: string | null;
    location: string | null;
    status: string | null;
  };
  access: {
    fullName: string;
    jobTitle: string | null;
    profileRole: string;
    appRole: string;
    grantedAt: string;
  };
  configuration: {
    persistedSettingCount: number;
    groups: string[];
  };
  health: {
    summary: {
      overallStatus: string;
      passedCount: number;
      failedCount: number;
      warningCount: number;
      riskLastRefreshedAt: string | null;
      riskAgeMinutes: number | null;
      openIncidentCount: number;
      criticalIncidentCount: number;
      highIncidentCount: number;
      latestImportStatus: string | null;
      latestImportAt: string | null;
    };
    incidents: Array<{
      id: string;
      title: string;
      severity: string;
      status: string;
      description: string | null;
    }>;
    recoveryManifest: {
      status: string;
      datasetCounts: Record<string, number>;
      createdAt: string;
    };
  };
};

type ThemeOption = {
  value: ThemePreference;
  label: string;
  detail: string;
  icon: LucideIcon;
};

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", detail: "Bright surfaces", icon: Sun },
  { value: "dark", label: "Dark", detail: "Low-glare Vorta", icon: Moon },
  { value: "system", label: "System", detail: "Follow this device", icon: Monitor },
];

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value: string): string {
  const status = value.trim().toLowerCase();
  if (["healthy", "complete", "passed", "active"].includes(status)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (["degraded", "warning", "partial"].includes(status)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

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

function getServerTheme(): ThemePreference {
  return "dark";
}

function EvidenceRow({ label: rowLabel, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-800 py-3 last:border-0">
      <span className="text-xs text-slate-500">{rowLabel}</span>
      <span className="max-w-[62%] text-right text-sm font-medium text-slate-200">{value}</span>
    </div>
  );
}

export function MobileSettingsSection({ dataMode }: { dataMode: VortaDataMode }): JSX.Element {
  const navigate = useNavigate();
  const { siteContext, role, isDemoAdmin } = useAuth();
  const themePreference = useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    getServerTheme,
  );
  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(dataMode === "live");
  const [error, setError] = useState<string | null>(null);

  const mayAdministerPilot = canAdministerPilot(role, isDemoAdmin);
  const mayImportSapData = canImportSapData(role, isDemoAdmin);

  const load = useCallback(async (): Promise<void> => {
    if (dataMode !== "live") {
      setPayload(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!siteContext?.siteId || !siteContext.organisationId) {
      setPayload(null);
      setError("An authorised active site could not be resolved.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const raw = await invokeEvidenceFunction<unknown>(
        "settings-evidence-data",
        { schemaVersion: "settings-evidence-v2" },
      );
      const settings = validateSettingsEvidencePayload(raw) as unknown as SettingsPayload;
      const health = validateSystemHealthData(settings.health) as unknown as SettingsPayload["health"];
      if (
        settings.siteId !== siteContext.siteId ||
        settings.organisationId !== siteContext.organisationId
      ) {
        throw new RuntimeContractError(
          "Settings evidence",
          "response scope did not match the authenticated site",
        );
      }
      setPayload({ ...settings, health });
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Settings evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [dataMode, siteContext?.organisationId, siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeIncidents = useMemo(
    () =>
      payload?.health.incidents.filter((incident) =>
        ["open", "acknowledged"].includes(incident.status.toLowerCase()),
      ) ?? [],
    [payload?.health.incidents],
  );
  const recoveryRows = payload
    ? Object.values(payload.health.recoveryManifest.datasetCounts).reduce(
        (total, count) => total + Number(count ?? 0),
        0,
      )
    : 0;

  return (
    <section
      data-vorta-mobile-settings="true"
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pt-4"
    >
      <MobilePageHeader
        eyebrow={dataMode === "live" ? "Verified access" : "Device and site"}
        title="Settings"
        description="Appearance, signed-in access and administration tools."
        actionLabel="Refresh settings evidence"
        busy={loading}
        onAction={dataMode === "live" ? () => void load() : undefined}
      />

      <section className="rounded-xl border border-gray-800 bg-[#141820] p-4">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-blue-300" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Appearance</h2>
            <p className="mt-0.5 text-xs text-slate-500">Saved on this device</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const selected = themePreference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setThemePreference(option.value)}
                className={`flex min-h-20 flex-col items-center justify-center rounded-xl border p-2 text-center ${
                  selected
                    ? "border-blue-500 bg-blue-500/10 text-blue-200"
                    : "border-gray-800 bg-[#0d1117] text-slate-400"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="mt-2 text-xs font-semibold">{option.label}</span>
                <span className="mt-0.5 text-[9px] text-slate-500">{option.detail}</span>
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <p className="font-semibold">Access evidence unavailable</p>
          </div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
        </div>
      ) : null}

      {dataMode === "demo" ? (
        <section className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4">
          <div className="flex items-start gap-3">
            <UserCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-blue-200">Demonstration settings</p>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Appearance is saved on this device. Site, team and approval controls remain demonstration-only until they have audited persistence.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {payload ? (
        <>
          <section className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">My access</h2>
            </div>
            <div className="mt-2">
              <EvidenceRow label="Profile" value={payload.access.fullName} />
              <EvidenceRow label="Job title" value={payload.access.jobTitle ?? "Not recorded"} />
              <EvidenceRow label="Portal role" value={label(payload.access.appRole)} />
              <EvidenceRow label="Access granted" value={formatDateTime(payload.access.grantedAt)} />
            </div>
          </section>

          <section className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">Active site</h2>
            </div>
            <div className="mt-2">
              <EvidenceRow label="Site" value={payload.site.name} />
              <EvidenceRow label="Organisation" value={payload.organisation.name} />
              <EvidenceRow label="Region" value={payload.site.region ?? payload.organisation.location ?? "Not recorded"} />
              <EvidenceRow label="Industry" value={payload.organisation.industry ?? "Not recorded"} />
            </div>
          </section>

          <details className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">System health</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Technical evidence for administrators</p>
                </div>
              </div>
              <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone(payload.health.summary.overallStatus)}`}>
                {label(payload.health.summary.overallStatus)}
              </span>
            </summary>
            <div className="mt-4 border-t border-gray-800 pt-2">
              <EvidenceRow label="Checks passed" value={`${payload.health.summary.passedCount}/${payload.health.summary.passedCount + payload.health.summary.failedCount + payload.health.summary.warningCount}`} />
              <EvidenceRow label="Active incidents" value={String(activeIncidents.length)} />
              <EvidenceRow label="Recovery rows" value={recoveryRows.toLocaleString("en-GB")} />
              <EvidenceRow label="Risk refreshed" value={formatDateTime(payload.health.summary.riskLastRefreshedAt)} />
              <EvidenceRow label="Latest import" value={formatDateTime(payload.health.summary.latestImportAt)} />
            </div>
            {activeIncidents.length ? (
              <div className="mt-3 flex flex-col gap-2">
                {activeIncidents.slice(0, 4).map((incident) => (
                  <div key={incident.id} className="rounded-xl border border-gray-800 bg-[#0d1117] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-100">{incident.title}</p>
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone(incident.severity)}`}>
                        {label(incident.severity)}
                      </span>
                    </div>
                    {incident.description ? <p className="mt-2 text-xs leading-5 text-slate-500">{incident.description}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </details>
        </>
      ) : null}

      <section className="rounded-xl border border-gray-800 bg-[#141820] p-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-100">Administration</h2>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {mayAdministerPilot ? (
            <button
              type="button"
              onClick={() => navigate("/settings/pilot-setup")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#0d1117] px-4 text-sm font-semibold text-slate-100"
            >
              Pilot Setup <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </button>
          ) : null}
          {mayImportSapData ? (
            <button
              type="button"
              onClick={() => navigate("/settings/data-import")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#0d1117] px-4 text-sm font-semibold text-slate-100"
            >
              SAP Data Import <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </button>
          ) : null}
          {!mayAdministerPilot && !mayImportSapData ? (
            <p className="text-sm text-slate-500">No administrator-only tools are assigned to this account.</p>
          ) : null}
        </div>
      </section>
    </section>
  );
}
