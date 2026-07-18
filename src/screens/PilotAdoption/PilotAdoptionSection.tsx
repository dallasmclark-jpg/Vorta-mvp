import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  RefreshCw,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { trackPilotUsageEvent } from "../../lib/pilotUsage";
import { supabase } from "../../lib/supabaseClient";

interface AdoptionReport {
  status: string;
  score: number;
  interpretation: string;
  period: {
    startDate: string;
    endDate: string;
    periodDays: number;
    firstEventAt: string | null;
    latestEventAt: string | null;
  };
  summary: {
    totalEvents: number;
    activeUsers: number;
    sessions: number;
    activeDays: number;
    meaningfulActions: number;
  };
  workflow: {
    riskReviews: number;
    dashboardReviews: number;
    pilotImpactReviews: number;
    equipmentViews: number;
    uniqueEquipmentViewed: number;
    workOrderViews: number;
    askVortaQueries: number;
    recommendationsOpened: number;
    capabilityReviews: number;
    reportRangeApplications: number;
    reportDownloads: number;
  };
  funnel: {
    activeUsers: number;
    riskReviewUsers: number;
    equipmentReviewUsers: number;
    askVortaUsers: number;
    followThroughUsers: number;
  };
  scoreComponents: {
    activityCoverage: number;
    workflowDepth: number;
    featureBreadth: number;
    repeatUse: number;
  };
  dailyTrend: Array<{
    date: string;
    events: number;
    sessions: number;
    riskReviews: number;
    equipmentViews: number;
    askVortaQueries: number;
    meaningfulActions: number;
  }>;
  eventBreakdown: Array<{
    eventType: string;
    count: number;
    users: number;
  }>;
  topEquipment: Array<{
    equipmentId: string;
    equipmentCode: string;
    equipmentName: string;
    views: number;
    users: number;
  }>;
  limitations: string[];
}

type RangePreset = "PILOT_TO_DATE" | "LAST_30_DAYS" | "CUSTOM";

interface ReportRange {
  preset: RangePreset;
  startDate: string | null;
  endDate: string;
}

const RANGE_LABELS: Record<RangePreset, string> = {
  PILOT_TO_DATE: "Pilot to date",
  LAST_30_DAYS: "Last 30 days",
  CUSTOM: "Custom range",
};

const STATUS_PRESENTATION: Record<
  string,
  { label: string; detail: string; classes: string }
> = {
  NO_USAGE: {
    label: "No usage captured",
    detail: "Tracking is active, but no deliberate Maintenance Manager workflow event has been recorded in this period.",
    classes: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  },
  BASELINE_USAGE: {
    label: "Baseline usage",
    detail: "Initial workflow activity is captured, but fewer than three active days exist.",
    classes: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  EARLY_ADOPTION: {
    label: "Early adoption",
    detail: "The manager is returning to Vorta and beginning to use multiple maintenance workflows.",
    classes: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  },
  ESTABLISHED_USE: {
    label: "Established use",
    detail: "Repeated, multi-workflow use is visible across the selected period.",
    classes: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  },
  SUSTAINED_ADOPTION: {
    label: "Sustained adoption",
    detail: "Use is repeated, broad and connected to follow-through actions.",
    classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
};

function localDateIso(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function subtractDaysIso(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - days);
  return localDateIso(date);
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

function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits,
  });
}

function eventLabel(eventType: string): string {
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function scoreClass(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score > 0) return "text-amber-400";
  return "text-slate-400";
}

function ProgressBar({ value }: { value: number }): JSX.Element {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-slate-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
    >
      <div
        className="h-full rounded-full bg-blue-500 transition-[width] duration-500"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  detail: string;
}): JSX.Element {
  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Icon className="h-4 w-4 text-blue-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-50">{formatNumber(value, 0)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState(): JSX.Element {
  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
      <div className="h-24 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="h-24 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="grid gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
    </section>
  );
}

export const PilotAdoptionSection = (): JSX.Element => {
  const { siteContext } = useAuth();
  const today = useMemo(() => localDateIso(), []);
  const [report, setReport] = useState<AdoptionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<RangePreset>("PILOT_TO_DATE");
  const [appliedPreset, setAppliedPreset] = useState<RangePreset>("PILOT_TO_DATE");
  const [customStart, setCustomStart] = useState(subtractDaysIso(today, 29));
  const [customEnd, setCustomEnd] = useState(today);

  const loadReport = useCallback(async (range: ReportRange, initial = false): Promise<void> => {
    const siteId = siteContext?.siteId;
    if (!siteId) {
      setReport(null);
      setError("A maintenance site could not be resolved for this account.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      "vorta_get_pilot_adoption_report",
      {
        p_site_id: siteId,
        p_start_date: range.startDate,
        p_end_date: range.endDate,
      },
    );

    if (rpcError || !data) {
      console.warn("Pilot adoption report could not be loaded:", rpcError?.message);
      if (initial) setReport(null);
      setError(rpcError?.message ?? "Pilot adoption evidence is not available for this site and date range.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const nextReport = data as AdoptionReport;
    setReport(nextReport);
    setAppliedPreset(range.preset);
    setLoading(false);
    setRefreshing(false);

    if (!initial) {
      void trackPilotUsageEvent({
        siteId,
        eventType: "pilot_report_range_applied",
        pathname: "/pilot-adoption",
        entityType: "report",
        entityId: "pilot-adoption",
        metadata: {
          preset: range.preset,
          periodDays: nextReport.period.periodDays,
          surface: "adoption",
        },
      });
    }
  }, [siteContext?.siteId]);

  useEffect(() => {
    void loadReport(
      { preset: "PILOT_TO_DATE", startDate: null, endDate: today },
      true,
    );
  }, [loadReport, today]);

  const applyRange = (): void => {
    setRangeError(null);

    if (selectedPreset === "PILOT_TO_DATE") {
      void loadReport({ preset: selectedPreset, startDate: null, endDate: today });
      return;
    }

    if (selectedPreset === "LAST_30_DAYS") {
      void loadReport({
        preset: selectedPreset,
        startDate: subtractDaysIso(today, 29),
        endDate: today,
      });
      return;
    }

    if (!customStart || !customEnd) {
      setRangeError("Choose both a start and end date.");
      return;
    }
    if (customStart > customEnd) {
      setRangeError("The start date must be on or before the end date.");
      return;
    }
    if (customEnd > today) {
      setRangeError("The report end date cannot be in the future.");
      return;
    }

    void loadReport({
      preset: selectedPreset,
      startDate: customStart,
      endDate: customEnd,
    });
  };

  if (loading) return <LoadingState />;

  if (!report) {
    return (
      <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
        <header className="py-5">
          <p className="text-xs font-medium text-slate-400">Pilot evidence</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">Pilot Adoption</h1>
        </header>
        <Card className="rounded-xl border border-red-500/20 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100">Adoption evidence could not be loaded</p>
              <p className="mt-1 text-sm text-slate-400">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadReport({ preset: "PILOT_TO_DATE", startDate: null, endDate: today }, true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-50 hover:bg-white/15"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const presentation = STATUS_PRESENTATION[report.status] ?? STATUS_PRESENTATION.NO_USAGE;
  const maxDailyEvents = Math.max(1, ...report.dailyTrend.map((day) => day.events));
  const scoreComponents = [
    ["Activity coverage", report.scoreComponents.activityCoverage],
    ["Workflow depth", report.scoreComponents.workflowDepth],
    ["Feature breadth", report.scoreComponents.featureBreadth],
    ["Repeat use", report.scoreComponents.repeatUse],
  ] as const;
  const funnel = [
    ["Active users", report.funnel.activeUsers],
    ["Risk reviewers", report.funnel.riskReviewUsers],
    ["Equipment reviewers", report.funnel.equipmentReviewUsers],
    ["Ask Vorta users", report.funnel.askVortaUsers],
    ["Follow-through users", report.funnel.followThroughUsers],
  ] as const;

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">
      <header className="flex w-full flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">Pilot evidence</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Pilot Adoption</h1>
            <Badge className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${presentation.classes}`}>
              {presentation.label}
            </Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Evidence that Maintenance Managers are reviewing risk, opening equipment, using Ask Vorta and following recommendations.
          </p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${scoreClass(report.score)}`}>{formatNumber(report.score)}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Adoption score</p>
        </div>
      </header>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-100">Adoption period</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {RANGE_LABELS[appliedPreset]} · {formatDate(report.period.startDate)} to {formatDate(report.period.endDate)}
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Pilot adoption date range">
                {(Object.keys(RANGE_LABELS) as RangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      selectedPreset === preset
                        ? "border-blue-500/40 bg-blue-500/15 text-blue-200"
                        : "border-gray-800 bg-[#10141b] text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                    aria-pressed={selectedPreset === preset}
                  >
                    {RANGE_LABELS[preset]}
                  </button>
                ))}
              </div>
              {selectedPreset === "CUSTOM" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="grid gap-1 text-[11px] font-medium text-slate-400">
                    Start
                    <input
                      type="date"
                      value={customStart}
                      max={today}
                      onChange={(event) => setCustomStart(event.target.value)}
                      className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60"
                    />
                  </label>
                  <label className="grid gap-1 text-[11px] font-medium text-slate-400">
                    End
                    <input
                      type="date"
                      value={customEnd}
                      max={today}
                      onChange={(event) => setCustomEnd(event.target.value)}
                      className="h-9 rounded-lg border border-gray-800 bg-[#10141b] px-3 text-xs text-slate-200 outline-none focus:border-blue-500/60"
                    />
                  </label>
                </div>
              ) : null}
              <button
                type="button"
                onClick={applyRange}
                disabled={refreshing}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-xs font-semibold text-slate-50 hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                {refreshing ? "Updating…" : "Apply range"}
              </button>
            </div>
          </div>
          {rangeError ? <p role="alert" className="mt-3 text-xs text-red-300">{rangeError}</p> : null}
          {error ? <p role="status" className="mt-3 text-xs text-amber-300">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <BarChart3 className="h-5 w-5 text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">{presentation.label}</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{presentation.detail}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{report.interpretation}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={CalendarDays} label="Active days" value={report.summary.activeDays} detail={`${report.period.periodDays} days selected`} />
        <SummaryCard icon={UsersRound} label="Sessions" value={report.summary.sessions} detail={`${report.summary.activeUsers} active manager${report.summary.activeUsers === 1 ? "" : "s"}`} />
        <SummaryCard icon={Sparkles} label="Ask Vorta queries" value={report.workflow.askVortaQueries} detail="Prompt text is never stored" />
        <SummaryCard icon={CheckCircle2} label="Follow-through actions" value={report.summary.meaningfulActions} detail="Work orders, recommendations and reports" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">Daily engagement</h2>
            </div>
            <div className="flex min-h-[190px] items-end gap-2 overflow-x-auto pb-2">
              {report.dailyTrend.map((day) => (
                <div key={day.date} className="flex min-w-[34px] flex-1 flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end rounded-md bg-[#10141b] p-1">
                    <div
                      className="w-full rounded-sm bg-blue-500/70"
                      style={{ height: `${Math.max(day.events > 0 ? 8 : 0, day.events * 100 / maxDailyEvents)}%` }}
                      title={`${day.events} events · ${day.meaningfulActions} follow-through actions`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500">
                    {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(`${day.date}T00:00:00`))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-100">Adoption score</h2>
              </div>
              <p className={`text-2xl font-bold ${scoreClass(report.score)}`}>{formatNumber(report.score)}</p>
            </div>
            <div className="space-y-4">
              {scoreComponents.map(([label, value]) => (
                <div key={label}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-semibold text-slate-200">{formatNumber(value)}</span>
                  </div>
                  <ProgressBar value={value} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">Engagement funnel</h2>
            </div>
            <div className="space-y-3">
              {funnel.map(([label, value], index) => (
                <div key={label} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#10141b] px-3 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-bold text-blue-300">{index + 1}</div>
                  <span className="flex-1 text-xs text-slate-400">{label}</span>
                  <span className="text-sm font-bold text-slate-100">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">Workflow engagement</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Risk reviews", report.workflow.riskReviews],
                ["Equipment views", report.workflow.equipmentViews],
                ["Unique equipment", report.workflow.uniqueEquipmentViewed],
                ["Work orders opened", report.workflow.workOrderViews],
                ["Recommendations opened", report.workflow.recommendationsOpened],
                ["Capability reviews", report.workflow.capabilityReviews],
                ["Range applications", report.workflow.reportRangeApplications],
                ["Reports downloaded", report.workflow.reportDownloads],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-gray-800 bg-[#10141b] p-3">
                  <p className="text-xl font-bold text-slate-50">{value}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">Most reviewed equipment</h2>
            </div>
            {report.topEquipment.length > 0 ? (
              <div className="space-y-3">
                {report.topEquipment.map((equipment) => (
                  <div key={equipment.equipmentId} className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{equipment.equipmentName}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{equipment.equipmentCode}</p>
                      </div>
                      <Badge className="h-auto rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300 shadow-none">
                        {equipment.views} views
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-slate-500">Equipment reviews will appear after managers open asset records during the pilot.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-100">Event evidence</h2>
            </div>
            {report.eventBreakdown.length > 0 ? (
              <div className="space-y-3">
                {report.eventBreakdown.map((event) => (
                  <div key={event.eventType} className="flex items-center justify-between gap-4 border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-xs font-medium text-slate-300">{eventLabel(event.eventType)}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{event.users} user{event.users === 1 ? "" : "s"}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-100">{event.count}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5 text-slate-500">No allow-listed usage events exist in the selected period.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
        <CardContent className="p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-100">Interpretation and limitations</h2>
          </div>
          <div className="space-y-3">
            {report.limitations.map((limitation) => (
              <div key={limitation} className="rounded-lg border border-gray-800 bg-[#10141b] px-3 py-3 text-xs leading-5 text-slate-400">
                {limitation}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};
