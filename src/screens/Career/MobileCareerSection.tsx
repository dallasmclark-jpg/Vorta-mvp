import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Route,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { MobilePageHeader } from "../../components/MobilePageHeader";
import { useAuth } from "../../lib/auth";
import type { VortaDataMode } from "../../lib/dataTrust";
import { validateCareerEvidencePayload } from "../../lib/liveEvidenceContracts";
import { RuntimeContractError } from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";

type CareerPath = {
  id: string;
  engineerName: string;
  currentJobRole: string;
  targetJobRole: string;
  pathName: string;
  pathwayCategory: string;
  readinessScore: number;
  estimatedTimeframe: string | null;
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

const DEMO_PAYLOAD: CareerPayload = {
  siteId: "demo",
  organisationId: "demo",
  generatedAt: "",
  stats: {
    activePathCount: 1,
    engineerCount: 1,
    averageReadiness: 66,
    readySoonCount: 0,
    requirementCount: 4,
    completedRequirementCount: 0,
  },
  paths: [
    {
      id: "demo-manager-path",
      engineerName: "Dallas Clark",
      currentJobRole: "Maintenance Manager",
      targetJobRole: "Maintenance & Reliability Director",
      pathName: "Maintenance leadership pathway",
      pathwayCategory: "Management",
      readinessScore: 66,
      estimatedTimeframe: "9–12 months",
      requirementCount: 4,
      completedRequirementCount: 0,
      evidenceItemsRequired: 4,
      evidenceItemsCompleted: 0,
      targetCompletionDate: null,
      developmentSummary: "Close the remaining asset governance, finance and executive leadership requirements.",
    },
  ],
  requirements: [
    { id: "cmrp", engineerName: "Dallas Clark", name: "Certified Maintenance & Reliability Professional", requirementType: "Certification", currentLevel: null, targetLevel: null, status: "open", priority: "High", notes: "Professional reliability certification." },
    { id: "iso55001", engineerName: "Dallas Clark", name: "ISO 55001 Asset Management Lead Implementer", requirementType: "Training", currentLevel: null, targetLevel: null, status: "open", priority: "High", notes: "Asset-management governance capability." },
    { id: "finance", engineerName: "Dallas Clark", name: "Finance for Senior Engineering Leaders", requirementType: "Training", currentLevel: null, targetLevel: null, status: "open", priority: "Medium", notes: "Capital allocation and lifecycle cost." },
    { id: "leadership", engineerName: "Dallas Clark", name: "Strategic Leadership & Organisational Change", requirementType: "Training", currentLevel: null, targetLevel: null, status: "open", priority: "Medium", notes: "Enterprise leadership and change governance." },
  ],
};

const completeStatuses = new Set(["complete", "completed", "met", "verified"]);

function scoreTone(value: number): string {
  if (value >= 80) return "text-emerald-300";
  if (value >= 65) return "text-amber-300";
  return "text-orange-300";
}

function barTone(value: number): string {
  if (value >= 80) return "bg-emerald-500";
  if (value >= 65) return "bg-amber-400";
  return "bg-orange-500";
}

function priorityTone(value: string): string {
  const priority = value.toLowerCase();
  if (priority === "critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (priority === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function formatDate(value: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function MobileCareerSection({ dataMode }: { dataMode: VortaDataMode }): JSX.Element {
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<CareerPayload | null>(dataMode === "demo" ? DEMO_PAYLOAD : null);
  const [loading, setLoading] = useState(dataMode === "live");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (dataMode === "demo") {
      setPayload(DEMO_PAYLOAD);
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
      const { data, error: requestError } = await supabase.functions.invoke("career-evidence-data", {
        body: { schemaVersion: "career-evidence-v1" },
      });
      if (requestError || !data) throw requestError ?? new Error("Career evidence was empty.");

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
      setError(loadError instanceof Error ? loadError.message : "Workforce development evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [dataMode, siteContext?.organisationId, siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const paths = payload?.paths ?? [];
  const openRequirements = useMemo(
    () =>
      (payload?.requirements ?? []).filter(
        (requirement) => !completeStatuses.has(requirement.status.toLowerCase()),
      ),
    [payload?.requirements],
  );

  return (
    <section
      data-vorta-mobile-career="true"
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pt-4"
    >
      <MobilePageHeader
        eyebrow={dataMode === "live" ? "Verified workforce evidence" : "Leadership pathway"}
        title="Workforce Development"
        description="Current roles, target roles and the evidence still needed to progress."
        actionLabel="Refresh workforce development"
        busy={loading}
        onAction={() => void load()}
      />

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <p className="font-semibold">Development evidence unavailable</p>
          </div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
        </div>
      ) : null}

      {payload ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
              <p className="text-[10px] text-slate-500">Paths</p>
              <p className="mt-1 text-xl font-semibold text-slate-50">{payload.stats.activePathCount}</p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-3">
              <p className="text-[10px] text-slate-500">People</p>
              <p className="mt-1 text-xl font-semibold text-blue-300">{payload.stats.engineerCount}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
              <p className="text-[10px] text-slate-500">Open needs</p>
              <p className="mt-1 text-xl font-semibold text-amber-300">{openRequirements.length}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-50">Development paths</h2>
              <p className="text-xs text-slate-500">Highest-priority progress evidence</p>
            </div>
            <span className={`text-lg font-semibold ${scoreTone(payload.stats.averageReadiness)}`}>
              {payload.stats.averageReadiness.toFixed(0)}%
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {paths.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-[#10151d] p-6 text-center text-sm text-slate-500">
                No active development paths are recorded.
              </div>
            ) : (
              paths.slice(0, 12).map((path) => (
                <article key={path.id} className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-100">{path.engineerName}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{path.pathName}</p>
                    </div>
                    <span className={`shrink-0 text-xl font-semibold tabular-nums ${scoreTone(path.readinessScore)}`}>
                      {path.readinessScore.toFixed(0)}%
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-3">
                    <div className="flex items-center gap-2 text-blue-300">
                      <Route className="h-4 w-4" aria-hidden="true" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Current role</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{path.currentJobRole}</p>
                  </div>

                  <div className="flex justify-center py-2 text-slate-600" aria-hidden="true">
                    <ChevronDown className="h-5 w-5" />
                  </div>

                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-3">
                    <div className="flex items-center gap-2 text-violet-300">
                      <Target className="h-4 w-4" aria-hidden="true" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Target role</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{path.targetJobRole}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Readiness</span>
                    <span className={`font-semibold ${scoreTone(path.readinessScore)}`}>{path.readinessScore.toFixed(0)}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                    <div className={`h-full rounded-full ${barTone(path.readinessScore)}`} style={{ width: `${Math.max(0, Math.min(100, path.readinessScore))}%` }} />
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                      <p className="text-[9px] text-slate-500">Requirements</p>
                      <p className="mt-1 text-sm font-semibold text-slate-200">{path.completedRequirementCount}/{path.requirementCount}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                      <p className="text-[9px] text-slate-500">Evidence</p>
                      <p className="mt-1 text-sm font-semibold text-slate-200">{path.evidenceItemsCompleted}/{path.evidenceItemsRequired}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-2">
                      <p className="text-[9px] text-slate-500">Target</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-200">{formatDate(path.targetCompletionDate)}</p>
                    </div>
                  </div>

                  {path.developmentSummary ? (
                    <p className="mt-3 text-xs leading-5 text-slate-400">{path.developmentSummary}</p>
                  ) : null}
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {path.estimatedTimeframe ?? "Timeframe not recorded"}
                  </p>
                </article>
              ))
            )}
          </div>

          <section className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-300" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-100">Open requirements</h2>
              </div>
              <span className="text-xs text-slate-500">{openRequirements.length}</span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {openRequirements.slice(0, 8).map((requirement) => (
                <div key={requirement.id} className="rounded-xl border border-gray-800 bg-[#0d1117] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{requirement.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{requirement.engineerName} · {requirement.requirementType}</p>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${priorityTone(requirement.priority)}`}>
                      {requirement.priority}
                    </span>
                  </div>
                  {requirement.notes ? <p className="mt-2 text-xs leading-5 text-slate-400">{requirement.notes}</p> : null}
                </div>
              ))}
              {openRequirements.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  No open development requirements.
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {loading && !payload ? (
        <div className="flex min-h-72 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-sm text-slate-400" role="status">
          <Users className="mr-2 h-4 w-4 text-blue-300" aria-hidden="true" />
          Loading workforce development evidence…
        </div>
      ) : null}
    </section>
  );
}
