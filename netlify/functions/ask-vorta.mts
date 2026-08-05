import type { Config } from "@netlify/functions";
import handler from "./ask-vorta/runtime.mjs";
import {
  ASK_VORTA_RESPONSE_VALIDATION_REVISION,
} from "./ask-vorta/response-validation.mjs";

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
