import {
  AlertTriangle,
  CalendarRange,
  CircleDot,
  Clock3,
  Database,
  History,
  PackageX,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type TimelineScale = "week" | "month" | "quarter" | "year";
type EvidenceSort = "date-desc" | "warning-desc" | "confidence-desc" | "equipment";

interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  at: string;
  equipment: string;
  detail: string;
  item: HistoricalBacktestCase;
}

interface TimelineBucket {
  key: string;
  label: string;
  sublabel: string;
  start: Date;
  end: Date;
}

interface SelectedTimelineGroup {
  key: string;
  title: string;
  kind: TimelineEventKind;
  events: TimelineEvent[];
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

const SCALE_OPTIONS: Array<{ key: TimelineScale; label: string }> = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
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

function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end || end < start) return null;
  return Math.round(((end.getTime() - start.getTime()) / 86_400_000) * 10) / 10;
}

function hasClassification(item: HistoricalBacktestCase, code: string): boolean {
  return item.classifications.some((classification) => classification.code === code);
}

function outcomeAt(item: HistoricalBacktestCase): string {
  return (
    item.timeframe.failureAt ??
    item.timeframe.interventionAt ??
    item.timeframe.validationWindowEnd
  );
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

function buildBriefingLines(
  scopeLabel: string,
  summary: HistoricalBacktestSummary,
): string[] {
  const warning =
    summary.breakdownCount > 0
      ? `${summary.elevatedRiskPrecededBreakdownCount} of ${summary.breakdownCount} recorded breakdown cases were preceded by elevated Vorta risk${summary.medianWarningDays == null ? "." : `, with a median warning of ${summary.medianWarningDays} days.`}`
      : "No recorded breakdown cases are present in this scope.";
  const spares =
    summary.preFailureStockoutCount > 0
      ? `${summary.preFailureStockoutCount} breakdown case${summary.preFailureStockoutCount === 1 ? "" : "s"} also had a critical spare at zero before failure, and ${summary.stockoutExtendedRecoveryCount} case${summary.stockoutExtendedRecoveryCount === 1 ? "" : "s"} contain linked evidence that material availability extended recovery.`
      : "No pre-failure critical stock-out is evidenced in this scope.";
  const controls = `${summary.successfulInterventionCount} elevated-risk case${summary.successfulInterventionCount === 1 ? "" : "s"} received a successful intervention. ${summary.falsePositiveCount} elevated-risk case${summary.falsePositiveCount === 1 ? "" : "s"} did not later break down and remain visible as model-control evidence.`;

  return [
    `Across ${summary.scenarioCount} historical validation case${summary.scenarioCount === 1 ? "" : "s"} in ${scopeLabel}, ${warning}`,
    spares,
    controls,
  ];
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
      item,
    });
  };

  cases.forEach((item) => {
    add(
      item,
      "warning",
      item.risk.warningCapturedAt ?? item.timeframe.warningStartAt,
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
        `${item.stock.materialNumber || "Critical spare"} · ${item.stock.availableQuantity ?? 0} stock`,
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

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + delta);
  result.setHours(0, 0, 0, 0);
  return result;
}

function buildTimelineBuckets(
  events: TimelineEvent[],
  scale: TimelineScale,
): TimelineBucket[] {
  const validDates = events
    .map((event) => parseDate(event.at))
    .filter((date): date is Date => Boolean(date));
  if (validDates.length === 0) return [];

  const earliest = new Date(Math.min(...validDates.map((date) => date.getTime())));
  const latest = new Date(Math.max(...validDates.map((date) => date.getTime())));

  if (scale === "year") {
    const firstYear = earliest.getFullYear();
    const lastYear = latest.getFullYear();
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
      const year = firstYear + index;
      return {
        key: String(year),
        label: String(year),
        sublabel: "",
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    });
  }

  if (scale === "quarter") {
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
      return {
        key: `${year}-q${quarter + 1}`,
        label: `Q${quarter + 1}`,
        sublabel: String(year),
        start: new Date(year, quarter * 3, 1),
        end: new Date(year, quarter * 3 + 3, 0, 23, 59, 59, 999),
      };
    });
  }

  if (scale === "month") {
    const totalMonths =
      (latest.getFullYear() - earliest.getFullYear()) * 12 +
      latest.getMonth() -
      earliest.getMonth() +
      1;
    return Array.from({ length: totalMonths }, (_, index) => {
      const date = new Date(earliest.getFullYear(), earliest.getMonth() + index, 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
        sublabel: String(date.getFullYear()),
        start: new Date(date.getFullYear(), date.getMonth(), 1),
        end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    });
  }

  const firstWeek = startOfWeek(earliest);
  const lastWeek = startOfWeek(latest);
  const totalWeeks = Math.floor((lastWeek.getTime() - firstWeek.getTime()) / 604_800_000) + 1;
  return Array.from({ length: totalWeeks }, (_, index) => {
    const start = new Date(firstWeek);
    start.setDate(start.getDate() + index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return {
      key: start.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(start),
      sublabel: String(start.getFullYear()),
      start,
      end,
    };
  });
}

function eventKindLabel(kind: TimelineEventKind): string {
  return TIMELINE_ROWS.find((row) => row.kind === kind)?.label ?? kind;
}

function lastRiskBeforeBreakdown(item: HistoricalBacktestCase): {
  score: number | null;
  level: string | null;
  at: string | null;
} {
  return {
    score: item.risk.preOutcomeScore ?? item.risk.warningScore,
    level: item.risk.preOutcomeLevel ?? item.risk.warningLevel,
    at:
      item.risk.preOutcomeCapturedAt ??
      item.risk.warningCapturedAt ??
      item.timeframe.warningStartAt,
  };
}

function TimelineEvidencePanel({
  group,
  activeIndex,
  onActiveIndexChange,
  onClose,
  onOpenEquipment,
  closeButtonRef,
}: {
  group: SelectedTimelineGroup;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
  onOpenEquipment: (item: HistoricalBacktestCase) => void;
  closeButtonRef: React.RefObject<HTMLButtonElement>;
}): JSX.Element {
  const event = group.events[activeIndex] ?? group.events[0];
  const item = event.item;
  const preBreakdown = lastRiskBeforeBreakdown(item);
  const preBreakdownLead = item.timeframe.failureAt
    ? daysBetween(preBreakdown.at, item.timeframe.failureAt)
    : null;
  const linkedEvidence = [
    item.workOrder?.number,
    item.stock.reservationNumber ? `Reservation ${item.stock.reservationNumber}` : null,
    item.stock.materialDocumentNumber
      ? `${item.stock.movementType || "Material"} ${item.stock.materialDocumentNumber}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-50" data-vorta-historical-event-panel="true">
      <button
        type="button"
        aria-label="Close historical event details"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="historical-event-panel-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-gray-800 bg-[#0b0e14]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-800 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-blue-300">Timeline evidence</p>
            <h2 id="historical-event-panel-title" className="mt-1 text-xl font-semibold text-slate-50">
              {eventKindLabel(event.kind)}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{group.title}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close timeline evidence panel"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-800 text-slate-400 hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {group.events.length > 1 ? (
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                {group.events.length} events in this period
              </p>
              <div className="mt-2 grid gap-2">
                {group.events.map((candidate, index) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => onActiveIndexChange(index)}
                    aria-pressed={index === activeIndex}
                    className={`rounded-lg border p-3 text-left ${
                      index === activeIndex
                        ? "border-blue-400 text-slate-100"
                        : "border-gray-800 text-slate-300"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{candidate.equipment}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {formatDateTime(candidate.at)} · {candidate.detail}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="h-auto rounded border border-gray-700 bg-transparent px-2 py-1 text-[10px] font-semibold text-blue-200 shadow-none">
                {scenarioLabel(item)}
              </Badge>
              <span className="text-xs text-slate-500">{item.confidence}% confidence</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-50">{item.equipment.name}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {item.equipment.code} · {item.equipment.area}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Selected event</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{formatDateTime(event.at)}</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{event.detail}</p>
          </div>

          {event.kind === "breakdown" ? (
            <div className="mt-4 rounded-xl border border-gray-800 bg-[#0d1117] p-4">
              <p className="text-xs font-semibold uppercase text-orange-300">Last Vorta risk before breakdown</p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <span className="text-3xl font-semibold text-orange-200">
                  {preBreakdown.score ?? "—"}/100
                </span>
                <span className="pb-1 text-sm text-slate-400">
                  {preBreakdown.level || "Risk level not recorded"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Captured {formatDateTime(preBreakdown.at)}
                {preBreakdownLead == null ? "" : ` · ${preBreakdownLead} days before failure`}.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className={insetClass}>
                  <p className="text-xs font-semibold uppercase text-slate-500">First elevated warning</p>
                  <p className="mt-1 text-lg font-semibold text-slate-50">
                    {item.risk.warningScore ?? "—"}/100
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {formatDateTime(item.risk.warningCapturedAt ?? item.timeframe.warningStartAt)} · {item.timeframe.warningLeadDays} days before outcome
                  </p>
                </div>
                <div className={insetClass}>
                  <p className="text-xs font-semibold uppercase text-slate-500">Primary risk driver</p>
                  <p className="mt-1 text-sm font-semibold text-slate-50">
                    {item.risk.primaryDriver || "Not recorded"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {item.risk.recommendedActionAtTime || "No historical recommendation recorded"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {event.kind === "warning" ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className={insetClass}>
                <p className="text-xs font-semibold uppercase text-slate-500">Warning risk</p>
                <p className="mt-1 text-2xl font-semibold text-orange-300">
                  {item.risk.warningScore ?? "—"}/100
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.risk.warningLevel || "Risk level not recorded"}
                </p>
              </div>
              <div className={insetClass}>
                <p className="text-xs font-semibold uppercase text-slate-500">What happened next</p>
                <p className="mt-1 text-sm font-semibold text-slate-50">{outcomeLabel(item)}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(outcomeAt(item))}</p>
              </div>
            </div>
          ) : null}

          {event.kind === "stockout" ? (
            <div className="mt-4 rounded-xl border border-gray-800 bg-[#0d1117] p-4">
              <p className="text-xs font-semibold uppercase text-violet-300">Critical spare evidence</p>
              <p className="mt-2 text-lg font-semibold text-slate-50">
                {item.stock.materialNumber || "Critical spare"} · {item.stock.availableQuantity ?? 0} available
              </p>
              <p className="mt-1 text-sm text-slate-400">{item.stock.description || "Description not recorded"}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className={insetClass}>
                  <p className="text-xs font-semibold uppercase text-slate-500">Stock-out started</p>
                  <p className="mt-1 text-sm text-slate-100">
                    {formatDateTime(item.stock.stockoutStartAt ?? item.stock.snapshotAt)}
                  </p>
                </div>
                <div className={insetClass}>
                  <p className="text-xs font-semibold uppercase text-slate-500">Recovery evidence</p>
                  <p className="mt-1 text-sm text-slate-100">
                    {formatMinutes(item.stock.verifiedMaterialWaitMinutes)} material wait
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {event.kind === "intervention" ? (
            <div className="mt-4 rounded-xl border border-gray-800 bg-[#0d1117] p-4">
              <p className="text-xs font-semibold uppercase text-emerald-300">Intervention outcome</p>
              <div className="mt-2 flex items-center gap-4">
                <div>
                  <p className="text-xs text-slate-500">Before</p>
                  <p className="text-xl font-semibold text-orange-300">{item.risk.warningScore ?? "—"}/100</p>
                </div>
                <span className="text-slate-600">→</span>
                <div>
                  <p className="text-xs text-slate-500">After</p>
                  <p className="text-xl font-semibold text-emerald-300">{item.risk.postInterventionScore ?? "—"}/100</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {item.validation.noBreakdownInWindow
                  ? `No breakdown followed in the ${item.validation.windowDays}-day validation window.`
                  : outcomeLabel(item)}
              </p>
            </div>
          ) : null}

          {event.kind === "false-positive" ? (
            <div className="mt-4 rounded-xl border border-gray-800 bg-[#0d1117] p-4">
              <p className="text-xs font-semibold uppercase text-blue-300">Model-control evidence</p>
              <p className="mt-2 text-lg font-semibold text-slate-50">
                Elevated risk {item.risk.warningScore ?? "—"}/100, no later breakdown
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                The case remained failure-free through the {item.validation.windowDays}-day validation window and is retained so Vorta does not hide false positives.
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={insetClass}>
              <p className="text-xs font-semibold uppercase text-slate-500">Recorded outcome</p>
              <p className="mt-1 text-sm font-semibold text-slate-50">{outcomeLabel(item)}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(outcomeAt(item))}</p>
              {item.workOrder?.downtimeMinutes != null ? (
                <p className="mt-1 text-xs text-slate-400">{formatMinutes(item.workOrder.downtimeMinutes)} recorded downtime</p>
              ) : null}
            </div>
            <div className={insetClass}>
              <p className="text-xs font-semibold uppercase text-slate-500">Linked evidence</p>
              <p className="mt-1 text-sm leading-6 text-slate-200">
                {linkedEvidence || "Timestamped Vorta risk evidence"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Scenario {item.scenarioKey}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-800 bg-[#0d1117] p-3">
            <p className="text-xs font-semibold text-slate-300">Evidence boundary</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This timeline proves sequence and recorded association only. It does not prove that the risk condition caused the breakdown, that a stock-out caused it, or that the recommended intervention would definitely have prevented it.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenEquipment(item)}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm font-semibold text-slate-200"
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Open equipment history
          </button>
        </div>
      </aside>
    </div>
  );
}

function HistoricalValidationTimeline({
  cases,
}: {
  cases: HistoricalBacktestCase[];
}): JSX.Element {
  const navigate = useNavigate();
  const [scale, setScale] = useState<TimelineScale>("quarter");
  const [selectedGroup, setSelectedGroup] = useState<SelectedTimelineGroup | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRefs = useRef(new Map<string, SVGGElement>());
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const selectedTriggerKey = useRef<string | null>(null);
  const events = useMemo(() => buildTimelineEvents(cases), [cases]);
  const buckets = useMemo(() => buildTimelineBuckets(events, scale), [events, scale]);
  const spacing = 104;
  const width = Math.max(980, 190 + buckets.length * spacing);
  const height = 315;
  const left = 178;
  const right = 34;
  const plotTop = 42;
  const rowGap = 48;
  const plotBottom = plotTop + (TIMELINE_ROWS.length - 1) * rowGap;
  const labelY = plotBottom + 47;
  const sublabelY = plotBottom + 64;
  const xForBucket = (index: number) => left + index * spacing;
  const yForRow = (index: number) => plotTop + index * rowGap;

  const closePanel = useCallback(() => {
    setSelectedGroup(null);
    setActiveIndex(0);
    window.setTimeout(() => {
      const key = selectedTriggerKey.current;
      if (key) triggerRefs.current.get(key)?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    if (!selectedGroup) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, selectedGroup]);

  const openGroup = (
    key: string,
    title: string,
    kind: TimelineEventKind,
    grouped: TimelineEvent[],
  ) => {
    selectedTriggerKey.current = key;
    setSelectedGroup({ key, title, kind, events: grouped });
    setActiveIndex(0);
  };

  return (
    <div data-vorta-historical-timeline="true" data-vorta-historical-scale={scale}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-violet-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-100">Historical Risk Timeline</h2>
          </div>
          <p className="mt-1 max-w-4xl text-sm leading-5 text-slate-400">
            See the sequence Vorta would have shown around each historical outcome. Click a dot to inspect the exact equipment, risk score and evidence behind it.
          </p>
        </div>
        <div className="shrink-0">
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Timeline scale</p>
          <div className="inline-flex rounded-lg border border-gray-800 bg-[#0d1117] p-1" aria-label="Historical timeline scale">
            {SCALE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={scale === option.key}
                data-vorta-historical-scale-control={option.key}
                onClick={() => setScale(option.key)}
                className={`min-h-9 rounded-md px-3 text-xs font-semibold ${
                  scale === option.key ? "bg-gray-800 text-blue-200" : "text-slate-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {events.length === 0 || buckets.length === 0 ? (
        <div className="mt-5 rounded-xl border border-gray-800 bg-[#0b1017]/70 p-4 text-sm text-slate-400">
          No timestamped historical events are available in this scope.
        </div>
      ) : (
        <div
          data-vorta-historical-timeline-scroll="true"
          className="mt-5 overflow-x-auto rounded-xl border border-gray-800 bg-[#0b1017]/70 p-3"
        >
          <svg
            data-vorta-historical-timeline-canvas="true"
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className="max-w-none shrink-0"
            style={{ width, minWidth: width, height }}
            role="img"
            aria-label={`Historical risk warning, stock-out, breakdown, intervention and false-positive timeline grouped by ${scale}`}
          >
            {buckets.map((bucket, index) => {
              const x = xForBucket(index);
              return (
                <g key={bucket.key}>
                  <line x1={x} x2={x} y1="18" y2={plotBottom + 22} stroke="#ffffff0a" strokeWidth="1" />
                  <text x={x} y={labelY} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600">
                    {bucket.label}
                  </text>
                  {bucket.sublabel ? (
                    <text x={x} y={sublabelY} textAnchor="middle" fill="#64748b" fontSize="11">
                      {bucket.sublabel}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {TIMELINE_ROWS.map((row, rowIndex) => {
              const y = yForRow(rowIndex);
              return (
                <g key={row.kind}>
                  <circle cx="18" cy={y} r="4" fill={row.color} />
                  <text x="31" y={y + 4} fill="#cbd5e1" fontSize="12" fontWeight="600">
                    {row.label}
                  </text>
                  <line x1={left - 14} x2={width - right + 10} y1={y} y2={y} stroke="#ffffff10" strokeWidth="1" />
                  {buckets.map((bucket, bucketIndex) => {
                    const grouped = events.filter((event) => {
                      if (event.kind !== row.kind) return false;
                      const date = parseDate(event.at);
                      return date ? date >= bucket.start && date <= bucket.end : false;
                    });
                    if (grouped.length === 0) return null;
                    const x = xForBucket(bucketIndex);
                    const key = `${row.kind}-${bucket.key}`;
                    const title = `${grouped.length} ${row.label.toLowerCase()} event${grouped.length === 1 ? "" : "s"} · ${bucket.label} ${bucket.sublabel}`.trim();
                    const singleBreakdownRisk =
                      row.kind === "breakdown" && grouped.length === 1
                        ? lastRiskBeforeBreakdown(grouped[0].item).score
                        : null;
                    const centreLabel =
                      singleBreakdownRisk == null ? String(grouped.length) : String(singleBreakdownRisk);
                    const ariaLabel = `${title}. ${
                      singleBreakdownRisk == null
                        ? ""
                        : `Last Vorta risk before breakdown ${singleBreakdownRisk} out of 100. `
                    }Open evidence details.`;

                    return (
                      <g
                        key={key}
                        ref={(node) => {
                          if (node) triggerRefs.current.set(key, node);
                          else triggerRefs.current.delete(key);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={ariaLabel}
                        data-vorta-historical-event={row.kind}
                        data-vorta-historical-event-control={key}
                        onClick={() => openGroup(key, title, row.kind, grouped)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openGroup(key, title, row.kind, grouped);
                          }
                        }}
                        style={{ cursor: "pointer", outline: "none" }}
                      >
                        <title>
                          {`${ariaLabel} ${grouped
                            .slice(0, 3)
                            .map((event) => `${event.equipment}, ${formatShortDate(event.at)}: ${event.detail}`)
                            .join(". ")}`}
                        </title>
                        <circle cx={x} cy={y} r={grouped.length > 3 ? 16 : 14} fill={row.color} opacity="0.9" />
                        <circle cx={x} cy={y} r={grouped.length > 3 ? 20 : 18} fill="none" stroke={row.color} strokeWidth="2" opacity="0.35" />
                        <circle cx={x} cy={y} r={grouped.length > 3 ? 24 : 22} fill="transparent" stroke="transparent" strokeWidth="1" />
                        <text x={x} y={y + 4} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700" pointerEvents="none">
                          {centreLabel}
                        </text>
                        {singleBreakdownRisk != null ? (
                          <text x={x} y={y + 28} textAnchor="middle" fill="#94a3b8" fontSize="9" pointerEvents="none">
                            prior risk
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Breakdown dots show the last recorded Vorta risk score inside the dot when a time bucket contains one breakdown. A number on any other dot is the count of events in that period. Select any dot for the full evidence trail.
      </p>

      {selectedGroup ? (
        <TimelineEvidencePanel
          group={selectedGroup}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          onClose={closePanel}
          closeButtonRef={closeButtonRef}
          onOpenEquipment={(item) => navigate(`/equipment/${item.equipment.id}/history`)}
        />
      ) : null}
    </div>
  );
}

function CaseCard({ item }: { item: HistoricalBacktestCase }): JSX.Element {
  const navigate = useNavigate();
  const recordedOutcomeAt = outcomeAt(item);
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
              {item.equipment.code} · {item.equipment.area} · {formatShortDate(recordedOutcomeAt)}
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
          <p className="mt-1 text-xs leading-5 text-slate-400">Captured {formatDateTime(item.risk.warningCapturedAt ?? item.timeframe.warningStartAt)}</p>
        </div>
        <div className={insetClass}>
          <p className="text-xs font-semibold uppercase text-slate-500">Recorded outcome</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">{outcomeLabel(item)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{formatDateTime(recordedOutcomeAt)}</p>
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

export function HistoricalValidationInteractiveExperience(): JSX.Element {
  const { siteContext } = useAuth();
  const dataMode = getEffectiveDataMode(Boolean(siteContext?.siteId));
  const [result, setResult] = useState<HistoricalBacktestResult | null>(null);
  const [scope, setScope] = useState<HistoricalValidationScope>("all");
  const [view, setView] = useState<HistoricalValidationView>("breakdowns");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<EvidenceSort>("date-desc");
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

  const filteredByView = useMemo(
    () => (scopedResult ? filterHistoricalValidationCases(scopedResult.cases, view) : []),
    [scopedResult, view],
  );

  const visibleCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...filteredByView]
      .filter((item) => {
        if (!query) return true;
        return [
          item.equipment.name,
          item.equipment.code,
          item.equipment.area,
          item.workOrder?.number,
          item.stock.materialNumber,
          item.risk.primaryDriver,
          scenarioLabel(item),
        ].some((value) => value?.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        if (sort === "warning-desc") {
          return (right.risk.warningScore ?? -1) - (left.risk.warningScore ?? -1);
        }
        if (sort === "confidence-desc") return right.confidence - left.confidence;
        if (sort === "equipment") return left.equipment.name.localeCompare(right.equipment.name);
        return (parseDate(outcomeAt(right))?.getTime() ?? 0) - (parseDate(outcomeAt(left))?.getTime() ?? 0);
      });
  }, [filteredByView, search, sort]);

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
  const briefingLines = summary ? buildBriefingLines(scopeLabel, summary) : [];

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
              <div data-vorta-historical-briefing="true" className="mt-2 max-w-5xl space-y-2 text-sm leading-6 text-slate-300">
                {briefingLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

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

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-800 bg-[#0d1117] px-3">
                  <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="sr-only">Search historical evidence</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search equipment, work order, spare..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
                  />
                </label>
                <label className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-800 bg-[#0d1117] px-3">
                  <CalendarRange className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="sr-only">Sort historical evidence</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as EvidenceSort)}
                    className="min-w-0 flex-1 bg-[#0d1117] text-sm text-slate-200 outline-none"
                  >
                    <option value="date-desc">Newest outcome</option>
                    <option value="warning-desc">Highest warning risk</option>
                    <option value="confidence-desc">Highest confidence</option>
                    <option value="equipment">Equipment A–Z</option>
                  </select>
                </label>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3" aria-live="polite">
            {visibleCases.length > 0 ? (
              visibleCases.map((item) => <CaseCard key={item.scenarioKey} item={item} />)
            ) : (
              <div className={surfaceClass}>
                <p className="text-sm font-semibold text-slate-100">No matching historical evidence in {scopeLabel}</p>
                <p className="mt-2 text-sm text-slate-400">Clear the search, choose another evidence type or switch the Site/Area scope.</p>
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
