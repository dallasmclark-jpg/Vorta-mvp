import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { context, preflight, response } from "./auth.ts";

const CATEGORY_TO_PARTNERS: Record<string, string[]> = {
  "Pharmaceutical Compliance": ["60000000-0000-0000-0000-000000000001"],
  "Pharmaceutical OEM Expertise": [
    "60000000-0000-0000-0000-000000000003",
    "60000000-0000-0000-0000-000000000001",
  ],
  "Pharmaceutical Equipment": [
    "60000000-0000-0000-0000-000000000003",
    "60000000-0000-0000-0000-000000000001",
  ],
  "Bosch OEM Expertise": ["60000000-0000-0000-0000-000000000003"],
  "Automation & Controls": ["60000000-0000-0000-0000-000000000002"],
  "Electrical Maintenance": ["60000000-0000-0000-0000-000000000002"],
  "CMMS / Maintenance Systems": ["60000000-0000-0000-0000-000000000002"],
  "Reliability Engineering": ["60000000-0000-0000-0000-000000000003"],
  "Mechanical Maintenance": ["60000000-0000-0000-0000-000000000003"],
  "Certifications & Qualifications": [
    "60000000-0000-0000-0000-000000000002",
    "60000000-0000-0000-0000-000000000001",
  ],
};

function numeric(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function gapImpact(riskLevel: string): number {
  if (riskLevel === "critical") return 18;
  if (riskLevel === "high") return 12;
  if (riskLevel === "medium") return 7;
  return 3;
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;
  if (!["GET", "POST"].includes(req.method)) {
    return response(req, { error: "Method not allowed" }, 405);
  }

  try {
    const { db, siteId, organisationId } = await context(req);
    const [engineersResult, departmentsResult, gapsResult, partnersResult] =
      await Promise.all([
        db.from("engineers")
          .select("id,full_name,employment_type,discipline,availability_status,verified,shift_pattern,department_id,site_id")
          .eq("site_id", siteId)
          .eq("organisation_id", organisationId)
          .order("full_name"),
        db.from("departments")
          .select("id,name")
          .eq("site_id", siteId),
        db.from("skill_gap_snapshots")
          .select("id,skill_id,department_id,target_rating,current_average_rating,engineers_at_or_above_target,engineers_below_target,single_point_of_failure,risk_level,recommendation,snapshot_date")
          .eq("site_id", siteId)
          .eq("organisation_id", organisationId),
        db.from("training_partners")
          .select("id,name,location,status")
          .eq("organisation_id", organisationId),
      ]);

    const baseError =
      engineersResult.error ?? departmentsResult.error ?? gapsResult.error ??
      partnersResult.error;
    if (baseError) throw baseError;

    const engineers = engineersResult.data ?? [];
    const departments = departmentsResult.data ?? [];
    const snapshots = gapsResult.data ?? [];
    const partners = partnersResult.data ?? [];
    const engineerIds = engineers.map((row: any) => row.id);
    const partnerIds = partners.map((row: any) => row.id);

    const [assignmentsResult, risksResult, bookingsResult, coursesResult] =
      await Promise.all([
        engineerIds.length
          ? db.from("engineer_skills")
              .select("engineer_id,skill_id,self_rating,manager_rating,validated_rating,training_required,verification_status,last_validated_at,expiry_date,years_experience")
              .in("engineer_id", engineerIds)
          : Promise.resolve({ data: [], error: null }),
        engineerIds.length
          ? db.from("engineer_risk_profiles")
              .select("engineer_id,retirement_risk,leaving_risk,critical_knowledge_holder")
              .in("engineer_id", engineerIds)
          : Promise.resolve({ data: [], error: null }),
        engineerIds.length
          ? db.from("training_bookings")
              .select("engineer_id,course_id,status,booking_date")
              .eq("organisation_id", organisationId)
              .in("engineer_id", engineerIds)
          : Promise.resolve({ data: [], error: null }),
        partnerIds.length
          ? db.from("training_courses")
              .select("id,title,delivery_type,duration_days,price,currency,training_partner_id,status")
              .in("training_partner_id", partnerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    const detailError =
      assignmentsResult.error ?? risksResult.error ?? bookingsResult.error ??
      coursesResult.error;
    if (detailError) throw detailError;

    const assignments = assignmentsResult.data ?? [];
    const riskProfiles = risksResult.data ?? [];
    const bookings = bookingsResult.data ?? [];
    const courses = coursesResult.data ?? [];
    const courseIds = courses.map((row: any) => row.id);

    const courseSkillsResult = courseIds.length
      ? await db.from("course_skills")
          .select("course_id,skill_id,target_rating")
          .in("course_id", courseIds)
      : { data: [], error: null };
    if (courseSkillsResult.error) throw courseSkillsResult.error;
    const courseSkills = courseSkillsResult.data ?? [];

    const skillIds = [...new Set([
      ...assignments.map((row: any) => row.skill_id),
      ...snapshots.map((row: any) => row.skill_id),
      ...courseSkills.map((row: any) => row.skill_id),
    ].filter(Boolean))];
    const skillsResult = skillIds.length
      ? await db.from("skills")
          .select("id,name,category,is_critical,certification_required,skill_type")
          .in("id", skillIds)
      : { data: [], error: null };
    if (skillsResult.error) throw skillsResult.error;
    const skills = skillsResult.data ?? [];

    const skillsById = new Map(skills.map((row: any) => [row.id, row]));
    const departmentMap = new Map(departments.map((row: any) => [row.id, row.name]));
    const riskMap = new Map(riskProfiles.map((row: any) => [row.engineer_id, row]));
    const courseMap = new Map(courses.map((row: any) => [row.id, row]));
    const partnerMap = new Map(partners.map((row: any) => [row.id, row]));

    const engineerSkills = new Map<string, Map<string, any>>();
    for (const assignment of assignments) {
      const engineerId = String((assignment as any).engineer_id);
      if (!engineerSkills.has(engineerId)) {
        engineerSkills.set(engineerId, new Map());
      }
      const rating =
        (assignment as any).validated_rating ??
        (assignment as any).manager_rating ??
        (assignment as any).self_rating;
      if (rating == null) continue;
      engineerSkills.get(engineerId)!.set((assignment as any).skill_id, {
        rating: numeric(rating),
        training_required: Boolean((assignment as any).training_required),
        verification_status: (assignment as any).verification_status ?? "unverified",
        expiry_date: (assignment as any).expiry_date ?? null,
        years_experience: numeric((assignment as any).years_experience),
      });
    }

    const requirementsBySkill = new Map<string, any>();
    const riskOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    for (const snapshot of snapshots) {
      const skillId = String((snapshot as any).skill_id);
      const existing = requirementsBySkill.get(skillId);
      if (
        !existing ||
        (riskOrder[(snapshot as any).risk_level] ?? 9) <
          (riskOrder[existing.risk_level] ?? 9)
      ) {
        requirementsBySkill.set(skillId, snapshot);
      }
    }
    const requirements = [...requirementsBySkill.values()];

    const courseToSkills = new Map<string, string[]>();
    for (const link of courseSkills) {
      const courseId = String((link as any).course_id);
      const current = courseToSkills.get(courseId) ?? [];
      current.push(String((link as any).skill_id));
      courseToSkills.set(courseId, current);
    }

    const activeTrainingByEngineer = new Map<string, string[]>();
    for (const booking of bookings) {
      if (!["booked", "approved", "pending", "pending_approval"].includes((booking as any).status)) {
        continue;
      }
      const course: any = courseMap.get((booking as any).course_id);
      if (!course) continue;
      const engineerId = String((booking as any).engineer_id);
      const current = activeTrainingByEngineer.get(engineerId) ?? [];
      current.push(course.title);
      activeTrainingByEngineer.set(engineerId, current);
    }

    const matchResults = engineers.map((engineer: any) => {
      const skillMap = engineerSkills.get(String(engineer.id)) ?? new Map();
      const matchedSkillIds: string[] = [];
      const missingSkillIds: string[] = [];
      let skillRatingSum = 0;

      for (const requirement of requirements) {
        const entry = skillMap.get(requirement.skill_id);
        const target = Math.max(1, numeric(requirement.target_rating));
        if (entry && entry.rating >= target) {
          matchedSkillIds.push(requirement.skill_id);
          skillRatingSum += Math.min(entry.rating / target, 1);
        } else {
          missingSkillIds.push(requirement.skill_id);
          skillRatingSum += entry ? Math.min(entry.rating / target, 1) * 0.5 : 0;
        }
      }

      const skillsScore = requirements.length
        ? clamp((skillRatingSum / requirements.length) * 100)
        : 50;
      const certificationRequirements = requirements.filter((requirement: any) =>
        Boolean((skillsById.get(requirement.skill_id) as any)?.certification_required)
      );
      let certificationScore = 100;
      if (certificationRequirements.length) {
        const now = new Date();
        let met = 0;
        for (const requirement of certificationRequirements) {
          const entry = skillMap.get(requirement.skill_id);
          if (!entry) continue;
          if (entry.verification_status === "validated") {
            met += !entry.expiry_date || new Date(entry.expiry_date) > now ? 1 : 0.3;
          } else if (["pending", "pending_validation"].includes(entry.verification_status)) {
            met += 0.6;
          }
        }
        certificationScore = clamp((met / certificationRequirements.length) * 100);
      }

      const experienceValues = [...skillMap.values()]
        .map((entry: any) => numeric(entry.years_experience));
      const maximumExperience = experienceValues.length
        ? Math.max(...experienceValues)
        : 0;
      const experienceScore = clamp(
        maximumExperience >= 10
          ? 100
          : maximumExperience >= 5
            ? 70 + (maximumExperience - 5) * 6
            : maximumExperience >= 2
              ? 40 + (maximumExperience - 2) * 10
              : 20 + maximumExperience * 10,
      );
      const availabilityScore =
        engineer.availability_status === "available"
          ? 100
          : engineer.availability_status === "on_shift"
            ? 65
            : engineer.availability_status === "training"
              ? 40
              : engineer.availability_status === "on_leave"
                ? 20
                : 50;
      const overallScore = clamp(
        skillsScore * 0.4 +
        certificationScore * 0.25 +
        experienceScore * 0.2 +
        availabilityScore * 0.15,
      );

      const matchedSkills = matchedSkillIds.slice(0, 5).map((skillId) =>
        (skillsById.get(skillId) as any)?.name ?? "Skill not recorded"
      );
      const missingSkills = missingSkillIds.slice(0, 5).map((skillId) =>
        (skillsById.get(skillId) as any)?.name ?? "Skill not recorded"
      );
      const certifications = [...skillMap.entries()]
        .filter(([skillId, entry]: [string, any]) =>
          Boolean((skillsById.get(skillId) as any)?.certification_required) &&
          entry.verification_status === "validated"
        )
        .map(([skillId]) => (skillsById.get(skillId) as any)?.name ?? "Skill not recorded")
        .slice(0, 5);
      const status =
        overallScore >= 85
          ? "Strong Match"
          : overallScore >= 70
            ? "Good Match"
            : overallScore >= 55
              ? "Partial Match"
              : "Weak Match";
      const topMatched = matchedSkills.slice(0, 2).join(", ") || "recorded maintenance capability";
      const topMissing = missingSkills.slice(0, 2).join(", ") || "no current high-priority gap";
      const aiRecommendation =
        overallScore >= 85
          ? `Strong evidence match. ${engineer.full_name} meets most recorded requirements. Review ${topMissing} before any assignment decision.`
          : overallScore >= 70
            ? `Good evidence match with strength in ${topMatched}. Review gaps in ${topMissing} and current availability before deployment.`
            : overallScore >= 55
              ? `Partial evidence match. Capability is recorded in ${topMatched}, with material gaps in ${topMissing}. Training evidence should be reviewed first.`
              : `Weak evidence match against current site requirements. Significant development is recorded across ${missingSkillIds.length} skill areas.`;
      const risk: any = riskMap.get(engineer.id);

      return {
        engineer_id: engineer.id,
        engineer_name: engineer.full_name,
        discipline: engineer.discipline ?? "Not recorded",
        employment_type: engineer.employment_type ?? "Not recorded",
        department_name: departmentMap.get(engineer.department_id) ?? null,
        availability_status: engineer.availability_status ?? "unknown",
        overall_score: overallScore,
        skills_score: skillsScore,
        cert_score: certificationScore,
        experience_score: experienceScore,
        avail_score: availabilityScore,
        training_gap: missingSkillIds.length,
        matched_skills: matchedSkills,
        missing_skills: missingSkills,
        certifications,
        active_training: activeTrainingByEngineer.get(String(engineer.id)) ?? [],
        status,
        ai_recommendation: aiRecommendation,
        critical_knowledge_holder: Boolean(risk?.critical_knowledge_holder),
        years_experience: maximumExperience,
      };
    }).sort((left: any, right: any) => right.overall_score - left.overall_score);

    const gapRecs: any[] = [];
    const seenSkills = new Set<string>();
    const sortedSnapshots = [...snapshots].sort((left: any, right: any) =>
      (riskOrder[left.risk_level] ?? 9) - (riskOrder[right.risk_level] ?? 9)
    );
    for (const snapshot of sortedSnapshots) {
      const skill: any = skillsById.get((snapshot as any).skill_id);
      if (!skill || seenSkills.has(skill.name)) continue;
      seenSkills.add(skill.name);

      const directCourse = courses.find((course: any) =>
        course.status === "active" &&
        (courseToSkills.get(course.id) ?? []).includes((snapshot as any).skill_id)
      );
      const affinityIds = CATEGORY_TO_PARTNERS[skill.category] ?? [];
      const course = directCourse ?? courses.find((candidate: any) =>
        candidate.status === "active" && affinityIds.includes(candidate.training_partner_id)
      );
      const partner: any = course?.training_partner_id
        ? partnerMap.get(course.training_partner_id)
        : null;
      const riskLevel = (snapshot as any).risk_level ?? "medium";
      gapRecs.push({
        skill_name: skill.name,
        category: skill.category ?? "Uncategorised",
        risk_level: riskLevel,
        engineers_below: numeric((snapshot as any).engineers_below_target),
        recommended_course: course?.title ?? null,
        provider_name: partner?.name ?? null,
        provider_location: partner?.location ?? null,
        priority:
          (snapshot as any).single_point_of_failure || riskLevel === "critical"
            ? "Critical"
            : riskLevel === "high"
              ? "High"
              : "Medium",
        score_impact: gapImpact(riskLevel),
      });
      if (gapRecs.length >= 10) break;
    }

    const openRequirements = requirements.filter((requirement: any) =>
      ["critical", "high"].includes(requirement.risk_level)
    ).length;
    const availableEngineers = engineers.filter((engineer: any) =>
      ["available", "on_shift"].includes(engineer.availability_status)
    ).length;
    const bestMatchScore = matchResults[0]?.overall_score ?? 0;
    const criticalSkillGaps = snapshots.filter((snapshot: any) =>
      snapshot.risk_level === "critical"
    ).length;
    const uniqueDepartments = [...new Set(
      engineers.map((engineer: any) => departmentMap.get(engineer.department_id)).filter(Boolean),
    )];
    const uniqueSkills = [...new Set(skills.map((skill: any) => skill.name).filter(Boolean))]
      .sort()
      .slice(0, 50);
    const uniqueCertifications = [...new Set(
      skills
        .filter((skill: any) => skill.certification_required)
        .map((skill: any) => skill.name)
        .filter(Boolean),
    )].sort();

    return response(req, {
      siteId,
      organisationId,
      generatedAt: new Date().toISOString(),
      matchResults,
      gapRecs,
      departments: uniqueDepartments,
      skills: uniqueSkills,
      certifications: uniqueCertifications,
      stats: {
        openRequirements,
        availableEngineers,
        bestMatchScore,
        criticalSkillGaps,
        totalEngineers: engineers.length,
        totalRequirements: requirements.length,
      },
    });
  } catch (error) {
    const status = Number((error as any)?.status) || 500;
    if (status >= 500) console.error("ai-matching-data failed", error);
    return response(req, {
      error: status < 500
        ? String((error as any)?.message ?? "Access denied")
        : "AI matching evidence could not be loaded",
    }, status);
  }
});
