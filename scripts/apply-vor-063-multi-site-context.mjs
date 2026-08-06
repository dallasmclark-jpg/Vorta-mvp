import { readFileSync, writeFileSync } from "node:fs";

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) {
    throw new Error(`VOR-063 patch point missing: ${label}`);
  }
  return source.replace(before, after);
}

const authPath = "src/lib/auth.tsx";
let auth = readFileSync(authPath, "utf8");

auth = replaceRequired(
  auth,
  'import { supabase } from "./supabaseClient";\n',
  'import { supabase } from "./supabaseClient";\nimport {\n  chooseAuthorisedSiteGrant,\n  findAuthorisedSiteGrant,\n  type SiteAccessGrant,\n} from "./siteAccessContext";\nexport type { SiteAccessGrant } from "./siteAccessContext";\n',
  "site context helper import",
);

auth = replaceRequired(
  auth,
  "  siteContext: ActiveSiteContext | null;\n  isDemoAdmin: boolean;",
  "  siteContext: ActiveSiteContext | null;\n  siteAccesses: readonly SiteAccessGrant<PilotRole>[];\n  selectSite: (siteId: string) => boolean;\n  isDemoAdmin: boolean;",
  "context interface",
);

auth = replaceRequired(
  auth,
  "  siteContext: null,\n  isDemoAdmin: false,",
  "  siteContext: null,\n  siteAccesses: [],\n  selectSite: () => false,\n  isDemoAdmin: false,",
  "context defaults",
);

auth = replaceRequired(
  auth,
  "const AUTH_INITIALISATION_TIMEOUT_MS =\n  15_000;\n",
  "const AUTH_INITIALISATION_TIMEOUT_MS =\n  15_000;\n\nconst SELECTED_SITE_STORAGE_PREFIX =\n  \"vorta:selected-site\";\n\nfunction selectedSiteStorageKey(userId: string): string {\n  return `${SELECTED_SITE_STORAGE_PREFIX}:${userId}`;\n}\n",
  "per-user storage key",
);

auth = replaceRequired(
  auth,
  "  const [siteContext, setSiteContext] =\n    useState<ActiveSiteContext | null>(null);\n  const [loading, setLoading] = useState(true);",
  "  const [siteContext, setSiteContext] =\n    useState<ActiveSiteContext | null>(null);\n  const [siteAccesses, setSiteAccesses] =\n    useState<readonly SiteAccessGrant<PilotRole>[]>([]);\n  const [loading, setLoading] = useState(true);",
  "site grants state",
);

auth = auth.replaceAll(
  "      setSiteContext(null);\n      setRoleResolutionFailed(false);",
  "      setSiteContext(null);\n      setSiteAccesses([]);\n      setRoleResolutionFailed(false);",
);
auth = auth.replaceAll(
  "        setRole(metadataRole);\n        setSiteContext(null);\n",
  "        setRole(metadataRole);\n        setSiteContext(null);\n        setSiteAccesses([]);\n",
);
auth = auth.replaceAll(
  "        setRole(null);\n        setSiteContext(null);\n\n        setRoleResolutionFailed(",
  "        setRole(null);\n        setSiteContext(null);\n        setSiteAccesses([]);\n\n        setRoleResolutionFailed(",
);
auth = auth.replaceAll(
  "          setRole(null);\n          setSiteContext(null);\n\n          setRoleResolutionFailed(",
  "          setRole(null);\n          setSiteContext(null);\n          setSiteAccesses([]);\n\n          setRoleResolutionFailed(",
);

auth = replaceRequired(
  auth,
  "              )\n              .limit(1)\n              .maybeSingle(),",
  "              ),",
  "all active site grants",
);

auth = replaceRequired(
  auth,
  "        const accessData = accessResult.data as unknown as {\n          site_id: string;\n          organisation_id: string;\n          app_role: unknown;\n          is_default: boolean;\n        } | null;",
  "        const accessRows = (accessResult.data ?? []) as unknown as Array<{\n          site_id: string;\n          organisation_id: string;\n          app_role: unknown;\n          is_default: boolean;\n        }>;",
  "access rows",
);

auth = replaceRequired(
  auth,
  "        const accessRole = normalisePilotRole(\n          accessData?.app_role,\n        );\n\n        const profileRole = normalisePilotRole(",
  "        const grants = accessRows.reduce<SiteAccessGrant<PilotRole>[]>(\n          (authorised, row) => {\n            const grantRole = normalisePilotRole(row.app_role);\n            const hasCompleteIdentity =\n              typeof row.site_id === \"string\" &&\n              row.site_id.length > 0 &&\n              typeof row.organisation_id === \"string\" &&\n              row.organisation_id.length > 0;\n\n            if (\n              !grantRole ||\n              !hasCompleteIdentity ||\n              authorised.some((grant) => grant.siteId === row.site_id)\n            ) {\n              return authorised;\n            }\n\n            authorised.push({\n              siteId: row.site_id,\n              organisationId: row.organisation_id,\n              role: grantRole,\n              isDefault: row.is_default === true,\n            });\n\n            return authorised;\n          },\n          [],\n        );\n\n        const storedSiteId = window.localStorage.getItem(\n          selectedSiteStorageKey(nextUserId),\n        );\n\n        const selectedGrant = chooseAuthorisedSiteGrant(\n          grants,\n          storedSiteId,\n        );\n\n        const accessRole = selectedGrant?.role ?? null;\n\n        const profileRole = normalisePilotRole(",
  "grant normalization and selection",
);

auth = replaceRequired(
  auth,
  "        if (\n          accessData &&\n          effectiveRole\n        ) {\n          setSiteContext({\n            siteId: accessData.site_id,\n            organisationId:\n              accessData.organisation_id,\n            role: effectiveRole,\n            isDefault:\n              accessData.is_default,\n          });\n        } else {\n          setSiteContext(null);\n        }",
  "        setSiteAccesses(grants);\n\n        if (selectedGrant && effectiveRole) {\n          const nextSiteContext: ActiveSiteContext = {\n            ...selectedGrant,\n            role: effectiveRole,\n          };\n\n          setSiteContext(nextSiteContext);\n          window.localStorage.setItem(\n            selectedSiteStorageKey(nextUserId),\n            nextSiteContext.siteId,\n          );\n        } else {\n          setSiteContext(null);\n        }",
  "active context hydration",
);

auth = replaceRequired(
  auth,
  "  const isDemoAdmin =\n    resolveDemoAdmin(session) ||\n    role === \"vorta_admin\";\n",
  "  const selectSite = (siteId: string): boolean => {\n    if (!session) {\n      return false;\n    }\n\n    const matchingGrant = findAuthorisedSiteGrant(\n      siteAccesses,\n      siteId,\n    );\n\n    if (!matchingGrant) {\n      return false;\n    }\n\n    setSiteContext(matchingGrant);\n    setRole(matchingGrant.role);\n    window.localStorage.setItem(\n      selectedSiteStorageKey(session.user.id),\n      matchingGrant.siteId,\n    );\n\n    return true;\n  };\n\n  const isDemoAdmin =\n    resolveDemoAdmin(session) ||\n    role === \"vorta_admin\";\n",
  "bounded site selection",
);

auth = replaceRequired(
  auth,
  "        siteContext,\n        isDemoAdmin,",
  "        siteContext,\n        siteAccesses,\n        selectSite,\n        isDemoAdmin,",
  "provider context values",
);

for (const required of [
  "siteAccesses: readonly SiteAccessGrant<PilotRole>[]",
  "chooseAuthorisedSiteGrant(",
  "findAuthorisedSiteGrant(",
  "setSiteAccesses([])",
  "selectedSiteStorageKey(session.user.id)",
]) {
  if (!auth.includes(required)) {
    throw new Error(`VOR-063 final source contract missing: ${required}`);
  }
}

writeFileSync(authPath, auth);

writeFileSync(
  "src/lib/siteAccessContext.ts",
  `export interface SiteAccessGrant<Role extends string = string> {\n  siteId: string;\n  organisationId: string;\n  role: Role;\n  isDefault: boolean;\n}\n\nexport function findAuthorisedSiteGrant<\n  Role extends string,\n>(\n  grants: readonly SiteAccessGrant<Role>[],\n  siteId: string | null | undefined,\n): SiteAccessGrant<Role> | null {\n  if (!siteId) {\n    return null;\n  }\n\n  return grants.find((grant) => grant.siteId === siteId) ?? null;\n}\n\nexport function chooseAuthorisedSiteGrant<\n  Role extends string,\n>(\n  grants: readonly SiteAccessGrant<Role>[],\n  storedSiteId: string | null | undefined,\n): SiteAccessGrant<Role> | null {\n  return (\n    findAuthorisedSiteGrant(grants, storedSiteId) ??\n    grants.find((grant) => grant.isDefault) ??\n    grants[0] ??\n    null\n  );\n}\n`,
);

writeFileSync(
  "scripts/vor-063-multi-site-context-tests.mjs",
  `import assert from "node:assert/strict";\nimport { mkdirSync, rmSync } from "node:fs";\nimport { pathToFileURL } from "node:url";\nimport { build } from "esbuild";\n\nconst outputDir = ".tmp/vor-063";\nconst outputFile = \`\${outputDir}/site-access-context.mjs\`;\nmkdirSync(outputDir, { recursive: true });\n\nawait build({\n  entryPoints: ["src/lib/siteAccessContext.ts"],\n  bundle: true,\n  platform: "node",\n  format: "esm",\n  target: "es2022",\n  outfile: outputFile,\n  logLevel: "silent",\n});\n\nconst { chooseAuthorisedSiteGrant, findAuthorisedSiteGrant } = await import(\n  \`\${pathToFileURL(process.cwd() + "/" + outputFile).href}?t=\${Date.now()}\`,\n);\n\nconst grants = [\n  { siteId: "site-a", organisationId: "org-a", role: "maintenance_manager", isDefault: false },\n  { siteId: "site-b", organisationId: "org-b", role: "reliability_engineer", isDefault: true },\n  { siteId: "site-c", organisationId: "org-c", role: "site_admin", isDefault: false },\n];\n\nassert.equal(chooseAuthorisedSiteGrant(grants, "site-c")?.siteId, "site-c", "stored authorised site wins");\nassert.equal(chooseAuthorisedSiteGrant(grants, "stale-site")?.siteId, "site-b", "stale stored site falls back to verified default");\nassert.equal(chooseAuthorisedSiteGrant(grants.map((grant) => ({ ...grant, isDefault: false })), null)?.siteId, "site-a", "first deterministic grant is final fallback");\nassert.equal(chooseAuthorisedSiteGrant([], "site-a"), null, "no authorised grants fails closed");\nassert.equal(findAuthorisedSiteGrant(grants, "site-b")?.role, "reliability_engineer", "site-specific role stays attached to grant");\nassert.equal(findAuthorisedSiteGrant(grants, "cross-site"), null, "unknown site cannot be selected");\nassert.equal(findAuthorisedSiteGrant(grants, null), null, "empty selection cannot be authorised");\n\nrmSync(outputDir, { recursive: true, force: true });\nconsole.log("VOR-063 focused tests passed: authorised multi-site selection and fallbacks are deterministic and fail closed.");\n`,
);

writeFileSync(
  "scripts/vor-063-multi-site-context-contracts.mjs",
  `import assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\nimport { spawnSync } from "node:child_process";\n\nconst auth = readFileSync("src/lib/auth.tsx", "utf8");\nconst helper = readFileSync("src/lib/siteAccessContext.ts", "utf8");\n\nfor (const required of [\n  'siteAccesses: readonly SiteAccessGrant<PilotRole>[]',\n  'selectSite: (siteId: string) => boolean',\n  'const accessRows = (accessResult.data ?? [])',\n  'chooseAuthorisedSiteGrant(',\n  'findAuthorisedSiteGrant(',\n  'selectedSiteStorageKey(nextUserId)',\n  'selectedSiteStorageKey(session.user.id)',\n  'setSiteAccesses([])',\n]) assert.ok(auth.includes(required), \`VOR-063 missing auth contract: \${required}\`);\n\nassert.ok(!/user_site_access[\\s\\S]{0,700}\\.limit\\(1\\)[\\s\\S]{0,80}\\.maybeSingle\\(\\)/.test(auth), "VOR-063 must not collapse site access to one row");\nassert.ok(!/service_role|SUPABASE_SERVICE_ROLE/.test(auth), "VOR-063 browser auth must not use privileged credentials");\nassert.ok(helper.includes("storedSiteId"));\nassert.ok(helper.includes("grant.isDefault"));\nassert.ok(helper.includes("grants[0]"));\n\nconst focused = spawnSync(process.execPath, ["scripts/vor-063-multi-site-context-tests.mjs"], { stdio: "inherit" });\nassert.equal(focused.status, 0, "VOR-063 focused selection tests failed");\n\nconsole.log("VOR-063 permanent contracts passed: complete RLS-visible grants, bounded selection and fail-closed clearing are retained.");\n`,
);

let suite = readFileSync("scripts/run-contract-suite.mjs", "utf8");
suite = replaceRequired(
  suite,
  '  ["VOR-062 site risk movement", "scripts/vor-062-site-risk-movement-contracts.mjs"],',
  '  ["VOR-062 site risk movement", "scripts/vor-062-site-risk-movement-contracts.mjs"],\n  ["VOR-063 verified multi-site context", "scripts/vor-063-multi-site-context-contracts.mjs"],',
  "contract suite registration",
);
writeFileSync("scripts/run-contract-suite.mjs", suite);

console.log("VOR-063 current-main multi-site context implementation applied.");
