import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const route = read("src/screens/AiOperations/AiOperations.tsx");
const page = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");
const service = read("src/screens/ShiftHandover/shiftHandoverService.ts");
const edge = read("supabase/functions/shift-handover-data/index.ts");
const transform = read("supabase/functions/shift-handover-data/transform.ts");
const surfaces = read("src/card-surfaces.css");

const assertions = [
  [route.includes('label: "Shift Handover"') && route.includes('path="shift-handover"'), "Shift Handover must be present in navigation and routing."],
  [page.includes('data-vorta-shift-handover="true"'), "The responsive Shift Handover workspace marker is missing."],
  [page.includes("Site") && page.includes("Building") && page.includes("Area"), "Site, building and area scope controls are required."],
  [page.includes("Mechanical") && page.includes("Electrical") && page.includes("Controls") && page.includes("Facilities"), "Discipline selectors are required."],
  [page.includes("Longest breakdown") && page.includes("Criticality") && page.includes("Status"), "Criticality, status and longest-breakdown filtering are required."],
  [page.includes("sparesUsed") && page.includes("outstandingMaterials") && page.includes("confirmedWorkHours"), "Work-order, confirmation and material detail must remain visible."],
  [/\[data-vorta-shift-handover="true"\]\s*>\s*header\s*\{\s*display:\s*none\s*!important;\s*\}/m.test(surfaces), "Shift Handover must start with the operational summary cards on every viewport."],
  [service.includes('supabase.functions.invoke("shift-handover-data"'), "The page must use the authenticated Shift Handover data function."],
  [service.includes('dataMode === "demo" ? "latest" : "previous"'), "Live mode must use the previous shift while demo mode may use latest imported evidence."],
  [edge.includes('from("work_order_confirmations")'), "The Edge Function must be driven by work-order confirmations."],
  [edge.includes('from("work_order_goods_movements")') && edge.includes('from("work_order_material_reservations")'), "The Edge Function must include SAP material evidence."],
  [transform.includes('waiting_on_parts') && transform.includes('external_contractor') && transform.includes('temporarily_restored'), "Normalised handover statuses are incomplete."],
  [!page.includes("insert(") && !page.includes("update(") && !page.includes("delete("), "The first Shift Handover release must remain read-only."],
];

const failures = assertions.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log("✓ Shift Handover route, SAP evidence, cards-first layout and responsive controls verified.");
