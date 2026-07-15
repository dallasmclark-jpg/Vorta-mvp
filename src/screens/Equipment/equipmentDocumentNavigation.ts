import type { EquipmentDocument } from "./equipmentTypes";

export function buildEquipmentDocumentViewerUrl(
  equipmentId: string,
  documentId: string,
  pageNumber?: number | null,
  section?: string | null,
): string {
  const params = new URLSearchParams();
  if (pageNumber != null && Number.isFinite(pageNumber)) {
    params.set("page", String(Math.max(1, Math.round(pageNumber))));
  }
  if (section?.trim()) params.set("section", section.trim());
  const query = params.toString();
  return `/equipment/${equipmentId}/documents/${documentId}${query ? `?${query}` : ""}`;
}

export function equipmentDocumentViewerUrl(
  equipmentId: string,
  document: Pick<
    EquipmentDocument,
    "id" | "pageNumber" | "manualSection"
  >,
): string {
  return buildEquipmentDocumentViewerUrl(
    equipmentId,
    document.id,
    document.pageNumber,
    document.manualSection,
  );
}

export function isBrowserSafeDocumentUrl(
  value: string | null | undefined,
): boolean {
  return Boolean(value && /^https?:\/\//i.test(value));
}
