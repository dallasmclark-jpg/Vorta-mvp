import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, CircleDot } from "lucide-react";
import { Badge } from "../../components/ui/badge";

type HistoryRange = "all" | "12m" | "6m" | "30d";

interface TimelineHistoryRow {
  date: string;
  woNumber: string;
  type: string;
  priority: string;
  description: string;
  downtime: string;
  outcome: string;
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
  color: string;
  events: TimelineHistoryRow[];
}

interface SelectedGroup {
  key: string;
  category: TimelineCategory;
  bucket: TimelineBucket;
  events: TimelineHistoryRow[];
}

interface EquipmentHistoryTimelineProps {
  equipmentId: string;
  rows: TimelineHistoryRow[];
  range: HistoryRange;
  onRangeChange: (range: HistoryRange) => void;
  loading: boolean;
  onOpenWorkOrder: (workOrderNumber: string) => void;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const iso = new Date(`${value}T00:00:00`);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function normalise(value: string): string {
  return value.trim().toUpperCase();
}

function priorityRank(priority: string): number {
  switch (normalise(priority)) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}

function isWeakOutcome(outcome: string): boolean {
  return /TEMPORARY|RECUR|PARTIAL|OPEN|FAIL|HOLD/.test(normalise(outcome));
}

function parseDowntimeMinutes(value: string): number {
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+)\s*m/i)?.[1] ?? 0);
  return Math.round(hours * 60 + minutes);
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function formatDate(value: string): string {
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function monthDifference(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth()
  );
}

function buildBuckets(
  referenceDate: Date,
  earliestDate: Date,
  range: HistoryRange,
): TimelineBucket[] {
  if (range === "30d") {
    return Array.from({ length: 5 }, (_, index) => {
      const start = new Date(referenceDate);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (4 - index) * 7 - 6);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return {
        key: `week-${start.toISOString()}`,
        label: new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
        }).format(end),
        sublabel: "week ending",
        start,
        end,
      };
    });
  }

  if (range === "all") {
    const totalMonths = monthDifference(earliestDate, referenceDate) + 1;

    if (totalMonths > 24) {
      const firstYear = earliestDate.getFullYear();
      const lastYear = referenceDate.getFullYear();
      return Array.from(
        { length: lastYear - firstYear + 1 },
        (_, index) => {
          const year = firstYear + index;
          return {
            key: `year-${year}`,
            label: String(year),
            sublabel: "year",
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31, 23, 59, 59, 999),
          };
        },
      );
    }

    return Array.from({ length: Math.max(1, totalMonths) }, (_, index) => {
      const date = new Date(
        earliestDate.getFullYear(),
        earliestDate.getMonth() + index,
        1,
      );
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(
          date,
        ),
        sublabel: String(date.getFullYear()).slice(-2),
        start: new Date(date.getFullYear(), date.getMonth(), 1),
        end: new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      };
    });
  }

  const count = range === "6m" ? 6 : 12;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - count + 1 + index,
      1,
    );
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
      sublabel: String(date.getFullYear()).slice(-2),
      start: new Date(date.getFullYear(), date.getMonth(), 1),
      end: new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    };
  });
}

function isPartReplacement(row: TimelineHistoryRow): boolean {
  return (
    normalise(row.type).includes("PART") ||
    /replaced|replacement/i.test(row.description)
  );
}

export function EquipmentHistoryTimeline({
  equipmentId,
  rows,
  range,
  onRangeChange,
  loading,
  onOpenWorkOrder,
}: EquipmentHistoryTimelineProps): JSX.Element {
  const [selected, setSelected] = useState<SelectedGroup | null>(null);
  const selectedPanelRef = useRef<HTMLDivElement | null>(null);

  const validDates = useMemo(
    () =>
      rows
        .map((row) => parseDate(row.date))
        .filter((date): date is Date => Boolean(date)),
    [rows],
  );

  const referenceDate = useMemo(
    () =>
      validDates.length > 0
        ? new Date(Math.max(...validDates.map((date) => date.getTime())))
        : new Date(),
    [validDates],
  );

  const earliestDate = useMemo(
    () =>
      validDates.length > 0
        ? new Date(Math.min(...validDates.map((date) => date.getTime())))
        : referenceDate,
    [referenceDate, validDates],
  );

  const visibleRows = useMemo(() => {
    if (range === "all") return rows;
    const cutoff = new Date(referenceDate);
    if (range === "12m") cutoff.setMonth(cutoff.getMonth() - 12);
    if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
    if (range === "30d") cutoff.setDate(cutoff.getDate() - 30);
    return rows.filter((row) => {
      const date = parseDate(row.date);
      return date ? date >= cutoff : false;
    });
  }, [range, referenceDate, rows]);

  const buckets = useMemo(
    () => buildBuckets(referenceDate, earliestDate, range),
    [earliestDate, range, referenceDate],
  );

  const categories = useMemo<TimelineCategory[]>(() => {
    const preventive: TimelineHistoryRow[] = [];
    const corrective: TimelineHistoryRow[] = [];
    const inspection: TimelineHistoryRow[] = [];
    const breakdown: TimelineHistoryRow[] = [];

    visibleRows.forEach((row) => {
      const type = normalise(row.type);
      if (type.includes("BREAKDOWN")) {
        breakdown.push(row);
      } else if (type.includes("PREVENTIVE")) {
        preventive.push(row);
      } else if (type.includes("INSPECTION") || type.includes("CALIBRATION")) {
        inspection.push(row);
      } else if (type.includes("CORRECTIVE")) {
        corrective.push(row);
      }
    });

    return [
      { label: "Preventive", color: "#10b981", events: preventive },
      { label: "Corrective", color: "#f59e0b", events: corrective },
      { label: "Inspection / calibration", color: "#3b82f6", events: inspection },
      { label: "Breakdown", color: "#ef4444", events: breakdown },
    ];
  }, [visibleRows]);

  useEffect(() => {
    setSelected(null);
  }, [range]);

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

  const selectGroup = (
    category: TimelineCategory,
    bucket: TimelineBucket,
    groupedEvents: TimelineHistoryRow[],
  ) => {
    const sortedEvents = [...groupedEvents].sort(
      (left, right) =>
        priorityRank(right.priority) - priorityRank(left.priority) ||
        (parseDate(right.date)?.getTime() ?? 0) -
          (parseDate(left.date)?.getTime() ?? 0),
    );
    const key = `${category.label}-${bucket.key}`;
    setSelected((current) =>
      current?.key === key
        ? null
        : { key, category, bucket, events: sortedEvents },
    );
  };

  const width = Math.max(980, 190 + buckets.length * 88);
  const height = 286;
  const left = 178;
  const right = 34;
  const plotTop = 42;
  const rowGap = 52;
  const plotBottom = plotTop + (categories.length - 1) * rowGap;
  const labelY = plotBottom + 48;
  const sublabelY = plotBottom + 65;
  const xForBucket = (index: number) =>
    left +
    index * ((width - left - right) / Math.max(1, buckets.length - 1));
  const yForCategory = (index: number) => plotTop + index * rowGap;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-violet-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Maintenance Event Timeline
            </h2>
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-400">
            One aligned dot represents each maintenance type in each period. The
            number inside is the grouped work-event count.
          </p>
        </div>

        <div className="flex rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
          {(["all", "12m", "6m", "30d"] as HistoryRange[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onRangeChange(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === value
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {value === "all" ? "All" : value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-800 bg-[#0b1017]/70 p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[840px] w-full"
          role="img"
          aria-label="Aggregated maintenance work-event timeline"
        >
          {buckets.map((bucket, index) => {
            const x = xForBucket(index);
            return (
              <g key={bucket.key}>
                <line
                  x1={x}
                  x2={x}
                  y1="18"
                  y2={plotBottom + 22}
                  stroke="#ffffff0a"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={labelY}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="12"
                  fontWeight="600"
                >
                  {bucket.label}
                </text>
                <text
                  x={x}
                  y={sublabelY}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="11"
                >
                  {bucket.sublabel}
                </text>
              </g>
            );
          })}

          {categories.map((category, categoryIndex) => {
            const y = yForCategory(categoryIndex);
            return (
              <g key={category.label}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="#ffffff12"
                  strokeWidth="1"
                />
                <circle cx="15" cy={y} r="5" fill={category.color} />
                <text
                  x="29"
                  y={y + 4}
                  fill="#cbd5e1"
                  fontSize="12"
                  fontWeight="600"
                >
                  {category.label}
                </text>

                {buckets.map((bucket, bucketIndex) => {
                  const groupedEvents = category.events.filter((event) => {
                    const date = parseDate(event.date);
                    return date
                      ? date >= bucket.start && date <= bucket.end
                      : false;
                  });
                  if (groupedEvents.length === 0) return null;

                  const includesHighPriority = groupedEvents.some(
                    (event) => priorityRank(event.priority) >= 3,
                  );
                  const includesWeakOutcome = groupedEvents.some((event) =>
                    isWeakOutcome(event.outcome),
                  );
                  const totalDowntime = groupedEvents.reduce(
                    (sum, event) => sum + parseDowntimeMinutes(event.downtime),
                    0,
                  );
                  const radius =
                    groupedEvents.length >= 10
                      ? 17
                      : groupedEvents.length >= 5
                        ? 16
                        : 15;
                  const x = xForBucket(bucketIndex);
                  const groupKey = `${category.label}-${bucket.key}`;
                  const isSelected = selected?.key === groupKey;
                  const title = `${groupedEvents.length} ${category.label.toLowerCase()} event${
                    groupedEvents.length === 1 ? "" : "s"
                  } · ${bucket.label} ${bucket.sublabel} · ${formatDuration(
                    totalDowntime,
                  )} downtime`;

                  return (
                    <g
                      key={groupKey}
                      role="button"
                      tabIndex={0}
                      aria-label={title}
                      onClick={() =>
                        selectGroup(category, bucket, groupedEvents)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectGroup(category, bucket, groupedEvents);
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
                      {includesHighPriority ? (
                        <circle
                          cx={x}
                          cy={y}
                          r={radius + 4}
                          fill="none"
                          stroke={category.color}
                          strokeWidth="2"
                          opacity="0.5"
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
                        fill={category.color}
                        stroke="#0b1017"
                        strokeWidth="2.5"
                        opacity={includesWeakOutcome ? 1 : 0.88}
                        pointerEvents="none"
                      >
                        <title>{title}</title>
                      </circle>
                      <text
                        x={x}
                        y={y + 4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={groupedEvents.length >= 100 ? "9" : "11"}
                        fontWeight="700"
                        pointerEvents="none"
                      >
                        {groupedEvents.length}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {!loading && visibleRows.length === 0 ? (
            <text
              x={width / 2}
              y={height / 2}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="12"
            >
              No maintenance work events in the selected period
            </text>
          ) : null}
        </svg>
      </div>

      {selected ? (
        <div
          ref={selectedPanelRef}
          className="mt-3 rounded-xl border border-gray-700 bg-[#0b1017]/95 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-bold text-white ring-2 ring-[#141820]"
                style={{ backgroundColor: selected.category.color }}
              >
                {selected.events.length}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {selected.category.label} · {selected.bucket.label}{" "}
                  {selected.bucket.sublabel}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDuration(
                    selected.events.reduce(
                      (sum, event) =>
                        sum + parseDowntimeMinutes(event.downtime),
                      0,
                    ),
                  )}{" "}
                  total downtime ·{" "}
                  {
                    selected.events.filter(
                      (event) => priorityRank(event.priority) >= 3,
                    ).length
                  }{" "}
                  high or critical
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-gray-800 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {selected.events.map((event) => (
              <button
                key={`${event.woNumber}-${event.date}-${event.description}`}
                type="button"
                onClick={() => onOpenWorkOrder(event.woNumber)}
                className="rounded-lg border border-gray-800 bg-[#0a0f16] p-3 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-violet-300">
                    {event.woNumber}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {event.priority}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-200">
                  {event.description}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span>{formatDate(event.date)}</span>
                  <span>{event.downtime || "0 min"} downtime</span>
                  <span>{event.outcome}</span>
                  {isPartReplacement(event) ? (
                    <Badge className="h-auto rounded border border-cyan-500/20 bg-cyan-500/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-cyan-300 shadow-none">
                      Part replaced
                    </Badge>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
        {categories.map((category) => (
          <span key={category.label} className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full ring-2 ring-[#141820]"
              style={{ backgroundColor: category.color }}
            />
            {category.label} ({category.events.length})
          </span>
        ))}
        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/60 px-2 py-1 text-[10px] font-medium text-slate-300 shadow-none">
          Number = grouped work events
        </Badge>
        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/60 px-2 py-1 text-[10px] font-medium text-slate-300 shadow-none">
          Outer ring = high or critical included
        </Badge>
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Select a dot to inspect its work orders
        </span>
      </div>

      <span className="sr-only">Equipment reference {equipmentId}</span>
    </div>
  );
}
