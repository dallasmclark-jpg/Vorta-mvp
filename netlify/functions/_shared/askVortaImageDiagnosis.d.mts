export type AskVortaImageExtractionStatus = "readable" | "partial" | "unreadable";
export type AskVortaImageType = "fault_screen" | "nameplate" | "component" | "equipment" | "other";

export interface AskVortaVisualEvidenceItem {
  value: string;
  confidence: number;
}

export interface AskVortaImageExtraction {
  extractionStatus: AskVortaImageExtractionStatus;
  imageType: AskVortaImageType;
  observedText: AskVortaVisualEvidenceItem[];
  faultCodes: AskVortaVisualEvidenceItem[];
  manufacturerCandidates: AskVortaVisualEvidenceItem[];
  modelCandidates: AskVortaVisualEvidenceItem[];
  partCandidates: AskVortaVisualEvidenceItem[];
  equipmentCodeCandidates: AskVortaVisualEvidenceItem[];
  visualObservations: string[];
  qualityWarnings: string[];
}

export interface AskVortaImageMatch {
  extraction: AskVortaImageExtraction | null;
  equipmentMatches: Array<{
    equipmentId: string;
    equipmentCode: string;
    equipmentName: string;
    model: string;
    area: string;
    score: number;
    confidenceBand: string;
    exactIdentifier: boolean;
    basis: string[];
  }>;
  componentMatches: Array<{
    componentId: string;
    componentCode: string;
    oemPartNumber: string;
    componentName: string;
    maker: string;
    equipmentId: string;
    equipmentCode: string;
    equipmentName: string;
    score: number;
    confidenceBand: string;
    exactIdentifier: boolean;
    basis: string[];
  }>;
  selectedEquipmentQuery: string | null;
  matchStatus: string;
  conflicts: string[];
}

export const ASK_VORTA_IMAGE_EXTRACTION_SCHEMA: Readonly<Record<string, unknown>>;

export function sanitizeAskVortaImageExtraction(
  value: unknown,
): AskVortaImageExtraction | null;

export function rankAskVortaImageMatches(
  extraction: unknown,
  equipment: unknown,
  components: unknown,
): AskVortaImageMatch;

export function imageDiagnosisSearchText(result: unknown): string;
