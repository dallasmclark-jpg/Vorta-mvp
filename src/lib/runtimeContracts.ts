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
  requireStringField(payload, "generatedAt", contract);
  requireStringField(payload, "sourceUpdatedAt", contract);
  requireRecordField(payload, "site", contract);
  requireRecordField(payload, "overall", contract);
  requireArrayField(payload, "teams", contract);
  requireArrayField(payload, "departments", contract);
  requireRecordField(payload, "areaSkills", contract);
  requireRecordField(payload, "details", contract);
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
