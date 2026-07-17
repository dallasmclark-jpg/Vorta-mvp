import {
  CRITICALITY_WEIGHT,
  criticality,
  isValidDate,
  lower,
  numeric,
  recommendedAction,
  round,
  scoreGain,
  statusFromScore,
  validationState,
} from "./transform-helpers.ts";

type AnalyseContext = {
  today: string;
  engineers: any[];
  assignments: any[];
  requirements: any[];
  skills: any[];
  engineerMap: Map<any, any>;
  departmentMap: Map<any, any>;
  skillMap: Map<any, any>;
  equipmentMap: Map<any, any>;
  riskMap: Map<any, any>;
  gapMap: Map<any, any>;
  assignmentsByEngineer: Map<string, Map<string, any>>;
  capabilitiesByEquipment: Map<string, Map<string, any>>;
  engineerTeamNames: Map<string, string[]>;
};

export function createScopeAnalyser(context: AnalyseContext) {
  const {
    today,
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
  } = context;

  return function analyseScope(scope: any) {
    const memberIds = [...new Set(scope.memberIds)].filter((id) =>
      engineerMap.has(id)
    );
    const memberSet = new Set(memberIds);
    const priorityRisks: any[] = [];
    let weightedCoverage = 0;
    let weightedExperience = 0;
    let weightedSme = 0;
    let weightedValidation = 0;
    let totalWeight = 0;

    for (const requirement of requirements) {
      const asset: any = equipmentMap.get(requirement.equipment_id);
      const skill: any = skillMap.get(requirement.skill_id);
      if (!asset || !skill) continue;

      const requiredLevel = Math.max(1, numeric(requirement.required_level, 1));
      const minimumRequired = Math.max(
        1,
        numeric(requirement.minimum_qualified_engineers, 1),
      );
      const level = criticality(requirement, asset);
      const weight = CRITICALITY_WEIGHT[level] ?? 1;
      const qualified: any[] = [];
      const potential: any[] = [];

      for (const engineerId of memberIds) {
        const key = String(engineerId);
        const assignment = assignmentsByEngineer
          .get(key)
          ?.get(requirement.skill_id);
        const capability = capabilitiesByEquipment
          .get(requirement.equipment_id)
          ?.get(key);
        const rating = Math.max(
          numeric(assignment?.validated_rating),
          numeric(assignment?.manager_rating),
          numeric(assignment?.self_rating),
          numeric(capability?.competency_level),
        );
        const years = numeric(assignment?.years_experience);
        const assignmentValidation = validationState(assignment, today);
        const capabilityValid =
          capability &&
          isValidDate(capability.valid_until, today) &&
          !["expired", "rejected", "invalid"].includes(
            lower(capability.validation_status),
          );
        const verified = assignmentValidation === "validated" || Boolean(capabilityValid);
        const engineer = engineerMap.get(engineerId);
        const candidate = {
          engineerId,
          engineerName: engineer?.full_name ?? "Unknown engineer",
          discipline: engineer?.discipline ?? "",
          rating,
          years,
          verified,
          validationState: capabilityValid ? "validated" : assignmentValidation,
          trainingRequired: Boolean(assignment?.training_required),
          practiceAuthority:
            capability?.practice_authority ?? assignment?.practice_authority ?? null,
        };
        if (rating > 0) potential.push(candidate);
        if (rating >= requiredLevel) qualified.push(candidate);
      }

      qualified.sort(
        (left, right) =>
          Number(right.verified) - Number(left.verified) ||
          right.rating - left.rating ||
          right.years - left.years,
      );
      potential.sort(
        (left, right) => right.rating - left.rating || right.years - left.years,
      );

      const qualifiedCount = qualified.length;
      const gap = Math.max(0, minimumRequired - qualifiedCount);
      const coverageRatio = Math.min(1, qualifiedCount / minimumRequired);
      const topExperience = qualified
        .slice(0, minimumRequired)
        .map((row) => Math.min(1, row.years / 8));
      while (topExperience.length < minimumRequired) topExperience.push(0);
      const experienceRatio = topExperience.length
        ? topExperience.reduce((sum, value) => sum + value, 0) /
          topExperience.length
        : 0;

      const singlePoint = qualifiedCount === 1 && minimumRequired >= 2;
      let smeRatio = qualifiedCount >= 2 ? 1 : qualifiedCount === 1 ? 0.4 : 0;
      if (qualifiedCount === 1) {
        const holderRisk: any = riskMap.get(qualified[0].engineerId);
        if (
          lower(holderRisk?.retirement_risk) === "high" ||
          lower(holderRisk?.leaving_risk) === "high"
        ) {
          smeRatio = 0.15;
        }
      }

      const validationRequired = Boolean(requirement.validation_required);
      const validatedQualified = qualified.filter((row) => row.verified).length;
      const validationRatio = validationRequired
        ? Math.min(1, validatedQualified / minimumRequired)
        : 1;
      const validationGap = validationRequired
        ? Math.max(0, minimumRequired - validatedQualified)
        : 0;

      weightedCoverage += coverageRatio * weight;
      weightedExperience += experienceRatio * weight;
      weightedSme += smeRatio * weight;
      weightedValidation += validationRatio * weight;
      totalWeight += weight;

      const isCritical = level === "critical" || level === "high";
      const existingGap =
        gapMap.get(`${asset.department_id ?? "site"}:${requirement.skill_id}`) ??
        gapMap.get(`site:${requirement.skill_id}`);
      if (
        gap > 0 ||
        singlePoint ||
        validationGap > 0 ||
        existingGap?.single_point_of_failure
      ) {
        const row: any = {
          id: `${scope.id}:${requirement.equipment_id}:${requirement.skill_id}`,
          equipmentId: requirement.equipment_id,
          equipmentCode: asset.equipment_code,
          equipmentName: asset.name,
          area: asset.area,
          equipmentCriticality: asset.criticality,
          skillId: requirement.skill_id,
          skillName: skill.name,
          skillCategory: skill.category,
          requiredLevel,
          minimumRequired,
          qualifiedCount,
          validatedQualified,
          validationGap,
          gap,
          singlePoint:
            singlePoint || Boolean(existingGap?.single_point_of_failure),
          criticality: level,
          isCritical,
          qualifiedEngineers: qualified.map((candidate) => ({
            engineerId: candidate.engineerId,
            engineerName: candidate.engineerName,
            rating: candidate.rating,
            yearsExperience: candidate.years,
            verified: candidate.verified,
            shiftNames: engineerTeamNames.get(String(candidate.engineerId)) ?? [],
          })),
          nearestEngineers: potential.slice(0, 3).map((candidate) => ({
            engineerId: candidate.engineerId,
            engineerName: candidate.engineerName,
            rating: candidate.rating,
            yearsExperience: candidate.years,
            trainingRequired: candidate.trainingRequired,
          })),
        };
        row.recommendedAction = recommendedAction(row);
        row.projectedScoreGain = scoreGain(row);
        row.riskRank =
          (CRITICALITY_WEIGHT[level] ?? 1) * 100 +
          gap * 35 +
          (qualifiedCount === 0 ? 100 : 0) +
          (row.singlePoint ? 50 : 0) +
          validationGap * 15;
        priorityRisks.push(row);
      }
    }

    priorityRisks.sort((left, right) => right.riskRank - left.riskRank);
    const divisor = totalWeight || 1;
    const skillsCoverage = round((weightedCoverage / divisor) * 100);
    const experienceDepth = round((weightedExperience / divisor) * 100);
    const smeResilience = round((weightedSme / divisor) * 100);
    const validationHealth = round((weightedValidation / divisor) * 100);
    const score = round(
      skillsCoverage * 0.45 +
        experienceDepth * 0.2 +
        smeResilience * 0.2 +
        validationHealth * 0.15,
    );
    const criticalGaps = priorityRisks.filter(
      (row) => row.isCritical && row.gap > 0,
    ).length;
    const spofCount = priorityRisks.filter((row) => row.singlePoint).length;
    const affectedEquipment = new Set(
      priorityRisks
        .filter((row) => row.gap > 0 || row.singlePoint)
        .map((row) => row.equipmentId),
    ).size;
    const memberAssignments = assignments.filter((row) =>
      memberSet.has(row.engineer_id)
    );
    const trainingNeeds = memberAssignments.filter(
      (row) => row.training_required,
    ).length;
    const status = statusFromScore(score, priorityRisks);

    const matrixSkillIds: string[] = [];
    for (const risk of priorityRisks) {
      if (!matrixSkillIds.includes(risk.skillId)) matrixSkillIds.push(risk.skillId);
      if (matrixSkillIds.length >= 12) break;
    }
    if (matrixSkillIds.length < 12) {
      for (const skill of skills
        .filter((row) => row.is_critical)
        .sort(
          (left, right) =>
            numeric(left.display_order, 999) - numeric(right.display_order, 999),
        )) {
        if (!matrixSkillIds.includes(skill.id)) matrixSkillIds.push(skill.id);
        if (matrixSkillIds.length >= 12) break;
      }
    }

    const matrixSkills = matrixSkillIds
      .map((skillId) => {
        const skill: any = skillMap.get(skillId);
        if (!skill) return null;
        const equipmentForSkill = requirements
          .filter((row) => row.skill_id === skillId)
          .map((row) => equipmentMap.get(row.equipment_id))
          .filter(Boolean);
        return {
          id: skill.id,
          name: skill.name,
          category: skill.category,
          isCritical: Boolean(skill.is_critical),
          equipmentCount: new Set(equipmentForSkill.map((row) => row.id)).size,
        };
      })
      .filter(Boolean);

    const memberRows = memberIds
      .map((engineerId) => {
        const engineer: any = engineerMap.get(engineerId);
        const engineerAssignments =
          assignmentsByEngineer.get(String(engineerId)) ?? new Map();
        const relevantAssignments = [...engineerAssignments.values()].filter(
          (row: any) => matrixSkillIds.includes(row.skill_id),
        );
        const allAssignments = [...engineerAssignments.values()];
        const avgYears = allAssignments.length
          ? allAssignments.reduce(
              (sum: number, row: any) => sum + numeric(row.years_experience),
              0,
            ) / allAssignments.length
          : 0;
        const risk: any = riskMap.get(engineerId);
        const ratings: Record<string, any> = {};
        for (const skillId of matrixSkillIds) {
          const assignment = engineerAssignments.get(skillId);
          const rating = assignment
            ? Math.max(
                numeric(assignment.validated_rating),
                numeric(assignment.manager_rating),
                numeric(assignment.self_rating),
              )
            : 0;
          ratings[skillId] = {
            rating: rating || null,
            yearsExperience: numeric(assignment?.years_experience),
            validationState: validationState(assignment, today),
            trainingRequired: Boolean(assignment?.training_required),
            practiceAuthority: assignment?.practice_authority ?? null,
            lastUsedDate: assignment?.last_used_date ?? null,
          };
        }
        const criticalSkillCount = relevantAssignments.filter((row: any) => {
          const skill: any = skillMap.get(row.skill_id);
          const rating = Math.max(
            numeric(row.validated_rating),
            numeric(row.manager_rating),
            numeric(row.self_rating),
          );
          return skill?.is_critical && rating >= numeric(row.target_rating, 3);
        }).length;
        return {
          id: engineer.id,
          name: engineer.full_name,
          avatarUrl: engineer.avatar_url ?? null,
          discipline: engineer.discipline,
          departmentName: departmentMap.get(engineer.department_id) ?? null,
          shiftNames: engineerTeamNames.get(String(engineer.id)) ?? [],
          availabilityStatus: engineer.availability_status,
          averageYearsExperience: Number(avgYears.toFixed(1)),
          criticalKnowledgeHolder: Boolean(risk?.critical_knowledge_holder),
          retirementRisk: risk?.retirement_risk ?? null,
          leavingRisk: risk?.leaving_risk ?? null,
          trainingNeeds: allAssignments.filter((row: any) => row.training_required).length,
          criticalSkillCount,
          ratings,
        };
      })
      .sort(
        (left, right) =>
          Number(right.criticalKnowledgeHolder) -
            Number(left.criticalKnowledgeHolder) ||
          right.criticalSkillCount - left.criticalSkillCount ||
          left.name.localeCompare(right.name),
      );

    return {
      summary: {
        id: scope.id,
        code: scope.code,
        name: scope.name,
        scopeType: scope.scopeType,
        memberCount: memberIds.length,
        score,
        skillsCoverage,
        experienceDepth,
        smeResilience,
        validationHealth,
        criticalGaps,
        spofCount,
        trainingNeeds,
        affectedEquipment,
        status,
      },
      detail: {
        scopeId: scope.id,
        priorityRisks: priorityRisks.slice(0, 20),
        matrixSkills,
        engineers: memberRows,
      },
    };
  };
}
