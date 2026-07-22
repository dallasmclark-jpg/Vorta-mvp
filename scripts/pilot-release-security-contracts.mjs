import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  careerAuth,
  supportAuth,
  settingsAuth,
  trainingAuth,
  aiMatchingAuth,
  providersAuth,
  engineersAuth,
  requirementsAuth,
  skillsMatrixAuth,
  headers,
  netlify,
  packageJson,
  livePilotGuard,
] = await Promise.all([
  read("../supabase/functions/career-evidence-data/auth.ts"),
  read("../supabase/functions/support-evidence-data/auth.ts"),
  read("../supabase/functions/settings-evidence-data/auth.ts"),
  read("../supabase/functions/training-data/auth.ts"),
  read("../supabase/functions/ai-matching-data/auth.ts"),
  read("../supabase/functions/training-providers-data/auth.ts"),
  read("../supabase/functions/engineers-data/auth.ts"),
  read("../supabase/functions/requirements-data/auth.ts"),
  read("../supabase/functions/skills-matrix-data/auth.ts"),
  read("../public/_headers"),
  read("../netlify.toml"),
  read("../package.json"),
  read("./validate-live-pilot.mjs"),
]);

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);

for (const [label, source] of [
  ["Career", careerAuth],
  ["Support", supportAuth],
  ["Settings", settingsAuth],
  ["Training", trainingAuth],
  ["AI Matching", aiMatchingAuth],
  ["Training Providers", providersAuth],
  ["Engineers", engineersAuth],
  ["Requirements", requirementsAuth],
  ["Skills Matrix", skillsMatrixAuth],
]) {
  mustMatch(source, /SAFE_PUBLIC_ERROR_STATUSES/, `${label} must preserve only controlled client errors`);
  mustMatch(source, /status < 500/, `${label} must distinguish server failures from controlled responses`);
  mustMatch(source, /crypto\.randomUUID\(\)/, `${label} server failures must receive a correlation ID`);
  mustMatch(source, /publicResponseBody\(body, status\)/, `${label} responses must pass through the sanitizer`);
  mustMatch(source, /temporarily unavailable/, `${label} must return a generic server-failure message`);
  mustMatch(source, /https:\/\/pilot-live--vorta-app\.netlify\.app/, `${label} must allow the controlled pilot branch origin`);
  mustMatch(source, /deploy-preview-\\d\+--vorta-app/, `${label} must retain preview-origin coverage`);
}

mustMatch(headers, /X-Frame-Options:\s*DENY/, "Production must deny framing");
mustMatch(headers, /Strict-Transport-Security:\s*max-age=31536000/, "Production must advertise HTTPS persistence");
mustMatch(headers, /Content-Security-Policy-Report-Only:/, "CSP must begin in report-only mode");
mustMatch(headers, /frame-ancestors 'none'/, "CSP must deny framing");
mustMatch(headers, /connect-src[^\n]*supabase\.co/, "CSP must explicitly allow Supabase connections");

mustMatch(netlify, /node scripts\/validate-data-mode\.mjs && npm run build/, "Netlify must retain the production data-mode guard");
mustMatch(netlify, /\[context\.production\.environment\][\s\S]*VITE_VORTA_DATA_MODE = "demo"/, "Public production must remain demo-only");
mustMatch(netlify, /\[context\.pilot-live\.environment\][\s\S]*VITE_VORTA_DATA_MODE = "live"/, "The pilot-live branch must use live data mode");
mustMatch(netlify, /VORTA_LIVE_PILOT_APPROVED = "true"/, "The controlled pilot branch must declare approval");
mustMatch(packageJson, /"build": "node scripts\/validate-live-pilot\.mjs &&/, "Every production build must run the live-pilot guard");

mustMatch(livePilotGuard, /context === "branch-deploy" && branch === "pilot-live"/, "Live branch deploys must be restricted to pilot-live");
mustMatch(livePilotGuard, /context === "production" && siteName === "vorta-pilot"/, "A dedicated production pilot project must use the expected site name");
mustMatch(livePilotGuard, /VORTA_LIVE_PILOT_APPROVED/, "Live builds must require explicit pilot approval");
mustMatch(livePilotGuard, /startsWith\("https:\/\/"\)/, "Live builds must require HTTPS Supabase access");

console.log("Pilot release security contracts passed.");
