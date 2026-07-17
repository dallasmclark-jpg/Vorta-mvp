import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const pagePath = new URL(
  "../src/screens/SkillsMatrix/SkillsMatrixNative.tsx",
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
  `function normaliseSkillsMatrixPayload(
  payload: SkillsMatrixPayload,
): SkillsMatrixPayload {
  return payload;
}

function statusBadgeClass`,
  "frontend score normalisation",
);

replaceOnce(
  /  const \[avatarUrls, setAvatarUrls\] = useState<Map<string, string>>\(new Map\(\)\);\n  const \[buildingSkills, setBuildingSkills\] = useState<Map<string, Set<string>>>\(new Map\(\)\);\n/,
  "",
  "secondary page data state",
);

replaceOnce(
  /      const normalised = normaliseSkillsMatrixPayload\(payload as SkillsMatrixPayload\);\n      setData\(normalised\);\n      setSelectedScopeId\(\(current\) =>\n        normalised\.details\[current\] \? current : "overall",\n      \);/,
  `      const resolved = normaliseSkillsMatrixPayload(
        payload as SkillsMatrixPayload,
      );
      setData(resolved);
      setSelectedScopeId((current) =>
        resolved.details[current] ? current : "overall",
      );`,
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
  `  const scopes = useMemo(() => {
    if (!data) return [];
    return [
      data.overall,
      ...(viewMode === "team" ? data.teams : data.departments),
    ];
  }, [data, viewMode]);

  const buildingSkills = useMemo(
    () =>
      new Map(
        Object.entries(data?.areaSkills ?? {}).map(([area, skillIds]) => [
          area,
          new Set(skillIds),
        ]),
      ),
    [data?.areaSkills],
  );
`,
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
console.log("Skills Matrix data-trust codemod applied.");
