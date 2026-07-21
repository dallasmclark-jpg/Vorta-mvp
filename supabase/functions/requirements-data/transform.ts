function status(row: any): string {
  const total = row.engineers_at_or_above_target + row.engineers_below_target;
  if (row.single_point_of_failure || row.risk_level === "critical") {
    return row.engineers_at_or_above_target === 0 ? "Critical Gap" : "Partial Gap";
  }
  if (row.risk_level === "high") return "Training Required";
  if (total === 0 || row.engineers_below_target > row.engineers_at_or_above_target) {
    return "Partial Gap";
  }
  return "Covered";
}

function priority(row: any): string {
  if (row.single_point_of_failure || row.risk_level === "critical") return "Critical";
  if (row.risk_level === "high") return "High";
  if (row.risk_level === "medium") return "Medium";
  return "Low";
}

function area(category: string): string {
  const map: Record<string, string> = {
    "Pharmaceutical Compliance": "GMP / Compliance",
    "Pharmaceutical Equipment": "Process Equipment",
    "CMMS / Maintenance Systems": "CMMS Systems",
    "Reliability Engineering": "Reliability",
    "Electrical Maintenance": "Electrical",
    "Automation & Controls": "Controls",
    "Pharmaceutical OEM Expertise": "OEM Equipment",
    "Bosch OEM Expertise": "Bosch Lines",
    "Mechanical Maintenance": "Mechanical",
    "Certifications & Qualifications": "Certifications",
  };
  return map[category] ?? category;
}

function group(category: string): string {
  if (category.includes("Electrical")) return "Electrical";
  if (category.includes("Mechanical")) return "Mechanical";
  if (category.includes("Automation") || category.includes("Controls")) return "Controls";
  if (category.includes("Reliability")) return "Reliability";
  if (category.includes("Compliance")) return "Compliance";
  if (category.includes("Equipment") || category.includes("OEM")) return "Equipment";
  return "Other";
}

export function build(input: any) {
  const { gaps, departments, engineers, assignments, skills } = input;
  const skillMap = new Map(skills.map((row: any) => [row.id, row]));
  const departmentMap = new Map(departments.map((row: any) => [row.id, row.name]));
  const engineerMap = new Map(engineers.map((row: any) => [row.id, row]));
  const trainingBySkill = new Map<string, Set<string>>();

  for (const assignment of assignments) {
    if (!trainingBySkill.has(assignment.skill_id)) {
      trainingBySkill.set(assignment.skill_id, new Set());
    }
    if (assignment.training_required) {
      trainingBySkill.get(assignment.skill_id)!.add(assignment.engineer_id);
    }
  }

  const requirements = gaps.map((row: any) => {
    const skill: any = skillMap.get(row.skill_id);
    const total = row.engineers_at_or_above_target + row.engineers_below_target;
    return {
      id: row.id,
      title: skill?.name ?? "Unknown Skill",
      skill_category: skill?.category ?? "",
      area: area(skill?.category ?? ""),
      group: group(skill?.category ?? ""),
      department_name: row.department_id
        ? departmentMap.get(row.department_id) ?? null
        : null,
      required_level: row.target_rating,
      current_avg: Number(row.current_average_rating),
      engineers_qualified: row.engineers_at_or_above_target,
      engineers_below: row.engineers_below_target,
      gap: row.engineers_below_target,
      coverage_pct: total
        ? Math.round((row.engineers_at_or_above_target / total) * 100)
        : 0,
      training_required: trainingBySkill.get(row.skill_id)?.size ?? 0,
      is_critical: skill?.is_critical ?? false,
      certification_required: skill?.certification_required ?? false,
      single_point_of_failure: row.single_point_of_failure,
      risk_level: row.risk_level,
      priority: priority(row),
      status: status(row),
      recommendation: row.recommendation,
      snapshot_date: row.snapshot_date,
    };
  }).sort((left: any, right: any) => {
    const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return order[left.priority] - order[right.priority] || right.gap - left.gap;
  });

  const now = new Date();
  const ninetyDays = new Date(now.getTime() + 90 * 86400000);
  const certExpiries = assignments
    .filter((row: any) =>
      row.expiry_date &&
      new Date(row.expiry_date) >= now &&
      new Date(row.expiry_date) <= ninetyDays
    )
    .map((row: any) => ({
      engineer_name: (engineerMap.get(row.engineer_id) as any)?.full_name ?? "Unknown",
      skill_name: (skillMap.get(row.skill_id) as any)?.name ?? "Unknown",
      expiry_date: row.expiry_date,
    }))
    .sort((left: any, right: any) => left.expiry_date.localeCompare(right.expiry_date))
    .slice(0, 10);

  const groupStats = new Map<string, any>();
  for (const row of requirements) {
    const current = groupStats.get(row.group) ?? { total: 0, gaps: 0, covered: 0 };
    current.total += 1;
    if (row.gap > 0) current.gaps += 1;
    else current.covered += 1;
    groupStats.set(row.group, current);
  }

  const coverageByGroup = [...groupStats.entries()]
    .map(([name, value]: any) => ({
      group: name,
      ...value,
      pct: value.total ? Math.round((value.covered / value.total) * 100) : 0,
    }))
    .sort((left, right) => left.pct - right.pct);

  const actions = [
    ...certExpiries.slice(0, 3).map((row: any) => ({
      type: "cert_expiry",
      title: `Certification expiry: ${row.skill_name}`,
      subtitle: `${row.engineer_name} — expires ${new Date(row.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      urgency: "high",
    })),
    ...requirements.filter((row: any) => row.status === "Critical Gap").slice(0, 3).map((row: any) => ({
      type: "critical_gap",
      title: `Critical gap: ${row.title}`,
      subtitle: `${row.engineers_below} engineers below target rating ${row.required_level}/5 — ${row.department_name ?? row.skill_category}`,
      urgency: "critical",
    })),
    ...requirements.filter((row: any) => row.status === "Training Required").slice(0, 2).map((row: any) => ({
      type: "training_required",
      title: `Training needed: ${row.title}`,
      subtitle: `${row.training_required} engineers require training — avg ${row.current_avg.toFixed(1)}/5`,
      urgency: "medium",
    })),
    ...requirements.filter((row: any) => row.status === "Covered").slice(0, 2).map((row: any) => ({
      type: "covered",
      title: `Covered: ${row.title}`,
      subtitle: `${row.engineers_qualified} qualified engineers — ${row.coverage_pct}% coverage`,
      urgency: "info",
    })),
  ].slice(0, 10);

  return {
    requirements,
    coverageByGroup,
    certExpiries,
    actionRows: actions,
    stats: {
      totalReqs: requirements.length,
      fullyCovered: requirements.filter((row: any) => row.status === "Covered").length,
      skillsAtRisk: requirements.filter((row: any) =>
        row.status === "Partial Gap" || row.status === "Training Required"
      ).length,
      criticalGaps: requirements.filter((row: any) => row.status === "Critical Gap").length,
    },
    departments,
  };
}
