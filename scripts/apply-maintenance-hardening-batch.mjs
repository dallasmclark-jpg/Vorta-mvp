import { readFile, writeFile } from "node:fs/promises";

async function update(path, transform) {
  const source = await readFile(path, "utf8");
  const next = transform(source);
  if (next !== source) {
    await writeFile(path, next);
    console.log(`Updated ${path}`);
  } else {
    console.log(`Already current ${path}`);
  }
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Missing ${label}`);
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

await update(
  "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx",
  (original) => {
    if (original.includes('import { openWorkOrderDetail } from "../../../../lib/maintenanceActions";')) {
      return original;
    }
    let source = original;
    source = replaceOnce(
      source,
      'import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";\n',
      'import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";\nimport { useModalFocusTrap } from "../../../../hooks/useModalFocusTrap";\nimport { openWorkOrderDetail } from "../../../../lib/maintenanceActions";\nimport type { DashboardFreshness } from "../../../../lib/runtimeContracts";\n',
      "dashboard imports",
    );
    source = replaceOnce(
      source,
      'const formatSiteRisk = (value: number): string =>\n  Number(value).toFixed(1);\n',
      'const formatSiteRisk = (value: number): string =>\n  Number(value).toFixed(1);\n\nconst formatFreshness = (value: string | null): string => {\n  if (!value) return "unavailable";\n  const timestamp = new Date(value).getTime();\n  if (!Number.isFinite(timestamp)) return "unavailable";\n  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));\n  if (minutes < 1) return "just now";\n  if (minutes < 60) return `${minutes}m ago`;\n  const hours = Math.round(minutes / 60);\n  if (hours < 24) return `${hours}h ago`;\n  return new Intl.DateTimeFormat("en-GB", {\n    day: "numeric",\n    month: "short",\n    hour: "2-digit",\n    minute: "2-digit",\n  }).format(new Date(timestamp));\n};\n',
      "dashboard freshness formatter",
    );
    source = replaceOnce(
      source,
      '  const [selectedInterventionPlan, setSelectedInterventionPlan] = useState<AreaInterventionPlan | null>(null);',
      '  const [selectedInterventionPlan, setSelectedInterventionPlan] = useState<AreaInterventionPlan | null>(null);\n  const [freshness, setFreshness] = useState<DashboardFreshness | null>(null);\n  const interventionDialogRef = useModalFocusTrap<HTMLDivElement>(\n    Boolean(selectedInterventionPlan),\n    () => setSelectedInterventionPlan(null),\n  );',
      "dashboard state",
    );
    source = replaceOnce(
      source,
      '        const {\n          areaProfiles,\n          siteRisk: siteProfile,\n          scopes,\n        } = operationalDashboard;\n\n        setAreaRiskCards(areaProfiles);\n',
      '        const {\n          areaProfiles,\n          siteRisk: siteProfile,\n          scopes,\n          freshness: nextFreshness,\n        } = operationalDashboard;\n\n        setAreaRiskCards(areaProfiles);\n        setFreshness(nextFreshness);\n',
      "dashboard freshness load",
    );
    source = replaceOnce(
      source,
      '          <Button\n            type="button"\n            variant="secondary"\n            onClick={() => void loadRiskDashboard(selectedKpiPeriod, selectedRiskScopeKey)}\n            disabled={dashboardRefreshing}\n            className="h-auto border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"\n          >\n            Run Risk Analysis\n          </Button>\n          <button\n            type="button"\n            onClick={() => void loadRiskDashboard(selectedKpiPeriod, selectedRiskScopeKey)}\n            disabled={dashboardRefreshing}\n            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"\n            aria-label="Refresh"\n          >\n            <RefreshCw className={`h-4 w-4 ${dashboardRefreshing ? "animate-spin" : ""}`} />\n          </button>\n',
      '          <Button\n            type="button"\n            variant="secondary"\n            onClick={() => void loadRiskDashboard(selectedKpiPeriod, selectedRiskScopeKey)}\n            disabled={dashboardRefreshing}\n            className="min-h-10 border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"\n          >\n            <RefreshCw className={`mr-2 h-4 w-4 ${dashboardRefreshing ? "animate-spin" : ""}`} />\n            {dashboardRefreshing ? "Refreshing…" : "Refresh risk intelligence"}\n          </Button>\n',
      "dashboard refresh control",
    );
    source = replaceOnce(
      source,
      '              <div className="flex flex-col gap-0.5 text-left lg:items-end lg:text-right">\n                <p className="text-xs text-slate-400">\n                  Based on latest import\n                </p>\n\n                <p className="text-xs text-slate-500">\n                  SAP / Skills / Training data refreshed 2h ago\n                </p>\n              </div>',
      '              <div className="flex flex-col gap-0.5 text-left lg:items-end lg:text-right">\n                <p className={`text-xs font-medium ${\n                  freshness?.riskCalculatedAt ? "text-emerald-400" : "text-amber-300"\n                }`}>\n                  Risk calculated {formatFreshness(freshness?.riskCalculatedAt ?? null)}\n                </p>\n                <p className="text-xs text-slate-500">\n                  Maintenance {formatFreshness(freshness?.maintenanceDataAt ?? null)}\n                  {" · Workforce "}\n                  {formatFreshness(freshness?.workforceDataAt ?? null)}\n                </p>\n              </div>',
      "dashboard freshness UI",
    );
    source = replaceOnce(
      source,
      '                                onClick={() =>\n                                  navigate(\n                                    getRiskPlanActionRoute(\n                                      riskReductionPlan.equipmentId,\n                                      action,\n                                    ),\n                                  )\n                                }\n',
      '                                onClick={() => {\n                                  if (workOrder) {\n                                    openWorkOrderDetail({\n                                      equipmentId: riskReductionPlan.equipmentId,\n                                      workOrderNumber: workOrder,\n                                    });\n                                    return;\n                                  }\n                                  navigate(\n                                    getRiskPlanActionRoute(\n                                      riskReductionPlan.equipmentId,\n                                      action,\n                                    ),\n                                  );\n                                }}\n',
      "dashboard work order action",
    );
    source = replaceOnce(
      source,
      '                <Card\n                  key={equipment.id}\n                  onClick={() =>\n                    handleAssetClick(\n                      equipment.id,\n                    )\n                  }\n                  className="cursor-pointer rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700 hover:bg-[#181e2a]"\n                >',
      '                <Card\n                  key={equipment.id}\n                  role="link"\n                  tabIndex={0}\n                  aria-label={`View ${equipment.label}`}\n                  onClick={() => handleAssetClick(equipment.id)}\n                  onKeyDown={(event) => {\n                    if (event.target !== event.currentTarget) return;\n                    if (event.key === "Enter" || event.key === " ") {\n                      event.preventDefault();\n                      handleAssetClick(equipment.id);\n                    }\n                  }}\n                  className="cursor-pointer rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700 hover:bg-[#181e2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"\n                >',
      "equipment card keyboard handling",
    );
    source = replaceOnce(
      source,
      '            <div\n              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-[#141820] shadow-2xl"\n              onClick={(e) => e.stopPropagation()}\n            >',
      '            <div\n              ref={interventionDialogRef}\n              role="dialog"\n              aria-modal="true"\n              aria-label="Recommended maintenance intervention"\n              tabIndex={-1}\n              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-[#141820] shadow-2xl"\n              onClick={(e) => e.stopPropagation()}\n            >',
      "intervention focus trap",
    );
    return source
      .replaceAll('className="inline-flex h-9 w-9 items-center', 'className="inline-flex h-10 w-10 items-center')
      .replaceAll('className={`inline-flex h-9 items-center', 'className={`inline-flex min-h-10 items-center')
      .replaceAll('text-[9px]', 'text-[11px]')
      .replaceAll('text-[10px]', 'text-xs');
  },
);

await update(
  "src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx",
  (original) => {
    if (original.includes('import { openWorkOrderDetail } from "../../lib/maintenanceActions";')) {
      return original;
    }
    let source = replaceOnce(
      original,
      'import { Button } from "../../components/ui/button";\n',
      'import { Button } from "../../components/ui/button";\nimport { openWorkOrderDetail } from "../../lib/maintenanceActions";\n',
      "AI action import",
    );
    const pattern = /          <a\n            key=\{record\.id\}\n            href=\{`\/equipment\/\$\{encodeURIComponent\(record\.equipmentId\)\}\/history`\}[\s\S]*?          <\/a>/;
    if (!pattern.test(source)) throw new Error("Missing AI history link");
    source = source.replace(pattern, (block) =>
      block
        .replace(
          /          <a\n            key=\{record\.id\}\n            href=\{`\/equipment\/\$\{encodeURIComponent\(record\.equipmentId\)\}\/history`\}/,
          '          <button\n            key={record.id}\n            type="button"\n            onClick={() => openWorkOrderDetail({\n              equipmentId: record.equipmentId,\n              workOrderNumber: record.workOrderNumber,\n            })}',
        )
        .replace('className="block rounded-lg', 'className="block min-h-11 w-full rounded-lg')
        .replace('transition-colors hover:', 'text-left transition-colors hover:')
        .replace('          </a>', '          </button>'),
    );
    return source.replaceAll('text-[8px]', 'text-[10px]').replaceAll('text-[9px]', 'text-[11px]');
  },
);

await update("src/components/PortalShell.tsx", (original) => {
  if (original.includes('import { useModalFocusTrap } from "../hooks/useModalFocusTrap";')) {
    return original;
  }
  let source = replaceOnce(
    original,
    'import { PageTransition } from "./PageTransition";\n',
    'import { PageTransition } from "./PageTransition";\nimport { useModalFocusTrap } from "../hooks/useModalFocusTrap";\n',
    "portal focus import",
  );
  source = replaceOnce(
    source,
    '  const [mobileOpen, setMobileOpen] = useState(false);\n  const scrollRef = useRef<HTMLDivElement>(null);',
    '  const [mobileOpen, setMobileOpen] = useState(false);\n  const scrollRef = useRef<HTMLDivElement>(null);\n  const mobileDrawerRef = useModalFocusTrap<HTMLDivElement>(\n    mobileOpen,\n    () => setMobileOpen(false),\n  );',
    "portal drawer state",
  );
  source = replaceOnce(
    source,
    '          <div className="relative z-50 flex w-64 shrink-0 flex-col">',
    '          <div\n            ref={mobileDrawerRef}\n            role="dialog"\n            aria-modal="true"\n            aria-label="Portal navigation"\n            tabIndex={-1}\n            className="relative z-50 flex w-64 shrink-0 flex-col"\n          >',
    "portal drawer ref",
  );
  return source
    .replaceAll('className="absolute right-3 top-3 inline-flex h-7 w-7', 'className="absolute right-3 top-3 inline-flex h-10 w-10')
    .replaceAll('className="inline-flex h-8 w-8 items-center', 'className="inline-flex h-10 w-10 items-center');
});

await update("src/screens/PilotSetup/PilotSetupSection.tsx", (original) => {
  if (original.includes('import { useModalFocusTrap } from "../../hooks/useModalFocusTrap";')) {
    return original;
  }
  let source = original.replace('import { useEffect } from "react";\n', '');
  source = replaceOnce(
    source,
    'import { usePilotSetup } from "./usePilotSetup";\n',
    'import { usePilotSetup } from "./usePilotSetup";\nimport { useModalFocusTrap } from "../../hooks/useModalFocusTrap";\n',
    "pilot focus import",
  );
  const effectPattern = /  useEffect\(\(\) => \{[\s\S]*?  \}, \[busy, onCancel\]\);\n\n/;
  if (!effectPattern.test(source)) throw new Error("Missing pilot launch effect");
  source = source.replace(
    effectPattern,
    '  const dialogRef = useModalFocusTrap<HTMLElement>(true, busy ? undefined : onCancel);\n\n',
  );
  source = replaceOnce(
    source,
    '      <section\n        role="dialog"',
    '      <section\n        ref={dialogRef}\n        role="dialog"',
    "pilot dialog ref",
  );
  source = replaceOnce(
    source,
    '        aria-labelledby="pilot-launch-title"\n        className=',
    '        aria-labelledby="pilot-launch-title"\n        tabIndex={-1}\n        className=',
    "pilot dialog tabindex",
  );
  return source.replaceAll('className="flex h-9 w-9 items-center', 'className="flex h-10 w-10 items-center');
});
