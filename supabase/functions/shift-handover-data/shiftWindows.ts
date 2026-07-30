export type WindowMode = "previous" | "latest";
export type ReviewHours = 12 | 24 | 36 | 48 | 96;
export type ReviewShiftType = "day" | "night";

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export interface ReviewShift {
  type: ReviewShiftType;
  label: "Day" | "Night";
  start: string;
  end: string;
}

export interface ReviewPeriod {
  start: string;
  end: string;
  label: string;
  mode: WindowMode;
  reviewHours: ReviewHours;
  shiftCount: number;
  shifts: ReviewShift[];
}

export const REVIEW_HOURS = new Set<number>([12, 24, 36, 48, 96]);
export const REVIEW_HOUR_OPTIONS: readonly ReviewHours[] = [12, 24, 36, 48, 96];

export function localParts(value: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    second: Number(map.get("second")),
  };
}

function timezoneOffsetMs(value: Date, timeZone: string): number {
  const parts = localParts(value, timeZone);
  const representedUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedUtc - value.getTime();
}

export function zonedToUtc(parts: LocalParts, timeZone: string): Date {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  let candidate = localAsUtc;
  for (let index = 0; index < 3; index += 1) {
    candidate = localAsUtc - timezoneOffsetMs(new Date(candidate), timeZone);
  }
  return new Date(candidate);
}

function addLocalHours(parts: LocalParts, hours: number): LocalParts {
  const next = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour + hours,
    parts.minute,
    parts.second,
  ));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: next.getUTCHours(),
    minute: next.getUTCMinutes(),
    second: next.getUTCSeconds(),
  };
}

export function shiftContaining(anchor: Date, timeZone: string): { start: Date; end: Date } {
  const parts = localParts(anchor, timeZone);
  let startParts: LocalParts;
  let endParts: LocalParts;

  if (parts.hour >= 18) {
    startParts = { ...parts, hour: 18, minute: 0, second: 0 };
    endParts = { ...addLocalHours(startParts, 12), minute: 0, second: 0 };
  } else if (parts.hour >= 6) {
    startParts = { ...parts, hour: 6, minute: 0, second: 0 };
    endParts = { ...addLocalHours(startParts, 12), minute: 0, second: 0 };
  } else {
    endParts = { ...parts, hour: 6, minute: 0, second: 0 };
    startParts = { ...addLocalHours(endParts, -12), minute: 0, second: 0 };
  }

  return {
    start: zonedToUtc(startParts, timeZone),
    end: zonedToUtc(endParts, timeZone),
  };
}

export function previousCompletedShift(anchor: Date, timeZone: string): { start: Date; end: Date } {
  const current = shiftContaining(anchor, timeZone);
  return shiftContaining(new Date(current.start.getTime() - 1), timeZone);
}

export function reviewShiftCount(reviewHours: ReviewHours): number {
  return reviewHours / 12;
}

export function reviewPeriodPrimaryLabel(reviewHours: ReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  if (count === 1) return "Previous shift · 12 hours";
  if (reviewHours === 96) return "Previous 8 shifts · 4 days";
  return `Previous ${count} shifts · ${reviewHours} hours`;
}

function shiftTypeForStart(start: Date, timeZone: string): ReviewShiftType {
  return localParts(start, timeZone).hour === 6 ? "day" : "night";
}

function toReviewShift(
  shift: { start: Date; end: Date },
  timeZone: string,
): ReviewShift {
  const type = shiftTypeForStart(shift.start, timeZone);
  return {
    type,
    label: type === "day" ? "Day" : "Night",
    start: shift.start.toISOString(),
    end: shift.end.toISOString(),
  };
}

function formatWindowLabel(
  shifts: ReviewShift[],
  timeZone: string,
  reviewHours: ReviewHours,
): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const start = new Date(shifts[0]?.start ?? 0);
  const end = new Date(shifts.at(-1)?.end ?? 0);
  return `${reviewPeriodPrimaryLabel(reviewHours)} · ${formatter.format(start)} to ${formatter.format(end)}`;
}

export function reviewWindow(
  anchor: Date,
  timeZone: string,
  windowMode: WindowMode,
  reviewHours: ReviewHours,
): ReviewPeriod {
  const newestShift = windowMode === "latest"
    ? shiftContaining(anchor, timeZone)
    : previousCompletedShift(anchor, timeZone);
  const shiftCount = reviewShiftCount(reviewHours);
  const shifts: ReviewShift[] = [];
  let cursor = newestShift;

  for (let index = 0; index < shiftCount; index += 1) {
    shifts.unshift(toReviewShift(cursor, timeZone));
    cursor = shiftContaining(new Date(cursor.start.getTime() - 1), timeZone);
  }

  return {
    start: shifts[0].start,
    end: shifts[shifts.length - 1].end,
    label: formatWindowLabel(shifts, timeZone, reviewHours),
    mode: windowMode,
    reviewHours,
    shiftCount,
    shifts,
  };
}

export function buildReviewPeriods(
  anchor: Date,
  timeZone: string,
  windowMode: WindowMode,
): ReviewPeriod[] {
  return REVIEW_HOUR_OPTIONS.map((reviewHours) =>
    reviewWindow(anchor, timeZone, windowMode, reviewHours));
}
