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
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"Expected one regex match in {path}, found {count}: {pattern[:100]!r}")
    write(path, updated)


write(
    "src/lib/shiftPresentation.ts",
    '''export type VortaShiftType = "day" | "night" | string;

export interface VortaShiftPresentation {
  label: string;
  dotClassName: string;
  textClassName: string;
}

/**
 * Shared shift-type presentation derived from the established Shift Cover rota
 * palette: yellow for day work and blue for night work. Text always accompanies
 * the colour so operational meaning never depends on colour alone.
 */
const SHIFT_TYPE_PRESENTATION: Record<"day" | "night", VortaShiftPresentation> = {
  day: {
    label: "Day",
    dotClassName: "bg-yellow-400",
    textClassName: "text-yellow-300",
  },
  night: {
    label: "Night",
    dotClassName: "bg-blue-400",
    textClassName: "text-blue-300",
  },
};

export function getVortaShiftPresentation(
  shiftType: VortaShiftType,
  suppliedLabel?: string,
): VortaShiftPresentation {
  const normalised = shiftType.trim().toLowerCase();
  const known = normalised === "day" || normalised === "night"
    ? SHIFT_TYPE_PRESENTATION[normalised]
    : null;
  if (known) return suppliedLabel ? { ...known, label: suppliedLabel } : known;
  return {
    label: suppliedLabel?.trim() || shiftType.trim() || "Shift",
    dotClassName: "bg-slate-400",
    textClassName: "text-slate-300",
  };
}
''',
)

write(
    "supabase/functions/shift-handover-data/shiftWindows.ts",
    '''export type WindowMode = "previous" | "latest";
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
''',
)

# Extend VortaSelect with optional compact supporting rows while retaining existing semantics.
replace_once(
    "src/components/VortaSelect.tsx",
    '''export interface VortaSelectOption<TValue extends string | number> {
  value: TValue;
  label: string;
}
''',
    '''export interface VortaSelectSupportItem {
  label: string;
  dotClassName: string;
  textClassName?: string;
}

export interface VortaSelectOption<TValue extends string | number> {
  value: TValue;
  label: string;
  supportingItems?: readonly VortaSelectSupportItem[];
}
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
''',
    '''  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const hasSupportingItems = options.some((option) => Boolean(option.supportingItems?.length));
  const [open, setOpen] = useState(false);
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''    const optionHeight = compact ? 38 : 44;
    const containerPadding = compact ? 8 : 12;
    const desiredHeight = Math.min(
      options.length * optionHeight + containerPadding,
      compact ? 248 : 288,
    );
''',
    '''    const optionHeight = compact
      ? (hasSupportingItems ? 48 : 38)
      : (hasSupportingItems ? 56 : 44);
    const containerPadding = compact ? 8 : 12;
    const desiredHeight = Math.min(
      options.length * optionHeight + containerPadding,
      compact ? (hasSupportingItems ? 256 : 248) : (hasSupportingItems ? 336 : 288),
    );
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''  }, [options.length]);
''',
    '''  }, [hasSupportingItems, options.length]);
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''                aria-selected={selected}
                tabIndex={active ? 0 : -1}
''',
    '''                aria-selected={selected}
                aria-describedby={option.supportingItems?.length ? `${listboxId}-option-${index}-description` : undefined}
                tabIndex={active ? 0 : -1}
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''                className={`flex min-h-[38px] w-full items-center justify-between gap-2.5 rounded-lg border px-2.5 py-1 text-left text-[13px] font-medium leading-5 transition-colors sm:min-h-11 sm:gap-3 sm:px-3 sm:py-2 sm:text-sm ${
''',
    '''                className={`flex w-full items-center justify-between gap-2.5 rounded-lg border px-2.5 text-left text-[13px] font-medium leading-5 transition-colors sm:gap-3 sm:px-3 sm:text-sm ${
                  option.supportingItems?.length ? "min-h-[48px] py-1.5 sm:min-h-14 sm:py-2" : "min-h-[38px] py-1 sm:min-h-11 sm:py-2"
                } ${
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''                <span className="min-w-0 break-words">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" /> : null}
''',
    '''                <span className="min-w-0 flex-1">
                  <span className="block break-words">{option.label}</span>
                  {option.supportingItems?.length ? (
                    <span
                      className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium leading-4 sm:text-xs"
                      data-vorta-select-supporting-items="true"
                    >
                      {option.supportingItems.map((item, supportIndex) => (
                        <span key={`${item.label}-${supportIndex}`} className={`inline-flex items-center gap-1 ${item.textClassName ?? "text-slate-400"}`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dotClassName}`} aria-hidden="true" />
                          {item.label}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {option.supportingItems?.length ? (
                    <span id={`${listboxId}-option-${index}-description`} className="sr-only">
                      Included shifts: {option.supportingItems.map((item) => item.label).join(", ")}
                    </span>
                  ) : null}
                </span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" /> : null}
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''  const selectedOption = options[selectedIndex] ?? options[0];
''',
    '''  const selectedOption = options[selectedIndex] ?? options[0];
  const selectedDescriptionId = `${listboxId}-selected-description`;
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
''',
    '''        aria-controls={open ? listboxId : undefined}
        aria-describedby={selectedOption?.supportingItems?.length ? selectedDescriptionId : undefined}
        disabled={disabled}
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-left text-sm font-medium text-slate-200 outline-none transition-colors hover:border-gray-600 focus-visible:border-blue-500/70 focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
''',
    '''        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-700 bg-[#0d1117] px-3 py-2 text-left text-sm font-medium text-slate-200 outline-none transition-colors hover:border-gray-600 focus-visible:border-blue-500/70 focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''        <span className="min-w-0 truncate">{selectedOption?.label ?? String(value)}</span>
        <ChevronDown
''',
    '''        <span className="min-w-0 flex-1">
          <span className="block truncate">{selectedOption?.label ?? String(value)}</span>
          {selectedOption?.supportingItems?.length ? (
            <span
              className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-medium leading-4"
              data-vorta-select-selected-supporting-items="true"
            >
              {selectedOption.supportingItems.map((item, supportIndex) => (
                <span key={`${item.label}-${supportIndex}`} className={`inline-flex items-center gap-1 ${item.textClassName ?? "text-slate-400"}`}>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dotClassName}`} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        <ChevronDown
''',
)
replace_once(
    "src/components/VortaSelect.tsx",
    '''      </button>
      {menu}
''',
    '''      </button>
      {selectedOption?.supportingItems?.length ? (
        <span id={selectedDescriptionId} className="sr-only">
          Included shifts: {selectedOption.supportingItems.map((item) => item.label).join(", ")}
        </span>
      ) : null}
      {menu}
''',
)

# Replace duplicated Edge Function shift math with the shared, executable boundary module.
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''import { buildShiftHandoverPayload } from "./transform.ts";

''',
    '''import { buildShiftHandoverPayload } from "./transform.ts";
import {
  buildReviewPeriods,
  REVIEW_HOURS,
  reviewWindow,
  shiftContaining,
  type ReviewHours,
  type WindowMode,
} from "./shiftWindows.ts";

''',
)
regex_once(
    "supabase/functions/shift-handover-data/index.ts",
    r'''type WindowMode = "previous" \| "latest";\ntype ReviewHours = 12 \| 24 \| 36 \| 48 \| 96;\ntype AnyRow = Record<string, any>;\ntype LocalParts = \{.*?\};\n\nconst REVIEW_HOURS = new Set<number>\(\[12, 24, 36, 48, 96\]\);\n''',
    '''type AnyRow = Record<string, any>;
''',
    flags=re.S,
)
regex_once(
    "supabase/functions/shift-handover-data/index.ts",
    r'''function localParts\(.*?\n\}\n\nasync function requestBody''',
    '''async function requestBody''',
    flags=re.S,
)
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''    const window = reviewWindow(anchor, timeZone, windowMode, reviewHours);
    const confirmations = await loadConfirmations(db, siteId, window.start, window.end);
''',
    '''    const reviewPeriods = buildReviewPeriods(anchor, timeZone, windowMode);
    const window = reviewPeriods.find((period) => period.reviewHours === reviewHours)
      ?? reviewWindow(anchor, timeZone, windowMode, reviewHours);
    const confirmations = await loadConfirmations(db, siteId, window.start, window.end);
''',
)
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''        window,
        items: [],
''',
    '''        window,
        reviewPeriods,
        items: [],
''',
)
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''      ...payload,
      items,
''',
    '''      ...payload,
      reviewPeriods,
      items,
''',
)

# Parse authoritative period and shift metadata in the client service.
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''export type ShiftHandoverReviewHours = 12 | 24 | 36 | 48 | 96;

''',
    '''export type ShiftHandoverReviewHours = 12 | 24 | 36 | 48 | 96;
export type ShiftHandoverReviewShiftType = "day" | "night";

export interface ShiftHandoverReviewShift {
  type: ShiftHandoverReviewShiftType;
  label: string;
  start: string;
  end: string;
}

export interface ShiftHandoverReviewPeriod {
  start: string;
  end: string;
  label: string;
  mode: "previous" | "latest";
  reviewHours: ShiftHandoverReviewHours;
  shiftCount: number;
  shifts: ShiftHandoverReviewShift[];
}

''',
)
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''  window: {
    start: string;
    end: string;
    label: string;
    mode: "previous" | "latest";
    reviewHours: ShiftHandoverReviewHours;
  };
  items: ShiftHandoverItem[];
''',
    '''  window: ShiftHandoverReviewPeriod;
  reviewPeriods: ShiftHandoverReviewPeriod[];
  items: ShiftHandoverItem[];
''',
)
insert_marker = '''function parseSnapshot(value: unknown): ShiftHandoverSnapshot {
'''
insert_code = '''function parseReviewShift(value: unknown): ShiftHandoverReviewShift | null {
  const row = objectValue(value);
  const type = stringValue(row?.type).toLowerCase();
  if (!row || !["day", "night"].includes(type)) return null;
  const start = stringValue(row.start);
  const end = stringValue(row.end);
  if (!start || !end) return null;
  return {
    type: type as ShiftHandoverReviewShiftType,
    label: stringValue(row.label) || (type === "day" ? "Day" : "Night"),
    start,
    end,
  };
}

function parseReviewPeriod(value: unknown): ShiftHandoverReviewPeriod | null {
  const row = objectValue(value);
  if (!row || !isShiftHandoverReviewHours(row.reviewHours)) return null;
  const reviewHours = Number(row.reviewHours) as ShiftHandoverReviewHours;
  const shifts = Array.isArray(row.shifts)
    ? row.shifts.map(parseReviewShift).filter((shift): shift is ShiftHandoverReviewShift => Boolean(shift))
    : [];
  const start = stringValue(row.start) || shifts[0]?.start || "";
  const end = stringValue(row.end) || shifts.at(-1)?.end || "";
  if (!start || !end) return null;
  return {
    start,
    end,
    label: stringValue(row.label),
    mode: row.mode === "latest" ? "latest" : "previous",
    reviewHours,
    shiftCount: numberValue(row.shiftCount) || reviewHours / 12,
    shifts,
  };
}

function parseSnapshot(value: unknown): ShiftHandoverSnapshot {
'''
replace_once("src/screens/ShiftHandover/shiftHandoverService.ts", insert_marker, insert_code)
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''  const items = Array.isArray(root.items)
    ? root.items.map(parseItem).filter((item): item is ShiftHandoverItem => Boolean(item))
    : [];

  return {
''',
    '''  const items = Array.isArray(root.items)
    ? root.items.map(parseItem).filter((item): item is ShiftHandoverItem => Boolean(item))
    : [];
  const parsedWindow = parseReviewPeriod(window);
  if (!parsedWindow) throw new Error("Shift handover returned an invalid completed-shift window.");
  const reviewPeriods = Array.isArray(root.reviewPeriods)
    ? root.reviewPeriods.map(parseReviewPeriod).filter((period): period is ShiftHandoverReviewPeriod => Boolean(period))
    : [];

  return {
''',
)
regex_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    r'''    window: \{\n      start: stringValue\(window.start\),\n      end: stringValue\(window.end\),\n      label: stringValue\(window.label\),\n      mode: window.mode === "latest" \? "latest" : "previous",\n      reviewHours: isShiftHandoverReviewHours\(window.reviewHours\)\n        \? Number\(window.reviewHours\) as ShiftHandoverReviewHours\n        : 12,\n    \},\n    items,''',
    '''    window: parsedWindow,
    reviewPeriods: reviewPeriods.length > 0 ? reviewPeriods : [parsedWindow],
    items,''',
)

# Shift-based labels, sequences, headings and states in the shared responsive page.
replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '''import { useAuth } from "../../lib/auth";
''',
    '''import { useAuth } from "../../lib/auth";
import { getVortaShiftPresentation } from "../../lib/shiftPresentation";
''',
)
replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '''  { value: 12, label: "Last 12 hours" },
  { value: 24, label: "Last 24 hours" },
  { value: 36, label: "Last 36 hours" },
  { value: 48, label: "Last 48 hours" },
  { value: 96, label: "Last 4 days" },
''',
    '''  { value: 12, label: "Previous shift · 12 hours" },
  { value: 24, label: "Previous 2 shifts · 24 hours" },
  { value: 36, label: "Previous 3 shifts · 36 hours" },
  { value: 48, label: "Previous 4 shifts · 48 hours" },
  { value: 96, label: "Previous 8 shifts · 4 days" },
''',
)
regex_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    r'''function reviewPeriodLabel\(.*?\n\}\n\nfunction reviewPeriodHeading\(reviewHours: ShiftHandoverReviewHours\): string \{.*?\n\}\n\nfunction reviewPeriodEmptyState\(reviewHours: ShiftHandoverReviewHours\): string \{.*?\n\}\n\nfunction reviewPeriodLoadingState\(reviewHours: ShiftHandoverReviewHours\): string \{.*?\n\}\n''',
    '''function reviewShiftCount(reviewHours: ShiftHandoverReviewHours): number {
  return reviewHours / 12;
}

function reviewPeriodHeading(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  if (count === 1) return "Previous shift: Previous shift activity";
  return `Previous ${count} shifts: Activity from the previous ${count} shifts`;
}

function reviewPeriodEmptyState(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  return count === 1
    ? "No handover activity was recorded during the previous shift."
    : `No work orders were recorded during the previous ${count} shifts.`;
}

function reviewPeriodLoadingState(reviewHours: ShiftHandoverReviewHours): string {
  const count = reviewShiftCount(reviewHours);
  return count === 1
    ? "Loading activity from the previous shift…"
    : `Loading activity from the previous ${count} shifts…`;
}
''',
    flags=re.S,
)
replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '''  const activeAdvancedFilterCount = Number(criticality !== "all")
''',
    '''  const reviewPeriodOptions = useMemo(() => REVIEW_PERIOD_OPTIONS.map((option) => {
    const period = snapshot?.reviewPeriods.find((candidate) => candidate.reviewHours === option.value);
    return {
      ...option,
      supportingItems: period?.shifts.map((shift) => {
        const presentation = getVortaShiftPresentation(shift.type, shift.label);
        return {
          label: presentation.label,
          dotClassName: presentation.dotClassName,
          textClassName: presentation.textClassName,
        };
      }),
    };
  }), [snapshot?.reviewPeriods]);

  const activeAdvancedFilterCount = Number(criticality !== "all")
''',
)
replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '''      options={REVIEW_PERIOD_OPTIONS}
''',
    '''      options={reviewPeriodOptions}
''',
)
replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '''<MetricCard label="Handover items" value={String(filteredSummary.total)} detail="In selected review period" icon={Wrench} />''',
    '''<MetricCard label="Handover items" value={String(filteredSummary.total)} detail="In selected shift period" icon={Wrench} />''',
)
replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '''Site and areas with activity in the selected review period.''',
    '''Site and areas with activity in the selected shift period.''',
)
replace_once(
    "src/screens/ShiftHandover/ShiftHandoverSection.tsx",
    '''        ? "No work orders were confirmed in this review period."
''',
    '''        ? "No work orders were confirmed in the selected completed shifts."
''',
)

# Executable boundary and UI contracts.
replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''const transform = read("supabase/functions/shift-handover-data/transform.ts");
''',
    '''const transform = read("supabase/functions/shift-handover-data/transform.ts");
const shiftWindows = read("supabase/functions/shift-handover-data/shiftWindows.ts");
const shiftPresentation = read("src/lib/shiftPresentation.ts");
''',
)
replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''const buildPayload = transformModule.buildShiftHandoverPayload;
''',
    '''const buildPayload = transformModule.buildShiftHandoverPayload;
const compiledShiftWindows = await transpile(shiftWindows, {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const shiftWindowModule = await import(
  `data:text/javascript;base64,${Buffer.from(compiledShiftWindows.code).toString("base64")}`
);
const reviewWindow = shiftWindowModule.reviewWindow;
''',
)
replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''const reviewOptions = [
  "Last 12 hours",
  "Last 24 hours",
  "Last 36 hours",
  "Last 48 hours",
  "Last 4 days",
];
''',
    '''const reviewOptions = [
  "Previous shift · 12 hours",
  "Previous 2 shifts · 24 hours",
  "Previous 3 shifts · 36 hours",
  "Previous 4 shifts · 48 hours",
  "Previous 8 shifts · 4 days",
];

const london = "Europe/London";
const beforeSix = reviewWindow(new Date("2026-07-30T04:59:00Z"), london, "previous", 12);
const afterSix = reviewWindow(new Date("2026-07-30T05:01:00Z"), london, "previous", 12);
const beforeEighteen = reviewWindow(new Date("2026-07-30T16:59:00Z"), london, "previous", 12);
const afterEighteen = reviewWindow(new Date("2026-07-30T17:01:00Z"), london, "previous", 12);
const daytimeSequence = reviewWindow(new Date("2026-07-30T11:00:00Z"), london, "previous", 48);
const nightSequence = reviewWindow(new Date("2026-07-30T19:00:00Z"), london, "previous", 36);
const londonMismatch = reviewWindow(new Date("2026-07-30T05:30:00Z"), london, "previous", 12);
const newYorkMismatch = reviewWindow(new Date("2026-07-30T05:30:00Z"), "America/New_York", "previous", 12);
const boundaryChecks = [
  [beforeSix.shifts[0]?.type === "day", "Immediately before 06:00 local, the last completed shift must be Day."],
  [afterSix.shifts[0]?.type === "night", "Immediately after 06:00 local, the last completed shift must be Night."],
  [beforeEighteen.shifts[0]?.type === "night", "Immediately before 18:00 local, the last completed shift must remain Night."],
  [afterEighteen.shifts[0]?.type === "day", "Immediately after 18:00 local, the last completed shift must be Day."],
  [daytimeSequence.shifts.map((shift) => shift.label).join(" · ") === "Day · Night · Day · Night", "Four completed shifts must be chronological oldest-to-newest during the day shift."],
  [nightSequence.shifts.map((shift) => shift.label).join(" · ") === "Night · Day · Night", "Three completed shifts must dynamically alternate during the night shift."],
  [daytimeSequence.start === daytimeSequence.shifts[0]?.start && daytimeSequence.end === daytimeSequence.shifts.at(-1)?.end, "The evidence range must use the first and last completed shift boundaries."],
  [new Date(daytimeSequence.start).getUTCDate() !== new Date(daytimeSequence.end).getUTCDate(), "Longer shift periods must cross calendar dates without losing boundaries."],
  [londonMismatch.shifts[0]?.type !== newYorkMismatch.shifts[0]?.type, "Shift boundaries must use the site timezone rather than the browser timezone."],
];
''',
)
replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''  [vortaSelect.includes('min-h-[38px]') && vortaSelect.includes('sm:min-h-11') && vortaSelect.includes('data-vorta-select-compact'), "Mobile selector options must be compact without changing wider-layout sizing."],
''',
    '''  [vortaSelect.includes('min-h-[38px]') && vortaSelect.includes('min-h-[48px]') && vortaSelect.includes('sm:min-h-11') && vortaSelect.includes('data-vorta-select-compact'), "Mobile selector options must remain compact while supporting shift sequences."],
  [vortaSelect.includes('data-vorta-select-supporting-items="true"') && vortaSelect.includes('aria-describedby') && vortaSelect.includes("Included shifts:"), "Shift sequences must be visible and available to assistive technology."],
''',
)
replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''  [page.includes('return "Previous shift activity"') && !page.includes("Previous shift activity for Last 12 hours") && page.includes("Activity from the last 4 days"), "Activity headings must describe each period without embedding the dropdown label in a sentence."],
''',
    '''  [page.includes('return "Previous shift: Previous shift activity"') && page.includes("Activity from the previous ${count} shifts"), "Activity headings must use completed-shift terminology."],
''',
)
replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''  [edge.includes("addLocalHours(endParts, -reviewHours)") && edge.includes("site.timezone"), "Review windows must be calculated in the site timezone."],
''',
    '''  [edge.includes("buildReviewPeriods(anchor, timeZone, windowMode)") && edge.includes("site.timezone") && shiftWindows.includes("previousCompletedShift") && shiftWindows.includes("shiftContaining"), "Review windows must be assembled from completed site-timezone shift boundaries."],
  [service.includes("reviewPeriods") && service.includes("ShiftHandoverReviewShift"), "The client contract must retain the authoritative shift sequence."],
  [shiftPresentation.includes('bg-yellow-400') && shiftPresentation.includes('bg-blue-400') && shiftPresentation.includes("colour alone"), "Shift Handover must reuse the established yellow Day and blue Night rota palette with text labels."],
''',
)
replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''  ...statusFixtureChecks,
''',
    '''  ...statusFixtureChecks,
  ...boundaryChecks,
''',
)
replace_once(
    "scripts/shift-handover-contracts.mjs",
    '''console.log("✓ Shift Handover compact''',
    '''console.log("✓ Shift Handover completed-shift periods, compact''',
)

# Browser coverage: terminology, shift sequence, state preservation, every range.
browser_path = "tests/browser/maintenance-manager-shift-handover.spec.ts"
browser = read(browser_path)
replacements = {
    '"Last 24 hours"': '"Previous 2 shifts · 24 hours"',
    '"Last 12 hours"': '"Previous shift · 12 hours"',
    '"Last 36 hours"': '"Previous 3 shifts · 36 hours"',
    '"Last 48 hours"': '"Previous 4 shifts · 48 hours"',
    '"Last 4 days"': '"Previous 8 shifts · 4 days"',
    '"Activity from the last 24 hours"': '"Previous 2 shifts: Activity from the previous 2 shifts"',
    '"Activity from the last 36 hours"': '"Previous 3 shifts: Activity from the previous 3 shifts"',
    '"Activity from the last 48 hours"': '"Previous 4 shifts: Activity from the previous 4 shifts"',
    '"Activity from the last 4 days"': '"Previous 8 shifts: Activity from the previous 8 shifts"',
    '"Previous shift activity"': '"Previous shift: Previous shift activity"',
}
for old, new in replacements.items():
    browser = browser.replace(old, new)
needle = '''  await expect(reviewListbox.getByRole("option")).toHaveCount(5);
'''
if needle not in browser:
    raise RuntimeError("Review listbox assertion marker missing")
browser = browser.replace(
    needle,
    needle + '''  await expect(reviewListbox.locator('[data-vorta-select-supporting-items="true"]')).toHaveCount(5);
  await expect(reviewListbox.getByText("Day", { exact: true }).or(reviewListbox.getByText("Night", { exact: true })).first()).toBeVisible();
''',
    1,
)
needle = '''  await expect(reviewPeriod).toHaveAttribute("data-value", "12");
'''
if needle not in browser:
    raise RuntimeError("Selected review period marker missing")
browser = browser.replace(
    needle,
    needle + '''  await expect(page.locator('[data-vorta-shift-handover-review-period="true"] [data-vorta-select-selected-supporting-items="true"]')).toBeVisible();
''',
    1,
)
write(browser_path, browser)

print("VOR-030 source transformations applied successfully.")
