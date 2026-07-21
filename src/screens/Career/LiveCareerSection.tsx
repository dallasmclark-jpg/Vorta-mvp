import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Route,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { validateCareerEvidencePayload } from "../../lib/liveEvidenceContracts";
import { RuntimeContractError } from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";

type CareerPath = {
  id: string;
  engineerId: string;
  engineerName: string;
  currentJobRole: string;
  targetJobRole: string;
  pathName: string;
  pathwayCategory: string;
  readinessScore: number;
  estimatedTimeframe: string | null;
  updatedAt: string;
  requirementCount: number;
  completedRequirementCount: number;
  evidenceItemsRequired: number;
  evidenceItemsCompleted: number;
  targetCompletionDate: string | null;
  developmentSummary: string | null;
};

type CareerRequirement = {
  id: string;
  engineerName: string;
  name: string;
  requirementType: string;
  currentLevel: number | null;
  targetLevel: number | null;
  status: string;
  priority: string;
  notes: string | null;
};

type CareerPayload = {
  siteId: string;
  organisationId: string;
  generatedAt: string;
  stats: {
    activePathCount: number;
    engineerCount: number;
    averageReadiness: number;
    readySoonCount: number;
    requirementCount: number;
    completedRequirementCount: number;
  };
  paths: CareerPath[];
  requirements: CareerRequirement[];
};

const completeStatuses = new Set(["complete", "completed", "met", "verified"]);

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatFreshness(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Freshness unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function scoreClass(value: number): string {
  if (value >= 80) return "text-emerald-300";
  if (value >= 65) return "text-amber-300";
  return "text-orange-300";
}

function barClass(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 65) return "bg-amber-400";
  return "bg-orange-500";
}

function priorityClass(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "critical": return "border-red-500/30 bg-red-500/10 text-red-300";
    case "high": return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "medium": return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default: return "border-slate-700 bg-slate-800/60 text-slate-300";
  }
}

export function LiveCareerSection(): JSX.Element {
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<CareerPayload | null>(null);
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
      const { data, error: requestError } = await supabase.functions.invoke(
        "career-evidence-data",
        { body: { schemaVersion: "career-evidence-v1" } },
      );
      if (requestError || !data) throw requestError ?? new Error("Career evidence was empty");

      const validated = validateCareerEvidencePayload(data) as unknown as CareerPayload;
      if (
        validated.siteId !== siteContext.siteId ||
        validated.organisationId !== siteContext.organisationId
      ) {
        throw new RuntimeContractError(
          "Career evidence",
          "response scope did not match the authenticated site",
        );
      }
      setPayload(validated);
    } catch (loadError) {
      setPayload(null);
      setError(loadError instanceof Error ? loadError.message : "Verified career evidence is unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteContext?.organisationId, siteContext?.siteId]);

  useEffect(() => { void load(true); }, [load]);

  const paths = useMemo(() => payload?.paths.slice(0, 12) ?? [], [payload]);
  const requirements = useMemo(
    () => payload?.requirements
      .filter((row) => !completeStatuses.has(row.status.toLowerCase()))
      .slice(0, 10) ?? [],
    [payload],
  );

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Read-only live pilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Career Evidence</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Active-site career paths and development requirements. This is workforce evidence, not a personal profile for the signed-in manager.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading || refreshing}
          aria-label="Refresh verified career evidence"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-100 hover:bg-white/15 disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading career evidence">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />)}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-5 sm:flex-row sm:items-center" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-red-100">Career evidence was withheld</p>
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
            <span>Generated: {formatFreshness(payload.generatedAt)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Active paths", payload.stats.activePathCount, Route, "text-blue-300"],
              ["Engineers covered", payload.stats.engineerCount, Users, "text-slate-100"],
              ["Average readiness", `${payload.stats.averageReadiness.toFixed(0)}%`, TrendingUp, scoreClass(payload.stats.averageReadiness)],
              ["Open requirements", payload.stats.requirementCount - payload.stats.completedRequirementCount, Target, "text-amber-300"],
            ].map(([label, value, Icon, valueClass]) => {
              const MetricIcon = Icon as typeof Route;
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

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 p-5">
                <h2 className="font-semibold text-slate-50">Active development paths</h2>
                <p className="mt-1 text-xs text-slate-500">Readiness is recorded evidence. No career decision is written from this page.</p>
              </div>
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                {paths.length === 0 ? <p className="p-1 text-sm text-slate-500">No active career paths are recorded.</p> : paths.map((path) => (
                  <article key={path.id} className="rounded-xl border border-gray-800 bg-[#111620] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{path.engineerName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{path.pathName}</p>
                      </div>
                      <Badge className="h-auto shrink-0 rounded border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300 shadow-none">{path.pathwayCategory}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
                      <div><p className="text-slate-600">Current</p><p className="mt-1 font-medium text-slate-300">{path.currentJobRole}</p></div>
                      <TrendingUp className="h-4 w-4 text-slate-600" aria-hidden="true" />
                      <div className="text-right"><p className="text-slate-600">Target</p><p className="mt-1 font-medium text-slate-200">{path.targetJobRole}</p></div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-500">Readiness</span><span className={`font-semibold ${scoreClass(path.readinessScore)}`}>{path.readinessScore.toFixed(0)}%</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800"><div className={`h-full rounded-full ${barClass(path.readinessScore)}`} style={{ width: `${path.readinessScore}%` }} /></div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                      <div><p className="text-slate-600">Requirements</p><p className="mt-0.5 font-semibold text-slate-300">{path.completedRequirementCount}/{path.requirementCount}</p></div>
                      <div><p className="text-slate-600">Evidence</p><p className="mt-0.5 font-semibold text-slate-300">{path.evidenceItemsCompleted}/{path.evidenceItemsRequired}</p></div>
                      <div><p className="text-slate-600">Target date</p><p className="mt-0.5 font-semibold text-slate-300">{formatDate(path.targetCompletionDate)}</p></div>
                    </div>
                    {path.developmentSummary ? <p className="mt-4 text-xs leading-5 text-slate-400">{path.developmentSummary}</p> : null}
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-600"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{path.estimatedTimeframe ?? "Timeframe not recorded"}</div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="border-b border-gray-800 p-5"><h2 className="font-semibold text-slate-50">Open development requirements</h2><p className="mt-1 text-xs text-slate-500">Highest-priority incomplete evidence items.</p></div>
              <div className="divide-y divide-gray-800/80">
                {requirements.length === 0 ? <p className="p-5 text-sm text-slate-500">No incomplete development requirements are recorded.</p> : requirements.map((row) => (
                  <div key={row.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start">
                    <div className="min-w-0"><p className="text-sm font-semibold text-slate-100">{row.name}</p><p className="mt-0.5 text-xs text-slate-500">{row.engineerName} · {row.requirementType.replaceAll("_", " ")}</p>{row.notes ? <p className="mt-2 text-xs leading-5 text-slate-400">{row.notes}</p> : null}</div>
                    <div className="flex shrink-0 items-center gap-2">{row.currentLevel !== null && row.targetLevel !== null ? <span className="text-xs font-semibold text-slate-400">{row.currentLevel} → {row.targetLevel}</span> : null}<Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${priorityClass(row.priority)}`}>{row.priority}</Badge></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  );
}
