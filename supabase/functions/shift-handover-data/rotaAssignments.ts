export type RotaSource = "shift_calendar" | "unavailable";

export interface ReviewShiftLike {
  type: string;
  label: string;
  start: string;
  end: string;
}

export interface ReviewPeriodLike {
  start: string;
  end: string;
  label: string;
  mode: "previous" | "latest";
  reviewHours: number;
  shiftCount: number;
  shifts: ReviewShiftLike[];
}

export interface ShiftCalendarRow {
  shift_date?: unknown;
  shift_type?: unknown;
  team_names?: unknown;
}

export interface ShiftTeamRow {
  code?: unknown;
  name?: unknown;
  pattern_type?: unknown;
}

export interface RotaAssignedReviewShift extends ReviewShiftLike {
  rotaTeamCode: string | null;
  rotaTeamName: string | null;
  rotaSource: RotaSource;
}

export interface RotaAssignedReviewPeriod extends Omit<ReviewPeriodLike, "shifts"> {
  shifts: RotaAssignedReviewShift[];
}

type TeamMetadata = {
  code: string;
  name: string;
  patternType: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function localDateKey(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return [map.get("year") ?? "0000", map.get("month") ?? "00", map.get("day") ?? "00"].join("-");
}

function teamMetadata(rows: readonly ShiftTeamRow[]): Map<string, TeamMetadata> {
  return new Map(rows.flatMap((row) => {
    const name = text(row.name);
    if (!name) return [];
    return [[normalise(name), {
      code: text(row.code).toUpperCase(),
      name,
      patternType: text(row.pattern_type).toLowerCase(),
    }] as const];
  }));
}

function calendarKey(date: string, shiftType: string): string {
  return `${date}:${shiftType.toLowerCase()}`;
}

function scheduledTeamNames(row: ShiftCalendarRow | undefined): string[] {
  return Array.isArray(row?.team_names)
    ? row.team_names.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];
}

function resolvePrimaryTeam(
  names: readonly string[],
  metadataByName: Map<string, TeamMetadata>,
): TeamMetadata | null {
  const assigned = names.map((name) => metadataByName.get(normalise(name)) ?? {
    code: name.replace(/\s+shift$/i, "").trim().toUpperCase(),
    name: name.trim(),
    patternType: "unknown",
  });

  return assigned.find((team) => team.patternType === "continental")
    ?? assigned.find((team) => team.patternType !== "days")
    ?? assigned[0]
    ?? null;
}

export function reviewCalendarDateRange(
  periods: readonly ReviewPeriodLike[],
  timeZone: string,
): { startDate: string; endDate: string } {
  const dates = periods
    .flatMap((period) => period.shifts.map((shift) => localDateKey(shift.start, timeZone)))
    .sort();
  const fallback = localDateKey(new Date().toISOString(), timeZone);
  return {
    startDate: dates[0] ?? fallback,
    endDate: dates.at(-1) ?? fallback,
  };
}

export function attachShiftCalendarAssignments(
  periods: readonly ReviewPeriodLike[],
  calendarRows: readonly ShiftCalendarRow[],
  teamRows: readonly ShiftTeamRow[],
  timeZone: string,
): RotaAssignedReviewPeriod[] {
  const metadataByName = teamMetadata(teamRows);
  const calendarByKey = new Map(calendarRows.map((row) => [
    calendarKey(text(row.shift_date), text(row.shift_type)),
    row,
  ]));

  return periods.map((period) => ({
    ...period,
    shifts: period.shifts.map((shift) => {
      const row = calendarByKey.get(calendarKey(localDateKey(shift.start, timeZone), shift.type));
      const team = resolvePrimaryTeam(scheduledTeamNames(row), metadataByName);
      return {
        ...shift,
        rotaTeamCode: team?.code || null,
        rotaTeamName: team?.name || null,
        rotaSource: team ? "shift_calendar" : "unavailable",
      };
    }),
  }));
}
