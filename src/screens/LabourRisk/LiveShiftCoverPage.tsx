import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../../lib/auth";
import {
  getShiftCoverSnapshot,
  type ShiftCoverCalendarItem,
  type ShiftCoverSnapshot,
  type ShiftCoverageStatus,
} from "./shiftCoverService";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeek(value: Date): Date {
  const date = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatTimestamp(value: string | null): string {
  if (!value) return "No source timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Source timestamp unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const STATUS_PRESENTATION: Record<
  ShiftCoverageStatus,
  {
    label: string;
    border: string;
    background: string;
    text: string;
    dot: string;
  }
> = {
  covered: {
    label: "Fully covered",
    border: "border-emerald-500/25",
    background: "bg-emerald-500/[0.06]",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  reduced: {
    label: "Reduced resilience",
    border: "border-amber-500/25",
    background: "bg-amber-500/[0.06]",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  partial: {
    label: "Partial cover",
    border: "border-orange-500/30",
    background: "bg-orange-500/[0.07]",
    text: "text-orange-300",
    dot: "bg-orange-400",
  },
  gap: {
    label: "Critical gap",
    border: "border-red-500/35",
    background: "bg-red-500/[0.08]",
    text: "text-red-300",
    dot: "bg-red-400",
  },
  contractor: {
    label: "Contractor cover",
    border: "border-blue-500/30",
    background: "bg-blue-500/[0.07]",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
};

function ShiftCard({
  item,
  selected,
  onSelect,
}: {
  item: ShiftCoverCalendarItem;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const presentation = STATUS_PRESENTATION[item.coverageStatus];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-[132px] w-full flex-col rounded-xl border p-3 text-left transition-colors ${presentation.border} ${presentation.background} ${
        selected
          ? "ring-2 ring-blue-500/60"
          : "hover:border-blue-500/35 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {item.shiftType === "night" ? "Night" : "Day"}
        </span>
        <span className={`h-2 w-2 rounded-full ${presentation.dot}`} />
      </div>

      <p className={`mt-3 text-sm font-bold ${presentation.text}`}>
        {presentation.label}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {item.scheduledEngineerCount} engineer
        {item.scheduledEngineerCount === 1 ? "" : "s"}
        {item.contractorEngineerCount > 0
          ? ` · ${item.contractorEngineerCount} contractor`
          : ""}
      </p>

      <div className="mt-auto flex w-full items-end justify-between gap-3 pt-3">
        <span className="truncate text-[11px] text-slate-500">
          {item.teamNames.join(" · ") || "No scheduled team"}
        </span>
        <span className={`text-lg font-bold tabular-nums ${presentation.text}`}>
          {item.labourRiskScore.toFixed(1)}
        </span>
      </div>
    </button>
  );
}

export function LiveShiftCoverPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { siteContext } = useAuth();
  const selectedArea = searchParams.get("area")?.trim() ?? "";

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date()),
  );
  const [snapshot, setSnapshot] =
    useState<ShiftCoverSnapshot | null>(null);
  const [selectedShift, setSelectedShift] =
    useState<ShiftCoverCalendarItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDate = formatDateOnly(weekStart);
  const endDate = formatDateOnly(addDays(weekStart, 6));

  const loadSnapshot = useCallback(async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    if (!siteId) {
      setSnapshot(null);
      setSelectedShift(null);
      setError(
        "Shift Cover is unavailable because no authorised active site was resolved.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextSnapshot = await getShiftCoverSnapshot(
        siteId,
        startDate,
        endDate,
      );
      setSnapshot(nextSnapshot);
      setSelectedShift((current) => {
        const currentMatch = current
          ? nextSnapshot.calendar.find(
              (item) =>
                item.shiftDate === current.shiftDate &&
                item.shiftType === current.shiftType,
            )
          : null;

        return (
          currentMatch ??
          nextSnapshot.calendar
            .slice()
            .sort(
              (a, b) =>
                b.labourRiskScore - a.labourRiskScore,
            )[0] ??
          null
        );
      });
    } catch (loadError) {
      setSnapshot(null);
      setSelectedShift(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Shift Cover could not load verified site data.",
      );
    } finally {
      setLoading(false);
    }
  }, [endDate, siteContext?.siteId, startDate]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const dateKey = formatDateOnly(date);
        return {
          date,
          dateKey,
          day: snapshot?.calendar.find(
            (item) =>
              item.shiftDate === dateKey && item.shiftType === "day",
          ),
          night: snapshot?.calendar.find(
            (item) =>
              item.shiftDate === dateKey && item.shiftType === "night",
          ),
        };
      }),
    [snapshot?.calendar, weekStart],
  );

  const criticalGapCount =
    snapshot?.calendar.filter((item) => item.coverageStatus === "gap")
      .length ?? 0;
  const contractorShiftCount =
    snapshot?.calendar.filter(
      (item) => item.contractorEngineerCount > 0,
    ).length ?? 0;
  const averageRisk = snapshot?.calendar.length
    ? snapshot.calendar.reduce(
        (sum, item) => sum + item.labourRiskScore,
        0,
      ) / snapshot.calendar.length
    : 0;

  return (
    <section className="flex w-full flex-col gap-6 px-4 pb-12 pt-4 md:px-6 xl:px-8">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Operations Overview
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">
              Shift Cover Risk
            </h1>
            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold tracking-[0.12em] text-emerald-300">
              LIVE ROTA
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Verified shift teams, engineer availability and required-skill exposure.
          </p>
          {selectedArea ? (
            <p className="mt-2 text-xs text-blue-300">
              Dashboard context: {selectedArea}. Calendar coverage remains site-wide so cross-area support is visible.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((date) => addDays(date, -7))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-800 bg-[#141820] text-slate-300 hover:border-gray-700 hover:bg-gray-800"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="inline-flex min-h-10 items-center rounded-lg border border-gray-800 bg-[#141820] px-4 text-sm font-semibold text-slate-200 hover:border-gray-700 hover:bg-gray-800"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((date) => addDays(date, 7))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-800 bg-[#141820] text-slate-300 hover:border-gray-700 hover:bg-gray-800"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 py-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-semibold text-red-200">
              Verified Shift Cover data is unavailable
            </p>
            <p className="mt-1 text-xs leading-5 text-red-100/75">
              {error}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              No static roster or fabricated recommendation has been substituted.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Average labour risk
            </span>
            <ShieldAlert className="h-4 w-4 text-orange-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-50">
            {snapshot ? averageRisk.toFixed(1) : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">14 day/night shifts</p>
        </div>

        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Critical gaps
            </span>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-red-300">
            {snapshot ? criticalGapCount : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Zero-cover shifts</p>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contractor shifts
            </span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-blue-300">
            {snapshot ? contractorShiftCount : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">External cover included</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-[#141820] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Rota completeness
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-3 text-2xl font-bold tabular-nums text-slate-50">
            {snapshot
              ? `${snapshot.completeness.activeMemberCount}`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {snapshot
              ? `${snapshot.completeness.activeTeamCount} teams · ${snapshot.completeness.engineerCount} engineers`
              : "Awaiting verified data"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#141820] p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-50">
              Operational Rota Risk Map
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
              }).format(weekStart)}
              {" – "}
              {new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(addDays(weekStart, 6))}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Source updated {formatTimestamp(snapshot?.sourceUpdatedAt ?? null)}
          </p>
        </div>

        {loading && !snapshot ? (
          <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-gray-800 bg-[#0d1117]">
            <span className="inline-flex items-center gap-2 text-sm text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
              Loading verified rota and skill exposure…
            </span>
          </div>
        ) : snapshot && snapshot.calendar.length > 0 ? (
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[980px] grid-cols-7 gap-3">
              {days.map(({ date, dateKey, day, night }) => (
                <div key={dateKey} className="min-w-0">
                  <div className="mb-2 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {new Intl.DateTimeFormat("en-GB", {
                        weekday: "short",
                      }).format(date)}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-200">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                      }).format(date)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {day ? (
                      <ShiftCard
                        item={day}
                        selected={
                          selectedShift?.shiftDate === day.shiftDate &&
                          selectedShift.shiftType === day.shiftType
                        }
                        onSelect={() => setSelectedShift(day)}
                      />
                    ) : null}
                    {night ? (
                      <ShiftCard
                        item={night}
                        selected={
                          selectedShift?.shiftDate === night.shiftDate &&
                          selectedShift.shiftType === night.shiftType
                        }
                        onSelect={() => setSelectedShift(night)}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 bg-[#0d1117] px-6 text-center">
            <CalendarDays className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-semibold text-slate-300">
              No authorised rota records were returned
            </p>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
              Configure active shift teams and members for this site. Vorta will not generate placeholder engineers to fill the calendar.
            </p>
          </div>
        )}
      </div>

      {selectedShift ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <div className="rounded-xl border border-gray-800 bg-[#141820] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Selected shift
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-50">
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(parseDateOnly(selectedShift.shiftDate))}
                  {" · "}
                  {selectedShift.shiftType === "night" ? "Night" : "Day"}
                </h2>
              </div>
              <span
                className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                  STATUS_PRESENTATION[selectedShift.coverageStatus].border
                } ${STATUS_PRESENTATION[selectedShift.coverageStatus].background} ${
                  STATUS_PRESENTATION[selectedShift.coverageStatus].text
                }`}
              >
                {STATUS_PRESENTATION[selectedShift.coverageStatus].label}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <p className="text-xs text-slate-500">Labour risk</p>
                <p className="mt-1 text-lg font-bold text-slate-100">
                  {selectedShift.labourRiskScore.toFixed(1)}
                </p>
                <p className="text-xs text-orange-300">
                  {selectedShift.labourRiskLevel}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <p className="text-xs text-slate-500">Engineers</p>
                <p className="mt-1 text-lg font-bold text-slate-100">
                  {selectedShift.scheduledEngineerCount}
                </p>
                <p className="text-xs text-slate-500">Available on roster</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <p className="text-xs text-slate-500">Missing skills</p>
                <p className="mt-1 text-lg font-bold text-slate-100">
                  {selectedShift.missingSkillCount}
                </p>
                <p className="text-xs text-red-300">Required skill gaps</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <p className="text-xs text-slate-500">Assets exposed</p>
                <p className="mt-1 text-lg font-bold text-slate-100">
                  {selectedShift.equipmentWithMissingCover}
                </p>
                <p className="text-xs text-slate-500">Missing qualified cover</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Scheduled teams
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedShift.teamNames.length ? (
                    selectedShift.teamNames.map((team) => (
                      <span
                        key={team}
                        className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-300"
                      >
                        {team}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-red-300">No scheduled team</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Available engineers
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedShift.engineerNames.length ? (
                    selectedShift.engineerNames.map((engineer) => (
                      <span
                        key={engineer}
                        className="rounded-md border border-gray-700 bg-gray-800/70 px-2 py-1 text-xs text-slate-300"
                      >
                        {engineer}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-red-300">
                      No available engineers
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-xl border border-gray-800 bg-[#141820] p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Data completeness
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              These counts come from the active site configuration used to calculate this calendar.
            </p>
            <dl className="mt-4 space-y-3">
              {[
                ["Active shift teams", snapshot?.completeness.activeTeamCount],
                ["Active team members", snapshot?.completeness.activeMemberCount],
                ["Site engineers", snapshot?.completeness.engineerCount],
                ["Skill records", snapshot?.completeness.skillRecordCount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between gap-4 border-b border-gray-800 pb-3 last:border-0 last:pb-0"
                >
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-slate-200">
                    {value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
