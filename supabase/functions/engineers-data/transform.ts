type AnyRow = Record<string, any>;

export function buildEngineerPayload(input: {
  engineers: AnyRow[];
  assignments: AnyRow[];
  risks: AnyRow[];
  bookings: AnyRow[];
  courses: AnyRow[];
  departments: AnyRow[];
  sites: AnyRow[];
  gaps: AnyRow[];
  skills: AnyRow[];
}) {
  const {
    engineers,
    assignments,
    risks,
    bookings,
    courses,
    departments,
    sites,
    gaps,
    skills,
  } = input;

  const skillMap = new Map(skills.map((row) => [row.id, row]));
  const courseMap = new Map(courses.map((row) => [row.id, row.title]));
  const departmentMap = new Map(departments.map((row) => [row.id, row.name]));
  const siteMap = new Map(sites.map((row) => [row.id, row]));
  const riskMap = new Map(risks.map((row) => [row.engineer_id, row]));
  const engineerStats = new Map<string, AnyRow>();

  for (const row of assignments) {
    const skill = skillMap.get(row.skill_id) as AnyRow | undefined;
    const rating = row.validated_rating ?? row.manager_rating ?? row.self_rating ?? null;
    const current = engineerStats.get(row.engineer_id) ?? {
      total: 0,
      count: 0,
      training: 0,
      critical: 0,
      criticalMet: 0,
      expired: false,
      last: null,
      top: [],
      certs: [],
      years: null,
    };

    if (rating !== null) {
      const numericRating = Number(rating);
      current.total += numericRating;
      current.count += 1;
      current.top.push({
        name: skill?.name ?? "Unknown",
        category: skill?.category ?? "",
        rating: numericRating,
        is_critical: Boolean(skill?.is_critical),
      });
    }
    if (row.training_required) current.training += 1;
    if (skill?.is_critical) {
      current.critical += 1;
      if (rating !== null && Number(rating) >= 3) current.criticalMet += 1;
    }
    if (row.verification_status && row.verification_status !== "validated") {
      current.expired = true;
    }
    if (row.last_validated_at && (!current.last || row.last_validated_at > current.last)) {
      current.last = row.last_validated_at;
    }
    if (skill?.certification_required) {
      current.certs.push({
        skill_name: skill.name,
        category: skill.category ?? "",
        expiry_date: row.expiry_date,
        verification_status: row.verification_status,
      });
    }
    if (
      row.years_experience != null &&
      (current.years === null || Number(row.years_experience) > current.years)
    ) {
      current.years = Number(row.years_experience);
    }

    engineerStats.set(row.engineer_id, current);
  }

  const trainingMap = new Map<string, { completed: number; active: number }>();
  for (const row of bookings) {
    const current = trainingMap.get(row.engineer_id) ?? { completed: 0, active: 0 };
    if (row.status === "completed") current.completed += 1;
    else current.active += 1;
    trainingMap.set(row.engineer_id, current);
  }

  const enrichedEngineers = engineers.map((row) => {
    const stats = engineerStats.get(row.id);
    const score = stats?.count
      ? Math.round((stats.total / stats.count / 5) * 100)
      : 0;
    const criticalRatio = stats?.critical ? stats.criticalMet / stats.critical : 1;
    const risk = riskMap.get(row.id) as AnyRow | undefined;
    const site = siteMap.get(row.site_id) as AnyRow | undefined;
    const training = trainingMap.get(row.id);

    return {
      ...row,
      department_name: departmentMap.get(row.department_id) ?? null,
      site_name: site?.name ?? null,
      site_region: site?.region ?? null,
      skills_score: score,
      risk_level:
        score >= 80 ? "low" : score >= 68 ? "medium" : score >= 55 ? "high" : "critical",
      training_count: stats?.training ?? 0,
      total_skills_assessed: stats?.count ?? 0,
      critical_skills_count: stats?.critical ?? 0,
      critical_skills_met: stats?.criticalMet ?? 0,
      has_expired_validation: stats?.expired ?? false,
      last_assessment_date: stats?.last ?? null,
      top_skills: [...(stats?.top ?? [])]
        .sort((left: AnyRow, right: AnyRow) => right.rating - left.rating)
        .slice(0, 10),
      training_completed: training?.completed ?? 0,
      training_active: training?.active ?? 0,
      critical_knowledge_holder: risk?.critical_knowledge_holder ?? false,
      retirement_risk: risk?.retirement_risk ?? null,
      leaving_risk: risk?.leaving_risk ?? null,
      certifications: stats?.certs ?? [],
      years_experience: stats?.years ?? null,
      ai_confidence: Math.round(score * 0.6 + criticalRatio * 40),
    };
  });

  const today = new Date();
  const cutoff = new Date(today.getTime() + 30 * 86_400_000);
  const activeTraining = new Set(
    bookings
      .filter((row) =>
        ["booked", "approved", "pending", "pending_approval"].includes(row.status),
      )
      .map((row) => row.engineer_id),
  );
  const average = enrichedEngineers.length
    ? Math.round(
        enrichedEngineers.reduce((sum, row) => sum + row.skills_score, 0) /
          enrichedEngineers.length,
      )
    : 0;

  return {
    engineers: enrichedEngineers,
    assignments: assignments.map((row) => {
      const skill = skillMap.get(row.skill_id) as AnyRow | undefined;
      return {
        engineer_id: row.engineer_id,
        skill_id: row.skill_id,
        skill_name: skill?.name ?? "Unknown",
        skill_category: skill?.category ?? "",
        is_critical: Boolean(skill?.is_critical),
        rating: row.validated_rating ?? row.manager_rating ?? row.self_rating ?? null,
        training_required: row.training_required,
        verification_status: row.verification_status,
        last_validated_at: row.last_validated_at,
      };
    }),
    trainingBookings: bookings.map((row) => ({
      engineer_id: row.engineer_id,
      course_title: courseMap.get(row.course_id) ?? "Unknown Course",
      status: row.status,
      booking_date: row.booking_date,
    })),
    skillGaps: gaps.map((row) => ({
      ...row,
      skill_name: (skillMap.get(row.skill_id) as AnyRow | undefined)?.name ?? "Unknown",
      skill_category:
        (skillMap.get(row.skill_id) as AnyRow | undefined)?.category ?? "",
      department_name: row.department_id
        ? departmentMap.get(row.department_id) ?? null
        : null,
    })),
    departments,
    sites,
    stats: {
      totalEngineers: engineers.length,
      verifiedEngineers: engineers.filter((row) => row.verified).length,
      currentlyAvailable: engineers.filter((row) => row.availability_status === "available")
        .length,
      onShiftToday: engineers.filter((row) => row.availability_status === "on_shift").length,
      inTraining: activeTraining.size,
      criticalHolders: risks.filter((row) => row.critical_knowledge_holder).length,
      avgCompetencyScore: average,
      certificationsExpiring30d: assignments.filter(
        (row) =>
          row.expiry_date &&
          new Date(row.expiry_date) >= today &&
          new Date(row.expiry_date) <= cutoff,
      ).length,
    },
  };
}
