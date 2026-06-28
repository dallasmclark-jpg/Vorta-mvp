import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "./ui/card";

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  date: string; // "YYYY-MM-DD"
  type: ShiftType;
  label?: string;   // short area / title shown in cell
  time?: string;    // "06:00–18:00"
  warn?: boolean;   // compliance / skill warning
}

export interface ShiftCalendarProps {
  title?: string;
  initialMonth?: Date;
  events: ShiftEvent[];
  role?: "operator" | "engineer" | "contractor" | "production";
  onSelectDate?: (date: string) => void;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SHIFT_CONFIG: Record<ShiftType, { bg: string; text: string; dot: string; label: string }> = {
  day:          { bg: "bg-[#3b82f620]", text: "text-blue-400",    dot: "bg-blue-500",    label: "Day Shift"      },
  night:        { bg: "bg-[#6366f120]", text: "text-indigo-300",  dot: "bg-indigo-400",  label: "Night Shift"    },
  off:          { bg: "bg-[#ffffff08]", text: "text-slate-500",   dot: "bg-slate-700",   label: "Rest / Off"     },
  training:     { bg: "bg-[#facc1520]", text: "text-yellow-400",  dot: "bg-yellow-400",  label: "Training"       },
  unavailable:  { bg: "bg-[#ef444418]", text: "text-red-400",     dot: "bg-red-500",     label: "Unavailable"    },
  overtime:     { bg: "bg-[#10b98118]", text: "text-emerald-400", dot: "bg-emerald-500", label: "Overtime / Cover"},
  restricted:   { bg: "bg-[#f9731618]", text: "text-orange-400",  dot: "bg-orange-400",  label: "Restricted"     },
  assigned:     { bg: "bg-[#3b82f620]", text: "text-blue-400",    dot: "bg-blue-500",    label: "Assigned"       },
  booking:      { bg: "bg-[#facc1520]", text: "text-yellow-400",  dot: "bg-yellow-400",  label: "Booking"        },
  "cert-renewal":{ bg: "bg-[#f9731618]", text: "text-orange-400", dot: "bg-orange-400",  label: "Cert Renewal"   },
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LEGEND_TYPES: ShiftType[] = ["day", "night", "off", "training", "unavailable", "overtime", "restricted"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1);
}

function isoMonday(d: Date): number {
  // Monday = 0, Sunday = 6
  return (d.getDay() + 6) % 7;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ShiftCalendar({ title = "Shift Calendar", initialMonth, events, onSelectDate }: ShiftCalendarProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => {
    const base = initialMonth ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  const year  = cursor.getFullYear();
  const month = cursor.getMonth();

  const monthLabel = cursor.toLocaleString("default", { month: "long", year: "numeric" });

  // Build day cells
  const firstDay    = startOfMonth(year, month);
  const leadingBlanks = isoMonday(firstDay);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to complete final row
  while (cells.length % 7 !== 0) cells.push(null);

  // Event index keyed by "YYYY-MM-DD"
  const eventMap = new Map<string, ShiftEvent[]>();
  for (const ev of events) {
    if (!eventMap.has(ev.date)) eventMap.set(ev.date, []);
    eventMap.get(ev.date)!.push(ev);
  }

  const handleSelect = (day: number) => {
    const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelected(ymd);
    onSelectDate?.(ymd);
  };

  const prev = () => setCursor(new Date(year, month - 1, 1));
  const next = () => setCursor(new Date(year, month + 1, 1));

  return (
    <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
      <CardContent className="p-0">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              className="flex h-6 w-6 items-center justify-center rounded border border-gray-700 text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[130px] text-center text-xs font-medium text-slate-300">{monthLabel}</span>
            <button
              type="button"
              onClick={next}
              className="flex h-6 w-6 items-center justify-center rounded border border-gray-700 text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
              aria-label="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Desktop / Tablet grid ── */}
        <div className="hidden sm:block overflow-x-auto">
          <div className="min-w-[560px] p-4">

            {/* Day headers */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DAYS.map((d) => (
                <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {d}
                </div>
              ))}
            </div>

            {/* Cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`blank-${idx}`} />;

                const ymd   = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvs = eventMap.get(ymd) ?? [];
                const isToday = ymd === toYMD(today);
                const isSel   = ymd === selected;
                const primaryEv = dayEvs[0];
                const cfg = primaryEv ? SHIFT_CONFIG[primaryEv.type] : null;
                const hasWarn = dayEvs.some((e) => e.warn);

                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => handleSelect(day)}
                    className={`relative flex min-h-[68px] flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left transition-colors
                      ${isSel   ? "border-blue-500/60 bg-[#3b82f615]" : "border-gray-800 hover:border-gray-700 hover:bg-[#1a2030]"}
                      ${isToday ? "ring-1 ring-blue-500/40" : ""}`}
                  >
                    {/* Day number */}
                    <span className={`text-[11px] font-semibold tabular-nums ${isToday ? "text-blue-400" : "text-slate-400"}`}>
                      {day}
                    </span>

                    {/* Events */}
                    {dayEvs.slice(0, 2).map((ev, i) => {
                      const c = SHIFT_CONFIG[ev.type];
                      return (
                        <span
                          key={i}
                          className={`inline-flex w-full items-center gap-1 rounded px-1 py-0.5 text-[9px] font-semibold leading-none ${c.bg} ${c.text}`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                          <span className="truncate">{ev.label ?? c.label}</span>
                        </span>
                      );
                    })}
                    {dayEvs.length > 2 && (
                      <span className="text-[9px] text-slate-600">+{dayEvs.length - 2} more</span>
                    )}

                    {/* Warning */}
                    {hasWarn && (
                      <AlertTriangle className="absolute right-1 top-1 h-2.5 w-2.5 text-orange-400" aria-label="Warning" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Mobile: agenda list ── */}
        <div className="sm:hidden">
          <div className="flex flex-col divide-y divide-gray-800/60 px-4 py-2">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const ymd    = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayEvs = eventMap.get(ymd) ?? [];
              const isToday = ymd === toYMD(today);
              if (dayEvs.length === 0) return null;

              return (
                <div
                  key={ymd}
                  className={`flex items-start gap-3 py-2 ${isToday ? "bg-[#3b82f608] -mx-4 px-4" : ""}`}
                >
                  <div className="w-10 shrink-0 text-right">
                    <span className={`text-xs font-semibold tabular-nums ${isToday ? "text-blue-400" : "text-slate-400"}`}>
                      {String(day).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-1">
                    {dayEvs.map((ev, i) => {
                      const c = SHIFT_CONFIG[ev.type];
                      return (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                          {ev.label ?? c.label}
                          {ev.time && <span className="opacity-60"> · {ev.time}</span>}
                          {ev.warn && <AlertTriangle className="h-2.5 w-2.5 text-orange-400" />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-gray-800 px-5 py-3">
          {LEGEND_TYPES.map((t) => {
            const c = SHIFT_CONFIG[t];
            return (
              <span key={t} className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {c.label}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
            <AlertTriangle className="h-2.5 w-2.5 text-orange-400" />
            Warning
          </span>
        </div>

      </CardContent>
    </Card>
  );
}
