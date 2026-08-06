import type { EvidenceLink, JsonRecord } from "./contracts.mjs";

const DOCUMENT_PATH_PATTERN =
  /^\/equipment\/[^/?#]+\/documents\/[^/?#]+(?:\?page=\d+)?$/i;

const DOCUMENT_TERMS_PATTERN =
  /\b(?:approved|document|manual|guide|drawing|fault tree|page|section|sheet|revision|evidence)\b/i;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "approved",
  "before",
  "bosch",
  "document",
  "drawing",
  "equipment",
  "evidence",
  "fault",
  "filler",
  "filling",
  "guide",
  "issue",
  "manual",
  "page",
  "section",
  "sensor",
  "sheet",
  "should",
  "station",
  "this",
  "vial",
  "with",
]);

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : "";
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function answerFindingText(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const finding = record(item);
        return finding
          ? [stringValue(finding.title), stringValue(finding.detail)].filter(Boolean)
          : [];
      })
    : [];
}

function normalisedTokens(value: string): string[] {
  return [
    ...new Set(
      (value.toLowerCase().match(/[a-z0-9-]+/g) ?? [])
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
    ),
  ];
}

function valueTokens(value: unknown): string[] {
  if (typeof value === "string") return normalisedTokens(value);
  if (Array.isArray(value)) {
    return normalisedTokens(
      value
        .filter((item) => typeof item === "string" || typeof item === "number")
        .map(String)
        .join(" "),
    );
  }
  return [];
}

export function safeDocumentPath(value: unknown): string | null {
  const path = stringValue(value);
  if (
    !path ||
    path.startsWith("//") ||
    path.includes("\\") ||
    !DOCUMENT_PATH_PATTERN.test(path)
  ) {
    return null;
  }
  return path;
}

export function answerDocumentEvidenceText(
  answer: JsonRecord,
  question: string,
): string {
  return [
    question,
    stringValue(answer.directAnswer),
    ...textArray(answer.evidence),
    ...answerFindingText(answer.findings),
    ...textArray(answer.sources),
  ]
    .filter(Boolean)
    .join("\n");
}

export function answerReferencesDocuments(answerText: string): boolean {
  return DOCUMENT_TERMS_PATTERN.test(answerText);
}

export function equipmentIdFromAnswer(answer: JsonRecord): string | null {
  const conversationContext = record(answer.conversationContext);
  const activeEquipment = record(conversationContext?.activeEquipment);
  const directId = stringValue(activeEquipment?.id);
  if (directId) return directId;

  const links = Array.isArray(answer.evidenceLinks) ? answer.evidenceLinks : [];
  for (const value of links) {
    const link = record(value);
    const path = stringValue(link?.path);
    const match = /^\/equipment\/([^/?#]+)/i.exec(path);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export function equipmentCodeFromAnswer(answer: JsonRecord): string | null {
  const conversationContext = record(answer.conversationContext);
  const activeEquipment = record(conversationContext?.activeEquipment);
  const code = stringValue(activeEquipment?.code);
  if (code) return code;

  const text = [
    stringValue(answer.directAnswer),
    ...textArray(answer.evidence),
  ].join(" ");
  return /\b[A-Z]{2,5}-\d{1,4}\b/.exec(text)?.[0] ?? null;
}

function documentLabel(document: JsonRecord): string {
  const title =
    stringValue(document.title) ||
    stringValue(document.external_reference) ||
    "approved document";
  const documentType = stringValue(document.document_type).toLowerCase();
  const drawingNumber = stringValue(document.drawing_number);
  const section = stringValue(document.manual_section);
  const page = stringValue(document.page_number);
  const sheet = stringValue(document.sheet_number);

  const kind = /drawing/.test(documentType)
    ? "drawing"
    : /manual/.test(documentType)
      ? "manual"
      : /guide/.test(documentType)
        ? "guide"
        : /instruction|procedure|sop/.test(documentType)
          ? "instruction"
          : "document";
  const reference = kind === "drawing" && drawingNumber ? drawingNumber : title;
  const locator = [
    section && kind !== "drawing" ? section : "",
    sheet ? `sheet ${sheet}` : page ? `page ${page}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const raw = `Open ${kind}: ${reference}${locator ? ` · ${locator}` : ""}`;
  return raw.length > 140 ? `${raw.slice(0, 139).trimEnd()}…` : raw;
}

function documentScore(document: JsonRecord, evidenceText: string): number {
  const loweredEvidence = evidenceText.toLowerCase();
  const evidenceTokens = new Set(normalisedTokens(evidenceText));
  let score = 0;

  for (const code of textArray(document.fault_codes)) {
    if (loweredEvidence.includes(code.toLowerCase())) score += 180;
  }
  for (const tag of textArray(document.component_tags)) {
    const tagTokens = valueTokens(tag);
    const matched = tagTokens.filter((token) => evidenceTokens.has(token)).length;
    score += matched * 24;
  }

  const searchable = [
    document.title,
    document.document_type,
    document.manual_section,
    document.drawing_number,
    document.external_reference,
    document.summary,
    document.extracted_summary,
  ]
    .map(stringValue)
    .filter(Boolean)
    .join(" ");
  score += normalisedTokens(searchable).filter((token) => evidenceTokens.has(token)).length * 8;

  if (/manual/i.test(stringValue(document.document_type)) && /manual|page|section/i.test(evidenceText)) {
    score += 35;
  }
  if (/drawing/i.test(stringValue(document.document_type)) && /drawing|circuit|terminal|plc|input|output/i.test(evidenceText)) {
    score += 35;
  }
  if (/guide/i.test(stringValue(document.document_type)) && /guide|fault tree|diagnos/i.test(evidenceText)) {
    score += 35;
  }
  if (document.is_current === true) score += 10;
  if (/approved/i.test(stringValue(document.approval_status))) score += 10;
  return score;
}

export function buildDocumentEvidenceLinks(
  documents: JsonRecord[],
  evidenceText: string,
  maximum = 6,
): EvidenceLink[] {
  const ranked = documents
    .flatMap((document, index) => {
      const path = safeDocumentPath(document.source_url ?? document.sourceUrl);
      if (!path) return [];
      return [{
        document,
        path,
        score: documentScore(document, evidenceText),
        index,
      }];
    })
    .sort(
      (first, second) =>
        second.score - first.score || first.index - second.index,
    );

  const seen = new Set<string>();
  const links: EvidenceLink[] = [];
  for (const item of ranked) {
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    links.push({
      label: documentLabel(item.document),
      path: item.path,
      recordType: "document",
    });
    if (links.length >= maximum) break;
  }
  return links;
}

export function mergeEvidenceLinks(
  priorityLinks: EvidenceLink[],
  existingLinks: unknown,
  maximum = 8,
): EvidenceLink[] {
  const existing = Array.isArray(existingLinks)
    ? existingLinks.flatMap((value) => {
        const link = record(value);
        const label = stringValue(link?.label);
        const path = stringValue(link?.path);
        const recordType = stringValue(link?.recordType) as EvidenceLink["recordType"];
        return label && path && recordType
          ? [{ label, path, recordType } satisfies EvidenceLink]
          : [];
      })
    : [];
  const seen = new Set<string>();
  return [...priorityLinks, ...existing]
    .filter((link) => {
      if (seen.has(link.path)) return false;
      seen.add(link.path);
      return true;
    })
    .slice(0, maximum);
}
