import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { useAuth } from "../../lib/auth";
import {
  getOperationalRotaSnapshot,
  type OperationalRotaCalendarItem,
  type OperationalRotaCoverageStatus,
  type OperationalRotaShiftType,
  type OperationalRotaSnapshot,
  type OperationalRotaTeam,
} from "./operationalRotaService";

const DAY_MS = 24 * 60 * 60 * 1000;

type RotaFilter = "all" | "day" | "night" | "contractors";
type RotaView = "week" | "month";

interface CellEvidence {
  team: OperationalRotaTeam;
  shiftDate: string;
  shiftType: OperationalRotaShiftType;
  engineerNames: string[];
  requiredHeadcount: number;
  coverageStatus: OperationalRotaCoverageStatus;
  aggregate: OperationalRotaCalendarItem;
}

const FILTERS: { id: RotaFilter; label: string }[] = [
  { id: "all", label: "All Teams" },
  { id: "day", label: "Day" },
  { id: "night", label: "Night" },
  { id: "contractors", label: "Contractors" },
];

const COVERAGE_LABELS: Record<OperationalRotaCoverageStatus, string> = {
  covered: "Fully Covered",
  reduced: "Reduced Cover",
  partial: "Partial Cover",
  gap: "Critical Gap",
  contractor: "Contractor Cover",
};

const TEAM_ORDER: Record<string, number> = {
  YELLOW: 0,
  RED: 1,
  GREEN: 2,
  BLUE: 3,
  DAYS: 4,
};

function teamTone(team: OperationalRotaTeam): string {
  switch (team.code.toUpperCase()) {
    case "YELLOW":
      return "border-yellow-500/30 bg-yellow-500/20 text-yellow-300";
    case "RED":
      return "border-red-500/30 bg-red-500/20 text-red-300";
    case "GREEN":
      return "border-emerald-500/30 bg-emerald-500/20 text-emerald-300";
    case "BLUE":
      return "border-blue-500/30 bg-blue-500/20 text-blue-300";
    default:
      return "border-slate-500/30 bg-slate-500/20 text-slate-300";
  }
}

function coverageTone(status: OperationalRotaCoverageStatus): string {
  switch (status) {
    case "gap":
      return "border-red-500/35 bg-red-500/20 text-red-300";
    case "partial":
      return "border-orange-500/35 bg-orange-500/20 text-orange-300";
    case "reduced":
      return "border-amber-500/35 bg-amber-500/20 text-amber-300";
    case "contractor":
      return "border-blue-500/35 bg-blue-500/20 text-blue-300";
    default:
      return "border-emerald-500/35 bg-emerald-500/20 text-emerald-300";
  }
}

function startOfWeek(value: Date): Date {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function dateOnly(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateOrdinal(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function shiftForTeam(
  team: OperationalRotaTeam,
  shiftDate: string,
): OperationalRotaShiftType | "off" {
  const date = new Date(`${shiftDate}T00:00:00Z`);
  if (team.patternType === "days") {
    const day = date.getUTCDay();
    return day >= 1 && day <= 5 ? "day" : "off";
  }

  const offsetDays = Math.floor(
    (dateOrdinal(shiftDate) - dateOrdinal(team.referenceDate)) / DAY_MS,
  );
  const cycleIndex = ((offsetDays + team.cycleOffset) % 8 + 8) % 8;
  if (cycleIndex === 0 || cycleIndex === 1) return "day";
  if (cycleIndex === 2 || cycleIndex === 3) return "night";
  return "off";
}

function normaliseName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function formatSourceTimestamp(value: string | null): string {
  if (!value) return "Source timestamp unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Source timestamp unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusForTeam(
  requiredHeadcount: number,
  scheduledHeadcount: number,
  aggregate: OperationalRotaCalendarItem,
): OperationalRotaCoverageStatus {
  if (scheduledHeadcount === 0) return "gap";
  if (scheduledHeadcount < requiredHeadcount) {
    return scheduledHeadcount * 2 <= requiredHeadcount ? "partial" : "reduced";
  }
  return aggregate.coverageStatus;
}

function requiredForShift(
  teams: OperationalRotaTeam[],
  shiftDate: string,
  shiftType: OperationalRotaShiftType,
): number {
  return teams
    .filter((team) => shiftForTeam(team, shiftDate) === shiftType)
    .reduce((total, team) => total + team.requiredHeadcount, 0);
}

function cellIndicator(
  cell: CellEvidence,
  smeDependencyCount: number,
): { className: string; label: string } | null {
  if (cell.aggregate.missingSkillCount > 0) {
    return { className: "bg-red-500", label: "Missing skill" };
  }
  if (cell.engineerNames.length < cell.requiredHeadcount) {
    return { className: "bg-amber-400", label: "Reduced resilience" };
  }
  if (cell.aggregate.contractorEngineerCount > 0) {
    return { className: "bg-blue-400", label: "Contractor involved" };
  }
  if (smeDependencyCount > 0 && cell.aggregate.labourRiskScore >= 20) {
    return { className: "bg-purple-400", label: "SME dependency" };
  }
  return null;
}

function reasonForCell(cell: CellEvidence): string {
  const scheduled = cell.engineerNames.length;
  const required = cell.requiredHeadcount;
  if (scheduled < required) {
    return `Configured staffing is ${required}. Only ${scheduled} authorised engineer${
      scheduled === 1 ? "" : "s"
    } ${scheduled === 1 ? "is" : "are"} rostered, so this shift cannot be Fully Covered.`;
  }
  if (cell.aggregate.missingSkillCount > 0) {
    return `Configured headcount is met, but ${cell.aggregate.missingSkillCount} required skill ${
      cell.aggregate.missingSkillCount === 1 ? "gap remains" : "gaps remain"
    } in the verified Shift Cover evidence.`;
  }
  if (cell.aggregate.contractorEngineerCount > 0) {
    return `${cell.aggregate.contractorEngineerCount} contractor ${
      cell.aggregate.contractorEngineerCount === 1 ? "engineer is" : "engineers are"
    } included in the verified cover for this shift.`;
  }
  if (cell.coverageStatus === "covered") {
    return "Configured headcount is met and the verified Shift Cover risk remains below reduced-cover thresholds.";
  }
  return `Headcount is met, but the verified Shift Cover calculation rates this shift as ${COVERAGE_LABELS[
    cell.coverageStatus
  ].toLowerCase()}.`;
}

function RotaEvidenceDrawer({
  cell,
  onClose,
}: {
  cell: CellEvidence | null;
  onClose: () => void;
}): JSX.Element {
  return (
    <DetailDrawer open={Boolean(cell)} onClose={onClose}>
      {cell ? (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-gray-800 p-5">
            <div className="min-w-0 pr-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`border ${teamTone(cell.team)}`}>{cell.team.name}</Badge>
                <Badge className={`border ${coverageTone(cell.coverageStatus)}`}>
                  {COVERAGE_LABELS[cell.coverageStatus]}
                </Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-slate-50">
                {new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(new Date(`${cell.shiftDate}T12:00:00Z`))}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {cell.shiftType === "day" ? "Day" : "Night"} shift · verified rota evidence
              </p>
            </div>
            <DrawerCloseButton onClose={onClose} />
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Staffing", `${cell.engineerNames.length}/${cell.requiredHeadcount}`],
                ["Labour risk", `${Math.round(cell.aggregate.labourRiskScore)}/100`],
                ["Risk level", cell.aggregate.labourRiskLevel],
                ["Missing skills", String(cell.aggregate.missingSkillCount)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
                </div>
              ))}
            </div>

            <section className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Rostered engineers
              </h3>
              {cell.engineerNames.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  {cell.engineerNames.map((engineerName) => (
                    <div
                      key={engineerName}
                      className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#111620] p-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-xs font-bold text-slate-200">
                        {initials(engineerName)}
                      </span>
                      <span className="text-sm font-medium text-slate-200">{engineerName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-red-300">No authorised engineers are rostered.</p>
              )}
            </section>

            <section className="mt-5 rounded-lg border border-gray-800 bg-[#111620] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Why this status
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{reasonForCell(cell)}</p>
            </section>

            <section className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Contractors
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-200">
                  {cell.aggregate.contractorEngineerCount}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#111620] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Assets missing cover
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-200">
                  {cell.aggregate.equipmentWithMissingCover}
                </p>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

export function OperationalRotaRiskMap(): JSX.Element {
  const { siteContext } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedView, setSelectedView] = useState<RotaView>("week");
  const [activeFilter, setActiveFilter] = useState<RotaFilter>("all");
  const [snapshot, setSnapshot] = useState<OperationalRotaSnapshot | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellEvidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => {
    if (selectedView === "week") {
      const start = startOfWeek(selectedDate);
      return { start, end: addDays(start, 6) };
    }
    return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
  }, [selectedDate, selectedView]);

  const startDate = dateOnly(period.start);
  const endDate = dateOnly(period.end);

  const loadRota = useCallback(async (): Promise<void> => {
    const siteId = siteContext?.siteId;
    if (!siteId) {
      setSnapshot(null);
      setError("No authorised active site is available for rota evidence.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await getOperationalRotaSnapshot(siteId, startDate, endDate);
      setSnapshot(next);
      setSelectedCell(null);
    } catch (loadError) {
      setSnapshot(null);
      setSelectedCell(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Verified operational rota evidence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [endDate, siteContext?.siteId, startDate]);

  useEffect(() => {
    void loadRota();
  }, [loadRota]);

  const sortedTeams = useMemo(
    () =>
      [...(snapshot?.teams ?? [])].sort((left, right) => {
        const leftOrder = TEAM_ORDER[left.code.toUpperCase()] ?? 50;
        const rightOrder = TEAM_ORDER[right.code.toUpperCase()] ?? 50;
        return leftOrder - rightOrder || left.name.localeCompare(right.name);
      }),
    [snapshot?.teams],
  );

  const calendarMap = useMemo(() => {
    const map = new Map<string, OperationalRotaCalendarItem>();
    for (const item of snapshot?.calendar ?? []) {
      map.set(`${item.shiftDate}:${item.shiftType}`, item);
    }
    return map;
  }, [snapshot?.calendar]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(startOfWeek(selectedDate), index);
        return { date, key: dateOnly(date) };
      }),
    [selectedDate],
  );

  const visibleTeams = useMemo(() => {
    if (activeFilter !== "contractors") return sortedTeams;
    return sortedTeams.filter((team) =>
      (snapshot?.calendar ?? []).some((item) => {
        if (item.contractorEngineerCount === 0) return false;
        return shiftForTeam(team, item.shiftDate) === item.shiftType;
      }),
    );
  }, [activeFilter, snapshot?.calendar, sortedTeams]);

  const cellFor = useCallback(
    (
      team: OperationalRotaTeam,
      shiftDate: string,
      shiftType: OperationalRotaShiftType,
    ): CellEvidence | null => {
      if (shiftForTeam(team, shiftDate) !== shiftType) return null;
      const aggregate = calendarMap.get(`${shiftDate}:${shiftType}`);
      if (!aggregate) return null;

      const aggregateNames = new Map(
        aggregate.engineerNames.map((name) => [normaliseName(name), name]),
      );
      const names = team.memberNames
        .map((memberName) => aggregateNames.get(normaliseName(memberName)))
        .filter((name): name is string => Boolean(name));

      const activeTeams = sortedTeams.filter(
        (candidate) => shiftForTeam(candidate, shiftDate) === shiftType,
      );
      const configuredNames = new Set(
        activeTeams.flatMap((candidate) =>
          candidate.memberNames.map((name) => normaliseName(name)),
        ),
      );
      const extraNames = aggregate.engineerNames.filter(
        (name) => !configuredNames.has(normaliseName(name)),
      );
      const coverTarget =
        activeTeams.find((candidate) => candidate.patternType === "continental") ??
        activeTeams[0];
      if (coverTarget?.id === team.id) {
        for (const extraName of extraNames) {
          if (!names.some((name) => normaliseName(name) === normaliseName(extraName))) {
            names.push(extraName);
          }
        }
      }

      return {
        team,
        shiftDate,
        shiftType,
        engineerNames: names,
        requiredHeadcount: team.requiredHeadcount,
        coverageStatus: statusForTeam(team.requiredHeadcount, names.length, aggregate),
        aggregate,
      };
    },
    [calendarMap, sortedTeams],
  );

  const goPrevious = (): void => {
    setSelectedDate((current) => {
      const next = new Date(current);
      if (selectedView === "week") next.setDate(next.getDate() - 7);
      else next.setMonth(next.getMonth() - 1);
      return next;
    });
  };

  const goNext = (): void => {
    setSelectedDate((current) => {
      const next = new Date(current);
      if (selectedView === "week") next.setDate(next.getDate() + 7);
      else next.setMonth(next.getMonth() + 1);
      return next;
    });
  };

  const periodLabel =
    selectedView === "week"
      ? `Week of ${period.start.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : selectedDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const showDay = activeFilter !== "night";
  const showNight = activeFilter !== "day";

  return (
    <section
      data-vorta-operational-rota-risk-map="true"
      data-vorta-active-site={siteContext?.siteId ?? ""}
      className="flex w-full min-w-0 flex-1 flex-col gap-5 overflow-x-hidden px-4 pb-12 pt-4 md:px-6 xl:px-8"
    >
      <RotaEvidenceDrawer cell={selectedCell} onClose={() => setSelectedCell(null)} />

      <div className="rounded-xl border border-gray-800 bg-[#141820] p-5 shadow-none">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold text-slate-50">Operational Rota Risk Map</h1>
              <Badge className="border border-blue-500/25 bg-blue-500/10 text-[10px] text-blue-300">
                {selectedView === "week" ? "7-DAY LOOKAHEAD" : "MONTH VIEW"}
              </Badge>
              <Badge className="border border-emerald-500/25 bg-emerald-500/10 text-[10px] text-emerald-300">
                VERIFIED SHIFT CALENDAR
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Fully Covered requires the configured team headcount as well as acceptable verified
              Shift Cover risk.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-[10px] xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {[
                ["Fully Covered", "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"],
                ["Reduced Cover", "border-amber-500/30 bg-amber-500/20 text-amber-300"],
                ["Partial Cover", "border-orange-500/30 bg-orange-500/20 text-orange-300"],
                ["Critical Gap", "border-red-500/30 bg-red-500/20 text-red-300"],
                ["Contractor Cover", "border-blue-500/30 bg-blue-500/20 text-blue-300"],
              ].map(([label, className]) => (
                <span key={label} className={`rounded border px-2 py-1 ${className}`}>
                  {label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Risk indicators</span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-full bg-red-500" /> Missing Skill
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-full bg-amber-400" /> Reduced Resilience
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-full bg-purple-400" /> SME Dependency
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-full bg-blue-400" /> Contractor Involved
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  activeFilter === filter.id
                    ? "border-blue-500/60 bg-blue-500/15 text-blue-200"
                    : "border-gray-700 bg-white/[0.04] text-slate-400 hover:border-gray-600 hover:text-slate-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="rounded-md border border-gray-700 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:border-gray-600"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goPrevious}
              aria-label={`Previous ${selectedView}`}
              className="rounded-md border border-gray-700 bg-white/[0.04] p-2 text-slate-400 hover:text-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-xs font-semibold text-slate-300">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={goNext}
              aria-label={`Next ${selectedView}`}
              className="rounded-md border border-gray-700 bg-white/[0.04] p-2 text-slate-400 hover:text-slate-200"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {(["week", "month"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setSelectedView(view)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold capitalize ${
                  selectedView === view
                    ? "border-blue-500/60 bg-blue-500/15 text-blue-200"
                    : "border-gray-700 bg-white/[0.04] text-slate-400"
                }`}
              >
                {view}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadRota()}
              disabled={loading}
              aria-label="Refresh verified rota evidence"
              className="rounded-md border border-gray-700 bg-white/[0.04] p-2 text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 flex min-h-[360px] items-center justify-center rounded-lg border border-gray-800 bg-[#111620]">
            <span className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
              Loading verified rota evidence…
            </span>
          </div>
        ) : error ? (
          <div
            className="mt-5 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-5"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <h2 className="font-semibold text-red-200">Operational rota evidence unavailable</h2>
                <p className="mt-2 text-sm leading-6 text-red-100/75">{error}</p>
                <p className="mt-2 text-xs text-slate-500">
                  The rota fails closed rather than showing an unverified green status.
                </p>
              </div>
            </div>
          </div>
        ) : !snapshot || snapshot.teams.length === 0 ? (
          <div className="mt-5 rounded-lg border border-gray-800 bg-[#111620] p-8 text-center">
            <Users className="mx-auto h-6 w-6 text-slate-600" />
            <h2 className="mt-3 font-semibold text-slate-300">No active maintenance rota configured</h2>
            <p className="mt-2 text-sm text-slate-500">
              No team configuration was returned for the authorised active site.
            </p>
          </div>
        ) : selectedView === "week" ? (
          <div className="mt-5 overflow-x-auto pb-1">
            <div className="min-w-[1040px]">
              <div className="grid grid-cols-[150px_repeat(7,minmax(120px,1fr))] gap-1 border-b border-gray-800 pb-2">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Team / Shift
                </div>
                {weekDays.map((day) => (
                  <div
                    key={day.key}
                    className="px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {new Intl.DateTimeFormat("en-GB", {
                      weekday: "short",
                      day: "numeric",
                    }).format(day.date)}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-gray-800/70">
                {visibleTeams.map((team) => (
                  <div key={team.id} className="py-2.5">
                    {(["day", "night"] as const)
                      .filter((shiftType) =>
                        shiftType === "day" ? showDay : showNight,
                      )
                      .map((shiftType, rowIndex) => (
                        <div
                          key={shiftType}
                          className="grid grid-cols-[150px_repeat(7,minmax(120px,1fr))] gap-1"
                        >
                          <div className="flex min-h-[48px] items-center gap-2 px-1">
                            {rowIndex === 0 ? (
                              <Badge className={`border ${teamTone(team)}`}>{team.name}</Badge>
                            ) : (
                              <span className="w-[1px]" />
                            )}
                            <span className="ml-auto text-[10px] text-slate-500">
                              {shiftType === "day" ? "Day" : "Night"}
                            </span>
                          </div>
                          {weekDays.map((day) => {
                            const cell = cellFor(team, day.key, shiftType);
                            if (!cell) {
                              return (
                                <div
                                  key={`${team.id}:${day.key}:${shiftType}`}
                                  className="flex min-h-[48px] items-center justify-center rounded-md"
                                >
                                  <span className="text-[9px] text-slate-700">OFF</span>
                                </div>
                              );
                            }

                            const indicator = cellIndicator(
                              cell,
                              snapshot.smeDependencyCount,
                            );
                            return (
                              <button
                                key={`${team.id}:${day.key}:${shiftType}`}
                                type="button"
                                onClick={() => setSelectedCell(cell)}
                                aria-label={`${team.name} ${day.key} ${shiftType}: ${cell.engineerNames.length} of ${cell.requiredHeadcount} engineers, ${COVERAGE_LABELS[cell.coverageStatus]}`}
                                className={`relative flex min-h-[48px] flex-col rounded-md border px-2 py-1.5 text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${coverageTone(
                                  cell.coverageStatus,
                                )}`}
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="text-[9px] font-semibold uppercase opacity-70">
                                    {shiftType}
                                  </span>
                                  <span className="text-[9px] font-bold tabular-nums">
                                    {cell.engineerNames.length}/{cell.requiredHeadcount}
                                  </span>
                                </div>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1 text-[10px] font-semibold">
                                  {cell.engineerNames.length > 0 ? (
                                    cell.engineerNames.map((engineerName) => (
                                      <span key={engineerName} title={engineerName}>
                                        {initials(engineerName)}
                                      </span>
                                    ))
                                  ) : (
                                    <span>GAP</span>
                                  )}
                                </div>
                                {indicator ? (
                                  <span
                                    className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${indicator.className}`}
                                    title={indicator.label}
                                    aria-label={indicator.label}
                                  />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto pb-1">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 gap-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div
                    key={day}
                    className="px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {day}
                  </div>
                ))}
                {Array.from(
                  {
                    length:
                      ((period.start.getDay() || 7) - 1) +
                      period.end.getDate(),
                  },
                  (_, index) => {
                    const leading = (period.start.getDay() || 7) - 1;
                    if (index < leading) {
                      return <div key={`blank:${index}`} className="min-h-[92px]" />;
                    }
                    const date = new Date(
                      selectedDate.getFullYear(),
                      selectedDate.getMonth(),
                      index - leading + 1,
                    );
                    const key = dateOnly(date);
                    return (
                      <div
                        key={key}
                        className="min-h-[92px] rounded-lg border border-gray-800 bg-[#111620] p-2"
                      >
                        <p className="text-xs font-semibold text-slate-300">{date.getDate()}</p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          {(["day", "night"] as const).map((shiftType) => {
                            const aggregate = calendarMap.get(`${key}:${shiftType}`);
                            const required = requiredForShift(sortedTeams, key, shiftType);
                            if (!aggregate || required === 0) {
                              return (
                                <div
                                  key={shiftType}
                                  className="flex items-center justify-between text-[9px] text-slate-700"
                                >
                                  <span className="capitalize">{shiftType}</span>
                                  <span>OFF</span>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={shiftType}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-[9px] capitalize text-slate-500">
                                  {shiftType}
                                </span>
                                <Badge
                                  className={`border px-1.5 py-0.5 text-[9px] ${coverageTone(
                                    aggregate.coverageStatus,
                                  )}`}
                                >
                                  {aggregate.scheduledEngineerCount}/{required}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        )}

        {snapshot ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 pt-3 text-[10px] text-slate-600">
            <span>
              Source updated {formatSourceTimestamp(snapshot.sourceUpdatedAt)} · {snapshot.teams.length} configured teams
            </span>
            <span>{snapshot.smeDependencyCount} verified equipment SME dependencies</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
