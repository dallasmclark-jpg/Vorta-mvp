export const ASK_VORTA_DOCUMENT_ORIGIN = "ai";

export function withAskVortaDocumentOrigin(path: string): string {
  const [pathname, rawQuery = ""] = path.split("?", 2);
  const params = new URLSearchParams(rawQuery);
  params.set("from", ASK_VORTA_DOCUMENT_ORIGIN);
  const query = params.toString();
  return query ? `${pathname}?${query}` : `${pathname}?from=${ASK_VORTA_DOCUMENT_ORIGIN}`;
}
