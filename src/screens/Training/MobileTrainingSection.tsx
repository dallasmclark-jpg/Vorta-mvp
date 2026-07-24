import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { useAuth } from "../../lib/auth";
import type { VortaDataMode } from "../../lib/dataTrust";
import { supabase } from "../../lib/supabaseClient";

type TrainingView = "priorities" | "plan" | "courses";

type PriorityRow = {
  id: string;
  skill_name: string;
  category: string;
  is_critical: boolean;
  dept_name: string | null;
  current_avg: number;
  target_rating: number;
  gap: number;
  engineers_qualified: number;
  risk_level: string;
  priority: string;
  single_point_of_failure: boolean;
  recommendation: string;
};

type CertRiskRow = {
  skill_name: string;
  engineer_name: string;
  expiry_date: string | null;
  days_left: number;
  status: string;
  risk_level: string;
};

type Booking = {
  id: string;
  engineer_name: string | null;
  department: string | null;
  course_title: string;
  delivery_type: string | null;
  partner_name: string | null;
  status: string;
  booking_date: string | null;
  cost: number | null;
  currency: string;
};

type Course = {
  id: string;
  title: string;
  partner_name: string | null;
  partner_location: string | null;
  delivery_type: string;
  duration_days: number;
  price: number;
  currency: string;
  skills_covered: string[];
  bookings: number;
};

type TrainingStats = {
  activeBookings: number;
  expiringIn30Days: number;
  engineersNeedingTraining: number;
  criticalGaps: number;
  compliancePct: number;
};

type SelectedRecord =
  | { kind: "priority"; value: PriorityRow }
  | { kind: "certification"; value: CertRiskRow }
  | { kind: "booking"; value: Booking }
  | { kind: "course"; value: Course };

const EMPTY_STATS: TrainingStats = {
  activeBookings: 0,
  expiringIn30Days: 0,
  engineersNeedingTraining: 0,
  criticalGaps: 0,
  compliancePct: 0,
};

function priorityRank(value: string): number {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[value] ?? 4;
}

function tone(value: string): string {
  const normalised = value.toLowerCase();
  if (normalised.includes("critical") || normalised.includes("expired")) return "border-red-500/30 bg-red-500/10 text-red-300";
  if (normalised.includes("high") || normalised.includes("soon")) return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (normalised.includes("medium") || normalised.includes("pending")) return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  if (normalised.includes("completed") || normalised.includes("valid")) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  return "border-blue-500/25 bg-blue-500/10 text-blue-300";
}

function formatDate(value: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 0,
  }).format(value);
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

function recordTitle(record: SelectedRecord | null): string {
  if (!record) return "Training record";
  if (record.kind === "priority") return record.value.skill_name;
  if (record.kind === "certification") return record.value.skill_name;
  if (record.kind === "booking") return record.value.course_title;
  return record.value.title;
}

export function MobileTrainingSection({ dataMode }: { dataMode: VortaDataMode }): JSX.Element {
  const navigate = useNavigate();
  const { siteContext } = useAuth();
  const [view, setView] = useState<TrainingView>("priorities");
  const [priorityRows, setPriorityRows] = useState<PriorityRow[]>([]);
  const [certRiskRows, setCertRiskRows] = useState<CertRiskRow[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<TrainingStats>(EMPTY_STATS);
  const [selectedRecord, setSelectedRecord] = useState<SelectedRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("training-data");
      if (invokeError || !data) {
        throw invokeError ?? new Error("Training evidence could not be loaded.");
      }
      if (siteContext?.siteId && data.siteId && data.siteId !== siteContext.siteId) {
        throw new Error("Training evidence does not match the authorised active site.");
      }
      setPriorityRows(Array.isArray(data.priorityRows) ? (data.priorityRows as PriorityRow[]) : []);
      setCertRiskRows(Array.isArray(data.certRiskRows) ? (data.certRiskRows as CertRiskRow[]) : []);
      setBookings(Array.isArray(data.recentActivity) ? (data.recentActivity as Booking[]) : []);
      setCourses(Array.isArray(data.recommendedCourses) ? (data.recommendedCourses as Course[]) : []);
      setStats({ ...EMPTY_STATS, ...(data.stats as Partial<TrainingStats> | undefined) });
    } catch (loadError) {
      setPriorityRows([]);
      setCertRiskRows([]);
      setBookings([]);
      setCourses([]);
      setStats(EMPTY_STATS);
      setError(loadError instanceof Error ? loadError.message : "Training evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedPriorities = useMemo(
    () =>
      [...priorityRows].sort(
        (left, right) =>
          priorityRank(left.priority) - priorityRank(right.priority) ||
          right.gap - left.gap,
      ),
    [priorityRows],
  );
  const orderedCertifications = useMemo(
    () => [...certRiskRows].sort((left, right) => left.days_left - right.days_left),
    [certRiskRows],
  );
  const orderedBookings = useMemo(
    () =>
      [...bookings].sort(
        (left, right) =>
          new Date(right.booking_date ?? 0).getTime() - new Date(left.booking_date ?? 0).getTime(),
      ),
    [bookings],
  );

  const topPriority = orderedPriorities[0];

  return (
    <section className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pb-24 pt-4" data-vorta-mobile-training="true">
      <DetailDrawer open={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)}>
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="min-w-0 pr-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Training evidence</p>
            <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-50">{recordTitle(selectedRecord)}</h2>
          </div>
          <DrawerCloseButton onClose={() => setSelectedRecord(null)} />
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {selectedRecord?.kind === "priority" ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
                  <p className="text-[9px] text-slate-500">Current</p>
                  <p className="mt-1 text-lg font-semibold text-slate-100">L{selectedRecord.value.current_avg.toFixed(1)}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
                  <p className="text-[9px] text-slate-500">Target</p>
                  <p className="mt-1 text-lg font-semibold text-blue-300">L{selectedRecord.value.target_rating}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
                  <p className="text-[9px] text-slate-500">Gap</p>
                  <p className="mt-1 text-lg font-semibold text-orange-300">{selectedRecord.value.gap}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recorded recommendation</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedRecord.value.recommendation}</p>
              </div>
              <button type="button" onClick={() => navigate("/ai-matching")} className="inline-flex min-h-12 items-center justify-between rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">
                Match engineer and training <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}

          {selectedRecord?.kind === "certification" ? (
            <>
              <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] p-4">
                <p className="text-sm font-semibold text-orange-200">{selectedRecord.value.engineer_name}</p>
                <p className="mt-2 text-sm text-slate-300">{selectedRecord.value.status} · {formatDate(selectedRecord.value.expiry_date)}</p>
                <p className="mt-1 text-xs text-slate-500">{selectedRecord.value.days_left} days remaining</p>
              </div>
              <button type="button" onClick={() => navigate("/engineers")} className="inline-flex min-h-12 items-center justify-between rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">
                Review engineer <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}

          {selectedRecord?.kind === "booking" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
                  <p className="text-[9px] text-slate-500">Engineer</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{selectedRecord.value.engineer_name ?? "Not assigned"}</p>
                </div>
                <div className="rounded-xl border border-gray-800 bg-[#141820] p-3">
                  <p className="text-[9px] text-slate-500">Date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{formatDate(selectedRecord.value.booking_date)}</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                <p className="text-[10px] text-slate-500">Provider</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{selectedRecord.value.partner_name ?? "Provider not recorded"}</p>
                <p className="mt-3 text-[10px] text-slate-500">Status</p>
                <p className="mt-1 text-sm text-slate-300">{selectedRecord.value.status.replaceAll("_", " ")}</p>
              </div>
            </>
          ) : null}

          {selectedRecord?.kind === "course" ? (
            <>
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.07] p-4">
                <p className="text-sm font-semibold text-blue-200">{selectedRecord.value.partner_name ?? "Training provider"}</p>
                <p className="mt-2 text-sm text-slate-300">{selectedRecord.value.delivery_type} · {selectedRecord.value.duration_days} day{selectedRecord.value.duration_days === 1 ? "" : "s"}</p>
                <p className="mt-2 text-xl font-semibold text-slate-50">{formatCurrency(selectedRecord.value.price, selectedRecord.value.currency)}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Skills covered</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRecord.value.skills_covered.map((skill) => (
                    <span key={skill} className="rounded-md border border-gray-800 bg-[#10151d] px-2 py-1 text-xs text-slate-300">{skill}</span>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => navigate("/training-providers")} className="inline-flex min-h-12 items-center justify-between rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">
                View provider catalogue <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </DetailDrawer>

      <header className="flex items-start justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            {dataMode === "live" ? "Verified training" : "Demo training"}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-50">Training Plan</h1>
          <p className="mt-1 text-sm text-slate-400">Close the highest-risk capability gaps first.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh training evidence"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-[#141820] text-slate-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
          <div className="flex items-center gap-2 text-red-300"><AlertTriangle className="h-4 w-4" /><p className="font-semibold">Training evidence unavailable</p></div>
          <p className="mt-2 text-sm text-red-200/80">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Critical gaps" value={loading ? "—" : String(stats.criticalGaps)} detail="Highest priority" />
            <Metric label="Need training" value={loading ? "—" : String(stats.engineersNeedingTraining)} detail="Engineers affected" />
            <Metric label="Certs due" value={loading ? "—" : String(stats.expiringIn30Days)} detail="Within 30 days" />
            <Metric label="Active plan" value={loading ? "—" : String(stats.activeBookings)} detail={`${stats.compliancePct}% compliant`} />
          </div>

          {topPriority ? (
            <button
              type="button"
              onClick={() => setSelectedRecord({ kind: "priority", value: topPriority })}
              className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-red-300"><ShieldAlert className="h-4 w-4" /><p className="text-sm font-semibold">Highest-priority training need</p></div>
                  <h2 className="mt-2 font-semibold text-slate-100">{topPriority.skill_name}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-400">{topPriority.dept_name ?? topPriority.category} · gap {topPriority.gap} · target L{topPriority.target_rating}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-red-300" />
              </div>
            </button>
          ) : null}

          <nav className="grid grid-cols-3 gap-1 rounded-xl border border-gray-800 bg-[#10151d] p-1" aria-label="Training mobile sections">
            {([
              { key: "priorities", label: "Priorities" },
              { key: "plan", label: "Plan" },
              { key: "courses", label: "Courses" },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={view === option.key}
                onClick={() => setView(option.key)}
                className={`min-h-11 rounded-lg px-2 text-xs font-semibold ${view === option.key ? "bg-blue-600 text-white" : "text-slate-400"}`}
              >
                {option.label}
              </button>
            ))}
          </nav>

          {view === "priorities" ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div><h2 className="font-semibold text-slate-50">Capability priorities</h2><p className="text-xs text-slate-500">Ordered by operational risk</p></div>
                  <Sparkles className="h-4 w-4 text-blue-300" />
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {loading && priorityRows.length === 0
                    ? Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />)
                    : orderedPriorities.slice(0, 6).map((row) => (
                        <button key={row.id} type="button" onClick={() => setSelectedRecord({ kind: "priority", value: row })} className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${tone(row.priority)}`}>{row.priority}</span>{row.single_point_of_failure ? <span className="text-[10px] font-semibold text-amber-300">SPOF</span> : null}</div>
                              <h3 className="mt-2 font-semibold text-slate-100">{row.skill_name}</h3>
                              <p className="mt-1 text-xs text-slate-500">{row.dept_name ?? row.category}</p>
                            </div>
                            <div className="shrink-0 text-right"><p className="text-lg font-semibold text-orange-300">{row.gap}</p><p className="text-[10px] text-slate-600">gap</p></div>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3 text-xs text-slate-400"><span>{row.engineers_qualified} qualified · target L{row.target_rating}</span><ChevronRight className="h-4 w-4 text-slate-600" /></div>
                        </button>
                      ))}
                </div>
              </div>

              {orderedCertifications.length > 0 ? (
                <div>
                  <h2 className="font-semibold text-slate-50">Certification deadlines</h2>
                  <p className="text-xs text-slate-500">Renew before deployment is restricted</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {orderedCertifications.slice(0, 4).map((row, index) => (
                      <button key={`${row.engineer_name}-${row.skill_name}-${index}`} type="button" onClick={() => setSelectedRecord({ kind: "certification", value: row })} className="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-[#141820] p-4 text-left">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300"><CalendarClock className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-100">{row.skill_name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{row.engineer_name} · {formatDate(row.expiry_date)}</p></div>
                        <div className="shrink-0 text-right"><p className="text-sm font-semibold text-orange-300">{row.days_left}d</p><ChevronRight className="ml-auto mt-1 h-4 w-4 text-slate-600" /></div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {view === "plan" ? (
            <div>
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-50">Current training plan</h2><p className="text-xs text-slate-500">Recent and active bookings</p></div><Users className="h-4 w-4 text-blue-300" /></div>
              <div className="mt-3 flex flex-col gap-2">
                {orderedBookings.length === 0 && !loading ? <div className="rounded-xl border border-gray-800 bg-[#141820] p-5 text-sm text-slate-400">No training bookings are recorded.</div> : null}
                {orderedBookings.slice(0, 8).map((booking) => (
                  <button key={booking.id} type="button" onClick={() => setSelectedRecord({ kind: "booking", value: booking })} className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${tone(booking.status)}`}>{booking.status.replaceAll("_", " ")}</span><h3 className="mt-2 font-semibold text-slate-100">{booking.course_title}</h3><p className="mt-1 text-xs text-slate-500">{booking.engineer_name ?? "Engineer not assigned"} · {formatDate(booking.booking_date)}</p></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" /></div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {view === "courses" ? (
            <div>
              <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-50">Recommended courses</h2><p className="text-xs text-slate-500">Matched to current capability gaps</p></div><BookOpen className="h-4 w-4 text-blue-300" /></div>
              <div className="mt-3 flex flex-col gap-2">
                {courses.length === 0 && !loading ? <div className="rounded-xl border border-gray-800 bg-[#141820] p-5 text-sm text-slate-400">No matched courses are currently recorded.</div> : null}
                {courses.slice(0, 8).map((course) => (
                  <button key={course.id} type="button" onClick={() => setSelectedRecord({ kind: "course", value: course })} className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 text-blue-300"><GraduationCap className="h-4 w-4" /><span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{course.delivery_type}</span></div><h3 className="mt-2 font-semibold text-slate-100">{course.title}</h3><p className="mt-1 text-xs text-slate-500">{course.partner_name ?? "Provider not recorded"} · {course.duration_days} day{course.duration_days === 1 ? "" : "s"}</p></div><div className="shrink-0 text-right"><p className="font-semibold text-slate-100">{formatCurrency(course.price, course.currency)}</p><ChevronRight className="ml-auto mt-2 h-4 w-4 text-slate-600" /></div></div>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => navigate("/training-providers")} className="mt-3 inline-flex min-h-12 w-full items-center justify-between rounded-xl border border-blue-500/25 bg-blue-500/[0.07] px-4 text-sm font-semibold text-blue-200">Open provider catalogue <ChevronRight className="h-4 w-4" /></button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
