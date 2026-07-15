import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "./ui/card";

export type ShiftType =
  | "day"
  | "night"
  | "off"
  | "training"
  | "unavailable"
  | "overtime"
  | "restricted"
  | "assigned"
  | "booking"
  | "cert-renewal";

export interface ShiftEvent {
  date: string;
  type: ShiftType;
  label?: string;
  time?: string;
  warn?: boolean;
}

export interface ShiftCalendarProps {
  title?: string;
  initialMonth?: Date;
  events: ShiftEvent[];
  role?: "operator" | "engineer" | "contractor" | "production";
  onSelectDate?: (date: string) => void;
}

type CalendarView = "week" | "month";
type FilterValue = "all" | ShiftType;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const SHIFT_CONFIG: Record<
  ShiftType,
  { bg: string; border: string; text: string; dot: string; label: string; group: "schedule" | "risk" }
> = {
  day: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    dot: "bg-emerald-500",
    label: "Day Shift",
    group: "schedule",
  },
  night: {
    bg: "bg-indigo-500/20",
    border: "border-indigo-500/30",
    text: "text-indigo-300",
    dot: "bg-indigo-400",
    label: "Night Shift",
    group: "schedule",
  },
  off: {
    bg: "bg-slate-800/30",
    border: "border-slate-800",
    text: "text-slate-600",
    dot: "bg-slate-700",
    label: "Off Shift",
    group: "schedule",
  },
  training: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-400",
    label: "Training",
    group: "risk",
  },
  unavailable: {
    bg: "bg-red-500/20",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-500",
    label: "Unavailable",
    group: "risk",
  },
  overtime: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
    text: "text-blue-400",
    dot: "bg-blue-400",
    label: "Overtime / Cover",
    group: "schedule",
  },
  restricted: {
    bg: "bg-orange-500/20",
    border: "border-orange-500/30",
    text: "text-orange-400",
    dot: "bg-orange-400",
    label: "Restricted",
    group: "risk",
  },
  assigned: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/30",
    text: "text-blue-400",
    dot: "bg-blue-400",
    label: "Assigned",
    group: "schedule",
  },
  booking: {
    bg: "bg-cyan-500/20",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    dot: "bg-cyan-400",
    label: "Booking",
    group: "risk",
  },
  "cert-renewal": {
    bg: "bg-purple-500/20",
    border: "border-purple-500/30",
    text: "text-purple-400",
    dot: "bg-purple-400",
    label: "Certification Renewal",
    group: "risk",
  },
};

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "day", label: "Day" },
  { value: "night", label: "Night" },
  { value: "training", label: "Training" },
  { value: "unavailable", label: "Unavailable" },
  { value: "overtime", label: "Cover" },
  { value: "restricted", label: "Restricted" },
];

const STATUS_LEGEND: ShiftType[] = ["day", "night", "training", "unavailable", "overtime"];

function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatWeekLabel(date: Date): string {
  return `Week of ${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function accentClasses(role: ShiftCalendarProps["role"]): {
  active: string;
  ring: string;
  badge: string;
} {
  if (role === "operator") {
    return {
      active: "bg-emerald-600 text-white",
      ring: "ring-emerald-500/40",
      badge: "bg-emerald-500/20 text-emerald-400",
    };
  }
  if (role === "contractor") {
    return {
      active: "bg-amber-600 text-white",
      ring: "ring-amber-500/40",
      badge: "bg-amber-500/20 text-amber-400",
    };
  }
  return {
    active: "bg-blue-600 text-white",
    ring: "ring-blue-500/40",
    badge: "bg-blue-500/20 text-blue-400",
  };
}

function EventCell({
  events,
  group,
  date,
  isToday,
  selected,
  onSelect,
}: {
  events: ShiftEvent[];
  group: "schedule" | "risk";
  date: Date;
  isToday: boolean;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const matching = events.filter((event) => SHIFT_CONFIG[event.type].group === group);

  if (matching.length === 0) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`flex h-[48px] w-full items-center justify-center rounded border border-transparent transition-colors hover:bg-white/[0.03] ${
          selected ? "bg-blue-500/[0.06]" : ""
        }`}
        aria-label={`No ${group === "schedule" ? "shift" : "risk"} items on ${date.toLocaleDateString("en-GB")}`}
      >
        <span className="text-[10px] text-slate-700">OFF</span>
      </button>
    );
  }

  const primary = matching[0];
  const config = SHIFT_CONFIG[primary.type];
  const hasWarning = matching.some((event) => event.warn);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex h-[48px] w-full flex-col items-start justify-center gap-0.5 overflow-hidden rounded border px-2 py-1 text-left transition-opacity hover:opacity-80 ${config.bg} ${config.border} ${
        selected ? "ring-1 ring-blue-400/60" : ""
      } ${isToday ? "shadow-[inset_0_0_0_1px_rgba(96,165,250,0.28)]" : ""}`}
    >
      <span className={`text-[9px] font-semibold uppercase leading-none opacity-70 ${config.text}`}>
        {group === "schedule" ? "SHIFT" : "ACTION"}
      </span>
      <span className={`max-w-full truncate text-[10px] font-semibold leading-tight ${config.text}`}>
        {primary.label ?? config.label}
      </span>
      {primary.time && (
        <span className={`text-[9px] leading-none opacity-70 ${config.text}`}>{primary.time}</span>
      )}
      {matching.length > 1 && (
        <span className={`absolute bottom-1 right-1 text-[9px] font-semibold ${config.text}`}>
          +{matching.length - 1}
        </span>
      )}
      {hasWarning && (
        <AlertTriangle className="absolute right-1 top-1 h-2.5 w-2.5 text-orange-300" aria-label="Warning" />
      )}
    </button>
  );
}

export function ShiftCalendar({
  title = "Operational Workforce Calendar",
  initialMonth,
  events,
  role = "engineer",
  onSelectDate,
}: ShiftCalendarProps): JSX.Element {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => initialMonth ?? today);
  const [view, setView] = useState<CalendarView>("week");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const accent = accentClasses(role);

  const filteredEvents = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.type === filter)),
    [events, filter],
  );

  const eventMap = useMemo(() => {
    const map = new Map<string, ShiftEvent[]>();
    for (const event of filteredEvents) {
      const current = map.get(event.date) ?? [];
      current.push(event);
      map.set(event.date, current);
    }
    return map;
  }, [filteredEvents]);

  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const periodLabel =
    view === "week"
      ? formatWeekLabel(weekStart)
      : cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const selectDate = (date: Date) => {
    const ymd = toYmd(date);
    setSelected(ymd);
    onSelectDate?.(ymd);
  };

  const goPrevious = () => {
    setCursor((current) => (view === "week" ? addDays(current, -7) : addMonths(current, -1)));
  };

  const goNext = () => {
    setCursor((current) => (view === "week" ? addDays(current, 7) : addMonths(current, 1)));
  };

  const goToday = () => {
    setCursor(new Date(today));
    setSelected(toYmd(today));
  };

  const monthCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const leading = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  return (
    <Card className="w-full rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-5">
        <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${accent.badge}`}>
                WORKFORCE LOOKAHEAD
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === item.value
                      ? accent.active
                      : "bg-white/10 text-slate-400 hover:bg-white/15 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <div className="flex flex-col gap-2 xl:items-end">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Schedule Status</p>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {STATUS_LEGEND.map((type) => {
                  const config = SHIFT_CONFIG[type];
                  return (
                    <span
                      key={type}
                      className={`inline-flex h-5 items-center justify-center gap-1.5 rounded border px-2 text-[10px] font-semibold ${config.bg} ${config.border} ${config.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                      {config.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex w-max max-w-full flex-wrap items-center gap-2 xl:col-start-1">
            <button
              type="button"
              onClick={goToday}
              className="rounded border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-50 hover:bg-white/15"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goPrevious}
              className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/10 text-slate-400 hover:bg-white/15 hover:text-slate-200"
              aria-label={view === "week" ? "Previous week" : "Previous month"}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[150px] text-center text-xs font-semibold text-slate-200">{periodLabel}</span>
            <button
              type="button"
              onClick={goNext}
              className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/10 text-slate-400 hover:bg-white/15 hover:text-slate-200"
              aria-label={view === "week" ? "Next week" : "Next month"}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <div className="ml-1 flex overflow-hidden rounded border border-white/10">
              <button
                type="button"
                onClick={() => setView("week")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  view === "week" ? accent.active : "bg-white/10 text-slate-400 hover:bg-white/15"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setView("month")}
                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                  view === "month" ? accent.active : "bg-white/10 text-slate-400 hover:bg-white/15"
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        {view === "week" ? (
          <div className="overflow-x-auto">
            <div className="min-w-[780px]">
              <div
                className="mb-2 grid gap-1"
                style={{ gridTemplateColumns: "120px repeat(7, minmax(0, 1fr))" }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Calendar</div>
                {weekDates.map((date, index) => {
                  const isToday = toYmd(date) === toYmd(today);
                  return (
                    <div key={toYmd(date)} className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{DAYS[index]}</p>
                      <p className={`mt-0.5 text-[10px] ${isToday ? "font-semibold text-blue-400" : "text-slate-600"}`}>
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {([
                { key: "schedule" as const, label: "Shift / Cover" },
                { key: "risk" as const, label: "Training / Risk" },
              ]).map((row) => (
                <div
                  key={row.key}
                  className="grid items-center gap-1 border-b border-gray-800/50 py-1.5 last:border-b-0"
                  style={{ gridTemplateColumns: "120px repeat(7, minmax(0, 1fr))" }}
                >
                  <div className="pr-3">
                    <p className="text-xs font-semibold text-slate-300">{row.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">Weekly view</p>
                  </div>
                  {weekDates.map((date) => {
                    const ymd = toYmd(date);
                    return (
                      <EventCell
                        key={`${row.key}-${ymd}`}
                        events={eventMap.get(ymd) ?? []}
                        group={row.key}
                        date={date}
                        isToday={ymd === toYmd(today)}
                        selected={selected === ymd}
                        onSelect={() => selectDate(date)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="mb-2 grid grid-cols-7 gap-1">
                {DAYS.map((day) => (
                  <div key={day} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((date, index) => {
                  if (!date) {
                    return <div key={`blank-${index}`} className="min-h-[76px] rounded-lg border border-transparent bg-slate-900/20" />;
                  }
                  const ymd = toYmd(date);
                  const dayEvents = eventMap.get(ymd) ?? [];
                  const isToday = ymd === toYmd(today);
                  const isSelected = selected === ymd;

                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => selectDate(date)}
                      className={`relative flex min-h-[76px] flex-col items-start gap-1 rounded-lg border bg-slate-800/40 p-2 text-left transition-colors hover:bg-slate-700/50 ${
                        isSelected ? "border-blue-500/60" : "border-gray-800"
                      } ${isToday ? `ring-1 ${accent.ring}` : ""}`}
                    >
                      <span className={`text-xs font-semibold ${isToday ? "text-blue-400" : "text-slate-300"}`}>
                        {date.getDate()}
                      </span>
                      {dayEvents.slice(0, 2).map((event, eventIndex) => {
                        const config = SHIFT_CONFIG[event.type];
                        return (
                          <span
                            key={`${ymd}-${eventIndex}`}
                            className={`inline-flex w-full items-center gap-1 rounded px-1 py-0.5 text-[9px] font-semibold leading-none ${config.bg} ${config.text}`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`} />
                            <span className="truncate">{event.label ?? config.label}</span>
                          </span>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-slate-500">+{dayEvents.length - 2} more</span>
                      )}
                      {dayEvents.some((event) => event.warn) && (
                        <AlertTriangle className="absolute right-1.5 top-1.5 h-2.5 w-2.5 text-orange-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
