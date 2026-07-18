import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function read(path) {
  return readFile(join(root, path), "utf8");
}

async function write(path, content) {
  await writeFile(join(root, path), content, "utf8");
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing source for ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Source is ambiguous for ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replaceRegex(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`Expected one match for ${label}; found ${matches?.length ?? 0}`);
  }
  return source.replace(pattern, replacement);
}

async function patch(path, mutate) {
  const current = await read(path);
  const next = mutate(current);
  if (next === current) throw new Error(`No change produced for ${path}`);
  await write(path, next);
}

await patch("src/screens/Equipment/equipmentService.ts", (source) =>
  replaceRegex(
    source,
    /export async function refreshAndGetOperationalDashboard\(\):[\s\S]*?\n}\n\nexport async function refreshOperationalRisk/,
    `async function getOperationalDashboardFromRpc(\n  rpcName:\n    | "vorta_get_operational_dashboard_snapshot"\n    | "vorta_refresh_and_get_operational_dashboard",\n): Promise<OperationalRiskDashboardPayload | null> {\n  try {\n    const { data, error } = await supabase.rpc(rpcName);\n\n    if (error) {\n      console.warn(\`${"${rpcName}"} failed:\`, error.message);\n      return null;\n    }\n\n    const payload = validateOperationalDashboardPayload(data);\n    const areaProfiles = Array.isArray(payload.areaProfiles)\n      ? payload.areaProfiles as AreaRiskProfile[]\n      : [];\n    const scopes = Array.isArray(payload.scopes)\n      ? payload.scopes as RiskDashboardScope[]\n      : [];\n    const siteRisk =\n      payload.siteRisk &&\n      typeof payload.siteRisk === "object" &&\n      !Array.isArray(payload.siteRisk)\n        ? payload.siteRisk as SiteRiskProfile\n        : null;\n\n    if (areaProfiles.length === 0 || scopes.length === 0 || !siteRisk) {\n      console.warn(\`${"${rpcName}"} returned incomplete operational data.\`);\n      return null;\n    }\n\n    return {\n      areaProfiles,\n      siteRisk,\n      scopes,\n      freshness: parseDashboardFreshness(payload.freshness),\n    };\n  } catch (error) {\n    console.warn(\`${"${rpcName}"} threw:\`, error);\n    return null;\n  }\n}\n\nexport async function getOperationalDashboardSnapshot():\n  Promise<OperationalRiskDashboardPayload | null> {\n  return getOperationalDashboardFromRpc(\n    "vorta_get_operational_dashboard_snapshot",\n  );\n}\n\nexport async function refreshAndGetOperationalDashboard():\n  Promise<OperationalRiskDashboardPayload | null> {\n  return getOperationalDashboardFromRpc(\n    "vorta_refresh_and_get_operational_dashboard",\n  );\n}\n\nexport async function refreshOperationalRisk`,
    "explicit operational dashboard services",
  ),
);

await patch(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
  (source) => {
    let next = replaceOnce(
      source,
      "  refreshAndGetOperationalDashboard,\n",
      "  getOperationalDashboardSnapshot,\n  refreshAndGetOperationalDashboard,\n",
      "dashboard snapshot import",
    );
    next = replaceRegex(
      next,
      /const loadRiskDashboard = useCallback\(\n    async \(\n      period: RiskKpiPeriodKey,\n      scopeKey: string,\n    \) => \{/,
      `const loadRiskDashboard = useCallback(\n    async (\n      period: RiskKpiPeriodKey,\n      scopeKey: string,\n      recalculate = false,\n    ) => {`,
      "dashboard load signature",
    );
    next = replaceRegex(
      next,
      /const operationalDashboard =\n\s+await refreshAndGetOperationalDashboard\(\);/,
      `const operationalDashboard = recalculate\n          ? await refreshAndGetOperationalDashboard()\n          : await getOperationalDashboardSnapshot();`,
      "dashboard snapshot selection",
    );
    next = replaceRegex(
      next,
      /const workPlanRefreshSucceeded =\n\s+await refreshRiskWorkPlan\(\);/,
      `const workPlanRefreshSucceeded = recalculate\n              ? await refreshRiskWorkPlan()\n              : true;`,
      "work-plan refresh gating",
    );
    next = replaceOnce(
      next,
      "onClick={() => void loadRiskDashboard(selectedKpiPeriod, selectedRiskScopeKey)}",
      "onClick={() => void loadRiskDashboard(selectedKpiPeriod, selectedRiskScopeKey, true)}",
      "explicit dashboard refresh",
    );
    next = replaceOnce(
      next,
      '<div className="overflow-x-auto border-b border-gray-800 pb-4">',
      `<div className="sm:hidden">\n              <label\n                htmlFor="risk-scope-select"\n                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500"\n              >\n                Risk scope\n              </label>\n              <select\n                id="risk-scope-select"\n                aria-label="Risk scope"\n                value={selectedRiskScopeKey}\n                onChange={(event) => handleRiskScopeChange(event.target.value)}\n                className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 text-sm font-semibold text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"\n              >\n                {riskScopes.map((scope) => (\n                  <option key={scope.scopeKey} value={scope.scopeKey}>\n                    {scope.scopeLabel} · {formatSiteRisk(scope.riskScore)}\n                  </option>\n                ))}\n              </select>\n            </div>\n\n            <div className="hidden overflow-x-auto border-b border-gray-800 pb-4 sm:block">`,
      "mobile risk-scope selector",
    );
    next = replaceOnce(
      next,
      '<div className="min-w-0">\n                <VortaAiCommandBar',
      '<div className="min-w-0" data-vorta-embedded-ai="true">\n                <VortaAiCommandBar',
      "embedded dashboard AI marker",
    );
    next = next.replace(
      '"animate-pulse border-cyan-300/80 bg-cyan-400/20 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.30)] hover:bg-cyan-400/30 hover:shadow-[0_0_24px_rgba(34,211,238,0.45)]"',
      '"border-cyan-300/70 bg-cyan-400/15 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.20)] hover:bg-cyan-400/25 hover:shadow-[0_0_20px_rgba(34,211,238,0.32)]"',
    );
    return next;
  },
);

await write(
  "src/screens/AiOperations/MaintenanceDashboardExperience.tsx",
  `import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";\n\nexport function MaintenanceDashboardExperience(): JSX.Element {\n  return (\n    <div data-vorta-dashboard-root="true">\n      <style>{\`\n        [data-vorta-dashboard-root="true"] [role="tab"] {\n          min-height: 2.5rem;\n        }\n\n        [data-vorta-maintenance-portal="true"]:has([data-vorta-dashboard-root="true"])\n          > button.fixed.bottom-4.right-4 {\n          display: none !important;\n        }\n\n        @media (min-width: 1280px) {\n          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] {\n            display: grid !important;\n            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n            grid-auto-flow: row !important;\n            overflow: visible !important;\n            scroll-snap-type: none !important;\n          }\n\n          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] > * {\n            width: 100% !important;\n            min-width: 0 !important;\n          }\n\n          [data-vorta-dashboard-root="true"] button[aria-label^="Scroll to previous risk KPI"],\n          [data-vorta-dashboard-root="true"] button[aria-label^="Scroll to next risk KPI"] {\n            display: none !important;\n          }\n        }\n      \`}</style>\n\n      <DashboardOverviewSection />\n    </div>\n  );\n}\n`,
);

await write(
  "src/lib/maintenanceAiAssistant.ts",
  `export type MaintenanceAiRole =\n  | "maintenance-manager"\n  | "planner"\n  | "engineer"\n  | "operator"\n  | "production-manager"\n  | "contractor";\n\nexport interface MaintenanceAiPrompt {\n  question: string;\n  role?: MaintenanceAiRole;\n  submit?: boolean;\n}\n\nexport function openMaintenanceAiAssistant({\n  question,\n  role = "maintenance-manager",\n  submit = true,\n}: MaintenanceAiPrompt): void {\n  const trimmed = question.trim();\n  if (!trimmed) return;\n\n  window.dispatchEvent(\n    new CustomEvent("vorta-global-ai-prompt", {\n      detail: {\n        question: trimmed,\n        submit,\n        role,\n      },\n    }),\n  );\n}\n`,
);

await patch("src/screens/Equipment/EquipmentWorkOrders.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import { openWorkOrderDetail } from "../../lib/maintenanceActions";\n',
    'import { openWorkOrderDetail } from "../../lib/maintenanceActions";\nimport { openMaintenanceAiAssistant } from "../../lib/maintenanceAiAssistant";\n',
    "work-orders AI helper import",
  );
  next = replaceRegex(
    next,
    /  const askVorta = useCallback\([\s\S]*?\n  \);\n\n  const openRiskAction/,
    `  const askVorta = useCallback(\n    (prompt?: string) => {\n      if (!equipment) return;\n\n      const resolvedPrompt =\n        prompt ||\n        question.trim() ||\n        \`Explain the work-order execution risk for ${"${equipment.name}"} and rank the highest-value next actions.\`;\n\n      openMaintenanceAiAssistant({\n        question: \`${"${resolvedPrompt}"} Equipment: ${"${equipment.name}"} (${"${equipment.assetNumber}"}).\`,\n      });\n    },\n    [equipment, question],\n  );\n\n  const openRiskAction`,
    "same-page Work Orders Ask Vorta",
  );
  return next;
});

await patch("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx", (source) => {
  let next = source.replace(
    'const EQUIPMENT_WORK_ORDERS_ROUTE = /^\\/equipment\\/[^/]+\\/work-orders\\/?$/;\n',
    "",
  );
  next = replaceRegex(
    next,
    /function workOrderAskVortaQuestion\([\s\S]*?\n}\n\nexport function MaintenanceAiWorkOrderExperience/,
    "export function MaintenanceAiWorkOrderExperience",
    "remove click-text AI extraction",
  );
  next = replaceRegex(
    next,
    /  const handlePortalClick = useCallback\([\s\S]*?\n  \);\n\n  return \(/,
    `  const trackRecommendationFollowThrough = useCallback(\n    (event: ReactMouseEvent<HTMLDivElement>): void => {\n      const routeUrl = routeUrlFromTarget(event.target);\n      const siteId = siteContext?.siteId;\n      if (!routeUrl || !siteId || routeUrl.searchParams.get("from") !== "ai") return;\n\n      void trackPilotUsageEvent({\n        siteId,\n        eventType: "recommendation_opened",\n        pathname: window.location.pathname,\n        entityType: "route",\n        entityId: routeUrl.pathname,\n        metadata: { destination: routeUrl.pathname },\n      });\n    },\n    [siteContext?.siteId],\n  );\n\n  return (`,
    "direct AI event workflow",
  );
  next = replaceOnce(
    next,
    "onClickCapture={handlePortalClick}",
    "onClickCapture={trackRecommendationFollowThrough}",
    "recommendation tracking handler",
  );
  next = replaceOnce(
    next,
    `        [data-vorta-maintenance-portal="true"] [aria-label="Equipment sections"] button {\n          min-height: 2.5rem;\n          display: flex;\n          align-items: center;\n        }`,
    `        [data-vorta-maintenance-portal="true"] [aria-label="Equipment sections"] button {\n          min-height: 2.5rem;\n          display: flex;\n          align-items: center;\n        }\n\n        [data-vorta-maintenance-portal="true"]:has([data-vorta-embedded-ai="true"])\n          > button.fixed.bottom-4.right-4,\n        [data-vorta-maintenance-portal="true"]:has(input[placeholder^="Ask Vorta about"])\n          > button.fixed.bottom-4.right-4 {\n          display: none !important;\n        }`,
    "embedded AI launcher suppression",
  );
  return next;
});

await patch("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx", (source) =>
  replaceRegex(
    source,
    /searchEquipmentKnowledge\(\n\s+topAsset\?\.id \?\?\n\s+"fl-03",\n\s+knowledgeQuery,\n\s+5,\n\s+\),/,
    `topAsset\n              ? searchEquipmentKnowledge(\n                  topAsset.id,\n                  knowledgeQuery,\n                  5,\n                )\n              : Promise.resolve([] as EquipmentKnowledgeChunk[]),`,
    "remove arbitrary equipment knowledge fallback",
  ),
);

for (const path of [
  "src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx",
  "src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx",
]) {
  await patch(path, (source) =>
    source.replace(/text-\[(?:7\.5|8|8\.5|9|9\.5|10|11)px\]/g, "text-xs"),
  );
}

await patch("src/screens/SkillsMatrix/SkillsMatrixNative.tsx", (source) => {
  let next = replaceOnce(
    source,
    '    if (priorityOnly) values.push("Priority gaps only");\n',
    `    if (selectedSkillId) {\n      const selectedContextSkill = selectedDetail?.matrixSkills.find(\n        (skill) => skill.id === selectedSkillId,\n      );\n      values.push(\n        selectedContextSkill\n          ? \`Skill: ${"${selectedContextSkill.name}"}\`\n          : "Selected skill",\n      );\n    }\n    if (priorityOnly) values.push("Priority gaps only");\n`,
    "direct selected skill context",
  );
  next = replaceOnce(
    next,
    "  }, [equipmentFilterId, priorityOnly, search, selectedArea, selectedDetail, selectedSummary]);",
    "  }, [equipmentFilterId, priorityOnly, search, selectedArea, selectedDetail, selectedSkillId, selectedSummary]);",
    "selected skill context dependency",
  );
  return next;
});

await write(
  "src/components/MaintenancePortalHardening.tsx",
  `export function MaintenancePortalHardening(): JSX.Element {\n  return (\n    <style>{\`\n      [data-vorta-maintenance-portal="true"] {\n        min-width: 0;\n      }\n\n      [data-vorta-maintenance-portal="true"] *,\n      [data-vorta-maintenance-portal="true"] *::before,\n      [data-vorta-maintenance-portal="true"] *::after {\n        min-width: 0;\n      }\n\n      [data-vorta-maintenance-portal="true"] [class*="text-[7.5px]"],\n      [data-vorta-maintenance-portal="true"] [class*="text-[8px]"],\n      [data-vorta-maintenance-portal="true"] [class*="text-[8.5px]"],\n      [data-vorta-maintenance-portal="true"] [class*="text-[9px]"],\n      [data-vorta-maintenance-portal="true"] [class*="text-[9.5px]"],\n      [data-vorta-maintenance-portal="true"] [class*="text-[10px]"],\n      [data-vorta-maintenance-portal="true"] [class*="text-[11px]"] {\n        font-size: 0.75rem !important;\n        line-height: 1rem !important;\n      }\n\n      [data-vorta-maintenance-portal="true"] button,\n      [data-vorta-maintenance-portal="true"] [role="button"],\n      [data-vorta-maintenance-portal="true"] [role="dialog"] button,\n      [data-vorta-maintenance-portal="true"] [role="dialog"] [role="button"] {\n        min-height: 2.5rem;\n      }\n\n      [data-vorta-maintenance-portal="true"] td,\n      [data-vorta-maintenance-portal="true"] th,\n      [data-vorta-maintenance-portal="true"] [role="dialog"] {\n        overflow-wrap: anywhere;\n      }\n\n      [data-vorta-maintenance-portal="true"] [role="dialog"] {\n        max-height: calc(100dvh - 1rem);\n      }\n\n      @media (max-width: 420px) {\n        [data-vorta-maintenance-portal="true"] {\n          overflow-x: clip;\n        }\n\n        [data-vorta-maintenance-portal="true"] [class*="grid-cols-2"],\n        [data-vorta-maintenance-portal="true"] [class*="grid-cols-3"],\n        [data-vorta-maintenance-portal="true"] [class*="grid-cols-4"],\n        [data-vorta-maintenance-portal="true"] [class*="grid-cols-5"],\n        [data-vorta-maintenance-portal="true"] [class*="grid-cols-6"] {\n          grid-template-columns: minmax(0, 1fr) !important;\n        }\n\n        [data-vorta-maintenance-portal="true"] [role="dialog"] {\n          width: calc(100vw - 0.75rem) !important;\n          max-width: calc(100vw - 0.75rem) !important;\n          margin-inline: auto;\n        }\n\n        [data-vorta-maintenance-portal="true"] [class*="overflow-x-auto"] table {\n          min-width: 42rem;\n        }\n      }\n\n      @media (min-width: 600px) and (max-width: 1024px) {\n        [data-vorta-maintenance-portal="true"] [class*="grid-cols-4"],\n        [data-vorta-maintenance-portal="true"] [class*="grid-cols-5"],\n        [data-vorta-maintenance-portal="true"] [class*="grid-cols-6"] {\n          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;\n        }\n\n        [data-vorta-maintenance-portal="true"] [role="dialog"] {\n          max-width: min(92vw, 48rem) !important;\n        }\n      }\n    \`}</style>\n  );\n}\n`,
);

await write(
  "src/components/MaintenanceActionEvidenceHardening.tsx",
  `export function MaintenanceActionEvidenceHardening(): JSX.Element {\n  return (\n    <style>{\`\n      [data-vorta-maintenance-portal="true"] [data-vorta-action-evidence] dt,\n      [data-vorta-maintenance-portal="true"] [data-vorta-action-evidence] [data-label] {\n        color: rgb(148 163 184);\n        font-size: 0.75rem;\n        font-weight: 600;\n        letter-spacing: 0.04em;\n      }\n\n      @media (max-width: 1024px) {\n        [data-vorta-maintenance-portal="true"] button,\n        [data-vorta-maintenance-portal="true"] [role="button"],\n        [data-vorta-maintenance-portal="true"] [role="dialog"] button,\n        [data-vorta-maintenance-portal="true"] [role="dialog"] [role="button"] {\n          min-height: 2.75rem;\n        }\n      }\n    \`}</style>\n  );\n}\n`,
);

await patch("src/components/PortalShell.tsx", (source) =>
  source
    .replaceAll("xl:", "2xl:")
    .replaceAll("(min-width: 1280px)", "(min-width: 1536px)"),
);

const equipmentDirectory = join(root, "src/screens/Equipment");
for (const file of await readdir(equipmentDirectory)) {
  if (!file.endsWith(".tsx")) continue;
  const path = join("src/screens/Equipment", file);
  const source = await read(path);
  const next = source.replaceAll(
    'className="sticky top-0 z-10',
    'className="lg:sticky lg:top-0 z-10',
  );
  if (next !== source) await write(path, next);
}

await patch("tests/browser/maintenance-manager-core.spec.ts", (source) => {
  let next = replaceRegex(
    source,
    /  const riskScopeTabs = page.getByRole\("tablist", \{[\s\S]*?  await expect\(areaTab\)\.toHaveAttribute\("aria-selected", "true"\);/,
    `  const viewportWidth = page.viewportSize()?.width ?? 1366;\n  if (viewportWidth <= 420) {\n    const riskScopeSelect = page.getByLabel("Risk scope", { exact: true });\n    await expect(riskScopeSelect).toBeVisible();\n    const areaOption = riskScopeSelect.locator('option:not([value="site"])').first();\n    const areaValue = await areaOption.getAttribute("value");\n    expect(areaValue).not.toBeNull();\n    await riskScopeSelect.selectOption(areaValue ?? "");\n    await expect(riskScopeSelect).toHaveValue(areaValue ?? "");\n  } else {\n    const riskScopeTabs = page.getByRole("tablist", {\n      name: "Risk intelligence scope",\n    });\n    await expect(riskScopeTabs).toBeVisible();\n    const areaTab = riskScopeTabs\n      .getByRole("tab")\n      .filter({ hasNotText: /^\\s*Site Risk/i })\n      .first();\n    await expect(areaTab).toBeVisible();\n    await expectOperationalTouchTarget(areaTab);\n    await areaTab.click();\n    await expect(areaTab).toHaveAttribute("aria-selected", "true");\n  }\n\n  await expect(\n    page.getByRole("button", { name: "Ask Vorta AI", exact: true }),\n  ).toBeHidden();`,
    "responsive dashboard scope workflow",
  );
  next = replaceOnce(
    next,
    "  await expectNoPageOverflow(page);\n\n  const firstWorkOrderButton",
    `  await expectNoPageOverflow(page);\n  await expect(\n    page.getByRole("button", { name: "Ask Vorta AI", exact: true }),\n  ).toBeHidden();\n\n  const firstWorkOrderButton`,
    "embedded Work Orders AI collision check",
  );
  return next;
});

await write(
  "scripts/maintenance-p1-p2-contracts.mjs",
  `import { existsSync, readFileSync } from "node:fs";\nimport { fileURLToPath } from "node:url";\n\nconst read = (relativePath) =>\n  readFileSync(fileURLToPath(new URL(\`../${"${relativePath}"}\`, import.meta.url)), "utf8");\nconst check = (condition, message) => {\n  if (!condition) throw new Error(message);\n};\n\nconst service = read("src/screens/Equipment/equipmentService.ts");\nconst dashboard = read("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx");\nconst dashboardWrapper = read("src/screens/AiOperations/MaintenanceDashboardExperience.tsx");\nconst portalWrapper = read("src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx");\nconst workOrders = read("src/screens/Equipment/EquipmentWorkOrders.tsx");\nconst ai = read("src/screens/AiOperations/GlobalMaintenanceAiAssistant.tsx");\nconst hardening = read("src/components/MaintenancePortalHardening.tsx");\nconst evidenceHardening = read("src/components/MaintenanceActionEvidenceHardening.tsx");\nconst skillsMatrix = read("src/screens/SkillsMatrix/SkillsMatrixNative.tsx");\nconst portalShell = read("src/components/PortalShell.tsx");\nconst browserTest = read("tests/browser/maintenance-manager-core.spec.ts");\n\ncheck(\n  service.includes("getOperationalDashboardSnapshot") &&\n    service.includes("vorta_get_operational_dashboard_snapshot") &&\n    service.includes("vorta_refresh_and_get_operational_dashboard"),\n  "Dashboard service must expose explicit snapshot and refresh calls.",\n);\ncheck(\n  dashboard.includes("recalculate = false") &&\n    dashboard.includes("getOperationalDashboardSnapshot") &&\n    dashboard.includes("selectedRiskScopeKey, true"),\n  "Dashboard must use snapshot-first loading and explicit recalculation.",\n);\ncheck(\n  !existsSync(fileURLToPath(new URL("../src/lib/maintenanceDashboardSnapshotGuard.ts", import.meta.url))) &&\n    !dashboardWrapper.includes("installMaintenanceDashboardSnapshotGuard"),\n  "Global Supabase RPC interception must be removed.",\n);\ncheck(\n  workOrders.includes("openMaintenanceAiAssistant") &&\n    portalWrapper.includes("trackRecommendationFollowThrough") &&\n    !portalWrapper.includes("workOrderAskVortaQuestion"),\n  "Work Orders AI actions must use the shared same-page assistant event.",\n);\ncheck(\n  !ai.includes('topAsset?.id ??') && !ai.includes('"fl-03",\\n               knowledgeQuery'),\n  "Global AI must not search an arbitrary equipment fallback.",\n);\ncheck(\n  !hardening.includes("MutationObserver") &&\n    !evidenceHardening.includes("MutationObserver"),\n  "Portal hardening must not mutate React-owned content through global observers.",\n);\ncheck(\n  skillsMatrix.includes("selectedContextSkill") &&\n    skillsMatrix.includes("selectedSkillId, selectedSummary"),\n  "Skills Matrix must render selected-skill context directly.",\n);\ncheck(\n  dashboard.includes('aria-label="Risk scope"') &&\n    dashboardWrapper.includes("Ask Vorta") === false &&\n    portalWrapper.includes('placeholder^="Ask Vorta about"'),\n  "Mobile scope and embedded-AI collision controls must be present.",\n);\ncheck(\n  portalShell.includes("2xl:w-56") &&\n    portalShell.includes("min-width: 1536px"),\n  "Tablet landscape must retain the compact sidebar.",\n);\ncheck(\n  hardening.includes('[data-vorta-maintenance-portal="true"] [class*="grid-cols-2"]') &&\n    !hardening.includes('[data-vorta-maintenance-portal="true"] main [class*="grid-cols-2"]'),\n  "Responsive hardening selectors must target descendants of the real portal root.",\n);\ncheck(\n  browserTest.includes('getByLabel("Risk scope"') &&\n    browserTest.includes('name: "Ask Vorta AI"') &&\n    browserTest.includes("toBeHidden"),\n  "Browser regression must cover mobile scope and duplicate AI controls.",\n);\n\nconsole.log("Maintenance Manager audit hardening contracts passed.");\n`,
);

const guardPath = join(root, "src/lib/maintenanceDashboardSnapshotGuard.ts");
if (existsSync(guardPath)) await rm(guardPath);

console.log("Maintenance Manager audit hardening applied.");
