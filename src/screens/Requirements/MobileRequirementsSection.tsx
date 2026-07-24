import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Users,
  X,
} from "lucide-react";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { useAuth } from "../../lib/auth";
import type { VortaDataMode } from "../../lib/dataTrust";
import { supabase } from "../../lib/supabaseClient";

type Requirement = {
  id: string;
  title: string;
  skill_category: string;
  area: string;
  group: string;
  department_name: string | null;
  required_level: number;
  current_avg: number;
  engineers_qualified: number;
  engineers_below: number;
  gap: number;
  coverage_pct: number;
  training_required: number;
  is_critical: boolean;
  certification_required: boolean;
  single_point_of_failure: boolean;
  risk_level: string;
  priority: string;
  status: string;
  recommendation: string;
};

type RequirementsStats = {
  totalReqs: number;
  fullyCovered: number;
  skillsAtRisk: number;
  criticalGaps: number;
};

const EMPTY_STATS: RequirementsStats = {
  totalReqs: 0,
  fullyCovered: 0,
  skillsAtRisk: 0,
  criticalGaps: 0,
};

const PRIORITIES = ["all", "Critical", "High", "Medium", "Low"] as const;
const STATUSES = ["all", "Critical Gap", "Partial Gap", "Training Required", "Covered"] as const;

function priorityRank(value: string): number {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[value] ?? 4;
}

function tone(value: string): string {
  const normalised = value.toLowerCase();
  if (normalised.includes("critical")) return "border-red-500/30 bg-red-500/10 text-red-300";
  if (normalised.includes("high") || normalised.includes("partial")) return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (normalised.includes("medium") || normalised.includes("training")) return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export function MobileRequirementsSection({ dataMode }: { dataMode: VortaDataMode }): JSX.Element {
  const navigate = useNavigate();
  const { siteContext } = useAuth();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [stats, setStats] = useState<RequirementsStats>(EMPTY_STATS);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("requirements-data");
      if (invokeError || !data || !Array.isArray(data.requirements)) {
        throw invokeError ?? new Error("Requirement evidence could not be loaded.");
      }
      if (siteContext?.siteId && data.siteId && data.siteId !== siteContext.siteId) {
        throw new Error("Requirement evidence does not match the authorised active site.");
      }
      setRequirements(data.requirements as Requirement[]);
      setStats({ ...EMPTY_STATS, ...(data.stats as Partial<RequirementsStats> | undefined) });
    } catch (loadError) {
      setRequirements([]);
      setStats(EMPTY_STATS);
      setError(loadError instanceof Error ? loadError.message : "Requirement evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRequirements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...requirements]
      .filter((requirement) => {
        if (priority !== "all" && requirement.priority !== priority) return false;
        if (status !== "all" && requirement.status !== status) return false;
        if (!query) return true;
        return [requirement.title, requirement.area, requirement.department_name, requirement.skill_category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort(
        (left, right) =>
          priorityRank(left.priority) - priorityRank(right.priority) ||
          left.coverage_pct - right.coverage_pct ||
          right.gap - left.gap,
      );
  }, [priority, requirements, search, status]);

  const activeFilterCount = Number(priority !== "all") + Number(status !== "all");
  const clearFilters = (): void => {
    setPriority("all");
    setStatus("all");
  };

  return (
    <section className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pb-24 pt-4" data-vorta-mobile-requirements="true">
      <DetailDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)}>
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Mobile filters</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-50">Requirement filters</h2>
          </div>
          <DrawerCloseButton onClose={() => setFiltersOpen(false)} />
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Priority</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PRIORITIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={priority === option}
                  onClick={() => setPriority(option)}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${
                    priority === option
                      ? "border-blue-500 bg-blue-500/15 text-blue-200"
                      : "border-gray-800 bg-[#141820] text-slate-300"
                  }`}
                >
                  {option === "all" ? "All priorities" : option}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</legend>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {STATUSES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={status === option}
                  onClick={() => setStatus(option)}
                  className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold ${
                    status === option
                      ? "border-blue-500 bg-blue-500/15 text-blue-200"
                      : "border-gray-800 bg-[#141820] text-slate-300"
                  }`}
                >
                  {option === "all" ? "All statuses" : option}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-gray-800 pt-4">
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-12 rounded-xl border border-gray-800 bg-[#141820] text-sm font-semibold text-slate-200"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="min-h-12 rounded-xl bg-blue-600 text-sm font-semibold text-white"
            >
              Show {filteredRequirements.length}
            </button>
          </div>
        </div>
      </DetailDrawer>

      <DetailDrawer open={Boolean(selectedRequirement)} onClose={() => setSelectedRequirement(null)}>
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="min-w-0 pr-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${tone(selectedRequirement?.priority ?? "")}`}>
                {selectedRequirement?.priority ?? "Requirement"}
              </span>
              {selectedRequirement?.single_point_of_failure ? (
                <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-300">Single point</span>
              ) : null}
            </div>
            <h2 className="mt-3 text-lg font-semibold leading-6 text-slate-50">{selectedRequirement?.title ?? "Requirement"}</h2>
            <p className="mt-1 text-sm text-slate-400">{selectedRequirement?.area ?? "Site requirement"}</p>
          </div>
          <DrawerCloseButton onClose={() => setSelectedRequirement(null)} />
        </div>
        <div className="grid grid-cols-4 divide-x divide-gray-800 border-b border-gray-800">
          <div className="p-3">
            <p className="text-[9px] text-slate-500">Coverage</p>
            <p className="mt-1 text-lg font-semibold text-blue-300">{selectedRequirement?.coverage_pct ?? 0}%</p>
          </div>
          <div className="p-3">
            <p className="text-[9px] text-slate-500">Qualified</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{selectedRequirement?.engineers_qualified ?? 0}</p>
          </div>
          <div className="p-3">
            <p className="text-[9px] text-slate-500">Gap</p>
            <p className="mt-1 text-lg font-semibold text-orange-300">{selectedRequirement?.gap ?? 0}</p>
          </div>
          <div className="p-3">
            <p className="text-[9px] text-slate-500">Training</p>
            <p className="mt-1 text-lg font-semibold text-amber-300">{selectedRequirement?.training_required ?? 0}</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recorded recommendation</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {selectedRequirement?.recommendation || "No recommendation is recorded for this requirement."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
              <p className="text-[10px] text-slate-500">Required level</p>
              <p className="mt-1 font-semibold text-slate-100">L{selectedRequirement?.required_level ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
              <p className="text-[10px] text-slate-500">Current average</p>
              <p className="mt-1 font-semibold text-slate-100">{selectedRequirement?.current_avg?.toFixed(1) ?? "0.0"}/5</p>
            </div>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => navigate("/skills-matrix")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              View capability evidence <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/engineers")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              Find engineers <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/training")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-100"
            >
              Review training <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/ai-matching")}
              className="inline-flex min-h-12 items-center justify-between rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              Open AI Matching <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DetailDrawer>

      <header className="flex items-start justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            {dataMode === "live" ? "Verified requirements" : "Demo requirements"}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Requirements</h1>
          <p className="mt-1 text-sm text-slate-400">Site capabilities that need attention.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh requirement evidence"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <p className="font-semibold">Requirement evidence unavailable</p>
          </div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Critical gaps" value={loading ? "—" : String(stats.criticalGaps)} detail="Immediate action" />
            <Metric label="Skills at risk" value={loading ? "—" : String(stats.skillsAtRisk)} detail="Partial coverage" />
            <Metric label="Fully covered" value={loading ? "—" : String(stats.fullyCovered)} detail={`of ${stats.totalReqs} requirements`} />
            <Metric label="Coverage" value={loading || stats.totalReqs === 0 ? "—" : `${Math.round((stats.fullyCovered / stats.totalReqs) * 100)}%`} detail="Site requirements" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <span className="sr-only">Search requirements</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search requirements"
                className="min-h-12 w-full rounded-xl border border-gray-800 bg-[#10151d] pl-10 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </label>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative inline-flex min-h-12 items-center gap-2 rounded-xl border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-200"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] text-white">{activeFilterCount}</span>
              ) : null}
            </button>
          </div>

          {activeFilterCount > 0 ? (
            <button type="button" onClick={clearFilters} className="inline-flex min-h-10 items-center gap-1 self-start text-xs font-semibold text-slate-400">
              <X className="h-3.5 w-3.5" /> Clear active filters
            </button>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-50">Priority requirements</h2>
              <p className="text-xs text-slate-500">{filteredRequirements.length} records ordered by risk</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-800 bg-[#141820] px-2 py-1 text-[10px] font-semibold text-slate-400">
              <Shield className="h-3 w-3" /> Site scope
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {loading && requirements.length === 0
              ? Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="h-36 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
                ))
              : filteredRequirements.map((requirement) => (
                  <button
                    key={requirement.id}
                    type="button"
                    onClick={() => setSelectedRequirement(requirement)}
                    aria-label={`Review ${requirement.title}`}
                    className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 active:bg-[#1a2030]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${tone(requirement.priority)}`}>{requirement.priority}</span>
                          {requirement.single_point_of_failure ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300"><Shield className="h-3 w-3" />SPOF</span>
                          ) : null}
                          {requirement.certification_required ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-300"><CheckCircle2 className="h-3 w-3" />Cert</span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 font-semibold leading-5 text-slate-100">{requirement.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">{requirement.area}{requirement.department_name ? ` · ${requirement.department_name}` : ""}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-semibold tabular-nums text-blue-300">{requirement.coverage_pct}%</p>
                        <p className="text-[10px] text-slate-600">coverage</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-800 pt-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-600">Qualified</p>
                        <p className="mt-1 text-sm font-semibold text-slate-200">{requirement.engineers_qualified}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-600">Gap</p>
                        <p className="mt-1 text-sm font-semibold text-orange-300">{requirement.gap}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-wider text-slate-600">Training</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
                          <Users className="h-3.5 w-3.5" />{requirement.training_required}<ChevronRight className="h-4 w-4 text-slate-600" />
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
          </div>
        </>
      )}
    </section>
  );
}
