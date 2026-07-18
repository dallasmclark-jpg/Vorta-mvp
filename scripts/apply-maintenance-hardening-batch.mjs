import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const source = await readFile(path, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`No changes applied to ${path}`);
  await writeFile(path, next);
  console.log(`Updated ${path}`);
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Ambiguous ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`Expected one ${label}, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

await edit("src/screens/SkillsMatrix/SkillsMatrixNative.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import {\n  clearMaintenancePortalDataCache,\n  supabase,\n} from "../../lib/supabaseClient";\n',
    'import {\n  clearMaintenancePortalDataCache,\n  supabase,\n} from "../../lib/supabaseClient";\nimport { validateSkillsMatrixPayload } from "../../lib/runtimeContracts";\n',
    "skills matrix runtime import",
  );
  next = replaceOnce(
    next,
    'function normaliseSkillsMatrixPayload(\n  payload: SkillsMatrixPayload,\n): SkillsMatrixPayload {\n  return payload;\n}\n',
    'function normaliseSkillsMatrixPayload(\n  payload: unknown,\n): SkillsMatrixPayload {\n  return validateSkillsMatrixPayload(payload) as unknown as SkillsMatrixPayload;\n}\n',
    "skills matrix normaliser",
  );
  next = replaceOnce(
    next,
    '      const resolved = normaliseSkillsMatrixPayload(\n        payload as SkillsMatrixPayload,\n      );',
    '      const resolved = normaliseSkillsMatrixPayload(payload);',
    "skills matrix validation call",
  );
  next = replaceOnce(
    next,
    '  const selectedDetail = selectedSummary\n    ? data?.details[selectedSummary.id] ?? null\n    : null;\n',
    '  const selectedDetail = selectedSummary\n    ? data?.details[selectedSummary.id] ?? null\n    : null;\n\n  const activeContext = useMemo(() => {\n    const values: string[] = [];\n    if (selectedSummary) values.push(selectedSummary.name);\n    if (selectedArea !== ALL_SITE) values.push(selectedArea);\n    if (equipmentFilterId) {\n      const equipment = selectedDetail?.priorityRisks.find(\n        (risk) => risk.equipmentId === equipmentFilterId,\n      );\n      values.push(equipment ? `${equipment.equipmentName} (${equipment.equipmentCode})` : "Equipment filter");\n    }\n    if (priorityOnly) values.push("Priority gaps only");\n    if (search.trim()) values.push(`Search: ${search.trim()}`);\n    return values;\n  }, [equipmentFilterId, priorityOnly, search, selectedArea, selectedDetail, selectedSummary]);\n\n  const clearOperationalFilters = (): void => {\n    setSelectedArea(ALL_SITE);\n    setSearch("");\n    setPriorityOnly(false);\n    setSelectedSkillId(null);\n    setSearchParams((current) => {\n      const next = new URLSearchParams(current);\n      ["area", "q", "priority", "skill", "equipment"].forEach((key) => next.delete(key));\n      return next;\n    }, { replace: true });\n  };\n',
    "skills matrix active context",
  );
  next = replaceOnce(
    next,
    '      {error && !data ? (',
    '      {activeContext.length > 0 ? (\n        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3">\n          <p className="text-sm text-slate-300">\n            <span className="font-semibold text-blue-300">Showing:</span>{" "}\n            {activeContext.join(" · ")}\n          </p>\n          <button\n            type="button"\n            onClick={clearOperationalFilters}\n            className="inline-flex min-h-10 items-center rounded-lg border border-blue-500/25 px-3 text-xs font-semibold text-blue-300 hover:bg-blue-500/10"\n          >\n            Clear filters\n          </button>\n        </div>\n      ) : null}\n\n      {error && !data ? (',
    "skills matrix context banner",
  );
  return next
    .replaceAll('className="h-9 gap-2 border-[#ffffff20]', 'className="min-h-10 gap-2 border-[#ffffff20]')
    .replaceAll('className="inline-flex h-9 w-9 items-center', 'className="inline-flex h-10 w-10 items-center');
});

await edit("src/screens/PilotSetup/usePilotSetup.ts", (source) => {
  let next = replaceOnce(
    source,
    'import { supabase } from "../../lib/supabaseClient";\n',
    'import { supabase } from "../../lib/supabaseClient";\nimport { validatePilotSetupReport } from "../../lib/runtimeContracts";\n',
    "pilot setup runtime import",
  );
  next = replaceOnce(
    next,
    '    initialiseForms(data as PilotSetupReport);',
    '    const validated = validatePilotSetupReport(data) as unknown as PilotSetupReport;\n    initialiseForms(validated);',
    "pilot setup load validation",
  );
  next = replaceOnce(
    next,
    '      const nextReport = data as PilotSetupReport;',
    '      const nextReport = validatePilotSetupReport(data) as unknown as PilotSetupReport;',
    "pilot setup mutation validation",
  );
  return next;
});

await edit("src/screens/PilotImpact/PilotImpactSection.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import { supabase } from "../../lib/supabaseClient";\n',
    'import { supabase } from "../../lib/supabaseClient";\nimport { trackPilotUsageEvent } from "../../lib/pilotUsage";\nimport { validatePilotImpactReport } from "../../lib/runtimeContracts";\n',
    "pilot impact imports",
  );
  next = replaceOnce(
    next,
    '    setReport(data as PilotValueReport);\n    setAppliedPreset(range.preset);',
    '    const nextReport = validatePilotImpactReport(data) as unknown as PilotValueReport;\n    setReport(nextReport);\n    setAppliedPreset(range.preset);\n\n    if (!initial) {\n      void trackPilotUsageEvent({\n        siteId: siteContext.siteId,\n        eventType: "pilot_report_range_applied",\n        pathname: "/pilot-impact",\n        entityType: "report",\n        entityId: "pilot-impact",\n        metadata: { preset: range.preset, surface: "impact" },\n      });\n    }',
    "pilot impact validation",
  );
  next = replaceOnce(
    next,
    '  const downloadPilotReport = (): void => {\n    if (!report) return;\n',
    '  const downloadPilotReport = (): void => {\n    if (!report) return;\n\n    void trackPilotUsageEvent({\n      siteId: siteContext?.siteId,\n      eventType: "pilot_report_downloaded",\n      pathname: "/pilot-impact",\n      entityType: "report",\n      entityId: "pilot-impact",\n      metadata: { format: "print_pdf" },\n    });\n',
    "pilot report download tracking",
  );
  return next;
});

await edit("src/screens/PilotAdoption/PilotAdoptionSection.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import { supabase } from "../../lib/supabaseClient";\n',
    'import { supabase } from "../../lib/supabaseClient";\nimport { validatePilotAdoptionReport } from "../../lib/runtimeContracts";\n',
    "pilot adoption runtime import",
  );
  next = replaceOnce(
    next,
    '    const nextReport = data as AdoptionReport;',
    '    const nextReport = validatePilotAdoptionReport(data) as unknown as AdoptionReport;',
    "pilot adoption validation",
  );
  return next;
});

await edit("src/screens/Equipment/workOrderExecutionService.ts", (source) => {
  let next = replaceOnce(
    source,
    'import { getEquipmentIdentityById } from "./equipmentService";\n',
    'import { getEquipmentIdentityById } from "./equipmentService";\nimport { validateWorkOrderRow } from "../../lib/runtimeContracts";\n',
    "work order contract import",
  );
  next = replaceOnce(
    next,
    '  const workOrder = workOrderData as WorkOrderRow;',
    '  const workOrder = validateWorkOrderRow(workOrderData) as unknown as WorkOrderRow;',
    "work order row validation",
  );
  return next;
});

await edit("src/screens/Equipment/equipmentService.ts", (source) => {
  let next = replaceOnce(
    source,
    'import { EQUIPMENT_IMAGES, resolveEquipmentImage } from "./equipmentImages";\n',
    'import { EQUIPMENT_IMAGES, resolveEquipmentImage } from "./equipmentImages";\nimport {\n  parseDashboardFreshness,\n  validateOperationalDashboardPayload,\n  type DashboardFreshness,\n} from "../../lib/runtimeContracts";\n',
    "dashboard contract imports",
  );
  next = replaceOnce(
    next,
    'export interface OperationalRiskDashboardPayload {\n  areaProfiles: AreaRiskProfile[];\n  siteRisk: SiteRiskProfile | null;\n  scopes: RiskDashboardScope[];\n}',
    'export interface OperationalRiskDashboardPayload {\n  areaProfiles: AreaRiskProfile[];\n  siteRisk: SiteRiskProfile | null;\n  scopes: RiskDashboardScope[];\n  freshness: DashboardFreshness | null;\n}',
    "dashboard payload freshness type",
  );
  next = replaceRegexOnce(
    next,
    /    if \(\n      !data \|\|[\s\S]*?    const payload =\n      data as Record<string, unknown>;/,
    '    const payload = validateOperationalDashboardPayload(data);',
    "operational payload validation block",
  );
  next = replaceOnce(
    next,
    '    return {\n      areaProfiles,\n      siteRisk,\n      scopes,\n    };',
    '    return {\n      areaProfiles,\n      siteRisk,\n      scopes,\n      freshness: parseDashboardFreshness(payload.freshness),\n    };',
    "dashboard freshness return",
  );
  return next;
});

await edit("src/screens/Equipment/GlobalWorkOrderExecutionOverlay.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import { Button } from "../../components/ui/button";\n',
    'import { Button } from "../../components/ui/button";\nimport { useModalFocusTrap } from "../../hooks/useModalFocusTrap";\nimport {\n  VORTA_WORK_ORDER_DETAIL_EVENT,\n  type WorkOrderDetailSelection,\n} from "../../lib/maintenanceActions";\nexport { VORTA_WORK_ORDER_DETAIL_EVENT } from "../../lib/maintenanceActions";\n',
    "work order overlay imports",
  );
  next = replaceOnce(
    next,
    'export const VORTA_WORK_ORDER_DETAIL_EVENT = "vorta-work-order-detail";\n\ninterface WorkOrderDetailEvent {\n  equipmentId?: string;\n  workOrderNumber?: string;\n}\n\n',
    '',
    "old work order event declaration",
  );
  next = next.replaceAll("WorkOrderDetailEvent", "WorkOrderDetailSelection");
  next = replaceRegexOnce(
    next,
    /  useEffect\(\(\) => \{\n    if \(!selection\) return;[\s\S]*?  \}, \[close, selection\]\);\n\n/,
    '  const drawerRef = useModalFocusTrap<HTMLElement>(Boolean(selection), close);\n\n',
    "overlay escape effect",
  );
  next = replaceOnce(
    next,
    '      <aside\n        className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col border-l border-gray-800 bg-[#10151f] shadow-2xl shadow-black/70"\n        aria-label="Work order information"\n        aria-modal="true"\n        role="dialog"\n      >',
    '      <aside\n        ref={drawerRef}\n        className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col border-l border-gray-800 bg-[#10151f] shadow-2xl shadow-black/70"\n        aria-label="Work order information"\n        aria-modal="true"\n        role="dialog"\n        tabIndex={-1}\n      >',
    "overlay drawer ref",
  );
  return next
    .replaceAll('className="inline-flex h-9 w-9 shrink-0', 'className="inline-flex h-10 w-10 shrink-0')
    .replaceAll('text-[9px]', 'text-[11px]')
    .replaceAll('text-[10px]', 'text-xs');
});

await edit("src/screens/Equipment/EquipmentWorkOrders.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import { Card, CardContent } from "../../components/ui/card";\n',
    'import { Card, CardContent } from "../../components/ui/card";\nimport { openWorkOrderDetail } from "../../lib/maintenanceActions";\n',
    "equipment work order action import",
  );
  next = replaceOnce(
    next,
    '      if (action.workOrderNumber) {\n        setRegisterView("OPEN");\n        setSearch(action.workOrderNumber);\n        setSearchParams(\n          { workOrder: action.workOrderNumber },\n          { replace: true },\n        );\n        requestAnimationFrame(() => {\n          document\n            .getElementById("work-order-register")\n            ?.scrollIntoView({ behavior: "smooth", block: "start" });\n        });\n        return;\n      }',
    '      if (action.workOrderNumber) {\n        openWorkOrderDetail({\n          equipmentId: equipment.id,\n          workOrderNumber: action.workOrderNumber,\n        });\n        return;\n      }',
    "risk action work order open",
  );
  next = replaceRegexOnce(
    next,
    /              onOpenWorkOrder=\{\(workOrderNumber\) => \{[\s\S]*?              \}\}\n/,
    '              onOpenWorkOrder={(workOrderNumber) => {\n                openWorkOrderDetail({\n                  equipmentId: equipment.id,\n                  workOrderNumber,\n                });\n              }}\n',
    "schedule work order open",
  );
  next = replaceOnce(
    next,
    '                            <button\n                              type="button"\n                              onClick={() =>\n                                void copyValue(workOrder.id, workOrder.id)\n                              }\n                              className="font-mono text-xs font-semibold text-blue-300 hover:text-blue-200"\n                            >\n                              {workOrder.id}\n                            </button>',
    '                            <button\n                              type="button"\n                              onClick={() =>\n                                openWorkOrderDetail({\n                                  equipmentId: equipment.id,\n                                  workOrderNumber: workOrder.id,\n                                })\n                              }\n                              className="min-h-10 font-mono text-xs font-semibold text-blue-300 hover:text-blue-200"\n                            >\n                              {workOrder.id}\n                            </button>',
    "open register work order action",
  );
  next = replaceOnce(
    next,
    '                        <td className="px-4 py-4 align-top font-mono text-xs font-semibold text-blue-300">\n                          {workOrder.id}\n                        </td>',
    '                        <td className="px-4 py-4 align-top">\n                          <button\n                            type="button"\n                            onClick={() =>\n                              openWorkOrderDetail({\n                                equipmentId: equipment.id,\n                                workOrderNumber: workOrder.id,\n                              })\n                            }\n                            className="min-h-10 font-mono text-xs font-semibold text-blue-300 hover:text-blue-200"\n                          >\n                            {workOrder.id}\n                          </button>\n                        </td>',
    "completed work order action",
  );
  return next
    .replaceAll('className="inline-flex h-8 w-8 items-center', 'className="inline-flex h-10 w-10 items-center')
    .replaceAll('className="inline-flex h-8 w-8 shrink-0', 'className="inline-flex h-10 w-10 shrink-0')
    .replaceAll('className="h-9 w-full rounded-lg', 'className="min-h-10 w-full rounded-lg')
    .replaceAll('className="h-9 gap-2 border-gray-700', 'className="min-h-10 gap-2 border-gray-700');
});

await edit("src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import { Button } from "../../components/ui/button";\n',
    'import { Button } from "../../components/ui/button";\nimport { openWorkOrderDetail } from "../../lib/maintenanceActions";\n',
    "AI work order action import",
  );
  next = replaceOnce(
    next,
    '          <a\n            key={record.id}\n            href={`/equipment/${encodeURIComponent(record.equipmentId)}/history`}\n            className="block rounded-lg border border-gray-800 bg-[#0d131b] px-3 py-2.5 transition-colors hover:border-blue-500/40 hover:bg-blue-500/[0.05]"\n          >',
    '          <button\n            key={record.id}\n            type="button"\n            onClick={() =>\n              openWorkOrderDetail({\n                equipmentId: record.equipmentId,\n                workOrderNumber: record.workOrderNumber,\n              })\n            }\n            className="block min-h-11 w-full rounded-lg border border-gray-800 bg-[#0d131b] px-3 py-2.5 text-left transition-colors hover:border-blue-500/40 hover:bg-blue-500/[0.05]"\n          >',
    "AI history work order button",
  );
  next = replaceOnce(next, '          </a>\n', '          </button>\n', "AI history button close");
  return next.replaceAll('text-[8px]', 'text-[10px]').replaceAll('text-[9px]', 'text-[11px]');
});

await edit("src/components/PortalShell.tsx", (source) => {
  let next = replaceOnce(
    source,
    'import { PageTransition } from "./PageTransition";\n',
    'import { PageTransition } from "./PageTransition";\nimport { useModalFocusTrap } from "../hooks/useModalFocusTrap";\n',
    "portal focus import",
  );
  next = replaceOnce(
    next,
    '  const [mobileOpen, setMobileOpen] = useState(false);\n  const scrollRef = useRef<HTMLDivElement>(null);',
    '  const [mobileOpen, setMobileOpen] = useState(false);\n  const scrollRef = useRef<HTMLDivElement>(null);\n  const mobileDrawerRef = useModalFocusTrap<HTMLDivElement>(\n    mobileOpen,\n    () => setMobileOpen(false),\n  );',
    "mobile drawer focus state",
  );
  next = replaceOnce(
    next,
    '          <div className="relative z-50 flex w-64 shrink-0 flex-col">',
    '          <div\n            ref={mobileDrawerRef}\n            role="dialog"\n            aria-modal="true"\n            aria-label="Portal navigation"\n            tabIndex={-1}\n            className="relative z-50 flex w-64 shrink-0 flex-col"\n          >',
    "mobile drawer focus ref",
  );
  return next
    .replaceAll('className="absolute right-3 top-3 inline-flex h-7 w-7', 'className="absolute right-3 top-3 inline-flex h-10 w-10')
    .replaceAll('className="inline-flex h-8 w-8 items-center', 'className="inline-flex h-10 w-10 items-center');
});

await edit("src/screens/PilotSetup/PilotSetupSection.tsx", (source) => {
  let next = replaceOnce(source, 'import { useEffect } from "react";\n', '', "old pilot dialog effect import");
  next = replaceOnce(
    next,
    'import { usePilotSetup } from "./usePilotSetup";\n',
    'import { usePilotSetup } from "./usePilotSetup";\nimport { useModalFocusTrap } from "../../hooks/useModalFocusTrap";\n',
    "pilot focus import",
  );
  next = replaceRegexOnce(
    next,
    /  useEffect\(\(\) => \{[\s\S]*?  \}, \[busy, onCancel\]\);\n\n/,
    '  const dialogRef = useModalFocusTrap<HTMLElement>(true, busy ? undefined : onCancel);\n\n',
    "pilot launch dialog effect",
  );
  next = replaceOnce(
    next,
    '      <section\n        role="dialog"',
    '      <section\n        ref={dialogRef}\n        role="dialog"',
    "pilot dialog focus ref",
  );
  next = replaceOnce(
    next,
    '        aria-labelledby="pilot-launch-title"\n        className=',
    '        aria-labelledby="pilot-launch-title"\n        tabIndex={-1}\n        className=',
    "pilot dialog tabindex",
  );
  return next.replaceAll('className="flex h-9 w-9 items-center', 'className="flex h-10 w-10 items-center');
});

console.log("Maintenance hardening codemod completed.");
