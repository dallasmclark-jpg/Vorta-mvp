from pathlib import Path

path = Path("netlify/functions/ask-vorta.mts")
source = path.read_text()

anchor = '''function equipmentDecisionFacts(
  selected: JsonRecord,
  domains: Record<string, JsonRecord>,
  question: string,
): string[] {'''
helper = '''function nestedDecisionRecords(value: unknown, depth = 0): JsonRecord[] {
  if (depth > 6 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.slice(0, 120).flatMap((item) => nestedDecisionRecords(item, depth + 1));
  }
  if (typeof value !== "object") return [];
  const record = value as JsonRecord;
  return [
    record,
    ...Object.values(record)
      .slice(0, 100)
      .flatMap((item) => nestedDecisionRecords(item, depth + 1)),
  ];
}

function decisionField(record: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      const text = value
        .filter((item) => typeof item === "string" || typeof item === "number")
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
        .join(", ");
      if (text) return text;
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

function explicitEquipmentDomainFacts(
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

  for (const record of nestedDecisionRecords(domains.get_equipment_documents?.data).slice(0, 120)) {
    const title = decisionField(record, ["title", "document_title", "documentTitle"]);
    const approval = decisionField(record, ["approval_status", "approvalStatus", "status"]);
    const revision = decisionField(record, ["revision"]);
    const section = decisionField(record, ["manual_section", "manualSection", "first_section_title", "firstSectionTitle"]);
    const page = decisionField(record, ["page_number", "pageNumber", "first_page_number", "firstPageNumber"]);
    const faultCodes = decisionField(record, ["fault_codes", "faultCodes"]);
    const summary = decisionField(record, ["summary", "extracted_summary", "extractedSummary"]);
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

'''
if helper.strip() not in source:
    if anchor not in source:
        raise SystemExit("equipmentDecisionFacts anchor missing")
    source = source.replace(anchor, helper + anchor, 1)

old_block = '''  const rankedFacts = collectDecisionFacts(domains)
    .sort((first, second) => second.score - first.score)
    .map((item) => item.text);
  const questionRanked = relevantEquipmentDecisionFacts(question, rankedFacts);
  return [
    ...new Set([
      ...identity,
      ...questionRanked,
      ...rankedFacts.slice(0, 28),
    ]),
  ].slice(0, 48);'''
new_block = '''  const explicitFacts = explicitEquipmentDomainFacts(domains);
  const rankedFacts = collectDecisionFacts(domains)
    .sort((first, second) => second.score - first.score)
    .map((item) => item.text);
  const questionRanked = relevantEquipmentDecisionFacts(
    question,
    [...explicitFacts, ...rankedFacts],
  );
  return [
    ...new Set([
      ...identity,
      ...questionRanked,
      ...explicitFacts.slice(0, 32),
      ...rankedFacts.slice(0, 24),
    ]),
  ].slice(0, 64);'''
if old_block not in source:
    raise SystemExit("equipmentDecisionFacts body anchor missing")
source = source.replace(old_block, new_block, 1)

old_order = '''      ...textValues(answer.evidence),
      ...selectedFacts,'''
new_order = '''      ...selectedFacts,
      ...textValues(answer.evidence),'''
if old_order not in source:
    raise SystemExit("retained evidence ordering anchor missing")
source = source.replace(old_order, new_order, 1)

path.write_text(source)
print("Applied explicit domain fact extraction and selected-first retention.")
