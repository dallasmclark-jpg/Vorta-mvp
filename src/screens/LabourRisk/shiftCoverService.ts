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

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const read = (
  record: Record<string, unknown>,
  camelCaseKey: string,
  snakeCaseKey: string,
): unknown => record[camelCaseKey] ?? record[snakeCaseKey];

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const toNumber = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toShiftType = (value: unknown): ShiftType =>
  String(value).toLowerCase() === "night" ? "night" : "day";

const toCoverageStatus = (value: unknown): ShiftCoverageStatus => {
  const status = String(value).toLowerCase();

  if (
    status === "covered" ||
    status === "reduced" ||
    status === "partial" ||
    status === "gap" ||
    status === "contractor"
  ) {
    return status;
  }

  return "gap";
};

function parseCalendarItem(value: unknown): ShiftCoverCalendarItem {
  const record = toRecord(value);

  return {
    shiftDate: String(read(record, "shiftDate", "shift_date") ?? ""),
    shiftType: toShiftType(read(record, "shiftType", "shift_type")),
    teamNames: toStringArray(read(record, "teamNames", "team_names")),
    engineerNames: toStringArray(
      read(record, "engineerNames", "engineer_names"),
    ),
    scheduledEngineerCount: toNumber(
      read(
        record,
        "scheduledEngineerCount",
        "scheduled_engineer_count",
      ),
    ),
    contractorEngineerCount: toNumber(
      read(
        record,
        "contractorEngineerCount",
        "contractor_engineer_count",
      ),
    ),
    labourRiskScore: toNumber(
      read(record, "labourRiskScore", "labour_risk_score"),
    ),
    labourRiskLevel: String(
      read(record, "labourRiskLevel", "labour_risk_level") ??
        "Unavailable",
    ),
    coverageStatus: toCoverageStatus(
      read(record, "coverageStatus", "coverage_status"),
    ),
    equipmentWithMissingCover: toNumber(
      read(
        record,
        "equipmentWithMissingCover",
        "equipment_with_missing_cover",
      ),
    ),
    missingSkillCount: toNumber(
      read(record, "missingSkillCount", "missing_skill_count"),
    ),
  };
}

function parseTeam(value: unknown): ShiftCoverTeamSummary {
  const record = toRecord(value);

  return {
    id: String(record.id ?? ""),
    code: String(record.code ?? ""),
    name: String(record.name ?? "Unnamed team"),
    patternType: String(
      read(record, "patternType", "pattern_type") ?? "unknown",
    ),
    cycleOffset: toNumber(read(record, "cycleOffset", "cycle_offset")),
    memberCount: toNumber(read(record, "memberCount", "member_count")),
  };
}

export async function getShiftCoverSnapshot(
  siteId: string,
  startDate: string,
  endDate: string,
): Promise<ShiftCoverSnapshot> {
  const { data, error } = await supabase.rpc(
    "vorta_get_shift_cover_snapshot",
    {
      p_site_id: siteId,
      p_start_date: startDate,
      p_end_date: endDate,
    },
  );

  if (error) {
    throw new VortaDataUnavailableError(
      `Shift Cover could not load verified site data: ${error.message}`,
    );
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new VortaDataUnavailableError(
      "Shift Cover returned no authorised site snapshot.",
    );
  }

  const payload = data as Record<string, unknown>;
  const calendar = Array.isArray(payload.calendar)
    ? payload.calendar.map(parseCalendarItem)
    : [];
  const teams = Array.isArray(payload.teams)
    ? payload.teams.map(parseTeam)
    : [];
  const rawCompleteness = toRecord(payload.completeness);

  return {
    mode: "live",
    siteId: String(payload.siteId ?? payload.site_id ?? siteId),
    generatedAt: String(
      payload.generatedAt ?? payload.generated_at ?? new Date().toISOString(),
    ),
    sourceUpdatedAt:
      typeof (payload.sourceUpdatedAt ?? payload.source_updated_at) === "string"
        ? String(payload.sourceUpdatedAt ?? payload.source_updated_at)
        : null,
    calendar,
    teams,
    completeness: {
      activeTeamCount: toNumber(
        rawCompleteness.activeTeamCount ??
          rawCompleteness.active_team_count,
      ),
      activeMemberCount: toNumber(
        rawCompleteness.activeMemberCount ??
          rawCompleteness.active_member_count,
      ),
      engineerCount: toNumber(
        rawCompleteness.engineerCount ?? rawCompleteness.engineer_count,
      ),
      skillRecordCount: toNumber(
        rawCompleteness.skillRecordCount ??
          rawCompleteness.skill_record_count,
      ),
    },
  };
}
