import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  GraduationCap,
  MapPin,
  MessageSquare,
  RefreshCw,
  ShoppingBag,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { AiActionsPanel, AiAction } from "../../components/AiActionsPanel";
import { ExplainWithAi } from "../../components/ExplainWithAi";
import { SyncIndicator } from "../../components/SyncIndicator";
import { supabase } from "../../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  course_title: string;
  partner_name: string | null;
  booking_date: string | null;
  time: string | null;
  location: string | null;
  delivery_type: string | null;
  status: string;
  linked_skill: string | null;
  result: string | null;
  cert_available: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_UPCOMING: Booking[] = [
  { id: "1", course_title: "PSSR Refresher — Pressure Systems",   partner_name: "Safety Pro Ltd",    booking_date: "2025-07-18", time: "09:00",  location: "Training Suite A, Site",       delivery_type: "classroom", status: "approved",         linked_skill: "PSSR Pressure Systems", result: null, cert_available: false },
  { id: "2", course_title: "Advanced PLC Programming",            partner_name: "ABB Training",       booking_date: "2025-08-05", time: "09:30",  location: "Workshop B, Engineering Block", delivery_type: "onsite",    status: "booked",           linked_skill: "Allen Bradley PLC",     result: null, cert_available: false },
  { id: "3", course_title: "Manual Handling Renewal",             partner_name: null,                 booking_date: null,         time: null,     location: null,                           delivery_type: "blended",   status: "pending_approval", linked_skill: "Manual Handling",       result: null, cert_available: false },
];

const MOCK_HISTORY: Booking[] = [
  { id: "4", course_title: "Confined Space Entry",                partner_name: "Site Safety Co",    booking_date: "2025-05-12", time: null, location: null, delivery_type: "classroom", status: "completed",  linked_skill: "Confined Space",         result: "Pass",       cert_available: true  },
  { id: "5", course_title: "GMP Fundamentals",                    partner_name: "Pharma Academy",    booking_date: "2025-03-28", time: null, location: null, delivery_type: "online",    status: "completed",  linked_skill: "GMP Compliance",         result: "Pass",       cert_available: true  },
  { id: "6", course_title: "Electrical Safety LV",                partner_name: "Elec Skills Ltd",   booking_date: "2024-11-14", time: null, location: null, delivery_type: "classroom", status: "completed",  linked_skill: "Electrical Safety LV",   result: "Pass",       cert_available: true  },
  { id: "7", course_title: "Hydraulic Systems Fundamentals",      partner_name: "HydroTech",         booking_date: "2024-09-03", time: null, location: null, delivery_type: "onsite",    status: "completed",  linked_skill: "Hydraulic Systems",      result: "Pass",       cert_available: false },
  { id: "8", course_title: "Root Cause Analysis Workshop",        partner_name: null,                booking_date: "2024-06-20", time: null, location: null, delivery_type: "classroom", status: "cancelled",  linked_skill: null,                     result: "Cancelled",  cert_available: false },
];

const AI_ACTIONS: AiAction[] = [
  { label: "Book Manual Handling Renewal",     description: "Cert expired Nov 2024. Approval pending — chase manager to expedite before compliance deadline.",   priority: "critical", icon: AlertTriangle },
  { label: "Bring forward PSSR Refresher",     description: "Cert expires 14 Sep. Course booked for 18 Jul — confirm attendance and logistics.",                  priority: "high",     icon: Zap           },
  { label: "Book ATEX Certification",          description: "No booking exists for ATEX. Closing this gap adds +9 pts to your AI match score.",                   priority: "high",     icon: GraduationCap },
  { label: "Explore career-step courses",      description: "Vibration Analysis II and Project Management Fundamentals are available. Both support Senior role.",  priority: "low",      icon: BookOpen      },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return "TBC";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusClass(s: string): string {
  switch (s) {
    case "completed":        return "bg-[#10b98120] text-emerald-400";
    case "approved":
    case "booked":           return "bg-[#3b82f620] text-blue-400";
    case "pending_approval": return "bg-[#facc1520] text-yellow-400";
    case "cancelled":        return "bg-[#ef444420] text-red-400";
    default:                 return "bg-gray-800 text-slate-400";
  }
}

function statusLabel(s: string): string {
  if (s === "pending_approval") return "Pending";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function deliveryClass(t: string | null | undefined): string {
  switch (t) {
    case "classroom": return "bg-[#3b82f620] text-blue-400";
    case "blended":   return "bg-[#8b5cf620] text-violet-400";
    case "onsite":    return "bg-[#10b98120] text-emerald-400";
    case "online":    return "bg-[#06b6d420] text-cyan-400";
    default:          return "bg-gray-800 text-slate-400";
  }
}

function resultClass(r: string | null): string {
  if (r === "Pass")      return "bg-[#10b98120] text-emerald-400";
  if (r === "Fail")      return "bg-[#ef444420] text-red-400";
  if (r === "Cancelled") return "bg-[#ef444420] text-red-400";
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

export function MyBookingsSection(): JSX.Element {
  const [upcoming,  setUpcoming]  = useState<Booking[]>([]);
  const [history,   setHistory]   = useState<Booking[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tick,      setTick]      = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("training-data");
        if (cancelled) return;
        const raw = (data?.recentActivity ?? []) as Array<{
          id?: string; course_title: string; status: string; booking_date: string | null;
          delivery_type?: string | null; partner_name?: string | null;
        }>;
        if (raw.length) {
          const mapped: Booking[] = raw.map((b, i) => ({
            id: b.id ?? String(i),
            course_title: b.course_title,
            partner_name: b.partner_name ?? null,
            booking_date: b.booking_date,
            time: null,
            location: null,
            delivery_type: b.delivery_type ?? null,
            status: b.status,
            linked_skill: null,
            result: b.status === "completed" ? "Pass" : null,
            cert_available: false,
          }));
          setUpcoming(mapped.filter((b) => b.status !== "completed" && b.status !== "cancelled").slice(0, 6));
          setHistory(mapped.filter((b) => b.status === "completed" || b.status === "cancelled").slice(0, 8));
        } else {
          setUpcoming(MOCK_UPCOMING);
          setHistory(MOCK_HISTORY);
        }
      } catch {
        if (!cancelled) {
          setUpcoming(MOCK_UPCOMING);
          setHistory(MOCK_HISTORY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tick]);

  // ── KPIs ─────────────────────────────────────────────────────────────────────

  const pending    = useMemo(() => upcoming.filter((b) => b.status === "pending_approval"), [upcoming]);
  const confirmed  = useMemo(() => upcoming.filter((b) => b.status === "approved" || b.status === "booked"), [upcoming]);
  const completed  = useMemo(() => history.filter((b) => b.status === "completed"), [history]);
  const cancelled  = useMemo(() => history.filter((b) => b.status === "cancelled"), [history]);
  const attendPct  = useMemo(() => {
    const total = completed.length + cancelled.length;
    return total > 0 ? Math.round((completed.length / total) * 100) : 100;
  }, [completed, cancelled]);

  const kpis = [
    { label: "Upcoming",         value: String(confirmed.length),  sub: "Confirmed bookings",   icon: CalendarDays, cls: "text-blue-400"    },
    { label: "Pending Approval", value: String(pending.length),    sub: "Awaiting manager sign-off", icon: Clock, cls: pending.length > 0 ? "text-yellow-400" : "text-emerald-400" },
    { label: "Completed",        value: String(completed.length),  sub: "This year",             icon: CheckCircle2, cls: "text-emerald-400" },
    { label: "Cancelled",        value: String(cancelled.length),  sub: "Sessions not attended", icon: XCircle,      cls: cancelled.length > 0 ? "text-red-400" : "text-emerald-400" },
    { label: "Attendance %",     value: `${attendPct}%`,           sub: "Completion rate",       icon: Award,        cls: attendPct >= 90 ? "text-emerald-400" : attendPct >= 70 ? "text-yellow-400" : "text-red-400" },
  ];

  // ── Timeline (upcoming sorted chronologically) ────────────────────────────

  const timeline = useMemo(() =>
    [...upcoming]
      .filter((b) => b.booking_date)
      .sort((a, b) => new Date(a.booking_date!).getTime() - new Date(b.booking_date!).getTime()),
    [upcoming]
  );

  return (
    <section className="flex min-w-0 w-full flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-5 md:px-6 xl:px-8">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold text-slate-50">My Bookings</h1>
          <p className="text-sm text-slate-400">Manage your upcoming, pending and completed training bookings.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SyncIndicator />
          <ExplainWithAi pageId="engineer-bookings" />
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

      {/* ── Upcoming Bookings table ──────────────────────────────────────────── */}
      <SectionCard
        title="Upcoming Bookings"
        sub="Confirmed and in-progress training sessions"
        badge={
          confirmed.length > 0 ? (
            <Badge className="inline-flex h-auto shrink-0 rounded bg-[#3b82f620] px-2 py-0.5 text-[10px] font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
              {confirmed.length} confirmed
            </Badge>
          ) : null
        }
      >
        <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-max min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1318]">
                {["Course", "Provider", "Date", "Time", "Location", "Delivery", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-800/50 bg-[#141820]">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><SkelLine /></td>
                      ))}
                    </tr>
                  ))
                : confirmed.length === 0
                ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                        No upcoming bookings. Book training via the Training Marketplace.
                      </td>
                    </tr>
                  )
                : confirmed.map((b, i) => (
                    <tr key={b.id} className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111520]"}`}>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="block truncate text-xs font-medium text-slate-200">{b.course_title}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{b.partner_name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(b.booking_date)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{b.time ?? "TBC"}</td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          {b.location ? (
                            <>
                              <MapPin className="h-3 w-3 shrink-0 text-slate-600" />
                              <span className="truncate">{b.location}</span>
                            </>
                          ) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {b.delivery_type ? (
                          <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${deliveryClass(b.delivery_type)}`}>
                            {b.delivery_type}
                          </Badge>
                        ) : <span className="text-xs text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusClass(b.status)}`}>
                          {statusLabel(b.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button type="button" title="Download joining instructions"
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-700 text-slate-500 transition-colors hover:border-gray-600 hover:text-slate-300">
                            <Download className="h-3 w-3" />
                          </button>
                          <button type="button" title="Cancel booking"
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-700 text-slate-500 transition-colors hover:border-red-500/40 hover:text-red-400">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Pending Approval ────────────────────────────────────────────────── */}
      {(loading || pending.length > 0) && (
        <SectionCard
          title="Pending Approval"
          sub="Bookings awaiting manager sign-off"
          badge={
            pending.length > 0 ? (
              <Badge className="inline-flex h-auto shrink-0 rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">
                {pending.length} waiting
              </Badge>
            ) : null
          }
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
                  <div className="h-7 w-7 animate-pulse rounded-lg bg-gray-800 shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5"><SkelLine w="w-48" /><SkelLine w="w-32" h="h-2.5" /></div>
                  <SkelLine w="w-16" h="h-5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pending.map((b) => (
                <div key={b.id} className="flex items-start gap-3 rounded-lg border border-[#facc1520] bg-[#facc1508] px-4 py-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#facc1520]">
                    <Clock className="h-3.5 w-3.5 text-yellow-400" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-xs font-medium text-slate-200">{b.course_title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {b.partner_name && <span className="text-[11px] text-slate-500">{b.partner_name}</span>}
                      {b.delivery_type && (
                        <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${deliveryClass(b.delivery_type)}`}>
                          {b.delivery_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className="inline-flex h-auto rounded bg-[#facc1520] px-2 py-0.5 text-[10px] font-medium text-yellow-400 shadow-none hover:bg-[#facc1520]">
                      Pending
                    </Badge>
                    <button type="button"
                      className="rounded border border-gray-700 px-2.5 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-blue-500/40 hover:text-blue-400 whitespace-nowrap">
                      Chase Manager
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Timeline + AI Insights (2-col on xl) ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Booking Timeline */}
        <SectionCard title="Booking Timeline" sub="Upcoming training in chronological order">
          {loading ? (
            <div className="flex flex-col gap-4 pl-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="relative flex gap-4">
                  <div className="absolute -left-4 top-1 h-2 w-2 animate-pulse rounded-full bg-gray-800" />
                  <div className="flex flex-1 flex-col gap-1.5 border-l border-gray-800 pl-4">
                    <SkelLine w="w-40" /><SkelLine w="w-24" h="h-2.5" />
                  </div>
                </div>
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarDays className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-500">No scheduled training dates yet.</p>
            </div>
          ) : (
            <div className="relative flex flex-col gap-0 border-l border-gray-800 pl-4">
              {timeline.map((b, i) => (
                <div key={b.id} className={`relative flex flex-col gap-0.5 pb-5 ${i === timeline.length - 1 ? "pb-0" : ""}`}>
                  <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full border-2 border-gray-800 bg-blue-500" />
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-200 leading-snug">{b.course_title}</p>
                    <Badge className={`shrink-0 inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${statusClass(b.status)}`}>
                      {statusLabel(b.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-medium text-blue-400">{fmtDate(b.booking_date)}</span>
                    {b.time && <span className="text-[11px] text-slate-500">{b.time}</span>}
                    {b.partner_name && <span className="text-[11px] text-slate-500">{b.partner_name}</span>}
                    {b.delivery_type && (
                      <Badge className={`inline-flex h-auto rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${deliveryClass(b.delivery_type)}`}>
                        {b.delivery_type}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* AI Insights */}
        <Card className="min-w-0 w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex min-w-0 flex-col gap-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-slate-200">AI Insights</h2>
                <p className="text-[11px] text-slate-500">Booking optimisation and compliance alerts</p>
              </div>
              <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-xs font-medium text-blue-400 shadow-none hover:bg-[#3b82f620]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
              </Badge>
            </div>
            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-gray-800 p-3">
                    <SkelLine w="w-40" h="h-3.5" />
                    <div className="mt-2"><SkelLine w="w-full" h="h-2.5" /></div>
                  </div>
                ))}
              </div>
            ) : (
              <AiActionsPanel actions={AI_ACTIONS} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Booking History table ────────────────────────────────────────────── */}
      <SectionCard
        title="Booking History"
        sub="Completed and cancelled training records"
        badge={
          <span className="text-[11px] text-slate-500">
            {loading ? "—" : `${history.length} records`}
          </span>
        }
      >
        <div className="w-full overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-max min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0f1318]">
                {["Course", "Provider", "Date", "Result", "Certificate", "Linked Skill"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
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
                : history.length === 0
                ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">No booking history found.</td>
                    </tr>
                  )
                : history.map((b, i) => (
                    <tr key={b.id} className={`border-b border-gray-800/50 transition-colors hover:bg-[#1a2030] ${i % 2 === 0 ? "bg-[#141820]" : "bg-[#111520]"}`}>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="block truncate text-xs font-medium text-slate-200">{b.course_title}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{b.partner_name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{fmtDate(b.booking_date)}</td>
                      <td className="px-4 py-3">
                        {b.result ? (
                          <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${resultClass(b.result)}`}>
                            {b.result}
                          </Badge>
                        ) : <span className="text-xs text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {b.cert_available ? (
                          <button type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 transition-colors hover:text-blue-300">
                            <Download className="h-3 w-3" /> Download
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[160px]">
                        <span className="block truncate">{b.linked_skill ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Quick Actions ────────────────────────────────────────────────────── */}
      <Card className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Book Training",                  icon: GraduationCap  },
              { label: "Cancel Booking",                 icon: XCircle        },
              { label: "Download Joining Instructions",  icon: Download       },
              { label: "View Training Marketplace",      icon: ShoppingBag    },
              { label: "Contact Training Provider",      icon: MessageSquare  },
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
