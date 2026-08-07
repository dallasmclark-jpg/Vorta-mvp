import { supabase } from "../../lib/supabaseClient";
import { VortaDataUnavailableError } from "../../lib/dataTrust";

export type OperationalRotaShiftType = "day" | "night";
export type OperationalRotaCoverageStatus =
  | "covered"
  | "reduced"
  | "partial"
  | "gap"
  | "contractor";

export interface OperationalRotaCalendarItem {
  shiftDate: string;
  shiftType: OperationalRotaShiftType;
  teamNames: string[];
  engineerNames: string[];
  scheduledEngineerCount: number;
  contractorEngineerCount: number;
  labourRiskScore: number;
  labourRiskLevel: string;
  coverageStatus: OperationalRotaCoverageStatus;
  equipmentWithMissingCover: number;
  missingSkillCount: number;
}

export interface OperationalRotaTeam {
  id: string;
  code: string;
  name: string;
  patternType: "continental" | "days";
  cycleOffset: number;
  referenceDate: string;
  requiredHeadcount: number;
  memberNames: string[];
}

export interface OperationalRotaSnapshot {
  mode: "live";
  siteId: string;
  generatedAt: string;
  sourceUpdatedAt: string | null;
  calendar: OperationalRotaCalendarItem[];
  teams: OperationalRotaTeam[];
  smeDependencyCount: number;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COVERAGE = new Set<OperationalRotaCoverageStatus>([
  "covered",
  "reduced",
  "partial",
  "gap",
  "contractor",
]);

function unavailable(message: string): never {
  throw new VortaDataUnavailableError(`Operational rota evidence is invalid: ${message}`);
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

function dateOnly(value: unknown, label: string): string {
  const output = stringValue(value, label);
  if (!DATE_ONLY_PATTERN.test(output)) {
    return unavailable(`${label} must use YYYY-MM-DD format.`);
  }
  const timestamp = Date.parse(`${output}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) {
    return unavailable(`${label} is not a valid date.`);
  }
  return output;
}

function timestamp(value: unknown, label: string): string {
  const output = stringValue(value, label);
  if (!Number.isFinite(Date.parse(output))) {
    return unavailable(`${label} is not a valid timestamp.`);
  }
  return output;
}

function nullableTimestamp(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return timestamp(value, label);
}

function integer(value: unknown, label: string, minimum = 0): number {
  const output = Number(value);
  if (!Number.isInteger(output) || output < minimum) {
    return unavailable(`${label} must be an integer of at least ${minimum}.`);
  }
  return output;
}

function numberValue(
  value: unknown,
  label: string,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
): number {
  const output = Number(value);
  if (!Number.isFinite(output) || output < minimum || output > maximum) {
    return unavailable(`${label} is outside the allowed range.`);
  }
  return output;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) return unavailable(`${label} must be an array.`);
  return [...new Set(value.map((item, index) => stringValue(item, `${label}[${index}]`)))];
}

function shiftType(value: unknown, label: string): OperationalRotaShiftType {
  if (value === "day" || value === "night") return value;
  return unavailable(`${label} must be day or night.`);
}

function coverageStatus(value: unknown, label: string): OperationalRotaCoverageStatus {
  if (typeof value === "string" && COVERAGE.has(value as OperationalRotaCoverageStatus)) {
    return value as OperationalRotaCoverageStatus;
  }
  return unavailable(`${label} is unsupported.`);
}

function parseCalendar(value: unknown, index: number): OperationalRotaCalendarItem {
  const label = `calendar[${index}]`;
  const item = record(value, label);
  return {
    shiftDate: dateOnly(read(item, "shiftDate", "shift_date"), `${label}.shiftDate`),
    shiftType: shiftType(read(item, "shiftType", "shift_type"), `${label}.shiftType`),
    teamNames: stringArray(read(item, "teamNames", "team_names"), `${label}.teamNames`),
    engineerNames: stringArray(
      read(item, "engineerNames", "engineer_names"),
      `${label}.engineerNames`,
    ),
    scheduledEngineerCount: integer(
      read(item, "scheduledEngineerCount", "scheduled_engineer_count"),
      `${label}.scheduledEngineerCount`,
    ),
    contractorEngineerCount: integer(
      read(item, "contractorEngineerCount", "contractor_engineer_count"),
      `${label}.contractorEngineerCount`,
    ),
    labourRiskScore: numberValue(
      read(item, "labourRiskScore", "labour_risk_score"),
      `${label}.labourRiskScore`,
      0,
      100,
    ),
    labourRiskLevel: stringValue(
      read(item, "labourRiskLevel", "labour_risk_level"),
      `${label}.labourRiskLevel`,
    ),
    coverageStatus: coverageStatus(
      read(item, "coverageStatus", "coverage_status"),
      `${label}.coverageStatus`,
    ),
    equipmentWithMissingCover: integer(
      read(item, "equipmentWithMissingCover", "equipment_with_missing_cover"),
      `${label}.equipmentWithMissingCover`,
    ),
    missingSkillCount: integer(
      read(item, "missingSkillCount", "missing_skill_count"),
      `${label}.missingSkillCount`,
    ),
  };
}

function parseTeam(value: unknown, index: number): OperationalRotaTeam {
  const label = `teams[${index}]`;
  const item = record(value, label);
  const patternType = stringValue(
    read(item, "patternType", "pattern_type"),
    `${label}.patternType`,
  );
  if (patternType !== "continental" && patternType !== "days") {
    return unavailable(`${label}.patternType is unsupported.`);
  }

  return {
    id: stringValue(item.id, `${label}.id`),
    code: stringValue(item.code, `${label}.code`),
    name: stringValue(item.name, `${label}.name`),
    patternType,
    cycleOffset: integer(
      read(item, "cycleOffset", "cycle_offset"),
      `${label}.cycleOffset`,
      -1000,
    ),
    referenceDate: dateOnly(
      read(item, "referenceDate", "reference_date"),
      `${label}.referenceDate`,
    ),
    requiredHeadcount: integer(
      read(item, "requiredHeadcount", "required_headcount"),
      `${label}.requiredHeadcount`,
      1,
    ),
    memberNames: stringArray(
      read(item, "memberNames", "member_names"),
      `${label}.memberNames`,
    ),
  };
}

export function validateOperationalRotaSnapshot(
  value: unknown,
  expectedSiteId: string,
): OperationalRotaSnapshot {
  const root = record(value, "snapshot");
  if (root.mode !== "live") {
    return unavailable("mode must be live.");
  }

  const siteId = stringValue(read(root, "siteId", "site_id"), "snapshot.siteId");
  if (siteId !== expectedSiteId) {
    return unavailable("the response does not match the authorised active site.");
  }

  const rawCalendar = root.calendar;
  const rawTeams = root.teams;
  if (!Array.isArray(rawCalendar)) return unavailable("calendar must be an array.");
  if (!Array.isArray(rawTeams)) return unavailable("teams must be an array.");

  const calendar = rawCalendar.map(parseCalendar);
  const seenShiftKeys = new Set<string>();
  for (const item of calendar) {
    const key = `${item.shiftDate}:${item.shiftType}`;
    if (seenShiftKeys.has(key)) {
      return unavailable(`duplicate shift evidence was returned for ${key}.`);
    }
    seenShiftKeys.add(key);
    if (item.contractorEngineerCount > item.scheduledEngineerCount) {
      return unavailable(`contractor count exceeds scheduled headcount for ${key}.`);
    }
    if (item.engineerNames.length !== item.scheduledEngineerCount) {
      return unavailable(`named roster count does not match scheduled headcount for ${key}.`);
    }
  }

  const teams = rawTeams.map(parseTeam);
  const seenTeamIds = new Set<string>();
  for (const team of teams) {
    if (seenTeamIds.has(team.id)) return unavailable(`duplicate team ${team.id}.`);
    seenTeamIds.add(team.id);
  }

  return {
    mode: "live",
    siteId,
    generatedAt: timestamp(read(root, "generatedAt", "generated_at"), "snapshot.generatedAt"),
    sourceUpdatedAt: nullableTimestamp(
      read(root, "sourceUpdatedAt", "source_updated_at"),
      "snapshot.sourceUpdatedAt",
    ),
    calendar,
    teams,
    smeDependencyCount: integer(
      read(root, "smeDependencyCount", "sme_dependency_count") ?? 0,
      "snapshot.smeDependencyCount",
    ),
  };
}

export async function getOperationalRotaSnapshot(
  siteId: string,
  startDate: string,
  endDate: string,
): Promise<OperationalRotaSnapshot> {
  const { data, error } = await supabase.rpc("vorta_get_shift_cover_snapshot", {
    p_site_id: siteId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    throw new VortaDataUnavailableError(
      `Operational rota evidence could not be loaded: ${error.message}`,
    );
  }
  if (!data) {
    throw new VortaDataUnavailableError(
      "Operational rota evidence is unavailable for the authorised active site.",
    );
  }
  return validateOperationalRotaSnapshot(data, siteId);
}
