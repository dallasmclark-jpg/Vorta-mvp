import { RuntimeContractError } from "./runtimeContracts";

type RuntimeRecord = Record<string, unknown>;

function record(value: unknown, contract: string): RuntimeRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RuntimeContractError(contract, "expected an object response");
  }
  return value as RuntimeRecord;
}

function arrayField(source: RuntimeRecord, key: string, contract: string): unknown[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected an array");
  }
  return value;
}

function recordField(source: RuntimeRecord, key: string, contract: string): RuntimeRecord {
  return record(source[key], `${contract}.${key}`);
}

function stringField(source: RuntimeRecord, key: string, contract: string): string {
  const value = source[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a non-empty string");
  }
  return value;
}

function optionalStringField(source: RuntimeRecord, key: string, contract: string): string | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a string or null");
  }
  return value;
}

function numberField(source: RuntimeRecord, key: string, contract: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a finite number");
  }
  return value;
}

function optionalNumberField(source: RuntimeRecord, key: string, contract: string): number | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a finite number or null");
  }
  return value;
}

function booleanField(source: RuntimeRecord, key: string, contract: string): boolean {
  const value = source[key];
  if (typeof value !== "boolean") {
    throw new RuntimeContractError(`${contract}.${key}`, "expected a boolean");
  }
  return value;
}

function percentageField(source: RuntimeRecord, key: string, contract: string): number {
  const value = numberField(source, key, contract);
  if (value < 0 || value > 100) {
    throw new RuntimeContractError(`${contract}.${key}`, "must be between 0 and 100");
  }
  return value;
}

function stringArrayField(source: RuntimeRecord, key: string, contract: string): string[] {
  const values = arrayField(source, key, contract);
  values.forEach((value, index) => {
    if (typeof value !== "string") {
      throw new RuntimeContractError(`${contract}.${key}[${index}]`, "expected a string");
    }
  });
  return values as string[];
}

function numericRecordField(source: RuntimeRecord, key: string, contract: string): RuntimeRecord {
  const value = recordField(source, key, contract);
  Object.entries(value).forEach(([entryKey, entryValue]) => {
    if (typeof entryValue !== "number" || !Number.isFinite(entryValue)) {
      throw new RuntimeContractError(
        `${contract}.${key}.${entryKey}`,
        "expected a finite number",
      );
    }
  });
  return value;
}

export function validateCareerEvidencePayload(value: unknown): RuntimeRecord {
  const contract = "Career evidence";
  const payload = record(value, contract);
  stringField(payload, "siteId", contract);
  stringField(payload, "organisationId", contract);
  stringField(payload, "generatedAt", contract);
  const stats = recordField(payload, "stats", contract);
  const paths = arrayField(payload, "paths", contract);
  const requirements = arrayField(payload, "requirements", contract);

  [
    "activePathCount",
    "engineerCount",
    "readySoonCount",
    "requirementCount",
    "completedRequirementCount",
  ].forEach((key) => numberField(stats, key, `${contract}.stats`));
  percentageField(stats, "averageReadiness", `${contract}.stats`);

  paths.forEach((item, index) => {
    const rowContract = `${contract}.paths[${index}]`;
    const row = record(item, rowContract);
    [
      "id",
      "engineerId",
      "engineerName",
      "currentJobRole",
      "targetJobRole",
      "pathName",
      "pathwayCategory",
      "status",
      "updatedAt",
    ].forEach((key) => stringField(row, key, rowContract));
    optionalStringField(row, "avatarUrl", rowContract);
    optionalStringField(row, "estimatedTimeframe", rowContract);
    optionalStringField(row, "targetCompletionDate", rowContract);
    optionalStringField(row, "developmentSummary", rowContract);
    percentageField(row, "readinessScore", rowContract);
    [
      "requirementCount",
      "completedRequirementCount",
      "evidenceItemsRequired",
      "evidenceItemsCompleted",
      "interventionsRequired",
      "interventionsCompleted",
    ].forEach((key) => numberField(row, key, rowContract));
  });

  requirements.forEach((item, index) => {
    const rowContract = `${contract}.requirements[${index}]`;
    const row = record(item, rowContract);
    [
      "id",
      "careerPathId",
      "engineerName",
      "name",
      "requirementType",
      "status",
      "priority",
    ].forEach((key) => stringField(row, key, rowContract));
    optionalNumberField(row, "currentLevel", rowContract);
    optionalNumberField(row, "targetLevel", rowContract);
    numberField(row, "impactScore", rowContract);
    booleanField(row, "evidenceRequired", rowContract);
    optionalStringField(row, "notes", rowContract);
  });

  return payload;
}

export function validateSupportEvidencePayload(value: unknown): RuntimeRecord {
  const contract = "Support evidence";
  const payload = record(value, contract);
  stringField(payload, "siteId", contract);
  stringField(payload, "organisationId", contract);
  stringField(payload, "generatedAt", contract);
  const stats = recordField(payload, "stats", contract);
  const requests = arrayField(payload, "requests", contract);

  [
    "totalRequests",
    "openRequests",
    "matchedRequests",
    "closedRequests",
    "productionStoppedRequests",
    "sessionCount",
    "reportCount",
  ].forEach((key) => numberField(stats, key, `${contract}.stats`));

  requests.forEach((item, index) => {
    const rowContract = `${contract}.requests[${index}]`;
    const row = record(item, rowContract);
    ["id", "requestTitle", "priority", "status", "openedAt"].forEach((key) =>
      stringField(row, key, rowContract),
    );
    [
      "issueDescription",
      "issueType",
      "requiredSupportType",
      "preferredContactMethod",
      "supportScope",
      "matchedAt",
      "closedAt",
      "resolutionSummary",
      "equipmentName",
      "departmentName",
      "latestSessionStatus",
      "latestReportTitle",
    ].forEach((key) => optionalStringField(row, key, rowContract));
    booleanField(row, "productionStopped", rowContract);
    optionalNumberField(row, "estimatedDowntimeMinutes", rowContract);
    stringArrayField(row, "skillNames", rowContract);
    ["matchCount", "sessionCount", "reportCount"].forEach((key) =>
      numberField(row, key, rowContract),
    );
  });

  return payload;
}

export function validateSettingsEvidencePayload(value: unknown): RuntimeRecord {
  const contract = "Settings evidence";
  const payload = record(value, contract);
  const siteId = stringField(payload, "siteId", contract);
  const organisationId = stringField(payload, "organisationId", contract);
  stringField(payload, "generatedAt", contract);
  const site = recordField(payload, "site", contract);
  const organisation = recordField(payload, "organisation", contract);
  const access = recordField(payload, "access", contract);
  const configuration = recordField(payload, "configuration", contract);

  const responseSiteId = stringField(site, "id", `${contract}.site`);
  stringField(site, "name", `${contract}.site`);
  ["address", "postcode", "region", "criticality", "timezone"].forEach((key) =>
    optionalStringField(site, key, `${contract}.site`),
  );
  optionalNumberField(site, "fiscalYearStartMonth", `${contract}.site`);
  stringField(site, "updatedAt", `${contract}.site`);

  const responseOrganisationId = stringField(
    organisation,
    "id",
    `${contract}.organisation`,
  );
  stringField(organisation, "name", `${contract}.organisation`);
  ["type", "industry", "location", "status"].forEach((key) =>
    optionalStringField(organisation, key, `${contract}.organisation`),
  );
  stringField(organisation, "updatedAt", `${contract}.organisation`);

  ["profileId", "fullName", "profileRole", "appRole", "grantedAt"].forEach((key) =>
    stringField(access, key, `${contract}.access`),
  );
  optionalStringField(access, "jobTitle", `${contract}.access`);
  booleanField(access, "isDefault", `${contract}.access`);

  numberField(configuration, "persistedSettingCount", `${contract}.configuration`);
  stringArrayField(configuration, "groups", `${contract}.configuration`);
  const keys = arrayField(configuration, "keys", `${contract}.configuration`);
  keys.forEach((item, index) => {
    const rowContract = `${contract}.configuration.keys[${index}]`;
    const row = record(item, rowContract);
    stringField(row, "group", rowContract);
    stringField(row, "key", rowContract);
    optionalStringField(row, "description", rowContract);
    stringField(row, "updatedAt", rowContract);
  });

  if (responseSiteId !== siteId) {
    throw new RuntimeContractError(`${contract}.site.id`, "must match the response siteId");
  }
  if (responseOrganisationId !== organisationId) {
    throw new RuntimeContractError(
      `${contract}.organisation.id`,
      "must match the response organisationId",
    );
  }

  return payload;
}

export function validateSystemHealthData(value: unknown): RuntimeRecord {
  const contract = "System health evidence";
  const payload = record(value, contract);
  const summary = recordField(payload, "summary", contract);
  const incidents = arrayField(payload, "incidents", contract);
  const recovery = recordField(payload, "recoveryManifest", contract);

  stringField(summary, "siteId", `${contract}.summary`);
  stringField(summary, "overallStatus", `${contract}.summary`);
  [
    "latestHealthRunId",
    "latestHealthStatus",
    "latestHealthFinishedAt",
    "riskLastRefreshedAt",
    "latestImportStatus",
    "latestImportAt",
    "latestImportFileName",
    "latestMonitorRunAt",
  ].forEach((key) => optionalStringField(summary, key, `${contract}.summary`));
  [
    "passedCount",
    "failedCount",
    "warningCount",
    "openIncidentCount",
    "criticalIncidentCount",
    "highIncidentCount",
    "mediumIncidentCount",
  ].forEach((key) => numberField(summary, key, `${contract}.summary`));
  optionalNumberField(summary, "riskAgeMinutes", `${contract}.summary`);

  incidents.forEach((item, index) => {
    const rowContract = `${contract}.incidents[${index}]`;
    const row = record(item, rowContract);
    [
      "id",
      "title",
      "severity",
      "status",
      "firstObservedAt",
      "lastObservedAt",
    ].forEach((key) => stringField(row, key, rowContract));
    ["monitorKey", "description", "source", "acknowledgedAt", "resolvedAt"].forEach(
      (key) => optionalStringField(row, key, rowContract),
    );
    numberField(row, "occurrenceCount", rowContract);
    recordField(row, "details", rowContract);
  });

  [
    "manifestId",
    "siteId",
    "status",
    "migrationVersion",
    "manifestFingerprint",
    "createdAt",
  ].forEach((key) => stringField(recovery, key, `${contract}.recoveryManifest`));
  optionalStringField(recovery, "migrationName", `${contract}.recoveryManifest`);
  optionalStringField(recovery, "latestHealthRunId", `${contract}.recoveryManifest`);
  optionalStringField(recovery, "riskRefreshedAt", `${contract}.recoveryManifest`);
  numberField(recovery, "schemaMigrationCount", `${contract}.recoveryManifest`);
  numberField(recovery, "ageHours", `${contract}.recoveryManifest`);
  numericRecordField(recovery, "datasetCounts", `${contract}.recoveryManifest`);
  recordField(recovery, "datasetFingerprints", `${contract}.recoveryManifest`);

  return payload;
}
