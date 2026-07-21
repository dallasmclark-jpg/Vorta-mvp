import {
  RuntimeContractError,
  requireRuntimeRecord,
  type RuntimeRecord,
} from "../../lib/runtimeContracts";

export interface LiveEngineerSkill {
  name: string;
  category: string;
  rating: number;
  is_critical: boolean;
}

export interface LiveEngineerCertification {
  skill_name: string;
  category: string;
  expiry_date: string | null;
  verification_status: string;
}

export interface LiveEngineerRecord {
  id: string;
  full_name: string;
  discipline: string | null;
  employment_type: string;
  availability_status: string;
  verified: boolean;
  shift_pattern: string | null;
  department_name: string | null;
  site_id: string;
  site_name: string | null;
  site_region: string | null;
  skills_score: number;
  risk_level: string;
  training_count: number;
  total_skills_assessed: number;
  critical_skills_count: number;
  critical_skills_met: number;
  has_expired_validation: boolean;
  last_assessment_date: string | null;
  top_skills: LiveEngineerSkill[];
  training_completed: number;
  training_active: number;
  critical_knowledge_holder: boolean;
  retirement_risk: string | null;
  leaving_risk: string | null;
  certifications: LiveEngineerCertification[];
  years_experience: number | null;
  ai_confidence: number;
}

export interface LiveEngineerStats {
  totalEngineers: number;
  verifiedEngineers: number;
  currentlyAvailable: number;
  onShiftToday: number;
  inTraining: number;
  criticalHolders: number;
  avgCompetencyScore: number;
  certificationsExpiring30d: number;
}

export interface LiveEngineersPayload {
  siteId: string;
  organisationId: string;
  generatedAt: string;
  engineers: LiveEngineerRecord[];
  assignments: unknown[];
  trainingBookings: unknown[];
  skillGaps: unknown[];
  departments: unknown[];
  sites: unknown[];
  stats: LiveEngineerStats;
}

function requireString(record: RuntimeRecord, key: string, contract: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a non-empty string");
  }
  return value;
}

function requireNumber(record: RuntimeRecord, key: string, contract: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a finite number");
  }
  return value;
}

function requireBoolean(record: RuntimeRecord, key: string, contract: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a boolean");
  }
  return value;
}

function requireArray(record: RuntimeRecord, key: string, contract: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected an array");
  }
  return value;
}

function nullableString(value: unknown, contract: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new RuntimeContractError(contract, "expected a string or null");
  }
  return value;
}

function boundedScore(value: number, contract: string): number {
  if (value < 0 || value > 100) {
    throw new RuntimeContractError(contract, "must be between 0 and 100");
  }
  return value;
}

function parseSkill(value: unknown, index: number): LiveEngineerSkill {
  const contract = `Engineers.engineers.top_skills[${index}]`;
  const row = requireRuntimeRecord(value, contract);
  return {
    name: requireString(row, "name", contract),
    category: typeof row.category === "string" ? row.category : "",
    rating: requireNumber(row, "rating", contract),
    is_critical: requireBoolean(row, "is_critical", contract),
  };
}

function parseCertification(value: unknown, index: number): LiveEngineerCertification {
  const contract = `Engineers.engineers.certifications[${index}]`;
  const row = requireRuntimeRecord(value, contract);
  return {
    skill_name: requireString(row, "skill_name", contract),
    category: typeof row.category === "string" ? row.category : "",
    expiry_date: nullableString(row.expiry_date, `${contract}.expiry_date`),
    verification_status: requireString(row, "verification_status", contract),
  };
}

function parseEngineer(value: unknown, index: number): LiveEngineerRecord {
  const contract = `Engineers.engineers[${index}]`;
  const row = requireRuntimeRecord(value, contract);
  const topSkills = requireArray(row, "top_skills", contract).map(parseSkill);
  const certifications = requireArray(row, "certifications", contract).map(parseCertification);

  return {
    id: requireString(row, "id", contract),
    full_name: requireString(row, "full_name", contract),
    discipline: nullableString(row.discipline, `${contract}.discipline`),
    employment_type: requireString(row, "employment_type", contract),
    availability_status: requireString(row, "availability_status", contract),
    verified: requireBoolean(row, "verified", contract),
    shift_pattern: nullableString(row.shift_pattern, `${contract}.shift_pattern`),
    department_name: nullableString(row.department_name, `${contract}.department_name`),
    site_id: requireString(row, "site_id", contract),
    site_name: nullableString(row.site_name, `${contract}.site_name`),
    site_region: nullableString(row.site_region, `${contract}.site_region`),
    skills_score: boundedScore(requireNumber(row, "skills_score", contract), `${contract}.skills_score`),
    risk_level: requireString(row, "risk_level", contract),
    training_count: requireNumber(row, "training_count", contract),
    total_skills_assessed: requireNumber(row, "total_skills_assessed", contract),
    critical_skills_count: requireNumber(row, "critical_skills_count", contract),
    critical_skills_met: requireNumber(row, "critical_skills_met", contract),
    has_expired_validation: requireBoolean(row, "has_expired_validation", contract),
    last_assessment_date: nullableString(row.last_assessment_date, `${contract}.last_assessment_date`),
    top_skills: topSkills,
    training_completed: requireNumber(row, "training_completed", contract),
    training_active: requireNumber(row, "training_active", contract),
    critical_knowledge_holder: requireBoolean(row, "critical_knowledge_holder", contract),
    retirement_risk: nullableString(row.retirement_risk, `${contract}.retirement_risk`),
    leaving_risk: nullableString(row.leaving_risk, `${contract}.leaving_risk`),
    certifications,
    years_experience:
      row.years_experience === null || row.years_experience === undefined
        ? null
        : requireNumber(row, "years_experience", contract),
    ai_confidence: boundedScore(requireNumber(row, "ai_confidence", contract), `${contract}.ai_confidence`),
  };
}

export function validateEngineersPayload(value: unknown): LiveEngineersPayload {
  const contract = "Engineers";
  const payload = requireRuntimeRecord(value, contract);
  const siteId = requireString(payload, "siteId", contract);
  const organisationId = requireString(payload, "organisationId", contract);
  const generatedAt = requireString(payload, "generatedAt", contract);
  if (!Number.isFinite(new Date(generatedAt).getTime())) {
    throw new RuntimeContractError(`${contract}.generatedAt`, "expected a valid timestamp");
  }

  const engineers = requireArray(payload, "engineers", contract).map(parseEngineer);
  engineers.forEach((engineer, index) => {
    if (engineer.site_id !== siteId) {
      throw new RuntimeContractError(
        `${contract}.engineers[${index}].site_id`,
        "does not match the authorised active site",
      );
    }
  });

  const statsRecord = requireRuntimeRecord(payload.stats, `${contract}.stats`);
  const stats: LiveEngineerStats = {
    totalEngineers: requireNumber(statsRecord, "totalEngineers", `${contract}.stats`),
    verifiedEngineers: requireNumber(statsRecord, "verifiedEngineers", `${contract}.stats`),
    currentlyAvailable: requireNumber(statsRecord, "currentlyAvailable", `${contract}.stats`),
    onShiftToday: requireNumber(statsRecord, "onShiftToday", `${contract}.stats`),
    inTraining: requireNumber(statsRecord, "inTraining", `${contract}.stats`),
    criticalHolders: requireNumber(statsRecord, "criticalHolders", `${contract}.stats`),
    avgCompetencyScore: boundedScore(
      requireNumber(statsRecord, "avgCompetencyScore", `${contract}.stats`),
      `${contract}.stats.avgCompetencyScore`,
    ),
    certificationsExpiring30d: requireNumber(
      statsRecord,
      "certificationsExpiring30d",
      `${contract}.stats`,
    ),
  };

  if (stats.totalEngineers !== engineers.length) {
    throw new RuntimeContractError(
      `${contract}.stats.totalEngineers`,
      "does not match the validated engineer register",
    );
  }

  return {
    siteId,
    organisationId,
    generatedAt,
    engineers,
    assignments: requireArray(payload, "assignments", contract),
    trainingBookings: requireArray(payload, "trainingBookings", contract),
    skillGaps: requireArray(payload, "skillGaps", contract),
    departments: requireArray(payload, "departments", contract),
    sites: requireArray(payload, "sites", contract),
    stats,
  };
}
