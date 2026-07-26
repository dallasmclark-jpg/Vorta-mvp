import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import type { VortaDataMode } from "../../lib/dataTrust";
import {
  clearMaintenancePortalDataCache,
  supabase,
} from "../../lib/supabaseClient";
import { validateSkillsMatrixPayload } from "../../lib/runtimeContracts";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const SKILLS_MATRIX_OPTIONS = { body: { schemaVersion: "capability-v3" } };

type ScopeStatus = "Strong" | "Moderate" | "At risk" | "Critical";

type ScopeSummary = {
  id: string;
  code: string;
  name: string;
  memberCount: number;
  score: number;
  criticalGaps: number;
  spofCount: number;
  trainingNeeds: number;
  affectedEquipment: number;
  status: ScopeStatus;
};

type PriorityRisk = {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  area: string;
  skillName: string;
  minimumRequired: number;
  qualifiedCount: number;
  singlePoint: boolean;
  criticality: string;
  recommendedAction: string;
  riskRank: number;
};

type ScopeDetail = {
  scopeId: string;
  priorityRisks: PriorityRisk[];
};

type SkillsPayload = {
  sourceUpdatedAt: string;
  site: { id: string; name: string };
  overall: ScopeSummary;
  teams: ScopeSummary[];
  departments: ScopeSummary[];
  details: Record<string, ScopeDetail>;
};

function parsePayload(value: unknown): SkillsPayload {
  return validateSkillsMatrixPayload(value) as unknown as SkillsPayload;
}

function scoreTone(score: number): string {
  if (score >= 85) return "text-emerald-300";
  if (score >= 70) return "text-blue-300";
  if (score >= 55) return "text-amber-300";
  return "text-red-300";
}

function statusTone(status: ScopeStatus): string {
  if (status === "Strong") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "Moderate") {
    return "border-blue-500/25 bg-blue-500/10 text-blue-300";
  }
  if (status === "At risk") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  }
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function freshness(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Source time unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  if (minutes < 24 * 60) return `Updated ${Math.round(minutes / 60)}h ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function Metric({
  label,
  value,
  detail,
  tone = "text-slate-50",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function MobileCapabilitySummary({
  dataMode,
}: {
  dataMode: VortaDataMode;
}): JSX.Element {
  const navigate = useNavigate();
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<SkillsPayload | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState("overall");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false): Promise<void> => {
    if (force) {
      clearMaintenancePortalDataCache(SKILLS_MATRIX_FUNCTION);
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        SKILLS_MATRIX_FUNCTION,
        SKILLS_MATRIX_OPTIONS,
      );
      if (invokeError || !data) {
        throw invokeError ?? new Error("Capability evidence was empty.");
      }
      const resolved = parsePayload(data);
      if (siteContext?.siteId && resolved.site.id !== siteContext.siteId) {
        throw new Error("Capability evidence does not match the authorised active site.");
      }
      setPayload(resolved);
      setSelectedScopeId((current) =>
        resolved.details[current] ? current : resolved.overall.id,
      );
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Capability evidence could not be loaded.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteContext?.siteId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const scopes = useMemo(
    () => (payload ? [payload.overall, ...payload.teams, ...payload.departments] : []),
    [payload],
  );
  const selectedSummary = useMemo(
    () => scopes.find((scope) => scope.id === selectedScopeId) ?? payload?.overall ?? null,
    [payload?.overall, scopes, selectedScopeId],
  );
  const selectedDetail = selectedSummary
    ? payload?.details[selectedSummary.id] ?? null
    : null;
  const priorityRisks = useMemo(
    () =>
      [...(selectedDetail?.priorityRisks ?? [])]
        .sort((left, right) => left.riskRank - right.riskRank)
        .slice(0, 4),
    [selectedDetail?.priorityRisks],
  );

  return (
    <section
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pb-28 pt-4"
      data-vorta-mobile-skills-matrix="true"
      data-vorta-mobile-capability-summary="true"
    >
      <header className="flex items-start justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            {dataMode === "live"
              ? "Verified capability"
              : dataMode === "demo"
                ? "Demo capability"
                : "Capability unavailable"}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Capability Summary</h1>
          <p className="mt-1 text-sm text-slate-400">
            Current workforce coverage, critical gaps and affected assets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          aria-label="Refresh capability summary"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <p className="font-semibold">Capability evidence unavailable</p>
          </div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
        </div>
      ) : null}

      {loading && !payload ? (
        <div className="grid grid-cols-2 gap-2" role="status" aria-label="Loading capability summary">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl border border-gray-800 bg-[#141820]"
            />
          ))}
        </div>
      ) : selectedSummary && selectedDetail ? (
        <>
          <div
            className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Capability scopes"
          >
            {scopes.map((scope) => (
              <button
                key={scope.id}
                type="button"
                aria-pressed={selectedSummary.id === scope.id}
                onClick={() => setSelectedScopeId(scope.id)}
                className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                  selectedSummary.id === scope.id
                    ? "border-blue-500 bg-blue-500/15 text-blue-200"
                    : "border-gray-800 bg-[#141820] text-slate-400"
                }`}
              >
                {scope.name}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#10151d] p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{selectedSummary.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedSummary.memberCount} engineers · {selectedSummary.affectedEquipment} affected assets
              </p>
            </div>
            <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone(selectedSummary.status)}`}>
              {selectedSummary.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Capability score"
              value={`${Math.round(selectedSummary.score)}%`}
              detail="Current model"
              tone={scoreTone(selectedSummary.score)}
            />
            <Metric
              label="Critical gaps"
              value={String(selectedSummary.criticalGaps)}
              detail="Immediate action"
              tone={selectedSummary.criticalGaps > 0 ? "text-red-300" : "text-emerald-300"}
            />
            <Metric
              label="Single points"
              value={String(selectedSummary.spofCount)}
              detail="Resilience exposure"
              tone={selectedSummary.spofCount > 0 ? "text-amber-300" : "text-emerald-300"}
            />
            <Metric
              label="Training needs"
              value={String(selectedSummary.trainingNeeds)}
              detail="Recorded needs"
              tone={selectedSummary.trainingNeeds > 0 ? "text-blue-300" : "text-emerald-300"}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-50">Priority capability gaps</h2>
              <p className="text-xs text-slate-500">
                {payload ? freshness(payload.sourceUpdatedAt) : "Source time unavailable"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-800 bg-[#141820] px-2 py-1 text-[10px] font-semibold text-slate-400">
              <ShieldAlert className="h-3 w-3" /> Read only
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {priorityRisks.map((risk) => (
              <button
                key={risk.id}
                type="button"
                onClick={() => navigate(`/equipment/${encodeURIComponent(risk.equipmentId)}/skills`)}
                className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left active:bg-[#1a2030]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300">
                        {risk.criticality}
                      </span>
                      {risk.singlePoint ? (
                        <span className="text-[10px] font-semibold text-amber-300">Single point</span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 font-semibold leading-5 text-slate-100">{risk.skillName}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {risk.equipmentName} · {risk.equipmentCode}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-slate-400">
                      {risk.qualifiedCount} of {risk.minimumRequired} qualified. {risk.recommendedAction}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                </div>
              </button>
            ))}

            {priorityRisks.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-sm font-semibold">No current critical capability gaps</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => navigate("/requirements")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              Review requirements <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/engineers")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              <span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-blue-300" />Review engineers</span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/equipment")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              <span className="inline-flex items-center gap-2"><Wrench className="h-4 w-4 text-violet-300" />Review affected assets</span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
