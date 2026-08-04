import type { Config } from "@netlify/functions";
import handler from "./ask-vorta/runtime.mjs";

export default handler;

export const config: Config = {
  path: "/api/ask-vorta",
  method: "POST",
};
