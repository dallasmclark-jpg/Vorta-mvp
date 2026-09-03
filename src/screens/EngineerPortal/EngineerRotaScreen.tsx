import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Info,
  Moon,
  RefreshCw,
  Sun,
  Users,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { OperationalRotaRiskMap } from "../Engineers/OperationalRotaRiskMap";
import {
  getOperationalRotaSnapshot,
  type OperationalRotaCalendarItem,
  type OperationalRotaShiftType,
  type OperationalRotaSnapshot,
  type OperationalRotaTeam,
} from "../Engineers/operationalRotaService";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = "mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 pb-10 pt-5 sm:px-5 md:gap-6 md:px-6 md:pb-12 md:pt-6 xl:px-8";
const CARD = "rounded-2xl border border-slate-800/75 bg-[#030c1d] shadow-[0_14px_34px_rgba(0,0,0,0.22)]";

function dateOnly(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOrdinal(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function normaliseName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function candidateEngineerNames(session: ReturnType<typeof useAuth>["session"]): string[] {
  if (!session) return [];
  const metadata = session.user.user_metadata ?? {};
  const values: string[] = [];

  for (const key of ["full_name", "name", "display_name"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) values.push(value.trim());
  }

  const first = typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
  const last = typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";
  if (first && last) values.push(`${first} ${last}`);

  const emailLocal = session.user.email?.split("@")[0] ?? "";
  if (emailLocal) values.push(emailLocal.replace(/[._-]+/g, " "));

  return [...new Set(values.map(normaliseName).filter(Boolean))];
}

function resolveEngineerName(
  snapshot: OperationalRotaSnapshot,
  candidates: string[],
): string | null {
  const names = new Set<string>();
  snapshot.teams.forEach((team) => team.memberNames.forEach((name) => names.add(name)));
  snapshot.calendar.forEach((item) => item.engineerNames.forEach((name) => names.add(name)));

  for (const candidate of candidates) {
    const exact = [...names].find((name) => normaliseName(name) === candidate);
    if (exact) return exact;
  }
  return null;
}

function resolveEngineerTeam(
  snapshot: OperationalRotaSnapshot,
  engineerName: string | null,
): OperationalRotaTeam | null {
  if (!engineerName) return null;
  const target = normaliseName(engineerName);
  return snapshot.teams.find((team) => team.memberNames.some((name) => normaliseName(name) === target)) ?? null;
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

function formatDay(value: string): { weekday: string; date: string } {
  const date = new Date(`${value}T12:00:00`);
  return {
    weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date),
    date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date),
  };
}

function sourceLabel(value: string | null): string {
  if (!value) return "Live rota source";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Live rota source";
  return `Updated ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

interface PersonalRotaDay {
  date: string;
  shift: OperationalRotaShiftType | "off" | "not-rostered";
  aggregate: OperationalRotaCalendarItem | null;
}

function buildPersonalDays(
  snapshot: OperationalRotaSnapshot,
  team: OperationalRotaTeam,
  engineerName: string,
  start: Date,
): PersonalRotaDay[] {
  const engineer = normaliseName(engineerName);
  return Array.from({ length: 14 }, (_, index) => {
    const date = dateOnly(addDays(start, index));
    const expected = shiftForTeam(team, date);
    if (expected === "off") return { date, shift: "off" as const, aggregate: null };

    const aggregate = snapshot.calendar.find(
      (item) => item.shiftDate === date && item.shiftType === expected,
    ) ?? null;
    const rostered = aggregate?.engineerNames.some((name) => normaliseName(name) === engineer) ?? false;
    return { date, shift: rostered ? expected : "not-rostered", aggregate };
  });
}

function ShiftIcon({ shift }: { shift: PersonalRotaDay["shift"] }): JSX.Element {
  if (shift === "day") return <Sun className="h-5 w-5 text-amber-300" />;
  if (shift === "night") return <Moon className="h-5 w-5 text-blue-300" />;
  return <CalendarDays className="h-5 w-5 text-slate-500" />;
}

function shiftLabel(shift: PersonalRotaDay["shift"]): string {
  if (shift === "day") return "Day shift";
  if (shift === "night") return "Night shift";
  if (shift === "not-rostered") return "Not rostered";
  return "Rest day";
}

function useDesktopRota(): boolean {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return desktop;
}

function EngineerMobileRota(): JSX.Element {
  const { session, siteContext } = useAuth();
  const [snapshot, setSnapshot] = useState<OperationalRotaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const startDate = dateOnly(today);
  const endDate = dateOnly(addDays(today, 13));

  const load = async (): Promise<void> => {
    if (!siteContext?.siteId) {
      setSnapshot(null);
      setError("No authorised active site is available for rota data.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setSnapshot(await getOperationalRotaSnapshot(siteContext.siteId, startDate, endDate));
    } catch (loadError) {
      setSnapshot(null);
      setError(loadError instanceof Error ? loadError.message : "The rota could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // The site context and date window are the complete query identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteContext?.siteId, startDate, endDate]);

  const candidates = useMemo(() => candidateEngineerNames(session), [session]);
  const engineerName = useMemo(
    () => (snapshot ? resolveEngineerName(snapshot, candidates) : null),
    [snapshot, candidates],
  );
  const team = useMemo(
    () => (snapshot ? resolveEngineerTeam(snapshot, engineerName) : null),
    [snapshot, engineerName],
  );
  const personalDays = useMemo(
    () => (snapshot && team && engineerName ? buildPersonalDays(snapshot, team, engineerName, today) : []),
    [snapshot, team, engineerName, today],
  );

  const siteShifts = useMemo(
    () => [...(snapshot?.calendar ?? [])]
      .sort((left, right) => `${left.shiftDate}:${left.shiftType}`.localeCompare(`${right.shiftDate}:${right.shiftType}`))
      .slice(0, 10),
    [snapshot],
  );

  const nextPersonalShift = personalDays.find((day) => day.shift === "day" || day.shift === "night") ?? null;

  return (
    <div data-vorta-page-content="true" data-vorta-engineer-rota="true" className={PAGE}>
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50">Rota</h1>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Your upcoming shift pattern and live team cover.
        </p>
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-3.5 py-3 text-xs leading-5 text-blue-100/80">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <span>Read-only. This is the same live rota maintained in the Maintenance Manager portal.</span>
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Loading rota">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl border border-slate-800/75 bg-[#030c1d]" />
          ))}
        </div>
      ) : error ? (
        <section className={`${CARD} p-5`}>
          <p className="text-sm font-semibold text-slate-200">Rota unavailable</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700/80 bg-[#07172b] px-4 text-sm font-medium text-slate-200"
          >
            <RefreshCw className="h-4 w-4 text-blue-400" />Retry
          </button>
        </section>
      ) : snapshot && team && engineerName ? (
        <>
          <section className={`${CARD} overflow-hidden border-blue-500/30`}>
            <div className="border-b border-slate-800/70 bg-blue-500/[0.06] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-400">Your rota</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-100">{engineerName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{team.name} · {sourceLabel(snapshot.sourceUpdatedAt)}</p>
                </div>
                <Users className="h-5 w-5 shrink-0 text-slate-500" />
              </div>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Next shift</p>
              {nextPersonalShift ? (
                <div className="mt-2 flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#07172b]">
                    <ShiftIcon shift={nextPersonalShift.shift} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{shiftLabel(nextPersonalShift.shift)}</p>
                    <p className="text-xs text-slate-500">{formatDay(nextPersonalShift.date).weekday} {formatDay(nextPersonalShift.date).date}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No rostered shift is shown in the next 14 days.</p>
              )}
            </div>
          </section>

          <section className={`${CARD} p-4`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-100">Next 14 days</h2>
              <span className="text-[10px] font-medium text-slate-600">{team.code}</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {personalDays.map((day, index) => {
                const formatted = formatDay(day.date);
                const todayRow = index === 0;
                const crew = day.aggregate?.engineerNames ?? [];
                return (
                  <div key={day.date} className={`flex min-h-[68px] items-center gap-3 py-3 ${todayRow ? "rounded-xl bg-blue-500/[0.05] px-2" : ""}`}>
                    <div className="w-12 shrink-0">
                      <p className={`text-xs font-semibold ${todayRow ? "text-blue-300" : "text-slate-300"}`}>{formatted.weekday}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{formatted.date}</p>
                    </div>
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#07172b]">
                      <ShiftIcon shift={day.shift} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">{shiftLabel(day.shift)}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-600">
                        {day.shift === "off"
                          ? "Off shift"
                          : day.shift === "not-rostered"
                            ? "Patterned shift, but you are not on the live roster"
                            : `${crew.length} engineer${crew.length === 1 ? "" : "s"} rostered`}
                      </p>
                    </div>
                    {day.shift === "day" || day.shift === "night" ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-700" /> : null}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : snapshot ? (
        <section className={`${CARD} p-4`}>
          <div className="mb-1 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">Site rota</h2>
          </div>
          <p className="mb-4 text-xs leading-5 text-slate-500">
            Your login is not yet matched to a named rota member, so the live site shifts are shown instead.
          </p>
          <div className="divide-y divide-slate-800/60">
            {siteShifts.map((shift) => {
              const formatted = formatDay(shift.shiftDate);
              return (
                <div key={`${shift.shiftDate}-${shift.shiftType}`} className="flex min-h-[70px] items-center gap-3 py-3">
                  <div className="w-12 shrink-0">
                    <p className="text-xs font-semibold text-slate-300">{formatted.weekday}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{formatted.date}</p>
                  </div>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#07172b]">
                    {shift.shiftType === "day" ? <Sun className="h-5 w-5 text-amber-300" /> : <Moon className="h-5 w-5 text-blue-300" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200">{shift.shiftType === "day" ? "Day shift" : "Night shift"}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-600">
                      {shift.teamNames.join(" · ")} · {shift.scheduledEngineerCount} engineers
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function EngineerRotaScreen(): JSX.Element {
  const desktop = useDesktopRota();

  if (desktop) {
    return (
      <div data-vorta-page-content="true" data-vorta-engineer-rota="true" className={PAGE}>
        <header>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-50 md:text-3xl">Rota</h1>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Full team rota and shift-cover view. Read-only in the Engineer portal.
          </p>
        </header>
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] px-3.5 py-3 text-xs leading-5 text-blue-100/80">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <span>This is the same live rota and shift-cover source used by the Maintenance Manager portal.</span>
        </div>
        <OperationalRotaRiskMap />
      </div>
    );
  }

  return <EngineerMobileRota />;
}
