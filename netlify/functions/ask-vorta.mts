import type { Config } from "@netlify/functions";
import handler, {
  ASK_VORTA_DOCUMENT_LINK_REVISION,
} from "./ask-vorta/runtime-document-links.mjs";
import {
  ASK_VORTA_RESPONSE_VALIDATION_REVISION,
} from "./ask-vorta/response-validation.mjs";

// Production release marker: exact approved manual and drawing deep links.
// Compatibility marker: runtime-document-links delegates to:
// import handler from "./ask-vorta/runtime-equipment-fallback.mjs";
if (
  ASK_VORTA_RESPONSE_VALIDATION_REVISION !==
    "vor-056-final-backlog-boundary-v1" ||
  ASK_VORTA_DOCUMENT_LINK_REVISION !==
    "vor-049-exact-document-deep-links-v1"
) {
  throw new Error("Ask Vorta validated bundle revision mismatch.");
}

export default handler;

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};
