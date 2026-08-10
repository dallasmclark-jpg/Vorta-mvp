import type { Config } from "@netlify/functions";
import handler, {
  ASK_VORTA_SPARE_PHOTO_REVISION,
} from "./ask-vorta/runtime-spare-photo.mjs";
import {
  ASK_VORTA_DOCUMENT_LINK_REVISION,
} from "./ask-vorta/runtime-document-links.mjs";
import {
  ASK_VORTA_RESPONSE_VALIDATION_REVISION,
} from "./ask-vorta/response-validation.mjs";

// Production release marker: exact approved manual and drawing deep links retain Ask Vorta return context.
// VOR-076 marker: deliberate spare-photo identification uses the verified site stock catalogue before generic image diagnosis.
if (
  ASK_VORTA_RESPONSE_VALIDATION_REVISION !==
    "vor-056-final-backlog-boundary-v1" ||
  ASK_VORTA_DOCUMENT_LINK_REVISION !==
    "vor-067-production-chat-return-v3" ||
  ASK_VORTA_SPARE_PHOTO_REVISION !==
    "vor-076-spare-photo-top-five-v1"
) {
  throw new Error("Ask Vorta validated bundle revision mismatch.");
}

export default handler;

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};
