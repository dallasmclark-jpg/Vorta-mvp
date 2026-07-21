import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  operations,
  runtimeContracts,
  demoBanner,
  trainingEntry,
  trainingLive,
  trainingIndex,
  matchingEntry,
  matchingLive,
  matchingIndex,
  providersEntry,
  providersLive,
  providersIndex,
  trainingFunction,
  trainingAuth,
  matchingFunction,
  matchingAuth,
  providersFunction,
  providersAuth,
] = await Promise.all([
  read("../src/screens/AiOperations/AiOperations.tsx"),
  read("../src/lib/runtimeContracts.ts"),
  read("../src/components/DemoSimulationBanner.tsx"),
  read("../src/screens/Training/TrainingRouteEntry.tsx"),
  read("../src/screens/Training/LiveTrainingSection.tsx"),
  read("../src/screens/Training/index.ts"),
  read("../src/screens/AiMatching/AiMatchingRouteEntry.tsx"),
  read("../src/screens/AiMatching/LiveAiMatchingSection.tsx"),
  read("../src/screens/AiMatching/index.ts"),
  read("../src/screens/TrainingProviders/TrainingProvidersRouteEntry.tsx"),
  read("../src/screens/TrainingProviders/LiveTrainingProvidersSection.tsx"),
  read("../src/screens/TrainingProviders/index.ts"),
  read("../supabase/functions/training-data/index.ts"),
  read("../supabase/functions/training-data/auth.ts"),
  read("../supabase/functions/ai-matching-data/index.ts"),
  read("../supabase/functions/ai-matching-data/auth.ts"),
  read("../supabase/functions/training-providers-data/index.ts"),
  read("../supabase/functions/training-providers-data/auth.ts"),
]);

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);
const mustNotMatch = (source, pattern, message) => assert.doesNotMatch(source, pattern, message);

mustMatch(demoBanner, /data-demo-simulation="true"/, "Demo workflows must have a persistent simulation marker");
mustMatch(demoBanner, /Demo simulation/, "Demo workflows must be labelled as simulations");

for (const [label, entry, liveName, publicIndex] of [
  ["Training", trainingEntry, "LiveTrainingSection", trainingIndex],
  ["AI Matching", matchingEntry, "LiveAiMatchingSection", matchingIndex],
  ["Training Providers", providersEntry, "LiveTrainingProvidersSection", providersIndex],
]) {
  mustMatch(entry, /VITE_VORTA_DATA_MODE/, `${label} must select its view from explicit data mode`);
  mustMatch(entry, new RegExp(`if \\(isLivePilotMode\\) return <${liveName} \\/>`), `${label} must use its read-only live view`);
  mustMatch(entry, /DemoSimulationBanner/, `${label} demo mode must display the simulation warning`);
  mustMatch(publicIndex, /RouteEntry as/, `${label} public export must use the mode-aware entry`);
}

for (const [label, source, validator, functionSlug, errorHeading] of [
  ["Training", trainingLive, "validateTrainingPayload", "training-data", "Training evidence was withheld"],
  ["AI Matching", matchingLive, "validateAiMatchingPayload", "ai-matching-data", "AI matching evidence was withheld"],
  ["Training Providers", providersLive, "validateTrainingProvidersPayload", "training-providers-data", "Provider evidence was withheld"],
]) {
  mustMatch(source, new RegExp(`${validator}\\(\\s*data\\s*,?\\s*\\)`), `${label} must validate its function response`);
  mustMatch(source, new RegExp(`functions\\.invoke\\(\\s*[\"']${functionSlug}[\"']`), `${label} must use its evidence function`);
  mustMatch(source, /siteContext\?\.siteId/, `${label} must require an authenticated active site`);
  mustMatch(source, /organisationId !== siteContext\.organisationId/, `${label} must reject cross-organisation responses`);
  mustMatch(source, new RegExp(errorHeading), `${label} must expose an explicit fail-closed state`);
  mustMatch(source, /Runtime-validated evidence/, `${label} must identify validated evidence`);
  mustNotMatch(source, />Approve Booking</, `${label} live mode must not approve bookings`);
  mustNotMatch(source, />Mark Completed</, `${label} live mode must not complete bookings`);
  mustNotMatch(source, />Accept Recommendation</, `${label} live mode must not accept recommendations`);
  mustNotMatch(source, />Dismiss</, `${label} live mode must not dismiss recommendations`);
  mustNotMatch(source, />Shortlist Provider</, `${label} live mode must not create shortlists`);
  mustNotMatch(source, />Request Availability</, `${label} live mode must not send provider requests`);
}

for (const validator of [
  "validateTrainingPayload",
  "validateAiMatchingPayload",
  "validateTrainingProvidersPayload",
]) {
  mustMatch(runtimeContracts, new RegExp(`export function ${validator}`), `${validator} must be present`);
}
mustMatch(runtimeContracts, /requirePercentage/, "Training workflow scores must be range checked");

mustMatch(operations, /label: "AI Matching"[\s\S]*to: "\/ai-matching"/, "Live navigation must expose AI Matching evidence");
mustMatch(operations, /label: "Training Evidence"[\s\S]*to: "\/training"/, "Live navigation must expose Training evidence");
mustMatch(operations, /label: "Provider Evidence"[\s\S]*to: "\/training-providers"/, "Live navigation must expose provider evidence");
mustMatch(operations, /<Route path="training" element=\{<TrainingSection \/>\}/, "Training route must use its mode-aware entry");
mustMatch(operations, /<Route path="training-providers" element=\{<TrainingProvidersSection \/>\}/, "Provider route must use its mode-aware entry");
mustMatch(operations, /<Route path="ai-matching" element=\{<AiMatchingSection \/>\}/, "AI Matching route must use its mode-aware entry");

for (const [label, auth, fn] of [
  ["Training", trainingAuth, trainingFunction],
  ["AI Matching", matchingAuth, matchingFunction],
  ["Training Providers", providersAuth, providersFunction],
]) {
  mustMatch(auth, /auth\.getUser\(token\)/, `${label} must verify the caller JWT`);
  mustMatch(auth, /from\("profiles"\)/, `${label} must resolve the verified profile`);
  mustMatch(auth, /from\("user_site_access"\)/, `${label} must resolve active-site access`);
  mustMatch(auth, /eq\("active", true\)/, `${label} must require active site access`);
  mustMatch(auth, /SUPABASE_SERVICE_ROLE_KEY/, `${label} may use privileged reads only after caller verification`);
  mustMatch(auth, /127\.0\.0\.1:4173/, `${label} must allow the authenticated browser test origin`);
  mustMatch(auth, /deploy-preview-\\d\+--vorta-app/, `${label} must allow Netlify deploy previews without wildcard CORS`);
  mustNotMatch(auth + fn, /Access-Control-Allow-Origin["']?:\s*["']\*["']/, `${label} must not use wildcard CORS`);
  mustNotMatch(auth + fn, /vorta_get_function_context/, `${label} must not depend on the restricted context RPC`);
  mustMatch(fn, /siteId,\s*organisationId,\s*generatedAt:/, `${label} must return explicit evidence scope metadata`);
  mustMatch(fn, /eq\("site_id", siteId\)/, `${label} must scope site-owned evidence`);
  mustMatch(fn, /eq\("organisation_id", organisationId\)/, `${label} must scope organisation-owned evidence`);
}

mustMatch(trainingFunction, /in\("engineer_id", engineerIds\)/, "Training bookings and skills must be limited to active-site engineers");
mustMatch(matchingFunction, /in\("engineer_id", engineerIds\)/, "AI Matching must use only active-site engineer evidence");
mustMatch(providersFunction, /siteEngineerIds\.has/, "Provider enquiries must be attributable to active-site engineers");
mustMatch(providersFunction, /siteGapIds\.has/, "Provider enquiries must be attributable to active-site requirements");

console.log("Read-only training workflow contracts passed.");
