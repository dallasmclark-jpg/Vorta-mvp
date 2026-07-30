from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement, found {count}: {old[:100]!r}")
    target.write_text(content.replace(old, new, 1))


# Edge function: load identity and effective-dated team evidence, then attach it to confirmations.
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    'import { buildShiftHandoverPayload } from "./transform.ts";\n',
    'import { buildShiftHandoverPayload } from "./transform.ts";\n'
    'import { attachMaintenanceTeamAttribution } from "./teamAttribution.ts";\n',
)
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '.select("id,site_id,work_order_id,confirmation_number,operation_number,confirmation_text,confirmed_by,work_center,posting_date,confirmation_timestamp,actual_work,work_unit,actual_duration,duration_unit,final_confirmation,reversal,reason_code,source_system,source_updated_at,created_at")',
    '.select("id,site_id,work_order_id,confirmation_number,operation_number,confirmation_text,confirmed_by,personnel_number,work_center,posting_date,confirmation_timestamp,actual_work,work_unit,actual_duration,duration_unit,final_confirmation,reversal,reason_code,source_system,source_updated_at,created_at")',
)
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''      db
        .from("maintenance_shift_teams")
        .select("code,name,pattern_type")
        .eq("site_id", siteId)
        .eq("active", true),''',
    '''      db
        .from("maintenance_shift_teams")
        .select("id,code,name,pattern_type,active")
        .eq("site_id", siteId),''',
)
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''      teamResult.data ?? [],
      timeZone,''',
    '''      (teamResult.data ?? []).filter((row: AnyRow) => row.active),
      timeZone,''',
)
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''    const confirmations = await loadConfirmations(db, siteId, window.start, window.end);
    const workOrderIds = [...new Set(
      confirmations''',
    '''    const rawConfirmations = await loadConfirmations(db, siteId, window.start, window.end);
    const workOrderIds = [...new Set(
      rawConfirmations''',
)
replace_once(
    "supabase/functions/shift-handover-data/index.ts",
    '''    const payload = buildShiftHandoverPayload({
      site,
      window,
      workOrders,
      confirmations,''',
    '''    const { data: engineers, error: engineersError } = await db
      .from("engineers")
      .select("id,site_id,organisation_id,full_name,discipline")
      .eq("site_id", siteId)
      .eq("organisation_id", organisationId);
    if (engineersError) throw engineersError;

    const engineerIds = (engineers ?? []).map((row: AnyRow) => String(row.id));
    const [identityResult, membershipResult] = await Promise.all([
      db
        .from("engineer_source_identities")
        .select("engineer_id,site_id,source_system,identity_type,source_identity,mapping_status,confidence_score,valid_from,valid_until,verified_at")
        .eq("site_id", siteId)
        .eq("source_system", "SAP")
        .eq("identity_type", "personnel_number")
        .eq("mapping_status", "verified"),
      engineerIds.length
        ? db
            .from("maintenance_shift_team_members")
            .select("team_id,engineer_id,active_from,active_to")
            .in("engineer_id", engineerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (identityResult.error) throw identityResult.error;
    if (membershipResult.error) throw membershipResult.error;

    const confirmations = attachMaintenanceTeamAttribution({
      confirmations: rawConfirmations,
      engineers: engineers ?? [],
      identities: identityResult.data ?? [],
      memberships: membershipResult.data ?? [],
      teams: teamResult.data ?? [],
    });

    const payload = buildShiftHandoverPayload({
      site,
      window,
      workOrders,
      confirmations,''',
)

# Transform: preserve status normalisation, add team data to each confirmation and unique work-order aggregation.
replace_once(
    "supabase/functions/shift-handover-data/transform.ts",
    '''    const equipmentName = text(equipmentRow?.name) || "Unknown equipment";

    return {''',
    '''    const equipmentName = text(equipmentRow?.name) || "Unknown equipment";
    const maintenanceTeamMap = new Map<string, AnyRow>();
    let hasUnassignedActivity = false;
    for (const confirmation of orderConfirmations) {
      const teams = Array.isArray(confirmation.maintenance_teams)
        ? confirmation.maintenance_teams
        : [];
      if (teams.length === 0) hasUnassignedActivity = true;
      for (const team of teams) {
        const code = text(team.code).toUpperCase();
        if (!code || maintenanceTeamMap.has(code)) continue;
        maintenanceTeamMap.set(code, {
          code,
          name: text(team.name),
          source: text(team.source),
        });
      }
    }
    const maintenanceTeams = [...maintenanceTeamMap.values()];

    return {''',
)
replace_once(
    "supabase/functions/shift-handover-data/transform.ts",
    '''      assignedEngineer: text(order.assigned_engineer) || text(latestConfirmation?.confirmed_by) || null,
      mainWorkCenter:''',
    '''      assignedEngineer: text(order.assigned_engineer) || text(latestConfirmation?.confirmed_by) || null,
      maintenanceTeams,
      hasUnassignedActivity,
      mainWorkCenter:''',
)
replace_once(
    "supabase/functions/shift-handover-data/transform.ts",
    '''        finalConfirmation: Boolean(row.final_confirmation),
      })),''',
    '''        finalConfirmation: Boolean(row.final_confirmation),
        maintenanceTeams: Array.isArray(row.maintenance_teams)
          ? row.maintenance_teams.map((team: AnyRow) => ({
              code: text(team.code).toUpperCase(),
              name: text(team.name),
              source: text(team.source),
            })).filter((team: AnyRow) => Boolean(team.code && team.name))
          : [],
      })),''',
)

# Client service contract and defensive parsing.
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    'import type { VortaDataMode } from "../../lib/dataTrust";\n',
    'import type { VortaDataMode } from "../../lib/dataTrust";\n'
    'import type { VortaMaintenanceTeamCode } from "../../lib/shiftPresentation";\n',
)
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''export interface ShiftHandoverConfirmation {
  id: string;''',
    '''export interface ShiftHandoverMaintenanceTeam {
  code: Exclude<VortaMaintenanceTeamCode, "UNASSIGNED">;
  name: string;
  source: "recorded" | "historical_membership" | "specialist_scope";
}

export interface ShiftHandoverConfirmation {
  id: string;''',
)
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''  finalConfirmation: boolean;
}''',
    '''  finalConfirmation: boolean;
  maintenanceTeams: ShiftHandoverMaintenanceTeam[];
}''',
)
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''  assignedEngineer: string | null;
  mainWorkCenter:''',
    '''  assignedEngineer: string | null;
  maintenanceTeams: ShiftHandoverMaintenanceTeam[];
  hasUnassignedActivity: boolean;
  mainWorkCenter:''',
)
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''function parseConfirmation(value: unknown): ShiftHandoverConfirmation | null {''',
    '''function parseMaintenanceTeam(value: unknown): ShiftHandoverMaintenanceTeam | null {
  const row = objectValue(value);
  const code = stringValue(row?.code).toUpperCase();
  const source = stringValue(row?.source);
  if (
    !row
    || !["BLUE", "RED", "GREEN", "YELLOW", "DAYS", "CALIBRATION"].includes(code)
    || !["recorded", "historical_membership", "specialist_scope"].includes(source)
  ) return null;
  return {
    code: code as ShiftHandoverMaintenanceTeam["code"],
    name: stringValue(row.name),
    source: source as ShiftHandoverMaintenanceTeam["source"],
  };
}

function parseMaintenanceTeams(value: unknown): ShiftHandoverMaintenanceTeam[] {
  return Array.isArray(value)
    ? value.map(parseMaintenanceTeam).filter((item): item is ShiftHandoverMaintenanceTeam => Boolean(item))
    : [];
}

function parseConfirmation(value: unknown): ShiftHandoverConfirmation | null {''',
)
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''    finalConfirmation: Boolean(row.finalConfirmation),
  };''',
    '''    finalConfirmation: Boolean(row.finalConfirmation),
    maintenanceTeams: parseMaintenanceTeams(row.maintenanceTeams),
  };''',
)
replace_once(
    "src/screens/ShiftHandover/shiftHandoverService.ts",
    '''    assignedEngineer: stringValue(row.assignedEngineer) || null,
    mainWorkCenter:''',
    '''    assignedEngineer: stringValue(row.assignedEngineer) || null,
    maintenanceTeams: parseMaintenanceTeams(row.maintenanceTeams),
    hasUnassignedActivity: Boolean(row.hasUnassignedActivity),
    mainWorkCenter:''',
)

print("VOR-031 backend patch applied")
