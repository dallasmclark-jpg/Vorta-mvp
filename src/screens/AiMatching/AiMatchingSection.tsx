import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUser as UserCircle,
  Download,
  GraduationCap,
  RefreshCw,
  Search,
  Sparkles,
  Users,
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
import { AiAnalysing } from "../../components/AiAnalysing";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResult {
  engineer_id: string;
  engineer_name: string;
  discipline: string;
  employment_type: string;
  department_name: string | null;
  availability_status: string;
  overall_score: number;
  skills_score: number;
  cert_score: number;
  experience_score: number;
  avail_score: number;
  training_gap: number;
  matched_skills: string[];
  missing_skills: string[];
  certifications: string[];
  active_training: string[];
  status: string;
  ai_recommendation: string;
  critical_knowledge_holder: boolean;
  years_experience: number;
}

interface GapRec {
  skill_name: string;
  category: string;
  risk_level: string;
  engineers_below: number;
  recommended_course: string | null;
  provider_name: string | null;
  provider_location: string | null;
  priority: string;
  score_impact: number;
}

interface AiMatchStats {
  openRequirements: number;
  availableEngineers: number;
  bestMatchScore: number;
  criticalSkillGaps: number;
  totalEngineers: number;
  totalRequirements: number;
}

interface AiMatchData {
  matchResults: MatchResult[];
  gapRecs: GapRec[];
  departments: string[];
  skills: string[];
  certifications: string[];
  stats: AiMatchStats;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-500";
  if (score >= 70) return "text-blue-400";
  if (score >= 55) return "text-yellow-400";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 55) return "bg-yellow-400";
  return "bg-red-500";
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Strong Match":  return "bg-[#10b98120] text-emerald-500";
    case "Good Match":    return "bg-[#3b82f620] text-blue-400";
    case "Partial Match": return "bg-[#facc1520] text-yellow-400";
    default:              return "bg-[#ef444420] text-red-500";
  }
}

function availBadgeClass(status: string): string {
  switch (status) {
    case "available":  return "bg-[#10b98120] text-emerald-500";
    case "on_shift":   return "bg-[#3b82f620] text-blue-400";
    case "training":   return "bg-[#facc1520] text-yellow-400";
    case "on_leave":   return "bg-[#ef444420] text-red-500";
    default:           return "bg-gray-800 text-slate-400";
  }
}

function availLabel(status: string): string {
  switch (status) {
    case "available": return "Available";
    case "on_shift":  return "On Shift";
    case "training":  return "In Training";
    case "on_leave":  return "On Leave";
    default:          return status;
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "Critical": return "bg-[#ef444420] text-red-500";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

function riskBadgeClass(riskLevel: string): string {
  switch (riskLevel) {
    case "critical": return "bg-[#ef444420] text-red-500";
    case "high":     return "bg-[#f9731620] text-orange-400";
    case "medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-500";
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchAiMatchData(): Promise<AiMatchData | null> {
  const { data, error } = await supabase.functions.invoke("ai-matching-data");
  if (error || !data) return null;
  return data as AiMatchData;
}

// ─── Score breakdown bar ──────────────────────────────────────────────────────

function ScoreBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">{label}</span>
        <span className={`text-xs font-semibold ${colorClass}`}>{value}%</span>
      </div>
      <Progress value={value} className={`h-1.5 overflow-hidden rounded bg-gray-800 [&>div]:${scoreBg(value)}`} />
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, accent }: {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-400">{title}</p>
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${accent}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="text-2xl font-semibold text-slate-50">{value}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const AiMatchingSection = (): JSX.Element => {
  const [data, setData]       = useState<AiMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick]       = useState(0);

  // Filters
  const [filterDept,    setFilterDept]    = useState("");
  const [filterSkill,   setFilterSkill]   = useState("");
  const [filterCert,    setFilterCert]    = useState("");
  const [filterMinScore, setFilterMinScore] = useState(0);
  const [search,        setSearch]        = useState("");

  // Selection + pagination
  const [selected, setSelected] = useState<MatchResult | null>(null);
  const [page, setPage]         = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAiMatchData().then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
        if (d?.matchResults.length) setSelected(d.matchResults[0]);
      }
    });
    return () => { cancelled = true; };
  }, [tick]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.matchResults;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) => r.engineer_name.toLowerCase().includes(q) || r.discipline.toLowerCase().includes(q)
      );
    }
    if (filterDept)  rows = rows.filter((r) => r.department_name === filterDept);
    if (filterSkill) rows = rows.filter((r) => r.matched_skills.some((s) => s.toLowerCase().includes(filterSkill.toLowerCase())) || r.missing_skills.some((s) => s.toLowerCase().includes(filterSkill.toLowerCase())));
    if (filterCert)  rows = rows.filter((r) => r.certifications.some((c) => c.toLowerCase().includes(filterCert.toLowerCase())));
    if (filterMinScore > 0) rows = rows.filter((r) => r.overall_score >= filterMinScore);
    return rows;
  }, [data, search, filterDept, filterSkill, filterCert, filterMinScore]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = !!(search || filterDept || filterSkill || filterCert || filterMinScore);

  function clearFilters() {
    setSearch(""); setFilterDept(""); setFilterSkill(""); setFilterCert(""); setFilterMinScore(0); setPage(1);
  }

  const stats = data?.stats;

  const aiActions: AiAction[] = [
    { label: "Run AI match on open requirements", description: "Select a requirement below to see ranked engineer matches with skill gap analysis and confidence scores.", priority: "high", icon: Sparkles },
    { label: "Book training for unmatched engineers", description: `${stats?.criticalSkillGaps ?? 0} critical skill gaps detected. Use Training Bookings to close the highest-risk gaps.`, priority: "high", icon: GraduationCap, href: "/training" },
    { label: "Assign engineers to open requirements", description: "Review the match list and assign the best-fit engineer to each open requirement to reduce coverage risk.", priority: "medium", icon: Users },
    { label: "Export match report", description: "Download the AI matching results as a CSV or PDF to share with management or use in workforce planning.", priority: "low", icon: Download },
  ];

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <h1 className="mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-xl-semibold-font-style)]">
              AI Matching
            </h1>
            <ContextHelp content={{
              title: "AI Matching",
              body:  "Matches engineers to open requirements using skills, certifications, shift availability, experience and training gaps. Scores are 0–100.",
              usage: "Select a requirement to see ranked engineer matches. Review match scores, skill gaps and training recommendations before assigning an engineer.",
              aiNote: "Vorta AI weights skills coverage, certification status and SPOF risk to produce ranked match scores. Higher data completeness improves accuracy.",
            }} />
          </div>
          <p className="font-text-sm-regular text-[length:var(--text-sm-regular-font-size)] font-[number:var(--text-sm-regular-font-weight)] leading-[var(--text-sm-regular-line-height)] tracking-[var(--text-sm-regular-letter-spacing)] text-slate-400 [font-style:var(--text-sm-regular-font-style)]">
            Match engineers to requirements using skills, certifications, experience, availability and training gaps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button
            type="button"
            className="h-auto bg-blue-600 px-4 py-2 font-text-sm-semibold text-[length:var(--text-sm-semibold-font-size)] font-[number:var(--text-sm-semibold-font-weight)] leading-[var(--text-sm-semibold-line-height)] tracking-[var(--text-sm-semibold-letter-spacing)] text-white hover:bg-blue-500 [font-style:var(--text-sm-semibold-font-style)]"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Run AI Match
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 font-text-sm-semibold text-[length:var(--text-sm-semibold-font-size)] font-[number:var(--text-sm-semibold-font-weight)] leading-[var(--text-sm-semibold-line-height)] tracking-[var(--text-sm-semibold-letter-spacing)] text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50 [font-style:var(--text-sm-semibold-font-style)]"
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export Report
          </Button>
          <ExplainWithAi pageId="ai-matching" />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            disabled={loading}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200 transition-colors"
            aria-label="User profile"
          >
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      {/* ── Sync + AI actions ────────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-4">
        <SyncIndicator loading={loading} source="Supabase" confidence={stats?.bestMatchScore ? Math.min(97, Math.round(stats.bestMatchScore * 0.95 + 5)) : undefined} />
        {loading && (
          <AiAnalysing
            message="AI is matching engineers against open requirements…"
            block
          />
        )}
        {!loading && <AiActionsPanel actions={aiActions} />}
      </div>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-xl bg-gray-800" />
          ))
        ) : (
          <>
            <KpiCard
              title="Open Requirements"
              value={stats?.openRequirements ?? "—"}
              sub="Critical + high risk skill gaps"
              icon={Brain}
              accent="bg-[#ef444420] text-red-500"
            />
            <KpiCard
              title="Engineers Available"
              value={stats?.availableEngineers ?? "—"}
              sub={`of ${stats?.totalEngineers ?? 0} total engineers`}
              icon={UserCircle}
              accent="bg-[#10b98120] text-emerald-500"
            />
            <KpiCard
              title="Best Match Score"
              value={stats?.bestMatchScore !== undefined ? `${stats.bestMatchScore}%` : "—"}
              sub="Top scoring engineer this run"
              icon={Sparkles}
              accent="bg-[#3b82f620] text-blue-400"
            />
            <KpiCard
              title="Critical Skill Gaps"
              value={stats?.criticalSkillGaps ?? "—"}
              sub="Skills at critical risk level"
              icon={Zap}
              accent="bg-[#f9731620] text-orange-400"
            />
          </>
        )}
      </div>

      {/* ── Main two-column layout ─────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">

        {/* ── Left: Match Results ──────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">

          {/* Filters */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search engineer or discipline…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="h-9 w-full rounded-lg border border-[#ffffff15] bg-[#0d0d0d] pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500/60"
                  />
                </div>

                {/* Department */}
                <Select
                  value={filterDept}
                  onChange={(v) => { setFilterDept(v); setPage(1); }}
                  options={[{ value: "", label: "Department" }, ...(data?.departments ?? []).map((d) => ({ value: d, label: d }))]}
                  placeholder="Department"
                  size="md"
                  className="h-9"
                />

                {/* Skill */}
                <Select
                  value={filterSkill}
                  onChange={(v) => { setFilterSkill(v); setPage(1); }}
                  options={[{ value: "", label: "Skill" }, ...(data?.skills ?? []).slice(0, 30).map((s) => ({ value: s, label: s }))]}
                  placeholder="Skill"
                  size="md"
                  className="h-9"
                />

                {/* Certification */}
                <Select
                  value={filterCert}
                  onChange={(v) => { setFilterCert(v); setPage(1); }}
                  options={[{ value: "", label: "Certification" }, ...(data?.certifications ?? []).map((c) => ({ value: c, label: c }))]}
                  placeholder="Certification"
                  size="lg"
                  className="h-9"
                />

                {/* Min Score */}
                <Select
                  value={String(filterMinScore)}
                  onChange={(v) => { setFilterMinScore(Number(v)); setPage(1); }}
                  options={[
                    { value: "0",  label: "Min Score"         },
                    { value: "85", label: "85%+ Strong Match" },
                    { value: "70", label: "70%+ Good Match"   },
                    { value: "55", label: "55%+ Partial Match" },
                  ]}
                  placeholder="Min Score"
                  size="sm"
                  className="h-9"
                />

                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#ffffff15] px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-[#ffffff25] hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
              </div>

              {/* Result count */}
              <p className="text-xs text-slate-500">
                {loading ? "Loading…" : `${filtered.length} engineer${filtered.length !== 1 ? "s" : ""} matched`}
                {hasFilters && !loading && ` (filtered from ${data?.matchResults.length ?? 0})`}
              </p>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {["Engineer", "Role / Discipline", "Match Score", "Matching Skills", "Missing Skills", "Certifications", "Availability", "Status", "Action"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-800">
                          {Array.from({ length: 9 }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <div className="h-4 animate-pulse rounded bg-gray-800" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                          No engineers match the current filters.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, idx) => {
                        const isSelected = selected?.engineer_id === row.engineer_id;
                        return (
                          <tr
                            key={row.engineer_id}
                            className={`border-b border-gray-800 cursor-pointer transition-colors hover:bg-[#1c2338] ${isSelected ? "bg-[#1c2338]" : idx % 2 === 1 ? "bg-[#111620]" : ""}`}
                            onClick={() => setSelected(row)}
                          >
                            {/* Engineer */}
                            <td className="sticky left-0 z-10 min-w-[140px] bg-inherit px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-slate-100 whitespace-nowrap">{row.engineer_name}</span>
                                {row.department_name && (
                                  <span className="text-[10px] text-slate-500">{row.department_name}</span>
                                )}
                              </div>
                            </td>

                            {/* Role / Discipline */}
                            <td className="min-w-[130px] px-4 py-3 text-slate-300 whitespace-nowrap">{row.discipline}</td>

                            {/* Match Score */}
                            <td className="min-w-[110px] px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`text-base font-semibold ${scoreColor(row.overall_score)}`}>
                                  {row.overall_score}%
                                </span>
                                <Progress
                                  value={row.overall_score}
                                  className={`h-1 overflow-hidden rounded bg-gray-800 [&>div]:${scoreBg(row.overall_score)}`}
                                />
                              </div>
                            </td>

                            {/* Matching Skills */}
                            <td className="min-w-[150px] px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {row.matched_skills.slice(0, 2).map((s) => (
                                  <Badge key={s} className="inline-flex h-auto rounded bg-[#10b98120] px-1.5 py-0.5 text-[10px] font-medium text-emerald-500 shadow-none hover:bg-[#10b98120]">
                                    {s}
                                  </Badge>
                                ))}
                                {row.matched_skills.length > 2 && (
                                  <span className="text-[10px] text-slate-500">+{row.matched_skills.length - 2}</span>
                                )}
                                {row.matched_skills.length === 0 && <span className="text-[10px] text-slate-600">—</span>}
                              </div>
                            </td>

                            {/* Missing Skills */}
                            <td className="min-w-[150px] px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {row.missing_skills.slice(0, 2).map((s) => (
                                  <Badge key={s} className="inline-flex h-auto rounded bg-[#ef444420] px-1.5 py-0.5 text-[10px] font-medium text-red-500 shadow-none hover:bg-[#ef444420]">
                                    {s}
                                  </Badge>
                                ))}
                                {row.missing_skills.length > 2 && (
                                  <span className="text-[10px] text-slate-500">+{row.missing_skills.length - 2}</span>
                                )}
                                {row.missing_skills.length === 0 && (
                                  <Badge className="inline-flex h-auto rounded bg-[#10b98120] px-1.5 py-0.5 text-[10px] font-medium text-emerald-500 shadow-none hover:bg-[#10b98120]">
                                    None
                                  </Badge>
                                )}
                              </div>
                            </td>

                            {/* Certifications */}
                            <td className="min-w-[130px] px-4 py-3">
                              {row.certifications.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  <Badge className="inline-flex h-auto rounded bg-[#3b82f620] px-1.5 py-0.5 text-[10px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                                    {row.certifications[0]}
                                  </Badge>
                                  {row.certifications.length > 1 && (
                                    <span className="text-[10px] text-slate-500">+{row.certifications.length - 1}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600">—</span>
                              )}
                            </td>

                            {/* Availability */}
                            <td className="min-w-[110px] px-4 py-3">
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none hover:${availBadgeClass(row.availability_status)} ${availBadgeClass(row.availability_status)}`}>
                                {availLabel(row.availability_status)}
                              </Badge>
                            </td>

                            {/* Status */}
                            <td className="min-w-[120px] px-4 py-3">
                              <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none hover:${statusBadgeClass(row.status)} ${statusBadgeClass(row.status)}`}>
                                {row.status}
                              </Badge>
                            </td>

                            {/* Action */}
                            <td className="min-w-[80px] px-4 py-3">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                                className="text-xs font-semibold text-blue-500 transition-colors hover:text-blue-400"
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
                  <span className="text-xs text-slate-500">
                    Page {page} of {totalPages} — {filtered.length} results
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors ${page === p ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-[#ffffff1a] hover:text-slate-200"}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Breakdown panel ───────────────────────────────────────── */}
        <aside className="flex flex-col gap-4">
          <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-text-md-semibold text-[length:var(--text-md-semibold-font-size)] font-[number:var(--text-md-semibold-font-weight)] leading-[var(--text-md-semibold-line-height)] tracking-[var(--text-md-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-md-semibold-font-style)]">
                  AI Match Breakdown
                </h2>
                <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  AI Live
                </Badge>
              </div>

              {loading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-gray-800" />
                  ))}
                </div>
              ) : selected ? (
                <>
                  {/* Engineer name + overall score */}
                  <div className="flex flex-col gap-1 rounded-lg border border-gray-800 bg-[#111620] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-100">{selected.engineer_name}</span>
                        <span className="text-xs text-slate-500">{selected.discipline}</span>
                      </div>
                      <span className={`text-2xl font-bold ${scoreColor(selected.overall_score)}`}>
                        {selected.overall_score}%
                      </span>
                    </div>
                    <Badge className={`mt-2 inline-flex w-fit h-auto rounded px-2 py-0.5 text-xs font-medium shadow-none hover:${statusBadgeClass(selected.status)} ${statusBadgeClass(selected.status)}`}>
                      {selected.status}
                    </Badge>
                  </div>

                  {/* Score breakdown bars */}
                  <div className="flex flex-col gap-3">
                    <ScoreBar label="Skills Match"        value={selected.skills_score}     colorClass={scoreColor(selected.skills_score)} />
                    <ScoreBar label="Certification Match" value={selected.cert_score}       colorClass={scoreColor(selected.cert_score)} />
                    <ScoreBar label="Experience Match"    value={selected.experience_score} colorClass={scoreColor(selected.experience_score)} />
                    <ScoreBar label="Availability Match"  value={selected.avail_score}      colorClass={scoreColor(selected.avail_score)} />
                  </div>

                  {/* Training gap */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                    <span className="text-sm text-slate-400">Training Gap</span>
                    <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-xs font-medium shadow-none ${selected.training_gap === 0 ? "bg-[#10b98120] text-emerald-500 hover:bg-[#10b98120]" : selected.training_gap <= 3 ? "bg-[#facc1520] text-yellow-400 hover:bg-[#facc1520]" : "bg-[#ef444420] text-red-500 hover:bg-[#ef444420]"}`}>
                      {selected.training_gap === 0 ? "No gaps" : `${selected.training_gap} skill${selected.training_gap !== 1 ? "s" : ""} missing`}
                    </Badge>
                  </div>

                  {/* AI recommendation */}
                  <div className="flex flex-col gap-2 rounded-lg border border-blue-500/20 bg-[#3b82f610] p-4">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-semibold text-blue-400">AI Recommendation</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">{selected.ai_recommendation}</p>
                  </div>

                  {/* Certifications held */}
                  {selected.certifications.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Certifications Held</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.certifications.map((c) => (
                          <Badge key={c} className="inline-flex h-auto rounded bg-[#3b82f620] px-2 py-0.5 text-[10px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                            <CheckCircle2 className="mr-1 h-3 w-3" />{c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active training */}
                  {selected.active_training.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Currently in Training</span>
                      <div className="flex flex-col gap-1">
                        {selected.active_training.slice(0, 3).map((t) => (
                          <div key={t} className="flex items-center gap-2 text-xs text-slate-300">
                            <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">Select an engineer from the table to see their AI match breakdown.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* ── Training Gap Recommendations ─────────────────────────────────── */}
      <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-text-md-semibold text-[length:var(--text-md-semibold-font-size)] font-[number:var(--text-md-semibold-font-weight)] leading-[var(--text-md-semibold-line-height)] tracking-[var(--text-md-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-md-semibold-font-style)]">
              Training Gap Recommendations
            </h2>
            <p className="text-sm text-slate-500">Recommended courses based on missing skills and certifications</p>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Skill Gap", "Category", "Recommended Training", "Provider", "Priority", "Score Impact"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-800">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-gray-800" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (data?.gapRecs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No training gap recommendations available.</td>
                  </tr>
                ) : (
                  (data?.gapRecs ?? []).map((rec, idx) => (
                    <tr
                      key={`${rec.skill_name}-${idx}`}
                      className={`border-b border-gray-800 ${idx % 2 === 1 ? "bg-[#111620]" : ""}`}
                    >
                      {/* Skill Gap */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-100">{rec.skill_name}</span>
                          <span className="text-[10px] text-slate-500">{rec.engineers_below} engineer{rec.engineers_below !== 1 ? "s" : ""} below target</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-xs text-slate-400">{rec.category}</td>

                      {/* Recommended Training */}
                      <td className="px-4 py-3">
                        {rec.recommended_course ? (
                          <span className="text-sm text-slate-200">{rec.recommended_course}</span>
                        ) : (
                          <span className="text-xs text-slate-600">No course matched</span>
                        )}
                      </td>

                      {/* Provider */}
                      <td className="px-4 py-3">
                        {rec.provider_name ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-slate-200">{rec.provider_name}</span>
                            {rec.provider_location && (
                              <span className="text-[10px] text-slate-500">{rec.provider_location}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3">
                        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none hover:${priorityBadgeClass(rec.priority)} ${priorityBadgeClass(rec.priority)}`}>
                          {rec.priority}
                        </Badge>
                      </td>

                      {/* Score Impact */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-emerald-500">+{rec.score_impact}pp</span>
                          <span className="text-[10px] text-slate-500">est.</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </section>
  );
};
