import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  operations,
  evidenceContracts,
  invokeEvidence,
  demoBanner,
  careerEntry,
  careerLive,
  careerIndex,
  careerFunction,
  careerAuth,
  supportEntry,
  supportLive,
  supportIndex,
  supportFunction,
  supportAuth,
  settingsEntry,
  settingsLive,
  settingsIndex,
  settingsFunction,
  settingsAuth,
  healthGrantMigration,
] = await Promise.all([
  read("../src/screens/AiOperations/AiOperations.tsx"),
  read("../src/lib/liveEvidenceContracts.ts"),
  read("../src/lib/invokeEvidenceFunction.ts"),
  read("../src/components/DemoSimulationBanner.tsx"),
  read("../src/screens/Career/CareerRouteEntry.tsx"),
  read("../src/screens/Career/LiveCareerSection.tsx"),
  read("../src/screens/Career/index.ts"),
  read("../supabase/functions/career-evidence-data/index.ts"),
  read("../supabase/functions/career-evidence-data/auth.ts"),
  read("../src/screens/Support/SupportRouteEntry.tsx"),
  read("../src/screens/Support/LiveSupportSection.tsx"),
  read("../src/screens/Support/index.ts"),
  read("../supabase/functions/support-evidence-data/index.ts"),
  read("../supabase/functions/support-evidence-data/auth.ts"),
  read("../src/screens/Settings/SettingsRouteEntry.tsx"),
  read("../src/screens/Settings/LiveSettingsSection.tsx"),
  read("../src/screens/Settings/index.ts"),
  read("../supabase/functions/settings-evidence-data/index.ts"),
  read("../supabase/functions/settings-evidence-data/auth.ts"),
  read("../supabase/migrations/20260721175500_grant_authenticated_system_health_evidence.sql"),
]);

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);
const mustNotMatch = (source, pattern, message) => assert.doesNotMatch(source, pattern, message);

mustMatch(demoBanner, /data-demo-simulation="true"/, "Demo workflows must retain a persistent simulation marker");
mustMatch(invokeEvidence, /attempt < 3/, "Transient evidence transport failures must use a bounded retry");
mustMatch(invokeEvidence, /TRANSIENT_MESSAGE/, "Only recognised transport failures may be retried");
mustMatch(invokeEvidence, /supabase\.functions\.invoke\(slug/, "Evidence retries must still use the authenticated Supabase client");

for (const [label, entry, liveName, publicIndex] of [
  ["Career", careerEntry, "LiveCareerSection", careerIndex],
  ["Support", supportEntry, "LiveSupportSection", supportIndex],
  ["Settings", settingsEntry, "LiveSettingsSection", settingsIndex],
]) {
  mustMatch(entry, /VITE_VORTA_DATA_MODE/, `${label} must select its view from explicit data mode`);
  mustMatch(entry, new RegExp(`if \\(isLivePilotMode\\) return <${liveName} \\/>`), `${label} must use its read-only live view`);
  mustMatch(entry, /DemoSimulationBanner/, `${label} demo mode must display the simulation warning`);
  mustMatch(publicIndex, /RouteEntry as/, `${label} public export must use the mode-aware entry`);
}

for (const validator of [
  "validateCareerEvidencePayload",
  "validateSupportEvidencePayload",
  "validateSettingsEvidencePayload",
  "validateSystemHealthData",
]) {
  mustMatch(evidenceContracts, new RegExp(`export function ${validator}`), `${validator} must be present`);
}
mustMatch(evidenceContracts, /must be between 0 and 100/, "Career readiness must be range checked");
mustMatch(evidenceContracts, /must match the response siteId/, "Settings site metadata must match response scope");
mustMatch(evidenceContracts, /must match the response organisationId/, "Settings organisation metadata must match response scope");

for (const [label, source, validator, slug, withheld] of [
  ["Career", careerLive, "validateCareerEvidencePayload", "career-evidence-data", "Career evidence was withheld"],
  ["Support", supportLive, "validateSupportEvidencePayload", "support-evidence-data", "Support evidence was withheld"],
  ["Settings", settingsLive, "validateSettingsEvidencePayload", "settings-evidence-data", "Settings evidence was withheld"],
]) {
  mustMatch(source, new RegExp(`${validator}\\(.*(?:data|settings)`, "s"), `${label} must validate function evidence before rendering`);
  const invokesDirectly = new RegExp(`functions\\.invoke\\(\\s*["']${slug}["']`).test(source);
  const invokesWithBoundary = new RegExp(`invokeEvidenceFunction<[^>]+>\\(\\s*["']${slug}["']`).test(source);
  assert.ok(invokesDirectly || invokesWithBoundary, `${label} must use its secured evidence function`);
  mustMatch(source, /siteContext\?\.siteId/, `${label} must require an authenticated active site`);
  mustMatch(source, /organisationId !== siteContext\.organisationId/, `${label} must reject cross-organisation responses`);
  mustMatch(source, new RegExp(withheld), `${label} must expose an explicit fail-closed state`);
  mustMatch(source, /Runtime-validated evidence/, `${label} must identify validated evidence`);
}

mustMatch(careerLive, /workforce evidence, not a personal profile/i, "Live Career must not impersonate a signed-in personal profile");
mustNotMatch(careerLive, /Dallas Clark|READINESS\s*=\s*66|Maintenance & Reliability Director/, "Live Career must not reuse the hardcoded manager story");
mustNotMatch(careerLive, />Save|>Approve|>Complete/, "Live Career must remain read-only");

mustMatch(supportLive, /mailto:support@vorta\.network/, "Live Support must provide a real support contact");
mustNotMatch(supportLive, /Create Ticket|Add Reply|Send Reply|VRT-00/, "Live Support must not expose simulated ticket mutations or IDs");

mustMatch(settingsLive, /invokeEvidenceFunction<unknown>/, "Live Settings must use the bounded evidence transport boundary");
mustMatch(settingsLive, /validateSystemHealthData\(settings\.health\)/, "Live Settings must validate health returned by the secured function");
mustNotMatch(settingsLive, /getSystemHealth\(|\.rpc\(/, "Live Settings must not call protected health RPCs from the browser");
mustNotMatch(settingsLive, /Save changes|Send Invite|Invite Team Member|finance@vortademo|VORTA-2026-MAINT/, "Live Settings must not expose demo mutations or billing values");

for (const [label, auth, fn] of [
  ["Career", careerAuth, careerFunction],
  ["Support", supportAuth, supportFunction],
  ["Settings", settingsAuth, settingsFunction],
]) {
  mustMatch(auth, /auth\.getUser\(token\)/, `${label} must verify the caller JWT`);
  mustMatch(auth, /from\("profiles"\)/, `${label} must resolve the verified profile`);
  mustMatch(auth, /from\("user_site_access"\)/, `${label} must resolve active-site access`);
  mustMatch(auth, /eq\("active", true\)/, `${label} must require active site access`);
  mustMatch(auth, /SUPABASE_SERVICE_ROLE_KEY/, `${label} may use privileged reads only after caller verification`);
  mustMatch(auth, /127\.0\.0\.1:4173/, `${label} must allow the authenticated browser-test origin`);
  mustMatch(auth, /deploy-preview-\\d\+--vorta-app/, `${label} must allow Netlify deploy previews without wildcard CORS`);
  mustNotMatch(auth + fn, /Access-Control-Allow-Origin["']?:\s*["']\*["']/, `${label} must not use wildcard CORS`);
  mustMatch(fn, /siteId,\s*organisationId,\s*generatedAt:/, `${label} must return explicit evidence scope metadata`);
}

mustMatch(careerFunction, /from\("engineers"\)[\s\S]*eq\("site_id", siteId\)[\s\S]*eq\("organisation_id", organisationId\)/, "Career evidence must begin from site-scoped engineers");
mustMatch(careerFunction, /from\("engineer_career_paths"\)/, "Career evidence must use persisted career paths");
mustMatch(careerFunction, /from\("engineer_career_path_requirements"\)/, "Career evidence must use persisted development requirements");

mustMatch(supportFunction, /from\("support_requests"\)[\s\S]*eq\("site_id", siteId\)[\s\S]*eq\("organisation_id", organisationId\)/, "Support requests must be site and organisation scoped");
for (const table of ["support_request_skills", "support_request_matches", "support_sessions", "support_reports"]) {
  mustMatch(supportFunction, new RegExp(`from\\("${table}"\\)`), `Support evidence must include ${table}`);
}

mustMatch(settingsFunction, /from\("sites"\)[\s\S]*eq\("id", siteId\)[\s\S]*eq\("organisation_id", organisationId\)/, "Settings evidence must resolve the exact authorised site");
mustMatch(settingsFunction, /from\("organisations"\)[\s\S]*eq\("id", organisationId\)/, "Settings evidence must resolve the authorised organisation");
mustMatch(settingsFunction, /select\("site_id,setting_group,setting_key,description,updated_at"\)/, "Settings may expose setting-key metadata only");
mustNotMatch(settingsFunction, /setting_value/, "Settings evidence must never fetch or return setting values");
mustMatch(settingsAuth, /const userDb = createClient[\s\S]*Authorization: `Bearer \$\{token\}`/, "Settings health RPCs must execute in the verified caller context");
for (const rpc of [
  "vorta_get_system_health_summary",
  "vorta_get_system_health_incidents",
  "vorta_get_latest_recovery_manifest",
]) {
  mustMatch(settingsFunction, new RegExp(`userDb\\.rpc\\("${rpc}"`), `Settings evidence must include ${rpc} through caller context`);
  mustMatch(healthGrantMigration, new RegExp(`grant execute on function public\\.${rpc}`), `${rpc} must be granted narrowly to authenticated callers`);
}
mustMatch(healthGrantMigration, /revoke all[\s\S]*from public, anon/, "Health RPCs must remain unavailable to public and anonymous callers");

mustMatch(operations, /label: "Career Evidence"[\s\S]*to: "\/career"/, "Live navigation must expose Career evidence");
mustMatch(operations, /label: isLivePilotMode \? "Support Evidence" : "Support"/, "Live navigation must expose Support evidence");
mustMatch(operations, /label: isLivePilotMode \? "System & Access" : "Settings"/, "Live navigation must expose system and access evidence");
mustMatch(operations, /<Route path="career" element=\{<CareerSection \/>\}/, "Career route must use its mode-aware entry");
mustMatch(operations, /<Route path="support" element=\{<SupportSection \/>\}/, "Support route must use its mode-aware entry");
mustMatch(operations, /<Route path="settings" element=\{<SettingsSection \/>\}/, "Settings route must use its mode-aware entry");
mustNotMatch(operations, /LivePilotUnavailable/, "The live evidence routes must no longer use the generic restriction page");

console.log("Live Career, Support and Settings contracts passed.");
