export interface PreparedAskVortaImage {
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dataUrl: string;
  byteSize: number;
  width: number;
  height: number;
}

export const ASK_VORTA_CLIENT_IMAGE_LIMITS = Object.freeze({
  maxBytes: 3_000_000,
  minDimension: 64,
  maxDimension: 4096,
  maxPixels: 12_000_000,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
});

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The image could not be encoded."));
    reader.readAsDataURL(file);
  });
}

async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      image.onerror = () => reject(new Error("The image dimensions could not be read."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareAskVortaImage(
  file: File,
): Promise<PreparedAskVortaImage> {
  const mimeType = file.type.toLowerCase();
  if (!ASK_VORTA_CLIENT_IMAGE_LIMITS.allowedMimeTypes.includes(
    mimeType as (typeof ASK_VORTA_CLIENT_IMAGE_LIMITS.allowedMimeTypes)[number],
  )) {
    throw new Error("Use a JPEG, PNG or WebP photo.");
  }
  if (file.size <= 0) throw new Error("The selected image is empty.");
  if (file.size > ASK_VORTA_CLIENT_IMAGE_LIMITS.maxBytes) {
    throw new Error("The photo must be 3 MB or smaller.");
  }

  const { width, height } = await readDimensions(file);
  if (
    width < ASK_VORTA_CLIENT_IMAGE_LIMITS.minDimension ||
    height < ASK_VORTA_CLIENT_IMAGE_LIMITS.minDimension
  ) {
    throw new Error("The photo must be at least 64 pixels on each side.");
  }
  if (
    width > ASK_VORTA_CLIENT_IMAGE_LIMITS.maxDimension ||
    height > ASK_VORTA_CLIENT_IMAGE_LIMITS.maxDimension
  ) {
    throw new Error("The photo must not exceed 4096 pixels on either side.");
  }
  if (width * height > ASK_VORTA_CLIENT_IMAGE_LIMITS.maxPixels) {
    throw new Error("The photo must not exceed 12 megapixels.");
  }

  const dataUrl = await readAsDataUrl(file);
  return {
    name: file.name.trim().slice(0, 120) || "image",
    mimeType: mimeType as PreparedAskVortaImage["mimeType"],
    dataUrl,
    byteSize: file.size,
    width,
    height,
  };
}
