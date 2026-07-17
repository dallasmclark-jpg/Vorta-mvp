import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const pagePath = new URL(
  "../src/screens/SkillsMatrix/SkillsMatrixNative.tsx",
  import.meta.url,
);
const contractPath = new URL(
  "./skills-matrix-contracts.mjs",
  import.meta.url,
);

let page = await readFile(pagePath, "utf8");

function replaceOnce(pattern, replacement, label) {
  assert.match(page, pattern, `Skills Matrix codemod could not find ${label}`);
  page = page.replace(pattern, replacement);
}

replaceOnce(
  /type ScopeEngineer = \{\n  id: string;\n  name: string;\n/,
  'type ScopeEngineer = {\n  id: string;\n  name: string;\n  avatarUrl: string | null;\n',
  "ScopeEngineer avatar field",
);

replaceOnce(
  /type SkillsMatrixPayload = \{\n  generatedAt: string;\n/,
  'type SkillsMatrixPayload = {\n  generatedAt: string;\n  sourceUpdatedAt: string;\n',
  "source freshness field",
);

replaceOnce(
  /  departments: ScopeSummary\[\];\n  details: Record<string, ScopeDetail>;\n/,
  '  departments: ScopeSummary[];\n  areaSkills: Record<string, string[]>;\n  details: Record<string, ScopeDetail>;\n',
  "area skill payload field",
);

replaceOnce(
  /function normaliseSkillsMatrixPayload\([\s\S]*?\n}\n\nfunction statusBadgeClass/,
  `function normaliseSkillsMatrixPayload(\n  payload: SkillsMatrixPayload,\n): SkillsMatrixPayload {\n  return payload;\n}\n\nfunction statusBadgeClass`,
  "frontend score normalisation",
);

replaceOnce(
  /  const \[avatarUrls, setAvatarUrls\] = useState<Map<string, string>>\(new Map\(\)\);\n  const \[buildingSkills, setBuildingSkills\] = useState<Map<string, Set<string>>>\(new Map\(\)\);\n/,
  "",
  "secondary page data state",
);

replaceOnce(
  /      const normalised = normaliseSkillsMatrixPayload\(payload as SkillsMatrixPayload\);\n      setData\(normalised\);\n      setSelectedScopeId\(\(current\) =>\n        normalised\.details\[current\] \? current : "overall",\n      \);/,
  `      const resolved = normaliseSkillsMatrixPayload(\n        payload as SkillsMatrixPayload,\n      );\n      setData(resolved);\n      setSelectedScopeId((current) =>\n        resolved.details[current] ? current : "overall",\n      );`,
  "resolved payload assignment",
);

replaceOnce(
  /\n  useEffect\(\(\) => \{\n    let active = true;\n    void supabase\n      \.from\("engineers"\)[\s\S]*?\n  \}, \[\]\);\n/,
  "\n",
  "avatar query effect",
);

replaceOnce(
  /\n  useEffect\(\(\) => \{\n    const siteId = data\?\.site\.id;[\s\S]*?\n  \}, \[data\?\.site\.id\]\);\n/,
  "\n",
  "area mapping query effect",
);

replaceOnce(
  /  const scopes = useMemo\(\(\) => \{\n    if \(!data\) return \[\];\n    return \[\n      data\.overall,\n      \.\.\.\(viewMode === "team" \? data\.teams : data\.departments\),\n    \];\n  \}, \[data, viewMode\]\);\n/,
  `  const scopes = useMemo(() => {\n    if (!data) return [];\n    return [\n      data.overall,\n      ...(viewMode === "team" ? data.teams : data.departments),\n    ];\n  }, [data, viewMode]);\n\n  const buildingSkills = useMemo(\n    () =>\n      new Map(\n        Object.entries(data?.areaSkills ?? {}).map(([area, skillIds]) => [\n          area,\n          new Set(skillIds),\n        ]),\n      ),\n    [data?.areaSkills],\n  );\n`,
  "payload-backed area mapping",
);

replaceOnce(
  /freshnessLabel\(data\.generatedAt\)/,
  "freshnessLabel(data.sourceUpdatedAt)",
  "source freshness display",
);

replaceOnce(
  /const avatarUrl = avatarUrls\.get\(engineer\.id\) \?\? avatarUrls\.get\(engineer\.name\);/,
  "const avatarUrl = engineer.avatarUrl;",
  "payload-backed avatar",
);

await writeFile(pagePath, page);

const contract = `import assert from "node:assert/strict";\nimport { access, readFile } from "node:fs/promises";\n\nconst page = await readFile(\n  new URL("../src/screens/SkillsMatrix/SkillsMatrixNative.tsx", import.meta.url),\n  "utf8",\n);\nconst entry = await readFile(\n  new URL("../src/screens/SkillsMatrix/index.ts", import.meta.url),\n  "utf8",\n);\nconst compatibilityEntry = await readFile(\n  new URL("../src/screens/SkillsMatrix/SkillsMatrixIntelligenceBootstrap.tsx", import.meta.url),\n  "utf8",\n);\nconst warmup = await readFile(\n  new URL("../src/lib/maintenancePortalFastWarmup.ts", import.meta.url),\n  "utf8",\n);\nconst prefetch = await readFile(\n  new URL("../src/lib/maintenancePortalPrefetch.ts", import.meta.url),\n  "utf8",\n);\nconst functionIndex = await readFile(\n  new URL("../supabase/functions/skills-matrix-data/index.ts", import.meta.url),\n  "utf8",\n);\nconst functionAuth = await readFile(\n  new URL("../supabase/functions/skills-matrix-data/auth.ts", import.meta.url),\n  "utf8",\n);\nconst functionTransform = await readFile(\n  new URL("../supabase/functions/skills-matrix-data/transform.ts", import.meta.url),\n  "utf8",\n);\nconst functionAnalysis = await readFile(\n  new URL("../supabase/functions/skills-matrix-data/transform-analysis.ts", import.meta.url),\n  "utf8",\n);\n\nfor (const requiredText of [\n  "By Team",\n  "By Department",\n  "Calibration Team",\n  "Operational Technology Team",\n  "Capability intelligence",\n  "Priority Coverage Weaknesses",\n  "People &amp; Experience",\n  "Site-wide Maintenance",\n  "Highest-risk capability",\n  "Coverage status",\n  "Recorded action gain",\n  "All Site",\n  "skills-matrix-people-scroll",\n  "View all \\${selectedDetail.priorityRisks.length} weaknesses",\n  "sourceUpdatedAt",\n  "areaSkills",\n  "avatarUrl: string | null",\n  "engineer.avatarUrl",\n]) {\n  assert.match(\n    page,\n    new RegExp(requiredText.replace(/[.*+?^\\${}()|[\\]\\\\]/g, "\\\\$&")),\n    \\`Native Skills Matrix must retain \\${requiredText}\\`,\n  );\n}\n\nassert.match(page, /schemaVersion: "capability-v3"/);\nassert.match(page, /normaliseSkillsMatrixPayload/);\nassert.match(page, /return payload;/);\nassert.match(page, /clearMaintenancePortalDataCache\\(SKILLS_MATRIX_FUNCTION\\)/);\nassert.match(page, /Skills capability data could not be loaded/);\nassert.match(page, /new Set\\(risks\\.map\\(\\(risk\\) => risk\\.equipmentId\\)\\)/);\nassert.match(page, /risks\\.filter\\(\\(risk\\) => risk\\.singlePoint\\)\\.length/);\nassert.match(page, /selectedArea === ALL_SITE/);\nassert.match(page, /skillIds\\.has\\(skill\\.id\\)/);\nassert.match(page, /priorityRisks\\.slice\\(0, 3\\)/);\nassert.match(page, /\\["pending", "rejected", "expired"\\]/);\nassert.match(\n  page,\n  /navigate\\(\\`\\/equipment\\/\\$\\{encodeURIComponent\\(risk\\.equipmentId\\)\\}\\/skills\\`\\)/,\n);\nassert.doesNotMatch(page, /\\.from\\("engineers"\\)/);\nassert.doesNotMatch(page, /\\.from\\("equipment_assets"\\)/);\nassert.doesNotMatch(page, /\\.from\\("equipment_required_skills"\\)/);\nassert.doesNotMatch(page, /criticalTeamShare \\* 12/);\nassert.doesNotMatch(page, /score = Math\\.min\\(score, 59\\)/);\n\nassert.match(functionIndex, /avatar_url/);\nassert.match(functionIndex, /organisationId/);\nassert.match(functionIndex, /import \\{ context, preflight, response \\}/);\nassert.match(functionAuth, /vorta_get_function_context/);\nassert.doesNotMatch(functionIndex + functionAuth, /SUPABASE_SERVICE_ROLE_KEY/);\nassert.match(functionTransform, /criticalTeamShare \\* 12/);\nassert.match(functionTransform, /overallScore = Math\\.min\\(overallScore, 59\\)/);\nassert.match(functionTransform, /sourceUpdatedAt/);\nassert.match(functionTransform, /areaSkills/);\nassert.match(functionAnalysis, /criticalGaps = priorityRisks\\.filter/);\nassert.match(functionAnalysis, /spofCount = priorityRisks\\.filter/);\nassert.match(functionAnalysis, /avatarUrl: engineer\\.avatar_url/);\n\nassert.match(entry, /\\.\\/SkillsMatrixNative/);\nassert.match(compatibilityEntry, /\\.\\/SkillsMatrixNative/);\nassert.match(warmup, /schemaVersion: "capability-v3"/);\nassert.match(prefetch, /schemaVersion: "capability-v3"/);\n\nfor (const forbidden of [\n  "MutationObserver",\n  "createPortal",\n  "scrollIntoView",\n  "window.scrollTo",\n  "__vortaSkillsMatrixPayload",\n  "vorta:skills-matrix-polished-payload",\n  "SkillsMatrixSelectionExperience",\n  "SkillsMatrixPolished",\n  "SkillsMatrixResolvedExperience",\n]) {\n  assert.doesNotMatch(\n    page + entry + compatibilityEntry,\n    new RegExp(forbidden.replace(/[.*+?^\\${}()|[\\]\\\\]/g, "\\\\$&")),\n    \\`Native Skills Matrix must not use \\${forbidden}\\`,\n  );\n}\n\nfor (const obsolete of [\n  "SkillsMatrixSection.tsx",\n  "SkillsMatrixResolvedExperience.tsx",\n  "SkillsMatrixStableBootstrap.tsx",\n  "SkillsMatrixSelectionExperience.tsx",\n  "SkillsMatrixPolished.tsx",\n]) {\n  await assert.rejects(\n    access(new URL(\\`../src/screens/SkillsMatrix/\\${obsolete}\\`, import.meta.url)),\n    undefined,\n    \\`\\${obsolete} must be removed after native consolidation\\`,\n  );\n}\n\nconsole.log("Skills Matrix native contracts passed.");\n`;

await writeFile(contractPath, contract);
console.log("Skills Matrix data-trust codemod applied.");
