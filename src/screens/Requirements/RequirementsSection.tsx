import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUser as UserCircle,
  ClipboardList,
  Download,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { supabase } from "../../lib/supabaseClient";
import { ContextHelp } from "../../components/ContextHelp";
import { SyncIndicator } from "../../components/SyncIndicator";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { Select } from "../../components/Select";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface ActionRow {
  type: "cert_expiry" | "critical_gap" | "training_required" | "covered";
  title: string;
  subtitle: string;
  urgency: string;
}

interface ReqStats {
  totalReqs: number;
  fullyCovered: number;
  skillsAtRisk: number;
  criticalGaps: number;
}

interface Department { id: string; name: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLE_PAGE_SIZE = 10;

const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Critical Gap":       return "bg-[#ef444420] text-red-500";
    case "Partial Gap":        return "bg-[#f9731620] text-orange-400";
    case "Training Required":  return "bg-[#facc1520] text-yellow-400";
    case "Covered":            return "bg-[#10b98120] text-emerald-500";
    default:                   return "bg-gray-800 text-slate-400";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "Critical": return "bg-[#ef444420] text-red-500";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#facc1520] text-yellow-400";
    case "Low":      return "bg-[#10b98120] text-emerald-500";
    default:         return "bg-gray-800 text-slate-400";
  }
}

function urgencyIcon(urgency: string): { icon: React.ElementType; cls: string; bg: string; border: string } {
  switch (urgency) {
    case "critical": return { icon: AlertTriangle, cls: "text-red-500",    bg: "bg-[#ef444408]", border: "border-red-500/20"    };
    case "high":     return { icon: Zap,           cls: "text-orange-400", bg: "bg-[#f9731608]", border: "border-orange-400/20" };
    case "medium":   return { icon: Brain,         cls: "text-yellow-400", bg: "bg-[#facc1508]", border: "border-yellow-400/20" };
    default:         return { icon: CheckCircle2,  cls: "text-emerald-500",bg: "bg-[#10b98108]", border: "border-emerald-500/20" };
  }
}

function coverageBarClass(pct: number): string {
  if (pct >= 80) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-red-500";
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchRequirements(): Promise<{
  requirements: Requirement[];
  coverageByGroup: CoverageGroup[];
  certExpiries: { engineer_name: string; skill_name: string; expiry_date: string | null }[];
  actionRows: ActionRow[];
  stats: ReqStats;
  departments: Department[];
  error?: boolean;
}> {
  const { data, error } = await supabase.functions.invoke("requirements-data");
  if (error || !data) {
    return {
      requirements: [], coverageByGroup: [], certExpiries: [], actionRows: [],
      stats: { totalReqs: 0, fullyCovered: 0, skillsAtRisk: 0, criticalGaps: 0 },
      departments: [],
      error: true,
    };
  }
  return {
    requirements:    (data.requirements    ?? []) as Requirement[],
    coverageByGroup: (data.coverageByGroup ?? []) as CoverageGroup[],
    certExpiries:    (data.certExpiries    ?? []) as { engineer_name: string; skill_name: string; expiry_date: string | null }[],
    actionRows:      (data.actionRows      ?? []) as ActionRow[],
    stats:           data.stats as ReqStats,
    departments:     (data.departments     ?? []) as Department[],
  };
}

// ─── AI Insights builder ──────────────────────────────────────────────────────

interface InsightItem {
  severity: "critical" | "high" | "medium";
  title: string;
  text: string;
  icon: React.ElementType;
}

function buildInsights(requirements: Requirement[], stats: ReqStats): InsightItem[] {
  const items: InsightItem[] = [];

  const critGaps = requirements.filter((r) => r.status === "Critical Gap");
  if (critGaps.length > 0) {
    const top = critGaps[0];
    items.push({
      severity: "critical",
      icon: AlertTriangle,
      title: `${critGaps.length} critical requirement${critGaps.length !== 1 ? "s" : ""} with zero coverage`,
      text: `${top.title} is the highest-risk requirement — 0 qualified engineers vs ${top.engineers_below} below target. Immediate escalation required.`,
    });
  }

  const spofItems = requirements.filter((r) => r.single_point_of_failure);
  if (spofItems.length > 0) {
    items.push({
      severity: "critical",
      icon: Shield,
      title: `${spofItems.length} single-point-of-failure requirement${spofItems.length !== 1 ? "s" : ""}`,
      text: `Loss of one engineer would cause a total coverage failure for: ${spofItems.slice(0, 2).map((r) => r.title).join(", ")}${spofItems.length > 2 ? ` +${spofItems.length - 2} more` : ""}.`,
    });
  }

  const trainReqs = requirements.filter((r) => r.training_required > 0);
  if (trainReqs.length > 0) {
    const totalTraining = trainReqs.reduce((s, r) => s + r.training_required, 0);
    items.push({
      severity: trainReqs.length > 5 ? "high" : "medium",
      icon: BookOpen,
      title: `${totalTraining} training needs across ${trainReqs.length} requirement areas`,
      text: `Prioritise OEM equipment and pharmaceutical compliance skills first to reduce site risk exposure.`,
    });
  }

  const partialGaps = requirements.filter((r) => r.status === "Partial Gap");
  if (partialGaps.length > 0) {
    const worst = [...partialGaps].sort((a, b) => b.gap - a.gap)[0];
    items.push({
      severity: "high",
      icon: TrendingUp,
      title: `${partialGaps.length} requirements with partial coverage gaps`,
      text: `${worst.title} has the largest gap — ${worst.gap} engineers below target. Focus upskilling efforts on this area.`,
    });
  }

  const coveragePct = stats.totalReqs > 0 ? Math.round((stats.fullyCovered / stats.totalReqs) * 100) : 0;
  if (coveragePct < 40) {
    items.push({
      severity: "high",
      icon: Sparkles,
      title: `Overall site coverage at ${coveragePct}% — below recommended threshold`,
      text: `${stats.fullyCovered} of ${stats.totalReqs} requirements are fully covered. A structured upskilling programme is recommended within the next quarter.`,
    });
  }

  return items.slice(0, 5);
}

// ─── Main component ───────────────────────────────────────────────────────────

export const RequirementsSection = (): JSX.Element => {
  const [requirements,    setRequirements]    = useState<Requirement[]>([]);
  const [coverageByGroup, setCoverageByGroup] = useState<CoverageGroup[]>([]);
  const [actionRows,      setActionRows]      = useState<ActionRow[]>([]);
  const [stats,           setStats]           = useState<ReqStats>({ totalReqs: 0, fullyCovered: 0, skillsAtRisk: 0, criticalGaps: 0 });
  const [departments,     setDepartments]     = useState<Department[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [loadError,       setLoadError]       = useState(false);
  const [tick,            setTick]            = useState(0);

  // Filters
  const [search,         setSearch]         = useState("");
  const [filterDept,     setFilterDept]     = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  // Table pagination
  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchRequirements().then((payload) => {
      if (cancelled) return;
      if (payload.error) { setLoadError(true); setLoading(false); return; }
      setRequirements(payload.requirements);
      setCoverageByGroup(payload.coverageByGroup);
      setActionRows(payload.actionRows);
      setStats(payload.stats);
      setDepartments(payload.departments);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const categories = useMemo(
    () => [...new Set(requirements.map((r) => r.skill_category).filter(Boolean))].sort(),
    [requirements]
  );

  const deptNames = useMemo(
    () => departments.map((d) => d.name).sort(),
    [departments]
  );

  const filteredRequirements = useMemo(() => {
    const lc = search.toLowerCase();
    return requirements.filter((req) => {
      if (search && !req.title.toLowerCase().includes(lc) && !req.area.toLowerCase().includes(lc)) return false;
      if (filterDept !== "all"     && req.department_name !== filterDept) return false;
      if (filterPriority !== "all" && req.priority !== filterPriority)    return false;
      if (filterStatus !== "all"   && req.status !== filterStatus)         return false;
      if (filterCategory !== "all" && req.skill_category !== filterCategory) return false;
      return true;
    });
  }, [requirements, search, filterDept, filterPriority, filterStatus, filterCategory]);

  const hasActiveFilters = !!(search || filterDept !== "all" || filterPriority !== "all" || filterStatus !== "all" || filterCategory !== "all");

  const resetFilters = () => {
    setSearch(""); setFilterDept("all"); setFilterPriority("all");
    setFilterStatus("all"); setFilterCategory("all"); setTablePage(0);
  };

  const totalTablePages = Math.ceil(filteredRequirements.length / TABLE_PAGE_SIZE);
  const pagedReqs       = filteredRequirements.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  const insights = useMemo(() => buildInsights(requirements, stats), [requirements, stats]);

  // ── KPI cards ─────────────────────────────────────────────────────────────

  const kpiCards = useMemo(() => [
    {
      label: "Total Requirements",
      value: String(stats.totalReqs),
      sub: "Site skill requirements",
      icon: ClipboardList,
      valueClass: "text-slate-50",
    },
    {
      label: "Fully Covered",
      value: String(stats.fullyCovered),
      sub: `${stats.totalReqs > 0 ? Math.round((stats.fullyCovered / stats.totalReqs) * 100) : 0}% coverage rate`,
      icon: CheckCircle2,
      valueClass: stats.fullyCovered > 0 ? "text-emerald-400" : "text-slate-50",
    },
    {
      label: "Skills at Risk",
      value: String(stats.skillsAtRisk),
      sub: "Partial gap or training needed",
      icon: TrendingUp,
      valueClass: stats.skillsAtRisk > 0 ? "text-yellow-400" : "text-emerald-400",
    },
    {
      label: "Critical Gaps",
      value: String(stats.criticalGaps),
      sub: "Zero or insufficient coverage",
      icon: AlertTriangle,
      valueClass: stats.criticalGaps > 0 ? "text-red-500" : "text-emerald-400",
    },
  ], [stats]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-slate-500">Alpha Manufacturing</p>
          <div className="flex items-center gap-2">
            <h1 className="font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
              Requirements
            </h1>
            <ContextHelp content={{
              title: "Requirements",
              body:  "Define and track the skill coverage requirements for your site. Each requirement specifies how many engineers need to be competent in a given skill area.",
              usage: "Add requirements for each critical skill. Monitor coverage percentages and risk levels. Click any row to see engineer breakdown and AI recommendations.",
              aiNote: "Vorta AI scores each requirement against live engineer data and assigns a risk level, flagging SPOFs and coverage shortfalls.",
            }} />
          </div>
          <p className="text-sm text-slate-400">Define, track, and manage site capability requirements across skills, equipment, departments, and risk areas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button type="button" className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            <Plus className="h-4 w-4" /> Add Requirement
          </Button>
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      {/* ── Sync + AI actions ────────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4">
        <SyncIndicator loading={loading} source="Supabase" confidence={stats.totalReqs > 0 ? Math.min(96, 70 + Math.round((stats.fullyCovered / stats.totalReqs) * 26)) : undefined} />
        {!loading && !loadError && (
          <AiActionsPanel actions={[
            { label: "Review critical skill gaps", description: `${stats.criticalGaps} critical gap${stats.criticalGaps !== 1 ? "s" : ""} with insufficient coverage. Prioritise training or recruitment to close these first.`, priority: "critical", icon: AlertTriangle },
            { label: "Book training for at-risk skills", description: `${stats.skillsAtRisk} skill${stats.skillsAtRisk !== 1 ? "s" : ""} are at risk. Use AI Matching to find the best-fit training for each engineer.`, priority: "high", icon: Sparkles, href: "/ai-matching" },
            { label: "Add missing requirements", description: "Ensure all critical equipment and processes have defined skill requirements so AI can track coverage accurately.", priority: "medium", icon: ClipboardList },
            { label: "Export requirements report", description: "Share the current requirements and coverage status with management or your compliance team.", priority: "low", icon: Download },
          ] as AiAction[]} />
        )}
      </div>

      <div className="flex min-w-0 w-full max-w-full flex-col items-start gap-6">

        {/* ── KPI cards ──────────────────────────────────────────────────────── */}
        <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map(({ label, value, sub, icon: Icon, valueClass }) => (
            <Card key={label} className="min-w-0 h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex min-w-0 h-full flex-col gap-3 p-5">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-medium text-slate-400">{label}</p>
                  <Icon className="h-4 w-4 shrink-0 text-slate-600" />
                </div>
                <p className={`truncate text-xl font-semibold tabular-nums ${valueClass}`}>
                  {loading ? "—" : value}
                </p>
                <p className="truncate text-[11px] text-slate-500">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── AI Insights + Coverage ──────────────────────────────────────────── */}
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">

          {/* AI Requirement Insights */}
          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex min-w-0 flex-col gap-4 p-5">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-50">AI Requirement Insights</h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-gray-800 p-4">
                        <div className="h-4 w-48 animate-pulse rounded bg-gray-800" />
                        <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-800/60" />
                      </div>
                    ))
                  : insights.length === 0
                  ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                        <p className="text-sm font-medium text-emerald-400">All requirements covered</p>
                        <p className="text-xs text-slate-500">No critical gaps detected.</p>
                      </div>
                    )
                  : insights.map((ins, i) => {
                      const conf =
                        ins.severity === "critical"
                          ? { bg: "bg-[#ef444408]", border: "border-red-500/20",    icon: "text-red-500",    title: "text-red-400"    }
                          : ins.severity === "high"
                          ? { bg: "bg-[#f9731608]", border: "border-orange-400/20", icon: "text-orange-400", title: "text-orange-300" }
                          : { bg: "bg-[#facc1508]", border: "border-yellow-400/20", icon: "text-yellow-400", title: "text-yellow-300" };
                      const Icon = ins.icon;
                      return (
                        <div key={i} className={`flex items-start gap-2.5 rounded-lg border ${conf.border} ${conf.bg} p-4`}>
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${conf.icon}`} />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${conf.title}`}>{ins.title}</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">{ins.text}</p>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </CardContent>
          </Card>

          {/* Coverage by Category */}
          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex min-w-0 flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-50">Coverage by Category</h2>
                <span className="text-[11px] text-slate-500">
                  {loading ? "—" : `${stats.fullyCovered}/${stats.totalReqs} covered`}
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="h-3.5 w-24 animate-pulse rounded bg-gray-800" />
                        <div className="h-2 w-full animate-pulse rounded bg-gray-800/60" />
                      </div>
                    ))
                  : coverageByGroup.length === 0
                  ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <ClipboardList className="h-8 w-8 text-slate-700" />
                        <p className="text-sm text-slate-500">No coverage data available.</p>
                      </div>
                    )
                  : coverageByGroup.map((cg) => (
                      <div key={cg.group} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">{cg.group}</span>
                            {cg.gaps > 0 && (
                              <span className="rounded bg-[#ef444415] px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                                {cg.gaps} gap{cg.gaps !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold tabular-nums ${cg.pct >= 80 ? "text-emerald-400" : cg.pct >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                              {cg.pct}%
                            </span>
                            <span className="text-[11px] text-slate-500">{cg.covered}/{cg.total}</span>
                          </div>
                        </div>
                        <Progress
                          value={cg.pct}
                          className={`h-2 overflow-hidden rounded bg-gray-800 ${coverageBarClass(cg.pct)}`}
                        />
                      </div>
                    ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Requirements Table ──────────────────────────────────────────────── */}
        <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex min-w-0 flex-col gap-4 p-5">

            {/* Card header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-50">Requirements Register</h2>
                <p className="text-sm text-slate-400">
                  {loading ? "Loading…" : `${filteredRequirements.length} of ${requirements.length} requirements`}
                  {totalTablePages > 1 ? ` · page ${Math.min(tablePage + 1, totalTablePages)} of ${totalTablePages}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200">
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={tablePage === 0 || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setTablePage((p) => Math.min(totalTablePages - 1, p + 1))} disabled={tablePage >= totalTablePages - 1 || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search requirements…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setTablePage(0); }}
                  className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
              <Select
                value={filterDept}
                onChange={(v) => { setFilterDept(v); setTablePage(0); }}
                options={[{ value: "all", label: "All Departments" }, ...deptNames.map((d) => ({ value: d, label: d }))]}
                placeholder="All Departments"
              />
              <Select
                value={filterCategory}
                onChange={(v) => { setFilterCategory(v); setTablePage(0); }}
                options={[{ value: "all", label: "All Trades" }, ...categories.map((c) => ({ value: c, label: c }))]}
                placeholder="All Trades"
              />
              <Select
                value={filterPriority}
                onChange={(v) => { setFilterPriority(v); setTablePage(0); }}
                options={[
                  { value: "all",      label: "All Priorities" },
                  { value: "Critical", label: "Critical"       },
                  { value: "High",     label: "High"           },
                  { value: "Medium",   label: "Medium"         },
                  { value: "Low",      label: "Low"            },
                ]}
                placeholder="All Priorities"
              />
              <Select
                value={filterStatus}
                onChange={(v) => { setFilterStatus(v); setTablePage(0); }}
                options={[
                  { value: "all",                label: "All Statuses"        },
                  { value: "Critical Gap",        label: "Critical Gap"        },
                  { value: "Partial Gap",         label: "Partial Gap"         },
                  { value: "Training Required",   label: "Training Required"   },
                  { value: "Covered",             label: "Covered"             },
                ]}
                placeholder="All Statuses"
              />
            </div>

            {/* Error state */}
            {loadError && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-[#ef444408] py-10 text-center">
                <AlertTriangle className="h-7 w-7 text-red-500/60" />
                <div>
                  <p className="font-medium text-red-400">Failed to load requirements</p>
                  <p className="mt-1 text-sm text-slate-500">Unable to connect to the database.</p>
                </div>
                <button type="button" onClick={() => setTick((t) => t + 1)}
                  className="rounded-lg border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10">
                  Try again
                </button>
              </div>
            )}

            {/* Table */}
            {!loadError && (
              <div className="w-full max-w-full overflow-x-auto rounded-lg border border-gray-800">
                <table className="w-max min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-[#0f1318]">
                      {[
                        { label: "Requirement",        cls: "sticky left-0 z-10 bg-[#0f1318] min-w-[200px]" },
                        { label: "Department",         cls: "min-w-[120px]" },
                        { label: "Area",               cls: "min-w-[130px]" },
                        { label: "Required Level",     cls: "min-w-[110px] text-center" },
                        { label: "Qualified",          cls: "min-w-[90px] text-center" },
                        { label: "Gap",                cls: "min-w-[70px] text-center" },
                        { label: "Priority",           cls: "min-w-[90px]" },
                        { label: "Status",             cls: "min-w-[130px]" },
                        { label: "Actions",            cls: "min-w-[80px] text-center" },
                      ].map(({ label, cls }) => (
                        <th key={label} className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: TABLE_PAGE_SIZE }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                            {Array.from({ length: 9 }).map((_, j) => (
                              <td key={j} className="px-4 py-3">
                                <div className="h-4 w-20 animate-pulse rounded bg-gray-800" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : pagedReqs.length === 0
                      ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
                              No requirements match the current filters.{" "}
                              {hasActiveFilters && (
                                <button type="button" onClick={resetFilters} className="font-medium text-blue-400 hover:underline">
                                  Clear filters
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      : pagedReqs.map((req, idx) => {
                          const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                          const gapColor = req.gap === 0 ? "text-emerald-400" : req.gap <= 3 ? "text-yellow-400" : "text-red-400";
                          return (
                            <tr key={req.id} className={`border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}>
                              {/* Requirement title — sticky */}
                              <td className={`sticky left-0 z-10 min-w-[200px] px-4 py-2.5 ${rowBg}`}>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-slate-200 leading-tight">{req.title}</span>
                                    {req.single_point_of_failure && (
                                      <Badge className="inline-flex h-auto rounded bg-[#ef444420] px-1 py-0.5 text-[9px] font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                                        SPOF
                                      </Badge>
                                    )}
                                    {req.certification_required && (
                                      <Shield className="h-3 w-3 shrink-0 text-blue-400" title="Certification required" />
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500">{req.skill_category}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-sm text-slate-400">{req.department_name ?? "—"}</td>
                              <td className="px-4 py-2.5 text-sm text-slate-400">{req.area}</td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-sm font-semibold tabular-nums text-slate-200">{req.required_level}/5</span>
                                  <span className="text-[10px] text-slate-500">avg {req.current_avg.toFixed(1)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`text-sm font-semibold tabular-nums ${req.engineers_qualified > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {req.engineers_qualified}
                                </span>
                              </td>
                              <td className={`px-4 py-2.5 text-center text-sm font-semibold tabular-nums ${gapColor}`}>
                                {req.gap > 0 ? req.gap : "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${priorityBadgeClass(req.priority)}`}>
                                  {req.priority}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadgeClass(req.status)}`}>
                                  {req.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <button type="button"
                                  className="rounded-lg border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-gray-600 hover:bg-[#ffffff0a] hover:text-slate-200">
                                  Review
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && !loadError && totalTablePages > 1 && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, filteredRequirements.length)} of {filteredRequirements.length}
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalTablePages, 8) }).map((_, i) => (
                    <button key={i} type="button" onClick={() => setTablePage(i)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${i === tablePage ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"}`}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* ── Requirement Actions ─────────────────────────────────────────────── */}
        <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex min-w-0 flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-50">Requirement Actions</h2>
              <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
              </Badge>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-gray-800 p-4">
                      <div className="h-4 w-40 animate-pulse rounded bg-gray-800" />
                      <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-800/60" />
                    </div>
                  ))
                : actionRows.length === 0
                ? (
                    <div className="col-span-full flex flex-col items-center gap-2 py-8 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400/50" />
                      <p className="text-sm font-medium text-emerald-400">No actions outstanding</p>
                      <p className="text-xs text-slate-500">All requirements are on track.</p>
                    </div>
                  )
                : actionRows.map((row, i) => {
                    const { icon: Icon, cls, bg, border } = urgencyIcon(row.urgency);
                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-lg border ${border} ${bg} p-4`}>
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cls}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-100">{row.title}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{row.subtitle}</p>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </CardContent>
        </Card>

      </div>
    </section>
  );
};
