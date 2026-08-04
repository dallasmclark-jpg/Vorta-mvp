import type { JsonRecord } from "./contracts.mjs";
import { DATE_ONLY_PATTERN } from "./contracts.mjs";

export function requiredText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maximumLength ? text : null;
}

export function normaliseEquipmentReference(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/([a-z]+)0+(\d)/g, "$1$2");
}

export function equipmentReferenceMatches(candidate: unknown, query: string): boolean {
  if (typeof candidate !== "string") return false;
  const rawCandidate = candidate.trim().toLowerCase();
  const rawQuery = query.trim().toLowerCase();
  if (rawCandidate.includes(rawQuery) || rawQuery.includes(rawCandidate)) return true;
  const normalisedCandidate = normaliseEquipmentReference(candidate);
  const normalisedQuery = normaliseEquipmentReference(query);
  return Boolean(
    normalisedCandidate.length >= 3 &&
      normalisedQuery.length >= 3 &&
      (normalisedCandidate.includes(normalisedQuery) ||
        normalisedQuery.includes(normalisedCandidate)),
  );
}

export function extractEquipmentReference(value: string): string | null {
  const codedMatches =
    value.match(/\b[a-z]{2,}(?:\s*-?\s*\d{1,3})(?:-[a-z0-9]+)*\b/gi) ?? [];
  if (codedMatches.length > 0) {
    return codedMatches[codedMatches.length - 1].replace(/\s+/g, "");
  }

  const excludedAcronyms = new Set([
    "AI",
    "KPI",
    "OEM",
    "PLC",
    "PM",
    "RCA",
    "SAP",
    "SME",
    "SOP",
    "WO",
  ]);
  const acronymMatches = (value.match(/\b[A-Z]{3,5}\b/g) ?? []).filter(
    (candidate) => !excludedAcronyms.has(candidate),
  );
  return acronymMatches.length ? acronymMatches[acronymMatches.length - 1] : null;
}

export function parseArguments(value: string): JsonRecord {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be an object.");
  }
  return parsed as JsonRecord;
}

export function nestedDecisionRecords(value: unknown, depth = 0): JsonRecord[] {
  if (depth > 6 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.slice(0, 120).flatMap((item) => nestedDecisionRecords(item, depth + 1));
  }
  if (typeof value !== "object") return [];
  const record = value as JsonRecord;
  return [
    record,
    ...Object.values(record)
      .slice(0, 100)
      .flatMap((item) => nestedDecisionRecords(item, depth + 1)),
  ];
}

export function decisionField(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      const text = value
        .filter((item) => typeof item === "string" || typeof item === "number")
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
        .join(", ");
      if (text) return text;
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

export function textValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

export function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

export function evidenceTimestamps(value: unknown, depth = 0): number[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.slice(0, 120).flatMap((item) => evidenceTimestamps(item, depth + 1));
  }
  if (typeof value !== "object") return [];
  const timestamps: number[] = [];
  for (const [key, item] of Object.entries(value as JsonRecord).slice(0, 100)) {
    if (
      typeof item === "string" &&
      /^(sourceUpdatedAt|updatedAt|updated_at|snapshotDate|snapshot_date)$/i.test(key)
    ) {
      const parsed = new Date(item).getTime();
      if (Number.isFinite(parsed)) timestamps.push(parsed);
      continue;
    }
    timestamps.push(...evidenceTimestamps(item, depth + 1));
  }
  return timestamps;
}

export function equipmentId(args: JsonRecord): string | null {
  return requiredText(args.equipment_id, 100);
}

export function validDateRange(startDate: unknown, endDate: unknown): boolean {
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string" ||
    !DATE_ONLY_PATTERN.test(startDate) ||
    !DATE_ONLY_PATTERN.test(endDate)
  ) {
    return false;
  }
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 31 * 86_400_000;
}

export function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function normaliseRelativeShiftCoverArguments(
  question: string,
  timezone: string,
  args: JsonRecord,
  now = new Date(),
): JsonRecord {
  const relativeRange =
    /\b(this|current|next|following)\s+week\b|\bnext\s+(7|seven)\s+days\b|\b(today|tomorrow)\b/i.exec(
      question,
    )?.[0];
  if (!relativeRange) return args;

  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const today = new Date(`${localDate}T12:00:00Z`);
  const weekday = today.getUTCDay();
  const thisWeekStart = addUtcDays(today, weekday === 0 ? -6 : 1 - weekday);
  let start = thisWeekStart;
  let end = addUtcDays(start, 6);

  if (/\b(next|following)\s+week\b/i.test(question)) {
    start = addUtcDays(thisWeekStart, 7);
    end = addUtcDays(start, 6);
  } else if (/\btomorrow\b/i.test(question)) {
    start = addUtcDays(today, 1);
    end = start;
  } else if (/\btoday\b/i.test(question)) {
    start = today;
    end = start;
  } else if (/\bnext\s+(7|seven)\s+days\b/i.test(question)) {
    start = today;
    end = addUtcDays(start, 6);
  }

  return {
    ...args,
    start_date: formatUtcDate(start),
    end_date: formatUtcDate(end),
  };
}

export async function sha256Fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function numberValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
