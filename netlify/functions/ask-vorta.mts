import type { Config } from "@netlify/functions";
import handler from "./ask-vorta/runtime.mjs";

export const ASK_VORTA_RUNTIME_REVISION = "vor-056-backlog-action-plan-v2";

export default handler;

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};
