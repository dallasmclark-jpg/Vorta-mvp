export class RuntimeContractError extends Error {
  readonly contract: string;

  constructor(contract: string, message: string) {
    super(`${contract}: ${message}`);
    this.name = "RuntimeContractError";
    this.contract = contract;
  }
}

export type RuntimeRecord = Record<string, unknown>;

export function isRuntimeRecord(value: unknown): value is RuntimeRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireRuntimeRecord(
  value: unknown,
  contract: string,
): RuntimeRecord {
  if (!isRuntimeRecord(value)) {
    throw new RuntimeContractError(contract, "expected an object response");
  }

  return value;
}

function requireRecordField(
  record: RuntimeRecord,
  key: string,
  contract: string,
): RuntimeRecord {
  return requireRuntimeRecord(record[key], `${contract}.${key}`);
}

function requireArrayField(
  record: RuntimeRecord,
  key: string,
  contract: string,
): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected an array");
  }

  return value;
}

function requireStringField(
  record: RuntimeRecord,
  key: string,
  contract: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a non-empty string");
  }

  return value;
}

function requireNumberField(
  record: RuntimeRecord,
  key: string,
  contract: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a finite number");
  }

  return value;
}

function requireBooleanField(
  record: RuntimeRecord,
  key: string,
  contract: string,
): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a boolean");
  }

  return value;
}

function requirePercentage(
  record: RuntimeRecord,
  key: string,
  contract: string,
): number {
  const value = requireNumberField(record, key, contract);
  if (value < 0 || value > 100) {
    throw new RuntimeContractError(`${contract}.${key}`, "must be between 0 and 100");
  }
  return value;
}

export interface DashboardFreshness {
  maintenanceDataAt: string | null;
  workforceDataAt: string | null;
  riskCalculatedAt: string | null;
}

function timestampOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function parseDashboardFreshness(value: unknown): DashboardFreshness | null {
  if (!isRuntimeRecord(value)) return null;

  return {
    maintenanceDataAt: timestampOrNull(value.maintenanceDataAt),
    workforceDataAt: timestampOrNull(value.workforceDataAt),
    riskCalculatedAt: timestampOrNull(value.riskCalculatedAt),
  };
}

export function validateOperationalDashboardPayload(value: unknown): RuntimeRecord {
  const contract = "Operational dashboard";
  const payload = requireRuntimeRecord(value, contract);
  const areaProfiles = requireArrayField(payload, "areaProfiles", contract);
  const scopes = requireArrayField(payload, "scopes", contract);
  requireRecordField(payload, "siteRisk", contract);

  if (areaProfiles.length === 0) {
    throw new RuntimeContractError(`${contract}.areaProfiles`, "must contain at least one area");
  }
  if (scopes.length === 0) {
    throw new RuntimeContractError(`${contract}.scopes`, "must contain at least one scope");
  }

  areaProfiles.forEach((item, index) => {
    const row = requireRuntimeRecord(item, `${contract}.areaProfiles[${index}]`);
    requireStringField(row, "area", `${contract}.areaProfiles[${index}]`);
    requireNumberField(row, "riskScore", `${contract}.areaProfiles[${index}]`);
  });

  scopes.forEach((item, index) => {
    const row = requireRuntimeRecord(item, `${contract}.scopes[${index}]`);
    requireStringField(row, "scopeKey", `${contract}.scopes[${index}]`);
    requireStringField(row, "scopeLabel", `${contract}.scopes[${index}]`);
    requireNumberField(row, "riskScore", `${contract}.scopes[${index}]`);
  });

  return payload;
}

export function validateSkillsMatrixPayload(value: unknown): RuntimeRecord {
  const contract = "Skills matrix";
  const payload = requireRuntimeRecord(value, contract);
  const siteId = requireStringField(payload, "siteId", contract);
  requireStringField(payload, "organisationId", contract);
  requireStringField(payload, "generatedAt", contract);
  requireStringField(payload, "sourceUpdatedAt", contract);
  const site = requireRecordField(payload, "site", contract);
  const responseSiteId = requireStringField(site, "id", `${contract}.site`);
  requireStringField(site, "name", `${contract}.site`);
  requireRecordField(payload, "overall", contract);
  requireArrayField(payload, "teams", contract);
  requireArrayField(payload, "departments", contract);
  requireRecordField(payload, "areaSkills", contract);
  requireRecordField(payload, "details", contract);

  if (responseSiteId !== siteId) {
    throw new RuntimeContractError(`${contract}.site.id`, "must match the response siteId");
  }

  return payload;
}

export function validateRequirementsPayload(value: unknown): RuntimeRecord {
  const contract = "Requirements";
  const payload = requireRuntimeRecord(value, contract);
  requireStringField(payload, "siteId", contract);
  requireStringField(payload, "organisationId", contract);
  requireStringField(payload, "generatedAt", contract);
  const requirements = requireArrayField(payload, "requirements", contract);
  const coverageByGroup = requireArrayField(payload, "coverageByGroup", contract);
  const certExpiries = requireArrayField(payload, "certExpiries", contract);
  const actionRows = requireArrayField(payload, "actionRows", contract);
  const departments = requireArrayField(payload, "departments", contract);
  const stats = requireRecordField(payload, "stats", contract);

  requireNumberField(stats, "totalReqs", `${contract}.stats`);
  requireNumberField(stats, "fullyCovered", `${contract}.stats`);
  requireNumberField(stats, "skillsAtRisk", `${contract}.stats`);
  requireNumberField(stats, "criticalGaps", `${contract}.stats`);

  requirements.forEach((item, index) => {
    const rowContract = `${contract}.requirements[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "id", rowContract);
    requireStringField(row, "title", rowContract);
    requireStringField(row, "skill_category", rowContract);
    requireStringField(row, "area", rowContract);
    requireStringField(row, "group", rowContract);
    requireNumberField(row, "required_level", rowContract);
    requireNumberField(row, "current_avg", rowContract);
    requireNumberField(row, "engineers_qualified", rowContract);
    requireNumberField(row, "engineers_below", rowContract);
    requireNumberField(row, "gap", rowContract);
    requirePercentage(row, "coverage_pct", rowContract);
    requireNumberField(row, "training_required", rowContract);
    requireBooleanField(row, "is_critical", rowContract);
    requireBooleanField(row, "certification_required", rowContract);
    requireBooleanField(row, "single_point_of_failure", rowContract);
    requireStringField(row, "priority", rowContract);
    requireStringField(row, "status", rowContract);
    requireStringField(row, "snapshot_date", rowContract);
  });

  coverageByGroup.forEach((item, index) => {
    const rowContract = `${contract}.coverageByGroup[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "group", rowContract);
    requireNumberField(row, "total", rowContract);
    requireNumberField(row, "gaps", rowContract);
    requireNumberField(row, "covered", rowContract);
    requirePercentage(row, "pct", rowContract);
  });

  certExpiries.forEach((item, index) => {
    const rowContract = `${contract}.certExpiries[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "engineer_name", rowContract);
    requireStringField(row, "skill_name", rowContract);
  });

  actionRows.forEach((item, index) => {
    const rowContract = `${contract}.actionRows[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "type", rowContract);
    requireStringField(row, "title", rowContract);
    requireStringField(row, "subtitle", rowContract);
    requireStringField(row, "urgency", rowContract);
  });

  departments.forEach((item, index) => {
    const rowContract = `${contract}.departments[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "id", rowContract);
    requireStringField(row, "name", rowContract);
  });

  return payload;
}

export function validateTrainingPayload(value: unknown): RuntimeRecord {
  const contract = "Training";
  const payload = requireRuntimeRecord(value, contract);
  requireStringField(payload, "siteId", contract);
  requireStringField(payload, "organisationId", contract);
  requireStringField(payload, "generatedAt", contract);
  const recentActivity = requireArrayField(payload, "recentActivity", contract);
  const priorityRows = requireArrayField(payload, "priorityRows", contract);
  const certRiskRows = requireArrayField(payload, "certRiskRows", contract);
  const recommendedCourses = requireArrayField(payload, "recommendedCourses", contract);
  requireArrayField(payload, "trainingPartners", contract);
  requireArrayField(payload, "departments", contract);
  requireArrayField(payload, "spendByMonth", contract);
  requireArrayField(payload, "bookingsByDept", contract);
  requireArrayField(payload, "insights", contract);
  const stats = requireRecordField(payload, "stats", contract);

  [
    "totalBookings",
    "completed",
    "activeBookings",
    "totalSpendGBP",
    "expiringIn30Days",
    "expiringIn90Days",
    "engineersNeedingTraining",
    "criticalGaps",
  ].forEach((key) => requireNumberField(stats, key, `${contract}.stats`));
  requirePercentage(stats, "compliancePct", `${contract}.stats`);

  recentActivity.forEach((item, index) => {
    const rowContract = `${contract}.recentActivity[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "id", rowContract);
    requireStringField(row, "course_title", rowContract);
    requireStringField(row, "status", rowContract);
    requireStringField(row, "currency", rowContract);
  });

  priorityRows.forEach((item, index) => {
    const rowContract = `${contract}.priorityRows[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "id", rowContract);
    requireStringField(row, "skill_name", rowContract);
    requireStringField(row, "category", rowContract);
    requireNumberField(row, "current_avg", rowContract);
    requireNumberField(row, "target_rating", rowContract);
    requireNumberField(row, "gap", rowContract);
    requireNumberField(row, "engineers_qualified", rowContract);
    requireStringField(row, "priority", rowContract);
    requireBooleanField(row, "single_point_of_failure", rowContract);
  });

  certRiskRows.forEach((item, index) => {
    const rowContract = `${contract}.certRiskRows[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "skill_name", rowContract);
    requireStringField(row, "engineer_name", rowContract);
    requireNumberField(row, "days_left", rowContract);
    requireStringField(row, "status", rowContract);
  });

  recommendedCourses.forEach((item, index) => {
    const rowContract = `${contract}.recommendedCourses[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "id", rowContract);
    requireStringField(row, "title", rowContract);
    requireStringField(row, "delivery_type", rowContract);
    requireNumberField(row, "duration_days", rowContract);
    requireNumberField(row, "price", rowContract);
    requireStringField(row, "currency", rowContract);
    requireArrayField(row, "skills_covered", rowContract);
  });

  return payload;
}

export function validateAiMatchingPayload(value: unknown): RuntimeRecord {
  const contract = "AI matching";
  const payload = requireRuntimeRecord(value, contract);
  requireStringField(payload, "siteId", contract);
  requireStringField(payload, "organisationId", contract);
  requireStringField(payload, "generatedAt", contract);
  const matchResults = requireArrayField(payload, "matchResults", contract);
  const gapRecs = requireArrayField(payload, "gapRecs", contract);
  requireArrayField(payload, "departments", contract);
  requireArrayField(payload, "skills", contract);
  requireArrayField(payload, "certifications", contract);
  const stats = requireRecordField(payload, "stats", contract);

  requireNumberField(stats, "openRequirements", `${contract}.stats`);
  requireNumberField(stats, "availableEngineers", `${contract}.stats`);
  requirePercentage(stats, "bestMatchScore", `${contract}.stats`);
  requireNumberField(stats, "criticalSkillGaps", `${contract}.stats`);
  requireNumberField(stats, "totalEngineers", `${contract}.stats`);
  requireNumberField(stats, "totalRequirements", `${contract}.stats`);

  matchResults.forEach((item, index) => {
    const rowContract = `${contract}.matchResults[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "engineer_id", rowContract);
    requireStringField(row, "engineer_name", rowContract);
    requireStringField(row, "discipline", rowContract);
    requireStringField(row, "employment_type", rowContract);
    requireStringField(row, "availability_status", rowContract);
    requirePercentage(row, "overall_score", rowContract);
    requirePercentage(row, "skills_score", rowContract);
    requirePercentage(row, "cert_score", rowContract);
    requirePercentage(row, "experience_score", rowContract);
    requirePercentage(row, "avail_score", rowContract);
    requireNumberField(row, "training_gap", rowContract);
    requireArrayField(row, "matched_skills", rowContract);
    requireArrayField(row, "missing_skills", rowContract);
    requireArrayField(row, "certifications", rowContract);
    requireArrayField(row, "active_training", rowContract);
    requireStringField(row, "status", rowContract);
    requireStringField(row, "ai_recommendation", rowContract);
    requireBooleanField(row, "critical_knowledge_holder", rowContract);
    requireNumberField(row, "years_experience", rowContract);
  });

  gapRecs.forEach((item, index) => {
    const rowContract = `${contract}.gapRecs[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "skill_name", rowContract);
    requireStringField(row, "category", rowContract);
    requireStringField(row, "risk_level", rowContract);
    requireNumberField(row, "engineers_below", rowContract);
    requireStringField(row, "priority", rowContract);
    requireNumberField(row, "score_impact", rowContract);
  });

  return payload;
}

export function validateTrainingProvidersPayload(value: unknown): RuntimeRecord {
  const contract = "Training providers";
  const payload = requireRuntimeRecord(value, contract);
  requireStringField(payload, "siteId", contract);
  requireStringField(payload, "organisationId", contract);
  requireStringField(payload, "generatedAt", contract);
  const providers = requireArrayField(payload, "providers", contract);
  const gapMatches = requireArrayField(payload, "gapMatches", contract);
  const stats = requireRecordField(payload, "stats", contract);

  requireNumberField(stats, "providerCount", `${contract}.stats`);
  requireNumberField(stats, "courseCount", `${contract}.stats`);
  requireNumberField(stats, "openEnquiries", `${contract}.stats`);
  requireNumberField(stats, "totalBookings", `${contract}.stats`);

  providers.forEach((item, index) => {
    const rowContract = `${contract}.providers[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "id", rowContract);
    requireStringField(row, "name", rowContract);
    requireStringField(row, "location", rowContract);
    requireStringField(row, "contact_email", rowContract);
    requireStringField(row, "status", rowContract);
    requireNumberField(row, "course_count", rowContract);
    requireNumberField(row, "booking_count", rowContract);
    requireNumberField(row, "enquiry_count", rowContract);
    requireArrayField(row, "delivery_types", rowContract);
    const courses = requireArrayField(row, "top_courses", rowContract);
    courses.forEach((courseItem, courseIndex) => {
      const courseContract = `${rowContract}.top_courses[${courseIndex}]`;
      const course = requireRuntimeRecord(courseItem, courseContract);
      requireStringField(course, "id", courseContract);
      requireStringField(course, "title", courseContract);
      requireStringField(course, "delivery_type", courseContract);
      requireNumberField(course, "duration_days", courseContract);
      requireNumberField(course, "price", courseContract);
      requireStringField(course, "currency", courseContract);
      requireNumberField(course, "bookings", courseContract);
    });
  });

  gapMatches.forEach((item, index) => {
    const rowContract = `${contract}.gapMatches[${index}]`;
    const row = requireRuntimeRecord(item, rowContract);
    requireStringField(row, "skill_name", rowContract);
    requireStringField(row, "category", rowContract);
    requireStringField(row, "risk_level", rowContract);
    requireNumberField(row, "engineers_below", rowContract);
    requireBooleanField(row, "single_point_of_failure", rowContract);
    requireStringField(row, "recommendation", rowContract);
    requireArrayField(row, "matched_partner_ids", rowContract);
    requireArrayField(row, "matched_partner_names", rowContract);
  });

  return payload;
}

export function validatePilotSetupReport(value: unknown): RuntimeRecord {
  const contract = "Pilot setup";
  const payload = requireRuntimeRecord(value, contract);
  const site = requireRecordField(payload, "site", contract);
  const pilot = requireRecordField(payload, "pilot", contract);
  const readiness = requireRecordField(payload, "readiness", contract);
  const rehearsal = requireRecordField(payload, "rehearsal", contract);

  requireStringField(site, "id", `${contract}.site`);
  requireStringField(site, "name", `${contract}.site`);
  requireStringField(pilot, "status", `${contract}.pilot`);
  requireArrayField(pilot, "successCriteria", `${contract}.pilot`);
  requireArrayField(readiness, "automatedChecks", `${contract}.readiness`);
  requireArrayField(readiness, "manualChecks", `${contract}.readiness`);
  requireNumberField(readiness, "score", `${contract}.readiness`);
  requireArrayField(rehearsal, "scenarios", `${contract}.rehearsal`);
  return payload;
}

export function validatePilotImpactReport(value: unknown): RuntimeRecord {
  const contract = "Pilot impact";
  const payload = requireRuntimeRecord(value, contract);
  requireStringField(payload, "reportVersion", contract);
  requireStringField(payload, "status", contract);
  requireRecordField(payload, "period", contract);
  requireRecordField(payload, "risk", contract);
  requireRecordField(payload, "capability", contract);
  requireRecordField(payload, "maintenanceData", contract);
  requireRecordField(payload, "knowledgeCoverage", contract);
  requireRecordField(payload, "backendReliability", contract);
  requireRecordField(payload, "confidence", contract);
  return payload;
}

export function validatePilotAdoptionReport(value: unknown): RuntimeRecord {
  const contract = "Pilot adoption";
  const payload = requireRuntimeRecord(value, contract);
  requireStringField(payload, "status", contract);
  requireNumberField(payload, "score", contract);
  requireRecordField(payload, "period", contract);
  requireRecordField(payload, "summary", contract);
  requireRecordField(payload, "workflow", contract);
  requireRecordField(payload, "funnel", contract);
  requireRecordField(payload, "scoreComponents", contract);
  requireArrayField(payload, "dailyTrend", contract);
  requireArrayField(payload, "eventBreakdown", contract);
  requireArrayField(payload, "topEquipment", contract);
  requireArrayField(payload, "limitations", contract);
  return payload;
}

export function validateWorkOrderRow(value: unknown): RuntimeRecord {
  const contract = "Work order execution";
  const row = requireRuntimeRecord(value, contract);
  requireStringField(row, "id", contract);
  requireStringField(row, "wo_number", contract);
  requireStringField(row, "equipment_id", contract);
  requireStringField(row, "site_id", contract);
  requireStringField(row, "description", contract);
  return row;
}
