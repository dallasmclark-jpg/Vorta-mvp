import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const fileUrl = (path) => new URL(path, root);

async function updateText(path, transform) {
  const url = fileUrl(path);
  const source = await readFile(url, "utf8");
  const output = transform(source);
  assert.notEqual(output, source, `${path} was not updated`);
  await writeFile(url, output);
}

await updateText("src/screens/Equipment/equipmentService.ts", (source) => {
  let output = source.replace(
    "  validationStatus: string | null; capabilityRole: string | null;\n}",
    "  validationStatus: string | null; capabilityRole: string | null;\n  qualificationState: string | null; capabilityValidUntil: string | null;\n  skillExpiryDate: string | null;\n}",
  );

  output = output.replaceAll(
    "      capabilityRole: engineer.capability_role ?? null,\n    })),",
    "      capabilityRole: engineer.capability_role ?? null,\n      qualificationState: engineer.qualification_state ?? null,\n      capabilityValidUntil: engineer.capability_valid_until ?? null,\n      skillExpiryDate: engineer.skill_expiry_date ?? null,\n    })),",
  );

  assert.match(output, /qualificationState: string \| null/);
  assert.match(output, /qualificationState: engineer\.qualification_state/);
  return output;
});

await updateText("src/screens/Equipment/EquipmentSkillsIntelligence.tsx", (source) => {
  let output = source.replace(
    "  const shiftGaps = showcase?.shiftCoverage.filter((shift) => !shift.covered) ?? [];\n  const peopleScore",
    "  const shiftGaps = showcase?.shiftCoverage.filter((shift) => !shift.covered) ?? [];\n  const configuredShiftCount = showcase?.shiftCoverage.length ?? 0;\n  const peopleScore",
  );

  output = output.replace(
    "  const interventions = useMemo(() => {\n    const rows:",
    "  const workflowRoute = useCallback((pathname: string, skill?: { skillId: string; name: string; criticality: string | null }): string => {\n    const params = new URLSearchParams({\n      equipment: resolvedId,\n      from: \"equipment\",\n      returnTo: `/equipment/${resolvedId}/skills`,\n    });\n    if (skill) {\n      params.set(\"skill\", skill.skillId);\n      params.set(\"skillName\", skill.name);\n      if (skill.criticality) params.set(\"priority\", words(skill.criticality));\n    }\n    return `${pathname}?${params.toString()}`;\n  }, [resolvedId]);\n\n  const interventions = useMemo(() => {\n    const rows:",
  );

  output = output.replace(
    "route: \"/engineers\" });",
    "route: workflowRoute(\"/engineers\") });",
  );
  output = output.replace(
    "route: \"/training\" });",
    "route: workflowRoute(\"/training\") });",
  );
  output = output.replace(
    "route: \"/training\" }));",
    "route: workflowRoute(\"/training\", skill) }));",
  );
  output = output.replaceAll(
    "`${showcase?.rotatingShiftCoverageCount ?? 0}/4 rotating shifts covered`",
    "`${showcase?.rotatingShiftCoverageCount ?? 0}/${configuredShiftCount || 0} configured shifts covered`",
  );
  output = output.replaceAll(
    "value={`${showcase?.rotatingShiftCoverageCount ?? 0}/4`}",
    "value={`${showcase?.rotatingShiftCoverageCount ?? 0}/${configuredShiftCount || 0}`}",
  );
  output = output.replace(
    "[backups.length, developing.length, primarySme, shiftGaps, showcase?.rotatingShiftCoverageCount, skillGaps]",
    "[backups.length, configuredShiftCount, developing.length, primarySme, shiftGaps, showcase?.rotatingShiftCoverageCount, skillGaps, workflowRoute]",
  );
  output = output.replace(
    "onClick={() => navigate(\"/engineers\")}",
    "onClick={() => navigate(workflowRoute(\"/engineers\"))}",
  );

  assert.match(output, /configuredShiftCount/);
  assert.match(output, /workflowRoute/);
  return output;
});

await updateText("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx", (source) => {
  const output = source.replace(
    '    scopedParams.set("priority", "1");\n    scopedParams.set("risk", item.slug);',
    '    scopedParams.set("view", "priority");\n    scopedParams.set("priority", "1");\n    scopedParams.set("risk", item.slug);',
  );
  assert.match(output, /scopedParams\.set\("view", "priority"\)/);
  return output;
});

await updateText("src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx", (source) => {
  const output = source
    .replaceAll("&priority=1&from=ai", "&view=priority&priority=1&from=ai")
    .replaceAll("?priority=1&from=ai", "?view=priority&priority=1&from=ai");
  assert.match(output, /view=priority&priority=1&from=ai/);
  return output;
});

const packageUrl = fileUrl("package.json");
const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
const legacyRepair = packageJson.scripts["prepare:skills-matrix"];
assert.ok(legacyRepair, "Legacy repair command was not found");

packageJson.name = "vorta-mvp";
packageJson.description = "Vorta maintenance and reliability intelligence MVP";
packageJson.scripts = {
  dev: packageJson.scripts.dev,
  "repair:legacy-workflows": legacyRepair,
  "test:contracts": packageJson.scripts["test:contracts"],
  build: "npm run test:contracts && vite build",
  check: "npm run build",
};

await writeFile(packageUrl, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log("Audit remediation source finalised; normal builds are now non-mutating.");
