import { supabase } from "../../lib/supabaseClient";
import type { LiveDataState } from "./equipmentLiveTrust";

export type LiveDocumentCoverageMode =
  | "full_text"
  | "summary_only"
  | "unavailable";

export interface LiveEquipmentDocumentSummary {
  documentId: string;
  title: string;
  documentType: string;
  revision: string | null;
  approvalStatus: string;
  isCurrent: boolean;
  effectiveDate: string | null;
  ownerDepartment: string | null;
  summary: string | null;
  sourceSystem: string;
  sourceDocumentId: string;
  sourcePath: string | null;
  sourceUrl: string | null;
  fileId: string | null;
  externalReference: string | null;
  drawingNumber: string | null;
  sheetNumber: string | null;
  manualSection: string | null;
  pageNumber: number | null;
  faultCodes: string[];
  componentTags: string[];
  oem: string | null;
  status: string;
  lastIndexedAt: string | null;
  updatedAt: string;
  chunkCount: number;
  firstSectionTitle: string | null;
  firstPageNumber: number | null;
  coverageMode: LiveDocumentCoverageMode;
  fullDocumentIndexed: boolean;
  hasVerifiedLocator: boolean;
  coverageReason: string;
}

export interface LiveEquipmentDocumentChunk {
  id: string;
  reference: string;
  sectionTitle: string | null;
  text: string;
  pageNumber: number | null;
  keywords: string[];
  drawingNumber: string | null;
  sheetNumber: string | null;
  faultCodes: string[];
  componentTags: string[];
  sourceUrl: string | null;
  externalReference: string | null;
}

export interface LiveEquipmentDocument extends LiveEquipmentDocumentSummary {
  chunks: LiveEquipmentDocumentChunk[];
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is Record<string, unknown> =>
        typeof row === "object" && row !== null,
    );
  }
  return typeof value === "object" && value !== null
    ? [value as Record<string, unknown>]
    : [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).filter(
    (item): item is string => typeof item === "string",
  );
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function resolveCoverageMode(
  value: unknown,
  chunkCount: number,
): LiveDocumentCoverageMode {
  if (value === "full_text" || value === "summary_only" || value === "unavailable") {
    return value;
  }
  return chunkCount > 0 ? "full_text" : "unavailable";
}

function defaultCoverageReason(mode: LiveDocumentCoverageMode): string {
  if (mode === "summary_only") {
    return "Only the approved document summary is indexed; the full source text is not indexed.";
  }
  if (mode === "full_text") {
    return "Approved full-text evidence sections are indexed and citation-ready.";
  }
  return "No authorised evidence chunks are indexed for this document.";
}

function mapDocumentSummary(
  row: Record<string, unknown>,
): LiveEquipmentDocumentSummary {
  const chunkCount = numberValue(row.chunk_count) ?? 0;
  const coverageMode = resolveCoverageMode(row.coverage_mode, chunkCount);

  return {
    documentId: String(row.document_id ?? ""),
    title: String(row.title ?? "Untitled document"),
    documentType: String(row.document_type ?? "Document"),
    revision: stringValue(row.revision),
    approvalStatus: String(row.approval_status ?? "Unknown"),
    isCurrent: booleanValue(row.is_current) ?? false,
    effectiveDate: stringValue(row.effective_date),
    ownerDepartment: stringValue(row.owner_department),
    summary: stringValue(row.summary),
    sourceSystem: String(row.source_system ?? "Unknown"),
    sourceDocumentId: String(row.source_document_id ?? ""),
    sourcePath: stringValue(row.source_path),
    sourceUrl: stringValue(row.source_url),
    fileId: stringValue(row.file_id),
    externalReference: stringValue(row.external_reference),
    drawingNumber: stringValue(row.drawing_number),
    sheetNumber: stringValue(row.sheet_number),
    manualSection: stringValue(row.manual_section),
    pageNumber: numberValue(row.page_number),
    faultCodes: asStringArray(row.fault_codes),
    componentTags: asStringArray(row.component_tags),
    oem: stringValue(row.oem),
    status: String(row.status ?? "Unknown"),
    lastIndexedAt: stringValue(row.last_indexed_at),
    updatedAt: String(row.updated_at ?? ""),
    chunkCount,
    firstSectionTitle: stringValue(row.first_section_title),
    firstPageNumber: numberValue(row.first_page_number),
    coverageMode,
    fullDocumentIndexed:
      booleanValue(row.full_document_indexed) ?? coverageMode === "full_text",
    hasVerifiedLocator: booleanValue(row.has_verified_locator) ?? false,
    coverageReason:
      stringValue(row.coverage_reason) ?? defaultCoverageReason(coverageMode),
  };
}

function mapDocumentChunk(
  value: unknown,
): LiveEquipmentDocumentChunk | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    reference: String(row.reference ?? "Evidence section"),
    sectionTitle: stringValue(row.sectionTitle),
    text: String(row.text ?? ""),
    pageNumber: numberValue(row.pageNumber),
    keywords: asStringArray(row.keywords),
    drawingNumber: stringValue(row.drawingNumber),
    sheetNumber: stringValue(row.sheetNumber),
    faultCodes: asStringArray(row.faultCodes),
    componentTags: asStringArray(row.componentTags),
    sourceUrl: stringValue(row.sourceUrl),
    externalReference: stringValue(row.externalReference),
  };
}

function failure<T>(error: unknown, fallback: string): LiveDataState<T> {
  return {
    status: "unavailable",
    message: error instanceof Error ? error.message : fallback,
  };
}

export async function loadLiveEquipmentDocuments(
  equipmentId: string,
): Promise<LiveDataState<LiveEquipmentDocumentSummary[]>> {
  if (!equipmentId) {
    return {
      status: "unavailable",
      message: "No equipment identifier was supplied.",
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      "vorta_get_equipment_documents",
      { p_equipment_id: equipmentId },
    );
    if (error) {
      throw new Error(`Controlled documents could not be loaded: ${error.message}`);
    }
    const rows = asRows(data);
    if (!rows.length) {
      return {
        status: "empty",
        message: "No controlled documents are available for this equipment and active site.",
      };
    }
    return { status: "ready", data: rows.map(mapDocumentSummary) };
  } catch (error) {
    return failure(error, "Controlled documents could not be loaded.");
  }
}

export async function loadLiveEquipmentDocument(
  equipmentId: string,
  documentId: string,
): Promise<LiveDataState<LiveEquipmentDocument>> {
  if (!equipmentId || !documentId) {
    return {
      status: "unavailable",
      message: "An equipment and document identifier are required.",
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      "vorta_get_equipment_document",
      {
        p_equipment_id: equipmentId,
        p_document_id: documentId,
      },
    );
    if (error) {
      throw new Error(`The controlled document could not be opened: ${error.message}`);
    }
    const row = asRows(data)[0];
    if (!row) {
      return {
        status: "empty",
        message: "This document is not available for the authorised equipment and site.",
      };
    }

    const rawChunks = asArray(row.chunks);
    const firstChunk =
      typeof rawChunks[0] === "object" && rawChunks[0] !== null
        ? (rawChunks[0] as Record<string, unknown>)
        : null;

    return {
      status: "ready",
      data: {
        ...mapDocumentSummary({
          ...row,
          chunk_count: rawChunks.length,
          first_section_title: firstChunk?.sectionTitle ?? null,
          first_page_number: firstChunk?.pageNumber ?? null,
        }),
        chunks: rawChunks
          .map(mapDocumentChunk)
          .filter(
            (item): item is LiveEquipmentDocumentChunk => Boolean(item),
          ),
      },
    };
  } catch (error) {
    return failure(error, "The controlled document could not be opened.");
  }
}

export function buildDocumentCitation(
  document: LiveEquipmentDocumentSummary,
): string {
  const coverage =
    document.coverageMode === "summary_only"
      ? "summary-only coverage; full source text not indexed"
      : document.coverageMode === "full_text"
        ? "full-text indexed"
        : "indexed evidence unavailable";

  return [
    document.title,
    document.revision ? `rev ${document.revision}` : null,
    document.externalReference ?? document.sourceDocumentId,
    document.firstPageNumber ? `page ${document.firstPageNumber}` : null,
    coverage,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}
