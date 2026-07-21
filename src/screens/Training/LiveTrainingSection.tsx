import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  RefreshCw,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import {
  RuntimeContractError,
  validateTrainingPayload,
} from "../../lib/runtimeContracts";
import { supabase } from "../../lib/supabaseClient";

type Booking = {
  id: string;
  engineer_name: string | null;
  department: string | null;
  course_title: string;
  partner_name: string | null;
  status: string;
  booking_date: string | null;
  cost: number | null;
  currency: string;
};

type PriorityRow = {
  id: string;
  skill_name: string;
  category: string;
  dept_name: string | null;
  current_avg: number;
  target_rating: number;
  gap: number;
  engineers_qualified: number;
  priority: string;
  recommendation: string;
  single_point_of_failure: boolean;
};

type CertificationRisk = {
  skill_name: string;
  engineer_name: string;
  expiry_date: string | null;
  days_left: number;
  status: string;
};

type Course = {
  id: string;
  title: string;
  partner_name: string | null;
  delivery_type: string;
  duration_days: number;
  price: number;
  currency: string;
  skills_covered: string[];
};

type TrainingPayload = {
  siteId: string;
  organisationId: string;
  generatedAt: string;
  recentActivity: Booking[];
  priorityRows: PriorityRow[];
  certRiskRows: CertificationRisk[];
  recommendedCourses: Course[];
  stats: {
    totalBookings: number;
    completed: number;
    activeBookings: number;
    totalSpendGBP: number;
    compliancePct: number;
    expiringIn30Days: number;
    expiringIn90Days: number;
    engineersNeedingTraining: number;
    criticalGaps: number;
  };
};

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Freshness unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatCurrency(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function priorityClass(priority: string): string {
  if (priority === "Critical") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (priority === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (priority === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-700 bg-slate-800/60 text-slate-300";
}

function statusClass(status: string): string {
  if (status === "completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (["approved", "booked"].includes(status)) return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (status === "pending_approval") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-slate-700 bg-slate-800/60 text-slate-300";
}

export function LiveTrainingSection(): JSX.Element {
  const { siteContext } = useAuth();
  const [payload, setPayload] = useState<TrainingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial = false): Promise<void> => {
    if (!siteContext?.siteId || !siteContext.organisationId) {
      setPayload(null);
      setError("An active maintenance site could not be resolved for this account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const { data, error: requestError } = await supabase.functions.invoke("training-data", {
        body: { schemaVersion: "training-evidence-v1" },
      });
      if (requestError || !data) {
        throw requestError ?? new Error("Training evidence was empty");
      }

      const validated = validateTrainingPayload(data) as unknown as TrainingPayload;
      if (
        validated.siteId !== siteContext.siteId ||
        validated.organisationId !== siteContext.organisationId
      ) {
        throw new RuntimeContractError(
          "Training",
          "response scope did not match the authenticated site",
        );
      }
      setPayload(validated);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Verified training evidence is unavailable.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteContext?.organisationId, siteContext?.siteId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const priorities = useMemo(() => payload?.priorityRows.slice(0, 8) ?? [], [payload]);
  const bookings = useMemo(() => payload?.recentActivity.slice(0, 8) ?? [], [payload]);
  const certRisks = useMemo(() => payload?.certRiskRows.slice(0, 6) ?? [], [payload]);
  const courses = useMemo(() => payload?.recommendedCourses.slice(0, 6) ?? [], [payload]);

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Read-only live pilot</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Training Evidence</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Verified bookings, competency gaps, certification exposure and course evidence. Vorta does not approve, complete or create bookings in live mode.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(false)}
          disabled={loading || refreshing}
          aria-label="Refresh verified training evidence"
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading training evidence">
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
              <p className="text-sm font-semibold text-red-100">Training evidence was withheld</p>
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
            <span>Active site: {payload.siteId}</span>
            <span>Generated: {formatGeneratedAt(payload.generatedAt)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Active bookings", payload.stats.activeBookings, GraduationCap, "text-blue-300"],
              ["Critical gaps", payload.stats.criticalGaps, AlertTriangle, payload.stats.criticalGaps ? "text-red-300" : "text-emerald-300"],
              ["Expiring in 30 days", payload.stats.expiringIn30Days, Shield, payload.stats.expiringIn30Days ? "text-orange-300" : "text-emerald-300"],
              ["Training spend", formatCurrency(payload.stats.totalSpendGBP), TrendingUp, "text-slate-100"],
            ].map(([label, value, Icon, valueClass]) => {
              const MetricIcon = Icon as typeof GraduationCap;
              return (
                <Card key={String(label)} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-400">{String(label)}</p>
                      <MetricIcon className="h-4 w-4 text-slate-600" aria-hidden="true" />
                    </div>
                    <p className={`mt-3 text-2xl font-semibold tabular-nums ${String(valueClass)}`}>{String(value)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-0">
                <div className="border-b border-gray-800 p-5">
                  <h2 className="font-semibold text-slate-50">Priority capability gaps</h2>
                  <p className="mt-1 text-xs text-slate-500">Evidence only. Actions are managed in the source workflow.</p>
                </div>
                <div className="divide-y divide-gray-800/80">
                  {priorities.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">No priority training gaps are recorded.</p>
                  ) : priorities.map((row) => (
                    <div key={row.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">{row.skill_name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{row.dept_name ?? row.category}</p>
                        </div>
                        <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] shadow-none ${priorityClass(row.priority)}`}>
                          {row.priority}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                        <div><p className="text-slate-600">Current</p><p className="mt-0.5 font-semibold text-slate-300">{row.current_avg.toFixed(1)}/5</p></div>
                        <div><p className="text-slate-600">Target</p><p className="mt-0.5 font-semibold text-slate-300">{row.target_rating}/5</p></div>
                        <div><p className="text-slate-600">Below target</p><p className="mt-0.5 font-semibold text-orange-300">{row.gap}</p></div>
                      </div>
                      {row.recommendation ? <p className="mt-3 text-xs leading-5 text-slate-400">{row.recommendation}</p> : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-0">
                <div className="border-b border-gray-800 p-5">
                  <h2 className="font-semibold text-slate-50">Recent booking evidence</h2>
                  <p className="mt-1 text-xs text-slate-500">Statuses are read from the verified training register.</p>
                </div>
                <div className="divide-y divide-gray-800/80">
                  {bookings.length === 0 ? (
                    <p className="p-5 text-sm text-slate-500">No site-attributable bookings are recorded.</p>
                  ) : bookings.map((booking) => (
                    <div key={booking.id} className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{booking.course_title}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {booking.engineer_name ?? "Engineer not recorded"} · {booking.department ?? "Department not recorded"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{formatDate(booking.booking_date)}{booking.partner_name ? ` · ${booking.partner_name}` : ""}</p>
                      </div>
                      <Badge className={`h-auto shrink-0 rounded border px-2 py-0.5 text-[10px] shadow-none ${statusClass(booking.status)}`}>
                        {booking.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-orange-300" aria-hidden="true" />
                  <h2 className="font-semibold text-slate-50">Certification exposure</h2>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {certRisks.length === 0 ? (
                    <p className="text-sm text-slate-500">No certifications expiring within 90 days are recorded.</p>
                  ) : certRisks.map((row) => (
                    <div key={`${row.engineer_name}:${row.skill_name}`} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-200">{row.skill_name}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{row.engineer_name}</p>
                        </div>
                        <span className={row.days_left < 0 ? "text-xs font-semibold text-red-300" : "text-xs font-semibold text-orange-300"}>
                          {row.days_left < 0 ? `${Math.abs(row.days_left)}d overdue` : `${row.days_left}d left`}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">Expiry: {formatDate(row.expiry_date)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-300" aria-hidden="true" />
                  <h2 className="font-semibold text-slate-50">Recorded course catalogue</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">Organisation-approved courses relevant to recorded capability gaps.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {courses.length === 0 ? (
                    <p className="text-sm text-slate-500">No active courses are recorded.</p>
                  ) : courses.map((course) => (
                    <div key={course.id} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                      <p className="text-sm font-medium text-slate-200">{course.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{course.partner_name ?? "Provider not recorded"}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-500">{course.delivery_type} · {course.duration_days}d</span>
                        <span className="font-semibold text-slate-300">{formatCurrency(course.price, course.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}
