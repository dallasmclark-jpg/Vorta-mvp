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

interface RawShiftCoverCalendarItem {
  shift_date?: unknown;
  shift_type?: unknown;
  team_names?: unknown;
  engineer_names?: unknown;
  scheduled_engineer_count?: unknown;
  contractor_engineer_count?: unknown;
  labour_risk_score?: unknown;
  labour_risk_level?: unknown;
  coverage_status?: unknown;
  equipment_with_missing_cover?: unknown;
  missing_skill_count?: unknown;
}

interface RawShiftCoverTeamSummary {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  pattern_type?: unknown;
  cycle_offset?: unknown;
  member_count?: unknown;
}

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

function parseCalendarItem(
  value: RawShiftCoverCalendarItem,
): ShiftCoverCalendarItem {
  return {
    shiftDate: String(value.shift_date ?? ""),
    shiftType: toShiftType(value.shift_type),
    teamNames: toStringArray(value.team_names),
    engineerNames: toStringArray(value.engineer_names),
    scheduledEngineerCount: toNumber(value.scheduled_engineer_count),
    contractorEngineerCount: toNumber(value.contractor_engineer_count),
    labourRiskScore: toNumber(value.labour_risk_score),
    labourRiskLevel: String(value.labour_risk_level ?? "Unavailable"),
    coverageStatus: toCoverageStatus(value.coverage_status),
    equipmentWithMissingCover: toNumber(value.equipment_with_missing_cover),
    missingSkillCount: toNumber(value.missing_skill_count),
  };
}

function parseTeam(
  value: RawShiftCoverTeamSummary,
): ShiftCoverTeamSummary {
  return {
    id: String(value.id ?? ""),
    code: String(value.code ?? ""),
    name: String(value.name ?? "Unnamed team"),
    patternType: String(value.pattern_type ?? "unknown"),
    cycleOffset: toNumber(value.cycle_offset),
    memberCount: toNumber(value.member_count),
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
    ? payload.calendar.map((item) =>
        parseCalendarItem(item as RawShiftCoverCalendarItem),
      )
    : [];
  const teams = Array.isArray(payload.teams)
    ? payload.teams.map((item) =>
        parseTeam(item as RawShiftCoverTeamSummary),
      )
    : [];
  const rawCompleteness =
    payload.completeness && typeof payload.completeness === "object"
      ? (payload.completeness as Record<string, unknown>)
      : {};

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
