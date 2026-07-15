import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  FileCheck2,
  Wrench,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import type {
  MaintenanceScheduleMode,
  MaintenanceScheduleRecord,
} from "./equipmentScheduleService";

interface EquipmentScheduleTimelineProps {
  mode: MaintenanceScheduleMode;
  records: MaintenanceScheduleRecord[];
  loading: boolean;
  onOpenWorkOrder?: (workOrderNumber: string) => void;
}

interface TimelineBucket {
  key: string;
  label: string;
  sublabel: string;
  start: Date;
  end: Date;
}

interface TimelineCategory {
  label: string;
  fullLabel: string;
  color: string;
  recordIds: Set<string>;
}

interface ScheduleOccurrence {
  id: string;
  record: MaintenanceScheduleRecord;
  date: Date;
  kind: "completed" | "scheduled";
  projected: boolean;
  status: string;
}

interface SelectedGroup {
  key: string;
  category: TimelineCategory;
  bucket: TimelineBucket;
  occurrences: ScheduleOccurrence[];
}

interface ScheduleSummary {
  record: MaintenanceScheduleRecord;
  occurrences: ScheduleOccurrence[];
}

interface Cycle {
  days?: number;
  months?: number;
}

const PM_CATEGORIES = [
  { label: "Preventive maintenance", color: "#8b5cf6" },
  { label: "Inspections", color: "#3b82f6" },
  { label: "Statutory / validation", color: "#f59e0b" },
  { label: "Condition-based", color: "#06b6d4" },
] as const;

const CALIBRATION_COLORS = [
  "#06b6d4",
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfMonth(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

function sameDay(left: Date | null, right: Date | null): boolean {
  return Boolean(
    left &&
      right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );
}

function monthBuckets(today: Date): TimelineBucket[] {
  const first = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth() + index, 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
      sublabel: String(date.getFullYear()).slice(-2),
      start: date,
      end: endOfMonth(date),
    };
  });
}

function inferCycle(record: MaintenanceScheduleRecord): Cycle | null {
  const frequency = normalise(record.frequency);
  const unit = normalise(record.frequencyUnit);
  const numericValue = Number(frequency.match(/\d+(?:\.\d+)?/)?.[0] ?? 1);
  const multiplier =
    Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 1;

  if (unit.includes("DAY") || frequency.includes("DAILY")) {
    return { days: Math.max(1, Math.round(multiplier)) };
  }
  if (unit.includes("WEEK") || frequency.includes("WEEKLY")) {
    return { days: Math.max(7, Math.round(multiplier * 7)) };
  }
  if (unit.includes("QUARTER") || frequency.includes("QUARTER")) {
    return { months: Math.max(3, Math.round(multiplier * 3)) };
  }
  if (
    unit.includes("YEAR") ||
    frequency.includes("ANNUAL") ||
    frequency.includes("YEARLY")
  ) {
    return { months: Math.max(12, Math.round(multiplier * 12)) };
  }
  if (
    frequency.includes("SEMIANNUAL") ||
    frequency.includes("SIX MONTH") ||
    frequency.includes("BIANNUAL")
  ) {
    return { months: 6 };
  }
  if (unit.includes("MONTH") || frequency.includes("MONTHLY")) {
    return { months: Math.max(1, Math.round(multiplier)) };
  }

  const lastCompleted = parseDate(record.lastCompletedDate);
  const nextDue = parseDate(record.nextDueDate);
  if (!lastCompleted || !nextDue || nextDue <= lastCompleted) return null;

  const intervalDays = Math.round(
    (nextDue.getTime() - lastCompleted.getTime()) / 86_400_000,
  );
  if (intervalDays >= 330) return { months: 12 };
  if (intervalDays >= 150) return { months: 6 };
  if (intervalDays >= 75) return { months: 3 };
  if (intervalDays >= 25) return { months: 1 };
  if (intervalDays >= 6) return { days: 7 };
  return { days: Math.max(1, intervalDays) };
}

function advanceDate(value: Date, cycle: Cycle): Date {
  if (cycle.days) {
    const date = new Date(value);
    date.setDate(date.getDate() + cycle.days);
    return date;
  }

  const months = cycle.months ?? 1;
  const targetDay = value.getDate();
  const date = new Date(value.getFullYear(), value.getMonth() + months, 1);
  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  date.setDate(Math.min(targetDay, lastDay));
  return date;
}

function categoryForPm(record: MaintenanceScheduleRecord): string {
  const text = normalise(
    [record.scheduleType, record.title, record.procedureReference]
      .filter(Boolean)
      .join(" "),
  );

  if (
    /CONDITION|PREDICT|VIBRATION|THERMOGRAPH|OIL ANALYSIS|MONITOR/.test(text)
  ) {
    return "Condition-based";
  }
  if (/STATUTORY|VALIDATION|LEGAL|COMPLIANCE|SAFETY TEST/.test(text)) {
    return "Statutory / validation";
  }
  if (/INSPECTION|VISUAL|CHECK/.test(text)) {
    return "Inspections";
  }
  return "Preventive maintenance";
}

function truncateLabel(value: string, maxLength = 26): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

function criticalityRank(value: string | null): number {
  const level = normalise(value);
  if (level === "CRITICAL") return 4;
  if (level === "HIGH") return 3;
  if (level === "MEDIUM") return 2;
  return 1;
}

function buildCategories(
  mode: MaintenanceScheduleMode,
  records: MaintenanceScheduleRecord[],
): TimelineCategory[] {
  if (mode === "pm") {
    return PM_CATEGORIES.map((category) => ({
      ...category,
      fullLabel: category.label,
      recordIds: new Set(
        records
          .filter((record) => categoryForPm(record) === category.label)
          .map((record) => record.id),
      ),
    }));
  }

  const pointLabels = Array.from(
    new Set(
      records
        .map((record) => record.calibrationPoint?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (pointLabels.length > 0 && pointLabels.length <= 5) {
    return pointLabels
      .map((point, index) => ({
        label: truncateLabel(point),
        fullLabel: point,
        color: CALIBRATION_COLORS[index % CALIBRATION_COLORS.length],
        recordIds: new Set(
          records
            .filter((record) => record.calibrationPoint?.trim() === point)
            .map((record) => record.id),
        ),
        priority: Math.max(
          ...records
            .filter((record) => record.calibrationPoint?.trim() === point)
            .map((record) => criticalityRank(record.criticality)),
        ),
      }))
      .sort((left, right) => right.priority - left.priority)
      .map(({ priority: _priority, ...category }) => category);
  }

  const grouped = [
    { label: "Critical controls", color: "#ef4444", rank: 4 },
    { label: "High controls", color: "#f59e0b", rank: 3 },
    { label: "Standard controls", color: "#06b6d4", rank: 0 },
  ];

  return grouped.map((category) => ({
    label: category.label,
    fullLabel: category.label,
    color: category.color,
    recordIds: new Set(
      records
        .filter((record) => {
          const rank = criticalityRank(record.criticality);
          return category.rank === 0 ? rank < 3 : rank === category.rank;
        })
        .map((record) => record.id),
    ),
  }));
}

function buildOccurrences(
  records: MaintenanceScheduleRecord[],
  buckets: TimelineBucket[],
): ScheduleOccurrence[] {
  const horizonStart = buckets[0]?.start;
  const horizonEnd = buckets[buckets.length - 1]?.end;
  if (!horizonStart || !horizonEnd) return [];

  const occurrences: ScheduleOccurrence[] = [];

  records.forEach((record) => {
    const lastCompleted = parseDate(record.lastCompletedDate);
    const nextDue = parseDate(record.nextDueDate);

    if (
      lastCompleted &&
      lastCompleted >= horizonStart &&
      lastCompleted <= horizonEnd
    ) {
      occurrences.push({
        id: `${record.id}-completed-${lastCompleted.toISOString()}`,
        record,
        date: lastCompleted,
        kind: "completed",
        projected: false,
        status: record.lastResult ?? "COMPLETED",
      });
    }

    if (!nextDue) return;
    const cycle = inferCycle(record);
    let occurrenceDate = new Date(nextDue);
    let guard = 0;

    while (occurrenceDate < horizonStart && cycle && guard < 500) {
      occurrenceDate = advanceDate(occurrenceDate, cycle);
      guard += 1;
    }

    while (occurrenceDate <= horizonEnd && guard < 500) {
      if (!sameDay(occurrenceDate, lastCompleted)) {
        const projected = occurrenceDate.getTime() !== nextDue.getTime();
        occurrences.push({
          id: `${record.id}-scheduled-${occurrenceDate.toISOString()}`,
          record,
          date: new Date(occurrenceDate),
          kind: "scheduled",
          projected,
          status: projected ? "PLANNED" : record.status,
        });
      }

      if (!cycle) break;
      occurrenceDate = advanceDate(occurrenceDate, cycle);
      guard += 1;
    }
  });

  return occurrences;
}

function statusClass(value: string): string {
  const status = normalise(value);
  if (/OVERDUE|FAIL|REJECT/.test(status)) {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  if (/DUE SOON|ADJUST/.test(status)) {
    return "border-orange-500/25 bg-orange-500/10 text-orange-300";
  }
  if (/COMPLETED|PASS|SUCCESS|ON TRACK/.test(status)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  return "border-blue-500/25 bg-blue-500/10 text-blue-300";
}

function frequencyLabel(record: MaintenanceScheduleRecord): string {
  if (record.frequency) return record.frequency;
  const cycle = inferCycle(record);
  if (cycle?.months === 12) return "Annual";
  if (cycle?.months === 6) return "Six-monthly";
  if (cycle?.months === 3) return "Quarterly";
  if (cycle?.months === 1) return "Monthly";
  if (cycle?.days === 7) return "Weekly";
  if (cycle?.days === 1) return "Daily";
  return "Imported schedule";
}

export function EquipmentScheduleTimeline({
  mode,
  records,
  loading,
  onOpenWorkOrder,
}: EquipmentScheduleTimelineProps): JSX.Element {
  const today = useMemo(() => startOfDay(new Date()), []);
  const buckets = useMemo(() => monthBuckets(today), [today]);
  const categories = useMemo(
    () => buildCategories(mode, records),
    [mode, records],
  );
  const occurrences = useMemo(
    () => buildOccurrences(records, buckets),
    [buckets, records],
  );
  const [selected, setSelected] = useState<SelectedGroup | null>(null);
  const selectedPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [mode, records]);

  useEffect(() => {
    if (!selected) return;
    const frame = window.requestAnimationFrame(() => {
      selectedPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selected]);

  const selectedSummaries = useMemo<ScheduleSummary[]>(() => {
    if (!selected) return [];
    const grouped = new Map<string, ScheduleSummary>();

    selected.occurrences.forEach((occurrence) => {
      const current = grouped.get(occurrence.record.id) ?? {
        record: occurrence.record,
        occurrences: [],
      };
      current.occurrences.push(occurrence);
      grouped.set(occurrence.record.id, current);
    });

    return Array.from(grouped.values())
      .map((summary) => ({
        ...summary,
        occurrences: [...summary.occurrences].sort(
          (left, right) => left.date.getTime() - right.date.getTime(),
        ),
      }))
      .sort(
        (left, right) =>
          criticalityRank(right.record.criticality) -
            criticalityRank(left.record.criticality) ||
          left.occurrences[0].date.getTime() -
            right.occurrences[0].date.getTime(),
      );
  }, [selected]);

  const width = 1180;
  const left = 208;
  const right = 34;
  const plotTop = 72;
  const rowGap = 56;
  const plotBottom =
    plotTop + Math.max(0, categories.length - 1) * rowGap;
  const labelY = plotBottom + 50;
  const sublabelY = plotBottom + 68;
  const height = plotBottom + 96;
  const xForBucket = (index: number) =>
    left +
    index * ((width - left - right) / Math.max(1, buckets.length - 1));
  const yForCategory = (index: number) => plotTop + index * rowGap;
  const todayBoundaryX = (xForBucket(2) + xForBucket(3)) / 2;
  const futureEndX = width - right;

  const futureOccurrenceCount = occurrences.filter(
    (occurrence) =>
      occurrence.kind === "scheduled" && occurrence.date >= today,
  ).length;
  const recentCompletionCount = occurrences.filter(
    (occurrence) => occurrence.kind === "completed",
  ).length;

  const title =
    mode === "pm"
      ? "Preventive Maintenance Schedule"
      : "Calibration Schedule and Compliance Horizon";
  const description =
    mode === "pm"
      ? "Previous three months of completed work and the current nine-month forward schedule, projected from imported maintenance cycles."
      : "Previous three months of calibration evidence and the current nine-month compliance schedule, grouped by calibration point.";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange
              className={`h-4 w-4 ${
                mode === "pm" ? "text-violet-400" : "text-cyan-400"
              }`}
            />
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="h-auto rounded border border-gray-700 bg-gray-800/60 px-2.5 py-1.5 font-medium text-slate-300 shadow-none">
            {recentCompletionCount} recent completion
            {recentCompletionCount === 1 ? "" : "s"}
          </Badge>
          <Badge className="h-auto rounded border border-blue-500/20 bg-blue-500/[0.07] px-2.5 py-1.5 font-medium text-blue-300 shadow-none">
            {futureOccurrenceCount} scheduled call
            {futureOccurrenceCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-800 bg-[#0b1017]/70 p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[900px] w-full"
          role="img"
          aria-label={`${title}, previous three months and next nine months`}
        >
          <rect
            x={left}
            y="36"
            width={todayBoundaryX - left}
            height={plotBottom - 8}
            rx="10"
            fill="#ffffff"
            opacity="0.012"
          />
          <rect
            x={todayBoundaryX}
            y="36"
            width={futureEndX - todayBoundaryX}
            height={plotBottom - 8}
            rx="10"
            fill={mode === "pm" ? "#8b5cf6" : "#06b6d4"}
            opacity="0.018"
          />

          <text
            x={(left + todayBoundaryX) / 2}
            y="23"
            textAnchor="middle"
            fill="#64748b"
            fontSize="10"
            fontWeight="700"
            letterSpacing="1.3"
          >
            PREVIOUS 3 MONTHS
          </text>
          <text
            x={(todayBoundaryX + futureEndX) / 2}
            y="23"
            textAnchor="middle"
            fill={mode === "pm" ? "#a78bfa" : "#67e8f9"}
            fontSize="10"
            fontWeight="700"
            letterSpacing="1.3"
            opacity="1"
          >
            CURRENT + NEXT 8 MONTHS
          </text>

          <line
            x1={todayBoundaryX}
            x2={todayBoundaryX}
            y1="31"
            y2={plotBottom + 22}
            stroke={mode === "pm" ? "#c4b5fd" : "#67e8f9"}
            strokeWidth="2"
            strokeDasharray="5 5"
            opacity="0.9"
          />
          <rect
            x={todayBoundaryX - 25}
            y="31"
            width="50"
            height="18"
            rx="9"
            fill={mode === "pm" ? "#6d28d9" : "#0e7490"}
          />
          <text
            x={todayBoundaryX}
            y="43.5"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9"
            fontWeight="800"
          >
            TODAY
          </text>

          {buckets.map((bucket, index) => {
            const x = xForBucket(index);
            const futureBucket = index >= 3;
            return (
              <g key={bucket.key}>
                <line
                  x1={x}
                  x2={x}
                  y1="52"
                  y2={plotBottom + 22}
                  stroke="#ffffff0a"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={labelY}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize="12"
                  fontWeight="600"
                  opacity="1"
                >
                  {bucket.label}
                </text>
                <text
                  x={x}
                  y={sublabelY}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="11"
                  opacity="1"
                >
                  {bucket.sublabel}
                </text>
              </g>
            );
          })}

          {categories.map((category, categoryIndex) => {
            const y = yForCategory(categoryIndex);
            return (
              <g key={category.fullLabel}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="#ffffff12"
                  strokeWidth="1"
                />
                <circle cx="16" cy={y} r="5" fill={category.color} />
                <text
                  x="31"
                  y={y + 4}
                  fill="#cbd5e1"
                  fontSize="12"
                  fontWeight="600"
                >
                  {category.label}
                  <title>{category.fullLabel}</title>
                </text>

                {buckets.map((bucket, bucketIndex) => {
                  const grouped = occurrences.filter(
                    (occurrence) =>
                      category.recordIds.has(occurrence.record.id) &&
                      occurrence.date >= bucket.start &&
                      occurrence.date <= bucket.end,
                  );
                  if (grouped.length === 0) return null;

                  const hasFailed = grouped.some((occurrence) =>
                    /FAIL|REJECT/.test(
                      normalise(
                        occurrence.kind === "completed"
                          ? occurrence.record.lastResult ?? occurrence.status
                          : occurrence.status,
                      ),
                    ),
                  );
                  const hasAdjustment = grouped.some((occurrence) =>
                    /ADJUST/.test(
                      normalise(
                        occurrence.kind === "completed"
                          ? occurrence.record.lastResult ?? occurrence.status
                          : occurrence.status,
                      ),
                    ),
                  );
                  const hasOverdue = grouped.some(
                    (occurrence) =>
                      occurrence.kind === "scheduled" &&
                      (occurrence.date < today ||
                        normalise(occurrence.status).includes("OVERDUE")),
                  );
                  const dueSoonLimit = new Date(today);
                  dueSoonLimit.setDate(dueSoonLimit.getDate() + 30);
                  const hasDueSoon = grouped.some(
                    (occurrence) =>
                      occurrence.kind === "scheduled" &&
                      ((occurrence.date >= today &&
                        occurrence.date <= dueSoonLimit) ||
                        normalise(occurrence.status).includes("DUE SOON")),
                  );
                  const completedOnly = grouped.every(
                    (occurrence) => occurrence.kind === "completed",
                  );
                  const futureOnly = grouped.every(
                    (occurrence) =>
                      occurrence.kind === "scheduled" &&
                      occurrence.date >= today,
                  );
                  const futureAttention =
                    futureOnly &&
                    (hasFailed || hasOverdue || hasAdjustment || hasDueSoon);

                  const fill = hasFailed
                    ? "#ef4444"
                    : hasAdjustment
                      ? "#f59e0b"
                      : completedOnly
                        ? "#10b981"
                        : category.color;
                  const ring =
                    hasFailed || hasOverdue
                      ? "#ef4444"
                      : hasAdjustment || hasDueSoon
                        ? "#f59e0b"
                        : "#60a5fa";
                  const dashed =
                    !hasFailed &&
                    !hasOverdue &&
                    !hasAdjustment &&
                    !hasDueSoon &&
                    !completedOnly;
                  const radius =
                    grouped.length >= 20
                      ? 18
                      : grouped.length >= 8
                        ? 17
                        : 16;
                  const x = xForBucket(bucketIndex);
                  const groupKey = `${category.fullLabel}-${bucket.key}`;
                  const isSelected = selected?.key === groupKey;
                  const projectedCount = grouped.filter(
                    (occurrence) => occurrence.projected,
                  ).length;
                  const titleText = `${grouped.length} schedule event${
                    grouped.length === 1 ? "" : "s"
                  } · ${category.fullLabel} · ${bucket.label} ${
                    bucket.sublabel
                  }${projectedCount ? ` · ${projectedCount} projected` : ""}`;

                  const openGroup = () => {
                    setSelected((current) =>
                      current?.key === groupKey
                        ? null
                        : {
                            key: groupKey,
                            category,
                            bucket,
                            occurrences: [...grouped].sort(
                              (leftOccurrence, rightOccurrence) =>
                                leftOccurrence.date.getTime() -
                                rightOccurrence.date.getTime(),
                            ),
                          },
                    );
                  };

                  return (
                    <g
                      key={groupKey}
                      role="button"
                      tabIndex={0}
                      aria-label={titleText}
                      onClick={openGroup}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openGroup();
                        }
                      }}
                      className="cursor-pointer outline-none"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={radius + 7}
                        fill="transparent"
                      />
                      {futureAttention ? (
              <circle
                cx={x}
                cy={y}
                r={radius + 5}
                fill="none"
                stroke={ring}
                strokeWidth="2"
                opacity="0.9"
                pointerEvents="none"
              />
            ) : !futureOnly ? (
              <circle
                cx={x}
                cy={y}
                r={radius + 4}
                fill="none"
                stroke={ring}
                strokeWidth="2"
                strokeDasharray={dashed ? "4 3" : undefined}
                opacity={completedOnly ? 0.2 : 0.72}
                pointerEvents="none"
              />
            ) : null}
            {isSelected ? (
              <circle
                cx={x}
                cy={y}
                r={radius + 8}
                fill="none"
                stroke="#f8fafc"
                strokeWidth="1.5"
                opacity="0.95"
                pointerEvents="none"
              />
            ) : null}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={futureOnly ? "none" : fill}
              stroke={futureOnly ? category.color : "#0b1017"}
              strokeWidth={futureOnly ? "2.5" : "2.5"}
              strokeDasharray={
                futureOnly && projectedCount === grouped.length
                  ? "5 4"
                  : undefined
              }
              opacity={futureOnly ? 0.95 : completedOnly ? 0.92 : 0.86}
              pointerEvents="none"
            >
              <title>{titleText}</title>
            </circle>
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fill={futureOnly ? category.color : "#ffffff"}
              fontSize={grouped.length >= 100 ? "9" : "11"}
              fontWeight="800"
              opacity="1"
              pointerEvents="none"
            >
              {grouped.length}
            </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {!loading && records.length === 0 ? (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="12"
            >
              No imported schedule records are available for this equipment
            </text>
          ) : null}
        </svg>
      </div>

      {selected ? (
        <div
          ref={selectedPanelRef}
          className="mt-3 rounded-xl border border-gray-800 bg-[#0b1017]/90 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-xs font-bold text-white ring-2 ring-[#141820]"
                style={{ backgroundColor: selected.category.color }}
              >
                {selected.occurrences.length}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {selected.category.fullLabel} · {selected.bucket.label}{" "}
                  {selected.bucket.sublabel}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {selectedSummaries.length} source schedule
                  {selectedSummaries.length === 1 ? "" : "s"} ·{" "}
                  {
                    selected.occurrences.filter(
                      (occurrence) => occurrence.projected,
                    ).length
                  }{" "}
                  projected call
                  {selected.occurrences.filter(
                    (occurrence) => occurrence.projected,
                  ).length === 1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-gray-800 hover:text-slate-200"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {selectedSummaries.map(({ record, occurrences: recordOccurrences }) => {
              const firstDate = recordOccurrences[0]?.date;
              const lastDate = recordOccurrences[recordOccurrences.length - 1]?.date;
              const projectedCount = recordOccurrences.filter(
                (occurrence) => occurrence.projected,
              ).length;
              const state = recordOccurrences.some(
                (occurrence) =>
                  occurrence.kind === "scheduled" && occurrence.date < today,
              )
                ? "OVERDUE"
                : recordOccurrences.some(
                      (occurrence) => occurrence.kind === "completed",
                    )
                  ? record.lastResult ?? "COMPLETED"
                  : record.status;

              return (
                <article
                  key={record.id}
                  className="rounded-xl border border-gray-800 bg-[#0a0f16] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`font-mono text-[11px] font-semibold ${
                          mode === "pm" ? "text-violet-300" : "text-cyan-300"
                        }`}
                      >
                        {record.reference}
                      </p>
                      <h4 className="mt-1 text-sm font-semibold leading-5 text-slate-100">
                        {record.title}
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        className={`h-auto rounded border px-2 py-1 text-[10px] font-semibold shadow-none ${statusClass(
                          state,
                        )}`}
                      >
                        {state}
                      </Badge>
                      {record.criticality ? (
                        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/70 px-2 py-1 text-[10px] font-medium text-slate-300 shadow-none">
                          {record.criticality}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-800 bg-[#0d1219] p-3">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                        Schedule dates
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-200">
                        {recordOccurrences.length === 1 || !lastDate
                          ? formatDate(firstDate)
                          : `${recordOccurrences.length} calls · ${formatDate(
                              firstDate,
                            )} to ${formatDate(lastDate)}`}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {frequencyLabel(record)}
                        {projectedCount > 0
                          ? ` · ${projectedCount} projected from cycle`
                          : ""}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-[#0d1219] p-3">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                        Execution ownership
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-200">
                        {record.assignedEngineer ?? "Engineer not assigned"}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-blue-300">
                        {record.linkedWorkOrderNumber ?? "Work order not generated"}
                      </p>
                    </div>
                  </div>

                  {mode === "calibration" ? (
                    <div className="mt-3 rounded-lg border border-cyan-500/15 bg-cyan-500/[0.04] p-3">
                      <div className="flex items-center gap-2">
                        <CircleDot className="h-3.5 w-3.5 text-cyan-400" />
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/80">
                          Calibration control
                        </p>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-200">
                        {record.calibrationPoint ?? "Calibration point not recorded"}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {record.toleranceSpecification ?? "Tolerance not recorded"}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Result: {record.lastResult ?? "No result imported"} · Certificate:{" "}
                        {record.certificateReference ?? "Not available"}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                      {record.procedureReference ? (
                        <span className="inline-flex items-center gap-1.5">
                          <FileCheck2 className="h-3 w-3" />
                          {record.procedureReference}
                        </span>
                      ) : null}
                      {record.checklistReference ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3" />
                          {record.checklistReference}
                        </span>
                      ) : null}
                    </div>
                    {record.linkedWorkOrderNumber && onOpenWorkOrder ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenWorkOrder(record.linkedWorkOrderNumber as string)
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        Open {record.linkedWorkOrderNumber}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Completed / passed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-red-400 bg-red-500/30" />
          Overdue / failed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-orange-400 bg-orange-500/30" />
          Due soon / adjustment
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-blue-400 bg-transparent" />
          Future planned, outlined
        </span>
        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/60 px-2 py-1 text-[10px] font-medium text-slate-400 shadow-none">
          Number inside = grouped schedule count
        </Badge>
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Select a dot to inspect source schedules
        </span>
      </div>
    </div>
  );
}
