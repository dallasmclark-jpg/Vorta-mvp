import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Network,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";
import { supabase } from "../../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type OppType = "Job" | "Project" | "Shift Cover" | "Training" | "Career Step";
type OppStatus = "open" | "shortlisted" | "applied" | "closed";

interface Opportunity {
  id: string;
  title: string;
  site: string;
  type: OppType;
  match_score: number;
  required_skills: string[];
  missing_skills: string[];
  status: OppStatus;
  blocker: string | null;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_OPPORTUNITIES: Opportunity[] = [
  { id: "1", title: "Senior Mechanical Engineer — Reactor Line",  site: "Alpha Manufacturing",   type: "Job",          match_score: 87, required_skills: ["Hydraulic Systems", "Allen Bradley PLC", "PSSR"],       missing_skills: [],                              status: "open",        blocker: null },
  { id: "2", title: "Shift Lead — Maintenance (Night)",           site: "Alpha Manufacturing",   type: "Job",          match_score: 72, required_skills: ["SAP PM", "Vibration Analysis", "GMP"],                  missing_skills: ["Vibration Analysis Level II"],  status: "open",        blocker: null },
  { id: "3", title: "Predictive Maintenance Specialist",          site: "Alpha Manufacturing",   type: "Career Step",  match_score: 61, required_skills: ["Vibration Analysis", "ATEX", "CBM"],                    missing_skills: ["ATEX Certification", "CBM L2"], status: "shortlisted", blocker: "Missing ATEX certification" },
  { id: "4", title: "Maintenance Planner (Contract)",             site: "Gamma Pharma Site",     type: "Project",      match_score: 78, required_skills: ["SAP PM", "GMP", "PSSR"],                                missing_skills: [],                              status: "open",        blocker: null },
  { id: "5", title: "Reactor Maintenance — Weekend Shift Cover",  site: "Alpha Manufacturing",   type: "Shift Cover",  match_score: 94, required_skills: ["Hydraulic Systems", "Confined Space"],                  missing_skills: [],                              status: "open",        blocker: null },
  { id: "6", title: "Vibration Analysis Level II Course",         site: "CBM Training Academy",  type: "Training",     match_score: 100, required_skills: ["Vibration Analysis Level I"],                          missing_skills: [],                              status: "open",        blocker: null },
  { id: "7", title: "Reliability Engineer — Fixed Term",          site: "Beta Energy Plant",     type: "Job",          match_score: 55, required_skills: ["Vibration Analysis", "ATEX", "RCA", "Root Cause"],      missing_skills: ["ATEX", "RCA Qualification"],    status: "open",        blocker: "Expired Manual Handling cert" },
  { id: "8", title: "GMP Compliance Auditor Secondment",          site: "Pharma Division HQ",    type: "Project",      match_score: 69, required_skills: ["GMP Compliance", "PSSR", "Documentation"],              missing_skills: ["GMP Advanced"],                status: "open",        blocker: null },
];

const CAREER_PATHS: Array<{ title: string; readiness: number; missing: string[]; icon: React.ElementType }> = [
  { title: "Senior Mechanical Engineer", readiness: 87, missing: [],                                                              icon: Briefcase     },
  { title: "Shift Lead — Maintenance",   readiness: 72, missing: ["Vibration Analysis Level II"],                                icon: CalendarDays  },
  { title: "Maintenance Planner",        readiness: 68, missing: ["Project Management Fundamentals"],                            icon: Network       },
  { title: "Reliability Engineer",       readiness: 55, missing: ["ATEX Certification", "RCA Qualification"],                    icon: TrendingUp    },
  { title: "Maintenance Manager",        readiness: 41, missing: ["People Management", "IOSH Managing Safely", "Budget Control"], icon: Star          },
];

const AI_ACTIONS: AiAction[] = [
  { label: "Apply for Senior Mechanical Engineer",   description: "87% match — strong fit. Review requirements and register interest today.",                              priority: "high",     icon: Briefcase  },
  { label: "Complete ATEX Certification",            description: "Unlocks Predictive Maintenance Specialist (currently shortlisted) and Reliability Engineer roles.",     priority: "high",     icon: Zap        },
  { label: "Book Vibration Analysis Level II",       description: "Closing this gap lifts your Shift Lead match score from 72% to 89% and opens 4 additional roles.",    priority: "medium",   icon: GraduationCap },
  { label: "Upload Vibration Analysis evidence",     description: "Your Level I is unvalidated. Validating it immediately improves 3 match scores.",                     priority: "medium",   icon: Upload     },
  { label: "Explore Shift Cover opportunities",      description: "You score 94% on current Reactor Maintenance cover. Quick win to build visibility and earn additional.", priority: "low",     icon: CalendarDays },
];

const PAGE_SIZE = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreClass(s: number): string {
  if (s >= 85) return "text-emerald-400";
  if (s >= 70) return "text-blue-400";
  if (s >= 55) return "text-yellow-400";
  return "text-red-400";
}

function scoreLabel(s: number): string {
  if (s >= 85) return "Strong Match";
  if (s >= 70) return "Good Match";
  if (s >= 55) return "Partial Match";
  return "Weak Match";
}

function scoreBg(s: number): string {
  if (s >= 85) return "[&>div]:bg-emerald-500";
  if (s >= 70) return "[&>div]:bg-blue-500";
  if (s >= 55) return "[&>div]:bg-yellow-400";
  return "[&>div]:bg-red-500";
}

function typeClass(t: OppType): string {
  switch (t) {
    case "Job":         return "bg-[#3b82f620] text-blue-400";
    case "Project":     return "bg-[#8b5cf620] text-violet-400";
    case "Shift Cover": return "bg-[#10b98120] text-emerald-400";
    case "Training":    return "bg-[#06b6d420] text-cyan-400";
    case "Career Step": return "bg-[#f9731620] text-orange-400";
  }
}

function statusClass(s: OppStatus): string {
  switch (s) {
    case "open":        return "bg-[#10b98120] text-emerald-400";
    case "shortlisted": return "bg-[#3b82f620] text-blue-400";
    case "applied":     return "bg-[#facc1520] text-yellow-400";
    case "closed":      return "bg-gray-800 text-slate-500";
  }
}

function statusLabel(s: OppStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SkelLine({ w = "w-24", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} animate-pulse rounded bg-gray-800`} />;
}

function SectionCard({ title, sub, badge, children }: {
  title: string; sub?: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
            {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
          </div>
          {badge}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OpportunitiesSection(): JSX.Element {
  const [opps,    setOpps]    = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(0);
  const [page,    setPage]    = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("ai-matching-data");
        if (cancelled) return;
        const raw = (data?.opportunities ?? data?.matches ?? []) as Array<{
          id?: string; title?: string; match_score?: number; status?: string;
          required_skills?: string[]; site?: string;
        }>;
        if (raw.length) {
          const mapped: Opportunity[] = raw.slice(0, 10).map((r, i) => ({
            id: r.id ?? String(i),
            title: r.title ?? "Opportunity",
            site: r.site ?? "Alpha Manufacturing",
            type: "Job",
            match_score: r.match_score ?? 0,
            required_skills: r.required_skills ?? [],
            missing_skills: [],
            status: (r.status ?? "open") as OppStatus,
            blocker: null,
          }));
          setOpps(mapped);
        } else {
          setOpps(MOCK_OPPORTUNITIES);
        }
      } catch {
        if (!cancelled) setOpps(MOCK_OPPORTUNITIES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const strong      = useMemo(() => opps.filter((o) => o.match_score >= 85),                          [opps]);
  const open        = useMemo(() => opps.filter((o) => o.status === "open"),                           [opps]);
  const shortlisted = useMemo(() => opps.filter((o) => o.status === "shortlisted"),                    [opps]);
  const blocked     = useMemo(() => opps.filter((o) => o.blocker || o.missing_skills.length > 0),      [opps]);
  const avgScore    = useMemo(() => {
    if (!opps.length) return 0;
    return Math.round(opps.reduce((s, o) => s + o.match_score, 0) / opps.length);
  }, [opps]);

  const filtered = useMemo(() =>
    typeFilter === "all" ? opps : opps.filter((o) => o.type === typeFilter),
    [opps, typeFilter]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const bestMatches = useMemo(() =>
    [...opps].sort((a, b) => b.match_score - a.match_score).slice(0, 3),
    [opps]
  );

  const kpis = [
    { label: "Strong Matches",   value: String(strong.length),    sub: "Score ≥ 85%",           icon: Star,       cls: strong.length > 0 ? "text-emerald-400" : "text-slate-400" },
    { label: "Open",             value: String(open.length),      sub: "Available now",          icon: Briefcase,  cls: "text-blue-400"                                            },
    { label: "Shortlisted",      value: String(shortlisted.length), sub: "Under consideration", icon: CheckCircle2, cls: shortlisted.length > 0 ? "text-blue-400" : "text-slate-400" },
    { label: "Skill Gaps",       value: String(blocked.length),   sub: "Blocking matches",       icon: AlertTriangle, cls: blocked.length > 0 ? "text-orange-400" : "text-emerald-400" },
    { label: "Avg Match Score",  value: loading ? "—" : `${avgScore}%`, sub: `${opps.length} opportunities`, icon: Sparkles, cls: avgScore >= 75 ? "text-emerald-400" : avgScore >= 55 ? "text-yellow-400" : "text-red-400" },
  ];

  const TYPES: Array<{ value: string; label: string }> = [
    { value: "all",         label: "All Types"    },
    { value: "Job",         label: "Jobs"         },
    { value: "Project",     label: "Projects"     },
    { value: "Shift Cover", label: "Shift Cover"  },
    { value: "Training",    label: "Training"     },
    { value: "Career Step", label: "Career Step"  },
  ];

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-50">Opportunities</h1>
          <p className="text-sm text-slate-400">View roles, projects and development opportunities matched to your skills.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-opportunities" />
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 bg-transparent px-3 text-xs font-medium text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(({ label, value, sub, icon: Icon, cls }) => (
          <Card key={label} className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-4 xl:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-medium text-slate-400">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-slate-600" />
              </div>
              <p className={`truncate text-xl font-semibold tabular-nums ${cls}`}>
                {loading ? "—" : value}
              </p>
              <p className="truncate text-[11px] text-slate-500">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── AI Actions ──────────────────────────────────────────────────────── */}
      {!loading && <AiActionsPanel actions={AI_ACTIONS} />}

      {/* ── Best Matches ────────────────────────────────────────────────────── */}
      <SectionCard
        title="Best Matches"
        sub="Your top 3 opportunities by match score"
        badge={
          <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />AI Ranked
          </Badge>
        }
      >
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {bestMatches.map((opp, rank) => (
              <div key={opp.id} className="relative flex flex-col gap-3 rounded-xl border border-gray-800 bg-[#0b0e14] p-4 transition-all hover:border-blue-500/30 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1)]">
                {rank === 0 && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded bg-[#f9731620] px-1.5 py-0.5 text-[9px] font-semibold text-orange-400">
                    <Star className="h-2.5 w-2.5" /> Best
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f615]">
                    {opp.type === "Training" ? (
                      <GraduationCap className="h-4 w-4 text-blue-400" />
                    ) : opp.type === "Career Step" ? (
                      <TrendingUp className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Briefcase className="h-4 w-4 text-blue-400" />
                    )}
                  </div>
                  <span className={`text-2xl font-bold tabular-nums ${scoreClass(opp.match_score)}`}>{opp.match_score}%</span>
                </div>
                <div>
                  <p className="text-xs font-semibold leading-snug text-slate-200">{opp.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{opp.site}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${typeClass(opp.type)}`}>{opp.type}</Badge>
                  <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${statusClass(opp.status)}`}>{statusLabel(opp.status)}</Badge>
                </div>
                <Progress value={opp.match_score} className={`h-1.5 bg-gray-800 ${scoreBg(opp.match_score)}`} />
                <Button size="sm" variant="outline"
                  className="mt-auto h-7 w-full border-gray-700 bg-transparent text-xs text-slate-400 hover:border-blue-500/40 hover:text-blue-400">
                  {opp.status === "shortlisted" ? "View Shortlist" : "Register Interest"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── All Matched Opportunities ────────────────────────────────────────── */}
      <SectionCard
        title="Matched Opportunities"
        sub="All opportunities ranked by match score"
        badge={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setTypeFilter(value); setPage(0); }}
                  className={`h-7 rounded-lg px-2.5 text-[10px] font-medium transition-colors whitespace-nowrap ${typeFilter === value ? "bg-[#3b82f620] text-blue-400" : "text-slate-500 hover:bg-[#ffffff0a] hover:text-slate-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-max min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1318]">
                {["Opportunity", "Site", "Type", "Match", "Required Skills", "Missing", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><SkelLine /></td>
                      ))}
                    </tr>
                  ))
                : paged.length === 0
                ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                        No opportunities found for the selected filter.
                      </td>
                    </tr>
                  )
                : paged.map((opp, i) => (
                    <tr key={opp.id} className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111520]"}`}>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="block truncate text-xs font-medium text-slate-200">{opp.title}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{opp.site}</td>
                      <td className="px-4 py-3">
                        <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${typeClass(opp.type)}`}>
                          {opp.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 min-w-[70px]">
                          <span className={`text-sm font-bold tabular-nums ${scoreClass(opp.match_score)}`}>{opp.match_score}%</span>
                          <span className={`text-[10px] ${scoreClass(opp.match_score)}`}>{scoreLabel(opp.match_score)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <div className="flex flex-wrap gap-1">
                          {opp.required_skills.slice(0, 2).map((s, j) => (
                            <span key={j} className="rounded bg-[#3b82f610] px-1.5 py-0.5 text-[9px] text-slate-400">{s}</span>
                          ))}
                          {opp.required_skills.length > 2 && (
                            <span className="text-[10px] text-slate-600">+{opp.required_skills.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[140px]">
                        {opp.missing_skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {opp.missing_skills.slice(0, 1).map((s, j) => (
                              <span key={j} className="rounded bg-[#ef444415] px-1.5 py-0.5 text-[9px] text-red-400">{s}</span>
                            ))}
                            {opp.missing_skills.length > 1 && (
                              <span className="text-[10px] text-slate-600">+{opp.missing_skills.length - 1}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-emerald-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusClass(opp.status)}`}>
                          {statusLabel(opp.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button type="button"
                            className="rounded border border-gray-700 px-2 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                            View
                          </button>
                          {opp.status === "open" && (
                            <button type="button"
                              className="rounded border border-gray-700 px-2 py-0.5 text-[10px] font-medium text-slate-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-400 whitespace-nowrap">
                              Apply
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 6) }).map((_, i) => (
                <button key={i} type="button" onClick={() => setPage(i)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${i === page ? "bg-blue-500/20 font-semibold text-blue-400" : "text-slate-500 hover:bg-[#ffffff1a]"}`}>
                  {i + 1}
                </button>
              ))}
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 text-slate-400 transition-colors hover:bg-[#ffffff1a] disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Blocked + Career (2-col on xl) ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Blocked Opportunities */}
        <SectionCard
          title="Close But Blocked"
          sub="Opportunities you can unlock by closing skill or certification gaps"
          badge={
            blocked.length > 0 ? (
              <Badge className="inline-flex h-auto shrink-0 rounded bg-[#f9731620] px-2 py-0.5 text-[10px] font-medium text-orange-400 shadow-none hover:bg-[#f9731620]">
                {blocked.length} blocked
              </Badge>
            ) : null
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-800" />
              ))}
            </div>
          ) : blocked.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
              <p className="text-sm font-medium text-emerald-400">No blocked opportunities</p>
              <p className="text-[11px] text-slate-500">Your skills meet all current opportunity requirements.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {blocked.map((opp) => (
                <div key={opp.id} className="flex items-start gap-3 rounded-lg border border-[#f9731620] bg-[#f9731608] px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f9731620]">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-slate-200">{opp.title}</p>
                      <span className={`shrink-0 text-sm font-bold tabular-nums ${scoreClass(opp.match_score)}`}>{opp.match_score}%</span>
                    </div>
                    <p className="text-[11px] text-orange-400/80">
                      {opp.blocker ?? `Missing: ${opp.missing_skills.slice(0, 2).join(", ")}`}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {opp.missing_skills.map((s, j) => (
                        <span key={j} className="rounded bg-[#ef444415] px-1.5 py-0.5 text-[9px] text-red-400">{s}</span>
                      ))}
                    </div>
                  </div>
                  <button type="button"
                    className="shrink-0 rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                    Fix Gap
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Career Progression */}
        <SectionCard
          title="Career Progression"
          sub="Internal pathways and readiness scores"
        >
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <SkelLine w="w-48" /><div className="h-2 w-full animate-pulse rounded bg-gray-800" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {CAREER_PATHS.map(({ title, readiness, missing, icon: Icon }) => (
                <div key={title} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#3b82f615]">
                        <Icon className="h-3 w-3 text-blue-400" />
                      </div>
                      <span className="truncate text-xs font-medium text-slate-200">{title}</span>
                    </div>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${scoreClass(readiness)}`}>{readiness}%</span>
                  </div>
                  <Progress value={readiness} className={`h-1.5 bg-gray-800 ${scoreBg(readiness)}`} />
                  {missing.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {missing.slice(0, 3).map((s, j) => (
                        <span key={j} className="rounded bg-[#ef444410] px-1.5 py-0.5 text-[9px] text-red-400/80">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── AI Recommendations ──────────────────────────────────────────────── */}
      <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex min-w-0 flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-slate-200">AI Recommendations</h2>
              <p className="text-[11px] text-slate-500">Personalised actions to unlock more opportunities</p>
            </div>
            <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
            </Badge>
          </div>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-gray-800 p-3">
                  <SkelLine w="w-48" h="h-3.5" /><div className="mt-2"><SkelLine w="w-full" h="h-2.5" /></div>
                </div>
              ))}
            </div>
          ) : (
            <AiActionsPanel actions={AI_ACTIONS} />
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "View Details",          icon: Briefcase    },
              { label: "Register Interest",     icon: CheckCircle2 },
              { label: "Update Skills",         icon: Network      },
              { label: "Book Training",         icon: GraduationCap },
              { label: "Request Validation",    icon: Award        },
            ].map(({ label, icon: Icon }) => (
              <Button key={label} size="sm" variant="outline"
                className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

    </section>
  );
}
