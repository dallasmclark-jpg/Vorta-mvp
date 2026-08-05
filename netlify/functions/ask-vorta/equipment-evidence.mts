import type { JsonRecord, ToolResult } from "./contracts.mjs";
import { MAX_TOOL_OUTPUT_CHARACTERS } from "./contracts.mjs";
import { decisionField, nestedDecisionRecords, numberValue, records, textValues } from "./utilities.mjs";

export function compactEquipmentDecisionPackForModel(
  result: ToolResult,
): ToolResult | null {
  if (
    result.source !== "Equipment cross-domain decision pack" ||
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data)
  ) {
    return null;
  }

  const data = result.data as JsonRecord;
  const decisionFacts = textValues(data.decisionFacts)
    .slice(0, 24)
    .map((fact) => fact.slice(0, 900));
  return {
    source: result.source,
    status: result.status,
    message: result.message,
    data: {
      query: data.query,
      equipment: compactDecisionData(data.equipment),
      ambiguous: data.ambiguous,
      matches: compactDecisionData(data.matches),
      coveredTools: textValues(data.coveredTools),
      includedDomains: textValues(data.includedDomains),
      omittedDomains: textValues(data.omittedDomains),
      decisionFacts,
      caveat:
        typeof data.caveat === "string"
          ? data.caveat
          : "The model-facing pack contains the question-relevant verified decision facts rather than every raw equipment domain.",
    },
  };
}

export function compactSiteOperationalSnapshotForModel(
  result: ToolResult,
): ToolResult | null {
  if (
    result.source !== "Vorta operational decision snapshot" ||
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data)
  ) {
    return null;
  }

  const data = result.data as JsonRecord;
  const domains =
    data.domains && typeof data.domains === "object" && !Array.isArray(data.domains)
      ? (data.domains as JsonRecord)
      : {};
  const domainLimits: Array<[string, number]> = [
    ["rankedActions", 14],
    ["siteRisk", 6],
    ["workBacklog", 6],
    ["sparesRisk", 6],
    ["capability", 6],
    ["handover", 6],
  ];
  const compactDomains = Object.fromEntries(
    domainLimits.flatMap(([domainName, limit]) => {
      const domain = domains[domainName];
      if (!domain || typeof domain !== "object" || Array.isArray(domain)) return [];
      const domainRecord = domain as JsonRecord;
      const seen = new Set<string>();
      const decisionFacts = collectDecisionFacts(domainRecord.data)
        .sort(
          (first, second) =>
            second.score - first.score || first.text.localeCompare(second.text),
        )
        .filter((fact) => {
          const key = fact.text.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, limit)
        .map((fact) => fact.text.slice(0, 650));
      return [[
        domainName,
        {
          source: domainRecord.source,
          status: domainRecord.status,
          message: domainRecord.message,
          decisionFacts,
        },
      ]];
    }),
  );

  return {
    source: result.source,
    status: result.status,
    message: result.message,
    data: {
      generatedAt: data.generatedAt,
      domains: compactDomains,
      caveat: data.caveat,
      detailScope:
        "The model-facing snapshot preserves ranked actions plus bounded risk, work, spares, capability and handover decision facts, including owners, blockers, dependencies and verification evidence.",
    },
  };
}

export function trimToolResult(result: ToolResult): string {
  const compactEquipmentPack = compactEquipmentDecisionPackForModel(result);
  if (compactEquipmentPack) {
    const compactSerialised = JSON.stringify(compactEquipmentPack);
    if (compactSerialised.length <= MAX_TOOL_OUTPUT_CHARACTERS) {
      return compactSerialised;
    }
    const data = compactEquipmentPack.data as JsonRecord;
    return JSON.stringify({
      ...compactEquipmentPack,
      data: {
        ...data,
        decisionFacts: textValues(data.decisionFacts)
          .slice(0, 12)
          .map((fact) => fact.slice(0, 650)),
      },
    });
  }

  const compactSiteSnapshot = compactSiteOperationalSnapshotForModel(result);
  if (compactSiteSnapshot) {
    const compactSerialised = JSON.stringify(compactSiteSnapshot);
    if (compactSerialised.length <= MAX_TOOL_OUTPUT_CHARACTERS) {
      return compactSerialised;
    }
    const data = compactSiteSnapshot.data as JsonRecord;
    const domains = data.domains as JsonRecord;
    return JSON.stringify({
      ...compactSiteSnapshot,
      data: {
        ...data,
        domains: Object.fromEntries(
          Object.entries(domains).map(([domainName, domain]) => {
            const domainRecord = domain as JsonRecord;
            return [
              domainName,
              {
                ...domainRecord,
                decisionFacts: textValues(domainRecord.decisionFacts)
                  .slice(0, domainName === "rankedActions" ? 8 : 4)
                  .map((fact) => fact.slice(0, 450)),
              },
            ];
          }),
        ),
      },
    });
  }

  const serialised = JSON.stringify(result);
  if (serialised.length <= MAX_TOOL_OUTPUT_CHARACTERS) return serialised;
  return JSON.stringify({
    source: result.source,
    status: "unavailable",
    message: "The result was too large to analyse safely. Narrow the equipment or date range.",
  });
}

export function compactShiftCoverData(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const brief = value as JsonRecord;
  const calendar = Array.isArray(brief.calendar)
    ? brief.calendar.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
  const priorityShifts = calendar
    .filter(
      (shift) =>
        shift.coverageStatus !== "covered" ||
        numberValue(shift.missingSkillCount) > 0,
    )
    .sort(
      (first, second) =>
        Number(second.coverageStatus !== "covered") -
          Number(first.coverageStatus !== "covered") ||
        numberValue(second.labourRiskScore) -
          numberValue(first.labourRiskScore) ||
        numberValue(second.missingSkillCount) -
          numberValue(first.missingSkillCount),
    )
    .slice(0, 4);
  const priorityKeys = new Set(
    priorityShifts.map(
      (shift) => `${String(shift.shiftDate)}:${String(shift.shiftType)}`,
    ),
  );
  const forPriorityShift = (item: unknown): item is JsonRecord => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as JsonRecord;
    return priorityKeys.has(`${String(row.shiftDate)}:${String(row.shiftType)}`);
  };
  const skillRisks = Array.isArray(brief.skillRisks)
    ? brief.skillRisks.filter(forPriorityShift)
    : [];
  const topSkillRisks = priorityShifts.flatMap((shift) =>
    skillRisks
      .filter(
        (risk) =>
          risk.shiftDate === shift.shiftDate &&
          risk.shiftType === shift.shiftType,
      )
      .sort(
        (first, second) =>
          numberValue(first.qualifiedEngineerCount) -
            numberValue(second.qualifiedEngineerCount) ||
          String(first.skillName).localeCompare(String(second.skillName)),
      )
      .slice(0, 4),
  );

  return {
    ...brief,
    calendar,
    offRota: Array.isArray(brief.offRota)
      ? brief.offRota.filter(forPriorityShift)
      : [],
    coverCandidates: Array.isArray(brief.coverCandidates)
      ? brief.coverCandidates.filter(forPriorityShift)
      : [],
    coverPackages: Array.isArray(brief.coverPackages)
      ? brief.coverPackages.filter(forPriorityShift)
      : [],
    skillRisks: topSkillRisks,
    summary: {
      shiftsChecked: calendar.length,
      reducedCoverShifts: calendar.filter(
        (shift) => shift.coverageStatus !== "covered",
      ).length,
      shiftsWithSkillExposure: calendar.filter(
        (shift) => numberValue(shift.missingSkillCount) > 0,
      ).length,
      priorityShiftCountWithDetailedEvidence: priorityShifts.length,
    },
    detailScope:
      "All shift summaries are included. Named rota-off, candidate, package and skill-by-asset detail is limited to the four highest-priority shifts.",
  };
}

export function compactDecisionData(value: unknown, depth = 0): unknown {
  if (depth > 5) return "Further nested evidence omitted from the compact decision pack.";
  if (typeof value === "string") {
    return value.length > 1_500 ? value.slice(0, 1_500) + "…" : value;
  }
  if (Array.isArray(value)) {
    const limit = depth === 0 ? 20 : 12;
    return value.slice(0, limit).map((item) => compactDecisionData(item, depth + 1));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .slice(0, 60)
      .map(([key, item]) => [key, compactDecisionData(item, depth + 1)]),
  );
}

export function compactToolDomain(result: ToolResult): JsonRecord {
  return {
    source: result.source,
    status: result.status,
    data: compactDecisionData(result.data),
    message: result.message,
  };
}

export function compactEquipmentSkillsDomain(result: ToolResult): JsonRecord {
  return {
    source: result.source,
    status: result.status,
    message: result.message,
    data: records(result.data).map((row) => ({
      equipment_code: row.equipment_code ?? row.equipmentCode,
      equipment_name: row.equipment_name ?? row.equipmentName,
      required_skills: records(row.required_skills ?? row.requiredSkills).map((skill) => ({
        name: skill.name ?? skill.skill_name ?? skill.skillName,
        required_level: skill.required_level ?? skill.requiredLevel,
        minimum_qualified_engineers:
          skill.minimum_qualified_engineers ?? skill.minimumQualifiedEngineers,
        criticality: skill.criticality,
        execution_authority: skill.execution_authority ?? skill.executionAuthority,
        validation_required: skill.validation_required ?? skill.validationRequired,
        qualified_engineers: records(
          skill.qualified_engineers ?? skill.qualifiedEngineers,
        )
          .slice(0, 12)
          .map((engineer) => ({
            engineer_name: engineer.engineer_name ?? engineer.engineerName,
            rating: engineer.rating ?? engineer.validated_rating ?? engineer.validatedRating,
            validation_status:
              engineer.validation_status ??
              engineer.validationStatus ??
              engineer.verification_status ??
              engineer.verificationStatus,
            capability_role: engineer.capability_role ?? engineer.capabilityRole,
            qualification_state:
              engineer.qualification_state ?? engineer.qualificationState,
            availability_status:
              engineer.availability_status ?? engineer.availabilityStatus,
            discipline: engineer.discipline,
            shift_pattern: engineer.shift_pattern ?? engineer.shiftPattern,
          })),
      })),
    })),
  };
}

export type EquipmentDecisionDomainName =
  | "get_equipment_work"
  | "get_equipment_calibrations"
  | "get_equipment_skills"
  | "get_equipment_spares"
  | "get_equipment_risk_actions"
  | "get_equipment_history"
  | "get_equipment_documents";

export const ALL_EQUIPMENT_DECISION_DOMAINS: EquipmentDecisionDomainName[] = [
  "get_equipment_work",
  "get_equipment_calibrations",
  "get_equipment_skills",
  "get_equipment_spares",
  "get_equipment_risk_actions",
  "get_equipment_history",
  "get_equipment_documents",
];

export function equipmentDecisionDomains(question: string): EquipmentDecisionDomainName[] {
  const lowered = question.toLowerCase();
  const selected = new Set<EquipmentDecisionDomainName>();
  const add = (...domains: EquipmentDecisionDomainName[]): void => {
    domains.forEach((domain) => selected.add(domain));
  };

  if (
    /\b(?:why .*risk|driving .*risk|highest[- ]risk|risk reduction|do first|safest next action|leading intervention)\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_work", "get_equipment_spares", "get_equipment_risk_actions");
  }
  if (
    /\b(?:who|qualified|qualification|skill|capability|engineer|authori[sz]e|can lead|can verify|calibrate and verify|diagnos(?:e|is|tic|ing)?)\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_skills");
  }
  if (
    /\b(?:spare|part|required action|blocking|blocker|permanent correction|permanent repair|replace|out of stock|stockout)\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_spares", "get_equipment_work", "get_equipment_risk_actions");
  }
  if (
    /\b(?:fault|cause|caused|diagnos(?:e|is|tic|ing)?|repeat|false reject|credible reading|instrument fault|probe disagreement|keep generating|work history)\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_history");
  }
  if (
    /\b(?:calibrat|conductivity|pressure|transmitter|probe|measurement|reading|reference instrument|instrument fault)\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_calibrations");
  }
  if (
    /\b(?:document|manual|guide|approved|procedure|drawing|evidence|before acting|after repair|before production restarts|before returning|release|campaign|verification|verify|checks? required)\b/.test(
      lowered,
    )
  ) {
    add("get_equipment_documents");
  }
  if (/\b(?:after repair|before production restarts|before returning|release|campaign|next safe action|next shift)\b/.test(lowered)) {
    add("get_equipment_work", "get_equipment_calibrations");
  }
  if (/\bnext shift\b/.test(lowered)) {
    add("get_equipment_spares");
  }
  if (
    /\bnext safe action\b/.test(lowered) &&
    /\b(?:probe|sensor|deviation|repeat|disagreement)\b/.test(lowered)
  ) {
    add(
      "get_equipment_work",
      "get_equipment_calibrations",
      "get_equipment_spares",
      "get_equipment_documents",
    );
  }
  if (/\b(?:risk reduction|what remains afterwards|leading intervention)\b/.test(lowered)) {
    add("get_equipment_risk_actions", "get_equipment_spares");
  }

  return selected.size > 0
    ? ALL_EQUIPMENT_DECISION_DOMAINS.filter((domain) => selected.has(domain))
    : [...ALL_EQUIPMENT_DECISION_DOMAINS];
}

export function collectDecisionFacts(
  value: unknown,
  path = "",
  depth = 0,
): Array<{ score: number; text: string }> {
  if (depth > 6 || value === null || value === undefined) return [];
  if (typeof value !== "object") {
    const text = String(value).trim();
    if (!text || !path) return [];
    const pathSegments = path.split(/[.[\]]/).filter(Boolean);
    const leafKey =
      [...pathSegments].reverse().find((segment) => !/^\d+$/.test(segment)) ?? path;
    const keyScore = /code|number|reference|fault|component|part|skill|engineer|name/i.test(leafKey)
      ? 8
      : /title|summary|description|action|owner|block|depend|verification|priority|outcome|status|quantity|stock|lead|risk|validation|calibration|cause|text|note|specialism|evidence/i.test(leafKey)
        ? 5
        : 1;
    const valueScore = /[A-Z]{2,}[-0-9]{2,}/.test(text) ? 5 : 0;
    return keyScore + valueScore >= 5
      ? [{ score: keyScore + valueScore, text: `${path}: ${text.slice(0, 500)}` }]
      : [];
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 40)
      .flatMap((item, index) =>
        collectDecisionFacts(item, `${path}[${index}]`, depth + 1),
      );
  }
  if (typeof value !== "object") return [];

  const facts: Array<{ score: number; text: string }> = [];
  for (const [key, item] of Object.entries(value as JsonRecord).slice(0, 100)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (
      (typeof item === "string" || typeof item === "number" || typeof item === "boolean") &&
      String(item).trim()
    ) {
      const keyScore = /code|number|reference|fault|component|part|skill|engineer|name/i.test(key)
        ? 8
        : /title|summary|description|action|owner|block|depend|verification|priority|outcome|status|quantity|stock|lead|risk|validation|calibration/i.test(key)
          ? 5
          : 1;
      const valueScore = /[A-Z]{2,}[-0-9]{2,}/.test(String(item)) ? 5 : 0;
      if (keyScore + valueScore >= 5) {
        facts.push({
          score: keyScore + valueScore,
          text: `${nextPath}: ${String(item).slice(0, 500)}`,
        });
      }
      continue;
    }
    facts.push(...collectDecisionFacts(item, nextPath, depth + 1));
  }
  return facts;
}

export function explicitEquipmentDomainFacts(
  domains: Record<string, JsonRecord>,
): string[] {
  const facts: string[] = [];
  const add = (value: string): void => {
    const text = value.trim();
    if (text) facts.push(text.slice(0, 900));
  };

  const workRecords = [
    ...nestedDecisionRecords(domains.get_equipment_work?.data),
    ...nestedDecisionRecords(domains.get_equipment_history?.data),
  ];
  for (const record of workRecords.slice(0, 160)) {
    const workOrder = decisionField(record, [
      "work_order_number",
      "workOrderNumber",
      "wo_number",
      "workOrder",
    ]);
    const description = decisionField(record, [
      "description",
      "latest_confirmation_text",
      "latestConfirmationText",
      "confirmation_text",
      "confirmationText",
      "summary",
    ]);
    const faultCode = decisionField(record, ["fault_code", "faultCode"]);
    const engineer = decisionField(record, [
      "assigned_engineer",
      "assignedEngineer",
      "latest_confirmed_by",
      "latestConfirmedBy",
      "confirmed_by",
      "confirmedBy",
      "engineer_name",
      "engineerName",
      "full_name",
      "fullName",
    ]);
    const status = decisionField(record, ["status", "outcome", "risk_state", "riskState"]);
    if (!description && !faultCode && !engineer) continue;
    add(
      `work evidence${workOrder ? ` ${workOrder}` : ""}: ${[
        faultCode ? `fault ${faultCode}` : "",
        description,
        engineer ? `engineer ${engineer}` : "",
        status ? `status ${status}` : "",
      ].filter(Boolean).join(" | ")}`,
    );
  }

  for (const record of nestedDecisionRecords(domains.get_equipment_spares?.data).slice(0, 120)) {
    const componentCode = decisionField(record, [
      "component_code",
      "componentCode",
      "material_number",
      "materialNumber",
      "part_number",
      "partNumber",
    ]);
    const componentName = decisionField(record, ["component_name", "componentName", "materialDescription"]);
    const available = decisionField(record, ["quantity_available", "availableQuantity", "available", "stock"]);
    const minimum = decisionField(record, ["minimum_quantity", "minimumQuantity", "minimum"]);
    const availability = decisionField(record, ["availability_status", "availabilityStatus", "status"]);
    const leadDays = decisionField(record, ["lead_days", "leadDays"]);
    if (!componentCode && !componentName) continue;
    add(
      `spare evidence: ${[
        componentCode,
        componentName,
        available ? `stock available ${available}` : "",
        minimum ? `minimum ${minimum}` : "",
        availability ? `availability ${availability}` : "",
        leadDays ? `lead time ${leadDays} days` : "",
      ].filter(Boolean).join(" | ")}`,
    );
  }

  for (const skillSummary of records(domains.get_equipment_skills?.data)) {
    const requiredSkills = records(
      skillSummary.required_skills ?? skillSummary.requiredSkills,
    );
    for (const requiredSkill of requiredSkills.slice(0, 40)) {
      const skillName = decisionField(requiredSkill, [
        "name",
        "skill_name",
        "skillName",
      ]);
      const requiredLevel = decisionField(requiredSkill, [
        "required_level",
        "requiredLevel",
      ]);
      const minimumQualified = decisionField(requiredSkill, [
        "minimum_qualified_engineers",
        "minimumQualifiedEngineers",
      ]);
      const qualifiedEngineers = records(
        requiredSkill.qualified_engineers ?? requiredSkill.qualifiedEngineers,
      );
      if (skillName && qualifiedEngineers.length === 0) {
        add(
          `capability evidence: skill ${skillName} | required level ${requiredLevel || "not recorded"} | minimum qualified ${minimumQualified || "not recorded"} | qualified engineers 0`,
        );
      }
      for (const engineerRecord of qualifiedEngineers.slice(0, 8)) {
        const engineer = decisionField(engineerRecord, [
          "engineer_name",
          "engineerName",
          "full_name",
          "fullName",
        ]);
        if (!skillName || !engineer) continue;
        const rating = decisionField(engineerRecord, [
          "rating",
          "validated_rating",
          "validatedRating",
        ]);
        const validation = decisionField(engineerRecord, [
          "validation_status",
          "validationStatus",
          "verification_status",
          "verificationStatus",
        ]);
        const role = decisionField(engineerRecord, [
          "capability_role",
          "capabilityRole",
        ]);
        const qualification = decisionField(engineerRecord, [
          "qualification_state",
          "qualificationState",
        ]);
        add(
          `capability evidence: skill ${skillName} | engineer ${engineer} | rating ${rating || "not recorded"} | required level ${requiredLevel || "not recorded"} | validation ${validation || "not recorded"} | role ${role || "not recorded"} | qualification ${qualification || "not recorded"}`,
        );
      }
    }
  }

  for (const record of nestedDecisionRecords(domains.get_equipment_skills?.data).slice(0, 160)) {
    const engineer = decisionField(record, [
      "engineer_name",
      "engineerName",
      "full_name",
      "fullName",
      "name",
    ]);
    const skill = decisionField(record, [
      "skill_name",
      "skillName",
      "specialism",
      "required_skill",
      "requiredSkill",
    ]);
    const role = decisionField(record, ["capability_role", "capabilityRole", "role"]);
    const validation = decisionField(record, [
      "validation_status",
      "validationStatus",
      "verification_status",
      "verificationStatus",
      "capability_status",
      "capabilityStatus",
    ]);
    const level = decisionField(record, ["competency_level", "competencyLevel", "validated_rating", "validatedRating"]);
    if (!engineer && !skill) continue;
    add(
      `capability evidence: ${[
        engineer ? `engineer ${engineer}` : "",
        skill ? `skill ${skill}` : "",
        role ? `role ${role}` : "",
        validation ? `validation ${validation}` : "",
        level ? `level ${level}` : "",
      ].filter(Boolean).join(" | ")}`,
    );
  }

  const documentRecords = [
    ...nestedDecisionRecords(domains.search_maintenance_documents?.data),
    ...nestedDecisionRecords(domains.get_equipment_documents?.data),
  ];
  for (const record of documentRecords.slice(0, 160)) {
    const title = decisionField(record, ["title", "document_title", "documentTitle"]);
    const approval = decisionField(record, ["approval_status", "approvalStatus", "status"]);
    const revision = decisionField(record, ["revision"]);
    const section = decisionField(record, ["manual_section", "manualSection", "first_section_title", "firstSectionTitle"]);
    const page = decisionField(record, ["page_number", "pageNumber", "first_page_number", "firstPageNumber"]);
    const faultCodes = decisionField(record, ["fault_codes", "faultCodes"]);
    const summary = decisionField(record, [
      "summary",
      "extracted_summary",
      "extractedSummary",
      "content",
      "excerpt",
      "chunk_text",
      "chunkText",
    ]);
    if (!title && !summary && !faultCodes) continue;
    add(
      `document evidence: ${[
        title,
        revision ? `revision ${revision}` : "",
        approval ? `approval ${approval}` : "",
        section ? `section ${section}` : "",
        page ? `page ${page}` : "",
        faultCodes ? `fault codes ${faultCodes}` : "",
        summary,
      ].filter(Boolean).join(" | ")}`,
    );
  }

  return [...new Set(facts)];
}

export function normalisedEvidenceTokens(value: string): string[] {
  const stopWords = new Set([
    "what",
    "which",
    "with",
    "that",
    "this",
    "from",
    "have",
    "should",
    "could",
    "would",
    "before",
    "after",
    "system",
    "equipment",
  ]);
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((token) => {
      if (token.length > 5 && token.endsWith("ies")) {
        return `${token.slice(0, -3)}y`;
      }
      return token.length > 4 && token.endsWith("s")
        ? token.slice(0, -1)
        : token;
    })
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

export function evidenceTextOverlapScore(query: string, candidate: string): number {
  const queryTokens = new Set(normalisedEvidenceTokens(query));
  return normalisedEvidenceTokens(candidate).reduce(
    (score, token) => score + (queryTokens.has(token) ? 1 : 0),
    0,
  );
}

export function questionMatchedEquipmentFacts(
  selected: JsonRecord,
  domains: Record<string, JsonRecord>,
  question: string,
): string[] {
  const priorityFacts: string[] = [];
  const add = (fact: string): void => {
    const text = fact.trim();
    if (text && !priorityFacts.includes(text)) priorityFacts.push(text.slice(0, 1_200));
  };
  const loweredQuestion = question.toLowerCase();
  const equipmentIdentity = [
    selected.equipment_name,
    selected.equipment_code,
    selected.name,
    selected.code,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  const asksForSpare =
    /\b(?:spare|part|stock|stockout|out of stock|lead time|blocking|blocker|stopping|permanent correction|permanent repair|leading intervention|next safe action)\b/.test(
      loweredQuestion,
    );
  if (asksForSpare) {
    const spareRecords = nestedDecisionRecords(domains.get_equipment_spares?.data)
      .filter((record) =>
        Boolean(
          decisionField(record, [
            "component_code",
            "componentCode",
            "part_number",
            "partNumber",
          ]) || decisionField(record, ["component_name", "componentName"]),
        ),
      );
    const rankedSpares = spareRecords
      .map((record, index) => {
        const componentCode = decisionField(record, [
          "component_code",
          "componentCode",
          "material_number",
          "materialNumber",
          "part_number",
          "partNumber",
        ]);
        const componentName = decisionField(record, [
          "component_name",
          "componentName",
          "materialDescription",
        ]);
        const available = decisionField(record, [
          "quantity_available",
          "availableQuantity",
          "available",
          "stock",
        ]);
        const minimum = decisionField(record, [
          "minimum_quantity",
          "minimumQuantity",
          "minimum",
        ]);
        const availability = decisionField(record, [
          "availability_status",
          "availabilityStatus",
          "status",
        ]);
        const leadDays = decisionField(record, ["lead_days", "leadDays"]);
        const candidate = `${componentCode} ${componentName} ${availability}`;
        const unavailable =
          Number(available) <= 0 || /out.?of.?stock|stockout|unavailable/i.test(availability);
        const score =
          evidenceTextOverlapScore(question, candidate) * 30 +
          (unavailable ? 120 : 0) +
          Math.min(60, numberValue(leadDays)) +
          (/blocking|stopping|permanent|leading intervention/.test(loweredQuestion) && unavailable
            ? 50
            : 0);
        return {
          record,
          index,
          score,
          componentCode,
          componentName,
          available,
          minimum,
          availability,
          leadDays,
        };
      })
      .sort((first, second) => second.score - first.score || first.index - second.index);
    const spare = rankedSpares[0];
    if (spare) {
      add(
        `priority spare evidence: ${[
          spare.componentCode,
          spare.componentName,
          spare.available ? `stock available ${spare.available}` : "",
          spare.minimum ? `minimum ${spare.minimum}` : "",
          spare.availability ? `availability ${spare.availability}` : "",
          spare.leadDays ? `lead time ${spare.leadDays} days` : "",
        ].filter(Boolean).join(" | ")}`,
      );
    }
  }

  const asksForCapability =
    /\b(?:who|qualified|qualification|skill|capability|engineer|authorise|authorize|lead|calibrate|verify|diagnos)\b/.test(
      loweredQuestion,
    );
  if (asksForCapability) {
    const skillRows = nestedDecisionRecords(domains.get_equipment_skills?.data)
      .filter((record) => Array.isArray(record.required_skills) || Array.isArray(record.requiredSkills))
      .flatMap((record) => records(record.required_skills ?? record.requiredSkills));
    const workContext = JSON.stringify({
      work: domains.get_equipment_work?.data,
      history: domains.get_equipment_history?.data,
    }).toLowerCase();
    const rankedSkills = skillRows
      .map((skill, index) => {
        const skillName = decisionField(skill, ["name", "skill_name", "skillName"]);
        let score =
          evidenceTextOverlapScore(question, skillName) * 45 +
          evidenceTextOverlapScore(equipmentIdentity, skillName) * 8;
        if (/vacuum/.test(loweredQuestion) && /vacuum/i.test(skillName)) score += 140;
        if (/airflow/.test(loweredQuestion) && /hvac|airflow|environment/i.test(skillName)) score += 140;
        if (/conductivity/.test(loweredQuestion) && /conductivity/i.test(skillName)) score += 140;
        if (/pressure|transmitter/.test(loweredQuestion) && /pressure|instrument/i.test(skillName)) score += 120;
        if (/cold|monitoring/.test(loweredQuestion) && /environmental monitoring/i.test(skillName)) score += 120;
        if (/reject|vial|filler/.test(loweredQuestion) && /bosch vial|vial fill/i.test(skillName)) score += 120;
        return { skill, skillName, score, index };
      })
      .filter((item) => item.skillName)
      .sort((first, second) => second.score - first.score || first.index - second.index);
    const matchedSkill = rankedSkills[0];
    if (matchedSkill) {
      const requiredLevel = decisionField(matchedSkill.skill, [
        "required_level",
        "requiredLevel",
      ]);
      const minimumQualified = decisionField(matchedSkill.skill, [
        "minimum_qualified_engineers",
        "minimumQualifiedEngineers",
      ]);
      const engineers = records(
        matchedSkill.skill.qualified_engineers ?? matchedSkill.skill.qualifiedEngineers,
      )
        .map((engineer, index) => {
          const engineerName = decisionField(engineer, [
            "engineer_name",
            "engineerName",
            "full_name",
            "fullName",
          ]);
          const role = decisionField(engineer, ["capability_role", "capabilityRole"]);
          const validation = decisionField(engineer, [
            "validation_status",
            "validationStatus",
            "verification_status",
            "verificationStatus",
          ]);
          const rating = decisionField(engineer, [
            "rating",
            "validated_rating",
            "validatedRating",
          ]);
          const availability = decisionField(engineer, [
            "availability_status",
            "availabilityStatus",
          ]);
          const discipline = decisionField(engineer, ["discipline"]);
          const calibrationContext =
            /\b(?:calibrat|instrument|transmitter|pressure|sensor)\b/.test(
              loweredQuestion,
            );
          const disciplineMatch =
            calibrationContext && /instrument|calibration/i.test(discipline);
          const score =
            (/primary_sme/i.test(role) ? 120 : /backup_sme/i.test(role) ? 80 : 0) +
            (engineerName && workContext.includes(engineerName.toLowerCase()) ? 90 : 0) +
            (/validated/i.test(validation) ? 30 : 0) +
            (/on_shift/i.test(availability)
              ? 70
              : /available/i.test(availability)
                ? 20
                : 0) +
            (disciplineMatch ? 90 : 0) +
            numberValue(rating) * 8;
          return {
            engineerName,
            role,
            validation,
            rating,
            availability,
            discipline,
            score,
            index,
          };
        })
        .filter((item) => item.engineerName)
        .sort((first, second) => second.score - first.score || first.index - second.index);
      const engineer = engineers[0];
      add(
        `priority capability evidence: ${[
          `skill ${matchedSkill.skillName}`,
          engineer ? `engineer ${engineer.engineerName}` : "qualified engineer not recorded",
          engineer?.rating ? `rating ${engineer.rating}` : "",
          requiredLevel ? `required level ${requiredLevel}` : "",
          engineer?.validation ? `validation ${engineer.validation}` : "",
          engineer?.role ? `role ${engineer.role}` : "",
          minimumQualified ? `minimum qualified ${minimumQualified}` : "",
        ].filter(Boolean).join(" | ")}`,
      );
    }
  }

  const asksForDocument =
    /\b(?:document|manual|guide|approved|procedure|drawing|evidence|before acting|history|next safe action)\b/.test(
      loweredQuestion,
    );
  if (asksForDocument) {
    const documents = [
      ...nestedDecisionRecords(domains.search_maintenance_documents?.data),
      ...nestedDecisionRecords(domains.get_equipment_documents?.data),
    ]
      .filter((record) => decisionField(record, ["title", "document_title", "documentTitle"]))
      .map((record, index) => {
        const title = decisionField(record, ["title", "document_title", "documentTitle"]);
        const approval = decisionField(record, ["approval_status", "approvalStatus", "status"]);
        const revision = decisionField(record, ["revision"]);
        const section = decisionField(record, [
          "section_title",
          "sectionTitle",
          "manual_section",
          "manualSection",
          "first_section_title",
          "firstSectionTitle",
        ]);
        const page = decisionField(record, [
          "page_number",
          "pageNumber",
          "first_page_number",
          "firstPageNumber",
        ]);
        const summary = decisionField(record, [
          "summary",
          "extracted_summary",
          "extractedSummary",
          "chunk_text",
          "chunkText",
        ]);
        let score =
          evidenceTextOverlapScore(question, `${title} ${summary}`) * 25 +
          evidenceTextOverlapScore(equipmentIdentity, title) * 20 +
          (/approved/i.test(approval) ? 80 : 0);
        if (/before acting|work history|approved document/.test(loweredQuestion) && /fault|finding|guide/i.test(title)) {
          score += 100;
        }
        return { title, approval, revision, section, page, summary, score, index };
      })
      .sort((first, second) => second.score - first.score || first.index - second.index);
    const document = documents[0];
    if (document) {
      add(
        `priority document evidence: ${[
          document.title,
          document.revision ? `revision ${document.revision}` : "",
          document.approval ? `approval ${document.approval}` : "",
          document.section ? `section ${document.section}` : "",
          document.page ? `page ${document.page}` : "",
          document.summary,
        ].filter(Boolean).join(" | ")}`,
      );
    }
  }

  return priorityFacts;
}

export function equipmentDecisionFacts(
  selected: JsonRecord,
  domains: Record<string, JsonRecord>,
  question: string,
): string[] {
  const identity = [
    selected.equipment_code,
    selected.equipment_name,
    selected.code,
    selected.name,
    selected.area,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => `equipment: ${value}`);
  const priorityFacts = questionMatchedEquipmentFacts(selected, domains, question);
  const explicitFacts = explicitEquipmentDomainFacts(domains);
  const rankedFacts = collectDecisionFacts(domains)
    .sort((first, second) => second.score - first.score)
    .map((item) => item.text);
  const questionRanked = relevantEquipmentDecisionFacts(
    question,
    [...explicitFacts, ...rankedFacts],
  );
  return [
    ...new Set([
      ...priorityFacts,
      ...identity,
      ...questionRanked,
      ...explicitFacts,
      ...rankedFacts,
    ]),
  ]
    .slice(0, 24)
    .map((fact) => fact.slice(0, 900));
}

export function relevantEquipmentDecisionFacts(
  question: string,
  decisionFacts: string[],
): string[] {
  const loweredQuestion = question.toLowerCase();
  const questionTokens = new Set(
    (loweredQuestion.match(/[a-z0-9-]{4,}/g) ?? []).filter(
      (token) => !new Set(["what", "with", "that", "this", "from", "have", "actually", "should"]).has(token),
    ),
  );
  const topicPatterns: RegExp[] = [];

  if (/\b(?:who|skill|qualified|qualification|without guessing|engineer|backup)\b/.test(loweredQuestion)) {
    topicPatterns.push(/engineer|skill|qualified|validated|candidate|competency|authorisation|training/i);
  }
  if (/\b(?:spare|part|stock|stopping|block|available|lead time)\b/.test(loweredQuestion)) {
    topicPatterns.push(/component|part|stock|quantity|availability|lead|work.?order|wo-/i);
  }
  if (/\b(?:run|campaign|release|proof|verify|verification)\b/.test(loweredQuestion)) {
    topicPatterns.push(/interlock|airflow|validation|challenge|approved|document|test|verification/i);
  }
  if (/\b(?:document|manual|guide|approved|procedure|drawing|history|before acting|evidence supports|verification record)\b/.test(loweredQuestion)) {
    topicPatterns.push(/document evidence|work evidence|approved|manual|guide|drawing|history|verification|fault.?finding/i);
  }
  if (/\b(?:fault|wrong|repeat|reject|problem|keep|again)\b/.test(loweredQuestion)) {
    topicPatterns.push(/fault|sensor|reject|repeat|history|work.?order|component|vacuum|condenser/i);
  }
  if (/\b(?:water|conductivity|instrument|lying|bias|sample)\b/.test(loweredQuestion)) {
    topicPatterns.push(/conductivity|bias|grab sample|calibrated|reference|sensor|water/i);
  }

  return [...new Set(decisionFacts)]
    .map((fact, index) => {
      const loweredFact = fact.toLowerCase();
      let score = /^priority /.test(loweredFact)
        ? 160
        : /^equipment:/.test(loweredFact)
          ? 40
          : 0;
      if (/[A-Z]{2,}[-0-9]{2,}/.test(fact)) score += 8;
      for (const token of questionTokens) {
        if (loweredFact.includes(token)) score += 4;
      }
      for (const pattern of topicPatterns) {
        if (pattern.test(fact)) score += 18;
      }
      return { fact, score, index };
    })
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .slice(0, 16)
    .map((item) => item.fact);
}

export function equipmentVisibleDecisionText(answer: JsonRecord): string {
  return [
    typeof answer.directAnswer === "string" ? answer.directAnswer : "",
    ...records(answer.decisionSummary).flatMap((item) => [
      typeof item.label === "string" ? item.label : "",
      typeof item.value === "string" ? item.value : "",
    ]),
    ...records(answer.findings).flatMap((item) => [
      typeof item.title === "string" ? item.title : "",
      typeof item.detail === "string" ? item.detail : "",
    ]),
    ...textValues(answer.recommendedActions),
    ...records(answer.actionPlan).flatMap((item) => [
      typeof item.action === "string" ? item.action : "",
      typeof item.expectedImpact === "string" ? item.expectedImpact : "",
      typeof item.verification === "string" ? item.verification : "",
    ]),
    ...textValues(answer.missingData),
  ]
    .filter(Boolean)
    .join(" ");
}

export function unavailableEquipmentDecisionClaim(value: string): boolean {
  return /(?:decision pack|equipment evidence|authorised result|available result)[^.]{0,120}(?:unavailable|too large|could not be analysed)|(?:cannot|can’t|can't|unable to) (?:confirm|verify|identify|support|determine)[^.]{0,120}(?:available|authorised|decision pack|evidence|result)|no authorised [^.]{0,80}(?:evidence|personnel|record)/i.test(
    value,
  );
}

export function readableEquipmentDecisionFact(fact: string): string {
  return fact
    .replace(/^priority (?:spare|capability|document) evidence:\s*/i, "")
    .replace(/^work evidence\s*/i, "work order ")
    .replace(/^document evidence:\s*/i, "")
    .replace(/^equipment:\s*/i, "")
    .replace(/\s*\|\s*/g, "; ")
    .trim();
}

export function equipmentFactCategory(fact: string): string {
  if (/capability|skill|engineer|qualified/i.test(fact)) return "skill";
  if (/spare|component|part|stock|lead time/i.test(fact)) return "spare";
  if (/document|manual|guide|drawing|procedure/i.test(fact)) return "document";
  if (/work evidence|work order|WO-/i.test(fact)) return "work";
  if (/risk|intervention|action/i.test(fact)) return "risk";
  return "data";
}

export function repairEquipmentDecisionAnswer(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
  toolOutcomes: Map<string, ToolResult>,
): void {
  if (questionPlan?.scope !== "equipment") return;
  const pack = toolOutcomes.get("get_equipment_decision_pack");
  if (
    !pack?.data ||
    typeof pack.data !== "object" ||
    Array.isArray(pack.data)
  ) {
    return;
  }

  const packData = pack.data as JsonRecord;
  const decisionFacts = textValues(packData.decisionFacts);
  if (decisionFacts.length === 0) return;
  const originalUnavailable = unavailableEquipmentDecisionClaim(
    equipmentVisibleDecisionText(answer),
  );

  const goal = String(questionPlan.decisionGoal ?? "");
  const selectedFacts = [
    ...new Set([
      ...decisionFacts.filter((fact) => /^priority /i.test(fact)),
      ...relevantEquipmentDecisionFacts(goal, decisionFacts),
      ...decisionFacts,
    ]),
  ].slice(0, 8);
  if (selectedFacts.length === 0) return;

  const loweredGoal = goal.toLowerCase();
  const capabilityFact = selectedFacts.find((fact) =>
    /priority capability evidence/i.test(fact),
  );
  const capabilitySkill =
    capabilityFact?.match(/\bskill\s+([^|;]+)/i)?.[1]?.trim().toLowerCase() ?? "";
  const asksForAllQualified =
    /\bwho is qualified\b|\bwhich engineers? (?:are|is) qualified\b/.test(
      loweredGoal,
    );
  const qualifiedCapabilityFacts = decisionFacts.filter(
    (fact) =>
      /capability evidence/i.test(fact) &&
      /\bengineer\s+/i.test(fact) &&
      /\bvalidation\s+VALIDATED\b/i.test(fact) &&
      (!capabilitySkill ||
        fact.toLowerCase().includes(`skill ${capabilitySkill}`)),
  );
  const capabilityFactsToShow = asksForAllQualified
    ? [
        ...new Set(
          [capabilityFact, ...qualifiedCapabilityFacts].filter(
            (fact): fact is string => Boolean(fact),
          ),
        ),
      ].slice(0, 3)
    : capabilityFact
      ? [capabilityFact]
      : [];
  const spareFact = selectedFacts.find((fact) =>
    /priority spare evidence/i.test(fact),
  );
  const documentFact = selectedFacts.find((fact) =>
    /priority document evidence|document evidence/i.test(fact),
  );
  const workFact = selectedFacts.find((fact) =>
    /work evidence|work.?order|WO-/i.test(fact),
  );
  const primaryFact =
    (/\b(?:who|qualified|engineer|skill|authori[sz]e|can lead|can verify)\b/.test(
      loweredGoal,
    )
      ? capabilityFact
      : undefined) ??
    (/\b(?:spare|part|stock|blocking|blocker|permanent correction|permanent repair)\b/.test(
      loweredGoal,
    )
      ? spareFact
      : undefined) ??
    (/\b(?:document|manual|approved|evidence|verification|verify|before acting|after repair)\b/.test(
      loweredGoal,
    )
      ? documentFact
      : undefined) ??
    spareFact ??
    capabilityFact ??
    documentFact ??
    workFact ??
    selectedFacts[0];
  const primaryFacts =
    asksForAllQualified && capabilityFactsToShow.length > 0
      ? capabilityFactsToShow
      : [primaryFact];
  const primaryTexts = primaryFacts.map(readableEquipmentDecisionFact);
  const primaryText = primaryTexts[0];
  const supportingFact = selectedFacts.find(
    (fact) => !primaryFacts.includes(fact),
  );
  const supportingText = supportingFact
    ? readableEquipmentDecisionFact(supportingFact)
    : "";

  if (!originalUnavailable) {
    const primaryTextSet = new Set(
      primaryTexts.map((text) => text.toLowerCase()),
    );
    const existingSummary = records(answer.decisionSummary).filter(
      (item) =>
        typeof item.value !== "string" ||
        !primaryTextSet.has(item.value.trim().toLowerCase()),
    );
    answer.decisionSummary = [
      ...primaryTexts.map((text) => ({
        label: asksForAllQualified ? "Validated capability" : "Verified evidence",
        value: text,
      })),
      ...existingSummary,
    ].slice(0, 5);

    const existingFindings = records(answer.findings).filter(
      (item) =>
        typeof item.detail !== "string" ||
        !primaryTextSet.has(item.detail.trim().toLowerCase()),
    );
    answer.findings = [
      ...primaryFacts.map((fact) => ({
        category: equipmentFactCategory(fact),
        severity: "info",
        title: "Verified decision fact",
        detail: readableEquipmentDecisionFact(fact),
      })),
      ...existingFindings,
    ].slice(0, 6);
    return;
  }

  if (/\b(?:who|qualified|engineer|skill|authori[sz]e|can lead|can verify)\b/.test(loweredGoal)) {
    answer.directAnswer = `The verified Vorta capability evidence identifies ${primaryTexts.join("; ")}.`;
  } else if (/\b(?:spare|part|stock|blocking|blocker|permanent correction|permanent repair)\b/.test(loweredGoal)) {
    answer.directAnswer = `The verified blocking-spare evidence is ${primaryText}${supportingText ? `; ${supportingText}` : ""}.`;
  } else if (/\b(?:fault|cause|diagnos|repeat|reading|instrument fault|probe disagreement)\b/.test(loweredGoal)) {
    answer.directAnswer = `The authorised diagnosis is supported by ${primaryText}${supportingText ? `; ${supportingText}` : ""}.`;
  } else if (/\b(?:verification|verify|checks? required|after repair|before production restarts|before returning|release|campaign)\b/.test(loweredGoal)) {
    answer.directAnswer = `The required equipment verification is supported by ${primaryText}${supportingText ? `; ${supportingText}` : ""}.`;
  } else {
    answer.directAnswer = `The authorised equipment evidence supports the decision: ${primaryText}${supportingText ? `; ${supportingText}` : ""}.`;
  }

  const answerFacts = [
    ...new Set([...primaryFacts, ...selectedFacts]),
  ];
  answer.decisionSummary = answerFacts.slice(0, 4).map((fact, index) => ({
    label:
      index === 0
        ? "Decision"
        : equipmentFactCategory(fact) === "spare"
          ? "Spare"
          : equipmentFactCategory(fact) === "skill"
            ? "Capability"
            : equipmentFactCategory(fact) === "document"
              ? "Approved evidence"
              : equipmentFactCategory(fact) === "work"
                ? "Work evidence"
                : "Supporting evidence",
    value: readableEquipmentDecisionFact(fact),
  }));
  answer.findings = answerFacts.slice(0, 5).map((fact, index) => ({
    category: equipmentFactCategory(fact),
    severity: index === 0 ? "high" : "info",
    title: index === 0 ? "Verified decision fact" : "Supporting Vorta evidence",
    detail: readableEquipmentDecisionFact(fact),
  }));
  answer.missingData = textValues(answer.missingData).filter(
    (item) => !unavailableEquipmentDecisionClaim(item),
  );

  if (
    questionPlan.forceActionPlan === true &&
    (records(answer.actionPlan).length === 0 || originalUnavailable)
  ) {
    const actionFact =
      selectedFacts.find((fact) =>
        /action|replace|verify|inspect|repair|order|procure/i.test(fact),
      ) ?? primaryFact;
    answer.actionPlan = [
      {
        priority: "now",
        action: readableEquipmentDecisionFact(actionFact),
        owner: "Maintenance Manager",
        expectedImpact:
          "Starts the first verified intervention supported by the current equipment evidence.",
        verification:
          "Open the linked equipment records and confirm the named part, person, work order or approved verification result before closing the decision.",
      },
    ];
  }
}

export function retainEquipmentDecisionFacts(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
  toolOutcomes: Map<string, ToolResult>,
): void {
  if (questionPlan?.scope !== "equipment") return;
  const pack = toolOutcomes.get("get_equipment_decision_pack");
  if (
    !pack?.data ||
    typeof pack.data !== "object" ||
    Array.isArray(pack.data)
  ) {
    return;
  }
  const packData = pack.data as JsonRecord;
  answer.coveredTools = textValues(packData.coveredTools);
  const decisionFacts = textValues(packData.decisionFacts);
  if (decisionFacts.length === 0) return;

  const priorityFacts = decisionFacts.filter((fact) => /^priority /i.test(fact));
  const selectedFacts = relevantEquipmentDecisionFacts(
    String(questionPlan.decisionGoal ?? ""),
    decisionFacts,
  );
  answer.evidence = [
    ...new Set([
      ...priorityFacts,
      ...selectedFacts,
      ...textValues(answer.evidence),
    ]),
  ].slice(0, 16);
}
