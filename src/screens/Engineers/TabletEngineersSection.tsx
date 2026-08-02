import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  RefreshCw,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth";
import {
  getVortaMaintenanceTeamPresentation,
} from "../../lib/shiftPresentation";
import {
  clearMaintenancePortalDataCache,
  supabase,
} from "../../lib/supabaseClient";
import {
  getShiftCoverSnapshot,
  type ShiftCoverCalendarItem,
  type ShiftCoverSnapshot,
  type ShiftCoverageStatus,
} from "../LabourRisk/shiftCoverService";
import { EngineerAvatar } from "./EngineerAvatar";
import {
  validateEngineersPayload,
  type LiveEngineerRecord,
  type LiveEngineersPayload,
} from "./engineersRuntimeContracts";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfWeek(value: Date): Date {
  const result = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  return result;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function dateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(value);
}

function normaliseName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const COVERAGE_PRESENTATION: Record<
  ShiftCoverageStatus,
  {
    label: string;
    card: string;
    text: string;
    dot: string;
  }
> = {
  covered: {
    label: "Covered",
    card: "border-emerald-500/25 bg-emerald-500/[0.045]",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  reduced: {
    label: "Reduced",
    card: "border-amber-500/25 bg-amber-500/[0.05]",
    text: "text-amber-300",
    dot: "bg-amber-400",
  },
  partial: {
    label: "Partial",
    card: "border-orange-500/30 bg-orange-500/[0.055]",
    text: "text-orange-300",
    dot: "bg-orange-400",
  },
  gap: {
    label: "Gap",
    card: "border-red-500/35 bg-red-500/[0.065]",
    text: "text-red-300",
    dot: "bg-red-400",
  },
  contractor: {
    label: "Contractor",
    card: "border-blue-500/30 bg-blue-500/[0.055]",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
};

function riskClass(value: string): string {
  switch (value.toLowerCase()) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "text-slate-50",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone?: string;
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-xl border border-gray-800 bg-[#141820] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </p>
        <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
      </div>
      <p className={`mt-3 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function TeamBadge({ teamName }: { teamName: string }): JSX.Element {
  const team = getVortaMaintenanceTeamPresentation(null, teamName);
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold ${team.badgeClassName}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${team.dotClassName}`} />
      <span className="truncate">{teamName}</span>
    </span>
  );
}

function ShiftCard({
  label,
  item,
}: {
  label: "Day" | "Night";
  item: ShiftCoverCalendarItem | undefined;
}): JSX.Element {
  if (!item) {
    return (
      <div className="flex min-h-[118px] flex-col rounded-xl border border-dashed border-gray-800 bg-[#0d1117] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            {label}
          </span>
          <span className="text-[10px] text-slate-700">No rota</span>
        </div>
        <p className="mt-auto text-xs leading-5 text-slate-600">
          No authorised team assignment returned.
        </p>
      </div>
    );
  }

  const coverage = COVERAGE_PRESENTATION[item.coverageStatus];

  return (
    <div className={`flex min-h-[118px] min-w-0 flex-col rounded-xl border p-3 ${coverage.card}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${coverage.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${coverage.dot}`} />
          {coverage.label}
        </span>
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
        {item.teamNames.length > 0 ? (
          item.teamNames.map((teamName) => (
            <TeamBadge key={teamName} teamName={teamName} />
          ))
        ) : (
          <span className="text-xs text-slate-500">Team not assigned</span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-200">
            {item.scheduledEngineerCount} engineer{item.scheduledEngineerCount === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {item.missingSkillCount} missing skill{item.missingSkillCount === 1 ? "" : "s"}
          </p>
        </div>
        <span className={`shrink-0 text-lg font-semibold tabular-nums ${coverage.text}`}>
          {item.labourRiskScore.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function EngineerRow({
  engineer,
  weekShifts,
}: {
  engineer: LiveEngineerRecord;
  weekShifts: ShiftCoverCalendarItem[];
}): JSX.Element {
  const teamNames = [...new Set(weekShifts.flatMap((shift) => shift.teamNames))];

  return (
    <article className="grid min-w-0 gap-4 border-b border-gray-800/70 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.8fr)_110px_130px_minmax(170px,1fr)] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <EngineerAvatar
          name={engineer.full_name}
          avatarUrl={engineer.avatar_url}
          eager={false}
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-100">
              {engineer.full_name}
            </h3>
            {engineer.verified ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Verified" />
            ) : null}
            {engineer.critical_knowledge_holder ? (
              <Shield className="h-3.5 w-3.5 shrink-0 text-blue-400" aria-label="Critical knowledge holder" />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {engineer.discipline ?? "Discipline not recorded"}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 lg:hidden">
          Department
        </p>
        <p className="mt-1 truncate text-sm text-slate-300 lg:mt-0">
          {engineer.department_name ?? "Not recorded"}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 lg:hidden">
          Capability
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100 lg:mt-0">
          {engineer.skills_score}%
        </p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 lg:hidden">
          Risk
        </p>
        <span className={`mt-1 inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold capitalize lg:mt-0 ${riskClass(engineer.risk_level)}`}>
          {engineer.risk_level}
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 lg:hidden">
          Rota team
        </p>
        <div className="mt-1 flex min-w-0 flex-wrap gap-1.5 lg:mt-0">
          {teamNames.length > 0 ? (
            teamNames.map((teamName) => <TeamBadge key={teamName} teamName={teamName} />)
          ) : (
            <span className="text-xs text-slate-500">Not scheduled this week</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function TabletEngineersSection(): JSX.Element {
  const { siteContext } = useAuth();
  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const startDate = dateOnly(weekStart);
  const endDate = dateOnly(addDays(weekStart, 6));

  const [payload, setPayload] = useState<LiveEngineersPayload | null>(null);
  const [snapshot, setSnapshot] = useState<ShiftCoverSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false): Promise<void> => {
    const siteId = siteContext?.siteId;
    const organisationId = siteContext?.organisationId;

    if (!siteId || !organisationId) {
      setPayload(null);
      setSnapshot(null);
      setError("Engineer evidence is unavailable because no authorised active site was resolved.");
      setLoading(false);
      return;
    }

    if (force) {
      clearMaintenancePortalDataCache("engineers-data");
    }

    setLoading(true);
    setError(null);

    try {
      const [engineersResult, rotaSnapshot] = await Promise.all([
        supabase.functions.invoke("engineers-data"),
        getShiftCoverSnapshot(siteId, startDate, endDate),
      ]);

      if (engineersResult.error || !engineersResult.data) {
        throw engineersResult.error ?? new Error("Engineer evidence was empty.");
      }

      const validated = validateEngineersPayload(engineersResult.data);
      if (
        validated.siteId !== siteId ||
        validated.organisationId !== organisationId ||
        rotaSnapshot.siteId !== siteId
      ) {
        throw new Error("Engineer and rota evidence does not match the authorised active site.");
      }

      setPayload(validated);
      setSnapshot(rotaSnapshot);
    } catch (loadError) {
      setPayload(null);
      setSnapshot(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Engineer and rota evidence could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [endDate, siteContext?.organisationId, siteContext?.siteId, startDate]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const key = dateOnly(date);
        return {
          date,
          key,
          day: snapshot?.calendar.find(
            (shift) => shift.shiftDate === key && shift.shiftType === "day",
          ),
          night: snapshot?.calendar.find(
            (shift) => shift.shiftDate === key && shift.shiftType === "night",
          ),
        };
      }),
    [snapshot?.calendar, weekStart],
  );

  const shiftsByEngineer = useMemo(() => {
    const result = new Map<string, ShiftCoverCalendarItem[]>();
    for (const shift of snapshot?.calendar ?? []) {
      for (const engineerName of shift.engineerNames) {
        const key = normaliseName(engineerName);
        result.set(key, [...(result.get(key) ?? []), shift]);
      }
    }
    return result;
  }, [snapshot?.calendar]);

  const filteredEngineers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (payload?.engineers ?? [])
      .filter((engineer) =>
        !query ||
        [engineer.full_name, engineer.discipline, engineer.department_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      )
      .sort((left, right) => left.full_name.localeCompare(right.full_name));
  }, [payload?.engineers, search]);

  const todayKey = dateOnly(new Date());
  const todayNames = useMemo(
    () =>
      new Set(
        (snapshot?.calendar ?? [])
          .filter((shift) => shift.shiftDate === todayKey)
          .flatMap((shift) => shift.engineerNames)
          .map(normaliseName),
      ),
    [snapshot?.calendar, todayKey],
  );

  const criticalGapCount =
    snapshot?.calendar.filter((shift) => shift.coverageStatus === "gap").length ?? 0;
  const siteName = payload?.engineers.find((engineer) => engineer.site_name)?.site_name ?? "Active site";

  return (
    <section
      data-vorta-tablet-engineers="true"
      className="flex w-full min-w-0 flex-col gap-6 overflow-x-hidden px-5 pb-12 pt-5 lg:px-7 xl:px-8"
    >
      <header className="flex flex-col gap-4 border-b border-gray-800 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">
            Workforce capability and rota
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Engineers</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Current engineer capability combined with the authoritative rotating-shift calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-[#141820] px-4 text-sm font-semibold text-slate-200 hover:border-blue-500/40 hover:text-blue-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-gray-800 bg-[#141820]">
          <span className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-400" aria-hidden="true" />
            Loading workforce and rota evidence…
          </span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.07] p-5" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-semibold text-red-200">Engineer evidence unavailable</h2>
              <p className="mt-2 text-sm leading-6 text-red-100/80">{error}</p>
              <button
                type="button"
                onClick={() => void load(true)}
                className="mt-4 min-h-10 rounded-lg border border-red-400/30 px-4 text-sm font-semibold text-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : payload && snapshot ? (
        <>
          <div className="flex flex-col gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.045] px-4 py-3 text-sm text-slate-300 lg:flex-row lg:items-center lg:justify-between">
            <span>
              <strong className="text-slate-100">{siteName}</strong> · {payload.engineers.length} engineer records
            </span>
            <div className="flex flex-wrap gap-2">
              {snapshot.teams.map((team) => (
                <TeamBadge key={team.id} teamName={team.name} />
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Engineers"
              value={String(payload.stats.totalEngineers)}
              detail={`${payload.stats.verifiedEngineers} verified records`}
              icon={Users}
            />
            <MetricCard
              label="Scheduled today"
              value={String(
                payload.engineers.filter((engineer) =>
                  todayNames.has(normaliseName(engineer.full_name)),
                ).length,
              )}
              detail="Named on the current day or night rota"
              icon={CalendarDays}
              tone="text-blue-300"
            />
            <MetricCard
              label="Critical holders"
              value={String(payload.stats.criticalHolders)}
              detail="Single-person knowledge exposure"
              icon={Shield}
              tone="text-amber-300"
            />
            <MetricCard
              label="Coverage gaps"
              value={String(criticalGapCount)}
              detail={`${snapshot.completeness.completenessPercent}% rota completeness`}
              icon={AlertTriangle}
              tone={criticalGapCount > 0 ? "text-red-300" : "text-emerald-300"}
            />
          </div>

          <section className="rounded-xl border border-gray-800 bg-[#141820] p-4 lg:p-5">
            <div className="flex flex-col gap-2 border-b border-gray-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-50">Team availability</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Rotating team colours and cover status from the current shift calendar.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {formatDate(weekStart)} to {formatDate(addDays(weekStart, 6))}
              </span>
            </div>

            <div className="mt-4 overflow-x-auto pb-2">
              <div className="grid min-w-[1120px] grid-cols-7 gap-3">
                {weekDays.map(({ date, key, day, night }) => (
                  <div key={key} className="min-w-0">
                    <div className="mb-2 rounded-lg border border-gray-800 bg-[#0d1117] px-3 py-2 text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                        {new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date)}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-200">
                        {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <ShiftCard label="Day" item={day} />
                      <ShiftCard label="Night" item={night} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-xl border border-gray-800 bg-[#141820]">
            <div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-slate-50">Engineer register</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredEngineers.length} of {payload.engineers.length} engineers
                </p>
              </div>
              <label className="relative block w-full lg:w-[22rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <span className="sr-only">Search engineers</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search engineer, discipline or department"
                  className="h-10 w-full rounded-lg border border-gray-800 bg-[#0d1117] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </label>
            </div>

            <div className="hidden grid-cols-[minmax(220px,1.35fr)_minmax(150px,0.8fr)_110px_130px_minmax(170px,1fr)] gap-4 border-b border-gray-800 bg-[#0d1117] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 lg:grid">
              <span>Engineer</span>
              <span>Department</span>
              <span>Capability</span>
              <span>Risk</span>
              <span>Rota team</span>
            </div>

            <div>
              {filteredEngineers.map((engineer) => (
                <EngineerRow
                  key={engineer.id}
                  engineer={engineer}
                  weekShifts={shiftsByEngineer.get(normaliseName(engineer.full_name)) ?? []}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
