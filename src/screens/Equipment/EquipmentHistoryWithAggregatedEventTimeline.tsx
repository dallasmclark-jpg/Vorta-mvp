import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, CircleDot } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { getEquipmentActivity } from "./equipmentService";
import { EquipmentHistoryWithEventTimeline as EquipmentHistoryBase } from "./EquipmentHistoryWithEventTimeline";

type Range = "all" | "12m" | "6m" | "30d";
type ActivityEvent = Awaited<ReturnType<typeof getEquipmentActivity>>[number];
type Bucket = {
  key: string;
  label: string;
  sublabel: string;
  start: Date;
  end: Date;
};
type Row = {
  label: string;
  color: string;
  events: ActivityEvent[];
};
type Selected = {
  key: string;
  row: Row;
  bucket: Bucket;
  events: ActivityEvent[];
} | null;

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const iso = new Date(`${value}T00:00:00`);
  return Number.isNaN(iso.getTime()) ? null : iso;
};

const normalise = (value: string) => value.trim().toUpperCase();

const rank = (priority: string): number => {
  const value = normalise(priority);
  if (value === "CRITICAL") return 4;
  if (value === "HIGH") return 3;
  if (value === "MEDIUM") return 2;
  return 1;
};

const weak = (outcome: string): boolean =>
  /TEMPORARY|RECUR|PARTIAL|OPEN|FAIL|HOLD/.test(normalise(outcome));

const downtime = (value: string): number =>
  Math.round(
    Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0) * 60 +
      Number(value.match(/(\d+)\s*m/i)?.[1] ?? 0),
  );

const duration = (minutes: number): string => {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

const dateLabel = (value: string): string => {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date)
    : value;
};

function bucketsFor(reference: Date, range: Range): Bucket[] {
  if (range === "30d") {
    return Array.from({ length: 5 }, (_, index) => {
      const start = new Date(reference);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (4 - index) * 7 - 6);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return {
        key: `week-${index}`,
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

  const count = range === "6m" ? 6 : 12;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      reference.getFullYear(),
      reference.getMonth() - count + 1 + index,
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

function AggregatedTimeline({
  equipmentId,
  events,
  loading,
}: {
  equipmentId: string;
  events: ActivityEvent[];
  loading: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("12m");
  const [selected, setSelected] = useState<Selected>(null);

  const reference = useMemo(() => {
    const values = events
      .map((event) => parseDate(event.date)?.getTime() ?? 0)
      .filter(Boolean);
    return values.length ? new Date(Math.max(...values)) : new Date();
  }, [events]);

  const visible = useMemo(() => {
    if (range === "all") return events;
    const cutoff = new Date(reference);
    if (range === "12m") cutoff.setMonth(cutoff.getMonth() - 12);
    if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
    if (range === "30d") cutoff.setDate(cutoff.getDate() - 30);
    return events.filter(
      (event) =>
        (parseDate(event.date)?.getTime() ?? 0) >= cutoff.getTime(),
    );
  }, [events, range, reference]);

  const buckets = useMemo(
    () => bucketsFor(reference, range),
    [range, reference],
  );

  const rows = useMemo<Row[]>(
    () => [
      {
        label: "Preventive",
        color: "#10b981",
        events: visible.filter((event) =>
          normalise(event.type).includes("PREVENTIVE"),
        ),
      },
      {
        label: "Corrective",
        color: "#f59e0b",
        events: visible.filter((event) => {
          const type = normalise(event.type);
          return type.includes("CORRECTIVE") && !type.includes("BREAKDOWN");
        }),
      },
      {
        label: "Inspections",
        color: "#3b82f6",
        events: visible.filter((event) =>
          /INSPECTION|CALIBRATION/.test(normalise(event.type)),
        ),
      },
      {
        label: "Parts replaced",
        color: "#06b6d4",
        events: visible.filter(
          (event) =>
            /PART/.test(normalise(event.type)) ||
            /replaced|replacement/i.test(event.description),
        ),
      },
      {
        label: "Breakdowns",
        color: "#ef4444",
        events: visible.filter((event) =>
          normalise(event.type).includes("BREAKDOWN"),
        ),
      },
      {
        label: "Major events",
        color: "#8b5cf6",
        events: visible.filter((event) => rank(event.priority) >= 3),
      },
    ],
    [visible],
  );

  const openWorkOrder = (workOrderNumber: string) =>
    navigate(
      `/equipment/${equipmentId}/work-orders?workOrder=${encodeURIComponent(
        workOrderNumber,
      )}#work-order-register`,
    );

  const selectGroup = (
    row: Row,
    bucket: Bucket,
    grouped: ActivityEvent[],
  ) => {
    const sorted = [...grouped].sort(
      (left, right) =>
        rank(right.priority) - rank(left.priority) ||
        (parseDate(right.date)?.getTime() ?? 0) -
          (parseDate(left.date)?.getTime() ?? 0),
    );
    const key = `${row.label}-${bucket.key}`;
    setSelected((current) =>
      current?.key === key ? null : { key, row, bucket, events: sorted },
    );
  };

  const width = 1180;
  const height = 338;
  const left = 154;
  const right = 28;
  const plotTop = 38;
  const rowGap = 46;
  const plotBottom = plotTop + (rows.length - 1) * rowGap;
  const axisLabelY = plotBottom + 42;
  const axisSublabelY = plotBottom + 58;
  const xForBucket = (index: number) =>
    left +
    index * ((width - left - right) / Math.max(1, buckets.length - 1));
  const yForRow = (index: number) => plotTop + index * rowGap;

  return (
    <div data-vorta-aggregated-timeline="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-violet-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Maintenance Event Timeline
            </h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            One aligned dot represents each maintenance type in each period. The
            number inside is the grouped event count.
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
          {(["all", "12m", "6m", "30d"] as Range[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRange(value);
                setSelected(null);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === value
                  ? "bg-violet-600 text-white"
                  : "text-slate-500 hover:text-slate-300"
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
          className="min-w-[820px] w-full"
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
                  y1="16"
                  y2={plotBottom + 21}
                  stroke="#ffffff0a"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={axisLabelY}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="10"
                >
                  {bucket.label}
                </text>
                <text
                  x={x}
                  y={axisSublabelY}
                  textAnchor="middle"
                  fill="#3f4a5d"
                  fontSize="9"
                >
                  {bucket.sublabel}
                </text>
              </g>
            );
          })}

          {rows.map((row, rowIndex) => {
            const y = yForRow(rowIndex);
            return (
              <g key={row.label}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="#ffffff0d"
                  strokeWidth="1"
                />
                <circle cx="14" cy={y} r="4" fill={row.color} />
                <text
                  x="26"
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="600"
                >
                  {row.label}
                </text>

                {buckets.map((bucket, bucketIndex) => {
                  const grouped = row.events.filter((event) => {
                    const date = parseDate(event.date);
                    return date
                      ? date >= bucket.start && date <= bucket.end
                      : false;
                  });
                  if (!grouped.length) return null;

                  const high = grouped.some(
                    (event) => rank(event.priority) >= 3,
                  );
                  const weakOutcome = grouped.some((event) =>
                    weak(event.outcome),
                  );
                  const minutes = grouped.reduce(
                    (sum, event) => sum + downtime(event.downtime),
                    0,
                  );
                  const radius =
                    grouped.length >= 10 ? 16 : grouped.length >= 5 ? 15 : 14;
                  const x = xForBucket(bucketIndex);
                  const groupKey = `${row.label}-${bucket.key}`;
                  const isSelected = selected?.key === groupKey;
                  const title = `${grouped.length} ${row.label.toLowerCase()} event${
                    grouped.length === 1 ? "" : "s"
                  } · ${bucket.label} ${bucket.sublabel} · ${duration(
                    minutes,
                  )} downtime`;

                  return (
                    <g
                      key={groupKey}
                      role="button"
                      tabIndex={0}
                      aria-label={title}
                      onClick={() => selectGroup(row, bucket, grouped)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectGroup(row, bucket, grouped);
                        }
                      }}
                      className="cursor-pointer outline-none"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={radius + 5}
                        fill="transparent"
                      />
                      {high ? (
                        <circle
                          cx={x}
                          cy={y}
                          r={radius + 4}
                          fill="none"
                          stroke={row.color}
                          strokeWidth="2"
                          opacity="0.4"
                          pointerEvents="none"
                        />
                      ) : null}
                      {isSelected ? (
                        <circle
                          cx={x}
                          cy={y}
                          r={radius + 7}
                          fill="none"
                          stroke="#f8fafc"
                          strokeWidth="1.5"
                          opacity="0.9"
                          pointerEvents="none"
                        />
                      ) : null}
                      <circle
                        cx={x}
                        cy={y}
                        r={radius}
                        fill={row.color}
                        stroke="#0b1017"
                        strokeWidth="2.5"
                        opacity={weakOutcome ? 1 : 0.84}
                        pointerEvents="none"
                      >
                        <title>{title}</title>
                      </circle>
                      <text
                        x={x}
                        y={y + 4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={grouped.length >= 100 ? "9" : "11"}
                        fontWeight="700"
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

          {!loading && !visible.length ? (
            <text
              x="650"
              y={height / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="12"
            >
              No maintenance work events in the selected period
            </text>
          ) : null}
        </svg>
      </div>

      {selected ? (
        <div className="mt-3 rounded-xl border border-gray-800 bg-[#0b1017]/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-bold text-white ring-2 ring-[#141820]"
                style={{ backgroundColor: selected.row.color }}
              >
                {selected.events.length}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {selected.row.label} · {selected.bucket.label}{" "}
                  {selected.bucket.sublabel}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {duration(
                    selected.events.reduce(
                      (sum, event) => sum + downtime(event.downtime),
                      0,
                    ),
                  )}{" "}
                  total downtime ·{" "}
                  {
                    selected.events.filter(
                      (event) => rank(event.priority) >= 3,
                    ).length
                  }{" "}
                  high or critical
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

          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {selected.events.map((event) => (
              <button
                key={`${event.woNumber}-${event.date}-${event.description}`}
                type="button"
                onClick={() => openWorkOrder(event.woNumber)}
                className="rounded-lg border border-gray-800 bg-[#0a0f16] p-3 text-left hover:border-violet-500/40 hover:bg-violet-500/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-violet-300">
                    {event.woNumber}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {event.priority}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">
                  {event.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <span>{dateLabel(event.date)}</span>
                  <span>{event.downtime || "0 min"} downtime</span>
                  <span>{event.outcome}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
        {rows.map((row) => (
          <span key={row.label} className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full ring-2 ring-[#141820]"
              style={{ backgroundColor: row.color }}
            />
            {row.label} ({row.events.length})
          </span>
        ))}
        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/60 px-2 py-1 text-[10px] font-medium text-slate-400 shadow-none">
          Number inside = grouped event count
        </Badge>
        <Badge className="h-auto rounded border border-gray-700 bg-gray-800/60 px-2 py-1 text-[10px] font-medium text-slate-400 shadow-none">
          Outer ring = high or critical included
        </Badge>
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Every dot opens its work-order list
        </span>
      </div>
    </div>
  );
}

export const EquipmentHistoryWithAggregatedEventTimeline = (): JSX.Element => {
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getEquipmentActivity(resolvedId)
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch((error) => {
        console.warn("Aggregated history timeline could not load:", error);
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [resolvedId]);

  useEffect(() => {
    const hidden = new Map<HTMLElement, string>();
    let timeline: HTMLElement | null = null;
    let innerObserver: MutationObserver | null = null;

    const hideOriginal = () => {
      if (!timeline) return;
      Array.from(timeline.children).forEach((child) => {
        if (
          !(child instanceof HTMLElement) ||
          child.dataset.vortaAggregatedTimeline === "true"
        ) {
          return;
        }
        if (!hidden.has(child)) hidden.set(child, child.style.display);
        child.style.display = "none";
      });
    };

    const locate = () => {
      if (timeline) return;
      const found = document.querySelector<HTMLElement>(
        '[data-vorta-event-timeline="true"]',
      );
      if (!found) return;
      timeline = found;
      hideOriginal();
      setTarget(found);
      innerObserver = new MutationObserver(hideOriginal);
      innerObserver.observe(found, { childList: true });
    };

    locate();
    const pageObserver = new MutationObserver(locate);
    pageObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      pageObserver.disconnect();
      innerObserver?.disconnect();
      hidden.forEach((display, child) => {
        child.style.display = display;
      });
      setTarget(null);
    };
  }, []);

  return (
    <>
      <EquipmentHistoryBase />
      {target
        ? createPortal(
            <AggregatedTimeline
              equipmentId={resolvedId}
              events={events}
              loading={loading}
            />,
            target,
          )
        : null}
    </>
  );
};
