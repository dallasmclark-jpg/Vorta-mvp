import type { Config, Context } from "@netlify/functions";
import runtimeHandler from "./ask-vorta/runtime.mjs";
import {
  ASK_VORTA_RESPONSE_VALIDATION_REVISION,
} from "./ask-vorta/response-validation.mjs";
import {
  handleSiteRiskMovementRequest,
} from "./ask-vorta/site-risk-movement-handler.mjs";

// VOR-056 keeps deterministic backlog decisions and read-only action enforcement
// inside the modular runtime; this entrypoint pins the validated response bundle.
if (
  ASK_VORTA_RESPONSE_VALIDATION_REVISION !==
  "vor-056-final-backlog-boundary-v1"
) {
  throw new Error("Ask Vorta response-validation bundle revision mismatch.");
}

export default async function handler(
  req: Request,
  context: Context,
): Promise<Response> {
  const movementResponse = await handleSiteRiskMovementRequest(req, context);
  return movementResponse ?? runtimeHandler(req, context);
}

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};
