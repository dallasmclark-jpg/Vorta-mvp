import { readFile, writeFile } from "node:fs/promises";

const path = "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Missing ${label}`);
  source = source.slice(0, index) + replacement + source.slice(index + search.length);
}

replaceOnce(
  'import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";\n',
  'import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";\nimport { useModalFocusTrap } from "../../../../hooks/useModalFocusTrap";\nimport { openWorkOrderDetail } from "../../../../lib/maintenanceActions";\nimport type { DashboardFreshness } from "../../../../lib/runtimeContracts";\n',
  "dashboard hardening imports",
);

replaceOnce(
  'const formatSiteRisk = (value: number): string =>\n  Number(value).toFixed(1);\n',
  'const formatSiteRisk = (value: number): string =>\n  Number(value).toFixed(1);\n\nconst formatFreshness = (value: string | null): string => {\n  if (!value) return "unavailable";\n  const timestamp = new Date(value).getTime();\n  if (!Number.isFinite(timestamp)) return "unavailable";\n  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));\n  if (minutes < 1) return "just now";\n  if (minutes < 60) return `${minutes}m ago`;\n  const hours = Math.round(minutes / 60);\n  if (hours < 24) return `${hours}h ago`;\n  return new Intl.DateTimeFormat("en-GB", {\n    day: "numeric",\n    month: "short",\n    hour: "2-digit",\n    minute: "2-digit",\n  }).format(new Date(timestamp));\n};\n',
  "dashboard freshness formatter",
);

replaceOnce(
  '  const [selectedInterventionPlan, setSelectedInterventionPlan] = useState<AreaInterventionPlan | null>(null);',
  '  const [selectedInterventionPlan, setSelectedInterventionPlan] = useState<AreaInterventionPlan | null>(null);\n  const [freshness, setFreshness] = useState<DashboardFreshness | null>(null);\n  const interventionDialogRef = useModalFocusTrap<HTMLDivElement>(\n    Boolean(selectedInterventionPlan),\n    () => setSelectedInterventionPlan(null),\n  );',
  "dashboard freshness and dialog state",
);

replaceOnce(
  '        const {\n          areaProfiles,\n          siteRisk: siteProfile,\n          scopes,\n        } = operationalDashboard;\n\n        setAreaRiskCards(areaProfiles);\n',
  '        const {\n          areaProfiles,\n          siteRisk: siteProfile,\n          scopes,\n          freshness: nextFreshness,\n        } = operationalDashboard;\n\n        setAreaRiskCards(areaProfiles);\n        setFreshness(nextFreshness);\n',
  "dashboard freshness load",
);

replaceOnce(
  '          <Button\n            type="button"\n            variant="secondary"\n            onClick={() => void loadRiskDashboard(selectedKpiPeriod, selectedRiskScopeKey)}\n            disabled={dashboardRefreshing}\n            className="h-auto border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"\n          >\n            Run Risk Analysis\n          </Button>\n          <button\n            type="button"\n            onClick={() => void loadRiskDashboard(selectedKpiPeriod, selectedRiskScopeKey)}\n            disabled={dashboardRefreshing}\n            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"\n            aria-label="Refresh"\n          >\n            <RefreshCw className={`h-4 w-4 ${dashboardRefreshing ? "animate-spin" : ""}`} />\n          </button>\n',
  '          <Button\n            type="button"\n            variant="secondary"\n            onClick={() => void loadRiskDashboard(selectedKpiPeriod, selectedRiskScopeKey)}\n            disabled={dashboardRefreshing}\n            className="min-h-10 border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-50 shadow-none hover:bg-white/15 hover:text-slate-50"\n          >\n            <RefreshCw className={`mr-2 h-4 w-4 ${dashboardRefreshing ? "animate-spin" : ""}`} />\n            {dashboardRefreshing ? "Refreshing…" : "Refresh risk intelligence"}\n          </Button>\n',
  "single dashboard refresh control",
);

replaceOnce(
  '            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"\n',
  '            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"\n',
  "dashboard profile touch target",
);

replaceOnce(
  '                        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${\n',
  '                        className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${\n',
  "dashboard scope touch target",
);

replaceOnce(
  '              <div className="flex flex-col gap-0.5 text-left lg:items-end lg:text-right">\n                <p className="text-xs text-slate-400">\n                  Based on latest import\n                </p>\n\n                <p className="text-xs text-slate-500">\n                  SAP / Skills / Training data refreshed 2h ago\n                </p>\n              </div>',
  '              <div className="flex flex-col gap-0.5 text-left lg:items-end lg:text-right">\n                <p className={`text-xs font-medium ${\n                  freshness?.riskCalculatedAt ? "text-emerald-400" : "text-amber-300"\n                }`}>\n                  Risk calculated {formatFreshness(freshness?.riskCalculatedAt ?? null)}\n                </p>\n\n                <p className="text-xs text-slate-500">\n                  Maintenance {formatFreshness(freshness?.maintenanceDataAt ?? null)}\n                  {" · Workforce "}\n                  {formatFreshness(freshness?.workforceDataAt ?? null)}\n                </p>\n              </div>',
  "live dashboard freshness",
);

replaceOnce(
  '                                onClick={() =>\n                                  navigate(\n                                    getRiskPlanActionRoute(\n                                      riskReductionPlan.equipmentId,\n                                      action,\n                                    ),\n                                  )\n                                }\n',
  '                                onClick={() => {\n                                  if (workOrder) {\n                                    openWorkOrderDetail({\n                                      equipmentId: riskReductionPlan.equipmentId,\n                                      workOrderNumber: workOrder,\n                                    });\n                                    return;\n                                  }\n                                  navigate(\n                                    getRiskPlanActionRoute(\n                                      riskReductionPlan.equipmentId,\n                                      action,\n                                    ),\n                                  );\n                                }}\n',
  "explicit dashboard work order action",
);

replaceOnce(
  '                <Card\n                  key={equipment.id}\n                  onClick={() =>\n                    handleAssetClick(\n                      equipment.id,\n                    )\n                  }\n                  className="cursor-pointer rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700 hover:bg-[#181e2a]"\n                >',
  '                <Card\n                  key={equipment.id}\n                  role="link"\n                  tabIndex={0}\n                  aria-label={`View ${equipment.label}`}\n                  onClick={() => handleAssetClick(equipment.id)}\n                  onKeyDown={(event) => {\n                    if (event.target !== event.currentTarget) return;\n                    if (event.key === "Enter" || event.key === " ") {\n                      event.preventDefault();\n                      handleAssetClick(equipment.id);\n                    }\n                  }}\n                  className="cursor-pointer rounded-xl border border-gray-800 bg-[#141820] shadow-none transition-colors hover:border-gray-700 hover:bg-[#181e2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"\n                >',
  "equipment card keyboard action",
);

replaceOnce(
  '            <div\n              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-[#141820] shadow-2xl"\n              onClick={(e) => e.stopPropagation()}\n            >',
  '            <div\n              ref={interventionDialogRef}\n              role="dialog"\n              aria-modal="true"\n              aria-label="Recommended maintenance intervention"\n              tabIndex={-1}\n              className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-[#141820] shadow-2xl"\n              onClick={(e) => e.stopPropagation()}\n            >',
  "intervention dialog focus trap",
);

source = source
  .replaceAll('className="flex h-7 w-7 shrink-0', 'className="flex h-10 w-10 shrink-0')
  .replaceAll('text-[9px]', 'text-[11px]')
  .replaceAll('text-[10px]', 'text-xs');

await writeFile(path, source);
console.log(`Updated ${path}`);
