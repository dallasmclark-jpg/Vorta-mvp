import { readFileSync } from "node:fs";
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
