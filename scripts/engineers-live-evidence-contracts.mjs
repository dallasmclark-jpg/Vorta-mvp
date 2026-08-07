import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  functionIndex,
  functionAuth,
  functionTransform,
  runtimeContract,
  liveEngineers,
  operationalRota,
  operationalRotaService,
  routeEntry,
  engineersIndex,
  operations,
  migration,
] = await Promise.all([
  read("../supabase/functions/engineers-data/index.ts"),
  read("../supabase/functions/engineers-data/auth.ts"),
  read("../supabase/functions/engineers-data/transform.ts"),
  read("../src/screens/Engineers/engineersRuntimeContracts.ts"),
  read("../src/screens/Engineers/LiveEngineersSection.tsx"),
  read("../src/screens/Engineers/OperationalRotaRiskMap.tsx"),
  read("../src/screens/Engineers/operationalRotaService.ts"),
  read("../src/screens/Engineers/EngineersRouteEntry.tsx"),
  read("../src/screens/Engineers/index.ts"),
  read("../src/screens/AiOperations/AiOperations.tsx"),
  read("../supabase/migrations/20260807193000_vor_068_configured_rota_headcount.sql"),
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
mustMatch(liveEngineers, /getShiftCoverSnapshot\(siteId, startDate, endDate\)/, "Desktop availability must use the verified Shift Cover source");
mustMatch(liveEngineers, /validated\.siteId !== siteId \|\| validated\.organisationId !== organisationId/, "Desktop Engineers must reject cross-site or cross-organisation responses");
mustMatch(liveEngineers, /data-vorta-live-engineers="true"/, "Live Engineers must expose a browser-test evidence marker");
mustMatch(liveEngineers, /Malformed, cross-site or incomplete responses are withheld/, "Live Engineers must explain fail-closed handling");

mustMatch(operationalRotaService, /vorta_get_shift_cover_snapshot/, "The operational rota must use the canonical authorised Shift Cover snapshot RPC");
mustMatch(operationalRotaService, /siteId !== expectedSiteId/, "The operational rota must reject cross-site snapshot data");
mustMatch(operationalRotaService, /engineerNames\.length !== item\.scheduledEngineerCount/, "The operational rota must fail closed when names and scheduled headcount disagree");
mustMatch(operationalRotaService, /requiredHeadcount: integer\([\s\S]*?requiredHeadcount[\s\S]*?1,\s*\)/, "Configured team headcount must be parsed as a positive integer");
mustMatch(operationalRotaService, /memberNames/, "Configured team member names must come from verified snapshot evidence");

mustMatch(operationalRota, /getOperationalRotaSnapshot\(siteId, startDate, endDate\)/, "Tablet rota must load the verified site-scoped snapshot");
mustMatch(operationalRota, /data-vorta-operational-rota-risk-map="true"/, "The approved rota grid must expose a stable browser marker");
mustMatch(operationalRota, /Fully Covered requires the configured team headcount/, "The UI must state the staffing invariant");
mustMatch(operationalRota, /scheduledHeadcount < requiredHeadcount/, "A staffing shortfall must be evaluated before the aggregate coverage status");
mustMatch(operationalRota, /scheduledHeadcount \* 2 <= requiredHeadcount \? "partial" : "reduced"/, "Under-strength teams must become partial or reduced rather than covered");
mustMatch(operationalRota, /\{cell\.engineerNames\.length\}\/\{cell\.requiredHeadcount\}/, "Every active rota cell must show actual versus required headcount");
mustMatch(operationalRota, /Missing Skill[\s\S]*Reduced Resilience[\s\S]*SME Dependency[\s\S]*Contractor Involved/, "Risk indicator vocabulary must remain available on the canonical rota");
mustMatch(operationalRota, /The rota fails closed rather than showing an unverified green status/, "Rota load failures must not degrade to green placeholder coverage");
mustMatch(operationalRota, /No active maintenance rota configured/, "The rota must have a bounded empty state");
mustNotMatch(operationalRota, /TEAM_CONFIGS|ROTA_OVERLAYS|SC_ENGINEERS|James Hadley|Sarah Mitchell/, "The production Engineers rota must not depend on the former hard-coded roster");

mustMatch(routeEntry, /getEffectiveDataMode/, "Engineers route must retain shared data-trust mode for the phone presentation");
mustMatch(routeEntry, /useMediaQuery\("\(max-width: 767px\)"\)/, "Engineers route must preserve the explicit phone boundary");
mustMatch(routeEntry, /useMediaQuery\("\(min-width: 768px\) and \(max-width: 1439px\)"\)/, "Narrow tablet widths must retain the approved rota architecture");
mustMatch(routeEntry, /useMediaQuery\("\(any-pointer: coarse\)"\)/, "Wide touch tablets may expose coarse-pointer capability");
mustMatch(routeEntry, /useMediaQuery\("\(hover: none\)"\)/, "Wide touch tablets may expose no-hover capability");
mustMatch(routeEntry, /navigator\.maxTouchPoints > 0/, "Samsung desktop-site mode must be detected through retained touch points");
mustMatch(routeEntry, /isNarrowTablet \|\| hasTouchPoints \|\| hasCoarsePointer \|\| hasNoHover/, "Tablet routing must accept any reliable tablet capability");
mustMatch(routeEntry, /<MobileEngineersSection dataMode=\{dataMode\} \/>/, "Phone Engineers must retain the working mobile presentation");
mustMatch(routeEntry, /data-vorta-original-shift-rota="true"/, "Tablet Engineers must retain the approved rota-grid browser marker");
mustMatch(routeEntry, /data-vorta-verified-operational-rota="true"/, "Tablet Engineers must identify the verified replacement");
mustMatch(routeEntry, /<OperationalRotaRiskMap \/>/, "Tablet Engineers must render the verified canonical rota implementation");
mustMatch(routeEntry, /<LiveEngineersSection \/>/, "Genuine non-touch desktop must retain the active-site engineer evidence register");
mustNotMatch(routeEntry, /LabourRiskDetailPage|location="\/engineers\/shift-cover"/, "The Engineers route must not mount the hard-coded legacy Shift Cover page");
mustNotMatch(routeEntry, /max-width: 1600|Android/i, "Wide Samsung routing must not depend on a guessed upper width or Android user-agent text");
mustNotMatch(routeEntry, /hasTouchPoints && hasCoarsePointer/, "Samsung routing must not require touch and coarse pointer simultaneously");
mustNotMatch(routeEntry, /TabletEngineersSection/, "Engineers must not return to the simplified weekly coverage replacement on tablet");

mustMatch(migration, /add column if not exists required_headcount integer/, "Shift teams must store an explicit staffing requirement");
mustMatch(migration, /maintenance_shift_teams_required_headcount_check[\s\S]*required_headcount > 0/, "Configured staffing requirements must remain positive");
mustMatch(migration, /sum\(scheduled_team\.required_headcount\)/, "Shift staffing requirements must be summed from the teams actually scheduled");
mustMatch(migration, /scheduled_engineer_count < staffing_requirements\.required_engineer_count/, "Staffing risk must react to configured shortfalls");
mustMatch(migration, /scheduled_engineer_count < scored\.required_engineer_count[\s\S]*then 'reduced'/, "Coverage status must refuse Fully Covered below configured headcount");
mustMatch(migration, /'requiredHeadcount', team\.required_headcount/, "The authorised snapshot must expose team staffing requirements");
mustMatch(migration, /'memberNames'/, "The authorised snapshot must expose site-scoped team member names");
mustMatch(migration, /if not public\.vorta_has_site_access\(p_site_id, false\)/, "Snapshot enrichment must preserve the existing site-access guard");

mustMatch(engineersIndex, /EngineersRouteEntry as EngineersSection/, "The public Engineers export must use the responsive route");
mustMatch(operations, /label: "Engineers", icon: Users, to: "\/engineers"/, "Engineers must remain available in live navigation");
mustMatch(operations, /<Route path="engineers" element=\{<EngineersSection \/>\} \/>/, "Engineers must route through the responsive entry");

console.log(
  "Engineers live evidence and VOR-068 configured-headcount rota contracts passed: tablet keeps the approved rota grid, uses authorised Shift Cover evidence, shows actual/required staffing, and cannot render an under-strength team as Fully Covered.",
);
