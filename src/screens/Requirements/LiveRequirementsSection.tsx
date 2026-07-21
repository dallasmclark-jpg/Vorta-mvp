import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { useAuth } from "../../lib/auth";
import {
  RuntimeContractError,
  validateRequirementsPayload,
} from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";

interface Requirement {
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
  snapshot_date: string;
}

interface CoverageGroup {
  group: string;
  total: number;
  gaps: number;
  covered: number;
  pct: number;
}

interface RequirementsStats {
  totalReqs: number;
  fullyCovered: number;
  skillsAtRisk: number;
  criticalGaps: number;
}

interface RequirementsPayload {
  requirements: Requirement[];
  coverageByGroup: CoverageGroup[];
  certExpiries: Array<{
    engineer_name: string;
    skill_name: string;
    expiry_date: string | null;
  }>;
  actionRows: Array<{
    type: string;
    title: string;
    subtitle: string;
    urgency: string;
  }>;
  stats: RequirementsStats;
  departments: Array<{ id: string; name: string }>;
}

function priorityClass(priority: string): string {
  switch (priority.toLowerCase()) {
    case "critical":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "medium":
      return "border-amber-500/25 bg-amber-500/10 text-amber-300";
    default:
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
}

function statusClass(status: string): string {
  if (/critical/i.test(status)) return "text-red-300";
  if (/partial|training/i.test(status)) return "text-amber-300";
  if (/covered/i.test(status)) return "text-emerald-300";
  return "text-slate-300";
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function RequirementDrawer({
  requirement,
  onClose,
}: {
  requirement: Requirement | null;
  onClose: () => void;
}): JSX.Element {
  return (
    <DetailDrawer open={Boolean(requirement)} onClose={onClose}>
      <div className="flex items-start justify-between border-b border-gray-800 p-5">
        <div className="min-w-0 pr-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Verified requirement evidence
          </p>
          <h2 className="mt-1 text-base font-semibold leading-snug text-slate-50">
            {requirement?.title ?? "Requirement"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {requirement?.skill_category ?? ""}
          </p>
        </div>
        <DrawerCloseButton onClose={onClose} />
      </div>

      {requirement ? (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 border-b border-gray-800 p-5 sm:grid-cols-4">
            {[
              ["Coverage", `${requirement.coverage_pct}%`],
              ["Qualified", String(requirement.engineers_qualified)],
              ["Gap", String(requirement.gap)],
              ["Training", String(requirement.training_required)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="border-b border-gray-800 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Requirement details
            </h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["Area", requirement.area],
                ["Group", requirement.group],
                ["Department", requirement.department_name ?? "Not assigned"],
                ["Required level", `${requirement.required_level}/5`],
                ["Current average", `${requirement.current_avg.toFixed(1)}/5`],
                ["Snapshot", formatDate(requirement.snapshot_date)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${priorityClass(requirement.priority)}`}>
                {requirement.priority} priority
              </Badge>
              <span className={`text-xs font-semibold ${statusClass(requirement.status)}`}>
                {requirement.status}
              </span>
              {requirement.single_point_of_failure ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-300">
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" /> Single point of failure
                </span>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {requirement.recommendation || "No recommendation is stored for this requirement."}
            </p>
          </div>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

export const LiveRequirementsSection = (): JSX.Element => {
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<RequirementsPayload | null>(null);
  const [selected, setSelected] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");

  const load = useCallback(async (initial = false): Promise<void> => {
    if (!siteContext?.siteId) {
      setPayload(null);
      setError("An active maintenance site could not be resolved for this account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const { data, error: requestError } = await supabase.functions.invoke("requirements-data");
    if (requestError || !data) {
      setPayload(null);
      setError(requestError?.message ?? "Verified requirements evidence is unavailable.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const validated = validateRequirementsPayload(data) as unknown as RequirementsPayload;
      setPayload(validated);
    } catch (contractError) {
      console.warn("Requirements response failed runtime validation:", contractError);
      setPayload(null);
      setError(
        contractError instanceof RuntimeContractError
          ? contractError.message
          : "The requirements response did not match the expected evidence contract.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteContext?.siteId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const requirements = payload?.requirements ?? [];
  const latestSnapshot = useMemo(() => {
    const dates = requirements.map((item) => item.snapshot_date).filter(Boolean).sort();
    return dates.at(-1) ?? null;
  }, [requirements]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requirements.filter((requirement) => {
      if (
        query &&
        !requirement.title.toLowerCase().includes(query) &&
        !requirement.area.toLowerCase().includes(query) &&
        !requirement.skill_category.toLowerCase().includes(query)
      ) {
        return false;
      }
      return priority === "all" || requirement.priority.toLowerCase() === priority;
    });
  }, [priority, requirements, search]);

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <RequirementDrawer requirement={selected} onClose={() => setSelected(null)} />

      <header className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Read-only live pilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Requirements</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Verified site capability requirements and coverage evidence. Vorta does not write changes back to the source system.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading || refreshing}
          aria-label="Refresh verified requirements evidence"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading requirements evidence">
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
              <p className="text-sm font-semibold text-red-100">Requirements evidence was withheld</p>
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

      {!loading && payload ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3 text-xs text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-blue-300" aria-hidden="true" />
            <span className="font-semibold text-blue-200">Runtime-validated evidence</span>
            <span>Active site: {siteContext?.siteId}</span>
            <span>Latest snapshot: {formatDate(latestSnapshot)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total requirements", payload.stats.totalReqs, ClipboardList],
              ["Fully covered", payload.stats.fullyCovered, CheckCircle2],
              ["Skills at risk", payload.stats.skillsAtRisk, AlertTriangle],
              ["Critical gaps", payload.stats.criticalGaps, Shield],
            ].map(([label, value, Icon]) => {
              const MetricIcon = Icon as typeof ClipboardList;
              return (
                <Card key={String(label)} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="flex items-start justify-between gap-4 p-5">
                    <div>
                      <p className="text-xs font-medium text-slate-400">{String(label)}</p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-50">{Number(value)}</p>
                    </div>
                    <MetricIcon className="h-4 w-4 text-slate-600" aria-hidden="true" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-semibold text-slate-50">Verified requirements register</h2>
                  <p className="mt-1 text-sm text-slate-400">{filtered.length} of {requirements.length} records shown</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative">
                    <span className="sr-only">Search requirements</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search requirements"
                      className="h-9 min-w-[220px] rounded-lg border border-gray-800 bg-[#0b0e14] pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                    />
                  </label>
                  <label>
                    <span className="sr-only">Filter by priority</span>
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                      className="h-9 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/60"
                    >
                      <option value="all">All priorities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                  <thead className="border-b border-gray-800 bg-[#0f1318] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Requirement</th>
                      <th className="px-4 py-3">Area</th>
                      <th className="px-4 py-3 text-center">Level</th>
                      <th className="px-4 py-3 text-center">Qualified</th>
                      <th className="px-4 py-3 text-center">Coverage</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                          No verified requirements match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((requirement) => (
                        <tr key={requirement.id} className="border-b border-gray-800/60 last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-200">{requirement.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{requirement.skill_category}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{requirement.area}</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-200">{requirement.required_level}/5</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-200">{requirement.engineers_qualified}</td>
                          <td className="px-4 py-3 text-center font-semibold tabular-nums text-blue-300">{requirement.coverage_pct}%</td>
                          <td className="px-4 py-3">
                            <Badge className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${priorityClass(requirement.priority)}`}>
                              {requirement.priority}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 text-xs font-semibold ${statusClass(requirement.status)}`}>
                            {requirement.status}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelected(requirement)}
                              aria-label={`Review ${requirement.title}`}
                              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <h2 className="font-semibold text-slate-50">Coverage by category</h2>
                <div className="mt-4 space-y-3">
                  {payload.coverageByGroup.map((group) => (
                    <div key={group.group} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-200">{group.group}</span>
                        <span className="text-sm font-semibold tabular-nums text-blue-300">{group.pct}%</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{group.covered} covered · {group.gaps} gaps · {group.total} total</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <h2 className="font-semibold text-slate-50">Evidence notes</h2>
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                  <p className="flex items-start gap-2"><Users className="mt-1 h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />Coverage is calculated from the validated engineer and requirement records returned for the authenticated site.</p>
                  <p className="flex items-start gap-2"><Shield className="mt-1 h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />Malformed or incomplete responses are withheld rather than displayed as operational evidence.</p>
                  <p className="flex items-start gap-2"><ClipboardList className="mt-1 h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />This pilot page is deliberately read-only. Requirement creation and source-system write-back are not implied.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
};
