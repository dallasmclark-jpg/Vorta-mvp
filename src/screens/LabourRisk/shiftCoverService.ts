import { supabase } from "../../lib/supabaseClient";
import { VortaDataUnavailableError } from "../../lib/dataTrust";

export type ShiftType = "day" | "night";
export type ShiftCoverageStatus =
  | "covered"
  | "reduced"
  | "partial"
  | "gap"
  | "contractor";

export interface ShiftCoverCalendarItem {
  shiftDate: string;
  shiftType: ShiftType;
  teamNames: string[];
  engineerNames: string[];
  scheduledEngineerCount: number;
  contractorEngineerCount: number;
  labourRiskScore: number;
  labourRiskLevel: string;
  coverageStatus: ShiftCoverageStatus;
  equipmentWithMissingCover: number;
  missingSkillCount: number;
}

export interface ShiftCoverTeamSummary {
  id: string;
  code: string;
  name: string;
  patternType: string;
  cycleOffset: number;
  memberCount: number;
}

export interface ShiftCoverCompleteness {
  activeTeamCount: number;
  activeMemberCount: number;
  engineerCount: number;
  skillRecordCount: number;
  expectedShiftCount: number;
  assignedShiftCount: number;
  staffedShiftCount: number;
  completeShiftCount: number;
  completenessPercent: number;
}

export interface ShiftCoverSnapshot {
  mode: "live";
  siteId: string;
  generatedAt: string;
  sourceUpdatedAt: string | null;
  calendar: ShiftCoverCalendarItem[];
  teams: ShiftCoverTeamSummary[];
  completeness: ShiftCoverCompleteness;
}

export interface ShiftCoverException {
  shiftDate: string;
  shiftType: ShiftType;
  engineerName: string | null;
  teamName: string | null;
  exceptionType: string;
  isAvailable: boolean;
  notes: string | null;
}

export interface ShiftCoverSkillRisk {
  shiftDate: string;
  shiftType: ShiftType;
  skillName: string;
  skillCategory: string | null;
  equipmentName: string;
  equipmentCode: string | null;
  requiredLevel: number;
  minimumQualifiedEngineers: number;
  qualifiedEngineerCount: number;
  qualifiedEngineerNames: string[];
  riskLevel: "critical" | "high";
}

export interface ShiftCoverAiBrief {
  mode: "live";
  siteId: string;
  generatedAt: string;
  startDate: string;
  endDate: string;
  calendar: ShiftCoverCalendarItem[];
  exceptions: ShiftCoverException[];
  skillRisks: ShiftCoverSkillRisk[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COVERAGE_STATUSES = new Set<ShiftCoverageStatus>([
  "covered",
  "reduced",
  "partial",
  "gap",
  "contractor",
]);

function unavailable(message: string): never {
  throw new VortaDataUnavailableError(`Shift Cover evidence is invalid: ${message}`);
}

function toRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return unavailable(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function read(
  record: Record<string, unknown>,
  camelCaseKey: string,
  snakeCaseKey: string,
): unknown {
  return record[camelCaseKey] ?? record[snakeCaseKey];
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    return unavailable(`${label} is missing.`);
  }
  return value.trim();
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    return unavailable(`${label} must be an array.`);
  }

  const values = value.map((item, index) =>
    requiredString(item, `${label}[${index}]`),
  );
  return [...new Set(values)];
}

function finiteNumber(
  value: unknown,
  label: string,
  options: {
    minimum?: number;
    maximum?: number;
    integer?: boolean;
  } = {},
): number {
  if (typeof value !== "number" && typeof value !== "string") {
    return unavailable(`${label} must be numeric.`);
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return unavailable(`${label} must be finite.`);
  }
  if (options.integer && !Number.isInteger(numeric)) {
    return unavailable(`${label} must be a whole number.`);
  }
  if (options.minimum !== undefined && numeric < options.minimum) {
    return unavailable(`${label} cannot be below ${options.minimum}.`);
  }
  if (options.maximum !== undefined && numeric > options.maximum) {
    return unavailable(`${label} cannot exceed ${options.maximum}.`);
  }
  return numeric;
}

function dateOnlyTimestamp(value: string, label: string): number {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return unavailable(`${label} must use YYYY-MM-DD format.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return unavailable(`${label} is not a real calendar date.`);
  }
  return timestamp;
}

function timestampString(value: unknown, label: string): string {
  const timestamp = requiredString(value, label);
  if (!Number.isFinite(new Date(timestamp).getTime())) {
    return unavailable(`${label} is not a valid timestamp.`);
  }
  return timestamp;
}

function nullableTimestamp(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return timestampString(value, label);
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredString(value, label);
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    return unavailable(`${label} must be true or false.`);
  }
  return value;
}

function shiftType(value: unknown, label: string): ShiftType {
  if (value === "day" || value === "night") return value;
  return unavailable(`${label} must be day or night.`);
}

function coverageStatus(value: unknown, label: string): ShiftCoverageStatus {
  if (typeof value === "string" && COVERAGE_STATUSES.has(value as ShiftCoverageStatus)) {
    return value as ShiftCoverageStatus;
  }
  return unavailable(`${label} is not a supported coverage state.`);
}

function parseCalendarItem(
  value: unknown,
  index: number,
  startTimestamp: number,
  endTimestamp: number,
): ShiftCoverCalendarItem {
  const label = `calendar[${index}]`;
  const record = toRecord(value, label);
  const shiftDate = requiredString(read(record, "shiftDate", "shift_date"), `${label}.shiftDate`);
  const shiftTimestamp = dateOnlyTimestamp(shiftDate, `${label}.shiftDate`);
  if (shiftTimestamp < startTimestamp || shiftTimestamp > endTimestamp) {
    return unavailable(`${label}.shiftDate falls outside the requested week.`);
  }

  return {
    shiftDate,
    shiftType: shiftType(read(record, "shiftType", "shift_type"), `${label}.shiftType`),
    teamNames: stringArray(read(record, "teamNames", "team_names"), `${label}.teamNames`),
    engineerNames: stringArray(
      read(record, "engineerNames", "engineer_names"),
      `${label}.engineerNames`,
    ),
    scheduledEngineerCount: finiteNumber(
      read(record, "scheduledEngineerCount", "scheduled_engineer_count"),
      `${label}.scheduledEngineerCount`,
      { minimum: 0, integer: true },
    ),
    contractorEngineerCount: finiteNumber(
      read(record, "contractorEngineerCount", "contractor_engineer_count"),
      `${label}.contractorEngineerCount`,
      { minimum: 0, integer: true },
    ),
    labourRiskScore: finiteNumber(
      read(record, "labourRiskScore", "labour_risk_score"),
      `${label}.labourRiskScore`,
      { minimum: 0, maximum: 100 },
    ),
    labourRiskLevel: requiredString(
      read(record, "labourRiskLevel", "labour_risk_level"),
      `${label}.labourRiskLevel`,
    ),
    coverageStatus: coverageStatus(
      read(record, "coverageStatus", "coverage_status"),
      `${label}.coverageStatus`,
    ),
    equipmentWithMissingCover: finiteNumber(
      read(record, "equipmentWithMissingCover", "equipment_with_missing_cover"),
      `${label}.equipmentWithMissingCover`,
      { minimum: 0, integer: true },
    ),
    missingSkillCount: finiteNumber(
      read(record, "missingSkillCount", "missing_skill_count"),
      `${label}.missingSkillCount`,
      { minimum: 0, integer: true },
    ),
  };
}

function parseTeam(value: unknown, index: number): ShiftCoverTeamSummary {
  const label = `teams[${index}]`;
  const record = toRecord(value, label);
  return {
    id: requiredString(record.id, `${label}.id`),
    code: requiredString(record.code, `${label}.code`),
    name: requiredString(record.name, `${label}.name`),
    patternType: requiredString(
      read(record, "patternType", "pattern_type"),
      `${label}.patternType`,
    ),
    cycleOffset: finiteNumber(
      read(record, "cycleOffset", "cycle_offset"),
      `${label}.cycleOffset`,
      { integer: true },
    ),
    memberCount: finiteNumber(
      read(record, "memberCount", "member_count"),
      `${label}.memberCount`,
      { minimum: 0, integer: true },
    ),
  };
}

function expectedShiftCount(startTimestamp: number, endTimestamp: number): number {
  return (Math.floor((endTimestamp - startTimestamp) / DAY_MS) + 1) * 2;
}

function calculateCompleteness(
  calendar: ShiftCoverCalendarItem[],
  expected: number,
): Pick<
  ShiftCoverCompleteness,
  | "expectedShiftCount"
  | "assignedShiftCount"
  | "staffedShiftCount"
  | "completeShiftCount"
  | "completenessPercent"
> {
  const assigned = calendar.filter((item) => item.teamNames.length > 0).length;
  const staffed = calendar.filter(
    (item) => item.scheduledEngineerCount + item.contractorEngineerCount > 0,
  ).length;
  const complete = calendar.filter(
    (item) =>
      item.teamNames.length > 0 &&
      item.scheduledEngineerCount + item.contractorEngineerCount > 0,
  ).length;

  return {
    expectedShiftCount: expected,
    assignedShiftCount: Math.min(assigned, expected),
    staffedShiftCount: Math.min(staffed, expected),
    completeShiftCount: Math.min(complete, expected),
    completenessPercent:
      expected > 0 ? Math.round((Math.min(complete, expected) / expected) * 100) : 0,
  };
}

function parseSnapshot(
  value: unknown,
  requestedSiteId: string,
  startDate: string,
  endDate: string,
): ShiftCoverSnapshot {
  const payload = toRecord(value, "snapshot");
  if (payload.mode !== "live") {
    return unavailable("snapshot.mode must be live.");
  }

  const siteId = requiredString(payload.siteId ?? payload.site_id, "snapshot.siteId");
  if (siteId !== requestedSiteId) {
    return unavailable("snapshot.siteId does not match the authorised active site.");
  }

  const startTimestamp = dateOnlyTimestamp(startDate, "requested start date");
  const endTimestamp = dateOnlyTimestamp(endDate, "requested end date");
  if (endTimestamp < startTimestamp) {
    return unavailable("requested end date is before the start date.");
  }

  if (!Array.isArray(payload.calendar)) {
    return unavailable("snapshot.calendar must be an array.");
  }
  if (!Array.isArray(payload.teams)) {
    return unavailable("snapshot.teams must be an array.");
  }

  const calendar = payload.calendar.map((item, index) =>
    parseCalendarItem(item, index, startTimestamp, endTimestamp),
  );
  const uniqueShifts = new Set(calendar.map((item) => `${item.shiftDate}:${item.shiftType}`));
  if (uniqueShifts.size !== calendar.length) {
    return unavailable("snapshot.calendar contains duplicate day or night shifts.");
  }

  const teams = payload.teams.map(parseTeam);
  const rawCompleteness = toRecord(payload.completeness, "snapshot.completeness");
  const expected = expectedShiftCount(startTimestamp, endTimestamp);

  return {
    mode: "live",
    siteId,
    generatedAt: timestampString(
      payload.generatedAt ?? payload.generated_at,
      "snapshot.generatedAt",
    ),
    sourceUpdatedAt: nullableTimestamp(
      payload.sourceUpdatedAt ?? payload.source_updated_at,
      "snapshot.sourceUpdatedAt",
    ),
    calendar,
    teams,
    completeness: {
      activeTeamCount: finiteNumber(
        rawCompleteness.activeTeamCount ?? rawCompleteness.active_team_count,
        "snapshot.completeness.activeTeamCount",
        { minimum: 0, integer: true },
      ),
      activeMemberCount: finiteNumber(
        rawCompleteness.activeMemberCount ?? rawCompleteness.active_member_count,
        "snapshot.completeness.activeMemberCount",
        { minimum: 0, integer: true },
      ),
      engineerCount: finiteNumber(
        rawCompleteness.engineerCount ?? rawCompleteness.engineer_count,
        "snapshot.completeness.engineerCount",
        { minimum: 0, integer: true },
      ),
      skillRecordCount: finiteNumber(
        rawCompleteness.skillRecordCount ?? rawCompleteness.skill_record_count,
        "snapshot.completeness.skillRecordCount",
        { minimum: 0, integer: true },
      ),
      ...calculateCompleteness(calendar, expected),
    },
  };
}

function parseException(value: unknown, index: number): ShiftCoverException {
  const label = `exceptions[${index}]`;
  const record = toRecord(value, label);
  return {
    shiftDate: requiredString(read(record, "shiftDate", "shift_date"), `${label}.shiftDate`),
    shiftType: shiftType(read(record, "shiftType", "shift_type"), `${label}.shiftType`),
    engineerName: nullableString(
      read(record, "engineerName", "engineer_name"),
      `${label}.engineerName`,
    ),
    teamName: nullableString(read(record, "teamName", "team_name"), `${label}.teamName`),
    exceptionType: requiredString(
      read(record, "exceptionType", "exception_type"),
      `${label}.exceptionType`,
    ),
    isAvailable: requiredBoolean(
      read(record, "isAvailable", "is_available"),
      `${label}.isAvailable`,
    ),
    notes: nullableString(record.notes, `${label}.notes`),
  };
}

function parseSkillRisk(value: unknown, index: number): ShiftCoverSkillRisk {
  const label = `skillRisks[${index}]`;
  const record = toRecord(value, label);
  const riskLevel = requiredString(
    read(record, "riskLevel", "risk_level"),
    `${label}.riskLevel`,
  ).toLowerCase();
  if (riskLevel !== "critical" && riskLevel !== "high") {
    return unavailable(`${label}.riskLevel must be critical or high.`);
  }

  return {
    shiftDate: requiredString(read(record, "shiftDate", "shift_date"), `${label}.shiftDate`),
    shiftType: shiftType(read(record, "shiftType", "shift_type"), `${label}.shiftType`),
    skillName: requiredString(read(record, "skillName", "skill_name"), `${label}.skillName`),
    skillCategory: nullableString(
      read(record, "skillCategory", "skill_category"),
      `${label}.skillCategory`,
    ),
    equipmentName: requiredString(
      read(record, "equipmentName", "equipment_name"),
      `${label}.equipmentName`,
    ),
    equipmentCode: nullableString(
      read(record, "equipmentCode", "equipment_code"),
      `${label}.equipmentCode`,
    ),
    requiredLevel: finiteNumber(
      read(record, "requiredLevel", "required_level"),
      `${label}.requiredLevel`,
      { minimum: 0, integer: true },
    ),
    minimumQualifiedEngineers: finiteNumber(
      read(record, "minimumQualifiedEngineers", "minimum_qualified_engineers"),
      `${label}.minimumQualifiedEngineers`,
      { minimum: 1, integer: true },
    ),
    qualifiedEngineerCount: finiteNumber(
      read(record, "qualifiedEngineerCount", "qualified_engineer_count"),
      `${label}.qualifiedEngineerCount`,
      { minimum: 0, integer: true },
    ),
    qualifiedEngineerNames: stringArray(
      read(record, "qualifiedEngineerNames", "qualified_engineer_names"),
      `${label}.qualifiedEngineerNames`,
    ),
    riskLevel,
  };
}

function parseAiBrief(
  value: unknown,
  requestedSiteId: string,
  startDate: string,
  endDate: string,
): ShiftCoverAiBrief {
  const payload = toRecord(value, "shiftCoverAiBrief");
  if (payload.mode !== "live") {
    return unavailable("shiftCoverAiBrief.mode must be live.");
  }

  const siteId = requiredString(payload.siteId ?? payload.site_id, "shiftCoverAiBrief.siteId");
  if (siteId !== requestedSiteId) {
    return unavailable("shiftCoverAiBrief.siteId does not match the authorised active site.");
  }

  if (!Array.isArray(payload.calendar)) {
    return unavailable("shiftCoverAiBrief.calendar must be an array.");
  }
  if (!Array.isArray(payload.exceptions)) {
    return unavailable("shiftCoverAiBrief.exceptions must be an array.");
  }
  const rawSkillRisks = payload.skillRisks ?? payload.skill_risks;
  if (!Array.isArray(rawSkillRisks)) {
    return unavailable("shiftCoverAiBrief.skillRisks must be an array.");
  }

  const startTimestamp = dateOnlyTimestamp(startDate, "requested start date");
  const endTimestamp = dateOnlyTimestamp(endDate, "requested end date");

  return {
    mode: "live",
    siteId,
    generatedAt: timestampString(
      payload.generatedAt ?? payload.generated_at,
      "shiftCoverAiBrief.generatedAt",
    ),
    startDate: requiredString(
      payload.startDate ?? payload.start_date,
      "shiftCoverAiBrief.startDate",
    ),
    endDate: requiredString(payload.endDate ?? payload.end_date, "shiftCoverAiBrief.endDate"),
    calendar: payload.calendar.map((item, index) =>
      parseCalendarItem(item, index, startTimestamp, endTimestamp),
    ),
    exceptions: payload.exceptions.map(parseException),
    skillRisks: rawSkillRisks.map(parseSkillRisk),
  };
}

export async function getShiftCoverSnapshot(
  siteId: string,
  startDate: string,
  endDate: string,
): Promise<ShiftCoverSnapshot> {
  const requestedSiteId = siteId.trim();
  if (!requestedSiteId) {
    throw new VortaDataUnavailableError(
      "Shift Cover is unavailable because no authorised active site was supplied.",
    );
  }

  const { data, error } = await supabase.rpc("vorta_get_shift_cover_snapshot", {
    p_site_id: requestedSiteId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    throw new VortaDataUnavailableError(
      `Shift Cover could not load verified site data: ${error.message}`,
    );
  }

  if (data === null || data === undefined) {
    throw new VortaDataUnavailableError(
      "Shift Cover returned no authorised site snapshot.",
    );
  }

  return parseSnapshot(data, requestedSiteId, startDate, endDate);
}

export async function getShiftCoverAiBrief(
  siteId: string,
  startDate: string,
  endDate: string,
): Promise<ShiftCoverAiBrief> {
  const requestedSiteId = siteId.trim();
  if (!requestedSiteId) {
    throw new VortaDataUnavailableError(
      "Shift Cover analysis is unavailable because no authorised active site was supplied.",
    );
  }

  const { data, error } = await supabase.rpc("vorta_get_shift_cover_ai_brief", {
    p_site_id: requestedSiteId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    throw new VortaDataUnavailableError(
      `Shift Cover analysis could not load verified site data: ${error.message}`,
    );
  }

  if (data === null || data === undefined) {
    throw new VortaDataUnavailableError(
      "Shift Cover analysis returned no authorised site evidence.",
    );
  }

  return parseAiBrief(data, requestedSiteId, startDate, endDate);
}
