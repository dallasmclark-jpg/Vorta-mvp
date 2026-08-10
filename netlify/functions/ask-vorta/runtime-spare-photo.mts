import type { Context } from "@netlify/functions";
import existingHandler, {
  ASK_VORTA_BACKTEST_REVISION,
} from "./runtime-backtest.mjs";
import {
  handleSparePhotoIdentification,
  shouldHandleSparePhotoPayload,
} from "./spare-photo-identification.mjs";

export const ASK_VORTA_SPARE_PHOTO_REVISION = "vor-076-spare-photo-top-five-v1";

if (ASK_VORTA_BACKTEST_REVISION !== "vor-069-historical-backtest-intelligence-v1") {
  throw new Error("Ask Vorta historical backtest runtime revision mismatch.");
}

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
