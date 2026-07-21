import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  runtimeContracts,
  liveRequirements,
  routeEntry,
  requirementsIndex,
  functionIndex,
  functionAuth,
  functionTransform,
] = await Promise.all([
  read("../src/lib/runtimeContracts.ts"),
  read("../src/screens/Requirements/LiveRequirementsSection.tsx"),
  read("../src/screens/Requirements/RequirementsRouteEntry.tsx"),
  read("../src/screens/Requirements/index.ts"),
  read("../supabase/functions/requirements-data/index.ts"),
  read("../supabase/functions/requirements-data/auth.ts"),
  read("../supabase/functions/requirements-data/transform.ts"),
]);

const mustMatch = (source, pattern, message) => assert.match(source, pattern, message);
const mustNotMatch = (source, pattern, message) => assert.doesNotMatch(source, pattern, message);

mustMatch(
  runtimeContracts,
  /export function validateRequirementsPayload/,
  "Requirements responses must have a dedicated runtime contract",
);
for (const field of ["siteId", "organisationId", "generatedAt"]) {
  mustMatch(
    runtimeContracts,
    new RegExp(`requireStringField\\(payload, "${field}"`),
    `Requirements contract must validate ${field}`,
  );
}
for (const field of ["requirements", "coverageByGroup", "certExpiries", "actionRows", "departments"]) {
  mustMatch(
    runtimeContracts,
    new RegExp(`requireArrayField\\(payload, "${field}"`),
    `Requirements contract must validate ${field}`,
  );
}
mustMatch(
  runtimeContracts,
  /coverage < 0 \|\| coverage > 100/,
  "Requirements coverage values must be range checked",
);

mustMatch(
  liveRequirements,
  /validateRequirementsPayload\(data\)/,
  "Live Requirements must validate the edge-function response before rendering",
);
mustMatch(
  liveRequirements,
  /RuntimeContractError/,
  "Live Requirements must surface contract failures explicitly",
);
mustMatch(
  liveRequirements,
  /siteContext\?\.siteId/,
  "Live Requirements must require an authenticated site context",
);
mustMatch(
  liveRequirements,
  /supabase\.functions\.invoke\("requirements-data"\)/,
  "Live Requirements must use the active-site data function",
);
mustMatch(
  liveRequirements,
  /Read-only live pilot/,
  "Live Requirements must state its read-only boundary",
);
mustMatch(
  liveRequirements,
  /Malformed or incomplete responses are withheld/,
  "Live Requirements must explain its fail-closed evidence handling",
);
mustMatch(
  liveRequirements,
  /aria-label=\{`Review \$\{requirement\.title\}`\}/,
  "Requirement review actions must have descriptive accessible names",
);
mustMatch(
  liveRequirements,
  /focus-visible:ring-2/,
  "Requirement review actions must expose a visible keyboard focus state",
);
mustNotMatch(
  liveRequirements,
  /<tr[^>]*onClick=/,
  "Live Requirements rows must not rely on mouse-only row activation",
);
mustNotMatch(
  liveRequirements,
  /Add Requirement|TrendIndicator|Alpha Manufacturing/,
  "Live Requirements must not show demo-only actions, trends or tenant labels",
);

mustMatch(functionAuth, /authClient\.auth\.getUser\(token\)/, "Requirements must validate the caller JWT");
mustMatch(functionAuth, /SUPABASE_SERVICE_ROLE_KEY/, "Requirements may use service credentials only after caller verification");
mustMatch(functionAuth, /\.from\("user_site_access"\)/, "Requirements must resolve active site access from the verified user");
mustMatch(functionAuth, /ALLOWED_ROLES\.has\(role\)/, "Requirements must enforce allowed portal roles");
mustMatch(functionAuth, /http:\/\/127\.0\.0\.1:4173/, "Requirements must accept the browser-gate origin");
mustNotMatch(functionAuth, /vorta_get_function_context/, "Requirements must not depend on the restricted context RPC");
mustNotMatch(functionAuth, /Access-Control-Allow-Origin"\s*:\s*"\*"/, "Requirements must not restore wildcard browser access");

mustMatch(functionIndex, /\.eq\("site_id", siteId\)/, "Requirements queries must be active-site scoped");
mustMatch(functionIndex, /\.eq\("organisation_id", organisationId\)/, "Requirements queries must be organisation scoped");
mustMatch(functionIndex, /siteId,[\s\S]*organisationId,[\s\S]*generatedAt/, "Requirements responses must include evidence metadata");
mustMatch(functionIndex, /import \{ context, preflight, response \}/, "Requirements must use the secured request boundary");
mustMatch(functionIndex, /import \{ build \}/, "Requirements response transformation must remain isolated from access control");
mustMatch(functionTransform, /coverageByGroup/, "Requirements transform must retain coverage evidence");
mustMatch(functionTransform, /certExpiries/, "Requirements transform must retain certification evidence");

mustMatch(
  routeEntry,
  /VITE_VORTA_DATA_MODE/,
  "Requirements route selection must use the explicit data mode",
);
mustMatch(
  routeEntry,
  /isLivePilotMode \? <LiveRequirementsSection \/> : <DemoRequirementsSection \/>/,
  "Live and demo Requirements must remain explicitly separated",
);
mustMatch(
  requirementsIndex,
  /RequirementsRouteEntry as RequirementsSection/,
  "The public Requirements export must use the mode-aware route entry",
);

console.log("Requirements live evidence contracts passed.");
