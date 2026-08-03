from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"VOR-040 {label} anchor count {count}")
    return source.replace(old, new, 1)


assistant_path = Path("netlify/functions/ask-vorta.mts")
assistant = assistant_path.read_text()

helper_anchor = '''function equipmentDecisionFacts(
  selected: JsonRecord,
  domains: Record<string, JsonRecord>,
  question: string,
): string[] {'''
helper_code = '''function normalisedEvidenceTokens(value: string): string[] {
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

function evidenceTextOverlapScore(query: string, candidate: string): number {
  const queryTokens = new Set(normalisedEvidenceTokens(query));
  return normalisedEvidenceTokens(candidate).reduce(
    (score, token) => score + (queryTokens.has(token) ? 1 : 0),
    0,
  );
}

function questionMatchedEquipmentFacts(
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
    /\\b(?:spare|part|stock|stockout|out of stock|lead time|blocking|blocker|stopping|permanent correction|permanent repair|leading intervention)\\b/.test(
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
    /\\b(?:who|qualified|qualification|skill|capability|engineer|authorise|authorize|lead|calibrate|verify|diagnos)\\b/.test(
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
          const score =
            (/primary_sme/i.test(role) ? 120 : /backup_sme/i.test(role) ? 80 : 0) +
            (engineerName && workContext.includes(engineerName.toLowerCase()) ? 90 : 0) +
            (/validated/i.test(validation) ? 30 : 0) +
            numberValue(rating) * 8;
          return { engineerName, role, validation, rating, score, index };
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
    /\\b(?:document|manual|guide|approved|procedure|drawing|evidence|before acting|history)\\b/.test(
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

function equipmentDecisionFacts(
  selected: JsonRecord,
  domains: Record<string, JsonRecord>,
  question: string,
): string[] {'''
assistant = replace_once(
    assistant,
    helper_anchor,
    helper_code,
    "question-matched helper insertion",
)

assistant = replace_once(
    assistant,
    '''  const explicitFacts = explicitEquipmentDomainFacts(domains);
  const rankedFacts = collectDecisionFacts(domains)''',
    '''  const priorityFacts = questionMatchedEquipmentFacts(selected, domains, question);
  const explicitFacts = explicitEquipmentDomainFacts(domains);
  const rankedFacts = collectDecisionFacts(domains)''',
    "priority facts construction",
)

assistant = replace_once(
    assistant,
    '''      ...identity,
      ...questionRanked,''',
    '''      ...priorityFacts,
      ...identity,
      ...questionRanked,''',
    "priority facts ordering",
)

assistant = replace_once(
    assistant,
    '''      let score = /^equipment:/.test(loweredFact) ? 40 : 0;''',
    '''      let score = /^priority /.test(loweredFact)
        ? 160
        : /^equipment:/.test(loweredFact)
          ? 40
          : 0;''',
    "priority fact ranking",
)

assistant = replace_once(
    assistant,
    '''  const selectedFacts = relevantEquipmentDecisionFacts(
    String(questionPlan.decisionGoal ?? ""),
    decisionFacts,
  );
  answer.evidence = [
    ...new Set([
      ...selectedFacts,''',
    '''  const priorityFacts = decisionFacts.filter((fact) => /^priority /i.test(fact));
  const selectedFacts = relevantEquipmentDecisionFacts(
    String(questionPlan.decisionGoal ?? ""),
    decisionFacts,
  );
  answer.evidence = [
    ...new Set([
      ...priorityFacts,
      ...selectedFacts,''',
    "priority evidence retention",
)

safety_anchor = '''function textValues(value: unknown): string[] {'''
safety_code = '''function replaceReleasedWording(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\\breleased\\b/gi, "approved for return to service");
  }
  if (Array.isArray(value)) return value.map(replaceReleasedWording);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonRecord).map(([key, item]) => [
      key,
      replaceReleasedWording(item),
    ]),
  );
}

function enforceEquipmentReturnToServiceSafety(
  answer: JsonRecord,
  questionPlan: JsonRecord | null,
): void {
  if (
    questionPlan?.scope !== "equipment" ||
    !/\\breleas(?:e|ed|ing)\\b/i.test(String(questionPlan.decisionGoal ?? ""))
  ) {
    return;
  }
  for (const key of [
    "directAnswer",
    "decisionSummary",
    "evidence",
    "findings",
    "coverOptions",
    "recommendedActions",
    "actionPlan",
    "followUpQuestions",
    "missingData",
  ]) {
    answer[key] = replaceReleasedWording(answer[key]);
  }
}

function textValues(value: unknown): string[] {'''
assistant = replace_once(
    assistant,
    safety_anchor,
    safety_code,
    "return-to-service safety helper",
)

assistant = replace_once(
    assistant,
    '''        retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
        const calibratedConfidence = evidenceAwareConfidence(''',
    '''        retainEquipmentDecisionFacts(answer, questionPlan, toolOutcomes);
        enforceEquipmentReturnToServiceSafety(answer, questionPlan);
        const calibratedConfidence = evidenceAwareConfidence(''',
    "return-to-service safety invocation",
)

assistant_path.write_text(assistant)


contract_path = Path("scripts/vor-040-natural-question-contracts.mjs")
contract = contract_path.read_text()
contract = replace_once(
    contract,
    '  "relevantEquipmentDecisionFacts",\n',
    '''  "relevantEquipmentDecisionFacts",
  "questionMatchedEquipmentFacts",
  "normalisedEvidenceTokens",
  "priority spare evidence",
  "priority capability evidence",
  "priority document evidence",
  "required_skills ?? skillSummary.requiredSkills",
  "workContext.includes(engineerName.toLowerCase())",
  "before acting|work history|approved document",
  "replaceReleasedWording",
  "approved for return to service",
  "enforceEquipmentReturnToServiceSafety(answer, questionPlan)",
''',
    "permanent question-matched contracts",
)
contract_path.write_text(contract)

print("Applied question-matched equipment evidence and return-to-service safety.")
