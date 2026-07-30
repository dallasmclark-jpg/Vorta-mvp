import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const route = read("src/screens/AiOperations/AiOperations.tsx");
const page = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");
const service = read("src/screens/ShiftHandover/shiftHandoverService.ts");
const workflow = read("src/screens/ShiftHandover/shiftHandoverWorkflowService.ts");
const edge = read("supabase/functions/shift-handover-data/index.ts");
const transform = read("supabase/functions/shift-handover-data/transform.ts");
const surfaces = read("src/card-surfaces.css");
const browser = read("tests/browser/maintenance-manager-shift-handover.spec.ts");

const reviewOptions = [
  "Last 12 hours",
  "Last 24 hours",
  "Last 36 hours",
  "Last 48 hours",
  "Last 4 days",
];

const assertions = [
  [route.includes('label: "Shift Handover"') && route.includes('path="shift-handover"'), "Shift Handover must be present in navigation and routing."],
  [page.includes('data-vorta-shift-handover="true"'), "The responsive Shift Handover workspace marker is missing."],
  [page.includes("Site") && page.includes("Building") && page.includes("Area"), "Site, building and area scope controls are required."],
  [page.includes("Mechanical") && page.includes("Electrical") && page.includes("Controls") && page.includes("Facilities"), "Discipline selectors are required."],
  [page.includes("Longest breakdown") && page.includes("Criticality") && page.includes("Status"), "Criticality, status and longest-breakdown filtering are required."],
  [page.includes("sparesUsed") && page.includes("outstandingMaterials") && page.includes("confirmedWorkHours"), "Work-order, confirmation and material detail must remain visible."],
  [/\[data-vorta-shift-handover="true"\]\s*>\s*header\s*\{\s*display:\s*none\s*!important;\s*\}/m.test(surfaces), "Shift Handover must start with the operational summary cards on every viewport."],
  [page.includes('data-vorta-shift-handover-review-period="true"') && page.includes("Review period"), "One shared Review period control is required."],
  [reviewOptions.every((option) => page.includes(option)), "All approved review-period labels must be available."],
  [page.includes("activeAdvancedFilterCount") && page.includes("Filters{activeAdvancedFilterCount"), "Mobile advanced filters must expose the active Criticality and Status count."],
  [page.includes('id="shift-handover-advanced-filters"') && page.includes("lg:contents"), "Criticality, Status and Sort must collapse on mobile without duplicating wider-layout logic."],
  [page.includes("scopeOptionsRef") && page.includes("scopeOptionsCanScrollRight") && page.includes('data-vorta-shift-handover-scope-fade="true"'), "Long scope names need selected-item scrolling and an overflow cue."],
  [page.includes("formatSummaryDowntime") && page.includes('return "0 hrs"') && page.includes('totalBreakdownMinutes > 0 ? "text-orange-300" : "text-slate-50"'), "Zero downtime must render neutrally as 0 hrs while positive downtime retains warning emphasis."],
  [page.includes("reviewPeriodLoadingState") && page.includes("No work orders match the selected filters."), "Period-aware loading and filter-aware empty states are required."],
  [browser.includes('toHaveValue("12")'), "The responsive browser contract must verify Last 12 hours as the default."],
  [page.includes("useSearchParams") && page.includes("vorta.shift-handover.review-period"), "Review period must persist through URL and session state."],
  [page.includes("summariseItems(filteredItems)"), "Summary cards must be derived from the displayed filtered activity."],
  [page.includes("data-vorta-shift-handover-date-group") && page.includes("activityDateLabel"), "Longer review periods must group activity by site-local date."],
  [page.includes("Previous shift activity for Last 12 hours") && page.includes("Activity from the last 4 days"), "Activity headings must describe the selected period."],
  [service.includes("ShiftHandoverReviewHours") && service.includes("reviewHours"), "The service contract must carry the selected review period."],
  [service.includes('dataMode === "demo" ? "latest" : "previous"'), "Live mode must use the previous completed shift anchor while demo mode may use latest imported evidence."],
  [service.includes("handoverWindowStart") && service.includes("handoverWindowEnd"), "Each item must retain its source 12-hour handover window for workflow writes."],
  [workflow.includes("p_window_start") && workflow.includes("p_window_end"), "Controlled workflow actions must remain bound to explicit handover windows."],
  [edge.includes("new Set<number>([12, 24, 36, 48, 96])"), "The Edge Function must allow only the approved review periods."],
  [edge.includes("addLocalHours(endParts, -reviewHours)") && edge.includes("site.timezone"), "Review windows must be calculated in the site timezone."],
  [edge.includes('.from("work_order_confirmations")') && edge.includes(".range(offset, offset + PAGE_SIZE - 1)"), "Confirmation evidence must be paginated for complete longer-period results."],
  [!edge.includes("slice(0, limit)") && !edge.includes("limit * 5"), "Review-period evidence must not be silently truncated by the old fixed limit."],
  [edge.includes('.from("work_order_goods_movements")') && edge.includes('.from("work_order_material_reservations")'), "The Edge Function must include SAP material evidence."],
  [transform.includes("waiting_on_parts") && transform.includes("external_contractor") && transform.includes("temporarily_restored"), "Normalised handover statuses are incomplete."],
  [browser.includes('getByLabel("Review period")') && browser.includes("review=24") && browser.includes("data-vorta-portal-scroll-container"), "Responsive browser coverage must validate period selection and scroll preservation."],
  [browser.includes("Filters · 2") && browser.includes('data-vorta-shift-handover-scope-options="true"') && browser.includes('breakdownText === "0 hrs"'), "Responsive browser coverage must verify mobile filter count, scope overflow and neutral zero downtime."],
  [!page.includes("insert(") && !page.includes("delete("), "Shift Handover SAP evidence must remain read-only."],
];

const failures = assertions.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log("✓ Shift Handover review periods, compact mobile filters, neutral downtime and responsive state verified.");
