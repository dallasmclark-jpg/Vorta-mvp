import {
  CRITICALITY_WEIGHT,
  average,
  clamp,
  lower,
  numeric,
  round,
} from "./transform-helpers.ts";

const SCORE_MODEL = "vorta-equipment-v1";

function resilienceStatus(score: number): string {
  if (score < 55) return "Critical";
  if (score < 70) return "At risk";
  if (score < 85) return "Moderate";
  return "Strong";
}

function assignmentRating(assignment: any): number {
  const status = lower(assignment?.verification_status);
  const expired = assignment?.expiry_date && assignment.expiry_date < new Date().toISOString().slice(0, 10);
  if (!expired && status === "validated" && numeric(assignment?.validated_rating) > 0) return numeric(assignment.validated_rating);
  if (!expired && !["rejected", "expired"].includes(status) && numeric(assignment?.manager_rating) > 0) return numeric(assignment.manager_rating);
  return numeric(assignment?.self_rating);
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
    equipmentScores = [],
  } = input;

  const memberIds = [...new Set(scope.memberIds)].map(String);
  const memberSet = new Set(memberIds);
  const scopedEngineers = engineers.filter((row: any) => memberSet.has(String(row.id)));
  const skillMap = new Map(skills.map((row: any) => [String(row.id), row]));
  const engineerMap = new Map(engineers.map((row: any) => [String(row.id), row]));
  const assignmentMap = mapByCompositeKey(assignments, (row) => `${row.engineer_id}:${row.skill_id}`);
  const capabilityMap = mapByCompositeKey(capabilities, (row) => `${row.equipment_id}:${row.engineer_id}`);
  const pmExperienceMap = mapByCompositeKey(pmExperience, (row) => `${row.engineer_id}:${row.preventive_maintenance_id}`);
  const equipmentScoreMap = mapByCompositeKey(
    equipmentScores.filter((row: any) => row.score_version === SCORE_MODEL),
    (row) => `${row.equipment_id}:${row.engineer_id}`,
  );

  const technicalSkillIds = new Set(
    skills.filter((row: any) => lower(row.skill_type) === "technical").map((row: any) => String(row.id)),
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
      const rating = assignmentRating(assignment);
      const weight = Math.max(0.25, numeric(skill?.ai_weight, 1));
      weightedScore += clamp(rating / target, 0, 1) * weight;
      totalWeight += weight;
      assessedSkillCount += 1;
    }
    const score = totalWeight > 0 ? round((weightedScore / totalWeight) * 100) : 0;
    return { engineerId: engineer.id, engineerName: engineer.full_name, score, assessedSkillCount };
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
  let pmEvidenceCount = 0;
  let equipmentEvidenceCount = 0;
  let confidenceTotal = 0;
  let confidenceCount = 0;

  const assets = equipment
    .map((asset: any) => {
      const assetId = String(asset.id);
      const assetRequirements = requirementsByEquipment.get(assetId) ?? [];
      const assetPms = pmByEquipment.get(assetId) ?? [];
      const relevantScoreRows = memberIds
        .map((engineerId) => equipmentScoreMap.get(`${assetId}:${engineerId}`))
        .filter(Boolean);
      if (assetRequirements.length === 0 && assetPms.length === 0 && relevantScoreRows.length === 0) return null;

      const minimumQualified = Math.max(
        1,
        ...assetRequirements.map((row: any) => numeric(row.minimum_qualified_engineers, 1)),
      );

      const engineerRows = memberIds.map((engineerId) => {
        const engineer: any = engineerMap.get(engineerId);
        const capability = capabilityMap.get(`${assetId}:${engineerId}`);
        const scoreSnapshot = equipmentScoreMap.get(`${assetId}:${engineerId}`);

        const requirementRatios = assetRequirements.map((requirement: any) => {
          const assignment = assignmentMap.get(`${engineerId}:${requirement.skill_id}`);
          const requiredLevel = Math.max(1, numeric(requirement.required_level, 1));
          return clamp(assignmentRating(assignment) / requiredLevel, 0, 1);
        });
        const requirementFit = requirementRatios.length ? average(requirementRatios) : 0;
        const explicitCapability = capability?.validation_status === "VALIDATED" && capability?.capability_status === "ACTIVE"
          ? clamp(numeric(capability?.competency_level) / 5, 0, 1)
          : 0;

        const experienceRows = assetPms.map((pm: any) => pmExperienceMap.get(`${engineerId}:${pm.id}`)).filter(Boolean);
        const confirmedPmCount = experienceRows.reduce((sum: number, row: any) => sum + numeric(row.confirmed_pm_count), 0);
        const pmExperienceScore = experienceRows.length
          ? Number(average(experienceRows.map((row: any) => numeric(row.experience_score))).toFixed(1))
          : 0;

        let assetScore: number;
        let modelSource: "authoritative" | "fallback";
        if (scoreSnapshot) {
          assetScore = round(numeric(scoreSnapshot.vorta_score));
          modelSource = "authoritative";
          equipmentEvidenceCount += numeric(scoreSnapshot.corrective_order_count) + numeric(scoreSnapshot.pm_order_count) + numeric(scoreSnapshot.calibration_order_count);
          confidenceTotal += numeric(scoreSnapshot.confidence_score);
          confidenceCount += 1;
        } else {
          const fallback = assetRequirements.length
            ? requirementFit * 0.8 + explicitCapability * 0.2
            : explicitCapability;
          assetScore = round(fallback * 100);
          modelSource = "fallback";
        }
        pmEvidenceCount += confirmedPmCount;

        return {
          engineerId,
          engineerName: engineer?.full_name ?? "Unknown engineer",
          discipline: engineer?.discipline ?? "",
          assetCompetenceScore: assetScore,
          vortaEquipmentScore: scoreSnapshot ? numeric(scoreSnapshot.vorta_score) : null,
          vortaStatus: scoreSnapshot?.score_status ?? null,
          evidenceConfidence: scoreSnapshot?.evidence_confidence ?? "Low",
          confidenceScore: numeric(scoreSnapshot?.confidence_score),
          evidenceCoverage: numeric(scoreSnapshot?.evidence_coverage_pct),
          scoreModel: scoreSnapshot?.score_version ?? "authorised-skill-fallback",
          modelSource,
          status: resilienceStatus(assetScore),
          requirementFitScore: round(requirementFit * 100),
          explicitCapabilityLevel: numeric(capability?.competency_level),
          skillScore: scoreSnapshot?.skill_score == null ? null : numeric(scoreSnapshot.skill_score),
          trainingScore: scoreSnapshot?.training_score == null ? null : numeric(scoreSnapshot.training_score),
          correctiveScore: scoreSnapshot?.corrective_score == null ? null : numeric(scoreSnapshot.corrective_score),
          pmScore: scoreSnapshot?.pm_score == null ? null : numeric(scoreSnapshot.pm_score),
          calibrationScore: scoreSnapshot?.calibration_score == null ? null : numeric(scoreSnapshot.calibration_score),
          correctiveOrderCount: numeric(scoreSnapshot?.corrective_order_count),
          pmOrderCount: numeric(scoreSnapshot?.pm_order_count),
          calibrationOrderCount: numeric(scoreSnapshot?.calibration_order_count),
          latestEvidenceAt: scoreSnapshot?.latest_evidence_at ?? null,
          pmExperienceScore,
          confirmedPmCount,
        };
      }).sort((left, right) =>
        right.assetCompetenceScore - left.assetCompetenceScore ||
        right.confidenceScore - left.confidenceScore ||
        right.confirmedPmCount - left.confirmedPmCount ||
        left.engineerName.localeCompare(right.engineerName),
      );

      const topScores = engineerRows.slice(0, minimumQualified).map((row) => row.assetCompetenceScore);
      while (topScores.length < minimumQualified) topScores.push(0);
      const assetCompetenceScore = round(average(topScores));
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
        status: resilienceStatus(assetCompetenceScore),
        assetCompetenceScore,
        minimumQualified,
        requiredSkillCount: assetRequirements.length,
        pmTaskCount: assetPms.length,
        calibrationTaskCount: assetPms.filter((pm: any) => lower(pm.pm_type).includes("calibr") || Boolean(pm.calibration_point)).length,
        authoritativeScoreCount: relevantScoreRows.length,
        engineers: engineerRows.slice(0, 8),
      };
    })
    .filter(Boolean)
    .sort((left: any, right: any) =>
      left.assetCompetenceScore - right.assetCompetenceScore ||
      (CRITICALITY_WEIGHT[lower(right.criticality)] ?? 1) - (CRITICALITY_WEIGHT[lower(left.criticality)] ?? 1) ||
      String(left.equipmentName).localeCompare(String(right.equipmentName)),
    );

  const assetCompetenceScore = totalAssetWeight > 0 ? round(weightedAssetScore / totalAssetWeight) : 0;
  const proposedSkillsReadinessScore = round(coreCapabilityScore * 0.4 + assetCompetenceScore * 0.6);
  const averageEvidenceConfidence = confidenceCount ? round(confidenceTotal / confidenceCount) : 0;

  return {
    summary: {
      scoreModel: SCORE_MODEL,
      scoreAuthority: "authoritative-equipment-evidence-v1",
      previewOnly: false,
      coreCapabilityScore,
      assetCompetenceScore,
      proposedSkillsReadinessScore,
      averageEvidenceConfidence,
      equipmentEvidenceCount,
      pmEvidenceCount,
      assetsAssessed: assets.length,
      coreEngineersAssessed: assessedCoreRows.length,
    },
    detail: {
      modelStatus: "authoritative",
      scoreModel: SCORE_MODEL,
      explanation:
        "Team and site resilience remain separate workforce measures. Individual equipment competence uses the versioned Vorta Equipment Score when available: verified skills 25%, current mapped training 20%, corrective evidence 25%, PM evidence 20%, calibration evidence 10%, with recency and source coverage reflected in evidence confidence.",
      coreCapability: {
        score: coreCapabilityScore,
        engineersAssessed: assessedCoreRows.length,
        engineers: coreEngineerRows.slice().sort((left, right) => right.score - left.score || left.engineerName.localeCompare(right.engineerName)),
      },
      assetCompetence: {
        score: assetCompetenceScore,
        averageEvidenceConfidence,
        equipmentEvidenceCount,
        pmEvidenceCount,
        assets,
      },
    },
  };
}
