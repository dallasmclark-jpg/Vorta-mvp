const MAX_IMAGE_BYTES = 3_000_000;
const MIN_IMAGE_DIMENSION = 64;
const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_PIXELS = 12_000_000;
const MAX_IMAGE_NAME_LENGTH = 120;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function cleanName(value) {
  if (typeof value !== "string") return "image";
  const cleaned = value
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "-")
    .slice(0, MAX_IMAGE_NAME_LENGTH);
  return cleaned || "image";
}

function readUint24LittleEndian(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function dimensionsFromPng(bytes) {
  if (bytes.length < 24) return null;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    mimeType: "image/png",
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

function dimensionsFromJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) return null;
      return {
        mimeType: "image/jpeg",
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += segmentLength;
  }
  return null;
}

function dimensionsFromWebp(bytes) {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X") {
    return {
      mimeType: "image/webp",
      width: readUint24LittleEndian(bytes, 24) + 1,
      height: readUint24LittleEndian(bytes, 27) + 1,
    };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const b1 = bytes[21];
    const b2 = bytes[22];
    const b3 = bytes[23];
    const b4 = bytes[24];
    return {
      mimeType: "image/webp",
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    };
  }
  if (
    chunk === "VP8 " &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      mimeType: "image/webp",
      width: ((bytes[27] << 8) | bytes[26]) & 0x3fff,
      height: ((bytes[29] << 8) | bytes[28]) & 0x3fff,
    };
  }
  return null;
}

function inspectImageBytes(bytes) {
  return (
    dimensionsFromPng(bytes) ||
    dimensionsFromJpeg(bytes) ||
    dimensionsFromWebp(bytes)
  );
}

function decodeBase64(value) {
  if (!value || value.length % 4 !== 0) return null;
  try {
    const buffer = Buffer.from(value, "base64");
    if (buffer.length === 0) return null;
    const canonicalInput = value.replace(/=+$/, "");
    const canonicalOutput = buffer.toString("base64").replace(/=+$/, "");
    return canonicalInput === canonicalOutput
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : null;
  } catch {
    return null;
  }
}

function validationFailure(code, message) {
  return { ok: false, code, message };
}

export function validateAskVortaImage(value) {
  const candidate = record(value);
  if (!candidate) {
    return validationFailure(
      "missing_image",
      "The image payload is missing or invalid.",
    );
  }
  const dataUrl = typeof candidate.dataUrl === "string" ? candidate.dataUrl.trim() : "";
  const declaredMimeType =
    typeof candidate.mimeType === "string" ? candidate.mimeType.trim().toLowerCase() : "";
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    return validationFailure(
      "invalid_data_url",
      "The image must be a base64 JPEG, PNG or WebP data URL.",
    );
  }
  const dataUrlMimeType = match[1].toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(dataUrlMimeType)) {
    return validationFailure(
      "unsupported_mime_type",
      "Only JPEG, PNG and WebP images are accepted.",
    );
  }
  if (declaredMimeType && declaredMimeType !== dataUrlMimeType) {
    return validationFailure(
      "declared_mime_mismatch",
      "The declared image type does not match the encoded data URL.",
    );
  }
  const bytes = decodeBase64(match[2]);
  if (!bytes) {
    return validationFailure(
      "invalid_base64",
      "The image data could not be decoded safely.",
    );
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return validationFailure(
      "image_too_large",
      `The image exceeds the ${MAX_IMAGE_BYTES} byte limit.`,
    );
  }
  const inspected = inspectImageBytes(bytes);
  if (!inspected) {
    return validationFailure(
      "invalid_image_header",
      "The encoded bytes are not a supported JPEG, PNG or WebP image.",
    );
  }
  if (inspected.mimeType !== dataUrlMimeType) {
    return validationFailure(
      "actual_mime_mismatch",
      "The encoded image bytes do not match the supplied image type.",
    );
  }
  const { width, height } = inspected;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_IMAGE_DIMENSION ||
    height < MIN_IMAGE_DIMENSION
  ) {
    return validationFailure(
      "image_too_small",
      `The image must be at least ${MIN_IMAGE_DIMENSION} pixels on each side.`,
    );
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return validationFailure(
      "image_dimensions_too_large",
      `The image must not exceed ${MAX_IMAGE_DIMENSION} pixels on either side.`,
    );
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    return validationFailure(
      "image_pixel_count_too_large",
      `The image must not exceed ${MAX_IMAGE_PIXELS} pixels.`,
    );
  }

  return {
    ok: true,
    image: {
      name: cleanName(candidate.name),
      mimeType: inspected.mimeType,
      byteSize: bytes.byteLength,
      width,
      height,
      dataUrl,
    },
  };
}

export function safeAskVortaImageMetadata(image) {
  const candidate = record(image);
  if (!candidate) return null;
  return {
    name: cleanName(candidate.name),
    mimeType: typeof candidate.mimeType === "string" ? candidate.mimeType : "",
    byteSize: Number(candidate.byteSize) || 0,
    width: Number(candidate.width) || 0,
    height: Number(candidate.height) || 0,
    retention: "Not saved to Vorta records or Recent conversations",
  };
}

export const ASK_VORTA_IMAGE_LIMITS = Object.freeze({
  maxCount: 1,
  maxBytes: MAX_IMAGE_BYTES,
  minDimension: MIN_IMAGE_DIMENSION,
  maxDimension: MAX_IMAGE_DIMENSION,
  maxPixels: MAX_IMAGE_PIXELS,
  allowedMimeTypes: [...ALLOWED_MIME_TYPES],
});
