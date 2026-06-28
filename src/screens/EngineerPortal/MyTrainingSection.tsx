import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { SyncIndicator } from "../../components/SyncIndicator";
import { supabase } from "../../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MyBooking {
  id?: string;
  course_title: string;
  status: string;
  booking_date: string | null;
  delivery_type?: string | null;
  partner_name?: string | null;
  cost?: number | null;
  currency?: string;
}

interface RequiredCourse {
  name: string;
  linked_skill_gap: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  due_date: string | null;
  status: "Not Booked" | "Booked" | "In Progress" | "Overdue";
}

interface CompletedCourse {
  name: string;
  completion_date: string;
  cert_status: "Uploaded" | "Pending" | "Not Required";
  linked_skills: string[];
}

interface AiRecommendation {
  title: string;
  reason: string;
  impact: string;
  tag: "Skill Gap" | "Match Score" | "Career Step" | "Compliance";
  urgency: "critical" | "high" | "medium" | "low";
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_REQUIRED: RequiredCourse[] = [
  { name: "ATEX Zone Classification",       linked_skill_gap: "ATEX Zone Classification",    priority: "Critical", due_date: "2025-08-01", status: "Not Booked"  },
  { name: "PSSR Refresher",                 linked_skill_gap: "PSSR Pressure Systems",        priority: "High",     due_date: "2025-09-14", status: "Booked"      },
  { name: "Manual Handling Renewal",        linked_skill_gap: "Manual Handling",              priority: "High",     due_date: "2025-07-01", status: "Overdue"     },
  { name: "Confined Space Refresher",       linked_skill_gap: "Confined Space Entry",         priority: "Medium",   due_date: "2025-10-30", status: "In Progress" },
  { name: "Lean Maintenance Principles",    linked_skill_gap: "Lean Maintenance Principles",  priority: "Low",      due_date: "2025-12-31", status: "Not Booked"  },
];

const MOCK_UPCOMING: MyBooking[] = [
  { course_title: "PSSR Refresher — Pressure Systems",  status: "approved",         booking_date: "2025-07-18", delivery_type: "classroom", partner_name: "Safety Pro Ltd" },
  { course_title: "Advanced PLC Programming",           status: "booked",           booking_date: "2025-08-05", delivery_type: "onsite",    partner_name: "ABB Training"   },
  { course_title: "Manual Handling Renewal",            status: "pending_approval", booking_date: null,         delivery_type: "blended",   partner_name: null             },
];

const MOCK_COMPLETED: CompletedCourse[] = [
  { name: "Confined Space Entry",           completion_date: "2025-05-12", cert_status: "Uploaded",      linked_skills: ["Confined Space", "Safety Compliance"] },
  { name: "GMP Fundamentals",               completion_date: "2025-03-28", cert_status: "Uploaded",      linked_skills: ["GMP Compliance"]                      },
  { name: "Electrical Safety LV",           completion_date: "2024-11-14", cert_status: "Uploaded",      linked_skills: ["Electrical Safety LV"]                },
  { name: "Hydraulic Systems Fundamentals", completion_date: "2024-09-03", cert_status: "Pending",       linked_skills: ["Hydraulic Systems"]                   },
];

const MOCK_AI: AiRecommendation[] = [
  { title: "ATEX Zone Certification",          reason: "Missing ATEX limits eligibility for Zone 1 work orders.",              impact: "+9 pts match score",     tag: "Skill Gap",    urgency: "critical" },
  { title: "Vibration Analysis Level II",      reason: "Closing this gap unlocks Predictive Maintenance Specialist roles.",     impact: "+6 pts match score",     tag: "Career Step",  urgency: "high"     },
  { title: "Manual Handling Renewal",          reason: "Expired Nov 2024. Site compliance requires renewal within 30 days.",    impact: "Compliance risk",        tag: "Compliance",   urgency: "critical" },
  { title: "Project Management Fundamentals",  reason: "Required for Senior Engineer progression. Online module — 8 hrs.",      impact: "Unlocks next role",       tag: "Career Step",  urgency: "medium"   },
];

const AI_ACTIONS: AiAction[] = [
  { label: "Book ATEX Certification",          description: "Missing ATEX limits Zone 1 work eligibility. Book now to add +9 pts to your match score.",        priority: "critical", icon: Zap       },
  { label: "Renew Manual Handling Certificate", description: "Your Manual Handling cert expired Nov 2024. Site compliance requires renewal within 30 days.",   priority: "critical", icon: AlertTriangle },
  { label: "Enrol in Vibration Analysis II",   description: "Closing this gap accelerates progression to Predictive Maintenance Specialist.",                 priority: "high",     icon: TrendingUp },
  { label: "View Training Marketplace",        description: "Browse all available courses aligned to your skill gaps and career targets.",                     priority: "low",      icon: BookOpen   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return "TBC";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function priorityClass(p: string): string {
  switch (p) {
    case "Critical": return "bg-[#ef444420] text-red-400";
    case "High":     return "bg-[#f9731620] text-orange-400";
    case "Medium":   return "bg-[#facc1520] text-yellow-400";
    default:         return "bg-[#10b98120] text-emerald-400";
  }
}

function statusClass(s: string): string {
  switch (s) {
    case "Completed":
    case "Uploaded":    return "bg-[#10b98120] text-emerald-400";
    case "Booked":
    case "In Progress":
    case "approved":
    case "booked":      return "bg-[#3b82f620] text-blue-400";
    case "Overdue":
    case "Expired":     return "bg-[#ef444420] text-red-400";
    case "pending_approval":
    case "Pending":     return "bg-[#facc1520] text-yellow-400";
    default:            return "bg-gray-800 text-slate-400";
  }
}

function deliveryClass(t: string | null | undefined): string {
  switch (t) {
    case "classroom": return "bg-[#3b82f620] text-blue-400";
    case "blended":   return "bg-[#8b5cf620] text-violet-400";
    case "onsite":    return "bg-[#10b98120] text-emerald-400";
    default:          return "bg-gray-800 text-slate-400";
  }
}

function bookingStatusLabel(s: string): string {
  if (s === "pending_approval") return "Pending";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function urgencyDot(u: string): string {
  if (u === "critical") return "bg-red-500";
  if (u === "high")     return "bg-orange-400";
  if (u === "medium")   return "bg-yellow-400";
  return "bg-emerald-400";
}

function tagClass(t: string): string {
  switch (t) {
    case "Compliance":   return "bg-[#ef444415] text-red-400";
    case "Skill Gap":    return "bg-[#f9731615] text-orange-400";
    case "Match Score":  return "bg-[#3b82f615] text-blue-400";
    case "Career Step":  return "bg-[#10b98115] text-emerald-400";
    default:             return "bg-gray-800 text-slate-400";
  }
}

function certClass(s: string): string {
  if (s === "Uploaded")     return "bg-[#10b98120] text-emerald-400";
  if (s === "Pending")      return "bg-[#facc1520] text-yellow-400";
  return "bg-gray-800 text-slate-400";
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

export function MyTrainingSection(): JSX.Element {
  const [upcoming,  setUpcoming]  = useState<MyBooking[]>([]);
  const [completed, setCompleted] = useState<CompletedCourse[]>([]);
  const [required,  setRequired]  = useState<RequiredCourse[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tick,      setTick]      = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("training-data");
        if (cancelled) return;
        const bookings: MyBooking[] = (data?.recentActivity ?? []).slice(0, 10);
        if (bookings.length) {
          setUpcoming(bookings.filter((b: MyBooking) => b.status !== "completed").slice(0, 5));
          setCompleted(
            bookings
              .filter((b: MyBooking) => b.status === "completed")
              .slice(0, 6)
              .map((b: MyBooking) => ({
                name: b.course_title,
                completion_date: b.booking_date ?? "",
                cert_status: "Pending" as const,
                linked_skills: [],
              }))
          );
        } else {
          setUpcoming(MOCK_UPCOMING);
          setCompleted(MOCK_COMPLETED);
        }
        setRequired(MOCK_REQUIRED);
      } catch {
        if (!cancelled) {
          setUpcoming(MOCK_UPCOMING);
          setCompleted(MOCK_COMPLETED);
          setRequired(MOCK_REQUIRED);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  // ── KPI counts ───────────────────────────────────────────────────────────────

  const kpis = useMemo(() => [
    {
      label: "Required Training",
      value: String(required.length),
      sub: "Mandatory courses",
      icon: ClipboardListIcon,
      cls: required.length > 0 ? "text-orange-400" : "text-emerald-400",
    },
    {
      label: "Booked / In Progress",
      value: String(upcoming.filter((b) => ["booked", "approved", "booked"].includes(b.status)).length),
      sub: "Confirmed bookings",
      icon: CalendarDays,
      cls: "text-blue-400",
    },
    {
      label: "Completed",
      value: String(completed.length),
      sub: "This year",
      icon: CheckCircle2,
      cls: "text-emerald-400",
    },
    {
      label: "Overdue",
      value: String(required.filter((r) => r.status === "Overdue").length),
      sub: "Require immediate action",
      icon: AlertTriangle,
      cls: required.some((r) => r.status === "Overdue") ? "text-red-400" : "text-emerald-400",
    },
    {
      label: "AI Recommended",
      value: String(MOCK_AI.length),
      sub: "Personalised suggestions",
      icon: Sparkles,
      cls: "text-blue-400",
    },
  ], [required, upcoming, completed]);

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-50">My Training</h1>
          <p className="text-sm text-slate-400">View required training, upcoming courses and AI-recommended development.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-training" />
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

      {/* ── AI Action Panel ──────────────────────────────────────────────────── */}
      {!loading && <AiActionsPanel actions={AI_ACTIONS} />}

      {/* ── Required Training ───────────────────────────────────────────────── */}
      <SectionCard
        title="Required Training"
        sub="Mandatory courses based on your role, skills and compliance status"
        badge={
          required.filter((r) => r.status === "Overdue").length > 0 ? (
            <Badge className="inline-flex h-auto shrink-0 rounded bg-[#ef444420] px-2 py-0.5 text-[10px] font-medium text-red-400 shadow-none hover:bg-[#ef444420]">
              {required.filter((r) => r.status === "Overdue").length} overdue
            </Badge>
          ) : null
        }
      >
        <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-max min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1318]">
                {["Course / Training", "Linked Skill Gap", "Priority", "Due Date", "Status", "Action"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><SkelLine /></td>
                      ))}
                    </tr>
                  ))
                : required.map((r, i) => (
                    <tr key={i} className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111520]"}`}>
                      <td className="px-4 py-3 font-medium text-slate-200 max-w-[200px]">
                        <span className="block truncate text-xs">{r.name}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[180px]">
                        <span className="block truncate">{r.linked_skill_gap}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${priorityClass(r.priority)}`}>
                          {r.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{fmtDate(r.due_date)}</td>
                      <td className="px-4 py-3">
                        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusClass(r.status)}`}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400"
                        >
                          {r.status === "Not Booked" || r.status === "Overdue" ? "Book" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Upcoming Training + Completed (2-col on lg) ──────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Upcoming Training */}
        <SectionCard
          title="Upcoming Training"
          sub="Confirmed bookings and pending requests"
          badge={
            <span className="text-[11px] text-slate-500">
              {loading ? "—" : `${upcoming.length} booking${upcoming.length !== 1 ? "s" : ""}`}
            </span>
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-40" /><SkelLine w="w-24" h="h-2.5" /></div>
                </div>
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarDays className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">No upcoming bookings.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((b, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-800 bg-[#0b0e14] px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#3b82f615]">
                    <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-xs font-medium text-slate-200">{b.course_title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {b.partner_name && <span className="text-[11px] text-slate-500">{b.partner_name}</span>}
                      <span className="text-[11px] text-slate-500">{fmtDate(b.booking_date)}</span>
                      {b.delivery_type && (
                        <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${deliveryClass(b.delivery_type)}`}>
                          {b.delivery_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge className={`shrink-0 inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${statusClass(b.status)}`}>
                    {bookingStatusLabel(b.status)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Completed Training */}
        <SectionCard
          title="Completed Training"
          sub="Training history and evidence status"
          badge={
            completed.filter((c) => c.cert_status === "Pending").length > 0 ? (
              <Badge className="inline-flex h-auto shrink-0 rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">
                {completed.filter((c) => c.cert_status === "Pending").length} pending
              </Badge>
            ) : null
          }
        >
          {loading ? (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-gray-800/60">
                  <SkelLine w="w-40" /><SkelLine w="w-16" />
                </div>
              ))}
            </div>
          ) : completed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">No completed training recorded.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {completed.map((c, i) => (
                <div key={i} className="flex items-start gap-3 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/60" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-xs font-medium text-slate-200">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-slate-500">{fmtDate(c.completion_date)}</span>
                      {c.linked_skills.slice(0, 2).map((s, j) => (
                        <span key={j} className="rounded bg-[#3b82f610] px-1.5 py-0.5 text-[10px] text-slate-400">{s}</span>
                      ))}
                    </div>
                  </div>
                  <Badge className={`shrink-0 inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${certClass(c.cert_status)}`}>
                    {c.cert_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── AI Recommendations ───────────────────────────────────────────────── */}
      <SectionCard
        title="AI Recommendations"
        sub="Personalised training suggestions to close gaps and advance your career"
        badge={
          <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
          </Badge>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MOCK_AI.map((rec, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-[#0b0e14] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${urgencyDot(rec.urgency)}`} />
                  <p className="text-xs font-semibold text-slate-200 leading-snug">{rec.title}</p>
                </div>
                <Badge className={`inline-flex h-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${tagClass(rec.tag)}`}>
                  {rec.tag}
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">{rec.reason}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-emerald-400">{rec.impact}</span>
                <button
                  type="button"
                  className="rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400"
                >
                  Book Course
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Book Training",            icon: GraduationCap },
              { label: "Upload Evidence",          icon: Upload        },
              { label: "View Training Marketplace", icon: BookOpen      },
              { label: "Request Approval",         icon: Clock         },
              { label: "View Certifications",      icon: Award         },
            ].map(({ label, icon: Icon }) => (
              <Button
                key={label}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-gray-700 bg-transparent text-slate-400 hover:border-blue-500/40 hover:text-blue-400 text-xs"
              >
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

// Inline icon alias (avoids another import for a simple clipboard icon)
function ClipboardListIcon({ className }: { className?: string }) {
  return <GraduationCap className={className} />;
}
