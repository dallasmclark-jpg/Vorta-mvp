import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function patch(relativePath, alreadyApplied, transforms) {
  const fileUrl = new URL(relativePath, root);
  let source = await readFile(fileUrl, "utf8");
  if (alreadyApplied(source)) {
    console.log(`${relativePath} workflow fix already applied.`);
    return;
  }

  const replaceOnce = (pattern, replacement, label) => {
    assert.match(source, pattern, `${relativePath}: could not find ${label}`);
    source = source.replace(pattern, replacement);
  };

  await transforms({ replaceOnce, get source() { return source; } });
  await writeFile(fileUrl, source);
  console.log(`${relativePath} workflow fix applied.`);
}

await patch(
  "src/screens/SkillsMatrix/SkillsMatrixNative.tsx",
  (source) => source.includes("Find engineer") && source.includes("useSearchParams"),
  async ({ replaceOnce }) => {
    replaceOnce(
      /import \{ useNavigate \} from "react-router-dom";/,
      'import { useNavigate, useSearchParams } from "react-router-dom";',
      "router imports",
    );

    replaceOnce(
      /export const SkillsMatrixSection = \(\): JSX\.Element => \{\n  const navigate = useNavigate\(\);/,
      `export const SkillsMatrixSection = (): JSX.Element => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();`,
      "Skills Matrix search params",
    );

    replaceOnce(
      /  const \[viewMode, setViewMode\] = useState<ViewMode>\("team"\);\n  const \[selectedScopeId, setSelectedScopeId\] = useState\("overall"\);\n  const \[selectedArea, setSelectedArea\] = useState\(ALL_SITE\);\n  const \[search, setSearch\] = useState\(""\);\n  const \[priorityOnly, setPriorityOnly\] = useState\(false\);\n  const \[selectedSkillId, setSelectedSkillId\] = useState<string \| null>\(null\);/,
      `  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    searchParams.get("view") === "department" ? "department" : "team",
  );
  const [selectedScopeId, setSelectedScopeId] = useState(
    () => searchParams.get("scope") || "overall",
  );
  const [selectedArea, setSelectedArea] = useState(
    () => searchParams.get("area") || ALL_SITE,
  );
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [priorityOnly, setPriorityOnly] = useState(
    () => searchParams.get("priority") === "1",
  );
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(
    () => searchParams.get("skill"),
  );`,
      "URL-backed Skills Matrix state",
    );

    replaceOnce(
      /  useEffect\(\(\) => \{\n    void loadData\(false\);\n  \}, \[loadData\]\);/,
      `  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const setOrDelete = (key: string, value: string, defaultValue = "") => {
        if (!value || value === defaultValue) next.delete(key);
        else next.set(key, value);
      };
      setOrDelete("view", viewMode, "team");
      setOrDelete("scope", selectedScopeId, "overall");
      setOrDelete("area", selectedArea, ALL_SITE);
      setOrDelete("q", search.trim());
      if (priorityOnly) next.set("priority", "1");
      else next.delete("priority");
      setOrDelete("skill", selectedSkillId ?? "");
      return next;
    }, { replace: true });
  }, [
    priorityOnly,
    search,
    selectedArea,
    selectedScopeId,
    selectedSkillId,
    setSearchParams,
    viewMode,
  ]);`,
      "Skills Matrix URL synchronisation",
    );

    replaceOnce(
      /  useEffect\(\(\) => \{\n    setSearch\(""\);\n    setPriorityOnly\(false\);\n    setSelectedSkillId\(null\);\n    setSelectedArea\(ALL_SITE\);\n    setShowAllWeaknesses\(false\);\n  \}, \[selectedScopeId\]\);/,
      `  useEffect(() => {
    setSelectedSkillId(null);
    setShowAllWeaknesses(false);
  }, [selectedScopeId]);`,
      "scope-change reset behaviour",
    );

    replaceOnce(
      /\{selectedDetail\.engineers\.map\(\(engineer\) => \{[\s\S]*?\n                      \}\)\}/,
      `{selectedDetail.engineers.map((engineer) => {
                        const avatarUrl = engineer.avatarUrl;
                        return (
                          <button
                            key={engineer.id}
                            type="button"
                            onClick={() =>
                              navigate(
                                \`/engineers?engineer=\${encodeURIComponent(engineer.id)}&from=skills-matrix\`,
                              )
                            }
                            className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.025] focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
                          >
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-[#0f1318] text-sm font-semibold text-slate-300">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={\`\${engineer.name} profile\`}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                engineerInitials(engineer.name)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-sm font-medium text-slate-200">{engineer.name}</p>
                                {engineer.criticalKnowledgeHolder ? (
                                  <Shield className="h-3.5 w-3.5 text-blue-400" aria-label="Critical knowledge holder" />
                                ) : null}
                              </div>
                              <p className="truncate text-[11px] text-slate-500">{engineer.discipline}</p>
                              <p className="truncate text-[10px] text-slate-600">
                                {engineer.shiftNames.join(" · ") || engineer.departmentName || "Specialist team"}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-semibold tabular-nums text-slate-300">
                                {engineer.averageYearsExperience.toFixed(1)} yrs
                              </p>
                              <p className={engineer.trainingNeeds > 0 ? "text-[10px] text-orange-300" : "text-[10px] text-slate-600"}>
                                {engineer.trainingNeeds} training need{engineer.trainingNeeds === 1 ? "" : "s"}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                          </button>
                        );
                      })}`,
      "clickable People and Experience rows",
    );

    replaceOnce(
      /<td className=\{`sticky left-0 z-10 min-w-\[190px\] px-4 py-2\.5 \$\{rowBg\}`\}>\n                                     <p className="truncate font-medium text-slate-200">\{engineer\.name\}<\/p>\n                                     <p className="mt-0\.5 truncate text-\[11px\] text-slate-500">\{engineer\.discipline\}<\/p>\n                                   <\/td>/,
      `<td className={\`sticky left-0 z-10 min-w-[190px] px-4 py-2.5 \${rowBg}\`}>
                                     <button
                                       type="button"
                                       onClick={() =>
                                         navigate(
                                           \`/engineers?engineer=\${encodeURIComponent(engineer.id)}&from=skills-matrix\`,
                                         )
                                       }
                                       className="w-full rounded text-left transition-colors hover:text-blue-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
                                     >
                                       <p className="truncate font-medium text-slate-200">{engineer.name}</p>
                                       <p className="mt-0.5 truncate text-[11px] text-slate-500">{engineer.discipline}</p>
                                     </button>
                                   </td>`,
      "clickable matrix engineer names",
    );

    replaceOnce(
      /<div className="flex items-center gap-2">\n                                 <span className="rounded-md bg-blue-500\/10 px-2 py-1 text-\[11px\] font-semibold text-blue-300">\n                                   \+\{risk\.projectedScoreGain\} pts\n                                 <\/span>\n                                 <button[\s\S]*?\n                                 <\/button>\n                               <\/div>/,
      `<div className="flex flex-wrap items-center gap-2">
                                 <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-300">
                                   +{risk.projectedScoreGain} pts
                                 </span>
                                 <button
                                   type="button"
                                   onClick={() =>
                                     navigate(
                                       \`/engineers?skill=\${encodeURIComponent(risk.skillId)}&skillName=\${encodeURIComponent(risk.skillName)}&from=skills-matrix\`,
                                     )
                                   }
                                   className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                 >
                                   Find engineer <Users className="h-3 w-3" />
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() =>
                                     navigate(
                                       \`/requirements?skill=\${encodeURIComponent(risk.skillName)}&from=skills-matrix\`,
                                     )
                                   }
                                   className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                 >
                                   View requirement <ClipboardList className="h-3 w-3" />
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() =>
                                     navigate(
                                       \`/training?skill=\${encodeURIComponent(risk.skillName)}&priority=\${risk.isCritical ? "Critical" : "High"}&from=skills-matrix\`,
                                     )
                                   }
                                   className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                 >
                                   Open training plan <GraduationCap className="h-3 w-3" />
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => navigate(\`/equipment/\${encodeURIComponent(risk.equipmentId)}/skills\`)}
                                   className="inline-flex items-center gap-1 rounded-md border border-gray-700 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                                 >
                                   Equipment <ArrowRight className="h-3 w-3" />
                                 </button>
                               </div>`,
      "priority workflow actions",
    );
  },
);

await patch(
  "src/screens/Engineers/EngineersSection.tsx",
  (source) => source.includes("skillFilterId") && source.includes("searchParams.get(\"engineer\")"),
  async ({ replaceOnce }) => {
    replaceOnce(
      /import \{ useEffect, useMemo, useState \} from "react";/,
      'import { useEffect, useMemo, useState } from "react";\nimport { useSearchParams } from "react-router-dom";',
      "Engineers router import",
    );

    replaceOnce(
      /export const EngineersSection = \(\): JSX\.Element => \{/,
      `export const EngineersSection = (): JSX.Element => {
  const [searchParams, setSearchParams] = useSearchParams();`,
      "Engineers search params",
    );

    replaceOnce(
      /  const \[selectedEngineer, setSelectedEngineer\] = useState<DrawerEngineer \| null>\(null\);\n\n  const \[search,               setSearch\]               = useState\(""\);/,
      `  const [selectedEngineer, setSelectedEngineer] = useState<DrawerEngineer | null>(null);
  const skillFilterId = searchParams.get("skill") ?? "";
  const skillFilterName = searchParams.get("skillName") ?? "Selected skill";

  const [search,               setSearch]               = useState(() => searchParams.get("q") ?? "");`,
      "Engineers workflow state",
    );

    replaceOnce(
      /  \}, \[tick\]\);\n\n  \/\/ ── Derived/,
      `  }, [tick]);

  useEffect(() => {
    const requestedEngineerId = searchParams.get("engineer");
    if (!requestedEngineerId || engineers.length === 0) return;
    const match = engineers.find((engineer) => engineer.id === requestedEngineerId);
    if (match) setSelectedEngineer(match);
  }, [engineers, searchParams]);

  const closeEngineer = () => {
    setSelectedEngineer(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("engineer");
      return next;
    }, { replace: true });
  };

  // ── Derived`,
      "direct engineer opening",
    );

    replaceOnce(
      /  const filteredEngineers = useMemo\(\(\) => \{\n    const lc = search\.toLowerCase\(\);\n    return engineers/,
      `  const filteredEngineers = useMemo(() => {
    const lc = search.toLowerCase();
    const skillEngineerIds = skillFilterId
      ? new Set(
          assignments
            .filter((assignment) => assignment.skill_id === skillFilterId)
            .map((assignment) => assignment.engineer_id),
        )
      : null;
    return engineers`,
      "engineer skill filter set",
    );

    replaceOnce(
      /        if \(filterRisk !== "all"          && eng\.risk_level !== filterRisk\)                  return false;\n        return true;/,
      `        if (filterRisk !== "all"          && eng.risk_level !== filterRisk)                  return false;
        if (skillEngineerIds && !skillEngineerIds.has(eng.id)) return false;
        return true;`,
      "engineer skill filter condition",
    );

    replaceOnce(
      /  \}, \[engineers, search, filterDept, filterSite, filterAvailability, filterRisk\]\);/,
      `  }, [
    assignments,
    engineers,
    filterAvailability,
    filterDept,
    filterRisk,
    filterSite,
    search,
    skillFilterId,
  ]);`,
      "engineer filter dependencies",
    );

    replaceOnce(
      /  const hasActiveFilters = !!\(search \|\| filterDept !== "all" \|\| filterSite !== "all" \|\| filterAvailability !== "all" \|\| filterRisk !== "all"\);/,
      `  const hasActiveFilters = !!(
    search ||
    skillFilterId ||
    filterDept !== "all" ||
    filterSite !== "all" ||
    filterAvailability !== "all" ||
    filterRisk !== "all"
  );`,
      "engineer active filters",
    );

    replaceOnce(
      /  const resetFilters = \(\) => \{\n    setSearch\(""\); setFilterDept\("all"\); setFilterSite\("all"\);\n    setFilterAvailability\("all"\); setFilterRisk\("all"\);\n    setTablePage\(0\);\n  \};/,
      `  const resetFilters = () => {
    setSearch(""); setFilterDept("all"); setFilterSite("all");
    setFilterAvailability("all"); setFilterRisk("all");
    setTablePage(0);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("engineer");
      next.delete("skill");
      next.delete("skillName");
      next.delete("q");
      next.delete("from");
      return next;
    }, { replace: true });
  };`,
      "engineer filter reset",
    );

    replaceOnce(
      /        onClose=\{\(\) => setSelectedEngineer\(null\)\}/,
      "        onClose={closeEngineer}",
      "engineer drawer close",
    );

    replaceOnce(
      /              <div className="flex flex-wrap items-center gap-2">\n                 <div className="relative min-w-\[160px\] flex-1">/,
      `              <div className="flex flex-wrap items-center gap-2">
                 {skillFilterId ? (
                   <button
                     type="button"
                     onClick={() => {
                       setSearchParams((current) => {
                         const next = new URLSearchParams(current);
                         next.delete("skill");
                         next.delete("skillName");
                         return next;
                       }, { replace: true });
                     }}
                     className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold text-blue-300"
                   >
                     Skill: {skillFilterName} <X className="h-3 w-3" />
                   </button>
                 ) : null}
                 <div className="relative min-w-[160px] flex-1">`,
      "engineer skill filter chip",
    );
  },
);

await patch(
  "src/screens/Requirements/RequirementsSection.tsx",
  (source) => source.includes("closeRequirement") && source.includes("requestedSkill"),
  async ({ replaceOnce }) => {
    replaceOnce(
      /import \{ useNavigate \} from "react-router-dom";/,
      'import { useNavigate, useSearchParams } from "react-router-dom";',
      "Requirements router import",
    );

    replaceOnce(
      /export const RequirementsSection = \(\): JSX\.Element => \{/,
      `export const RequirementsSection = (): JSX.Element => {
  const [searchParams, setSearchParams] = useSearchParams();`,
      "Requirements search params",
    );

    replaceOnce(
      /  const \[search,         setSearch\]         = useState\(""\);/,
      '  const [search,         setSearch]         = useState(() => searchParams.get("skill") ?? "");',
      "Requirements initial skill search",
    );

    replaceOnce(
      /  \}, \[tick\]\);\n\n  \/\/ ── Derived/,
      `  }, [tick]);

  useEffect(() => {
    const requestedSkill = searchParams.get("skill")?.trim().toLowerCase();
    if (!requestedSkill || requirements.length === 0) return;
    const match = requirements.find(
      (requirement) => requirement.title.trim().toLowerCase() === requestedSkill,
    );
    if (match) setSelectedReq(match);
  }, [requirements, searchParams]);

  const closeRequirement = () => {
    setSelectedReq(null);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("skill");
      next.delete("from");
      return next;
    }, { replace: true });
  };

  // ── Derived`,
      "direct requirement opening",
    );

    replaceOnce(
      /  const resetFilters = \(\) => \{\n    setSearch\(""\); setFilterDept\("all"\); setFilterPriority\("all"\);\n    setFilterStatus\("all"\); setFilterCategory\("all"\); setTablePage\(0\);\n  \};/,
      `  const resetFilters = () => {
    setSearch(""); setFilterDept("all"); setFilterPriority("all");
    setFilterStatus("all"); setFilterCategory("all"); setTablePage(0);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("skill");
      next.delete("from");
      return next;
    }, { replace: true });
  };`,
      "Requirements filter reset",
    );

    replaceOnce(
      /<RequirementDrawer req=\{selectedReq\} onClose=\{\(\) => setSelectedReq\(null\)\} \/>/,
      '<RequirementDrawer req={selectedReq} onClose={closeRequirement} />',
      "Requirement drawer close",
    );
  },
);

await patch(
  "src/screens/Training/TrainingSection.tsx",
  (source) => source.includes("Training plan focus") && source.includes("focusedSkill"),
  async ({ replaceOnce }) => {
    replaceOnce(
      /import \{ useNavigate \} from "react-router-dom";/,
      'import { useNavigate, useSearchParams } from "react-router-dom";',
      "Training router import",
    );

    replaceOnce(
      /export const TrainingSection = \(\): JSX\.Element => \{/,
      `export const TrainingSection = (): JSX.Element => {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedSkill = searchParams.get("skill") ?? "";`,
      "Training search params",
    );

    replaceOnce(
      /  const \[prioritySearch,  setPrioritySearch\]  = useState\(""\);\n  const \[filterPriority,  setFilterPriority\]  = useState\("all"\);/,
      `  const [prioritySearch,  setPrioritySearch]  = useState(() => focusedSkill);
  const [filterPriority,  setFilterPriority]  = useState(() => {
    const value = searchParams.get("priority");
    return value && ["Critical", "High", "Medium", "Low"].includes(value)
      ? value
      : "all";
  });`,
      "Training focused state",
    );

    replaceOnce(
      /  const handleStatusChange = \(id: string, status: string\) => \{/,
      `  const clearTrainingFocus = () => {
    setPrioritySearch("");
    setFilterPriority("all");
    setPriorityPage(0);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("skill");
      next.delete("priority");
      next.delete("from");
      return next;
    }, { replace: true });
  };

  const handleStatusChange = (id: string, status: string) => {`,
      "Training focus clear handler",
    );

    replaceOnce(
      /      <\/header>\n\n      \{\/\* ── Sync \+ AI actions/,
      `      </header>

      {focusedSkill ? (
        <div className="flex w-full flex-col gap-3 rounded-xl border border-blue-500/25 bg-blue-500/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
              Training plan focus
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{focusedSkill}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Priority gaps and recommendations are filtered to this capability.
            </p>
          </div>
          <button
            type="button"
            onClick={clearTrainingFocus}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 px-3 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/10"
          >
            Clear focus <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

      {/* ── Sync + AI actions`,
      "Training focus banner",
    );

    replaceOnce(
      /onClick=\{\(\) => \{ setPrioritySearch\(""\); setFilterPriority\("all"\); setPriorityPage\(0\); \}\}/,
      "onClick={clearTrainingFocus}",
      "Training register clear action",
    );
  },
);
