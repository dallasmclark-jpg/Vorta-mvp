import type { Context } from "@netlify/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import coreHandler, {
  ASK_VORTA_BACKTEST_REVISION,
} from "./runtime-backtest.mjs";
import { authenticateAskVortaRequest } from "./authenticated-context.mjs";
import type { JsonRecord } from "./contracts.mjs";
import {
  answerDocumentEvidenceText,
  answerReferencesDocuments,
  buildDocumentEvidenceLinks,
  equipmentCodeFromAnswer,
  equipmentIdFromAnswer,
  mergeEvidenceLinks,
} from "./document-evidence-links.mjs";
import { withAskVortaDocumentOrigin } from "./document-link-origin.mjs";
import { jsonResponse, parseRequest } from "./request-context.mjs";

export const ASK_VORTA_DOCUMENT_LINK_REVISION =
  "vor-067-production-chat-return-v3";

if (ASK_VORTA_BACKTEST_REVISION !== "vor-069-historical-backtest-intelligence-v1") {
  throw new Error("Ask Vorta historical backtest runtime revision mismatch.");
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonRecord =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function textValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function visibleOperationalText(answer: JsonRecord): string {
  return JSON.stringify([
    answer.directAnswer,
    answer.decisionSummary,
    answer.findings,
    answer.recommendedActions,
  ]);
}

function visibleWorkOrderId(answer: JsonRecord): string | null {
  return visibleOperationalText(answer).match(/\bWO-\d{4,}\b/i)?.[0]?.toUpperCase() ?? null;
}

function requiresBacklogActionPlan(question: string): boolean {
  const mentionsBacklog = /\bbacklog\b/i.test(question);
  const mentionsBacklogState = /\b(?:overdue|unassigned)\b/i.test(question);
  const mentionsWorkOrders = /\bwork(?:\s+orders?)?\b/i.test(question);
  return mentionsBacklog || (mentionsBacklogState && mentionsWorkOrders);
}

function requiresHandoverActionPlan(question: string): boolean {
  return /\bhandover\b/i.test(question);
}

export function enforceFinalOperationalActionPlan(
  answer: JsonRecord,
  question: string,
): boolean {
  if (records(answer.actionPlan).length > 0) return false;

  const workOrderId = visibleWorkOrderId(answer);
  if (!workOrderId) return false;

  const backlog = requiresBacklogActionPlan(question);
  const handover = requiresHandoverActionPlan(question);
  if (!backlog && !handover) return false;

  const action = backlog
    ? `Review ${workOrderId} against the authorised SAP-backed work-order evidence, confirm readiness, assignee, due date and sequence, then have the Maintenance Planner make any required record change in SAP.`
    : `Review ${workOrderId}'s authorised SAP-backed status and blocker, assign the next follow-up outside Vorta, and carry the item into the next shift handover until the blocker is resolved.`;

  const existingRecommendations = textValues(answer.recommendedActions).filter(
    (item) => item !== action,
  );
  answer.recommendedActions = [action, ...existingRecommendations].slice(0, 4);
  answer.actionPlan = [
    {
      priority: "now",
      action,
      owner: "Maintenance Manager / Planner",
      expectedImpact: backlog
        ? "Moves the highest-priority evidenced work-order risk toward an owned, executable maintenance plan."
        : "Makes the evidenced handover blocker explicit and gives the next shift an owned follow-up without creating a parallel operational record.",
      verification: backlog
        ? `Open the authorised ${workOrderId} evidence and confirm readiness, assignee, due date and sequence are recorded in SAP by an authorised user.`
        : `Open the authorised ${workOrderId} evidence and confirm the blocker, owner and next action are reflected in the SAP work order or approved shift-handover evidence.`,
    },
  ];
  return true;
}

async function resolveEquipmentId(
  answer: JsonRecord,
  supabase: SupabaseClient,
  siteId: string,
): Promise<string | null> {
  const directId = equipmentIdFromAnswer(answer);
  if (directId) return directId;

  const equipmentCode = equipmentCodeFromAnswer(answer);
  if (!equipmentCode) return null;
  const { data, error } = await supabase
    .from("equipment_assets")
    .select("id")
    .eq("site_id", siteId)
    .eq("equipment_code", equipmentCode)
    .maybeSingle();
  if (error || typeof data?.id !== "string") return null;
  return data.id;
}

export default async function documentLinkHandler(
  req: Request,
  context: Context,
): Promise<Response> {
  const primaryRequest = req.clone();
  const evidenceRequest = req.clone();
  const primaryResponse = await coreHandler(primaryRequest, context);
  if (!primaryResponse.ok) return primaryResponse;

  const answer = record(
    await primaryResponse
      .clone()
      .json()
      .catch(() => null),
  );
  if (!answer) return primaryResponse;

  const finalRequest = parseRequest(
    await evidenceRequest
      .clone()
      .json()
      .catch(() => null),
  );
  const actionPlanRepaired = finalRequest
    ? enforceFinalOperationalActionPlan(answer, finalRequest.question)
    : false;
  const responseWithFinalGuard = () =>
    actionPlanRepaired
      ? jsonResponse(answer, primaryResponse.status)
      : primaryResponse;

  const authenticated = await authenticateAskVortaRequest(evidenceRequest);
  if (!authenticated.ok) return responseWithFinalGuard();
  const { request, supabase } = authenticated;

  const evidenceText = answerDocumentEvidenceText(answer, request.question);
  if (!answerReferencesDocuments(evidenceText)) return responseWithFinalGuard();

  const equipmentId = await resolveEquipmentId(
    answer,
    supabase,
    request.siteId,
  );
  if (!equipmentId) return responseWithFinalGuard();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id,title,document_type,revision,approval_status,is_current,manual_section,page_number,drawing_number,sheet_number,source_url,external_reference,fault_codes,component_tags,summary,extracted_summary",
    )
    .eq("site_id", request.siteId)
    .eq("equipment_id", equipmentId)
    .eq("is_current", true)
    .ilike("approval_status", "approved")
    .limit(24);
  if (error || !Array.isArray(data) || data.length === 0) {
    return responseWithFinalGuard();
  }

  const documentLinks = buildDocumentEvidenceLinks(
    data as JsonRecord[],
    evidenceText,
  ).map((link) => ({
    ...link,
    path: withAskVortaDocumentOrigin(link.path),
  }));
  if (documentLinks.length === 0) return responseWithFinalGuard();

  answer.evidenceLinks = mergeEvidenceLinks(
    documentLinks,
    answer.evidenceLinks,
  );
  return jsonResponse(answer, primaryResponse.status);
}
