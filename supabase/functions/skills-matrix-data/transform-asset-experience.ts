import {
  CRITICALITY_WEIGHT,
  average,
  clamp,
  lower,
  numeric,
  round,
} from "./transform-helpers.ts";

const PREVIEW_MODEL = "core-asset-preview-v1";

function scoreStatus(score: number): string {
  if (score < 55) return "Critical";
  if (score < 70) return "At risk";
  if (score < 85) return "Moderate";
  return "Strong";
}

function latestDate(values: unknown[]): string | null {
  let latest = Number.NEGATIVE_INFINITY;
  let selected: string | null = null;
  for (const value of values) {
    if (typeof value !== "string" || !value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp) && timestamp > latest) {
      latest = timestamp;
      selected = value;
    }
  }
  return selected;
}

function maximumRating(assignment: any, capability: any): number {
  return Math.max(
    numeric(assignment?.validated_rating),
    numeric(assignment?.manager_rating),
    numeric(assignment?.self_rating),
    numeric(capability?.competency_level),
  );
}

function mapByCompositeKey(rows: any[], keyBuilder: (row: any) => string) {
  const result = new Map<string, any>();
  for (const row of rows) result.set(keyBuilder(row), row);
  return result;
}

export function buildCapabilityPreview(input: any, scope: any) {
  const {
    engineers,
    assignments,
    requirements,
    skills,
    equipment,
    capabilities,
    preventiveMaintenance,
    pmExperience,
  } = input;

  const memberIds = [...new Set(scope.memberIds)].map(String);
  const memberSet = new Set(memberIds);
  const scopedEngineers = engineers.filter((row: any) => memberSet.has(String(row.id)));
  const skillMap = new Map(skills.map((row: any) => [String(row.id), row]));
  const engineerMap = new Map(engineers.map((row: any) => [String(row.id), row]));
  const assignmentMap = mapByCompositeKey(
    assignments,
    (row) => `${row.engineer_id}:${row.skill_id}`,
  );
  const capabilityMap = mapByCompositeKey(
    capabilities,
    (row) => `${row.equipment_id}:${row.engineer_id}`,
  );
  const pmExperienceMap = mapByCompositeKey(
    pmExperience,
    (row) => `${row.engineer_id}:${row.preventive_maintenance_id}`,
  );

  const technicalSkillIds = new Set(
    skills
      .filter((row: any) => lower(row.skill_type) === "technical")
      .map((row: any) => String(row.id)),
  );

  const coreEngineerRows = scopedEngineers.map((engineer: any) => {
    let weightedScore = 0;
    let totalWeight = 0;
    let assessedSkillCount = 0;

    for (const assignment of assignments) {
      if (String(assignment.engineer_id) !== String(engineer.id)) continue;
      if (!technicalSkillIds.has(String(assignment.skill_id))) continue;
      const skill: any = skillMap.get(String(assignment.skill_id));
      const target = Math.max(1, numeric(assignment.target_rating, 5));
      const rating = maximumRating(assignment, null);
      const weight = Math.max(0.25, numeric(skill?.ai_weight, 1));
      weightedScore += clamp(rating / target, 0, 1) * weight;
      totalWeight += weight;
      assessedSkillCount += 1;
    }

    const score = totalWeight > 0 ? round((weightedScore / totalWeight) * 100) : 0;
    return {
      engineerId: engineer.id,
      engineerName: engineer.full_name,
      score,
      assessedSkillCount,
    };
  });

  const assessedCoreRows = coreEngineerRows.filter((row) => row.assessedSkillCount > 0);
  const coreCapabilityScore = round(average(assessedCoreRows.map((row) => row.score)));

  const requirementsByEquipment = new Map<string, any[]>();
  for (const requirement of requirements) {
    const key = String(requirement.equipment_id);
    const rows = requirementsByEquipment.get(key) ?? [];
    rows.push(requirement);
    requirementsByEquipment.set(key, rows);
  }

  const pmByEquipment = new Map<string, any[]>();
  for (const pm of preventiveMaintenance) {
    const key = String(pm.equipment_id);
    const rows = pmByEquipment.get(key) ?? [];
    rows.push(pm);
    pmByEquipment.set(key, rows);
  }

  let weightedAssetScore = 0;
  let totalAssetWeight = 0;
  let totalPmPairs = 0;
  let evidencedPmPairs = 0;
  let pmEvidenceCount = 0;

  const assets = equipment
    .map((asset: any) => {
      const assetId = String(asset.id);
      const assetRequirements = requirementsByEquipment.get(assetId) ?? [];
      const assetPms = pmByEquipment.get(assetId) ?? [];
      if (assetRequirements.length === 0 && assetPms.length === 0) return null;

      const minimumQualified = Math.max(
        1,
        ...assetRequirements.map((row: any) =>
          numeric(row.minimum_qualified_engineers, 1)
        ),
      );

      const engineerRows = memberIds.map((engineerId) => {
        const capability = capabilityMap.get(`${assetId}:${engineerId}`);
        const requirementRatios = assetRequirements.map((requirement: any) => {
          const assignment = assignmentMap.get(`${engineerId}:${requirement.skill_id}`);
          const requiredLevel = Math.max(1, numeric(requirement.required_level, 1));
          return clamp(maximumRating(assignment, capability) / requiredLevel, 0, 1);
        });
        const requirementFit = requirementRatios.length
          ? average(requirementRatios)
          : 0;
        const explicitCapability = clamp(
          numeric(capability?.competency_level) / 5,
          0,
          1,
        );

        const experienceRows = assetPms
          .map((pm: any) => pmExperienceMap.get(`${engineerId}:${pm.id}`))
          .filter(Boolean);
        const rawPmScores = assetPms.map((pm: any) =>
          numeric(pmExperienceMap.get(`${engineerId}:${pm.id}`)?.experience_score)
        );
        const readinessPmScores = assetPms.map((pm: any) => {
          const evidence = pmExperienceMap.get(`${engineerId}:${pm.id}`);
          if (!evidence) return 0;
          return clamp(
            (numeric(evidence.experience_score) / 5) *
              numeric(evidence.recency_factor, 1),
            0,
            1,
          );
        });
        const pmExperienceScore = rawPmScores.length
          ? Number(average(rawPmScores).toFixed(1))
          : 0;
        const pmReadiness = readinessPmScores.length
          ? average(readinessPmScores)
          : 0;

        let competenceRatio = 0;
        if (assetRequirements.length > 0 && assetPms.length > 0) {
          competenceRatio = requirementFit * 0.5 + explicitCapability * 0.2 + pmReadiness * 0.3;
        } else if (assetRequirements.length > 0) {
          competenceRatio = requirementFit * 0.7 + explicitCapability * 0.3;
        } else {
          competenceRatio = explicitCapability * 0.25 + pmReadiness * 0.75;
        }

        const confirmedPmCount = experienceRows.reduce(
          (sum: number, row: any) => sum + numeric(row.confirmed_pm_count),
          0,
        );
        const assetScore = round(competenceRatio * 100);
        const engineer: any = engineerMap.get(engineerId);

        return {
          engineerId,
          engineerName: engineer?.full_name ?? "Unknown engineer",
          discipline: engineer?.discipline ?? "",
          assetCompetenceScore: assetScore,
          status: scoreStatus(assetScore),
          requirementFitScore: round(requirementFit * 100),
          explicitCapabilityLevel: numeric(capability?.competency_level),
          pmExperienceScore,
          pmTaskCount: assetPms.length,
          pmTasksWithEvidence: experienceRows.length,
          confirmedPmCount,
          lastPmCompletedAt: latestDate(
            experienceRows.map((row: any) => row.last_completed_at),
          ),
          recencyStatus:
            experienceRows
              .slice()
              .sort((left: any, right: any) =>
                String(right.last_completed_at ?? "").localeCompare(
                  String(left.last_completed_at ?? ""),
                )
              )[0]?.recency_status ?? "unknown",
        };
      }).sort(
        (left, right) =>
          right.assetCompetenceScore - left.assetCompetenceScore ||
          right.confirmedPmCount - left.confirmedPmCount ||
          left.engineerName.localeCompare(right.engineerName),
      );

      const topScores = engineerRows
        .slice(0, minimumQualified)
        .map((row) => row.assetCompetenceScore);
      while (topScores.length < minimumQualified) topScores.push(0);
      const assetCompetenceScore = round(average(topScores));
      const assetPmPairs = memberIds.length * assetPms.length;
      const assetEvidencePairs = engineerRows.reduce(
        (sum, row) => sum + row.pmTasksWithEvidence,
        0,
      );
      totalPmPairs += assetPmPairs;
      evidencedPmPairs += assetEvidencePairs;
      pmEvidenceCount += engineerRows.reduce(
        (sum, row) => sum + row.confirmedPmCount,
        0,
      );

      const assetWeight = CRITICALITY_WEIGHT[lower(asset.criticality)] ?? 1;
      weightedAssetScore += assetCompetenceScore * assetWeight;
      totalAssetWeight += assetWeight;

      return {
        equipmentId: asset.id,
        equipmentCode: asset.equipment_code,
        equipmentName: asset.name,
        area: asset.area,
        line: asset.line ?? null,
        criticality: asset.criticality,
        status: scoreStatus(assetCompetenceScore),
        assetCompetenceScore,
        minimumQualified,
        requiredSkillCount: assetRequirements.length,
        pmTaskCount: assetPms.length,
        calibrationTaskCount: assetPms.filter((pm: any) =>
          lower(pm.pm_type).includes("calibr") || Boolean(pm.calibration_point)
        ).length,
        pmEvidenceCoverage: assetPmPairs > 0
          ? round((assetEvidencePairs / assetPmPairs) * 100)
          : 0,
        engineers: engineerRows.slice(0, 8),
      };
    })
    .filter(Boolean)
    .sort(
      (left: any, right: any) =>
        left.assetCompetenceScore - right.assetCompetenceScore ||
        (CRITICALITY_WEIGHT[lower(right.criticality)] ?? 1) -
          (CRITICALITY_WEIGHT[lower(left.criticality)] ?? 1) ||
        String(left.equipmentName).localeCompare(String(right.equipmentName)),
    );

  const assetCompetenceScore = totalAssetWeight > 0
    ? round(weightedAssetScore / totalAssetWeight)
    : 0;
  const proposedSkillsReadinessScore = round(
    coreCapabilityScore * 0.4 + assetCompetenceScore * 0.6,
  );
  const pmExperienceCoverage = totalPmPairs > 0
    ? round((evidencedPmPairs / totalPmPairs) * 100)
    : 0;

  return {
    summary: {
      scoreModel: PREVIEW_MODEL,
      scoreAuthority: "current-capability-v3",
      previewOnly: true,
      coreCapabilityScore,
      assetCompetenceScore,
      proposedSkillsReadinessScore,
      pmExperienceCoverage,
      pmEvidenceCount,
      assetsAssessed: assets.length,
      coreEngineersAssessed: assessedCoreRows.length,
    },
    detail: {
      modelStatus: "preview",
      scoreModel: PREVIEW_MODEL,
      explanation:
        "Core capability contributes 40% and equipment-specific asset competence contributes 60%. Historical PM confirmations are capped at 5 and adjusted for recency only within the preview asset score.",
      coreCapability: {
        score: coreCapabilityScore,
        engineersAssessed: assessedCoreRows.length,
        engineers: coreEngineerRows
          .slice()
          .sort(
            (left, right) =>
              right.score - left.score ||
              left.engineerName.localeCompare(right.engineerName),
          ),
      },
      assetCompetence: {
        score: assetCompetenceScore,
        pmExperienceCoverage,
        pmEvidenceCount,
        assets,
      },
    },
  };
}
