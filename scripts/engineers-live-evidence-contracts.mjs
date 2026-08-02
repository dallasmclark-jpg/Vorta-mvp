import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  functionIndex,
  functionAuth,
  functionTransform,
  runtimeContract,
  liveEngineers,
  shiftRota,
  routeEntry,
  engineersIndex,
  operations,
] = await Promise.all([
  read("../supabase/functions/engineers-data/index.ts"),
  read("../supabase/functions/engineers-data/auth.ts"),
  read("../supabase/functions/engineers-data/transform.ts"),
  read("../src/screens/Engineers/engineersRuntimeContracts.ts"),
  read("../src/screens/Engineers/LiveEngineersSection.tsx"),
  read("../src/screens/LabourRisk/LabourRiskDetailPage.tsx"),
  read("../src/screens/Engineers/EngineersRouteEntry.tsx"),
  read("../src/screens/Engineers/index.ts"),
  read("../src/screens/AiOperations/AiOperations.tsx"),
]);

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);
const mustNotMatch = (source, pattern, message) => assert.doesNotMatch(source, pattern, message);

mustMatch(functionAuth, /req\.headers\.get\("authorization"\)/, "Engineers function must require caller authorization");
mustMatch(functionAuth, /authClient\.auth\.getUser\(token\)/, "Engineers function must verify the bearer token before privileged queries");
mustMatch(functionAuth, /SUPABASE_SERVICE_ROLE_KEY/, "Engineers function must keep privileged access inside the server boundary");
mustMatch(functionAuth, /\.from\("profiles"\)[\s\S]*\.eq\("id", user\.id\)/, "Engineers context must resolve the verified user profile");
mustMatch(functionAuth, /\.from\("user_site_access"\)[\s\S]*\.eq\("user_id", user\.id\)/, "Engineers context must resolve only the verified user's site access");
mustMatch(functionAuth, /ALLOWED_ROLES\.has\(role\)/, "Engineers context must restrict Maintenance Manager roles");
mustNotMatch(functionAuth, /vorta_get_function_context/, "Engineers context must not depend on a non-callable public RPC");
mustMatch(functionIndex, /vorta_get_engineers_evidence_bundle_internal/, "Engineers must use the reviewed site-scoped bundle RPC");
mustMatch(functionIndex, /p_site_id: siteId/, "The bundle must receive the active site boundary");
mustMatch(functionIndex, /p_organisation_id: organisationId/, "The bundle must receive the active organisation boundary");
mustNotMatch(functionIndex, /\.from\("engineers"\)/, "The Edge Function must not restore multi-wave direct table fan-out");
assert.equal((functionIndex.match(/db\.rpc\(/g) ?? []).length, 1, "Engineers must load its evidence through one RPC call");
mustMatch(functionIndex, /siteId,[\s\S]*organisationId,[\s\S]*generatedAt:[\s\S]*evidenceLoadMs:/, "Engineers responses must include boundary and timing metadata");
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

mustMatch(shiftRota, /CONTINENTAL_CYCLE: ShiftPatternType\[\] = \["day", "day", "night", "night", "off", "off", "off", "off"\]/, "The original rota must preserve the exact 2D/2N/4O cycle");
for (const team of ["Yellow Shift", "Red Shift", "Green Shift", "Blue Shift", "Days"]) {
  mustMatch(shiftRota, new RegExp(team), `The original rota must retain ${team}`);
}
mustMatch(shiftRota, /Tonight's Risk Summary/, "The original rota must retain the Tonight's Risk drawer");
mustMatch(shiftRota, /Missing Skill/, "The original rota must retain missing-skill risk indicators");
mustMatch(shiftRota, /Reduced Resilience/, "The original rota must retain resilience risk indicators");
mustMatch(shiftRota, /SME Dependency/, "The original rota must retain SME risk indicators");
mustMatch(shiftRota, /Contractor Involved/, "The original rota must retain contractor risk indicators");

mustMatch(routeEntry, /getEffectiveDataMode/, "Engineers route must retain the shared data-trust mode for the phone presentation");
mustMatch(routeEntry, /useMediaQuery\("\(max-width: 767px\)"\)/, "Engineers route must preserve the explicit phone boundary");
mustMatch(routeEntry, /useMediaQuery\("\(min-width: 768px\) and \(max-width: 1439px\)"\)/, "Engineers route must isolate the tablet boundary");
mustMatch(routeEntry, /<MobileEngineersSection dataMode=\{dataMode\} \/>/, "Phone Engineers must retain the working mobile presentation");
mustMatch(routeEntry, /data-vorta-original-shift-rota="true"/, "Tablet Engineers must expose the restored original rota marker");
mustMatch(routeEntry, /location="\/labour-risk\/shift-cover"/, "Tablet Engineers must render the existing approved Shift Cover route without copying or redesigning it");
mustMatch(routeEntry, /<LabourRiskDetailPage \/>/, "Tablet Engineers must reuse the approved full shift-cover implementation");
mustMatch(routeEntry, /<LiveEngineersSection \/>/, "Desktop Engineers must retain the established verified presentation");
mustNotMatch(routeEntry, /TabletEngineersSection/, "Tablet Engineers must not return to the simplified weekly coverage replacement");
mustMatch(engineersIndex, /EngineersRouteEntry as EngineersSection/, "The public Engineers export must use the responsive route");
mustMatch(operations, /label: "Engineers", icon: Users, to: "\/engineers"/, "Engineers must remain available in live navigation");
mustMatch(operations, /<Route path="engineers" element=\{<EngineersSection \/>\} \/>/, "Engineers must route through the responsive entry");

console.log("Engineers live evidence, restored original tablet rota and single-bundle performance contracts passed.");
