from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise SystemExit(f"VOR-040 patch anchor missing: {label}")
    if source.count(old) != 1:
        raise SystemExit(f"VOR-040 patch anchor not unique: {label} ({source.count(old)})")
    return source.replace(old, new, 1)


edge_path = Path("netlify/edge-functions/ask-vorta-work-backlog.ts")
edge = edge_path.read_text()

edge = replace_once(
    edge,
    '''const CAPABILITY_PATTERN = /\\b(?:one person deep|only one person|single[- ]person|single point|single[- ]point|backup sme|developed as backup|develop as backup)\\b/i;
const MIXED_DECISION_PATTERN = /\\b(?:shift|cover|rota|pm|calibration|spare|stock|part|contractor|handover|history|document|manual)\\b/i;
const EQUIPMENT_CODE_PATTERN = /\\b[A-Z]{2,}(?:-[A-Z0-9]+)*-?\\d+[A-Z0-9-]*\\b/;''',
    '''const CAPABILITY_PATTERN = /\\b(?:one person deep|only one person|single[- ]person|single point|single[- ]point|backup sme|developed as backup|develop as backup)\\b/i;
const EQUIPMENT_SPARE_FOLLOW_UP_PATTERN = /\\b(?:(?:what|which) (?:spare|part)|(?:spare|part) (?:blocks?|blocking|stops?|stopping|holds?|holding)|what is (?:blocking|stopping|holding))\\b/i;
const MIXED_DECISION_PATTERN = /\\b(?:shift|cover|rota|pm|calibration|spare|stock|part|contractor|handover|history|document|manual)\\b/i;
const EQUIPMENT_CODE_PATTERN = /\\b[A-Z]{2,}(?:-[A-Z0-9]+)*-?\\d+[A-Z0-9-]*\\b/;
const EQUIPMENT_REFERENCE_PATTERN = /\\b[A-Z]{2,}(?:-[A-Z0-9]+)*-?\\d+[A-Z0-9-]*\\b/g;''',
    "edge intent constants",
)

edge = replace_once(
    edge,
    '''function isCapabilityRequest(body: JsonRecord): boolean {
  const question = requiredText(body.question, 2_000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question || history.length > 0) return false;
  if (!CAPABILITY_PATTERN.test(question)) return false;
  if (MIXED_DECISION_PATTERN.test(question)) return false;
  if (EQUIPMENT_CODE_PATTERN.test(question)) return false;
  return true;
}

function formatEvidenceDate''',
    '''function isCapabilityRequest(body: JsonRecord): boolean {
  const question = requiredText(body.question, 2_000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question || history.length > 0) return false;
  if (!CAPABILITY_PATTERN.test(question)) return false;
  if (MIXED_DECISION_PATTERN.test(question)) return false;
  if (EQUIPMENT_CODE_PATTERN.test(question)) return false;
  return true;
}

function equipmentReferenceFromRequest(body: JsonRecord): string | null {
  const history = Array.isArray(body.history) ? body.history : [];
  const historyText = history
    .map((item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? requiredText((item as JsonRecord).content, 4_000) || ""
        : "",
    )
    .join(" ");
  const question = requiredText(body.question, 2_000) || "";
  const matches = `${historyText} ${question}`.toUpperCase().match(EQUIPMENT_REFERENCE_PATTERN);
  return matches?.at(-1) || null;
}

function isEquipmentSpareFollowUp(body: JsonRecord): boolean {
  const question = requiredText(body.question, 2_000);
  const history = Array.isArray(body.history) ? body.history : [];
  if (!question || history.length === 0) return false;
  if (!EQUIPMENT_SPARE_FOLLOW_UP_PATTERN.test(question)) return false;
  return Boolean(equipmentReferenceFromRequest(body));
}

function componentConstraintScore(component: JsonRecord): number {
  const available = numberValue(component.quantity_available);
  const minimum = numberValue(component.minimum_quantity);
  const target = numberValue(component.quantity_target);
  const shortfall = Math.max(minimum, target) - available;
  const availability = String(component.availability_status ?? "").toLowerCase();
  const criticality = String(component.criticality ?? "").toLowerCase();
  return (
    (availability.includes("out") ? 100 : 0) +
    (availability.includes("low") ? 60 : 0) +
    Math.max(0, shortfall) * 12 +
    (criticality === "critical" ? 30 : criticality === "high" ? 20 : 0) +
    Math.min(numberValue(component.lead_days), 90) / 3
  );
}

function formatEvidenceDate''',
    "edge spare-follow-up helpers",
)

edge = replace_once(
    edge,
    '''  const requestKind = isFactualBacklogRequest(record)
    ? "backlog"
    : isCapabilityRequest(record)
      ? "capability"
      : null;''',
    '''  const requestKind = isEquipmentSpareFollowUp(record)
    ? "equipment_spare"
    : isFactualBacklogRequest(record)
      ? "backlog"
      : isCapabilityRequest(record)
        ? "capability"
        : null;''',
    "edge request kind",
)

spare_branch = '''    if (requestKind === "equipment_spare") {
      const equipmentReference = equipmentReferenceFromRequest(record);
      if (!equipmentReference) return context.next(request);

      const equipmentQuery = new URLSearchParams({
        select: "id,name,equipment_code,area,criticality",
        site_id: `eq.${siteId}`,
        equipment_code: `eq.${equipmentReference}`,
        limit: "2",
      });
      const equipmentResult = await postgrestJson(
        supabaseUrl,
        `equipment_assets?${equipmentQuery}`,
        anonKey,
        bearer,
      );
      const equipment = records(equipmentResult.data)[0];
      const equipmentId = requiredText(equipment?.id, 100);
      const equipmentCode = requiredText(equipment?.equipment_code, 120) || equipmentReference;
      const equipmentName = requiredText(equipment?.name, 240) || "asset name not recorded";
      if (!equipmentResult.ok || !equipmentId) return context.next(request);

      const componentsQuery = new URLSearchParams({
        select:
          "component_name,component_code,quantity_available,quantity_target,minimum_quantity,availability_status,vendor_name,maker_name,storage_location,criticality,unit_cost,lead_days,updated_at",
        site_id: `eq.${siteId}`,
        equipment_id: `eq.${equipmentId}`,
        limit: "100",
      });
      const componentResult = await postgrestJson(
        supabaseUrl,
        `equipment_components?${componentsQuery}`,
        anonKey,
        bearer,
      );
      if (!componentResult.ok) return context.next(request);
      const rankedComponents = records(componentResult.data)
        .sort((left, right) => componentConstraintScore(right) - componentConstraintScore(left));
      const topComponent = rankedComponents[0];
      const componentCode = requiredText(topComponent?.component_code, 160);
      const componentName = requiredText(topComponent?.component_name, 260);
      if (!topComponent || (!componentCode && !componentName)) return context.next(request);

      const available = numberValue(topComponent.quantity_available);
      const minimum = numberValue(topComponent.minimum_quantity);
      const target = numberValue(topComponent.quantity_target);
      const leadDays = numberValue(topComponent.lead_days);
      const availability = requiredText(topComponent.availability_status, 120) || "status not recorded";
      const criticality = requiredText(topComponent.criticality, 120) || "criticality not recorded";
      const storageLocation = requiredText(topComponent.storage_location, 240);
      const partLabel = [componentCode, componentName].filter(Boolean).join(" · ");
      const interactionId = crypto.randomUUID();
      const questionFingerprint = await sha256Fingerprint(question.toLowerCase());

      const startResponse = await fetch(`${supabaseUrl}/rest/v1/ask_vorta_interactions`, {
        method: "POST",
        headers: supabaseHeaders(anonKey, bearer, {
          "content-type": "application/json",
          prefer: "return=minimal",
        }),
        body: JSON.stringify({
          id: interactionId,
          site_id: siteId,
          user_id: userId,
          role,
          question_fingerprint: questionFingerprint,
          status: "started",
        }),
      });
      if (!startResponse.ok) return context.next(request);

      const missingData = [
        ...(leadDays > 0 ? [] : ["A verified supplier lead time is not recorded for this spare."]),
        ...(storageLocation ? [] : ["A storage location is not recorded for this spare."]),
      ];
      const directAnswer = `${partLabel} is the highest-ranked spare constraint for ${equipmentCode} (${equipmentName}). Recorded stock is ${available} against minimum ${minimum}${target ? ` and target ${target}` : ""}; status is ${availability}${leadDays ? ` with a ${leadDays}-day lead time` : ""}.`;
      const answer = {
        directAnswer,
        decisionSummary: [
          { label: "Asset", value: `${equipmentCode} · ${equipmentName}.` },
          { label: "Blocking spare", value: partLabel },
          {
            label: "Stock position",
            value: `${available} recorded against minimum ${minimum}${target ? ` and target ${target}` : ""}; ${availability}.`,
          },
          {
            label: "Supply constraint",
            value: `${criticality}${leadDays ? ` · ${leadDays}-day lead time` : " · lead time not recorded"}${storageLocation ? ` · location ${storageLocation}` : ""}.`,
          },
        ],
        evidence: [
          `${equipmentCode}: ${partLabel}; recorded quantity ${available}, minimum ${minimum}, target ${target || "not recorded"}, availability ${availability}, criticality ${criticality}, lead time ${leadDays || "not recorded"} days.`,
        ],
        findings: [
          {
            category: "spare",
            severity: availability.toLowerCase().includes("out") ? "critical" : "high",
            title: `${equipmentCode} · ${componentCode || componentName}`,
            detail: `This is the highest-ranked recorded spare constraint for the asset based on shortage, criticality and lead time.`,
          },
        ],
        coverOptions: [],
        recommendedActions: [],
        actionPlan: [],
        followUpQuestions: [],
        sources: ["Equipment spares inventory"],
        missingData,
        confidence: missingData.length ? 78 : 88,
        intentLabel: "equipment_spare_blocker",
        toolsUsed: ["get_equipment_spares"],
        evidenceGeneratedAt:
          requiredText(topComponent.updated_at, 100) || new Date().toISOString(),
        evidenceLinks: [
          {
            label: "Open equipment spares",
            path: `/equipment/${equipmentId}?tab=spares`,
            recordType: "spare",
          },
        ],
        responseId: interactionId,
      };

      await patchInteraction(supabaseUrl, anonKey, bearer, interactionId, userId, {
        intent_label: "equipment_spare_blocker",
        tools_used: ["get_equipment_spares"],
        sources: ["Equipment spares inventory"],
        confidence: answer.confidence,
        missing_data_count: missingData.length,
        duration_ms: Date.now() - startedAt,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      return jsonResponse(answer);
    }

'''
edge = replace_once(
    edge,
    '    if (requestKind === "capability") {',
    spare_branch + '    if (requestKind === "capability") {',
    "edge direct spare branch",
)

edge_path.write_text(edge)


function_path = Path("netlify/functions/ask-vorta.mts")
function_source = function_path.read_text()

maintenance_route = '''  const maintenancePlanOnly =
    /\\b(?:pm|pms|planned maintenance|preventive maintenance|calibration|calibrations|calibrate|due next|due this week|next seven days)\\b/.test(question) &&
    !/\\b(?:cover|coverage|people|available|availability|rota|achievable|complete|slip)\\b/.test(question);
  if (maintenancePlanOnly) {
    const includesOverdue = /\\boverdue\\b/.test(question);
    const asksNextSevenDays = /\\b(?:next seven days|next 7 days)\\b/.test(question);
    return fastPlan(
      "maintenance_plan",
      "maintenance_plan",
      "get_site_maintenance_plan",
      "Report the dated PM and calibration work requested, separating overdue items from the next due work and naming the asset, due date and assignee where recorded.",
      {
        startDate: includesOverdue ? dateWithOffset(-21) : dateWithOffset(0),
        endDate: asksNextSevenDays ? dateWithOffset(7) : dateWithOffset(10),
        summaryItemLimit: 4,
      },
    );
  }

'''
function_source = replace_once(
    function_source,
    '  if (/\\b(?:backlog|open work|overdue work|unassigned work|work orders?)\\b/.test(question)) {',
    maintenance_route + '  if (/\\b(?:backlog|open work|overdue work|unassigned work|work orders?)\\b/.test(question)) {',
    "maintenance-plan-only deterministic route",
)
function_path.write_text(function_source)


contract_path = Path("scripts/vor-040-natural-question-contracts.mjs")
contract = contract_path.read_text()
contract = replace_once(
    contract,
    '  "MIXED_DECISION_PATTERN",\n  "EQUIPMENT_CODE_PATTERN",',
    '  "MIXED_DECISION_PATTERN",\n  "EQUIPMENT_CODE_PATTERN",\n  "EQUIPMENT_SPARE_FOLLOW_UP_PATTERN",\n  "isEquipmentSpareFollowUp",\n  "equipmentReferenceFromRequest",\n  "componentConstraintScore",\n  \'toolsUsed: ["get_equipment_spares"]\',\n  \'intentLabel: "equipment_spare_blocker"\',',
    "edge spare route contracts",
)
contract = replace_once(
    contract,
    'for (const assistantFeature of [\n  "normaliseEquipmentReference",',
    'for (const assistantFeature of [\n  "maintenancePlanOnly",\n  \'intentLabel: "maintenance_plan"\',\n  \'"get_site_maintenance_plan"\',\n  "normaliseEquipmentReference",',
    "maintenance plan route contracts",
)
contract_path.write_text(contract)

print("Applied direct equipment-spare follow-up and maintenance-plan-only routing.")
