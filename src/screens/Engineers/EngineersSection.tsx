import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUser as UserCircle,
  Download,
  GraduationCap,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  TrendingDown,
  Users,
  X,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { supabase } from "../../lib/supabaseClient";
import {
  DrawerEngineer,
  EngineerDrawer,
  EnrichedAssignment,
  GapRow,
  TrainingBooking,
  getAvatarColor,
  getInitials,
} from "./EngineerDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EngineersStats {
  totalEngineers: number;
  verifiedEngineers: number;
  currentlyAvailable: number;
  onShiftToday: number;
  inTraining: number;
  criticalHolders: number;
  avgCompetencyScore: number;
  certificationsExpiring30d: number;
}

interface Department {
  id: string;
  name: string;
}

interface Site {
  id: string;
  name: string;
  region: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABLE_PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskBadgeClass(level: string): string {
  switch (level) {
    case "critical": return "bg-[#ef444420] text-red-500";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function availBadgeClass(status: string): string {
  switch (status) {
    case "available":   return "bg-[#10b98120] text-emerald-400";
    case "on_shift":    return "bg-[#3b82f620] text-blue-400";
    default:            return "bg-[#ef444420] text-red-400";
  }
}

function formatAvailStatus(s: string): string {
  switch (s) {
    case "available":   return "Available";
    case "on_shift":    return "On Shift";
    case "unavailable": return "Unavailable";
    default:            return s;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchEngineers(): Promise<{
  engineers: DrawerEngineer[];
  assignments: EnrichedAssignment[];
  trainingBookings: TrainingBooking[];
  skillGaps: GapRow[];
  departments: Department[];
  sites: Site[];
  stats: EngineersStats;
}> {
  const { data, error } = await supabase.functions.invoke("engineers-data");
  if (error || !data) {
    return {
      engineers: [], assignments: [], trainingBookings: [], skillGaps: [],
      departments: [], sites: [],
      stats: { totalEngineers: 0, verifiedEngineers: 0, currentlyAvailable: 0, onShiftToday: 0, inTraining: 0, criticalHolders: 0, avgCompetencyScore: 0, certificationsExpiring30d: 0 },
    };
  }
  return {
    engineers:        (data.engineers        ?? []) as DrawerEngineer[],
    assignments:      (data.assignments      ?? []) as EnrichedAssignment[],
    trainingBookings: (data.trainingBookings ?? []) as TrainingBooking[],
    skillGaps:        (data.skillGaps        ?? []) as GapRow[],
    departments:      (data.departments      ?? []) as Department[],
    sites:            (data.sites            ?? []) as Site[],
    stats: data.stats as EngineersStats,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export const EngineersSection = (): JSX.Element => {
  const [engineers,        setEngineers]        = useState<DrawerEngineer[]>([]);
  const [assignments,      setAssignments]      = useState<EnrichedAssignment[]>([]);
  const [trainingBookings, setTrainingBookings] = useState<TrainingBooking[]>([]);
  const [skillGaps,        setSkillGaps]        = useState<GapRow[]>([]);
  const [departments,      setDepartments]      = useState<Department[]>([]);
  const [sites,            setSites]            = useState<Site[]>([]);
  const [stats,            setStats]            = useState<EngineersStats>({
    totalEngineers: 0, verifiedEngineers: 0, currentlyAvailable: 0, onShiftToday: 0,
    inTraining: 0, criticalHolders: 0, avgCompetencyScore: 0, certificationsExpiring30d: 0,
  });
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);

  // Selection
  const [selectedEngineer, setSelectedEngineer] = useState<DrawerEngineer | null>(null);

  // Filters
  const [search,               setSearch]               = useState("");
  const [filterDept,           setFilterDept]           = useState("all");
  const [filterSite,           setFilterSite]           = useState("all");
  const [filterEmploymentType, setFilterEmploymentType] = useState("all");
  const [filterAvailability,   setFilterAvailability]   = useState("all");
  const [filterVerified,       setFilterVerified]       = useState("all");
  const [filterRisk,           setFilterRisk]           = useState("all");

  // Pagination
  const [tablePage, setTablePage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchEngineers().then((payload) => {
      if (cancelled) return;
      setEngineers(payload.engineers);
      setAssignments(payload.assignments);
      setTrainingBookings(payload.trainingBookings);
      setSkillGaps(payload.skillGaps);
      setDepartments(payload.departments);
      setSites(payload.sites);
      setStats(payload.stats);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tick]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredEngineers = useMemo(() => {
    const lc = search.toLowerCase();
    return engineers
      .filter((eng) => {
        if (search && !eng.full_name.toLowerCase().includes(lc) && !(eng.discipline ?? "").toLowerCase().includes(lc)) return false;
        if (filterDept !== "all"             && eng.department_name !== filterDept)            return false;
        if (filterSite !== "all"             && eng.site_name !== filterSite)                  return false;
        if (filterEmploymentType !== "all"   && eng.employment_type !== filterEmploymentType)  return false;
        if (filterAvailability !== "all"     && eng.availability_status !== filterAvailability) return false;
        if (filterVerified === "verified"    && !eng.verified)                                 return false;
        if (filterVerified === "unverified"  && eng.verified)                                  return false;
        if (filterRisk !== "all"             && eng.risk_level !== filterRisk)                 return false;
        return true;
      })
      .sort((a, b) => (RISK_ORDER[a.risk_level] ?? 9) - (RISK_ORDER[b.risk_level] ?? 9) || a.full_name.localeCompare(b.full_name));
  }, [engineers, search, filterDept, filterSite, filterEmploymentType, filterAvailability, filterVerified, filterRisk]);

  const totalTablePages = Math.ceil(filteredEngineers.length / TABLE_PAGE_SIZE);
  const pagedEngineers  = filteredEngineers.slice(tablePage * TABLE_PAGE_SIZE, (tablePage + 1) * TABLE_PAGE_SIZE);

  const hasActiveFilters = search || filterDept !== "all" || filterSite !== "all" || filterEmploymentType !== "all" || filterAvailability !== "all" || filterVerified !== "all" || filterRisk !== "all";

  const resetFilters = () => {
    setSearch(""); setFilterDept("all"); setFilterSite("all");
    setFilterEmploymentType("all"); setFilterAvailability("all");
    setFilterVerified("all"); setFilterRisk("all");
    setTablePage(0);
  };

  const siteNames  = useMemo(() => [...new Set(engineers.map((e) => e.site_name).filter(Boolean))] as string[], [engineers]);
  const deptNames  = useMemo(() => departments.map((d) => d.name).sort(), [departments]);

  // ── KPI card data ─────────────────────────────────────────────────────────

  const kpiCards = useMemo(() => [
    {
      label: "Total Engineers",
      value: String(stats.totalEngineers),
      sub: `${stats.verifiedEngineers} verified`,
      icon: Users,
      valueClass: "text-slate-50",
    },
    {
      label: "Verified Engineers",
      value: String(stats.verifiedEngineers),
      sub: `${stats.totalEngineers > 0 ? Math.round((stats.verifiedEngineers / stats.totalEngineers) * 100) : 0}% of workforce`,
      icon: CheckCircle2,
      valueClass: stats.verifiedEngineers === stats.totalEngineers ? "text-emerald-400" : "text-yellow-400",
    },
    {
      label: "Currently Available",
      value: String(stats.currentlyAvailable),
      sub: "Ready to deploy",
      icon: Users,
      valueClass: "text-emerald-400",
    },
    {
      label: "On Shift Today",
      value: String(stats.onShiftToday),
      sub: "Active right now",
      icon: TrendingDown,
      valueClass: "text-blue-400",
    },
    {
      label: "In Training",
      value: String(stats.inTraining),
      sub: "Active bookings",
      icon: GraduationCap,
      valueClass: stats.inTraining > 0 ? "text-orange-400" : "text-slate-50",
    },
    {
      label: "Critical Skill Holders",
      value: String(stats.criticalHolders),
      sub: "Key SMEs on site",
      icon: Shield,
      valueClass: "text-blue-400",
    },
    {
      label: "Avg Competency",
      value: `${stats.avgCompetencyScore}%`,
      sub: "Across all engineers",
      icon: Sparkles,
      valueClass: stats.avgCompetencyScore >= 80 ? "text-emerald-400" : stats.avgCompetencyScore >= 68 ? "text-yellow-400" : "text-red-400",
    },
    {
      label: "Certs Expiring (30d)",
      value: String(stats.certificationsExpiring30d),
      sub: "Require renewal",
      icon: AlertTriangle,
      valueClass: stats.certificationsExpiring30d > 0 ? "text-red-400" : "text-emerald-400",
    },
  ], [stats]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="relative flex w-full flex-1 grow flex-col items-start gap-8 px-6 pb-12 pt-0 lg:px-8">

      <EngineerDrawer
        engineer={selectedEngineer}
        assignments={assignments}
        trainingBookings={trainingBookings}
        skillGaps={skillGaps}
        onClose={() => setSelectedEngineer(null)}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs font-medium text-slate-500">Alpha Manufacturing</p>
          <h1 className="mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50">
            Engineers
          </h1>
          <p className="text-sm text-slate-400">Workforce Management &amp; Engineer Profiles</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button type="button" variant="outline" className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50">
            <Sparkles className="h-4 w-4" /> Generate AI Report
          </Button>
          <Button type="button" className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            <Plus className="h-4 w-4" /> Add Engineer
          </Button>
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading} className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      <div className="flex w-full flex-col items-start gap-6">

        {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
        <section className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
          {kpiCards.map(({ label, value, sub, icon: Icon, valueClass }) => (
            <Card key={label} className="h-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-slate-400 leading-tight">{label}</p>
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                </div>
                <p className={`text-xl font-semibold tabular-nums ${valueClass}`}>
                  {loading ? "—" : value}
                </p>
                <p className="text-[10px] text-slate-600 leading-tight">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── Engineers Table Card ────────────────────────────────────────────── */}
        <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-5">

            {/* Card header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-50">Engineer Directory</h2>
                <p className="text-sm text-slate-400">
                  {filteredEngineers.length} of {engineers.length} engineers · click a row to view profile
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters} className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-200">
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
                </Badge>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search engineers…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setTablePage(0); }}
                  className="h-8 w-full rounded-lg border border-gray-800 bg-[#0b0e14] pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                />
              </div>

              {/* Department */}
              <select
                value={filterDept}
                onChange={(e) => { setFilterDept(e.target.value); setTablePage(0); }}
                className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none"
              >
                <option value="all">All Departments</option>
                {deptNames.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>

              {/* Site / Location */}
              <select
                value={filterSite}
                onChange={(e) => { setFilterSite(e.target.value); setTablePage(0); }}
                className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none"
              >
                <option value="all">All Locations</option>
                {siteNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Employment Type */}
              <select
                value={filterEmploymentType}
                onChange={(e) => { setFilterEmploymentType(e.target.value); setTablePage(0); }}
                className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="internal">Internal</option>
                <option value="contractor">Contractor</option>
                <option value="agency">Agency</option>
              </select>

              {/* Availability */}
              <select
                value={filterAvailability}
                onChange={(e) => { setFilterAvailability(e.target.value); setTablePage(0); }}
                className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none"
              >
                <option value="all">All Availability</option>
                <option value="available">Available</option>
                <option value="on_shift">On Shift</option>
                <option value="unavailable">Unavailable</option>
              </select>

              {/* Verification */}
              <select
                value={filterVerified}
                onChange={(e) => { setFilterVerified(e.target.value); setTablePage(0); }}
                className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none"
              >
                <option value="all">All Verification</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>

              {/* Risk */}
              <select
                value={filterRisk}
                onChange={(e) => { setFilterRisk(e.target.value); setTablePage(0); }}
                className="h-8 rounded-lg border border-gray-800 bg-[#0b0e14] px-3 text-sm text-slate-300 focus:outline-none"
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {[
                      { label: "Engineer",       cls: "sticky left-0 z-10 bg-[#0f1318] min-w-[200px]" },
                      { label: "Department",      cls: "min-w-[130px]" },
                      { label: "Location",        cls: "min-w-[120px]" },
                      { label: "Type",            cls: "min-w-[100px]" },
                      { label: "Availability",    cls: "min-w-[110px]" },
                      { label: "Shift",           cls: "min-w-[120px]" },
                      { label: "Competency",      cls: "min-w-[100px] text-right" },
                      { label: "Critical Skills", cls: "min-w-[110px] text-right" },
                      { label: "Training Gaps",   cls: "min-w-[110px] text-right" },
                      { label: "Last Assessed",   cls: "min-w-[120px]" },
                      { label: "Risk",            cls: "min-w-[90px]" },
                      { label: "Actions",         cls: "min-w-[80px] text-center" },
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
                          <td className="sticky left-0 z-10 bg-[#141820] px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-800" />
                              <div>
                                <div className="h-4 w-32 animate-pulse rounded bg-gray-800" />
                                <div className="mt-1 h-3 w-20 animate-pulse rounded bg-gray-800/50" />
                              </div>
                            </div>
                          </td>
                          {Array.from({ length: 11 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 w-16 animate-pulse rounded bg-gray-800" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : filteredEngineers.length === 0
                    ? (
                        <tr>
                          <td colSpan={12} className="py-16 text-center text-sm text-slate-500">
                            No engineers match the current filters.{" "}
                            <button type="button" onClick={resetFilters} className="font-medium text-blue-400 hover:underline">
                              Clear filters
                            </button>
                          </td>
                        </tr>
                      )
                    : pagedEngineers.map((eng, idx) => {
                        const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                        const scoreColor = eng.skills_score >= 80 ? "text-emerald-400" : eng.skills_score >= 68 ? "text-yellow-400" : "text-red-400";
                        const criticalPct = eng.critical_skills_count > 0
                          ? Math.round((eng.critical_skills_met / eng.critical_skills_count) * 100) : 100;

                        return (
                          <tr
                            key={eng.id}
                            onClick={() => setSelectedEngineer(eng)}
                            className={`cursor-pointer border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}
                          >
                            {/* Engineer (sticky) */}
                            <td className={`sticky left-0 z-10 min-w-[200px] px-4 py-2.5 ${rowBg}`}>
                              <div className="flex items-center gap-3">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${getAvatarColor(eng.full_name)}`}>
                                  {getInitials(eng.full_name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="truncate font-medium leading-tight text-slate-200">{eng.full_name}</p>
                                    {eng.verified && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />}
                                    {eng.critical_knowledge_holder && <Shield className="h-3 w-3 shrink-0 text-blue-400" />}
                                  </div>
                                  <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">{eng.discipline ?? "—"}</p>
                                </div>
                              </div>
                            </td>

                            {/* Department */}
                            <td className="px-4 py-2.5 text-sm text-slate-400">{eng.department_name ?? "—"}</td>

                            {/* Location */}
                            <td className="px-4 py-2.5">
                              {eng.site_name ? (
                                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                                  <MapPin className="h-3 w-3 shrink-0 text-slate-600" />
                                  {eng.site_name}
                                </span>
                              ) : <span className="text-sm text-slate-600">—</span>}
                            </td>

                            {/* Employment type */}
                            <td className="px-4 py-2.5">
                              <span className="text-xs text-slate-400">{capitalize(eng.employment_type)}</span>
                            </td>

                            {/* Availability */}
                            <td className="px-4 py-2.5">
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${availBadgeClass(eng.availability_status)}`}>
                                {formatAvailStatus(eng.availability_status)}
                              </Badge>
                            </td>

                            {/* Shift */}
                            <td className="px-4 py-2.5 text-sm text-slate-400">{eng.shift_pattern ?? "—"}</td>

                            {/* Competency */}
                            <td className={`px-4 py-2.5 text-right text-sm font-semibold tabular-nums ${scoreColor}`}>
                              {eng.skills_score}%
                            </td>

                            {/* Critical skills met/total */}
                            <td className="px-4 py-2.5 text-right">
                              <span className={`text-sm font-semibold tabular-nums ${criticalPct >= 80 ? "text-emerald-400" : criticalPct >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                                {eng.critical_skills_met}
                              </span>
                              <span className="text-xs text-slate-600">/{eng.critical_skills_count}</span>
                            </td>

                            {/* Training gaps */}
                            <td className="px-4 py-2.5 text-right">
                              {eng.training_count > 0
                                ? <span className="text-sm font-semibold text-orange-400 tabular-nums">{eng.training_count}</span>
                                : <span className="text-sm text-slate-600">0</span>}
                            </td>

                            {/* Last assessed */}
                            <td className="px-4 py-2.5 text-sm text-slate-400">{formatDate(eng.last_assessment_date)}</td>

                            {/* Risk */}
                            <td className="px-4 py-2.5">
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${riskBadgeClass(eng.risk_level)}`}>
                                {capitalize(eng.risk_level)}
                              </Badge>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedEngineer(eng); }}
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-800 px-2 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400"
                              >
                                <BookOpen className="h-3 w-3" /> View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredEngineers.length > TABLE_PAGE_SIZE && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {tablePage * TABLE_PAGE_SIZE + 1}–{Math.min((tablePage + 1) * TABLE_PAGE_SIZE, filteredEngineers.length)} of {filteredEngineers.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTablePage((p) => Math.max(0, p - 1))}
                    disabled={tablePage === 0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalTablePages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTablePage(i)}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
                        i === tablePage
                          ? "bg-blue-500/20 font-semibold text-blue-400"
                          : "text-slate-500 hover:bg-[#ffffff1a]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTablePage((p) => Math.min(totalTablePages - 1, p + 1))}
                    disabled={tablePage >= totalTablePages - 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </section>
  );
};
