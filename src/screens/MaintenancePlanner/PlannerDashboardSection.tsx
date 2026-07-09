import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  Search,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  getAreaInterventionPlans,
  type AreaInterventionPlan,
  type AreaInterventionWorkItem,
} from "../Equipment/equipmentService";
import {
  getPlannerDailyResourceLoad,
  getPlannerReadinessScores,
  type PlannerDailyResourceLoad,
  type PlannerReadinessScore,
  type ResourceStrategyRow,
} from "./plannerService";

// ─── Date helpers (mirror ShiftCalendar patterns) ──────────────────────────────

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function getWeekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toYMD(d);
  });
}

function isInWeek(date: string, monday: Date): boolean {
  const dates = getWeekDates(monday);
  return dates.includes(date);
}

// ─── Visual helpers ────────────────────────────────────────────────────────────

function readinessColor(level: string) {
  switch (level) {
    case "Ready":   return { ring: "ring-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
    case "Review":  return { ring: "ring-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-400",   badge: "border-amber-500/30 bg-amber-500/10 text-amber-300"   };
    case "At Risk": return { ring: "ring-orange-500/40",  bg: "bg-orange-500/10",  text: "text-orange-400",  badge: "border-orange-500/30 bg-orange-500/10 text-orange-300" };
    case "Blocked": return { ring: "ring-red-500/40",     bg: "bg-red-500/10",     text: "text-red-400",     badge: "border-red-500/30 bg-red-500/10 text-red-300"         };
    default:        return { ring: "ring-gray-700",       bg: "bg-gray-800/40",    text: "text-slate-400",   badge: "border-gray-700 bg-gray-800 text-slate-400"            };
  }
}

function statusIcon(status: string) {
  if (status === "Available" || status === "Covered" || status === "Ready")
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (status === "Partial" || status === "Low")
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
}

function resourceStatusColors(status: string) {
  if (status === "Available")   return { badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
  if (status === "Tight")       return { badge: "border-amber-500/30 bg-amber-500/10 text-amber-300"       };
  if (status === "Full" || status === "Overloaded") return { badge: "border-red-500/30 bg-red-500/10 text-red-300" };
  return { badge: "border-gray-700 bg-gray-800 text-slate-400" };
}

function riskColor(level: string) {
  if (level === "Critical") return "text-red-400";
  if (level === "High")     return "text-orange-400";
  if (level === "Medium")   return "text-amber-400";
  return "text-emerald-400";
}

function formatDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

// ─── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, accent }: {
  label: string; value: string | number; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-[#0d1117] px-5 py-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-slate-50 leading-none">{value}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Readiness gauge ───────────────────────────────────────────────────────────

function ReadinessGauge({ score, level }: { score: number; level: string }) {
  const col = readinessColor(level);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl ring-2 ${col.ring} ${col.bg} py-6`}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#1e2535" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke="currentColor"
          strokeWidth="10" strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round" transform="rotate(-90 70 70)"
          className={col.text}
        />
        <text x="70" y="65" textAnchor="middle" className="fill-slate-50" fontSize="26" fontWeight="700">{score}</text>
        <text x="70" y="83" textAnchor="middle" className="fill-slate-500" fontSize="11">/ 100</text>
      </svg>
      <span className={`mt-1 inline-flex rounded-full border px-3 py-0.5 text-xs font-semibold ${col.badge}`}>
        {level}
      </span>
    </div>
  );
}

// ─── Breakdown row ─────────────────────────────────────────────────────────────

function BreakdownRow({ label, left, right, status }: {
  label: string; left: string; right: string; status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-800 last:border-0">
      <span className="text-xs font-semibold text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex flex-1 items-center justify-between gap-4 text-xs text-slate-500">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {statusIcon(status)}
        <span className="text-[11px] text-slate-400">{status}</span>
      </div>
    </div>
  );
}

// ─── Shift tile (used inside PlannerWeekCalendar) ──────────────────────────────

function ShiftTile({
  date, shift, score, isSelected, onSelect, accentClass,
}: {
  date: string; shift: string; score: PlannerReadinessScore | null;
  isSelected: boolean; onSelect: (date: string, shift: string) => void;
  accentClass: string;
}) {
  const label = shift === "Day Shift" ? "Day" : "Night";

  if (!score) {
    return (
      <button
        onClick={() => onSelect(date, shift)}
        className={`flex w-full min-h-[58px] flex-col gap-0.5 p-2 text-left transition-colors
          ${isSelected ? "bg-[#3b82f615] ring-inset ring-1 ring-blue-500/50" : "hover:bg-[#161c28]"}`}
      >
        <span className={`text-[9px] font-semibold uppercase tracking-wider opacity-40 ${accentClass}`}>{label}</span>
        <span className="text-[9px] text-slate-700 mt-0.5">—</span>
      </button>
    );
  }

  const col = readinessColor(score.readinessLevel);

  return (
    <button
      onClick={() => onSelect(date, shift)}
      className={`flex w-full min-h-[58px] flex-col gap-0.5 p-2 text-left transition-colors
        ${isSelected ? "bg-[#3b82f615] ring-inset ring-1 ring-blue-500/50" : "hover:bg-[#161c28]"}`}
    >
      <div className="flex w-full items-center justify-between">
        <span className={`text-[9px] font-semibold uppercase tracking-wider ${accentClass}`}>{label}</span>
        {score.contractorRequired && (
          <AlertTriangle className="h-2.5 w-2.5 text-orange-400 shrink-0" />
        )}
      </div>
      <span className={`text-sm font-bold leading-none ${col.text}`}>{score.readinessScore}</span>
      <span className={`mt-0.5 inline-flex rounded px-1 py-0.5 text-[8px] font-semibold leading-none ${col.bg} ${col.text}`}>
        {score.readinessLevel}
      </span>
      <div className="mt-0.5 flex items-center gap-1">
        <span
          className={`h-1.5 w-1.5 rounded-full ${score.labourStatus === "Available" ? "bg-emerald-500" : score.labourStatus === "Partial" ? "bg-amber-400" : "bg-red-500"}`}
          title={`Labour: ${score.labourStatus}`}
        />
        <span
          className={`h-1.5 w-1.5 rounded-full ${score.skillsStatus === "Covered" ? "bg-emerald-500" : score.skillsStatus === "Partial" ? "bg-amber-400" : "bg-red-500"}`}
          title={`Skills: ${score.skillsStatus}`}
        />
        <span
          className={`h-1.5 w-1.5 rounded-full ${score.sparesStatus === "Ready" ? "bg-emerald-500" : score.sparesStatus === "Partial" ? "bg-amber-400" : "bg-red-500"}`}
          title={`Spares: ${score.sparesStatus}`}
        />
        {score.warnings.length > 0 && (
          <span className="text-[8px] text-amber-400">{score.warnings.length}⚠</span>
        )}
      </div>
    </button>
  );
}

// ─── Planner week calendar ─────────────────────────────────────────────────────
// Reuses ShiftCalendar visual conventions: same card bg (#141820), same nav
// button style, same day-header format, same colour tokens for shift types.
// Renders a week view with paired Day/Night shift tiles instead of event chips.

function PlannerWeekCalendar({
  readinessScores,
  selectedDate,
  selectedShift,
  onSelectShift,
}: {
  readinessScores: PlannerReadinessScore[];
  selectedDate: string;
  selectedShift: string;
  onSelectShift: (date: string, shift: string) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(today), [today]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(today));

  // When a date is selected externally (Best Windows click), jump to its week.
  useEffect(() => {
    if (selectedDate && !isInWeek(selectedDate, weekStart)) {
      setWeekStart(getMondayOf(new Date(selectedDate + "T00:00:00")));
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const readinessMap = useMemo(() => {
    const m = new Map<string, PlannerReadinessScore>();
    for (const s of readinessScores) m.set(`${s.proposedDate}:${s.proposedShift}`, s);
    return m;
  }, [readinessScores]);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  const prevWeek = () => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
  const nextWeek = () => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });

  return (
    <div className="rounded-xl border border-gray-800 bg-[#141820] overflow-hidden">

      {/* Header — matches ShiftCalendar header exactly */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-200">Proposed Date &amp; Shift</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-700 text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[190px] text-center text-xs font-medium text-slate-300">{weekLabel}</span>
          <button
            onClick={nextWeek}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-700 text-slate-400 transition-colors hover:border-gray-600 hover:text-slate-200"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-800 bg-[#0d1117]">
        {WEEK_DAYS.map((d, i) => {
          const isToday = weekDates[i] === todayYMD;
          const dayNum = weekDates[i] ? new Date(weekDates[i] + "T00:00:00").getDate() : "";
          return (
            <div key={d} className={`border-r border-gray-800 last:border-0 py-2 text-center ${isToday ? "bg-[#3b82f608]" : ""}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wider ${isToday ? "text-blue-400" : "text-slate-600"}`}>{d}</div>
              <div className={`text-[10px] tabular-nums ${isToday ? "text-blue-400" : "text-slate-700"}`}>{dayNum}</div>
            </div>
          );
        })}
      </div>

      {/* Shift tile grid */}
      <div className="grid grid-cols-7">
        {weekDates.map((date, i) => {
          const dayScore   = readinessMap.get(`${date}:Day Shift`)   ?? null;
          const nightScore = readinessMap.get(`${date}:Night Shift`) ?? null;
          const isToday = date === todayYMD;
          return (
            <div key={date} className={`flex flex-col border-r border-gray-800 last:border-0 ${isToday ? "bg-[#3b82f605]" : ""}`}>
              <ShiftTile
                date={date} shift="Day Shift" score={dayScore}
                isSelected={selectedDate === date && selectedShift === "Day Shift"}
                onSelect={onSelectShift}
                accentClass="text-blue-400"
              />
              <div className="border-t border-gray-800/50" />
              <ShiftTile
                date={date} shift="Night Shift" score={nightScore}
                isSelected={selectedDate === date && selectedShift === "Night Shift"}
                onSelect={onSelectShift}
                accentClass="text-indigo-300"
              />
            </div>
          );
        })}
      </div>

      {/* Legend — matches ShiftCalendar legend styling */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-800 px-5 py-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-blue-500" />Day Shift</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-indigo-400" />Night Shift</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />Ready</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-amber-400" />Review</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-2 w-2 rounded-full bg-red-500" />Blocked</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><AlertTriangle className="h-2.5 w-2.5 text-orange-400" />Contractor needed</span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Labour · Skills · Spares</span>
      </div>
    </div>
  );
}

// ─── Daily resource load panel ─────────────────────────────────────────────────

function DailyResourceLoadPanel({
  resources,
  loading,
}: {
  resources: PlannerDailyResourceLoad[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <svg className="h-4 w-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center py-5 text-center">
        <Users className="mb-2 h-6 w-6 text-slate-700" />
        <p className="text-xs text-slate-500">No resource data for this shift.</p>
        <p className="mt-0.5 text-[10px] text-slate-600">Insert rows into planner_daily_resource_load to populate.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800">
            {["Name", "Type", "Skill", "Plan", "Cap", "Avail", "✓", "Status"].map((h) => (
              <th key={h} className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600 pr-2 last:pr-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {resources.map((r, i) => {
            const { badge } = resourceStatusColors(r.status);
            const isCtr = r.resourceType === "Contractor";
            return (
              <tr key={i} className={isCtr ? "bg-blue-500/4" : ""}>
                <td className={`py-2.5 pr-2 font-semibold ${isCtr ? "text-blue-300" : "text-slate-200"}`}>
                  <div className="flex items-center gap-1.5">
                    {r.resourceName}
                    {isCtr && <span className="rounded bg-blue-500/10 px-1 text-[9px] text-blue-400">CTR</span>}
                  </div>
                </td>
                <td className="py-2.5 pr-2 text-slate-500">{r.resourceType}</td>
                <td className="py-2.5 pr-2 text-slate-400">{r.primarySkill}</td>
                <td className="py-2.5 pr-2 text-right text-slate-300">{r.plannedHours}h</td>
                <td className="py-2.5 pr-2 text-right text-slate-500">{r.capacityHours}h</td>
                <td className={`py-2.5 pr-2 text-right font-semibold ${r.availableHours <= 0 ? "text-red-400" : r.availableHours < 4 ? "text-amber-400" : "text-emerald-400"}`}>
                  {r.availableHours}h
                </td>
                <td className="py-2.5 pr-2 text-center">
                  {r.trainedForSelectedWork
                    ? <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-400" />
                    : <XCircle className="mx-auto h-3.5 w-3.5 text-red-400" />
                  }
                </td>
                <td className="py-2.5">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Resource strategy card ────────────────────────────────────────────────────

function strategyRowBadge(row: ResourceStrategyRow) {
  if (row.contractorRequired) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (row.internalCovered >= row.engineersRequired) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function strategyRowLabel(row: ResourceStrategyRow) {
  if (row.contractorRequired) return "Contractor Required";
  if (row.internalCovered >= row.engineersRequired) return "Covered";
  return "Partial";
}

function ResourceStrategyCard({
  readiness,
  onFindContractors,
}: {
  readiness: PlannerReadinessScore;
  onFindContractors: () => void;
}) {
  const { resourceStrategy, contractorRequired, contractorRecommendation } = readiness;
  if (resourceStrategy.length === 0 && !contractorRequired) return null;

  const externalRows = resourceStrategy.filter((r) => r.contractorRequired);

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-200">Resource Strategy</h2>

      {resourceStrategy.length > 0 && (
        <div className="mb-4 flex flex-col gap-0 rounded-lg border border-gray-800">
          {resourceStrategy.map((row, i) => (
            <div
              key={row.role}
              className={`flex items-center gap-3 px-4 py-3 ${i < resourceStrategy.length - 1 ? "border-b border-gray-800" : ""}`}
            >
              <span className="text-xs font-semibold text-slate-300 w-24 shrink-0">{row.role}</span>
              <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Req: <span className="font-semibold text-slate-300">{row.engineersRequired}</span></span>
                <span>Internal: <span className="font-semibold text-slate-300">{row.internalCovered}</span></span>
                <span>Est: <span className="font-semibold text-slate-300">{row.estimatedHours}h</span></span>
              </div>
              <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${strategyRowBadge(row)}`}>
                {strategyRowLabel(row)}
              </span>
            </div>
          ))}
        </div>
      )}

      {contractorRequired && (
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">External Support Recommended</span>
          </div>
          {externalRows.map((r) => (
            <div key={r.role} className="ml-6 text-xs text-amber-400/80">
              <span className="font-semibold">{r.role}</span> — internal coverage unavailable for the selected planning window.
            </div>
          ))}
          {contractorRecommendation && (
            <p className="ml-6 mt-0.5 text-xs text-amber-300/70">{contractorRecommendation}</p>
          )}
        </div>
      )}

      {externalRows.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Estimated External Labour Required</p>
          <div className="flex flex-col gap-1.5">
            {externalRows.map((r) => {
              const gap = r.engineersRequired - r.internalCovered;
              return (
                <div key={r.role} className="flex items-center justify-between rounded-lg border border-gray-800 bg-[#0b0e14] px-4 py-2.5 text-xs">
                  <span className="font-semibold text-slate-200">{r.role}</span>
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>{gap} engineer{gap !== 1 ? "s" : ""}</span>
                    <span>{r.estimatedHours}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onFindContractors}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-600/10 px-4 py-2.5 text-sm font-semibold text-blue-300 transition-colors hover:border-blue-500/50 hover:bg-blue-600/15"
      >
        <Search className="h-4 w-4" />
        Find Contractors
      </button>
    </div>
  );
}

// ─── Contractor drawer placeholder ────────────────────────────────────────────

function ContractorDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-gray-800 bg-[#090b10] shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-50">Find Contractors</h2>
            <p className="mt-0.5 text-xs text-slate-500">Match contractor availability to your planning window.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Search className="h-10 w-10 text-slate-700" />
          <p className="text-sm font-semibold text-slate-400">Contractor search coming soon</p>
          <p className="text-xs text-slate-600">
            Contractors matched to required skills and available for the proposed date and shift.
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Best windows table ────────────────────────────────────────────────────────

function BestWindowsTable({
  scores,
  selectedDate,
  selectedShift,
  onSelect,
}: {
  scores: PlannerReadinessScore[];
  selectedDate: string;
  selectedShift: string;
  onSelect: (date: string, shift: string) => void;
}) {
  const top5 = useMemo(
    () => [...scores].sort((a, b) => b.readinessScore - a.readinessScore || a.proposedDate.localeCompare(b.proposedDate)).slice(0, 5),
    [scores],
  );

  if (top5.length === 0) {
    return (
      <p className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 text-xs text-slate-500">
        No readiness data available. Insert rows into planner_readiness_scores to see best windows.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {top5.map((s) => {
        const col = readinessColor(s.readinessLevel);
        const active = s.proposedDate === selectedDate && s.proposedShift === selectedShift;
        return (
          <button
            key={`${s.proposedDate}-${s.proposedShift}`}
            onClick={() => onSelect(s.proposedDate, s.proposedShift)}
            className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-left transition-colors ${
              active ? "border-blue-500/40 bg-blue-500/10" : "border-gray-800 bg-[#0d1117] hover:border-gray-700"
            }`}
          >
            <div className="flex flex-col gap-0">
              <span className="text-xs font-semibold text-slate-200">{formatDate(s.proposedDate)}</span>
              <span className="text-[10px] text-slate-500">{s.proposedShift}</span>
            </div>
            <div className="flex items-center gap-3">
              {s.warnings.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400">
                  <AlertTriangle className="h-3 w-3" />{s.warnings.length}
                </span>
              )}
              <div className={`text-sm font-bold ${col.text}`}>{s.readinessScore}</div>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${col.badge}`}>
                {s.readinessLevel}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Work pack summary ─────────────────────────────────────────────────────────

function WorkPackSummary({ plan }: { plan: AreaInterventionPlan }) {
  if (plan.workItems.length === 0) {
    return (
      <p className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 text-xs text-slate-500">
        No structured work items found for this area.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {plan.workItems.map((item: AreaInterventionWorkItem & { workRef?: string }, i: number) => (
        <div key={i} className="rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-800 text-[9px] font-semibold text-slate-400">
                  {item.priority}
                </span>
                <span className="text-xs font-semibold text-slate-100">{item.asset}</span>
                {item.assetCode && <span className="text-[10px] text-slate-500">{item.assetCode}</span>}
                {item.workRef && (
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{item.workRef}</span>
                )}
              </div>
              <span className="ml-6 text-[11px] text-slate-500">{item.action}</span>
            </div>
            <div className="shrink-0 flex items-center gap-3 text-xs">
              <span className="text-emerald-400 font-semibold">▼{item.estimatedReduction}</span>
              <span className="text-slate-500">{item.estimatedHours}h</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────────────────────────

export function PlannerDashboardSection() {
  const [plans,           setPlans]           = useState<AreaInterventionPlan[]>([]);
  const [readinessScores, setReadinessScores] = useState<PlannerReadinessScore[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [dailyLoad,       setDailyLoad]       = useState<PlannerDailyResourceLoad[]>([]);
  const [dailyLoading,    setDailyLoading]    = useState(false);

  const [selectedArea,         setSelectedArea]         = useState<string | null>(null);
  const [proposedDate,         setProposedDate]         = useState<string>("");
  const [proposedShift,        setProposedShift]        = useState<string>("Day Shift");
  const [contractorDrawerOpen, setContractorDrawerOpen] = useState(false);

  useEffect(() => {
    Promise.all([getAreaInterventionPlans(), getPlannerReadinessScores()]).then(
      ([planData, readinessData]) => {
        setPlans(planData);
        setReadinessScores(readinessData);
        if (planData.length > 0) setSelectedArea(planData[0].area);
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!selectedArea || !proposedDate || !proposedShift) {
      setDailyLoad([]);
      return;
    }
    setDailyLoading(true);
    getPlannerDailyResourceLoad(selectedArea, proposedDate, proposedShift).then((data) => {
      setDailyLoad(data);
      setDailyLoading(false);
    });
  }, [selectedArea, proposedDate, proposedShift]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.area === selectedArea) ?? null,
    [plans, selectedArea],
  );

  const areaReadiness = useMemo(
    () => readinessScores.filter((s) => s.area === selectedArea),
    [readinessScores, selectedArea],
  );

  const activeReadiness = useMemo(
    () => areaReadiness.find((s) => s.proposedDate === proposedDate && s.proposedShift === proposedShift) ?? null,
    [areaReadiness, proposedDate, proposedShift],
  );

  const totalLabour = useMemo(
    () => plans.reduce((sum, p) => sum + p.resourceRequirements.reduce((s, r) => s + (r.estimatedHours ?? 0), 0), 0),
    [plans],
  );
  const readyCount   = areaReadiness.filter((s) => s.readinessLevel === "Ready").length;
  const blockedCount = areaReadiness.filter((s) => s.readinessLevel === "Blocked").length;

  const handleShiftSelect = (date: string, shift: string) => {
    setProposedDate(date);
    setProposedShift(shift);
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-50">Planner Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select an area, click a shift window, and review execution readiness.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Areas to Plan"     value={loading ? "—" : plans.length}      icon={Clock}        accent="bg-blue-500/15 text-blue-400"      />
        <KpiCard label="Ready Windows"     value={loading ? "—" : readyCount}        icon={CheckCircle2} accent="bg-emerald-500/15 text-emerald-400" />
        <KpiCard label="Blocked Windows"   value={loading ? "—" : blockedCount}      icon={XCircle}      accent="bg-red-500/15 text-red-400"        />
        <KpiCard label="Total Labour Req." value={loading ? "—" : `${totalLabour}h`} icon={Package}      accent="bg-amber-500/15 text-amber-400"    />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_440px]">

        {/* LEFT — Planning Queue + Work Pack Summary */}
        <div className="flex flex-col gap-6">

          {/* Planning Queue */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Interventions Awaiting Planning</h2>
            {loading ? (
              <div className="flex items-center justify-center rounded-xl border border-gray-800 bg-[#0d1117] py-12">
                <svg className="h-5 w-5 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-[#0d1117] py-12 text-center">
                <p className="text-sm font-semibold text-slate-400">No intervention plans found</p>
                <p className="mt-1 text-xs text-slate-600">Plans are generated from area risk analysis.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {plans.map((plan) => {
                  const labourHrs = plan.resourceRequirements.reduce((s, r) => s + (r.estimatedHours ?? 0), 0);
                  const active = plan.area === selectedArea;
                  return (
                    <button
                      key={plan.area}
                      onClick={() => { setSelectedArea(plan.area); setProposedDate(""); }}
                      className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left transition-colors ${
                        active ? "border-blue-500/40 bg-blue-500/8" : "border-gray-800 bg-[#0d1117] hover:border-gray-700"
                      }`}
                    >
                      <div className="w-36 shrink-0">
                        <p className="text-sm font-semibold text-slate-100">{plan.area}</p>
                        <p className={`text-xs font-semibold ${riskColor(plan.currentRiskLevel)}`}>
                          Risk {plan.currentRiskScore}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 hidden sm:block">
                        <p className="truncate text-sm text-slate-300">{plan.recommendedOption}</p>
                        <p className="text-xs text-slate-500">{plan.recommendedDurationHours} hrs</p>
                      </div>
                      <div className="flex items-center gap-5 shrink-0 text-center">
                        <div>
                          <p className="text-sm font-bold text-emerald-400">▼{plan.recommendedReduction}</p>
                          <p className="text-[10px] text-slate-600">Reduction</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{plan.workItems.length}</p>
                          <p className="text-[10px] text-slate-600">Items</p>
                        </div>
                        {labourHrs > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{labourHrs}h</p>
                            <p className="text-[10px] text-slate-600">Labour</p>
                          </div>
                        )}
                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300">
                          Awaiting planning
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Work Pack Summary */}
          {selectedPlan && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-200">Work Pack — {selectedPlan.area}</h2>
              </div>
              <WorkPackSummary plan={selectedPlan} />
            </div>
          )}
        </div>

        {/* RIGHT — Calendar + Execution Readiness + Daily Load + Resource Strategy + Best Windows */}
        <div className="flex flex-col gap-5">

          {/* Area selector */}
          {plans.length > 1 && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 shrink-0">Area</span>
              <select
                value={selectedArea ?? ""}
                onChange={(e) => { setSelectedArea(e.target.value); setProposedDate(""); }}
                className="h-8 flex-1 rounded-lg border border-gray-700 bg-[#0b0e14] px-3 text-xs text-slate-200 outline-none transition-colors focus:border-blue-500/50"
              >
                {plans.map((p) => <option key={p.area} value={p.area}>{p.area}</option>)}
              </select>
            </div>
          )}

          {/* Week calendar — replaces date input + shift buttons */}
          <PlannerWeekCalendar
            readinessScores={areaReadiness}
            selectedDate={proposedDate}
            selectedShift={proposedShift}
            onSelectShift={handleShiftSelect}
          />

          {/* Execution Readiness (renamed) */}
          <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">Execution Readiness</h2>

            {!proposedDate ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Clock className="mb-2 h-8 w-8 text-slate-700" />
                <p className="text-sm text-slate-500">Click a shift in the calendar above.</p>
              </div>
            ) : !activeReadiness ? (
              <div className="flex flex-col items-center py-6 text-center">
                <AlertTriangle className="mb-2 h-8 w-8 text-slate-700" />
                <p className="text-sm text-slate-500">No readiness data for this shift.</p>
                <p className="mt-1 text-xs text-slate-600">Insert a row into planner_readiness_scores to see the score.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <ReadinessGauge score={activeReadiness.readinessScore} level={activeReadiness.readinessLevel} />

                <div className="rounded-lg border border-gray-800 px-4 py-1">
                  <BreakdownRow
                    label="Labour"
                    left={`Req: ${activeReadiness.labourRequiredHours}h`}
                    right={`Avail: ${activeReadiness.labourAvailableHours}h`}
                    status={activeReadiness.labourStatus}
                  />
                  <BreakdownRow
                    label="Skills"
                    left={`Req: ${activeReadiness.skillsRequired}`}
                    right={`Covered: ${activeReadiness.skillsCovered}`}
                    status={activeReadiness.skillsStatus}
                  />
                  <BreakdownRow
                    label="Spares"
                    left={`Req: ${activeReadiness.sparesRequired}`}
                    right={`Ready: ${activeReadiness.sparesReady}`}
                    status={activeReadiness.sparesStatus}
                  />
                  {activeReadiness.workloadClashHours > 0 && (
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-xs font-semibold text-slate-400">Clash hours</span>
                      <span className="text-xs font-semibold text-amber-400">{activeReadiness.workloadClashHours}h</span>
                    </div>
                  )}
                </div>

                {activeReadiness.warnings.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {activeReadiness.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="text-xs text-amber-300">{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeReadiness.recommendation && (
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-1">Recommendation</p>
                    <p className="text-xs text-blue-300">{activeReadiness.recommendation}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Daily Resource Load */}
          {proposedDate && (
            <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-200">Daily Resource Load</h2>
              <DailyResourceLoadPanel resources={dailyLoad} loading={dailyLoading} />
            </div>
          )}

          {/* Resource Strategy */}
          {activeReadiness && (
            <ResourceStrategyCard
              readiness={activeReadiness}
              onFindContractors={() => setContractorDrawerOpen(true)}
            />
          )}

          {/* Best Available Windows */}
          {selectedArea && areaReadiness.length > 0 && (
            <div className="rounded-xl border border-gray-800 bg-[#0d1117] p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Best Available Windows</h2>
              <p className="mb-3 text-[11px] text-slate-600">Top 5 by readiness score — click to select.</p>
              <BestWindowsTable
                scores={areaReadiness}
                selectedDate={proposedDate}
                selectedShift={proposedShift}
                onSelect={handleShiftSelect}
              />
            </div>
          )}
        </div>
      </div>

      {contractorDrawerOpen && (
        <ContractorDrawer onClose={() => setContractorDrawerOpen(false)} />
      )}
    </div>
  );
}
