import assert from "node:assert/strict";
import {
  ASK_VORTA_IMAGE_LIMITS,
  safeAskVortaImageMetadata,
  validateAskVortaImage,
} from "../netlify/functions/_shared/askVortaImageEvidence.mjs";

function dataUrl(mimeType, bytes) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function png(width, height, size = 24) {
  const bytes = Buffer.alloc(Math.max(size, 24));
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpeg(width, height) {
  const bytes = Buffer.alloc(24);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xc0;
  bytes[4] = 0x00;
  bytes[5] = 0x11;
  bytes[6] = 0x08;
  bytes[7] = (height >> 8) & 0xff;
  bytes[8] = height & 0xff;
  bytes[9] = (width >> 8) & 0xff;
  bytes[10] = width & 0xff;
  bytes[11] = 0x03;
  bytes[21] = 0xff;
  bytes[22] = 0xd9;
  return bytes;
}

function webp(width, height) {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(22, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  bytes[24] = widthMinusOne & 0xff;
  bytes[25] = (widthMinusOne >> 8) & 0xff;
  bytes[26] = (widthMinusOne >> 16) & 0xff;
  bytes[27] = heightMinusOne & 0xff;
  bytes[28] = (heightMinusOne >> 8) & 0xff;
  bytes[29] = (heightMinusOne >> 16) & 0xff;
  return bytes;
}

const validCases = [
  ["image/png", png(640, 480)],
  ["image/jpeg", jpeg(1920, 1080)],
  ["image/webp", webp(1200, 800)],
];

for (const [mimeType, bytes] of validCases) {
  const result = validateAskVortaImage({
    name: "../../fault-screen\u0000.jpg",
    mimeType,
    dataUrl: dataUrl(mimeType, bytes),
    width: 1,
    height: 1,
    ocrText: "browser supplied and therefore ignored",
  });
  assert.equal(result.ok, true, `${mimeType} should be accepted`);
  if (!result.ok) continue;
  assert.equal(result.image.mimeType, mimeType);
  assert.ok(result.image.width >= 64);
  assert.ok(result.image.height >= 64);
  assert.equal(result.image.name.includes("/"), false);
  assert.equal("ocrText" in result.image, false);
  assert.equal("width" in result.image, true);
}

const mismatch = validateAskVortaImage({
  name: "mismatch.png",
  mimeType: "image/jpeg",
  dataUrl: dataUrl("image/png", png(640, 480)),
});
assert.deepEqual(mismatch.ok, false);
assert.equal(mismatch.code, "declared_mime_mismatch");

const byteMismatch = validateAskVortaImage({
  name: "mismatch.webp",
  mimeType: "image/webp",
  dataUrl: dataUrl("image/webp", png(640, 480)),
});
assert.deepEqual(byteMismatch.ok, false);
assert.equal(byteMismatch.code, "actual_mime_mismatch");

const tiny = validateAskVortaImage({
  name: "tiny.png",
  mimeType: "image/png",
  dataUrl: dataUrl("image/png", png(32, 32)),
});
assert.deepEqual(tiny.ok, false);
assert.equal(tiny.code, "image_too_small");

const tooWide = validateAskVortaImage({
  name: "wide.png",
  mimeType: "image/png",
  dataUrl: dataUrl("image/png", png(4097, 100)),
});
assert.deepEqual(tooWide.ok, false);
assert.equal(tooWide.code, "image_dimensions_too_large");

const tooManyPixels = validateAskVortaImage({
  name: "pixels.png",
  mimeType: "image/png",
  dataUrl: dataUrl("image/png", png(4000, 4000)),
});
assert.deepEqual(tooManyPixels.ok, false);
assert.equal(tooManyPixels.code, "image_pixel_count_too_large");

const oversizedBytes = png(
  640,
  480,
  ASK_VORTA_IMAGE_LIMITS.maxBytes + 1,
);
const oversized = validateAskVortaImage({
  name: "large.png",
  mimeType: "image/png",
  dataUrl: dataUrl("image/png", oversizedBytes),
});
assert.deepEqual(oversized.ok, false);
assert.equal(oversized.code, "image_too_large");

for (const payload of [
  null,
  {},
  { dataUrl: "not-a-data-url" },
  { mimeType: "image/gif", dataUrl: "data:image/gif;base64,R0lGODlh" },
  { mimeType: "image/png", dataUrl: "data:image/png;base64,%%%%" },
]) {
  assert.equal(validateAskVortaImage(payload).ok, false);
}

const accepted = validateAskVortaImage({
  name: "screen.png",
  mimeType: "image/png",
  dataUrl: dataUrl("image/png", png(800, 600)),
});
assert.equal(accepted.ok, true);
if (accepted.ok) {
  const metadata = safeAskVortaImageMetadata(accepted.image);
  assert.ok(metadata);
  assert.equal("dataUrl" in metadata, false);
  assert.equal(metadata.retention, "Not saved to Vorta records or Recent conversations");
}

assert.deepEqual(ASK_VORTA_IMAGE_LIMITS.allowedMimeTypes.sort(), [
  "image/jpeg",
  "image/png",
  "image/webp",
]);
assert.equal(ASK_VORTA_IMAGE_LIMITS.maxCount, 1);
assert.equal(ASK_VORTA_IMAGE_LIMITS.maxBytes, 3_000_000);
assert.equal(ASK_VORTA_IMAGE_LIMITS.minDimension, 64);
assert.equal(ASK_VORTA_IMAGE_LIMITS.maxDimension, 4096);
assert.equal(ASK_VORTA_IMAGE_LIMITS.maxPixels, 12_000_000);

console.log("VOR-046 image evidence validation contracts passed.");
