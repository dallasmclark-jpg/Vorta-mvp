export interface AskVortaImageInput {
  name?: string;
  mimeType?: string;
  dataUrl: string;
}

export interface ValidatedAskVortaImage {
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  width: number;
  height: number;
  dataUrl: string;
}

export interface SafeAskVortaImageMetadata {
  name: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  retention: "Not saved to Vorta records or Recent conversations";
}

export type AskVortaImageValidationResult =
  | { ok: true; image: ValidatedAskVortaImage }
  | { ok: false; code: string; message: string };

export function validateAskVortaImage(
  value: unknown,
): AskVortaImageValidationResult;

export function safeAskVortaImageMetadata(
  image: unknown,
): SafeAskVortaImageMetadata | null;

export const ASK_VORTA_IMAGE_LIMITS: Readonly<{
  maxCount: 1;
  maxBytes: number;
  minDimension: number;
  maxDimension: number;
  maxPixels: number;
  allowedMimeTypes: string[];
}>;
