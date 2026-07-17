import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const paths = {
  service: new URL("../src/screens/Equipment/equipmentService.ts", import.meta.url),
  equipment: new URL("../src/screens/Equipment/EquipmentSkillsIntelligence.tsx", import.meta.url),
  dashboard: new URL("../src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx", import.meta.url),
  assistant: new URL("../src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx", import.meta.url),
  skills: new URL("../src/screens/SkillsMatrix/SkillsMatrixNative.tsx", import.meta.url),
};

async function transform(path, marker, transform) {
  const source = await readFile(path, "utf8");
  if (source.includes(marker)) {
    console.log(`${marker} already applied.`);
    return;
  }
  const output = transform(source);
  assert.notEqual(output, source, `${marker} did not change its target file`);
  assert.match(output, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await writeFile(path, output);
  console.log(`${marker} applied.`);
}

await transform(paths.service, "EquipmentSkillEngineerEvidence", (source) => {
  source = source.replace(
`export interface EquipmentRequiredSkill {
  id: string; skillId: string; name: string; category: string | null;
  requiredLevel: number; minimumQualifiedEngineers: number;
  criticality: string | null; executionAuthority: string | null;
  validationRequired: boolean; qualifiedEngineerCount: number;
}`,
`export interface EquipmentSkillEngineerEvidence {
  engineerId: string; engineerName: string; avatarUrl: string | null;
  discipline: string | null; shiftPattern: string | null;
  availabilityStatus: string | null; rating: number; yearsExperience: number;
  validationStatus: string | null; capabilityRole: string | null;
}

export interface EquipmentRequiredSkill {
  id: string; skillId: string; name: string; category: string | null;
  requiredLevel: number; minimumQualifiedEngineers: number;
  criticality: string | null; executionAuthority: string | null;
  validationRequired: boolean; qualifiedEngineerCount: number;
  validationGap: number; singlePointOfFailure: boolean;
  qualifiedEngineers: EquipmentSkillEngineerEvidence[];
  nearestEngineers: EquipmentSkillEngineerEvidence[];
}`,
  );

  source = source.replace(
`    validationRequired: Boolean(skill.validation_required),
    qualifiedEngineerCount: Number(skill.qualified_engineer_count ?? 0),
  }));`,
`    validationRequired: Boolean(skill.validation_required),
    qualifiedEngineerCount: Number(skill.qualified_engineer_count ?? 0),
    validationGap: Number(skill.validation_gap ?? 0),
    singlePointOfFailure: Boolean(skill.single_point_of_failure),
    qualifiedEngineers: (Array.isArray(skill.qualified_engineers) ? skill.qualified_engineers : []).map((engineer: any) => ({
      engineerId: engineer.engineer_id ?? "",
      engineerName: engineer.engineer_name ?? "Unknown engineer",
      avatarUrl: engineer.avatar_url ?? null,
      discipline: engineer.discipline ?? null,
      shiftPattern: engineer.shift_pattern ?? null,
      availabilityStatus: engineer.availability_status ?? null,
      rating: Number(engineer.rating ?? 0),
      yearsExperience: Number(engineer.years_experience ?? 0),
      validationStatus: engineer.validation_status ?? null,
      capabilityRole: engineer.capability_role ?? null,
    })),
    nearestEngineers: (Array.isArray(skill.nearest_engineers) ? skill.nearest_engineers : []).map((engineer: any) => ({
      engineerId: engineer.engineer_id ?? "",
      engineerName: engineer.engineer_name ?? "Unknown engineer",
      avatarUrl: engineer.avatar_url ?? null,
      discipline: engineer.discipline ?? null,
      shiftPattern: engineer.shift_pattern ?? null,
      availabilityStatus: engineer.availability_status ?? null,
      rating: Number(engineer.rating ?? 0),
      yearsExperience: Number(engineer.years_experience ?? 0),
      validationStatus: engineer.validation_status ?? null,
      capabilityRole: engineer.capability_role ?? null,
    })),
  }));`,
  );
  return source;
});

await transform(paths.equipment, "EquipmentRequiredSkillCoverage", (source) => {
  source = source.replace(
    'import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";',
    'import { EquipmentRiskIndicator } from "./EquipmentRiskIndicator";\nimport { EquipmentRequiredSkillCoverage } from "./EquipmentRequiredSkillCoverage";',
  );

  source = source.replace(
`function EngineerCard({ engineer }: { engineer: EquipmentEngineerCapability }): JSX.Element {`,
`function EngineerCard({ engineer, onOpen }: { engineer: EquipmentEngineerCapability; onOpen: () => void }): JSX.Element {`,
  );
  source = source.replace(
`    <article className="rounded-xl border border-gray-800 bg-[#0d1219] p-4">`,
`    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-gray-800 bg-[#0d1219] p-4 text-left transition-colors hover:border-blue-500/35 hover:bg-blue-500/[0.04]">`,
  );
  source = source.replace(
`    </article>
  );
}

function OperatorRow`,
`    </button>
  );
}

function OperatorRow`,
  );

  source = source.replace(
`<div className="divide-y divide-gray-800">{showcase?.requiredSkills.map((skill) => { const minimum = Math.max(1, skill.minimumQualifiedEngineers); const shortfall = Math.max(0, minimum - skill.qualifiedEngineerCount); const width = Math.min(100, (skill.qualifiedEngineerCount / Math.max(minimum + 1, skill.qualifiedEngineerCount)) * 100); return <div key={skill.id || skill.skillId} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.45fr)_110px_minmax(180px,0.8fr)_110px] lg:items-center"><div><p className="text-sm font-semibold text-slate-100">{skill.name}</p><p className="mt-1 text-[10px] text-slate-500">{words(skill.category)} · Level {skill.requiredLevel} · {words(skill.criticality)}</p></div><div className="text-xs text-slate-400"><span className="font-semibold text-slate-200">{skill.qualifiedEngineerCount}</span> qualified / {minimum} minimum</div><div><div className="h-1.5 overflow-hidden rounded-full bg-gray-800"><div className={\`h-full rounded-full \${shortfall ? "bg-red-400" : skill.qualifiedEngineerCount === minimum ? "bg-amber-400" : "bg-emerald-400"}\`} style={{ width: \`\${width}%\`, opacity: 0.72 }} /></div></div><Badge className={\`h-auto justify-self-start rounded border px-2 py-1 text-[10px] font-semibold shadow-none lg:justify-self-end \${shortfall ? "border-red-500/25 bg-red-500/10 text-red-300" : skill.qualifiedEngineerCount === minimum ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"}\`}>{shortfall ? \`\${shortfall} short\` : skill.qualifiedEngineerCount === minimum ? "At threshold" : "Resilient"}</Badge></div>; })}</div>`,
`<div className="space-y-3 p-4 md:p-5">{showcase?.requiredSkills.map((skill) => <EquipmentRequiredSkillCoverage key={skill.id || skill.skillId} skill={skill} equipmentId={resolvedId} />)}</div>`,
  );

  source = source.replace(
`filteredEngineers.map((engineer) => <EngineerCard key={engineer.capabilityId || engineer.engineerId} engineer={engineer} />)`,
`filteredEngineers.map((engineer) => <EngineerCard key={engineer.capabilityId || engineer.engineerId} engineer={engineer} onOpen={() => navigate(\`/engineers?engineer=\${encodeURIComponent(engineer.engineerId)}&from=equipment&returnTo=\${encodeURIComponent(\`/equipment/\${resolvedId}/skills\`)}\`)} />)`,
  );

  return source;
});

await transform(paths.dashboard, "getLabourRiskWorkflowRoute", (source) => {
  source = source.replace(
`const RISK_KPI_FIXED_DISPLAY_ORDER = [`,
`const getLabourRiskWorkflowRoute = (
  item: RiskDashboardLabourCard,
  activeScopeArea: string | null,
): string => {
  const scopedParams = new URLSearchParams({ from: "dashboard" });
  if (activeScopeArea) scopedParams.set("area", activeScopeArea);

  if (item.slug === "shift-cover" || item.slug === "single-point-failure") {
    scopedParams.set("priority", "1");
    scopedParams.set("risk", item.slug);
    return \`/skills-matrix?\${scopedParams.toString()}\`;
  }

  if (item.slug === "training-expiring") {
    scopedParams.set("priority", "High");
    return \`/training?\${scopedParams.toString()}\`;
  }

  const detailParams = new URLSearchParams();
  if (activeScopeArea) {
    detailParams.set("scope", "area");
    detailParams.set("area", activeScopeArea);
  }
  const query = detailParams.toString();
  return \`/maintenance/labour-risk/\${item.slug}\${query ? \`?\${query}\` : ""}\`;
};

const RISK_KPI_FIXED_DISPLAY_ORDER = [`,
  );

  source = source.replace(
`                const basePath =
                  \`/maintenance/labour-risk/\${item.slug}\`;

                if (
                  !isSiteRiskScope &&
                  activeScopeArea
                ) {
                  const query =
                    new URLSearchParams({
                      scope: "area",
                      area: activeScopeArea,
                    });

                  navigate(
                    \`\${basePath}?\${query.toString()}\`,
                  );
                  return;
                }

                navigate(basePath);`,
`                navigate(
                  getLabourRiskWorkflowRoute(
                    item,
                    isSiteRiskScope ? null : activeScopeArea,
                  ),
                );`,
  );

  source = source.replace(
`    return \`/equipment/\${equipmentId}/skills\`;`,
`    return \`/equipment/\${equipmentId}/skills?from=dashboard&returnTo=%2Fdashboard\`;`,
  );
  return source;
});

await transform(paths.assistant, "equipmentWorkflowRoute", (source) => {
  source = source.replace(
`import {
  AlertTriangle,`,
`import { Link } from "react-router-dom";
import {
  AlertTriangle,`,
  );
  source = source.replace(
`function EquipmentSmeSection({
  sme,
  equipmentName,
}: {
  sme: EquipmentSmeRecommendation | null;
  equipmentName: string;
}): JSX.Element {`,
`function EquipmentSmeSection({
  sme,
  equipmentName,
  equipmentId,
}: {
  sme: EquipmentSmeRecommendation | null;
  equipmentName: string;
  equipmentId: string | null;
}): JSX.Element {
  const equipmentWorkflowRoute = equipmentId
    ? \`/skills-matrix?equipment=\${encodeURIComponent(equipmentId)}&priority=1&from=ai\`
    : "/skills-matrix?priority=1&from=ai";`,
  );
  source = source.replace(
`        <a
          href="/engineers"
          className="text-[9px] font-semibold text-blue-400 hover:text-blue-300"
        >
          Open engineer record →
        </a>`,
`        <Link
          to={sme ? \`/engineers?engineer=\${encodeURIComponent(sme.id)}&from=ai\` : equipmentWorkflowRoute}
          className="text-[9px] font-semibold text-blue-400 hover:text-blue-300"
        >
          {sme ? "Open engineer record →" : "Open capability risk →"}
        </Link>`,
  );
  source = source.replace(
`function EngineerSection({
  engineers,
  shiftLabel,
  shiftWindow,
  shiftBasis,
}: {`,
`function EngineerSection({
  engineers,
  shiftLabel,
  shiftWindow,
  shiftBasis,
  equipmentId,
}: {`,
  );
  source = source.replace(
`  shiftBasis: string;
}): JSX.Element {
  const primary = engineers[0];`,
`  shiftBasis: string;
  equipmentId: string | null;
}): JSX.Element {
  const primary = engineers[0];
  const equipmentWorkflowRoute = equipmentId
    ? \`/skills-matrix?equipment=\${encodeURIComponent(equipmentId)}&q=\${encodeURIComponent(primary?.primarySkill ?? "")}&priority=1&from=ai\`
    : "/skills-matrix?priority=1&from=ai";`,
  );
  source = source.replace(
`        <a
          href="/engineers"
          className="text-[9px] font-semibold text-blue-400 hover:text-blue-300"
        >
          Open skills →
        </a>`,
`        <Link
          to={equipmentWorkflowRoute}
          className="text-[9px] font-semibold text-blue-400 hover:text-blue-300"
        >
          Open capability risk →
        </Link>`,
  );
  source = source.replace(
`                  <EquipmentSmeSection
                    sme={result.equipmentSme}
                    equipmentName={result.primaryEquipment?.name ?? "Matched equipment"}
                  />`,
`                  <EquipmentSmeSection
                    sme={result.equipmentSme}
                    equipmentName={result.primaryEquipment?.name ?? "Matched equipment"}
                    equipmentId={result.primaryEquipment?.id ?? null}
                  />`,
  );
  source = source.replace(
`                  <EngineerSection
                    engineers={result.engineers}
                    shiftLabel={result.shiftLabel}
                    shiftWindow={result.shiftWindow}
                    shiftBasis={result.shiftBasis}
                  />`,
`                  <EngineerSection
                    engineers={result.engineers}
                    shiftLabel={result.shiftLabel}
                    shiftWindow={result.shiftWindow}
                    shiftBasis={result.shiftBasis}
                    equipmentId={result.primaryEquipment?.id ?? null}
                  />`,
  );
  return source;
});

await transform(paths.skills, "equipmentFilterId", (source) => {
  source = source.replace(
`  const [showAllWeaknesses, setShowAllWeaknesses] = useState(false);`,
`  const [showAllWeaknesses, setShowAllWeaknesses] = useState(false);
  const equipmentFilterId = searchParams.get("equipment");`,
  );

  source = source.replace(
`  const intelligence = useMemo(() => {
    if (!selectedSummary || !selectedDetail) return null;
    const risks = selectedDetail.priorityRisks;`,
`  const equipmentPriorityRisks = useMemo(
    () =>
      selectedDetail?.priorityRisks.filter(
        (risk) => !equipmentFilterId || risk.equipmentId === equipmentFilterId,
      ) ?? [],
    [equipmentFilterId, selectedDetail],
  );

  const equipmentFocusName =
    equipmentPriorityRisks[0]?.equipmentName ?? null;

  const intelligence = useMemo(() => {
    if (!selectedSummary || !selectedDetail) return null;
    const risks = equipmentPriorityRisks;`,
  );
  source = source.replace(
`  }, [selectedDetail, selectedSummary]);

  const visiblePriorityRisks = showAllWeaknesses
    ? selectedDetail?.priorityRisks ?? []
    : selectedDetail?.priorityRisks.slice(0, 3) ?? [];`,
`  }, [equipmentPriorityRisks, selectedDetail, selectedSummary]);

  const visiblePriorityRisks = showAllWeaknesses
    ? equipmentPriorityRisks
    : equipmentPriorityRisks.slice(0, 3);`,
  );

  source = source.replace(
`    let skills = selectedDetail.matrixSkills.filter(
      (skill) => !areaSkillIds || areaSkillIds.has(skill.id),
    );`,
`    const equipmentSkillIds = equipmentFilterId
      ? new Set(
          selectedDetail.priorityRisks
            .filter((risk) => risk.equipmentId === equipmentFilterId)
            .map((risk) => risk.skillId),
        )
      : null;
    let skills = selectedDetail.matrixSkills.filter(
      (skill) =>
        (!areaSkillIds || areaSkillIds.has(skill.id)) &&
        (!equipmentSkillIds || equipmentSkillIds.has(skill.id)),
    );`,
  );
  source = source.replace(
`  }, [buildingSkills, priorityOnly, prioritySkillIds, search, selectedArea, selectedDetail]);`,
`  }, [buildingSkills, equipmentFilterId, priorityOnly, prioritySkillIds, search, selectedArea, selectedDetail]);`,
  );

  source = source.replace(
`                      <button
                        type="button"
                        onClick={() => setPriorityOnly((current) => !current)}`,
`                      {equipmentFilterId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSearchParams((current) => {
                              const next = new URLSearchParams(current);
                              next.delete("equipment");
                              return next;
                            })
                          }
                          className="h-9 rounded-lg border border-blue-500/30 bg-blue-500/[0.07] px-3 text-xs font-semibold text-blue-300 transition-colors hover:border-blue-400/50"
                        >
                          {equipmentFocusName ? \`Equipment: \${equipmentFocusName}\` : "Equipment focus"} · Clear
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPriorityOnly((current) => !current)}`,
  );
  return source;
});
