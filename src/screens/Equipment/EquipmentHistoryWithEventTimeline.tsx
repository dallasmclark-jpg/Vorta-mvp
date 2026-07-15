import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, CircleDot, History } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { getEquipmentActivity } from "./equipmentService";
import { EquipmentHistory as EquipmentHistoryBase } from "./EquipmentHistory";

type HistoryRange = "all" | "12m" | "6m" | "30d";
type ActivityEvent = Awaited<ReturnType<typeof getEquipmentActivity>>[number];

interface TimelineBucket {
  key: string;
  label: string;
  sublabel: string;
  start: Date;
  end: Date;
}

interface TimelineRow {
  label: string;
  color: string;
  events: ActivityEvent[];
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const iso = new Date(`${value}T00:00:00`);
  return Number.isNaN(iso.getTime()) ? null : iso;
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
  const value = normalise(outcome);
  return (
    value.includes("TEMPORARY") ||
    value.includes("RECUR") ||
    value.includes("PARTIAL") ||
    value.includes("OPEN") ||
    value.includes("FAIL") ||
    value.includes("HOLD")
  );
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildBuckets(referenceDate: Date, range: HistoryRange): TimelineBucket[] {
  if (range === "30d") {
    return Array.from({ length: 5 }, (_, index) => {
      const start = new Date(referenceDate);
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
      referenceDate.getFullYear(),
      referenceDate.getMonth() - (count - 1) + index,
      1,
    );
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      key: monthKey(date),
      label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date),
      sublabel: String(date.getFullYear()).slice(-2),
      start,
      end,
    };
  });
}

function EventDotTimeline({
  equipmentId,
  events,
  loading,
}: {
  equipmentId: string;
  events: ActivityEvent[];
  loading: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  const [range, setRange] = useState<HistoryRange>("12m");

  const referenceDate = useMemo(() => {
    const dates = events
      .map((event) => parseDate(event.date))
      .filter((date): date is Date => Boolean(date));
    return dates.length > 0
      ? new Date(Math.max(...dates.map((date) => date.getTime())))
      : new Date();
  }, [events]);

  const rangedEvents = useMemo(() => {
    if (range === "all") return events;
    const cutoff = new Date(referenceDate);
    if (range === "12m") cutoff.setMonth(cutoff.getMonth() - 12);
    if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
    if (range === "30d") cutoff.setDate(cutoff.getDate() - 30);
    return events.filter((event) => {
      const date = parseDate(event.date);
      return date ? date >= cutoff : false;
    });
  }, [events, range, referenceDate]);

  const buckets = useMemo(
    () => buildBuckets(referenceDate, range),
    [range, referenceDate],
  );

  const rows = useMemo<TimelineRow[]>(() => {
    const preventive = rangedEvents.filter((event) =>
      normalise(event.type).includes("PREVENTIVE"),
    );
    const corrective = rangedEvents.filter((event) => {
      const type = normalise(event.type);
      return type.includes("CORRECTIVE") && !type.includes("BREAKDOWN");
    });
    const inspections = rangedEvents.filter((event) => {
      const type = normalise(event.type);
      return type.includes("INSPECTION") || type.includes("CALIBRATION");
    });
    const parts = rangedEvents.filter((event) => {
      const type = normalise(event.type);
      const description = event.description.toLowerCase();
      return (
        type.includes("PART") ||
        description.includes("replaced") ||
        description.includes("replacement")
      );
    });
    const breakdowns = rangedEvents.filter((event) =>
      normalise(event.type).includes("BREAKDOWN"),
    );
    const major = rangedEvents.filter(
      (event) => priorityRank(event.priority) >= 3,
    );

    return [
      { label: "Preventive", color: "#10b981", events: preventive },
      { label: "Corrective", color: "#f59e0b", events: corrective },
      { label: "Inspections", color: "#3b82f6", events: inspections },
      { label: "Parts replaced", color: "#06b6d4", events: parts },
      { label: "Breakdowns", color: "#ef4444", events: breakdowns },
      { label: "Major events", color: "#8b5cf6", events: major },
    ];
  }, [rangedEvents]);

  const openWorkOrder = (workOrderNumber: string) => {
    navigate(
      `/equipment/${equipmentId}/work-orders?workOrder=${encodeURIComponent(
        workOrderNumber,
      )}#work-order-register`,
    );
  };

  const width = 1180;
  const left = 154;
  const right = 28;
  const chartWidth = width - left - right;
  const xForBucket = (index: number) =>
    left + index * (chartWidth / Math.max(1, buckets.length - 1));

  return (
    <div data-vorta-event-timeline="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-violet-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Maintenance Event Timeline
            </h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Each dot is a recorded work event, grouped by maintenance type across the selected history period.
          </p>
        </div>

        <div className="flex rounded-lg border border-gray-700 bg-[#0b0e14] p-1">
          {([
            ["All", "all"],
            ["12M", "12m"],
            ["6M", "6m"],
            ["30D", "30d"],
          ] as const).map(([label, value]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === value
                  ? "bg-violet-600 text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-800 bg-[#0b1017]/70 p-3">
        <svg
          viewBox={`0 0 ${width} 250`}
          className="min-w-[820px] w-full"
          role="img"
          aria-label="Maintenance work-event dot timeline"
        >
          {buckets.map((bucket, index) => {
            const x = xForBucket(index);
            return (
              <g key={bucket.key}>
                <line
                  x1={x}
                  x2={x}
                  y1="16"
                  y2="198"
                  stroke="#ffffff0a"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y="220"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="10"
                >
                  {bucket.label}
                </text>
                <text
                  x={x}
                  y="235"
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
            const y = 28 + rowIndex * 31;
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

                {buckets.flatMap((bucket, bucketIndex) => {
                  const bucketEvents = row.events.filter((event) => {
                    const date = parseDate(event.date);
                    return date ? date >= bucket.start && date <= bucket.end : false;
                  });

                  return bucketEvents.map((event, eventIndex) => {
                    const centreX = xForBucket(bucketIndex);
                    const offset =
                      (eventIndex - (bucketEvents.length - 1) / 2) * 11;
                    const severity = priorityRank(event.priority);
                    const radius = severity >= 4 ? 6 : severity >= 3 ? 5 : 4;
                    return (
                      <g
                        key={`${row.label}-${event.woNumber}-${bucket.key}-${eventIndex}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openWorkOrder(event.woNumber)}
                        onKeyDown={(keyboardEvent) => {
                          if (
                            keyboardEvent.key === "Enter" ||
                            keyboardEvent.key === " "
                          ) {
                            openWorkOrder(event.woNumber);
                          }
                        }}
                        className="cursor-pointer outline-none"
                      >
                        {severity >= 3 ? (
                          <circle
                            cx={centreX + offset}
                            cy={y}
                            r={radius + 3}
                            fill="none"
                            stroke={row.color}
                            strokeWidth="1.5"
                            opacity="0.28"
                          />
                        ) : null}
                        <circle
                          cx={centreX + offset}
                          cy={y}
                          r={radius}
                          fill={row.color}
                          stroke="#0b1017"
                          strokeWidth="2"
                          opacity={isWeakOutcome(event.outcome) ? 1 : 0.78}
                        >
                          <title>{`${formatDate(event.date)} · ${event.woNumber} · ${event.description} · ${event.outcome}`}</title>
                        </circle>
                      </g>
                    );
                  });
                })}
              </g>
            );
          })}

          {!loading && rangedEvents.length === 0 ? (
            <text
              x="650"
              y="112"
              textAnchor="middle"
              fill="#64748b"
              fontSize="12"
            >
              No maintenance work events in the selected period
            </text>
          ) : null}
        </svg>
      </div>

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
          Outlined dots are high or critical
        </Badge>
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Click a dot to open its work order
        </span>
      </div>
    </div>
  );
}

export const EquipmentHistoryWithEventTimeline = (): JSX.Element => {
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getEquipmentActivity(resolvedId)
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch((error) => {
        console.warn("History event timeline could not load:", error);
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
    const hiddenChildren = new Map<HTMLElement, string>();
    let targetObserver: MutationObserver | null = null;
    let target: HTMLElement | null = null;

    const concealOriginalChart = () => {
      if (!target) return;
      Array.from(target.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        if (child.dataset.vortaEventTimeline === "true") return;
        if (!hiddenChildren.has(child)) {
          hiddenChildren.set(child, child.style.display);
        }
        child.style.display = "none";
      });
    };

    const locateChart = () => {
      if (target) return;
      const heading = Array.from(
        document.querySelectorAll<HTMLHeadingElement>("h2"),
      ).find(
        (element) =>
          element.textContent?.trim() === "Maintenance and Risk Timeline",
      );
      const cardContent = heading?.closest("div.p-5");
      if (!(cardContent instanceof HTMLElement)) return;
      target = cardContent;
      concealOriginalChart();
      setMountTarget(cardContent);
      targetObserver = new MutationObserver(concealOriginalChart);
      targetObserver.observe(cardContent, { childList: true });
    };

    locateChart();
    const pageObserver = new MutationObserver(locateChart);
    pageObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      pageObserver.disconnect();
      targetObserver?.disconnect();
      hiddenChildren.forEach((display, child) => {
        child.style.display = display;
      });
      setMountTarget(null);
    };
  }, []);

  return (
    <>
      <EquipmentHistoryBase />
      {mountTarget
        ? createPortal(
            <EventDotTimeline
              equipmentId={resolvedId}
              events={events}
              loading={loading}
            />,
            mountTarget,
          )
        : null}
    </>
  );
};
