from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


def insert_after(text: str, anchor: str, addition: str, label: str) -> str:
    return replace_once(text, anchor, anchor + addition, label)


# Dashboard navigation controls.
dashboard_path = Path(
    "src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx"
)
dashboard = dashboard_path.read_text()
dashboard = replace_once(
    dashboard,
    'import { getRiskPlanActionRoute } from "../../riskActionRouting";',
    'import {\n  getRiskPlanActionRoute,\n  getRiskPlanBacklogRoute,\n} from "../../riskActionRouting";',
    "dashboard route import",
)

# The action card is a safe read-only navigation control, so stale-plan gating must not
# prevent opening the live source record.
action_key = 'key={`${action.priority}-${action.action}`}'
key_index = dashboard.index(action_key)
start = dashboard.index("disabled={riskActionsDisabled}", key_index)
line_start = dashboard.rfind("\n", 0, start) + 1
work_order_index = dashboard.index("if (workOrder) {", start)
end = work_order_index + len("if (workOrder) {")
indentation = dashboard[line_start:start]
replacement = (
    f'{indentation}aria-label={{`Open ${{action.action}} for ${{riskReductionPlan.equipmentName}}`}}\n'
    f'{indentation}onClick={{() => {{\n'
    f'{indentation}  if (workOrder) {{'
)
dashboard = dashboard[:line_start] + replacement + dashboard[end:]
dashboard = replace_once(
    dashboard,
    'className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 text-left transition-colors hover:border-blue-500/30 hover:bg-[#151b26] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-gray-800 disabled:hover:bg-[#0d1117]"',
    'className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gray-800 bg-[#0d1117] px-4 py-3 text-left transition-colors hover:border-blue-500/30 hover:bg-[#151b26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"',
    "action card focus style",
)

old_pm = '''                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-xs text-slate-500">
                          PM backlog
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentPmBacklog}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedPmBacklog <
                              riskReductionPlan.currentPmBacklog
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedPmBacklog}
                          </span>
                        </p>
                        {riskReductionPlan.projectedPmBacklog ===
                          riskReductionPlan.currentPmBacklog && (
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            No PM action selected
                          </p>
                        )}
                      </div>'''
new_pm = '''                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            getRiskPlanBacklogRoute(
                              riskReductionPlan.equipmentId,
                              "pm",
                            ),
                          )
                        }
                        aria-label={`Open PM backlog for ${riskReductionPlan.equipmentName}`}
                        data-vorta-dashboard-backlog-card="pm"
                        className="rounded-lg border border-gray-800 bg-[#0d1117] p-3 text-left transition-colors hover:border-blue-500/30 hover:bg-[#151b26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
                      >
                        <p className="text-xs text-slate-500">
                          PM backlog
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentPmBacklog}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedPmBacklog <
                              riskReductionPlan.currentPmBacklog
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedPmBacklog}
                          </span>
                        </p>
                        {riskReductionPlan.projectedPmBacklog ===
                          riskReductionPlan.currentPmBacklog && (
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            No PM action selected
                          </p>
                        )}
                      </button>'''
dashboard = replace_once(dashboard, old_pm, new_pm, "PM backlog card")

old_calibration = '''                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-xs text-slate-500">
                          Calibration backlog
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentCalibrationBacklog}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedCalibrationBacklog <
                              riskReductionPlan.currentCalibrationBacklog
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedCalibrationBacklog}
                          </span>
                        </p>
                        {riskReductionPlan.projectedCalibrationBacklog ===
                          riskReductionPlan.currentCalibrationBacklog && (
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            No calibration action selected
                          </p>
                        )}
                      </div>'''
new_calibration = '''                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            getRiskPlanBacklogRoute(
                              riskReductionPlan.equipmentId,
                              "calibrations",
                            ),
                          )
                        }
                        aria-label={`Open calibration backlog for ${riskReductionPlan.equipmentName}`}
                        data-vorta-dashboard-backlog-card="calibrations"
                        className="rounded-lg border border-gray-800 bg-[#0d1117] p-3 text-left transition-colors hover:border-blue-500/30 hover:bg-[#151b26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
                      >
                        <p className="text-xs text-slate-500">
                          Calibration backlog
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentCalibrationBacklog}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedCalibrationBacklog <
                              riskReductionPlan.currentCalibrationBacklog
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedCalibrationBacklog}
                          </span>
                        </p>
                        {riskReductionPlan.projectedCalibrationBacklog ===
                          riskReductionPlan.currentCalibrationBacklog && (
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            No calibration action selected
                          </p>
                        )}
                      </button>'''
dashboard = replace_once(
    dashboard, old_calibration, new_calibration, "calibration backlog card"
)

old_spares = '''                      <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                        <p className="text-xs text-slate-500">
                          Out-of-stock parts
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentStockouts}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedStockouts <
                              riskReductionPlan.currentStockouts
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedStockouts}
                          </span>
                        </p>
                        {riskReductionPlan.projectedStockouts ===
                          riskReductionPlan.currentStockouts && (
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            No stockout action selected
                          </p>
                        )}
                      </div>'''
new_spares = '''                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            getRiskPlanBacklogRoute(
                              riskReductionPlan.equipmentId,
                              "spares",
                            ),
                          )
                        }
                        aria-label={`Open out-of-stock parts for ${riskReductionPlan.equipmentName}`}
                        data-vorta-dashboard-backlog-card="spares"
                        className="rounded-lg border border-gray-800 bg-[#0d1117] p-3 text-left transition-colors hover:border-blue-500/30 hover:bg-[#151b26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
                      >
                        <p className="text-xs text-slate-500">
                          Out-of-stock parts
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-100">
                          {riskReductionPlan.currentStockouts}
                          <span className="mx-1.5 text-slate-600">→</span>
                          <span
                            className={
                              riskReductionPlan.projectedStockouts <
                              riskReductionPlan.currentStockouts
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {riskReductionPlan.projectedStockouts}
                          </span>
                        </p>
                        {riskReductionPlan.projectedStockouts ===
                          riskReductionPlan.currentStockouts && (
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            No stockout action selected
                          </p>
                        )}
                      </button>'''
dashboard = replace_once(dashboard, old_spares, new_spares, "spares backlog card")
dashboard_path.write_text(dashboard)

# Desktop work-order PM backlog deep link.
work_path = Path("src/screens/Equipment/EquipmentWorkOrders.tsx")
work = work_path.read_text()
work = insert_after(
    work,
    '  const selectedWorkOrder = searchParams.get("workOrder")?.trim() ?? "";\n',
    '  const requestedBacklogView = searchParams.get("view")?.trim() ?? "";\n',
    "desktop work query",
)
selected_effect = '''  useEffect(() => {
    if (!selectedWorkOrder) return;

    setSearch(selectedWorkOrder);
    setRegisterView("OPEN");

    if (openWorkOrders.length === 0) return;

    requestAnimationFrame(() => {
      document
        .getElementById(`work-order-${selectedWorkOrder}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [openWorkOrders.length, selectedWorkOrder]);
'''
work = insert_after(
    work,
    selected_effect,
    '''
  useEffect(() => {
    if (requestedBacklogView !== "pm-backlog") return;
    setRegisterView("OPEN");
    setFilter("PREVENTIVE");
    setSearch("");
    requestAnimationFrame(() => {
      document
        .getElementById("work-order-register")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [openWorkOrders.length, requestedBacklogView]);
''',
    "desktop PM effect",
)
work_path.write_text(work)

# Mobile work-order PM backlog deep link.
mobile_path = Path("src/screens/Equipment/MobileEquipmentWorkOrders.tsx")
mobile = mobile_path.read_text()
mobile = replace_once(
    mobile,
    'import { useNavigate, useParams } from "react-router-dom";',
    'import { useNavigate, useParams, useSearchParams } from "react-router-dom";',
    "mobile router import",
)
mobile = replace_once(
    mobile,
    'type MobileFilter = "ALL" | "OVERDUE" | "WAITING PARTS" | "UNASSIGNED";',
    'type MobileFilter = "ALL" | "OVERDUE" | "WAITING PARTS" | "UNASSIGNED" | "PREVENTIVE";',
    "mobile filter type",
)
mobile = replace_once(
    mobile,
    '''  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;''',
    '''  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams] = useSearchParams();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const requestedBacklogView = searchParams.get("view")?.trim() ?? "";''',
    "mobile query",
)
load_effect = '''  useEffect(() => {
    void load();
  }, [load]);
'''
mobile = insert_after(
    mobile,
    load_effect,
    '''
  useEffect(() => {
    if (requestedBacklogView !== "pm-backlog") return;
    setView("OPEN");
    setFilter("PREVENTIVE");
    setSearch("");
    requestAnimationFrame(() => {
      document
        .getElementById("work-order-register")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [openOrders.length, requestedBacklogView]);
''',
    "mobile PM effect",
)
mobile = replace_once(
    mobile,
    '''        (filter === "WAITING PARTS" && order.status.toUpperCase().includes("WAITING")) ||
        (filter === "UNASSIGNED" && (!order.engineer || order.engineer === "—"));''',
    '''        (filter === "WAITING PARTS" && order.status.toUpperCase().includes("WAITING")) ||
        (filter === "UNASSIGNED" && (!order.engineer || order.engineer === "—")) ||
        (filter === "PREVENTIVE" && order.type.toLowerCase().includes("prevent"));''',
    "mobile PM matching",
)
mobile = replace_once(
    mobile,
    '''            ["WAITING PARTS", "Waiting parts"],
            ["UNASSIGNED", "Unassigned"],''',
    '''            ["WAITING PARTS", "Waiting parts"],
            ["UNASSIGNED", "Unassigned"],
            ["PREVENTIVE", "PM backlog"],''',
    "mobile filter button",
)
mobile = replace_once(
    mobile,
    '      <div className="flex items-center justify-between gap-3">\n        <div>',
    '      <div id="work-order-register" className="scroll-mt-28 flex items-center justify-between gap-3">\n        <div>',
    "mobile register target",
)
mobile_path.write_text(mobile)

# Calibration exact-record and backlog routing.
pms_path = Path("src/screens/Equipment/EquipmentPMs.tsx")
pms = pms_path.read_text()
pms = replace_once(
    pms,
    'import { useNavigate, useParams } from "react-router-dom";',
    'import { useNavigate, useParams, useSearchParams } from "react-router-dom";',
    "PM router import",
)
pms = replace_once(
    pms,
    '''  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;''',
    '''  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams] = useSearchParams();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const requestedRecord = searchParams.get("record")?.trim() ?? "";
  const requestedView = searchParams.get("view")?.trim() ?? "";''',
    "calibration query",
)
pms_load = '''  useEffect(() => {
    void loadCalibrationIntelligence();
  }, [loadCalibrationIntelligence]);
'''
pms = insert_after(
    pms,
    pms_load,
    '''
  useEffect(() => {
    if (!requestedRecord && requestedView !== "backlog") return;
    if (requestedRecord) {
      setFilter("ALL");
      setSearch(requestedRecord);
    } else {
      setFilter("ATTENTION");
      setSearch("");
    }
    requestAnimationFrame(() => {
      document
        .getElementById("calibration-register")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [calibrations.length, requestedRecord, requestedView]);
''',
    "calibration route effect",
)
pms_path.write_text(pms)

# Spares exact-record and stockout routing.
spares_path = Path("src/screens/Equipment/EquipmentSpares.tsx")
spares = spares_path.read_text()
spares = replace_once(
    spares,
    'import { useNavigate, useParams } from "react-router-dom";',
    'import { useNavigate, useParams, useSearchParams } from "react-router-dom";',
    "spares router import",
)
spares = replace_once(
    spares,
    '''  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;''',
    '''  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const [searchParams] = useSearchParams();
  const resolvedId = equipmentId ?? DEFAULT_EQUIPMENT_ID;
  const requestedRecord = searchParams.get("record")?.trim() ?? "";
  const requestedView = searchParams.get("view")?.trim() ?? "";''',
    "spares query",
)
spares_load = '''  useEffect(() => {
    void loadSparesIntelligence();
  }, [loadSparesIntelligence]);
'''
spares = insert_after(
    spares,
    spares_load,
    '''
  useEffect(() => {
    if (!requestedRecord && requestedView !== "out-of-stock") return;
    if (requestedRecord) {
      setStatusFilter("all");
      setSearch(requestedRecord);
    } else {
      setStatusFilter("out");
      setSearch("");
    }
    requestAnimationFrame(() => {
      document
        .getElementById("spares-register")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hasLoaded, requestedRecord, requestedView]);
''',
    "spares route effect",
)
spares = replace_once(
    spares,
    '''          <Card className="rounded-2xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="p-5">
              <SectionHeading
                eyebrow="BOM and inventory intelligence"''',
    '''          <Card
            id="spares-register"
            className="scroll-mt-48 rounded-2xl border border-gray-800 bg-[#141820] shadow-none"
          >
            <CardContent className="p-5">
              <SectionHeading
                eyebrow="BOM and inventory intelligence"''',
    "spares register target",
)
spares_path.write_text(spares)

# Live pilot work-order route.
live_work_path = Path("src/screens/Equipment/LiveEquipmentWorkOrdersPilotView.tsx")
live_work = live_work_path.read_text()
live_work = replace_once(
    live_work,
    'import { useCallback, useMemo, useState } from "react";',
    'import { useCallback, useMemo, useState } from "react";\nimport { useSearchParams } from "react-router-dom";',
    "live work router import",
)
live_work = replace_once(
    live_work,
    '''export function LiveEquipmentWorkOrdersPilotView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const workLoader''',
    '''export function LiveEquipmentWorkOrdersPilotView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const [searchParams] = useSearchParams();
  const requestedBacklogView = searchParams.get("view")?.trim() ?? "";
  const workLoader''',
    "live work query",
)
live_work = replace_once(
    live_work,
    '''  const openRows = rows.filter((item) => !isLiveWorkItemCompleted(item));
  const completedRows = rows.filter(isLiveWorkItemCompleted);''',
    '''  const openRows = rows.filter((item) => !isLiveWorkItemCompleted(item));
  const visibleRows = requestedBacklogView === "pm-backlog"
    ? openRows.filter((item) => /prevent|\\bpm\\b/i.test(item.workType))
    : rows;
  const completedRows = rows.filter(isLiveWorkItemCompleted);''',
    "live PM rows",
)
live_work = replace_once(
    live_work,
    'work.state?.status === "ready" && rows.length === 0',
    'work.state?.status === "ready" && visibleRows.length === 0',
    "live empty state",
)
live_work = replace_once(
    live_work,
    "          {rows.map((item: LiveWorkItem) => {",
    "          {visibleRows.map((item: LiveWorkItem) => {",
    "live work map",
)
live_work_path.write_text(live_work)

# Live calibration and spares route context.
live_views_path = Path("src/screens/Equipment/EquipmentLiveEvidenceViews.tsx")
live_views = live_views_path.read_text()
live_views = replace_once(
    live_views,
    'import { useCallback, useMemo, useState } from "react";',
    'import { useCallback, useMemo, useState } from "react";\nimport { useSearchParams } from "react-router-dom";',
    "live views router import",
)
live_views = replace_once(
    live_views,
    '''export function LiveEquipmentSparesView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loader''',
    '''export function LiveEquipmentSparesView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const [searchParams] = useSearchParams();
  const requestedRecord = searchParams.get("record")?.trim().toLowerCase() ?? "";
  const requestedView = searchParams.get("view")?.trim() ?? "";
  const loader''',
    "live spares query",
)
live_views = replace_once(
    live_views,
    '''  const payload = state?.status === "ready" ? state.data : null;
  return (''',
    '''  const payload = state?.status === "ready" ? state.data : null;
  const visibleInventory = payload?.inventory.filter((part) => {
    if (requestedRecord) {
      return [part.partNumber, part.name].some((value) =>
        value.toLowerCase().includes(requestedRecord),
      );
    }
    return requestedView === "out-of-stock"
      ? part.derivedStatus === "Out of stock"
      : true;
  }) ?? [];
  return (''',
    "live inventory filter",
)
live_views = replace_once(
    live_views,
    "                {payload.inventory.map((part) => (",
    "                {visibleInventory.map((part) => (",
    "live inventory map",
)
live_views = replace_once(
    live_views,
    '''export function LiveEquipmentCalibrationsView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const loader''',
    '''export function LiveEquipmentCalibrationsView({ record }: { record: LiveEquipmentRecord }): JSX.Element {
  const [searchParams] = useSearchParams();
  const requestedRecord = searchParams.get("record")?.trim().toLowerCase() ?? "";
  const requestedView = searchParams.get("view")?.trim() ?? "";
  const loader''',
    "live calibration query",
)
live_views = replace_once(
    live_views,
    '''  const rows = state?.status === "ready" ? state.data : [];
  const overdue = rows.filter((item) => /overdue|critical/i.test(item.riskState ?? item.scheduleStatus));
  return (''',
    '''  const rows = state?.status === "ready" ? state.data : [];
  const overdue = rows.filter((item) => /overdue|critical/i.test(item.riskState ?? item.scheduleStatus));
  const visibleRows = rows.filter((item) => {
    if (requestedRecord) {
      return [item.number, item.title, item.id].some((value) =>
        value.toLowerCase().includes(requestedRecord),
      );
    }
    return requestedView === "backlog"
      ? /overdue|critical|due soon/i.test(item.riskState ?? item.scheduleStatus)
      : true;
  });
  return (''',
    "live calibration filter",
)
live_views = replace_once(
    live_views,
    "{rows.map((item: LiveCalibration) =>",
    "{visibleRows.map((item: LiveCalibration) =>",
    "live calibration map",
)
live_views_path.write_text(live_views)

# Focused contract and suite registration.
contract_path = Path("scripts/vor-004-dashboard-deep-links-contract.mjs")
contract_path.write_text('''import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];
const check = (label, condition) => {
  if (condition) console.log(`✓ ${label}`);
  else failures.push(label);
};

const routing = read("src/screens/AiOperations/riskActionRouting.ts");
const dashboard = read("src/screens/AiOperations/sections/DashboardOverviewSection/DashboardOverviewSection.tsx");
const workOrders = read("src/screens/Equipment/EquipmentWorkOrders.tsx");
const mobileWorkOrders = read("src/screens/Equipment/MobileEquipmentWorkOrders.tsx");
const calibrations = read("src/screens/Equipment/EquipmentPMs.tsx");
const spares = read("src/screens/Equipment/EquipmentSpares.tsx");
const liveWork = read("src/screens/Equipment/LiveEquipmentWorkOrdersPilotView.tsx");
const liveViews = read("src/screens/Equipment/EquipmentLiveEvidenceViews.tsx");

check("exact calibration and spare references are retained", routing.includes('params.set("record", calibrationReference)') && routing.includes('params.set("record", spareReference)'));
check("all three backlog summaries are accessible buttons", ["pm", "calibrations", "spares"].every((value) => dashboard.includes(`data-vorta-dashboard-backlog-card="${value}"`)));
check("desktop and mobile PM backlog use preventive filtering", workOrders.includes('requestedBacklogView !== "pm-backlog"') && mobileWorkOrders.includes('setFilter("PREVENTIVE")'));
check("calibration route supports exact and backlog context", calibrations.includes('requestedRecord') && calibrations.includes('setFilter("ATTENTION")'));
check("spares route supports exact and stockout context", spares.includes('setStatusFilter("out")') && spares.includes('id="spares-register"'));
check("live pilot routes honour the same URL contract", liveWork.includes('visibleRows') && liveViews.includes('visibleInventory') && liveViews.includes('requestedView === "backlog"'));

if (failures.length) {
  console.error("VOR-004 contract failures:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("VOR-004 dashboard deep-link contracts passed.");
''')

suite_path = Path("scripts/run-contract-suite.mjs")
suite = suite_path.read_text()
suite = insert_after(
    suite,
    '  ["Maintenance dashboard", "scripts/maintenance-dashboard-contracts.mjs"],\n',
    '  ["Dashboard deep links", "scripts/vor-004-dashboard-deep-links-contract.mjs"],\n',
    "contract suite entry",
)
suite_path.write_text(suite)

# One-time files and prior diagnostics must not remain in the final branch.
for temporary in (
    Path("scripts/one_time_vor_004_patch.py"),
    Path(".github/vor-004-patch-error.txt"),
):
    if temporary.exists():
        temporary.unlink()
