import {
  AlertTriangle,
  CircleDot,
  Clock3,
  Database,
  History,
  PackageX,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../lib/auth";
import { getEffectiveDataMode } from "../../lib/dataTrust";
import type {
  HistoricalBacktestCase,
  HistoricalBacktestResult,
  HistoricalBacktestSummary,
} from "../Equipment/equipmentHistoricalBacktestService";
import {
  filterHistoricalValidationCases,
  getHistoricalValidationAreas,
  loadHistoricalValidation,
  scopeHistoricalValidation,
  type HistoricalValidationScope,
  type HistoricalValidationView,
} from "./historicalValidationService";

type TimelineEventKind =
  | "warning"
  | "stockout"
  | "breakdown"
  | "intervention"
  | "false-positive";

interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  at: string;
  equipment: string;
  detail: string;
}

interface TimelineBucket {
  key: string;
  label: string;
  sublabel: string;
  start: Date;
  end: Date;
}

interface FindingProps {
  keyName: string;
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
  tone: string;
}

const VIEW_OPTIONS: Array<{ key: HistoricalValidationView; label: string }> = [
  { key: "breakdowns", label: "Breakdowns" },
  { key: "interventions", label: "Successful interventions" },
  { key: "false-positives", label: "False positives" },
  { key: "spares", label: "Spares impact" },
];

const TIMELINE_ROWS: Array<{
  kind: TimelineEventKind;
  label: string;
  color: string;
}> = [
  { kind: "warning", label: "Elevated risk", color: "#f59e0b" },
  { kind: "stockout", label: "Critical stock-out", color: "#a855f7" },
  { kind: "breakdown", label: "Breakdown", color: "#ef4444" },
  { kind: "intervention", label: "Successful intervention", color: "#10b981" },
  { kind: "false-positive", label: "False positive", color: "#3b82f6" },
];

const surfaceClass = "rounded-xl border border-gray-800 bg-[#141820] p-4";
const insetClass = "rounded-lg border border-gray-800 bg-[#0d1117] p-3";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return value || "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return value || "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMinutes(value: number | null): string {
  if (value == null) return "Not evidenced";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function hasClassification(item: HistoricalBacktestCase, code: string): boolean {
  return item.classifications.some((classification) => classification.code === code);
}

function outcomeLabel(item: HistoricalBacktestCase): string {
  if (item.timeframe.failureAt) {
    return item.workOrder?.number
      ? `Breakdown ${item.workOrder.number}`
      : "Breakdown recorded";
  }
  if (item.timeframe.interventionAt) {
    return item.workOrder?.number
      ? `Intervention ${item.workOrder.number}`
      : "Intervention completed";
  }
  return `No breakdown in ${item.validation.windowDays}-day window`;
}

function scenarioLabel(item: HistoricalBacktestCase): string {
  if (hasClassification(item, "stockout_materially_extended_recovery")) {
    return "Spares extended recovery";
  }
  if (hasClassification(item, "successful_intervention")) {
    return "Successful intervention";
  }
  if (hasClassification(item, "false_positive")) return "False positive";
  return "Elevated risk before breakdown";
}

function buildBriefing(scopeLabel: string, summary: HistoricalBacktestSummary): string {
  const warning =
    summary.breakdownCount > 0
      ? `${summary.elevatedRiskPrecededBreakdownCount} of ${summary.breakdownCount} recorded breakdown cases were preceded by elevated Vorta risk`
      : "No recorded breakdown cases are present";
  const lead =
    summary.medianWarningDays == null
      ? ""
      : `, with a median warning of ${summary.medianWarningDays} days`;
  const spares =
    summary.preFailureStockoutCount > 0
      ? ` ${summary.preFailureStockoutCount} breakdown case${summary.preFailureStockoutCount === 1 ? "" : "s"} also had a critical spare at zero before failure, and ${summary.stockoutExtendedRecoveryCount} case${summary.stockoutExtendedRecoveryCount === 1 ? "" : "s"} contain linked evidence that material availability extended recovery.`
      : " No pre-failure critical stock-out is evidenced in this scope.";
  const controls = ` ${summary.successfulInterventionCount} elevated-risk case${summary.successfulInterventionCount === 1 ? "" : "s"} received a successful intervention, while ${summary.falsePositiveCount} elevated-risk case${summary.falsePositiveCount === 1 ? "" : "s"} did not later break down and remain visible as model-control evidence.`;

  return `Across ${summary.scenarioCount} historical validation case${summary.scenarioCount === 1 ? "" : "s"} in ${scopeLabel}, ${warning}${lead}.${spares}${controls}`;
}

function ScopeTab({
  label,
  value,
  selected,
  onClick,
}: {
  label: string;
  value: number;
  selected: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg border bg-[#0d1117] px-3 text-xs font-semibold ${
        selected ? "text-blue-200" : "border-gray-800 text-slate-400"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />
      <span>{label}</span>
      <span className={selected ? "text-blue-200" : "text-slate-600"}>{value}</span>
    </button>
  );
}

function DecisionFinding({
  keyName,
  icon: Icon,
  title,
  value,
  detail,
  tone,
}: FindingProps): JSX.Element {
  return (
    <article
      data-vorta-historical-finding={keyName}
      className="rounded-xl border border-gray-800 bg-[#0b1017]/80 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
        </div>
        <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  );
}

function buildTimelineEvents(cases: HistoricalBacktestCase[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const add = (
    item: HistoricalBacktestCase,
    kind: TimelineEventKind,
    at: string | null | undefined,
    detail: string,
  ) => {
    if (!at || !parseDate(at)) return;
    events.push({
      id: `${item.scenarioKey}-${kind}`,
      kind,
      at,
      equipment: `${item.equipment.name} (${item.equipment.code})`,
      detail,
    });
  };

  cases.forEach((item) => {
    add(
      item,
      "warning",
      item.timeframe.warningStartAt,
      `${item.risk.warningScore ?? "—"}/100 risk · ${item.risk.primaryDriver || "risk driver not recorded"}`,
    );

    const relevantStockout =
      hasClassification(item, "stockout_preceded_breakdown") ||
      hasClassification(item, "stockout_materially_extended_recovery") ||
      hasClassification(item, "stockout_constrained_preventive_intervention");

    if (relevantStockout) {
      add(
        item,
        "stockout",
        item.stock.stockoutStartAt ?? item.stock.snapshotAt,
        `${item.stock.materialNumber || "Critical spare"} · 0 stock`,
      );
    }

    add(
      item,
      "breakdown",
      item.timeframe.failureAt,
      item.workOrder?.number
        ? `${item.workOrder.number} · ${item.workOrder.description}`
        : "Recorded breakdown",
    );

    if (hasClassification(item, "successful_intervention")) {
      add(
        item,
        "intervention",
        item.timeframe.interventionAt,
        item.risk.postInterventionScore == null
          ? "Successful intervention"
          : `Risk reduced to ${item.risk.postInterventionScore}/100`,
      );
    }

    if (hasClassification(item, "false_positive")) {
      add(
        item,
        "false-positive",
        item.timeframe.validationWindowEnd,
        `No breakdown in ${item.validation.windowDays}-day validation window`,
      );
    }
  });

  return events.sort(
    (left, right) =>
      (parseDate(left.at)?.getTime() ?? 0) - (parseDate(right.at)?.getTime() ?? 0),
  );
}

function buildTimelineBuckets(events: TimelineEvent[]): TimelineBucket[] {
  const validDates = events
    .map((event) => parseDate(event.at))
    .filter((date): date is Date => Boolean(date));
  if (validDates.length === 0) return [];

  const earliest = new Date(Math.min(...validDates.map((date) => date.getTime())));
  const latest = new Date(Math.max(...validDates.map((date) => date.getTime())));
  const totalMonths =
    (latest.getFullYear() - earliest.getFullYear()) * 12 +
    latest.getMonth() -
    earliest.getMonth() +
    1;

  if (totalMonths > 12) {
    const startQuarter = Math.floor(earliest.getMonth() / 3);
    const endQuarter = Math.floor(latest.getMonth() / 3);
    const totalQuarters =
      (latest.getFullYear() - earliest.getFullYear()) * 4 +
      endQuarter -
      startQuarter +
      1;

    return Array.from({ length: totalQuarters }, (_, index) => {
      const absoluteQuarter = startQuarter + index;
      const year = earliest.getFullYear() + Math.floor(absoluteQuarter / 4);
      const quarter = ((absoluteQuarter % 4) + 4) % 4;
      const start = new Date(year, quarter * 3, 1);
      const end = new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999);
      return {
        key: `${year}-q${quarter + 1}`,
        label: `Q${quarter + 1}`,
        sublabel: String(year),
        start,
        end,
      };
    });
  }

  return Array.from({ length: totalMonths }, (_, index) => {
    const date = new Date(earliest.getFullYear(), earliest.getMonth() + index, 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
      sublabel: String(date.getFullYear()).slice(-2),
      start: new Date(date.getFullYear(), date.getMonth(), 1),
      end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  });
}

function HistoricalValidationTimeline({
  cases,
}: {
  cases: HistoricalBacktestCase[];
}): JSX.Element {
  const events = useMemo(() => buildTimelineEvents(cases), [cases]);
  const buckets = useMemo(() => buildTimelineBuckets(events), [events]);
  const width = Math.max(980, 190 + buckets.length * 104);
  const height = 330;
  const left = 178;
  const right = 34;
  const plotTop = 42;
  const rowGap = 48;
  const plotBottom = plotTop + (TIMELINE_ROWS.length - 1) * rowGap;
  const labelY = plotBottom + 48;
  const sublabelY = plotBottom + 65;
  const xForBucket = (index: number) =>
    left + index * ((width - left - right) / Math.max(1, buckets.length - 1));
  const yForRow = (index: number) => plotTop + index * rowGap;

  return (
    <div data-vorta-historical-timeline="true">
      <div className="flex items-center gap-2">
        <CircleDot className="h-4 w-4 text-violet-400" aria-hidden="true" />
        <h2 className="text-base font-semibold text-slate-100">Historical Risk Timeline</h2>
      </div>
      <p className="mt-1 text-sm leading-5 text-slate-400">
        See the sequence Vorta would have shown around each historical outcome. Dots are grouped into the same time periods across every evidence row.
      </p>

      {events.length === 0 || buckets.length === 0 ? (
        <div className="mt-5 rounded-xl border border-gray-800 bg-[#0b1017]/70 p-4 text-sm text-slate-400">
          No timestamped historical events are available in this scope.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-gray-800 bg-[#0b1017]/70 p-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[840px] w-full"
            role="img"
            aria-label="Historical risk warning, stock-out, breakdown, intervention and false-positive timeline"
          >
            {buckets.map((bucket, index) => {
              const x = xForBucket(index);
              return (
                <g key={bucket.key}>
                  <line x1={x} x2={x} y1="18" y2={plotBottom + 22} stroke="#ffffff0a" strokeWidth="1" />
                  <text x={x} y={labelY} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600">
                    {bucket.label}
                  </text>
                  <text x={x} y={sublabelY} textAnchor="middle" fill="#64748b" fontSize="11">
                    {bucket.sublabel}
                  </text>
                </g>
              );
            })}

            {TIMELINE_ROWS.map((row, rowIndex) => {
              const y = yForRow(rowIndex);
              return (
                <g key={row.kind} data-vorta-historical-timeline-row={row.kind}>
                  <line x1={left} x2={width - right} y1={y} y2={y} stroke="#ffffff12" strokeWidth="1" />
                  <circle cx="15" cy={y} r="5" fill={row.color} />
                  <text x="29" y={y + 4} fill="#cbd5e1" fontSize="12" fontWeight="600">
                    {row.label}
                  </text>

                  {buckets.map((bucket, bucketIndex) => {
                    const grouped = events.filter((event) => {
                      if (event.kind !== row.kind) return false;
                      const date = parseDate(event.at);
                      return date ? date >= bucket.start && date <= bucket.end : false;
                    });
                    if (grouped.length === 0) return null;
                    const x = xForBucket(bucketIndex);
                    const title = `${grouped.length} ${row.label.toLowerCase()} event${grouped.length === 1 ? "" : "s"} · ${bucket.label} ${bucket.sublabel}`;

                    return (
                      <g key={`${row.kind}-${bucket.key}`} data-vorta-historical-event={row.kind}>
                        <title>
                          {`${title}. ${grouped
                            .slice(0, 3)
                            .map((event) => `${event.equipment}, ${formatShortDate(event.at)}: ${event.detail}`)
                            .join(". ")}`}
                        </title>
                        <circle cx={x} cy={y} r={grouped.length > 3 ? 16 : 14} fill={row.color} opacity="0.9" />
                        <circle cx={x} cy={y} r={grouped.length > 3 ? 20 : 18} fill="none" stroke={row.color} strokeWidth="2" opacity="0.35" />
                        <text x={x} y={y + 4} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700">
                          {grouped.length}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {TIMELINE_ROWS.map((row) => (
          <span
            key={row.kind}
            data-vorta-historical-legend={row.kind}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
            {row.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CaseCard({ item }: { item: HistoricalBacktestCase }): JSX.Element {
  const navigate = useNavigate();
  const outcomeAt = item.timeframe.failureAt ?? item.timeframe.interventionAt ?? item.timeframe.validationWindowEnd;
  const stockout = item.stock.availableQuantity === 0;
  const linkedEvidence = [
    item.workOrder?.number,
    item.stock.reservationNumber ? `Reservation ${item.stock.reservationNumber}` : null,
    item.stock.materialDocumentNumber ? `261 ${item.stock.materialDocumentNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <details data-vorta-historical-case={item.scenarioKey} className="rounded-xl border border-gray-800 bg-[#141820] p-4">
      <summary className="cursor-pointer">
        <div className="inline-flex min-w-0 flex-col gap-2 align-top">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="h-auto rounded border border-gray-700 bg-transparent px-2 py-1 text-[10px] font-semibold text-blue-200 shadow-none">
              {scenarioLabel(item)}
            </Badge>
            <span className="text-xs text-slate-500">{item.confidence}% confidence</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-50">{item.equipment.name}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {item.equipment.code} · {item.equipment.area} · {formatShortDate(outcomeAt)}
            </p>
          </div>
          <p className="text-sm leading-5 text-slate-300">
            Vorta warning: <span className="font-semibold text-orange-300">{item.risk.warningScore ?? "—"}/100</span> · {item.timeframe.warningLeadDays} days before outcome · {outcomeLabel(item)}
          </p>
        </div>
      </summary>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className={insetClass}>
          <p className="text-xs font-semibold uppercase text-slate-500">Warning evidence</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">{item.risk.primaryDriver || "Driver unavailable"}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Captured {formatDateTime(item.timeframe.warningStartAt)}</p>
        </div>
        <div className={insetClass}>
          <p className="text-xs font-semibold uppercase text-slate-500">Recorded outcome</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">{outcomeLabel(item)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{formatDateTime(outcomeAt)}</p>
        </div>
        <div className={insetClass}>
          <p className="text-xs font-semibold uppercase text-slate-500">Spares / validation</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">
            {item.stock.materialNumber
              ? `${item.stock.materialNumber}${stockout ? " · 0 stock" : ""}`
              : item.validation.noBreakdownInWindow
                ? "No later breakdown"
                : "Breakdown evidenced"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {item.stock.verifiedMaterialWaitMinutes != null
              ? `${formatMinutes(item.stock.verifiedMaterialWaitMinutes)} verified material wait`
              : item.risk.postInterventionScore != null
                ? `${item.risk.postInterventionScore}/100 post-intervention risk`
                : `${item.validation.windowDays}-day validation window`}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className={insetClass}>
          <p className="text-xs font-semibold text-slate-400">Vorta action at the time</p>
          <p className="mt-1 text-sm leading-6 text-slate-200">{item.risk.recommendedActionAtTime}</p>
        </div>
        <div className={insetClass}>
          <p className="text-xs font-semibold text-slate-400">Linked evidence</p>
          <p className="mt-1 text-sm leading-6 text-slate-200">{linkedEvidence || "Timestamped Vorta risk evidence"}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.classifications.map((classification) => (
          <span key={`${item.scenarioKey}-${classification.code}`} className="rounded-full border border-gray-700 px-2 py-1 text-xs text-slate-300">
            {classification.label} · {classification.confidence}%
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate(`/equipment/${item.equipment.id}/history`)}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm font-semibold text-slate-200"
      >
        <History className="h-4 w-4" aria-hidden="true" />
        Equipment history
      </button>
    </details>
  );
}

function LoadingState(): JSX.Element {
  return (
    <section className="flex w-full flex-col gap-5 px-4 pb-28 pt-4" role="status" aria-live="polite">
      <div className="h-16 animate-pulse border-b border-gray-800" />
      <div className="h-40 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="h-72 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <span className="sr-only">Loading Historical Validation</span>
    </section>
  );
}

function UnavailableState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <section className="w-full px-4 py-12">
      <div className={surfaceClass}>
        <Database className="h-9 w-9 text-slate-500" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-4 py-2 text-sm font-semibold text-slate-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function HistoricalValidationExperience(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const [result, setResult] = useState<HistoricalBacktestResult | null>(null);
  const [scope, setScope] = useState<HistoricalValidationScope>("all");
  const [view, setView] = useState<HistoricalValidationView>("breakdowns");
  const [loading, setLoading] = useState(dataMode === "demo");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (dataMode !== "demo" || !siteContext?.siteId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await loadHistoricalValidation(siteContext.siteId));
    } catch (nextError) {
      setResult(null);
      setError(nextError instanceof Error ? nextError.message : "Historical validation is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [dataMode, siteContext?.siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const areas = useMemo(() => (result ? getHistoricalValidationAreas(result) : []), [result]);

  useEffect(() => {
    if (scope !== "all" && !areas.some((item) => item.area === scope)) setScope("all");
  }, [areas, scope]);

  const scopedResult = useMemo(
    () => (result ? scopeHistoricalValidation(result, scope) : null),
    [result, scope],
  );
  const visibleCases = useMemo(
    () => (scopedResult ? filterHistoricalValidationCases(scopedResult.cases, view) : []),
    [scopedResult, view],
  );
  const viewCounts = useMemo(() => {
    if (!scopedResult) {
      return { breakdowns: 0, interventions: 0, "false-positives": 0, spares: 0 };
    }
    return {
      breakdowns: filterHistoricalValidationCases(scopedResult.cases, "breakdowns").length,
      interventions: filterHistoricalValidationCases(scopedResult.cases, "interventions").length,
      "false-positives": filterHistoricalValidationCases(scopedResult.cases, "false-positives").length,
      spares: filterHistoricalValidationCases(scopedResult.cases, "spares").length,
    };
  }, [scopedResult]);

  if (dataMode === "live") {
    return (
      <UnavailableState
        title="Historical validation is not yet available for live evidence"
        message="This screen does not substitute synthetic demonstration history for a live site. It will populate only when authorised real historical evidence satisfies the Vorta trust contract."
      />
    );
  }
  if (dataMode === "unavailable") {
    return (
      <UnavailableState
        title="Historical validation is unavailable"
        message="Vorta could not resolve an authorised active-site context for this screen."
      />
    );
  }
  if (loading) return <LoadingState />;
  if (error) {
    return (
      <UnavailableState
        title="Historical validation could not be loaded"
        message={error}
        onRetry={() => void load()}
      />
    );
  }
  if (!result || result.status === "empty") {
    return (
      <UnavailableState
        title="No historical validation evidence is available"
        message="There are no governed historical backtest cases for the authorised site."
        onRetry={() => void load()}
      />
    );
  }

  const scopeLabel = scope === "all" ? "Site" : scope;
  const syntheticDemo = result.cases.some((item) => item.provenance.syntheticDemo);
  const summary = scopedResult?.summary;
  const briefing = summary ? buildBriefing(scopeLabel, summary) : "";

  return (
    <section
      data-vorta-historical-validation="true"
      data-vorta-historical-scope={scopeLabel}
      className="flex w-full min-w-0 flex-col gap-4 overflow-x-hidden px-4 pb-28 pt-4 md:px-6"
    >
      <header className="border-b border-gray-800 pb-4">
        <p className="text-xs font-semibold uppercase text-blue-300">Risk intelligence</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-50">Historical Validation</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          See what Vorta knew before recorded maintenance outcomes, and what happened next.
        </p>
      </header>

      <div className="overflow-x-auto border-b border-gray-800 pb-3">
        <div className="flex min-w-max gap-2" role="tablist" aria-label="Historical validation scope">
          <ScopeTab label="Site" value={result.summary.scenarioCount} selected={scope === "all"} onClick={() => setScope("all")} />
          {areas.map((item) => (
            <ScopeTab
              key={item.area}
              label={item.area}
              value={item.scenarioCount}
              selected={scope === item.area}
              onClick={() => setScope(item.area)}
            />
          ))}
        </div>
      </div>

      {scopedResult?.status === "empty" || !summary ? (
        <div className={surfaceClass}>
          <p className="text-sm font-semibold text-slate-100">No historical cases in {scopeLabel}</p>
          <p className="mt-2 text-sm text-slate-400">The selected area has no governed historical validation scenarios.</p>
        </div>
      ) : (
        <>
          <Card className="overflow-hidden rounded-2xl border border-violet-500/25 bg-[linear-gradient(135deg,#151824_0%,#10151d_55%,#151222_100%)] shadow-none">
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="h-auto rounded bg-violet-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300 shadow-none">
                  Historical risk intelligence
                </Badge>
                <span data-vorta-historical-provenance="true" className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  {syntheticDemo
                    ? "Synthetic demonstration history · not imported pilot SAP history"
                    : "Governed historical evidence"}
                </span>
              </div>

              <h2 className="mt-4 text-xl font-semibold text-slate-50">Historical Risk Briefing</h2>
              <p data-vorta-historical-briefing="true" className="mt-2 max-w-5xl text-sm leading-6 text-slate-300">
                {briefing}
              </p>

              <div className="mt-4 rounded-xl border border-gray-800 bg-[#0b1017]/70 p-3">
                <p className="text-xs leading-5 text-slate-400">
                  <span className="font-semibold text-slate-200">What this means:</span>{" "}
                  the historical evidence shows warning opportunity and operational association. Temporal sequence or correlation does not prove that Vorta would have prevented a breakdown or that a stock-out caused it.
                </p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <DecisionFinding
                  keyName="warning"
                  icon={AlertTriangle}
                  title="Warning performance"
                  value={`${summary.elevatedRiskPrecededBreakdownCount}/${summary.breakdownCount} breakdowns warned`}
                  detail={summary.medianWarningDays == null ? "No median warning lead time is available." : `Median advance warning: ${summary.medianWarningDays} days.`}
                  tone="text-orange-300"
                />
                <DecisionFinding
                  keyName="spares"
                  icon={PackageX}
                  title="Spares & recovery"
                  value={`${summary.preFailureStockoutCount} pre-failure stock-outs`}
                  detail={`${summary.stockoutExtendedRecoveryCount} verified recovery delay${summary.stockoutExtendedRecoveryCount === 1 ? "" : "s"} · median material wait ${formatMinutes(summary.medianVerifiedMaterialWaitMinutes)}.`}
                  tone="text-violet-300"
                />
                <DecisionFinding
                  keyName="controls"
                  icon={ShieldCheck}
                  title="Interventions & controls"
                  value={`${summary.successfulInterventionCount} successful interventions`}
                  detail={`${summary.falsePositiveCount} false positive${summary.falsePositiveCount === 1 ? "" : "s"} retained · ${summary.evidenceSupportedPreventabilityRate ?? 0}% evidence-supported preventability.`}
                  tone="text-emerald-300"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5 md:p-6">
              <HistoricalValidationTimeline cases={scopedResult.cases} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-blue-300" aria-hidden="true" />
                    <h2 className="text-base font-semibold text-slate-100">Historical Evidence Register</h2>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Drill into the timestamped cases behind the briefing and timeline.
                  </p>
                </div>
                <span className="text-xs text-slate-500">{summary.scenarioCount} governed cases</span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <div className="flex min-w-max gap-2" role="tablist" aria-label="Historical validation evidence type">
                  {VIEW_OPTIONS.map((option) => (
                    <ScopeTab
                      key={option.key}
                      label={option.label}
                      value={viewCounts[option.key]}
                      selected={view === option.key}
                      onClick={() => setView(option.key)}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3" aria-live="polite">
            {visibleCases.length > 0 ? (
              visibleCases.map((item) => <CaseCard key={item.scenarioKey} item={item} />)
            ) : (
              <div className={surfaceClass}>
                <p className="text-sm font-semibold text-slate-100">
                  No {VIEW_OPTIONS.find((option) => option.key === view)?.label.toLowerCase()} cases in {scopeLabel}
                </p>
                <p className="mt-2 text-sm text-slate-400">Try another evidence type or switch the Site/Area scope.</p>
              </div>
            )}
          </div>

          <footer className="rounded-xl border border-gray-800 bg-[#0d1117] px-4 py-3 text-xs leading-5 text-slate-500">
            Dataset {result.datasetVersion} · validation window {result.validationWindowDays} days · preventability status: not established from sequence alone.
          </footer>
        </>
      )}
    </section>
  );
}
