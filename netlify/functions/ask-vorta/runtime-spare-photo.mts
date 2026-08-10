import type { Context } from "@netlify/functions";
import existingHandler from "./runtime-document-links.mjs";
import {
  handleSparePhotoIdentification,
  shouldHandleSparePhotoPayload,
} from "./spare-photo-identification.mjs";

export const ASK_VORTA_SPARE_PHOTO_REVISION = "vor-076-spare-photo-top-five-v1";

export default async function handler(
  req: Request,
  context: Context,
): Promise<Response> {
  if (req.method === "POST") {
    try {
      const payload = await req.clone().json();
      if (shouldHandleSparePhotoPayload(payload)) {
        return handleSparePhotoIdentification(req, context);
      }
    } catch {
      // Preserve the existing authenticated request/parser behaviour for malformed JSON.
    }
  }
  return existingHandler(req, context);
}
