import type { JsonRecord } from "./contracts.mjs";
import { DATE_ONLY_PATTERN } from "./contracts.mjs";

const EQUIPMENT_QUERY_NOISE = new Set([
  "a",
  "about",
  "active",
  "action",
  "alarm",
  "alarms",
  "an",
  "and",
  "are",
  "at",
  "be",
  "breakdown",
  "can",
  "cause",
  "caused",
  "causing",
  "code",
  "could",
  "current",
  "diagnose",
  "diagnosis",
  "diagnostic",
  "do",
  "does",
  "exact",
  "failed",
  "failure",
  "failures",
  "fault",
  "faults",
  "for",
  "from",
  "give",
  "has",
  "have",
  "history",
  "how",
  "i",
  "in",
  "is",
  "issue",
  "issues",
  "it",
  "me",
  "my",
  "name",
  "need",
  "next",
  "of",
  "on",
  "open",
  "our",
  "part",
  "please",
  "probe",
  "probes",
  "problem",
  "problems",
  "provide",
  "related",
  "sensor",
  "sensors",
  "should",
  "show",
  "tag",
  "the",
  "this",
  "to",
  "transmitter",
  "transmitters",
  "trip",
  "trips",
  "us",
  "what",
  "which",
  "who",
  "why",
  "with",
  "would",
  "wrong",
  "you",
  "your",
]);

const DESCRIPTIVE_EQUIPMENT_CUE =
  /\b(?:fault|sensor|probe|transmitter|alarm|trip|breakdown|failed|failure|diagnos|filler|filling|pump|motor|valve|conveyor|compressor|autoclave|rabs|ahu|isolator|palletiser|palletizer)\b/i;

const SITE_EQUIPMENT_LANGUAGE_ALIASES: Array<{
  pattern: RegExp;
  equipmentReference: string;
}> = [
  {
    pattern:
      /\bvial\b[\s\S]{0,40}\b(?:fill|filler|filling)\b[\s\S]{0,40}\b(?:sensor|reject|false rejects?|f-204)\b/i,
    equipmentReference: "VF-02",
  },
  {
    pattern:
      /\b(?:sensor|reject|false rejects?|f-204)\b[\s\S]{0,40}\bvial\b[\s\S]{0,40}\b(?:fill|filler|filling)\b/i,
    equipmentReference: "VF-02",
  },
];

function normaliseEquipmentWord(value: string): string {
  const token = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!token) return "";
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ers")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("er")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function equipmentIdentityTokens(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [
    ...new Set(
      (value.toLowerCase().match(/[a-z0-9-]+/g) ?? [])
        .filter((token) => !EQUIPMENT_QUERY_NOISE.has(token))
        .map(normaliseEquipmentWord)
        .filter(
          (token) =>
            token.length >= 2 &&
            !EQUIPMENT_QUERY_NOISE.has(token),
        ),
    ),
  ];
}

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
  if (!rawCandidate || !rawQuery) return false;
  if (rawCandidate.includes(rawQuery) || rawQuery.includes(rawCandidate)) return true;

  const normalisedCandidate = normaliseEquipmentReference(candidate);
  const normalisedQuery = normaliseEquipmentReference(query);
  if (
    normalisedCandidate.length >= 3 &&
    normalisedQuery.length >= 3 &&
    (normalisedCandidate.includes(normalisedQuery) ||
      normalisedQuery.includes(normalisedCandidate))
  ) {
    return true;
  }

  const queryTokens = equipmentIdentityTokens(query);
  if (queryTokens.length < 2) return false;
  const candidateTokens = new Set(equipmentIdentityTokens(candidate));
  const matchedTokens = queryTokens.filter((token) => candidateTokens.has(token));
  const requiredMatches =
    queryTokens.length <= 2
      ? queryTokens.length
      : Math.max(2, Math.ceil(queryTokens.length * 0.67));
  return matchedTokens.length >= requiredMatches;
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
  if (acronymMatches.length) {
    return acronymMatches[acronymMatches.length - 1];
  }

  for (const alias of SITE_EQUIPMENT_LANGUAGE_ALIASES) {
    if (alias.pattern.test(value)) return alias.equipmentReference;
  }

  if (!DESCRIPTIVE_EQUIPMENT_CUE.test(value)) return null;
  const descriptiveTokens = equipmentIdentityTokens(value);
  if (descriptiveTokens.length < 2 || descriptiveTokens.length > 8) return null;
  return descriptiveTokens.slice(0, 6).join(" ");
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
