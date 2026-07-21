import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  functionIndex,
  functionAuth,
  functionTransform,
  runtimeContract,
  liveEngineers,
  routeEntry,
  engineersIndex,
  operations,
] = await Promise.all([
  read("../supabase/functions/engineers-data/index.ts"),
  read("../supabase/functions/engineers-data/auth.ts"),
  read("../supabase/functions/engineers-data/transform.ts"),
  read("../src/screens/Engineers/engineersRuntimeContracts.ts"),
  read("../src/screens/Engineers/LiveEngineersSection.tsx"),
  read("../src/screens/Engineers/EngineersRouteEntry.tsx"),
  read("../src/screens/Engineers/index.ts"),
  read("../src/screens/AiOperations/AiOperations.tsx"),
]);

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);
const mustNotMatch = (source, pattern, message) => assert.doesNotMatch(source, pattern, message);

mustMatch(functionAuth, /req\.headers\.get\("authorization"\)/, "Engineers function must require caller authorization");
mustMatch(functionAuth, /SUPABASE_ANON_KEY/, "Engineers function must preserve the caller RLS context");
mustMatch(functionAuth, /vorta_get_function_context/, "Engineers function must resolve the authorised site context");
mustNotMatch(functionAuth, /SERVICE_ROLE/, "Engineers function authentication must not use service-role credentials");
mustMatch(functionIndex, /\.eq\("site_id", siteId\)/, "Engineer records must be active-site scoped");
mustMatch(functionIndex, /\.eq\("organisation_id", organisationId\)/, "Engineer records must be organisation scoped");
mustMatch(functionIndex, /siteId,[\s\S]*organisationId,[\s\S]*generatedAt/, "Engineers responses must include evidence metadata");
mustMatch(functionIndex, /buildEngineerPayload/, "Engineers payload construction must remain isolated from access control");
mustMatch(functionTransform, /totalEngineers: engineers\.length/, "Engineer totals must be derived from scoped records");

mustMatch(runtimeContract, /export function validateEngineersPayload/, "Engineers must have a dedicated runtime contract");
mustMatch(runtimeContract, /engineer\.site_id !== siteId/, "Every engineer must match the authorised response site");
mustMatch(runtimeContract, /stats\.totalEngineers !== engineers\.length/, "Engineer totals must match the validated register");
mustMatch(runtimeContract, /must be between 0 and 100/, "Engineer scores must be range checked");

mustMatch(liveEngineers, /validateEngineersPayload\(engineersResult\.data\)/, "Live Engineers must validate workforce responses");
mustMatch(liveEngineers, /getShiftCoverSnapshot\(siteId, startDate, endDate\)/, "Live availability must use the verified Shift Cover source");
mustMatch(liveEngineers, /validated\.siteId !== siteId \|\| validated\.organisationId !== organisationId/, "Live Engineers must reject cross-site or cross-organisation responses");
mustMatch(liveEngineers, /data-vorta-live-engineers="true"/, "Live Engineers must expose a browser-test evidence marker");
mustMatch(liveEngineers, /data-vorta-active-site=\{siteContext\?\.siteId/, "Live Engineers must expose its active-site boundary");
mustMatch(liveEngineers, /Read-only live pilot/, "Live Engineers must state the read-only boundary");
mustMatch(liveEngineers, /Malformed, cross-site or incomplete responses are withheld/, "Live Engineers must explain fail-closed handling");
mustMatch(liveEngineers, /aria-label=\{`Review \$\{engineer\.full_name\}`\}/, "Engineer review actions must have descriptive names");
mustMatch(liveEngineers, /focus-visible:ring-2/, "Engineer review actions must expose visible keyboard focus");
mustNotMatch(liveEngineers, /MM_CALENDAR_EVENTS|At-Risk Shifts This Month|Training Conflicts|Contractor Cover Required/, "Live Engineers must not restore the simulated calendar or fixed coverage KPIs");
mustNotMatch(liveEngineers, /Add Engineer|AI Report|Alpha Manufacturing/, "Live Engineers must not expose demo-only actions or tenant labels");
mustNotMatch(liveEngineers, /availability_status === "on_shift"|availability_status === "available"/, "Live rota KPIs must not use the legacy availability flag");

mustMatch(routeEntry, /getEffectiveDataMode/, "Engineers route selection must use the shared data-trust mode");
mustMatch(routeEntry, /dataMode === "demo" \? <DemoEngineersSection \/> : <LiveEngineersSection \/>/, "Demo and live Engineers must remain explicitly separated");
mustMatch(engineersIndex, /EngineersRouteEntry as EngineersSection/, "The public Engineers export must use the mode-aware route");
mustMatch(operations, /label: "Engineers", icon: Users, to: "\/engineers"/, "Engineers must remain available in live navigation");
mustMatch(operations, /<Route path="engineers" element=\{<EngineersSection \/>\} \/>/, "Engineers must route through the mode-aware entry");

console.log("Engineers live evidence contracts passed.");
