import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  Gauge,
  Minus,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabaseClient";

interface RiskMetric {
  baseline: number | null;
  latest: number | null;
  observedDifference: number | null;
  claimableReduction?: number | null;
}

interface PilotValueReport {
  reportVersion: string;
  siteId: string;
  site?: {
    id: string;
    name: string;
    region: string | null;
    timezone: string;
  };
  generatedAt: string;
  status: string;
  interpretation: string;
  period: {
    requestedStartDate: string;
    requestedEndDate: string;
    baselineDate: string | null;
    latestSnapshotDate: string | null;
    snapshotCount: number;
    observedDays: number;
  };
  risk: {
    claimEligible: boolean;
    siteRisk: RiskMetric;
    operationalRisk: RiskMetric;
    labourRisk: RiskMetric;
  };
  capability: {
    claimEligible: boolean;
    actions: {
      baseline: number;
      latest: number;
      reducedBy: number | null;
      closed: number;
      improved: number;
      worsened: number;
      new: number;
    };
    highAndCriticalActions: {
      baseline: number;
      latest: number;
      reducedBy: number | null;
    };
    backupSmeGaps: {
      baseline: number;
      latest: number;
      reducedBy: number | null;
    };
    amShiftGaps: {
      baseline: number;
      latest: number;
      reducedBy: number | null;
    };
    skillCoverageGaps: {
      baseline: number;
      latest: number;
      reducedBy: number | null;
    };
    topValueChanges: Array<Record<string, unknown>>;
  };
  trainingAndValidation: {
    periodActivity: {
      engineerSkillValidations: number;
      engineersValidated: number;
      equipmentCapabilityValidations: number;
      operatorAmValidations: number;
      operatorsValidated: number;
    };
    currentState: {
      validatedEngineerSkillRecords: number;
      activeValidatedEquipmentCapabilities: number;
      validatedPrimarySmes: number;
      validatedBackupSmes: number;
      validatedAmAssignments: number;
      amAssignmentsInTraining: number;
    };
  };
  maintenanceData: {
    currentDataset: MaintenanceEvidence;
    periodActivity: MaintenanceEvidence;
  };
  knowledgeCoverage: {
    status: string;
    equipmentAssets: number;
    equipmentWithCurrentDocuments: number;
    equipmentDocumentCoveragePct: number | null;
    highRiskEquipment: number;
    highRiskEquipmentWithDocuments: number;
    highRiskDocumentCoveragePct: number | null;
    currentDocuments: number;
    fullyUsableDocuments: number;
    documentUsabilityPct: number | null;
    hardFailureCount: number;
    warningCount: number;
  };
  backendReliability: {
    currentSuiteVersion: string | null;
    currentSuiteRunsInPeriod: number;
    passedRunsInPeriod: number;
    healthSuitePassRatePct: number | null;
    latestStatus: string | null;
    latestFinishedAt: string | null;
    latestPassedChecks: number;
    latestFailedChecks: number;
    latestWarnings: number;
    openSystemHealthIncidents: number;
    criticalIncidents: number;
    highIncidents: number;
  };
  confidence: {
    score: number;
    status: string;
    completenessScore: number;
    trendMaturityScore: number;
    components: {
      maintenanceData: number;
      knowledgeCoverage: number;
      capabilitySnapshotIntegrity: number;
      backendReliability: number;
    };
    limitations: string[];
  };
}

interface MaintenanceEvidence {
  completedOrders: number;
  ordersWithConfirmationText: number;
  confirmationCompletenessPct: number | null;
  completedOrdersWithMaterialReservations: number;
  materialOrdersWithGoodsMovement: number;
  goodsMovementCompletenessPct: number | null;
}

type ReportRangePreset = "PILOT_TO_DATE" | "LAST_30_DAYS" | "CUSTOM";

interface ReportRange {
  preset: ReportRangePreset;
  startDate: string | null;
  endDate: string;
}

const STATUS_PRESENTATION: Record<
  string,
  { label: string; detail: string; classes: string }
> = {
  NO_BASELINE: {
    label: "No baseline",
    detail: "The first daily capability snapshot has not been captured yet.",
    classes: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  },
  BASELINE_ONLY: {
    label: "Baseline captured",
    detail: "Daily evidence collection is active. A second distinct snapshot is required before movement can be claimed.",
    classes: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  EARLY_SIGNAL: {
    label: "Early signal",
    detail: "Initial movement is visible, but fewer than seven daily snapshots are available.",
    classes: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  },
  MEASURED_TREND: {
    label: "Measured trend",
    detail: "The pilot has enough daily evidence to show a developing trend.",
    classes: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  },
  PILOT_EVIDENCE_READY: {
    label: "Pilot evidence ready",
    detail: "The report has sufficient daily history for a formal pilot review.",
    classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
};

const RANGE_LABELS: Record<ReportRangePreset, string> = {
  PILOT_TO_DATE: "Pilot to date",
  LAST_30_DAYS: "Last 30 days",
  CUSTOM: "Custom range",
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

function formatTimestamp(value: string | null, timeZone?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${formatNumber(value)}%`;
}

function scoreClasses(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function reportRangeText(report: PilotValueReport, preset: ReportRangePreset): string {
  return `${RANGE_LABELS[preset]} · ${formatDate(report.period.requestedStartDate)} to ${formatDate(report.period.requestedEndDate)}`;
}

function safeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "site";
}

function ProgressBar({ value }: { value: number }): JSX.Element {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-slate-800 pilot-report-progress"
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

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}): JSX.Element {
  return (
    <Card className="pilot-report-card rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="pilot-report-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Icon className="h-4 w-4 text-blue-400" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-50">{value}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-400">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskCard({
  label,
  metric,
  claimEligible,
}: {
  label: string;
  metric: RiskMetric;
  claimEligible: boolean;
}): JSX.Element {
  const reduction = metric.baseline !== null && metric.latest !== null
    ? metric.baseline - metric.latest
    : null;
  const improved = claimEligible && reduction !== null && reduction > 0;
  const worsened = claimEligible && reduction !== null && reduction < 0;
  const MovementIcon = improved ? TrendingDown : worsened ? TrendingUp : Minus;

  return (
    <Card className="pilot-report-card rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-300">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-50">
              {formatNumber(metric.latest)}
            </p>
          </div>
          <div
            className={`pilot-report-icon flex h-9 w-9 items-center justify-center rounded-lg ${
              improved
                ? "bg-emerald-500/10 text-emerald-400"
                : worsened
                  ? "bg-red-500/10 text-red-400"
                  : "bg-amber-500/10 text-amber-400"
            }`}
          >
            <MovementIcon className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-gray-800 pt-3 text-xs">
          <span className="text-slate-500">Baseline {formatNumber(metric.baseline)}</span>
          <span
            className={
              improved
                ? "font-semibold text-emerald-400"
                : worsened
                  ? "font-semibold text-red-400"
                  : "font-medium text-amber-300"
            }
          >
            {!claimEligible
              ? "Awaiting comparison"
              : reduction === null
                ? "No comparison"
                : reduction === 0
                  ? "No movement"
                  : `${reduction > 0 ? "−" : "+"}${formatNumber(Math.abs(reduction))}`}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function DataQualityRow({
  label,
  value,
  numerator,
  denominator,
}: {
  label: string;
  value: number | null;
  numerator: number;
  denominator: number;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {numerator} of {denominator} eligible records
          </p>
        </div>
        <p className="text-lg font-bold text-slate-50">{formatPercent(value)}</p>
      </div>
      <ProgressBar value={value ?? 0} />
    </div>
  );
}

function LoadingState(): JSX.Element {
  return (
    <section
      className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8"
      aria-label="Loading pilot impact"
    >
      <div className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="h-24 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-40 animate-pulse rounded-xl border border-gray-800 bg-[#141820]"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
    </section>
  );
}

export const PilotImpactSection = (): JSX.Element => {
  const { siteContext } = useAuth();
  const today = useMemo(() => localDateIso(), []);
  const [report, setReport] = useState<PilotValueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ReportRangePreset>("PILOT_TO_DATE");
  const [appliedPreset, setAppliedPreset] = useState<ReportRangePreset>("PILOT_TO_DATE");
  const [customStart, setCustomStart] = useState(subtractDaysIso(today, 29));
  const [customEnd, setCustomEnd] = useState(today);

  const loadReport = useCallback(async (range: ReportRange, initial = false): Promise<void> => {
    if (!siteContext?.siteId) {
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
      "vorta_get_pilot_value_report",
      {
        p_site_id: siteContext.siteId,
        p_start_date: range.startDate,
        p_end_date: range.endDate,
      },
    );

    if (rpcError || !data) {
      console.warn("Pilot impact report could not be loaded:", rpcError?.message);
      if (initial) setReport(null);
      setError(
        rpcError?.message ??
          "The pilot impact report is not available for this site and date range.",
      );
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setReport(data as PilotValueReport);
    setAppliedPreset(range.preset);
    setLoading(false);
    setRefreshing(false);
  }, [siteContext?.siteId]);

  useEffect(() => {
    void loadReport(
      {
        preset: "PILOT_TO_DATE",
        startDate: null,
        endDate: today,
      },
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

  const downloadPilotReport = (): void => {
    if (!report) return;

    const originalTitle = document.title;
    const siteName = report.site?.name ?? "Active maintenance site";
    document.title = [
      "Vorta-Pilot-Report",
      safeFilenamePart(siteName),
      report.period.requestedStartDate,
      "to",
      report.period.requestedEndDate,
    ].join("-");

    let restored = false;
    const restoreTitle = (): void => {
      if (restored) return;
      restored = true;
      document.title = originalTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.requestAnimationFrame(() => window.print());
    window.setTimeout(restoreTitle, 10_000);
  };

  if (loading) return <LoadingState />;

  if (!report) {
    return (
      <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
        <header className="py-5">
          <p className="text-xs font-medium text-slate-400">Pilot evidence</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">
            Pilot Impact
          </h1>
        </header>
        <Card className="rounded-xl border border-red-500/20 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  Pilot evidence could not be loaded
                </p>
                <p className="mt-1 text-sm text-slate-400">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadReport({ preset: "PILOT_TO_DATE", startDate: null, endDate: today })}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-50 transition-colors hover:bg-white/15"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const statusPresentation =
    STATUS_PRESENTATION[report.status] ?? STATUS_PRESENTATION.NO_BASELINE;
  const maintenance = report.maintenanceData.periodActivity;
  const knowledge = report.knowledgeCoverage;
  const siteName = report.site?.name ?? "Active maintenance site";
  const siteRegion = report.site?.region ?? "Site region unavailable";
  const siteTimezone = report.site?.timezone ?? "Europe/London";
  const aiKnowledgeReady =
    knowledge.hardFailureCount === 0 &&
    knowledge.warningCount === 0 &&
    report.backendReliability.latestFailedChecks === 0;
  const confidenceComponents = [
    { label: "Maintenance data", value: report.confidence.components.maintenanceData },
    { label: "Knowledge coverage", value: report.confidence.components.knowledgeCoverage },
    {
      label: "Capability snapshot integrity",
      value: report.confidence.components.capabilitySnapshotIntegrity,
    },
    { label: "Backend reliability", value: report.confidence.components.backendReliability },
  ];

  return (
    <>
      <style>{`
        .pilot-print-only { display: none; }

        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: #ffffff !important; }
          body * { visibility: hidden !important; }
          [data-pilot-impact-report="true"],
          [data-pilot-impact-report="true"] * { visibility: visible !important; }
          [data-pilot-impact-report="true"] {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 14px !important;
            overflow: visible !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          [data-pilot-impact-no-print="true"] { display: none !important; }
          .pilot-print-only { display: block !important; }
          .pilot-report-section,
          .pilot-report-card { break-inside: avoid-page; }
          .pilot-report-card {
            background: #ffffff !important;
            border-color: #cbd5e1 !important;
            box-shadow: none !important;
          }
          .pilot-report-surface {
            background: #f8fafc !important;
            border-color: #e2e8f0 !important;
          }
          .pilot-report-icon { background: #eff6ff !important; }
          .pilot-report-progress { background: #e2e8f0 !important; }
          [data-pilot-impact-report="true"] .text-slate-50,
          [data-pilot-impact-report="true"] .text-slate-100,
          [data-pilot-impact-report="true"] .text-slate-200,
          [data-pilot-impact-report="true"] .text-slate-300 {
            color: #0f172a !important;
          }
          [data-pilot-impact-report="true"] .text-slate-400,
          [data-pilot-impact-report="true"] .text-slate-500 {
            color: #475569 !important;
          }
          [data-pilot-impact-report="true"] .border-gray-800 {
            border-color: #cbd5e1 !important;
          }
          [data-pilot-impact-report="true"] h1 { font-size: 22pt !important; }
          [data-pilot-impact-report="true"] h2 { font-size: 11pt !important; }
        }
      `}</style>

      <section
        data-pilot-impact-report="true"
        className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8"
        aria-busy={refreshing}
      >
        <div className="pilot-print-only border-b border-slate-300 pb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">
            Vorta Network
          </p>
          <div className="mt-2 flex items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">Pilot Impact Report</h1>
              <p className="mt-1 text-sm text-slate-600">
                {siteName} · {siteRegion}
              </p>
            </div>
            <div className="text-right text-xs text-slate-600">
              <p>{reportRangeText(report, appliedPreset)}</p>
              <p>Generated {formatTimestamp(report.generatedAt, siteTimezone)}</p>
            </div>
          </div>
        </div>

        <header
          data-pilot-impact-no-print="true"
          className="flex w-full flex-col gap-4 py-5 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <p className="text-xs font-medium text-slate-400">Pilot evidence</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">
                Pilot Impact
              </h1>
              <Badge
                className={`h-auto rounded border px-2 py-0.5 text-[10px] font-bold shadow-none ${statusPresentation.classes}`}
              >
                {statusPresentation.label}
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Evidence of risk, capability and maintenance-data movement for {siteName}.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadPilotReport}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f14]"
            aria-label="Download or print pilot report"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Pilot Report
          </button>
        </header>

        <Card
          data-pilot-impact-no-print="true"
          className="rounded-xl border border-gray-800 bg-[#141820] shadow-none"
        >
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-slate-100">Report period</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {reportRangeText(report, appliedPreset)}
                </p>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Pilot report date range">
                  {(Object.keys(RANGE_LABELS) as ReportRangePreset[]).map((preset) => (
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
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-xs font-semibold text-slate-50 transition-colors hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  {refreshing ? "Updating…" : "Apply range"}
                </button>
              </div>
            </div>
            {rangeError ? (
              <p role="alert" className="mt-3 text-xs text-red-300">{rangeError}</p>
            ) : null}
            {error ? (
              <p role="status" className="mt-3 text-xs text-amber-300">{error}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="pilot-report-card pilot-report-section overflow-hidden rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="p-5 md:p-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
              <div>
                <div className="flex items-start gap-3">
                  <div className="pilot-report-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                    <BarChart3 className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {statusPresentation.label}
                    </p>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                      {statusPresentation.detail}
                    </p>
                  </div>
                </div>
                {!report.risk.claimEligible ? (
                  <div className="pilot-report-surface mt-4 flex items-start gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-200/80">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    Risk reductions and closed-gap claims remain deliberately suppressed until two distinct daily snapshots exist.
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-3 xl:min-w-[390px]">
                <div className="pilot-report-surface rounded-lg border border-gray-800 bg-[#10141b] px-3 py-3 text-center">
                  <p className="text-xl font-bold text-slate-50">{report.period.snapshotCount}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">Snapshots</p>
                </div>
                <div className="pilot-report-surface rounded-lg border border-gray-800 bg-[#10141b] px-3 py-3 text-center">
                  <p className="text-xl font-bold text-slate-50">{report.period.observedDays}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">Observed days</p>
                </div>
                <div className="pilot-report-surface rounded-lg border border-gray-800 bg-[#10141b] px-3 py-3 text-center">
                  <p className={`text-xl font-bold ${scoreClasses(report.confidence.score)}`}>
                    {formatNumber(report.confidence.score)}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">Confidence</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pilot-report-section">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-100">Risk movement</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <RiskCard label="Site risk" metric={report.risk.siteRisk} claimEligible={report.risk.claimEligible} />
            <RiskCard label="Operational risk" metric={report.risk.operationalRisk} claimEligible={report.risk.claimEligible} />
            <RiskCard label="Labour risk" metric={report.risk.labourRisk} claimEligible={report.risk.claimEligible} />
          </div>
        </div>

        <div className="pilot-report-section">
          <div className="mb-3 flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-100">Capability improvement</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={ClipboardCheck}
              label="Capability actions"
              value={formatNumber(report.capability.actions.latest, 0)}
              detail={`${report.capability.actions.closed} closed · ${report.capability.actions.improved} improved`}
            />
            <MetricCard
              icon={AlertTriangle}
              label="High-priority actions"
              value={formatNumber(report.capability.highAndCriticalActions.latest, 0)}
              detail={`Baseline ${report.capability.highAndCriticalActions.baseline}`}
            />
            <MetricCard
              icon={ShieldCheck}
              label="Backup SME gaps"
              value={formatNumber(report.capability.backupSmeGaps.latest, 0)}
              detail={`${report.trainingAndValidation.currentState.validatedBackupSmes} validated backup SMEs`}
            />
            <MetricCard
              icon={UsersRound}
              label="AM shift gaps"
              value={formatNumber(report.capability.amShiftGaps.latest, 0)}
              detail={`${report.trainingAndValidation.currentState.validatedAmAssignments} validated AM assignments`}
            />
          </div>
        </div>

        <div className="pilot-report-section grid gap-4 xl:grid-cols-2">
          <Card className="pilot-report-card rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-blue-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-slate-100">Maintenance data quality</h2>
                </div>
                <Badge className="h-auto rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300 shadow-none">
                  Selected period
                </Badge>
              </div>
              <div className="space-y-6">
                <DataQualityRow
                  label="Completed orders with confirmation text"
                  value={maintenance.confirmationCompletenessPct}
                  numerator={maintenance.ordersWithConfirmationText}
                  denominator={maintenance.completedOrders}
                />
                <DataQualityRow
                  label="Material-linked orders with goods movement"
                  value={maintenance.goodsMovementCompletenessPct}
                  numerator={maintenance.materialOrdersWithGoodsMovement}
                  denominator={maintenance.completedOrdersWithMaterialReservations}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="pilot-report-card rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BookOpenCheck className="h-4 w-4 text-blue-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-slate-100">Knowledge and AI readiness</h2>
                </div>
                <Badge className="h-auto rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300 shadow-none">
                  {knowledge.status}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="pilot-report-surface rounded-lg border border-gray-800 bg-[#10141b] p-4">
                  <p className="text-2xl font-bold text-slate-50">{formatPercent(knowledge.documentUsabilityPct)}</p>
                  <p className="mt-1 text-xs text-slate-400">Document usability</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {knowledge.fullyUsableDocuments} of {knowledge.currentDocuments} documents
                  </p>
                </div>
                <div className="pilot-report-surface rounded-lg border border-gray-800 bg-[#10141b] p-4">
                  <p className="text-2xl font-bold text-slate-50">{formatPercent(knowledge.equipmentDocumentCoveragePct)}</p>
                  <p className="mt-1 text-xs text-slate-400">Equipment coverage</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {knowledge.equipmentWithCurrentDocuments} of {knowledge.equipmentAssets} assets
                  </p>
                </div>
                <div className="pilot-report-surface rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] p-4">
                  <p className="text-2xl font-bold text-emerald-400">{formatPercent(knowledge.highRiskDocumentCoveragePct)}</p>
                  <p className="mt-1 text-xs text-slate-400">High-risk coverage</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {knowledge.highRiskEquipmentWithDocuments} of {knowledge.highRiskEquipment} assets
                  </p>
                </div>
                <div className="pilot-report-surface rounded-lg border border-gray-800 bg-[#10141b] p-4">
                  <p className={`text-2xl font-bold ${aiKnowledgeReady ? "text-emerald-400" : "text-amber-400"}`}>
                    {aiKnowledgeReady ? "Ready" : "Review"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Ask Vorta evidence</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Suite {report.backendReliability.currentSuiteVersion ?? "—"} · {report.backendReliability.latestPassedChecks} checks passed
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="pilot-report-section grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="pilot-report-card rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-blue-400" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-slate-100">Pilot confidence</h2>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${scoreClasses(report.confidence.score)}`}>
                    {formatNumber(report.confidence.score)}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {report.confidence.status}
                  </p>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-4">
                  {confidenceComponents.map((component) => (
                    <div key={component.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-400">{component.label}</span>
                        <span className="font-semibold text-slate-200">{formatNumber(component.value)}</span>
                      </div>
                      <ProgressBar value={component.value} />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 self-start">
                  <div className="pilot-report-surface rounded-lg border border-gray-800 bg-[#10141b] p-4">
                    <p className="text-2xl font-bold text-slate-50">
                      {formatNumber(report.confidence.completenessScore)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Data completeness</p>
                  </div>
                  <div className="pilot-report-surface rounded-lg border border-gray-800 bg-[#10141b] p-4">
                    <p className="text-2xl font-bold text-amber-400">
                      {formatNumber(report.confidence.trendMaturityScore)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Trend maturity</p>
                  </div>
                  <div className="pilot-report-surface col-span-2 rounded-lg border border-gray-800 bg-[#10141b] p-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                      <p className="text-sm font-semibold text-slate-200">Backend evidence</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Suite {report.backendReliability.currentSuiteVersion ?? "—"} · {report.backendReliability.latestPassedChecks} checks passed · {report.backendReliability.openSystemHealthIncidents} open incidents
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="pilot-report-card rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-slate-100">Evidence limitations</h2>
              </div>
              {report.confidence.limitations.length > 0 ? (
                <div className="space-y-3">
                  {report.confidence.limitations.map((limitation) => (
                    <div
                      key={limitation}
                      className="pilot-report-surface flex items-start gap-2 rounded-lg border border-gray-800 bg-[#10141b] px-3 py-3"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                      <p className="text-xs leading-5 text-slate-400">{limitation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pilot-report-surface flex items-start gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <p className="text-xs leading-5 text-slate-300">
                    No material evidence limitations are currently reported.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <footer className="pilot-print-only border-t border-slate-300 pt-3 text-[9px] leading-4 text-slate-500">
          <p>{report.interpretation}</p>
          <p className="mt-1">
            Vorta report version {report.reportVersion} · Source site {report.siteId} · Generated {formatTimestamp(report.generatedAt, siteTimezone)}
          </p>
        </footer>
      </section>
    </>
  );
};
