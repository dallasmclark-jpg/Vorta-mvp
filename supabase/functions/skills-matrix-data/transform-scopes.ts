import {
  SHIFT_CODES,
  SPECIALIST_CODES,
  TEAM_ORDER,
  isCurrentMember,
  lower,
} from "./transform-helpers.ts";

export function buildTeamScopes(
  engineers: any[],
  shiftTeams: any[],
  shiftMembers: any[],
  today: string,
): any[] {
  const activeMembers = shiftMembers.filter((row) => isCurrentMember(row, today));
  const explicitMemberIds = (teamId: string): string[] =>
    activeMembers
      .filter((member) => member.team_id === teamId)
      .map((member) => member.engineer_id);

  const shiftScopes = shiftTeams
    .filter((team) => SHIFT_CODES.has(team.code))
    .map((team) => ({
      id: `team:${team.code}`,
      code: team.code,
      name: team.code === "DAYS" ? "Day Team" : team.name,
      scopeType: "team",
      memberIds: explicitMemberIds(team.id),
    }))
    .sort(
      (left, right) =>
        (TEAM_ORDER[left.code] ?? 99) - (TEAM_ORDER[right.code] ?? 99),
    );

  const explicitSpecialists = new Map(
    shiftTeams
      .filter((team) => SPECIALIST_CODES.has(team.code))
      .map((team) => [team.code, team]),
  );

  const inferredCalibrationIds = engineers
    .filter((engineer) => {
      const discipline = lower(engineer.discipline);
      return discipline.includes("calibration") || discipline === "instrumentation";
    })
    .map((engineer) => engineer.id);

  const inferredOtIds = engineers
    .filter((engineer) => {
      const discipline = lower(engineer.discipline);
      return (
        discipline.includes("automation") ||
        discipline.includes("plc") ||
        discipline.includes("operational technology") ||
        discipline.includes("controls")
      );
    })
    .map((engineer) => engineer.id);

  const calibrationTeam: any = explicitSpecialists.get("CALIBRATION");
  const otTeam: any = explicitSpecialists.get("OT");

  return [
    ...shiftScopes,
    {
      id: "team:CALIBRATION",
      code: "CALIBRATION",
      name: "Calibration Team",
      scopeType: "team",
      memberIds: calibrationTeam
        ? explicitMemberIds(calibrationTeam.id)
        : inferredCalibrationIds,
    },
    {
      id: "team:OT",
      code: "OT",
      name: "Operational Technology Team",
      scopeType: "team",
      memberIds: otTeam ? explicitMemberIds(otTeam.id) : inferredOtIds,
    },
  ];
}

export function buildDepartmentScopes(
  engineers: any[],
  departments: any[],
): any[] {
  return departments
    .map((department) => ({
      id: `department:${department.id}`,
      code: department.id,
      name: department.name,
      scopeType: "department",
      memberIds: engineers
        .filter((engineer) => engineer.department_id === department.id)
        .map((engineer) => engineer.id),
    }))
    .filter((scope) => scope.memberIds.length > 0);
}
