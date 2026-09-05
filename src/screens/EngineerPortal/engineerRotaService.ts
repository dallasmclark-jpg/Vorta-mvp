import { supabase } from "../../lib/supabaseClient";
import { VortaDataUnavailableError } from "../../lib/dataTrust";

export type EngineerRotaShiftType = "day" | "night";
export type EngineerRotaExceptionType =
  | "annual_leave"
  | "sickness"
  | "training"
  | "unavailable"
  | "overtime"
  | "contractor_cover"
  | "manual_assignment";

export type EngineerRotaPersonalStatus = "scheduled" | EngineerRotaExceptionType;

export interface EngineerRotaColleague {
  engineerId: string;
  fullName: string;
  discipline: string | null;
  employmentType: string | null;
  teamNames: string[];
  rosterSource: string;
  exceptionType: EngineerRotaExceptionType | null;
  isAvailable: boolean;
  isContractor: boolean;
}

export interface EngineerRotaCalendarItem {
  shiftDate: string;
  shiftType: EngineerRotaShiftType;
  teamNames: string[];
  personalStatus: EngineerRotaPersonalStatus;
  shiftEngineerCount: number;
  availableEngineerCount: number;
  holidayClashCount: number;
  sicknessCount: number;
  trainingCount: number;
  unavailableCount: number;
  contractorEngineerCount: number;
  colleagues: EngineerRotaColleague[];
}

export interface EngineerRotaWindowSnapshot {
  mode: "live";
  siteId: string;
  engineerId: string;
  generatedAt: string;
  sourceUpdatedAt: string | null;
  calendar: EngineerRotaCalendarItem[];
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXCEPTION_TYPES = new Set<EngineerRotaExceptionType>([
  "annual_leave",
  "sickness",
  "training",
  "unavailable",
  "overtime",
  "contractor_cover",
  "manual_assignment",
]);

function unavailable(message: string): never {
  throw new VortaDataUnavailableError(`Engineer rota evidence is invalid: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return unavailable(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function read(
  value: Record<string, unknown>,
  camelCaseKey: string,
  snakeCaseKey: string,
): unknown {
  return value[camelCaseKey] ?? value[snakeCaseKey];
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    return unavailable(`${label} is missing.`);
  }
  return value.trim();
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value.trim() || null : null;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") return unavailable(`${label} must be boolean.`);
  return value;
}

function integer(value: unknown, label: string): number {
  const output = Number(value);
  if (!Number.isInteger(output) || output < 0) {
    return unavailable(`${label} must be a non-negative integer.`);
  }
  return output;
}

function dateOnly(value: unknown, label: string): string {
  const output = stringValue(value, label);
  if (!DATE_ONLY_PATTERN.test(output)) return unavailable(`${label} must use YYYY-MM-DD.`);
  return output;
}

function timestamp(value: unknown, label: string): string {
  const output = stringValue(value, label);
  if (!Number.isFinite(Date.parse(output))) return unavailable(`${label} must be a timestamp.`);
  return output;
}

function nullableTimestamp(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return timestamp(value, label);
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) return unavailable(`${label} must be an array.`);
  return value.map((item, index) => stringValue(item, `${label}[${index}]`));
}

function exceptionType(
  value: unknown,
  label: string,
): EngineerRotaExceptionType | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && EXCEPTION_TYPES.has(value as EngineerRotaExceptionType)) {
    return value as EngineerRotaExceptionType;
  }
  return unavailable(`${label} is unsupported.`);
}

function parseColleague(value: unknown, index: number): EngineerRotaColleague {
  const label = `colleagues[${index}]`;
  const item = record(value, label);
  const isAvailable = booleanValue(
    read(item, "isAvailable", "is_available"),
    `${label}.isAvailable`,
  );

  // Absence reasons for other engineers are private. The rota only needs to
  // communicate whether cover is available, never why a colleague is absent.
  return {
    engineerId: stringValue(read(item, "engineerId", "engineer_id"), `${label}.engineerId`),
    fullName: stringValue(read(item, "fullName", "full_name"), `${label}.fullName`),
    discipline: nullableString(item.discipline),
    employmentType: nullableString(read(item, "employmentType", "employment_type")),
    teamNames: stringArray(read(item, "teamNames", "team_names"), `${label}.teamNames`),
    rosterSource: stringValue(read(item, "rosterSource", "roster_source"), `${label}.rosterSource`),
    exceptionType: isAvailable ? null : "unavailable",
    isAvailable,
    isContractor: booleanValue(read(item, "isContractor", "is_contractor"), `${label}.isContractor`),
  };
}

function parseCalendarItem(value: unknown, index: number): EngineerRotaCalendarItem {
  const label = `calendar[${index}]`;
  const item = record(value, label);
  const rawShiftType = read(item, "shiftType", "shift_type");
  if (rawShiftType !== "day" && rawShiftType !== "night") {
    return unavailable(`${label}.shiftType must be day or night.`);
  }

  const rawStatus = read(item, "personalStatus", "personal_status");
  const personalStatus =
    rawStatus === "scheduled"
      ? "scheduled"
      : exceptionType(rawStatus, `${label}.personalStatus`);
  if (!personalStatus) return unavailable(`${label}.personalStatus is missing.`);

  const rawColleagues = item.colleagues;
  if (!Array.isArray(rawColleagues)) return unavailable(`${label}.colleagues must be an array.`);

  const holidayClashCount = integer(
    read(item, "holidayClashCount", "holiday_clash_count"),
    `${label}.holidayClashCount`,
  );
  const sicknessCount = integer(
    read(item, "sicknessCount", "sickness_count"),
    `${label}.sicknessCount`,
  );
  const trainingCount = integer(
    read(item, "trainingCount", "training_count"),
    `${label}.trainingCount`,
  );
  const rawUnavailableCount = integer(
    read(item, "unavailableCount", "unavailable_count"),
    `${label}.unavailableCount`,
  );
  const privateReasonTotal = holidayClashCount + sicknessCount + trainingCount;

  return {
    shiftDate: dateOnly(read(item, "shiftDate", "shift_date"), `${label}.shiftDate`),
    shiftType: rawShiftType,
    teamNames: stringArray(read(item, "teamNames", "team_names"), `${label}.teamNames`),
    personalStatus,
    shiftEngineerCount: integer(read(item, "shiftEngineerCount", "shift_engineer_count"), `${label}.shiftEngineerCount`),
    availableEngineerCount: integer(read(item, "availableEngineerCount", "available_engineer_count"), `${label}.availableEngineerCount`),
    // Keep the existing UI contract but redact all reason-specific colleague
    // counts. The generic unavailable total is sufficient for cover planning.
    holidayClashCount: 0,
    sicknessCount: 0,
    trainingCount: 0,
    unavailableCount: Math.max(rawUnavailableCount, privateReasonTotal),
    contractorEngineerCount: integer(read(item, "contractorEngineerCount", "contractor_engineer_count"), `${label}.contractorEngineerCount`),
    colleagues: rawColleagues.map(parseColleague),
  };
}

export function validateEngineerRotaWindow(
  value: unknown,
  expectedEngineerId: string,
): EngineerRotaWindowSnapshot {
  const root = record(value, "snapshot");
  if (root.mode !== "live") return unavailable("mode must be live.");

  const engineerId = stringValue(read(root, "engineerId", "engineer_id"), "snapshot.engineerId");
  if (engineerId !== expectedEngineerId) {
    return unavailable("the response does not match the authenticated engineer.");
  }

  const rawCalendar = root.calendar;
  if (!Array.isArray(rawCalendar)) return unavailable("calendar must be an array.");

  return {
    mode: "live",
    siteId: stringValue(read(root, "siteId", "site_id"), "snapshot.siteId"),
    engineerId,
    generatedAt: timestamp(read(root, "generatedAt", "generated_at"), "snapshot.generatedAt"),
    sourceUpdatedAt: nullableTimestamp(
      read(root, "sourceUpdatedAt", "source_updated_at"),
      "snapshot.sourceUpdatedAt",
    ),
    calendar: rawCalendar.map(parseCalendarItem),
  };
}

export async function getEngineerRotaWindow(
  engineerId: string,
  startDate: string,
  endDate: string,
): Promise<EngineerRotaWindowSnapshot> {
  const { data, error } = await supabase.rpc("vorta_get_engineer_rota_window", {
    p_engineer_id: engineerId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    throw new VortaDataUnavailableError(
      `Engineer rota could not be loaded: ${error.message}`,
    );
  }
  if (!data) {
    throw new VortaDataUnavailableError(
      "Engineer rota evidence is unavailable for this account.",
    );
  }

  return validateEngineerRotaWindow(data, engineerId);
}
