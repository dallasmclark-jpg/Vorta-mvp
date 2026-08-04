import {
  safeAskVortaImageMetadata,
  validateAskVortaImage,
} from "../_shared/askVortaImageEvidence.mjs";
import {
  contextResolutionPrompt,
  createConversationContext,
  resolveConversationFollowUp,
  sanitizeConversationContext,
} from "../_shared/askVortaConversationContext.mjs";
import type {
  ConversationContext,
  ConversationContextOption,
  ConversationContextResolution,
  ConversationContextSubject,
} from "../_shared/askVortaConversationContext.mjs";
import type { AskVortaRequest, JsonRecord, RequestHistoryItem, ToolResult } from "./contracts.mjs";
import { ALLOWED_ROLES } from "./contracts.mjs";
import { firstDecisionNumber, operationalDomainData, outcomeData } from "./decision-answer.mjs";
import { equipmentId, numberValue, records, requiredText, textValues } from "./utilities.mjs";

export function equipmentReferenceFromQuestion(question: string): string {
  const explicitCode = question.match(/\b[A-Z]{2,8}-\d{1,6}\b/i)?.[0];
  return explicitCode ? explicitCode.toUpperCase() : "";
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function parseRequest(value: unknown): AskVortaRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as JsonRecord;
  const conversationContext = sanitizeConversationContext(record.conversationContext);
  const imageValidation = record.image == null
    ? null
    : validateAskVortaImage(record.image);
  if (imageValidation && !imageValidation.ok) return null;
  const image = imageValidation?.ok ? imageValidation.image : null;
  const question = requiredText(record.question, 2_000);
  const siteId = requiredText(record.siteId, 100);
  const rawRole = requiredText(record.role, 80);
  const role = rawRole && ALLOWED_ROLES.has(rawRole) ? rawRole : null;
  const rawHistory = Array.isArray(record.history) ? record.history.slice(-12) : [];
  const history: RequestHistoryItem[] = rawHistory.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as JsonRecord;
    const content = requiredText(row.content, 4_000);
    const historyRole = row.role === "user" || row.role === "assistant" ? row.role : null;
    return content && historyRole ? [{ role: historyRole, content }] : [];
  });
  const rawPageContext =
    record.pageContext && typeof record.pageContext === "object" && !Array.isArray(record.pageContext)
      ? (record.pageContext as JsonRecord)
      : {};

  if (!question || !siteId || !role) return null;

  return {
    question,
    siteId,
    role,
    history,
    conversationContext,
    image,
    pageContext: {
      path: requiredText(rawPageContext.path, 300) ?? "/",
      timezone: requiredText(rawPageContext.timezone, 100) ?? "Europe/London",
    },
  };
}

export function conversationSubject(scopeValue: unknown): ConversationContextSubject {
  const scope = typeof scopeValue === "string" ? scopeValue : "mixed";
  const mapping: Record<string, ConversationContextSubject> = {
    site: "site",
    site_risk: "risk",
    site_priorities: "site_priorities",
    equipment: "equipment",
    shift_cover: "shift_cover",
    maintenance_plan: "maintenance_plan",
    spares: "spares",
    documents: "documents",
    work: "work",
    skills: "skills",
    handover: "handover",
    risk: "risk",
    clarification: "mixed",
  };
  return mapping[scope] ?? "mixed";
}

export function enrichQuestionWithConversationContext(
  question: string,
  resolution: ConversationContextResolution,
): string {
  if (!resolution.usedContext) return question;
  const additions: string[] = [];
  if (resolution.selectedOption) {
    additions.push(
      "Selected prior option " +
        resolution.selectedOption.position +
        ": " +
        resolution.selectedOption.label +
        (resolution.selectedOption.value ? ". " + resolution.selectedOption.value : ""),
    );
  }
  if (resolution.activeEquipmentQuery) {
    additions.push("Resolved equipment: " + resolution.activeEquipmentQuery + ".");
  }
  if (resolution.inheritedSubject) {
    additions.push(
      "Continue the prior " + resolution.inheritedSubject.replace(/_/g, " ") + " decision.",
    );
  }
  if (resolution.inheritedDateRange) {
    additions.push(
      "Use the inherited date range " +
        resolution.inheritedDateRange.startDate +
        " to " +
        resolution.inheritedDateRange.endDate +
        " in " +
        resolution.inheritedDateRange.timezone +
        ".",
    );
  }
  return additions.length
    ? question + "\n\nValidated structured follow-up context: " + additions.join(" ")
    : question;
}

export function contextRecords(value: unknown, depth = 0): JsonRecord[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => contextRecords(item, depth + 1));
  }
  if (typeof value !== "object") return [];
  const record = value as JsonRecord;
  return [
    record,
    ...Object.values(record).flatMap((item) => contextRecords(item, depth + 1)),
  ];
}

export function contextField(record: JsonRecord | undefined, keys: string[]): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function rankedActionContextOptions(
  outcomes: Map<string, ToolResult>,
): ConversationContextOption[] {
  const siteSnapshot = outcomeData(outcomes, "get_site_operational_snapshot");
  const siteRanked = operationalDomainData(siteSnapshot, "rankedActions");
  const equipmentRanked = outcomeData(outcomes, "get_equipment_risk_actions");
  const candidates = [
    ...contextRecords(siteRanked),
    ...contextRecords(equipmentRanked),
  ]
    .filter((item) =>
      Boolean(
        item.action_rank ??
          item.actionRank ??
          item.operational_value_score ??
          item.operationalValueScore,
      ),
    )
    .sort(
      (first, second) =>
        numberValue(first.action_rank ?? first.actionRank) -
        numberValue(second.action_rank ?? second.actionRank),
    );
  const seen = new Set<string>();
  return candidates.flatMap((item, index): ConversationContextOption[] => {
    const equipmentCode = contextField(item, ["equipment_code", "equipmentCode"]);
    const equipmentName = contextField(item, ["equipment_name", "equipmentName"]);
    const equipmentId = contextField(item, ["equipment_id", "equipmentId"]);
    const workOrder = contextField(item, ["work_order_number", "workOrderNumber"]);
    const actionTitle = contextField(item, ["action_title", "actionTitle"]);
    const key = [workOrder, equipmentCode, actionTitle].filter(Boolean).join("|");
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const currentRisk = firstDecisionNumber(item, ["current_risk_score", "currentRiskScore"]);
    const projectedRisk = firstDecisionNumber(item, ["projected_risk_score", "projectedRiskScore"]);
    const value = firstDecisionNumber(item, ["operational_value_score", "operationalValueScore"]);
    return [{
      position: index + 1,
      type: "ranked_action",
      label: [workOrder, equipmentCode || equipmentName, actionTitle].filter(Boolean).join(" · "),
      ...(equipmentCode || equipmentName
        ? { equipmentQuery: equipmentCode || equipmentName }
        : {}),
      ...(equipmentId ? { equipmentId } : {}),
      ...(workOrder ? { reference: workOrder } : {}),
      value: [
        value !== null ? "Operational value " + value.toFixed(1) + "/100" : "",
        currentRisk !== null && projectedRisk !== null
          ? "Risk " + currentRisk.toFixed(1) + " to " + projectedRisk.toFixed(1)
          : "",
      ].filter(Boolean).join("; "),
    }];
  }).slice(0, 8).map((item, index) => ({ ...item, position: index + 1 }));
}

export function answerContextOptions(
  answer: JsonRecord,
  outcomes: Map<string, ToolResult>,
): ConversationContextOption[] {
  const ranked = rankedActionContextOptions(outcomes);
  if (ranked.length) return ranked;

  const cover = records(answer.coverOptions).slice(0, 8).map((item, index) => ({
    position: index + 1,
    type: "cover" as const,
    label: [
      "Cover option " + (index + 1),
      textValues(item.engineerNames).join(" + "),
      contextField(item, ["shift"]),
    ].filter(Boolean).join(" · "),
    value: [
      contextField(item, ["projectedImpact"]),
      contextField(item, ["remainingRisk"]),
    ].filter(Boolean).join("; "),
  }));
  if (cover.length) return cover;

  const spareCandidates = contextRecords(outcomeData(outcomes, "get_site_spares_risk"))
    .filter((item) =>
      Boolean(
        item.part_number ??
          item.partNumber ??
          item.component_code ??
          item.componentCode ??
          item.spare_part_number,
      ),
    )
    .slice(0, 8)
    .map((item, index) => {
      const part = contextField(item, [
        "part_number",
        "partNumber",
        "component_code",
        "componentCode",
        "spare_part_number",
      ]);
      const description = contextField(item, ["description", "name", "component_name"]);
      const equipment = contextField(item, ["equipment_code", "equipmentCode", "equipment_name"]);
      return {
        position: index + 1,
        type: "spare" as const,
        label: [part, description, equipment].filter(Boolean).join(" · "),
        ...(equipment ? { equipmentQuery: equipment } : {}),
        ...(part ? { reference: part } : {}),
      };
    });
  if (spareCandidates.length) return spareCandidates;

  const documentCandidates = [
    ...contextRecords(outcomeData(outcomes, "search_maintenance_documents")),
    ...contextRecords(outcomeData(outcomes, "get_equipment_documents")),
  ]
    .filter((item) => Boolean(item.title ?? item.document_title ?? item.documentTitle))
    .slice(0, 8)
    .map((item, index) => {
      const title = contextField(item, ["title", "document_title", "documentTitle"]);
      const revision = contextField(item, ["revision"]);
      const equipment = contextField(item, ["equipment_code", "equipmentCode", "equipment_name"]);
      return {
        position: index + 1,
        type: "document" as const,
        label: [title, revision ? "Revision " + revision : ""].filter(Boolean).join(" · "),
        ...(equipment ? { equipmentQuery: equipment } : {}),
        reference: contextField(item, ["external_reference", "externalReference", "source_url", "sourceUrl"]),
      };
    });
  if (documentCandidates.length) return documentCandidates;

  return records(answer.actionPlan).slice(0, 8).map((item, index) => ({
    position: index + 1,
    type: "work" as const,
    label: contextField(item, ["action"]) || "Action " + (index + 1),
    value: [
      contextField(item, ["owner"]),
      contextField(item, ["expectedImpact"]),
    ].filter(Boolean).join("; "),
  }));
}

export function buildConversationContext(
  request: AskVortaRequest,
  questionPlan: JsonRecord | null,
  outcomes: Map<string, ToolResult>,
  answer: JsonRecord,
  resolution: ConversationContextResolution,
): ConversationContext | null {
  const previous = resolution.context ?? request.conversationContext;
  const evidenceRecords = [
    ...contextRecords(outcomeData(outcomes, "get_equipment_decision_pack")),
    ...contextRecords(outcomeData(outcomes, "get_equipment_risk_actions")),
    ...contextRecords(outcomeData(outcomes, "get_equipment_risk")),
    ...contextRecords(outcomeData(outcomes, "search_maintenance_documents")),
  ];
  const evidenceEquipment = evidenceRecords.find((item) =>
    Boolean(
      item.equipment_code ??
        item.equipmentCode ??
        item.equipment_name ??
        item.equipmentName ??
        item.equipment_id ??
        item.equipmentId,
    ),
  );
  const explicitEquipment = equipmentReferenceFromQuestion(request.question);
  const selectedEquipment = resolution.selectedOption?.equipmentQuery ?? "";
  const evidenceCode = contextField(evidenceEquipment, ["equipment_code", "equipmentCode", "code"]);
  const evidenceName = contextField(evidenceEquipment, ["equipment_name", "equipmentName", "name"]);
  const evidenceId = contextField(evidenceEquipment, ["equipment_id", "equipmentId", "id"]);
  const activeQuery =
    explicitEquipment ||
    selectedEquipment ||
    evidenceCode ||
    evidenceName ||
    (resolution.usedContext ? previous?.activeEquipment?.query ?? "" : "");
  const activeEquipment = activeQuery
    ? {
        query: activeQuery,
        ...(evidenceId ? { id: evidenceId } : previous?.activeEquipment?.id ? { id: previous.activeEquipment.id } : {}),
        ...(evidenceCode ? { code: evidenceCode } : previous?.activeEquipment?.code ? { code: previous.activeEquipment.code } : {}),
        ...(evidenceName ? { name: evidenceName } : previous?.activeEquipment?.name ? { name: previous.activeEquipment.name } : {}),
      }
    : null;
  const area =
    contextField(evidenceEquipment, ["area", "area_name", "areaName"]) ||
    (resolution.usedContext ? previous?.area ?? "" : "") ||
    null;
  const startDate = typeof questionPlan?.startDate === "string" ? questionPlan.startDate : "";
  const endDate = typeof questionPlan?.endDate === "string" ? questionPlan.endDate : "";
  const plannedDateRange = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ? { startDate, endDate, timezone: request.pageContext.timezone }
    : null;
  const generatedOptions = answerContextOptions(answer, outcomes);
  const orderedOptions = generatedOptions.length
    ? generatedOptions
    : resolution.usedContext
      ? previous?.orderedOptions ?? []
      : [];
  const selectedOption = resolution.selectedOption
    ? orderedOptions.find((item) => item.position === resolution.selectedOption?.position) ?? resolution.selectedOption
    : null;
  const firstCover = records(answer.coverOptions)[0];
  const shiftLabel = contextField(firstCover, ["shift"]);
  const context = createConversationContext({
    version: 1,
    subject: conversationSubject(questionPlan?.scope ?? resolution.inheritedSubject ?? previous?.subject),
    intent:
      (typeof answer.intentLabel === "string" && answer.intentLabel.trim()) ||
      (typeof questionPlan?.intentLabel === "string" && questionPlan.intentLabel.trim()) ||
      previous?.intent ||
      "Vorta follow-up",
    activeEquipment,
    area,
    shift: shiftLabel ? { type: shiftLabel } : resolution.usedContext ? previous?.shift : null,
    dateRange: plannedDateRange ?? (resolution.usedContext ? previous?.dateRange : null),
    orderedOptions,
    selectedOption,
    updatedAt:
      typeof answer.evidenceGeneratedAt === "string"
        ? answer.evidenceGeneratedAt
        : new Date().toISOString(),
  });
  return context ?? previous ?? null;
}
