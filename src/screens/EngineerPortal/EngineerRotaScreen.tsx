import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  getOperationalRotaSnapshot,
  type OperationalRotaCalendarItem,
  type OperationalRotaCoverageStatus,
  type OperationalRotaSnapshot,
} from "../Engineers/operationalRotaService";
import {
  resolveAuthenticatedEngineerIdentity,
  type EngineerRosterIdentity,
} from "./engineerIdentity";

const PAGE =
  "mx-auto flex w-full max-w-[1040px] flex-col gap-4 px-3 pb-10 pt-4 sm:px-5 md:gap-5 md:px-6 md:pb-12 md:pt-6";
const CARD =
  "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";
const RAISED = "rounded-xl border border-slate-800/70 bg-[#07172b]";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const COVERAGE_LABELS: Record<OperationalRotaCoverageStatus, string> = {
  covered: "Fully covered",
  reduced: "Reduced cover",
  partial: "Partial cover",
  gap: "Critical gap",
  contractor: "Contractor cover",
};

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function startOfCalendarGrid(value: Date): Date {
  const date = startOfMonth(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return date;
}

function endOfCalendarGrid(value: Date): Date {
  const date = endOfMonth(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? 0 : 7 - weekday));
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setDate(date.getDate() + days);
  return date;
}

function dateOnly(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sameMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function normaliseName(value: string): string {
  return value.trim().toLocaleLowerCase("en-GB").replace(/\s+/g, " ");
}

function isEngineerOnShift(
  item: OperationalRotaCalendarItem,
  engineerName: string,
): boolean {
  const expected = normaliseName(engineerName);
  return item.engineerNames.some((name) => normaliseName(name) === expected);
}

function monthTitle(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function fullDateTitle(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDateOnly(value));
}

function shortDateTitle(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parseDateOnly(value));
}

function shiftLabel(item: OperationalRotaCalendarItem): string {
  return item.shiftType === "day" ? "Day shift" : "Night shift";
}

function shiftShortLabel(item: OperationalRotaCalendarItem): string {
  return item.shiftType === "day" ? "Day" : "Night";
}

function shiftTone(item: OperationalRotaCalendarItem): string {
  if (item.shiftType === "day") {
    return "border-blue-400/25 bg-blue-500/[0.14] text-blue-200";
  }
  return "border-indigo-400/25 bg-indigo-500/[0.14] text-indigo-200";
}

function coverageTone(status: OperationalRotaCoverageStatus): string {
  switch (status) {
    case "gap":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "partial":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "reduced":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "contractor":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    default:
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
}

function needsAttention(item: OperationalRotaCalendarItem): boolean {
  return (
    item.coverageStatus !== "covered" ||
    item.missingSkillCount > 0 ||
    item.equipmentWithMissingCover > 0
  );
}

function selectedShiftForDate(
  snapshot: OperationalRotaSnapshot | null,
  date: string,
  engineerName: string | null,
): OperationalRotaCalendarItem | null {
  if (!snapshot || !engineerName) return null;
  return (
    snapshot.calendar.find(
      (item) =>
        item.shiftDate === date && isEngineerOnShift(item, engineerName),
    ) ?? null
  );
}

function LoadingCalendar(): JSX.Element {
  return (
    <div className={`${CARD} p-4 sm:p-5`} aria-live="polite">
      <div className="animate-pulse">
        <div className="h-5 w-36 rounded bg-slate-800/80" />
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, index) => (
            <div
              key={index}
              className="h-[72px] rounded-xl border border-slate-800/60 bg-slate-900/45"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DaySheetProps {
  date: string;
  engineer: EngineerRosterIdentity;
  shift: OperationalRotaCalendarItem | null;
  onClose: () => void;
}

function DaySheet({
  date,
  engineer,
  shift,
  onClose,
}: DaySheetProps): JSX.Element {
  const colleagues = shift
    ? shift.engineerNames.filter(
        (name) => normaliseName(name) !== normaliseName(engineer.fullName),
      )
    : [];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 px-0 pt-16 backdrop-blur-[2px] sm:px-4 sm:pb-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="engineer-rota-day-title"
        className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-t-[1.35rem] border border-slate-700/80 bg-[#07111f] shadow-[0_-18px_60px_rgba(0,0,0,0.42)] sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-800/85 bg-[#07111f]/95 px-4 py-4 backdrop-blur sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">
              My rota
            </p>
            <h2
              id="engineer-rota-day-title"
              className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-50"
            >
              {fullDateTitle(date)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close day details"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/60 text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-5">
          {shift ? (
            <>
              <div className={`${RAISED} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${shiftTone(
                        shift,
                      )}`}
                    >
                      {shiftLabel(shift)}
                    </span>
                    <p className="mt-3 text-base font-semibold text-slate-100">
                      {shift.teamNames.length > 0
                        ? shift.teamNames.join(" · ")
                        : "Shift team"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {engineer.fullName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Shift cover
                    </p>
                    <span
                      className={`mt-2 inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${coverageTone(
                        shift.coverageStatus,
                      )}`}
                    >
                      {COVERAGE_LABELS[shift.coverageStatus]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className={`${RAISED} p-3.5`}>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Users className="h-4 w-4" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Rostered
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-slate-100">
                    {shift.scheduledEngineerCount}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    engineers on shift
                  </p>
                </div>

                <div className={`${RAISED} p-3.5`}>
                  <div className="flex items-center gap-2 text-slate-500">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Labour risk
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-slate-100">
                    {Math.round(shift.labourRiskScore)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {shift.labourRiskLevel}
                  </p>
                </div>
              </div>

              <div className={`${RAISED} p-4`}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-slate-100">
                    Shift team
                  </h3>
                </div>
                {colleagues.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {colleagues.map((name) => (
                      <span
                        key={name}
                        className="rounded-lg border border-slate-700/75 bg-slate-950/35 px-2.5 py-1.5 text-xs text-slate-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    No additional rostered engineer names were returned for this shift.
                  </p>
                )}
              </div>

              {needsAttention(shift) ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-100">
                      Shift attention
                    </h3>
                  </div>
                  <div className="mt-2 space-y-1 text-xs leading-5 text-amber-100/75">
                    {shift.missingSkillCount > 0 ? (
                      <p>
                        {shift.missingSkillCount} required skill{" "}
                        {shift.missingSkillCount === 1 ? "gap is" : "gaps are"} present
                        in shift-cover evidence.
                      </p>
                    ) : null}
                    {shift.equipmentWithMissingCover > 0 ? (
                      <p>
                        {shift.equipmentWithMissingCover} equipment{" "}
                        {shift.equipmentWithMissingCover === 1 ? "asset has" : "assets have"}{" "}
                        missing verified cover.
                      </p>
                    ) : null}
                    {shift.coverageStatus !== "covered" &&
                    shift.missingSkillCount === 0 &&
                    shift.equipmentWithMissingCover === 0 ? (
                      <p>
                        This shift is currently classified as{" "}
                        {COVERAGE_LABELS[shift.coverageStatus].toLowerCase()}.
                      </p>
                    ) : null}
                    {shift.contractorEngineerCount > 0 ? (
                      <p>
                        {shift.contractorEngineerCount} contractor{" "}
                        {shift.contractorEngineerCount === 1 ? "engineer is" : "engineers are"}{" "}
                        included in the roster.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-100">
                      No shift-cover issues flagged
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Link
                  to="/engineer/work"
                  onClick={onClose}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  View my work
                </Link>
                <Link
                  to="/engineer/handover"
                  onClick={onClose}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700/80 bg-[#030c1d] px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  View shift handover
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className={`${RAISED} p-5`}>
                <span className="inline-flex rounded-lg border border-slate-700/70 bg-slate-800/35 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  Off
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-100">
                  You are not rostered on this date
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  No day or night shift for {engineer.fullName} appears in the verified rota evidence.
                </p>
              </div>

              <Link
                to="/engineer/work"
                onClick={onClose}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-700/80 bg-[#030c1d] px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                View my work
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export function EngineerRotaScreen(): JSX.Element {
  const { session, siteContext } = useAuth();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [snapshot, setSnapshot] = useState<OperationalRotaSnapshot | null>(null);
  const [engineer, setEngineer] = useState<EngineerRosterIdentity | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const visibleMonthKey = `${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`;

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const resolvedEngineer = await resolveAuthenticatedEngineerIdentity(session);
        if (!resolvedEngineer) {
          throw new Error(
            "Vorta could not uniquely match this signed-in account to an engineer profile.",
          );
        }

        const authorisedSiteId = siteContext?.siteId ?? resolvedEngineer.siteId;
        if (!authorisedSiteId) {
          throw new Error("No authorised site is available for this engineer.");
        }

        if (
          siteContext?.siteId &&
          resolvedEngineer.siteId &&
          siteContext.siteId !== resolvedEngineer.siteId
        ) {
          throw new Error(
            "The engineer profile does not match the currently authorised site.",
          );
        }

        const gridStart = startOfCalendarGrid(visibleMonth);
        const gridEnd = addDays(endOfCalendarGrid(visibleMonth), 14);
        const data = await getOperationalRotaSnapshot(
          authorisedSiteId,
          dateOnly(gridStart),
          dateOnly(gridEnd),
        );

        if (cancelled) return;
        setEngineer(resolvedEngineer);
        setSnapshot(data);
      } catch (loadError) {
        if (cancelled) return;
        setEngineer(null);
        setSnapshot(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Your rota could not be loaded.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session, siteContext?.siteId, visibleMonthKey, reloadToken]);

  useEffect(() => {
    if (!selectedDate) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setSelectedDate(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDate]);

  const calendarDays = useMemo(() => {
    const start = startOfCalendarGrid(visibleMonth);
    const end = endOfCalendarGrid(visibleMonth);
    const days: Date[] = [];

    for (
      let cursor = new Date(start);
      cursor.getTime() <= end.getTime();
      cursor = addDays(cursor, 1)
    ) {
      days.push(cursor);
    }

    return days;
  }, [visibleMonthKey]);

  const personalShifts = useMemo(() => {
    if (!snapshot || !engineer) return [];
    return snapshot.calendar
      .filter((item) => isEngineerOnShift(item, engineer.fullName))
      .sort((left, right) => left.shiftDate.localeCompare(right.shiftDate));
  }, [snapshot, engineer]);

  const shiftByDate = useMemo(() => {
    const entries = new Map<string, OperationalRotaCalendarItem>();
    for (const item of personalShifts) {
      if (!entries.has(item.shiftDate)) entries.set(item.shiftDate, item);
    }
    return entries;
  }, [personalShifts]);

  const today = new Date();
  const todayKey = dateOnly(today);
  const viewingCurrentMonth = sameMonth(visibleMonth, today);

  const summaryShift = useMemo(() => {
    if (personalShifts.length === 0) return null;

    if (viewingCurrentMonth) {
      return (
        personalShifts.find((item) => item.shiftDate >= todayKey) ?? null
      );
    }

    const monthStart = dateOnly(startOfMonth(visibleMonth));
    const monthEnd = dateOnly(endOfMonth(visibleMonth));
    return (
      personalShifts.find(
        (item) => item.shiftDate >= monthStart && item.shiftDate <= monthEnd,
      ) ?? null
    );
  }, [
    personalShifts,
    todayKey,
    viewingCurrentMonth,
    visibleMonthKey,
  ]);

  const selectedShift = selectedDate
    ? selectedShiftForDate(snapshot, selectedDate, engineer?.fullName ?? null)
    : null;

  const goToMonth = (offset: number): void => {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
    setSelectedDate(null);
  };

  const goToToday = (): void => {
    setVisibleMonth(startOfMonth(new Date()));
    setSelectedDate(null);
  };

  return (
    <div
      data-vorta-page-content="true"
      data-vorta-engineer-rota="true"
      className="min-h-full w-full min-w-0 flex-1"
    >
      <div className={PAGE}>
        <header className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-blue-400">
              Engineer
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-50 md:text-2xl">
              My rota
            </h1>
            <p className="mt-1 text-xs leading-5 text-slate-500 md:text-sm">
              Your personal shifts, month at a glance.
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/[0.08] text-blue-300">
            <CalendarDays className="h-5 w-5" />
          </div>
        </header>

        {loading ? (
          <LoadingCalendar />
        ) : error ? (
          <section className={`${CARD} p-5`} role="alert">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/[0.08] text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-slate-100">
                  Personal rota unavailable
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadToken((value) => value + 1)}
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-3.5 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            </div>
          </section>
        ) : engineer && snapshot ? (
          <>
            <section className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/75 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {viewingCurrentMonth ? "Next shift" : "First shift this month"}
                  </p>
                  {summaryShift ? (
                    <div className="mt-1.5 flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold ${shiftTone(
                          summaryShift,
                        )}`}
                      >
                        {shiftShortLabel(summaryShift)}
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {shortDateTitle(summaryShift.shiftDate)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm font-semibold text-slate-300">
                      No rostered shift in this view
                    </p>
                  )}
                </div>

                {summaryShift ? (
                  <div className="hidden text-right sm:block">
                    <p className="text-xs font-medium text-slate-300">
                      {summaryShift.teamNames.join(" · ") || "Shift team"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {COVERAGE_LABELS[summaryShift.coverageStatus]}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
                <button
                  type="button"
                  onClick={() => goToMonth(-1)}
                  aria-label="Previous month"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/75 bg-[#07172b] text-slate-300 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="min-w-0 text-center">
                  <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-slate-100">
                    {monthTitle(visibleMonth)}
                  </h2>
                  <button
                    type="button"
                    onClick={goToToday}
                    className="mt-0.5 text-[11px] font-medium text-blue-400 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    Today
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => goToMonth(1)}
                  aria-label="Next month"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700/75 bg-[#07172b] text-slate-300 transition-colors hover:border-blue-400/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="px-2 pb-3 sm:px-4 sm:pb-4">
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-600 sm:text-[10px]"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
                  {calendarDays.map((date) => {
                    const key = dateOnly(date);
                    const shift = shiftByDate.get(key) ?? null;
                    const inMonth = sameMonth(date, visibleMonth);
                    const isToday = key === todayKey;
                    const attention = shift ? needsAttention(shift) : false;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDate(key)}
                        aria-label={`${fullDateTitle(key)}. ${
                          shift ? shiftLabel(shift) : "Off"
                        }`}
                        className={[
                          "relative flex min-h-[68px] min-w-0 flex-col items-center rounded-xl border px-0.5 py-1.5 text-center transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:min-h-[78px] sm:px-1 sm:py-2",
                          inMonth
                            ? "border-slate-800/80 bg-[#07172b]/75 hover:border-slate-700"
                            : "border-slate-900/80 bg-slate-950/20 opacity-40",
                          isToday
                            ? "ring-1 ring-inset ring-blue-400/80"
                            : "",
                        ].join(" ")}
                      >
                        <span
                          className={`text-[10px] font-semibold ${
                            isToday ? "text-blue-300" : "text-slate-400"
                          }`}
                        >
                          {date.getDate()}
                        </span>

                        <span
                          className={[
                            "mt-auto inline-flex w-full min-w-0 items-center justify-center rounded-md border px-0.5 py-1 text-[9px] font-semibold leading-none sm:px-1 sm:text-[10px]",
                            shift
                              ? shiftTone(shift)
                              : "border-transparent bg-slate-800/25 text-slate-600",
                          ].join(" ")}
                        >
                          {shift ? shiftShortLabel(shift) : "Off"}
                        </span>

                        {attention ? (
                          <span
                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-800/65 pt-3 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-sm border border-blue-400/35 bg-blue-500/20" />
                    Day
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-sm border border-indigo-400/35 bg-indigo-500/20" />
                    Night
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-sm bg-slate-800/60" />
                    Off
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-amber-400" />
                    Shift attention
                  </span>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2.5">
              <div className={`${RAISED} p-3.5`}>
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Pattern
                  </p>
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-slate-200">
                  {engineer.shiftPattern || "From live rota"}
                </p>
              </div>

              <div className={`${RAISED} p-3.5`}>
                <div className="flex items-center gap-2 text-slate-500">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                    Source
                  </p>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-200">
                  Verified rota
                </p>
              </div>
            </section>
          </>
        ) : null}
      </div>

      {selectedDate && engineer && typeof document !== "undefined"
        ? createPortal(
            <DaySheet
              date={selectedDate}
              engineer={engineer}
              shift={selectedShift}
              onClose={() => setSelectedDate(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
