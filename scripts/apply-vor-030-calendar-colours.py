from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    write(path, content.replace(old, new, 1))


write("src/lib/shiftPresentation.ts", '''export interface VortaShiftPresentation {
  label: string;
  dotClassName: string;
  textClassName: string;
}

export interface VortaShiftPresentationInput {
  teamCode: string | null;
  teamName: string | null;
  shiftLabel: string;
}

/**
 * The established Shift Calendar team palette. The scheduled team assignment is
 * supplied by the same rota calendar evidence used by Shift Cover. This map only
 * converts that authoritative team code into the existing Vorta visual tokens.
 */
const SHIFT_TEAM_PRESENTATION: Record<string, Omit<VortaShiftPresentation, "label">> = {
  YELLOW: {
    dotClassName: "bg-yellow-400",
    textClassName: "text-yellow-300",
  },
  RED: {
    dotClassName: "bg-red-400",
    textClassName: "text-red-300",
  },
  GREEN: {
    dotClassName: "bg-emerald-400",
    textClassName: "text-emerald-300",
  },
  BLUE: {
    dotClassName: "bg-blue-400",
    textClassName: "text-blue-300",
  },
  DAYS: {
    dotClassName: "bg-slate-400",
    textClassName: "text-slate-300",
  },
};

function inferredTeamCode(teamCode: string | null, teamName: string | null): string {
  const suppliedCode = teamCode?.trim().toUpperCase();
  if (suppliedCode) return suppliedCode;
  const suppliedName = teamName?.trim().toUpperCase() ?? "";
  return Object.keys(SHIFT_TEAM_PRESENTATION).find((code) => suppliedName.startsWith(code)) ?? "";
}

function compactTeamName(teamName: string): string {
  return teamName.replace(/\s+shift$/i, "").trim();
}

export function getVortaShiftPresentation({
  teamCode,
  teamName,
  shiftLabel,
}: VortaShiftPresentationInput): VortaShiftPresentation {
  const cleanShiftLabel = shiftLabel.trim() || "Shift";
  const cleanTeamName = teamName?.trim() ?? "";
  const known = SHIFT_TEAM_PRESENTATION[inferredTeamCode(teamCode, teamName)];

  if (cleanTeamName && known) {
    return {
      label: `${compactTeamName(cleanTeamName)} · ${cleanShiftLabel}`,
      ...known,
    };
  }

  if (cleanTeamName) {
    return {
      label: `${compactTeamName(cleanTeamName)} · ${cleanShiftLabel}`,
      dotClassName: "bg-slate-400",
      textClassName: "text-slate-300",
    };
  }

  return {
    label: `${cleanShiftLabel} · No rota`,
    dotClassName: "bg-slate-400",
    textClassName: "text-slate-300",
  };
}
''')

write("supabase/functions/shift-handover-data/rotaAssignments.ts", '''import {
  localParts,
  type ReviewPeriod,
  type ReviewShift,
} from "./shiftWindows.ts";

export type RotaSource = "shift_calendar" | "unavailable";

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

export interface RotaAssignedReviewShift extends ReviewShift {
  rotaTeamCode: string | null;
  rotaTeamName: string | null;
  rotaSource: RotaSource;
}

export interface RotaAssignedReviewPeriod extends Omit<ReviewPeriod, "shifts"> {
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
  const parts = localParts(new Date(value), timeZone);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
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
  periods: readonly ReviewPeriod[],
  timeZone: string,
): { startDate: string; endDate: string } {
  const dates = periods.flatMap((period) => period.shifts.map((shift) => localDateKey(shift.start, timeZone))).sort();
  const fallback = localDateKey(new Date().toISOString(), timeZone);
  return {
    startDate: dates[0] ?? fallback,
    endDate: dates.at(-1) ?? fallback,
  };
}

export function attachShiftCalendarAssignments(
  periods: readonly ReviewPeriod[],
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
''')

replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    'import { buildShiftHandoverPayload } from "./transform.ts";\n',
    'import { buildShiftHandoverPayload } from "./transform.ts";\nimport {\n  attachShiftCalendarAssignments,\n  reviewCalendarDateRange,\n} from "./rotaAssignments.ts";\n',
)

replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''    const reviewPeriods = buildReviewPeriods(anchor, timeZone, windowMode);
    const window = reviewPeriods.find((period) => period.reviewHours === reviewHours)
      ?? reviewWindow(anchor, timeZone, windowMode, reviewHours);
    const confirmations = await loadConfirmations(db, siteId, window.start, window.end);
''',
    '''    const baseReviewPeriods = buildReviewPeriods(anchor, timeZone, windowMode);
    const calendarRange = reviewCalendarDateRange(baseReviewPeriods, timeZone);
    const [calendarResult, teamResult] = await Promise.all([
      db.rpc("vorta_get_shift_calendar_internal", {
        p_site_id: siteId,
        p_start_date: calendarRange.startDate,
        p_end_date: calendarRange.endDate,
      }),
      db
        .from("maintenance_shift_teams")
        .select("code,name,pattern_type")
        .eq("site_id", siteId)
        .eq("active", true),
    ]);
    if (calendarResult.error) throw calendarResult.error;
    if (teamResult.error) throw teamResult.error;

    const reviewPeriods = attachShiftCalendarAssignments(
      baseReviewPeriods,
      calendarResult.data ?? [],
      teamResult.data ?? [],
      timeZone,
    );
    const window = reviewPeriods.find((period) => period.reviewHours === reviewHours)
      ?? attachShiftCalendarAssignments(
        [reviewWindow(anchor, timeZone, windowMode, reviewHours)],
        calendarResult.data ?? [],
        teamResult.data ?? [],
        timeZone,
      )[0];
    const confirmations = await loadConfirmations(db, siteId, window.start, window.end);
''',
)

replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''export interface ShiftHandoverReviewShift {
  type: ShiftHandoverReviewShiftType;
  label: string;
  start: string;
  end: string;
}
''',
    '''export interface ShiftHandoverReviewShift {
  type: ShiftHandoverReviewShiftType;
  label: string;
  start: string;
  end: string;
  rotaTeamCode: string | null;
  rotaTeamName: string | null;
  rotaSource: "shift_calendar" | "unavailable";
}
''',
)

replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''  return {
    type: type as ShiftHandoverReviewShiftType,
    label: stringValue(row.label) || (type === "day" ? "Day" : "Night"),
    start,
    end,
  };
''',
    '''  return {
    type: type as ShiftHandoverReviewShiftType,
    label: stringValue(row.label) || (type === "day" ? "Day" : "Night"),
    start,
    end,
    rotaTeamCode: stringValue(row.rotaTeamCode) || null,
    rotaTeamName: stringValue(row.rotaTeamName) || null,
    rotaSource: row.rotaSource === "shift_calendar" ? "shift_calendar" : "unavailable",
  };
''',
)

replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '''        const presentation = getVortaShiftPresentation(shift.type, shift.label);
''',
    '''        const presentation = getVortaShiftPresentation({
          teamCode: shift.rotaTeamCode,
          teamName: shift.rotaTeamName,
          shiftLabel: shift.label,
        });
''',
)

replace_once(
    "tests/browser/maintenance-manager-shift-handover.spec.ts",
    '''  await expect(reviewListbox.getByText("Day", { exact: true }).or(reviewListbox.getByText("Night", { exact: true })).first()).toBeVisible();
''',
    '''  await expect(reviewListbox.locator('[data-vorta-select-supporting-items="true"] span').filter({ hasText: /(?:Yellow|Red|Green|Blue|Days) · (?:Day|Night)/ }).first()).toBeVisible();
''',
)

replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''const shiftWindows = read("supabase/functions/shift-handover-data/shiftWindows.ts");
const shiftPresentation = read("src/lib/shiftPresentation.ts");
''',
    '''const shiftWindows = read("supabase/functions/shift-handover-data/shiftWindows.ts");
const rotaAssignments = read("supabase/functions/shift-handover-data/rotaAssignments.ts");
const shiftPresentation = read("src/lib/shiftPresentation.ts");
''',
)

replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''const reviewWindow = shiftWindowModule.reviewWindow;
''',
    '''const reviewWindow = shiftWindowModule.reviewWindow;
const compiledRotaAssignments = await transpile(rotaAssignments, {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const rotaAssignmentsModule = await import(
  `data:text/javascript;base64,${Buffer.from(compiledRotaAssignments.code.replace('./shiftWindows.ts', `data:text/javascript;base64,${Buffer.from(compiledShiftWindows.code).toString('base64')}`)).toString("base64")}`
);
const attachShiftCalendarAssignments = rotaAssignmentsModule.attachShiftCalendarAssignments;
''',
)

replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''const boundaryChecks = [
''',
    '''const rotaFixturePeriod = reviewWindow(new Date("2026-07-30T17:01:00Z"), london, "previous", 36);
const rotaFixture = attachShiftCalendarAssignments(
  [rotaFixturePeriod],
  [
    { shift_date: "2026-07-29", shift_type: "day", team_names: ["Days", "Green Shift"] },
    { shift_date: "2026-07-29", shift_type: "night", team_names: ["Blue Shift"] },
    { shift_date: "2026-07-30", shift_type: "day", team_names: ["Days", "Green Shift"] },
  ],
  [
    { code: "DAYS", name: "Days", pattern_type: "days" },
    { code: "GREEN", name: "Green Shift", pattern_type: "continental" },
    { code: "BLUE", name: "Blue Shift", pattern_type: "continental" },
  ],
  london,
)[0];

const boundaryChecks = [
''',
)

replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''  [londonMismatch.shifts[0]?.type !== newYorkMismatch.shifts[0]?.type, "Shift boundaries must use the site timezone rather than the browser timezone."],
];
''',
    '''  [londonMismatch.shifts[0]?.type !== newYorkMismatch.shifts[0]?.type, "Shift boundaries must use the site timezone rather than the browser timezone."],
  [rotaFixture.shifts.map((shift) => shift.rotaTeamCode).join(" · ") === "GREEN · BLUE · GREEN", "Completed shifts must use the actual Shift Calendar rota assignment rather than a fixed Day/Night colour."],
  [rotaFixture.shifts.every((shift) => shift.rotaSource === "shift_calendar"), "Resolved handover shifts must disclose the Shift Calendar as their rota source."],
];
''',
)

replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''  [service.includes("ShiftHandoverReviewHours") && service.includes("reviewHours"), "The service contract must carry the selected review period."],
''',
    '''  [service.includes("ShiftHandoverReviewHours") && service.includes("reviewHours"), "The service contract must carry the selected review period."],
  [service.includes("rotaTeamCode") && service.includes("rotaTeamName") && service.includes("shift_calendar"), "The client contract must retain the resolved Shift Calendar team assignment."],
  [edge.includes('db.rpc("vorta_get_shift_calendar_internal"') && edge.includes('.from("maintenance_shift_teams")'), "Shift Handover must resolve each completed shift through the authoritative Shift Calendar evidence path."],
  [rotaAssignments.includes('patternType === "continental"') && rotaAssignments.includes("shift_calendar"), "The rotating calendar team must take precedence over the weekday Days support team."],
  [shiftPresentation.includes("YELLOW") && shiftPresentation.includes("RED") && shiftPresentation.includes("GREEN") && shiftPresentation.includes("BLUE") && !shiftPresentation.includes("yellow for day") && !shiftPresentation.includes("SHIFT_TYPE_PRESENTATION"), "Shift colours must use the calendar team palette and must not be inferred from Day/Night."],
  [page.includes("teamCode: shift.rotaTeamCode") && page.includes("teamName: shift.rotaTeamName"), "The selector must render the actual scheduled rota team for each completed shift."],
''',
)

replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''  [browser.includes('toHaveAttribute("data-value", "12")') && browser.includes("Review period options"), "The responsive browser contract must verify the styled Last 12 hours selector as the default."],
''',
    '''  [browser.includes('toHaveAttribute("data-value", "12")') && browser.includes("Review period options"), "The responsive browser contract must verify the styled Previous shift selector as the default."],
  [browser.includes("Yellow|Red|Green|Blue|Days") && browser.includes("Day|Night"), "Responsive browser coverage must require visible calendar-team and Day/Night text together."],
''',
)

print("VOR-030 Shift Calendar colour correction applied successfully.")
