import type { Context } from "@netlify/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import coreHandler from "./runtime-equipment-fallback.mjs";
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
import { jsonResponse } from "./request-context.mjs";

export const ASK_VORTA_DOCUMENT_LINK_REVISION =
  "vor-049-exact-document-deep-links-v1";

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
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

  const authenticated = await authenticateAskVortaRequest(evidenceRequest);
  if (!authenticated.ok) return primaryResponse;
  const { request, supabase } = authenticated;

  const evidenceText = answerDocumentEvidenceText(answer, request.question);
  if (!answerReferencesDocuments(evidenceText)) return primaryResponse;

  const equipmentId = await resolveEquipmentId(
    answer,
    supabase,
    request.siteId,
  );
  if (!equipmentId) return primaryResponse;

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
    return primaryResponse;
  }

  const documentLinks = buildDocumentEvidenceLinks(
    data as JsonRecord[],
    evidenceText,
  );
  if (documentLinks.length === 0) return primaryResponse;

  answer.evidenceLinks = mergeEvidenceLinks(
    documentLinks,
    answer.evidenceLinks,
  );
  return jsonResponse(answer, primaryResponse.status);
}
