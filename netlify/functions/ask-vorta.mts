import type { Config } from "@netlify/functions";
import handler from "./ask-vorta/runtime.mjs";
import {
  ASK_VORTA_RESPONSE_VALIDATION_REVISION,
} from "./ask-vorta/response-validation.mjs";

// VOR-056 keeps deterministic backlog decisions and read-only action enforcement
// inside the modular runtime; this entrypoint pins the validated response bundle.
if (
  ASK_VORTA_RESPONSE_VALIDATION_REVISION !==
  "vor-056-final-backlog-boundary-v1"
) {
  throw new Error("Ask Vorta response-validation bundle revision mismatch.");
}

export default handler;

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};
