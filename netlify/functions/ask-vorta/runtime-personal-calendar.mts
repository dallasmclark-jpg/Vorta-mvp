import type { Context } from "@netlify/functions";
import coreHandler from "./runtime-document-links.mjs";
import { authenticateAskVortaRequest } from "./authenticated-context.mjs";
import type { JsonRecord } from "./contracts.mjs";
import { jsonResponse } from "./request-context.mjs";

const PERSONAL_PATTERN = /\b(?:my|i\s+have|have\s+i|i've|i\s+got)\b/i;
const CALENDAR_PATTERN = /\b(?:training|course|overtime|extra\s+shift|extra\s+shifts|notes?|annual\s+leave|holiday|holidays|calendar|planned|appointment)\b/i;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function text(row: JsonRecord, key: string): string {
  return typeof row[key] === "string" ? String(row[key]).trim() : "";
}

function numberValue(row: JsonRecord, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

function queryYear(question: string, now: Date): number {
  const explicit = question.match(/\b(20\d{2})\b/)?.[1];
  if (explicit) return Number(explicit);
  if (/\blast\s+year\b/i.test(question)) return now.getFullYear() - 1;
  if (/\bnext\s+year\b/i.test(question)) return now.getFullYear() + 1;
  return now.getFullYear();
}

function entryDate(row: JsonRecord): string {
  return text(row, "entryDate") || text(row, "entry_date");
}

function entryType(row: JsonRecord): string {
  return text(row, "entryType") || text(row, "entry_type");
}

function entryTitle(row: JsonRecord): string {
  return text(row, "title") || "Calendar entry";
}

function entryStatus(row: JsonRecord): string {
  return text(row, "status") || "planned";
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function buildAnswer(
  question: string,
  year: number,
  payload: JsonRecord,
): JsonRecord {
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const manual = records(payload.entries);
  const formalTraining = records(payload.formalTraining);
  const all = [...manual, ...formalTraining];
  const sources = ["Engineer profile calendar"];
  if (formalTraining.length > 0) sources.push("Training bookings");

  let directAnswer = "I couldn't find any matching Engineer profile calendar records.";
  let summary: JsonRecord[] = [];
  const lower = question.toLowerCase();

  if (/\bovertime\b|extra\s+shift/i.test(question)) {
    const overtime = manual.filter(
      (row) => entryType(row) === "overtime" && entryStatus(row) !== "cancelled",
    );
    const worked = overtime.filter((row) => entryDate(row) <= todayKey);
    const upcoming = overtime.filter((row) => entryDate(row) > todayKey);
    const workedHours = worked.reduce((total, row) => total + numberValue(row, "hours"), 0);
    directAnswer =
      worked.length === 0
        ? `You have no overtime shifts recorded as worked in ${year}.`
        : `You have ${worked.length} overtime shift${worked.length === 1 ? "" : "s"} recorded as worked in ${year}${workedHours > 0 ? `, totalling ${workedHours} hours` : ""}.`;
    if (upcoming.length > 0) {
      directAnswer += ` You also have ${upcoming.length} future overtime shift${upcoming.length === 1 ? "" : "s"} planned.`;
    }
    summary = [
      { label: "Overtime worked", value: String(worked.length) },
      { label: "Recorded hours", value: workedHours > 0 ? `${workedHours} h` : "No hours entered" },
      { label: "Future overtime", value: String(upcoming.length) },
    ];
  } else if (/\btraining\b|\bcourse\b/i.test(question)) {
    const training = all
      .filter((row) => entryType(row) === "training" && entryStatus(row) !== "cancelled")
      .sort((a, b) => entryDate(a).localeCompare(entryDate(b)));
    const planned = training.filter(
      (row) => entryDate(row) >= todayKey && entryStatus(row) !== "completed",
    );
    const relevant = /planned|coming|upcoming|got/i.test(lower) ? planned : training;
    directAnswer =
      relevant.length === 0
        ? `You have no ${planned === relevant ? "planned " : ""}training recorded for ${year}.`
        : `You have ${relevant.length} ${planned === relevant ? "planned " : ""}training item${relevant.length === 1 ? "" : "s"} in ${year}: ${relevant
            .slice(0, 8)
            .map((row) => `${entryTitle(row)} on ${formatDate(entryDate(row))}`)
            .join("; ")}${relevant.length > 8 ? "; plus more in your rota" : ""}.`;
    summary = relevant.slice(0, 5).map((row) => ({
      label: formatDate(entryDate(row)),
      value: entryTitle(row),
    }));
  } else if (/\bnote\b/i.test(question)) {
    const notes = manual
      .filter((row) => entryType(row) === "note" && entryStatus(row) !== "cancelled")
      .sort((a, b) => entryDate(b).localeCompare(entryDate(a)));
    directAnswer = `You have ${notes.length} note${notes.length === 1 ? "" : "s"} saved to your Engineer profile for ${year}.`;
    summary = notes.slice(0, 5).map((row) => ({
      label: formatDate(entryDate(row)),
      value: entryTitle(row),
    }));
  } else {
    const active = all.filter((row) => entryStatus(row) !== "cancelled");
    directAnswer = `You have ${active.length} personal calendar item${active.length === 1 ? "" : "s"} recorded for ${year}.`;
    summary = active.slice(0, 6).map((row) => ({
      label: formatDate(entryDate(row)),
      value: `${entryTitle(row)} · ${entryType(row).replaceAll("_", " ")}`,
    }));
  }

  return {
    responseId: crypto.randomUUID(),
    directAnswer,
    decisionSummary: summary,
    evidence: all.slice(0, 20).map((row) =>
      `${entryDate(row)} | ${entryType(row)} | ${entryTitle(row)} | ${entryStatus(row)}`,
    ),
    findings: [],
    coverOptions: [],
    recommendedActions: [],
    actionPlan: [],
    followUpQuestions: [],
    sources,
    missingData: [],
    confidence: 99,
    intentLabel: "engineer_personal_calendar",
    toolsUsed: ["vorta_get_my_engineer_calendar"],
    evidenceLinks: [
      {
        label: "Open my rota",
        path: "/engineer/rota",
        recordType: "rota",
      },
    ],
    evidenceGeneratedAt: new Date().toISOString(),
  };
}

export default async function personalCalendarHandler(
  req: Request,
  context: Context,
): Promise<Response> {
  const fallbackRequest = req.clone();
  const authenticated = await authenticateAskVortaRequest(req.clone());
  if (!authenticated.ok) return authenticated.response;

  const { request, supabase } = authenticated;
  if (!PERSONAL_PATTERN.test(request.question) || !CALENDAR_PATTERN.test(request.question)) {
    return coreHandler(fallbackRequest, context);
  }

  const now = new Date();
  const year = queryYear(request.question, now);
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const { data, error } = await supabase.rpc("vorta_get_my_engineer_calendar", {
    p_site_id: request.siteId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error || !record(data)) return coreHandler(fallbackRequest, context);

  return jsonResponse(buildAnswer(request.question, year, record(data) as JsonRecord));
}
