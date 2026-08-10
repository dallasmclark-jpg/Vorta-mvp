import type { JsonRecord } from "../ask-vorta/contracts.mjs";

export interface AskVortaSparePhotoCandidate {
  componentId: string;
  equipmentId: string;
  componentName: string;
  stockNumber: string;
  oemPartNumber: string;
  manufacturer: string;
  imageUrl: string;
  imageAltText: string;
  quantity: number | null;
  location: string;
  availabilityStatus: string;
  metadataScore: number;
  rawMetadataScore: number;
  exactIdentifier: boolean;
}

export interface AskVortaSparePhotoMatch extends AskVortaSparePhotoCandidate {
  visualSimilarity: number | null;
  matchConfidence: number;
}

export function isAskVortaSparePhotoQuestion(value: unknown): boolean;

export function rankAskVortaSparePhotoCandidates(
  extractionValue: unknown,
  componentValue: unknown,
  options?: { pagePath?: string },
): {
  manufacturerFilter: string;
  manufacturerFilterApplied: boolean;
  candidates: AskVortaSparePhotoCandidate[];
};

export function combineAskVortaSparePhotoMatches(
  candidateValue: unknown,
  visualValue: unknown,
): AskVortaSparePhotoMatch[];

export const ASK_VORTA_SPARE_VISUAL_MATCH_SCHEMA: JsonRecord;
