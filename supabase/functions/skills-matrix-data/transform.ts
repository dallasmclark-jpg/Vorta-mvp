import {
  SHIFT_CODES,
  SPECIALIST_CODES,
  average,
  latestIso,
  round,
  statusFromScore,
} from "./transform-helpers.ts";
import { createScopeAnalyser } from "./transform-analysis.ts";
import {
  buildDepartmentScopes,
  buildTeamScopes,
} from "./transform-scopes.ts";

export function build(input: any) {
  const {
    generatedAt,
    site,
    engineers,
    departments,
    shiftTeams,
    shiftMembers,
    assignments,
    risks,
    equipment,
    requirements,
    capabilities,
    gaps,
    skills,
  } = input;

  const today = new Date().toISOString().slice(0, 10);
  const engineerMap = new Map(engineers.map((row: any) => [row.id, row]));
  const departmentMap = new Map(
    departments.map((row: any) => [row.id, row.name]),
  );
  const skillMap = new Map(skills.map((row: any) => [row.id, row]));
  const equipmentMap = new Map(equipment.map((row: any) => [row.id, row]));
  const riskMap = new Map(risks.map((row: any) => [row.engineer_id, row]));
  const gapMap = new Map(
    gaps.map((row: any) => [
      `${row.department_id ?? "site"}:${row.skill_id}`,
      row,
    ]),
  );

  const assignmentsByEngineer = new Map<string, Map<string, any>>();
  for (const row of assignments) {
    const engineerId = String(row.engineer_id);
    if (!assignmentsByEngineer.has(engineerId)) {
      assignmentsByEngineer.set(engineerId, new Map());
    }
    assignmentsByEngineer.get(engineerId)!.set(row.skill_id, row);
  }

  const capabilitiesByEquipment = new Map<string, Map<string, any>>();
  for (const row of capabilities) {
    const equipmentId = String(row.equipment_id);
    if (!capabilitiesByEquipment.has(equipmentId)) {
      capabilitiesByEquipment.set(equipmentId, new Map());
    }
    capabilitiesByEquipment
      .get(equipmentId)!
      .set(String(row.engineer_id), row);
  }

  const teamScopes = buildTeamScopes(
    engineers,
    shiftTeams,
    shiftMembers,
    today,
  );
  const departmentScopes = buildDepartmentScopes(engineers, departments);
  const overallScope = {
    id: "overall",
    code: "OVERALL",
    name: "Site Maintenance Capability",
    scopeType: "overall",
    memberIds: engineers.map((row: any) => row.id),
  };

  const engineerTeamNames = new Map<string, string[]>();
  for (const scope of teamScopes) {
    for (const engineerId of scope.memberIds) {
      const key = String(engineerId);
      const current = engineerTeamNames.get(key) ?? [];
      if (!current.includes(scope.name)) current.push(scope.name);
      engineerTeamNames.set(key, current);
    }
  }

  const analyseScope = createScopeAnalyser({
    today,
    engineers,
    assignments,
    requirements,
    skills,
    engineerMap,
    departmentMap,
    skillMap,
    equipmentMap,
    riskMap,
    gapMap,
    assignmentsByEngineer,
    capabilitiesByEquipment,
    engineerTeamNames,
  });

  const analysedOverall = analyseScope(overallScope);
  const analysedTeams = teamScopes.map(analyseScope);
  const analysedDepartments = departmentScopes
    .map(analyseScope)
    .sort(
      (left: any, right: any) =>
        left.summary.score - right.summary.score ||
        left.summary.name.localeCompare(right.summary.name),
    );

  const shiftTeamScores = analysedTeams
    .filter((row: any) => SHIFT_CODES.has(row.summary.code))
    .map((row: any) => row.summary.score);
  const specialistTeamScores = analysedTeams
    .filter((row: any) => SPECIALIST_CODES.has(row.summary.code))
    .map((row: any) => row.summary.score);
  const criticalTeamCount = analysedTeams.filter(
    (row: any) => row.summary.status === "Critical" || row.summary.score < 55,
  ).length;
  const criticalTeamShare = criticalTeamCount / Math.max(1, analysedTeams.length);

  let overallScore = round(
    analysedOverall.summary.skillsCoverage * 0.3 +
      average(shiftTeamScores) * 0.3 +
      average(specialistTeamScores) * 0.15 +
      analysedOverall.summary.experienceDepth * 0.1 +
      analysedOverall.summary.smeResilience * 0.1 +
      analysedOverall.summary.validationHealth * 0.05 -
      criticalTeamShare * 12,
  );
  if (analysedTeams.some((row: any) => row.summary.score < 30)) {
    overallScore = Math.min(overallScore, 59);
  }
  analysedOverall.summary.score = overallScore;
  analysedOverall.summary.status = statusFromScore(
    overallScore,
    analysedOverall.detail.priorityRisks,
  );

  const areaSkillSets = new Map<string, Set<string>>();
  for (const requirement of requirements) {
    const asset: any = equipmentMap.get(requirement.equipment_id);
    if (!asset?.area || !requirement.skill_id) continue;
    const area = String(asset.area);
    const current = areaSkillSets.get(area) ?? new Set<string>();
    current.add(String(requirement.skill_id));
    areaSkillSets.set(area, current);
  }
  const areaSkills = Object.fromEntries(
    [...areaSkillSets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([area, skillIds]) => [area, [...skillIds]]),
  );

  const sourceUpdatedAt = latestIso(
    [
      site?.updated_at,
      ...engineers.map((row: any) => row.updated_at),
      ...equipment.map((row: any) => row.updated_at),
      ...gaps.map((row: any) => row.snapshot_date),
      ...assignments.map((row: any) => row.last_validated_at),
      ...risks.map((row: any) => row.reviewed_at),
      ...capabilities.map((row: any) => row.valid_from),
    ],
    generatedAt,
  );

  const details: Record<string, any> = {
    [analysedOverall.summary.id]: analysedOverall.detail,
  };
  for (const row of [...analysedTeams, ...analysedDepartments]) {
    details[row.summary.id] = row.detail;
  }

  return {
    generatedAt,
    sourceUpdatedAt,
    site: {
      id: site.id,
      name: site.name,
    },
    overall: analysedOverall.summary,
    teams: analysedTeams.map((row) => row.summary),
    departments: analysedDepartments.map((row) => row.summary),
    areaSkills,
    details,
  };
}
