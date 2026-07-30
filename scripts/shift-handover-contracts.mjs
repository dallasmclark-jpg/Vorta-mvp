import { readFileSync } from "node:fs";
import { transform as transpile } from "esbuild";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const route = read("src/screens/AiOperations/AiOperations.tsx");
const page = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");
const vortaSelect = read("src/components/VortaSelect.tsx");
const service = read("src/screens/ShiftHandover/shiftHandoverService.ts");
const workflow = read("src/screens/ShiftHandover/shiftHandoverWorkflowService.ts");
const edge = read("supabase/functions/shift-handover-data/index.ts");
const transform = read("supabase/functions/shift-handover-data/transform.ts");
const shiftWindows = read("supabase/functions/shift-handover-data/shiftWindows.ts");
const shiftPresentation = read("src/lib/shiftPresentation.ts");
const surfaces = read("src/card-surfaces.css");
const browser = read("tests/browser/maintenance-manager-shift-handover.spec.ts");


const compiledTransform = await transpile(transform, {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const transformModule = await import(
  `data:text/javascript;base64,${Buffer.from(compiledTransform.code).toString("base64")}`
);
const buildPayload = transformModule.buildShiftHandoverPayload;
const compiledShiftWindows = await transpile(shiftWindows, {
  loader: "ts",
  format: "esm",
  target: "es2022",
});
const shiftWindowModule = await import(
  `data:text/javascript;base64,${Buffer.from(compiledShiftWindows.code).toString("base64")}`
);
const reviewWindow = shiftWindowModule.reviewWindow;
const baseOrder = (id, overrides = {}) => ({
  id,
  wo_number: `WO-${id}`,
  description: `Work order ${id}`,
  work_type: "PM01",
  priority: "2",
  status: "REL",
  system_status_codes: ["REL"],
  user_status_codes: [],
  equipment_id: "eq-1",
  assigned_engineer: "Engineer One",
  main_work_center: "MECH",
  updated_at: "2026-07-30T08:00:00Z",
  ...overrides,
});
const confirmation = (id, workOrderId, overrides = {}) => ({
  id,
  work_order_id: workOrderId,
  confirmation_timestamp: "2026-07-30T09:00:00Z",
  confirmation_text: "Inspection completed. The order remains open for planned execution.",
  confirmed_by: "Engineer With A Deliberately Long Name",
  work_center: "MECH",
  actual_work: 0.25,
  work_unit: "HR",
  final_confirmation: false,
  reversal: false,
  ...overrides,
});
const longNote = "Long confirmation note ".repeat(40).trim();
const fixturePayload = buildPayload({
  site: { id: "site-1", name: "Test Site", timezone: "Europe/London" },
  window: {
    start: "2026-07-29T18:00:00Z",
    end: "2026-07-30T10:00:00Z",
    label: "Test window",
    mode: "latest",
  },
  workOrders: [
    baseOrder("partial"),
    baseOrder("final"),
    baseOrder("teco", { system_status_codes: ["REL", "TECO"] }),
    baseOrder("waiting"),
    baseOrder("none"),
    baseOrder("multiple"),
  ],
  confirmations: [
    confirmation("c-partial", "partial"),
    confirmation("c-final", "final", {
      confirmation_text: "Work completed and returned to service.",
      final_confirmation: true,
    }),
    confirmation("c-waiting", "waiting", {
      confirmation_text: "Partial work completed; replacement seal is still required.",
    }),
    confirmation("c-multiple-new", "multiple", {
      confirmation_timestamp: "2026-07-30T09:30:00Z",
      confirmation_text: longNote,
    }),
    confirmation("c-multiple-old", "multiple", {
      confirmation_timestamp: "2026-07-30T07:30:00Z",
      confirmation_text: "Earlier inspection note.",
    }),
  ],
  equipment: [{
    id: "eq-1",
    name: "Equipment With A Deliberately Long Operational Name",
    equipment_code: "EQ-001",
    area: "Fill Finish",
    line: "Line One",
    criticality: "high",
  }],
  departments: [],
  movements: [],
  reservations: [{
    id: "r-waiting",
    work_order_id: "waiting",
    material_number: "MAT-001",
    required_quantity: 1,
    withdrawn_quantity: 0,
    final_issue: false,
    base_unit: "EA",
    reservation_status: "Open",
  }],
});
const fixtureById = new Map(fixturePayload.items.map((item) => [item.id, item]));
const statusFixtureChecks = [
  [fixtureById.get("partial")?.status === "ongoing", "Generic words such as completed in a partial confirmation must not complete an open work order."],
  [fixtureById.get("final")?.status === "completed", "A genuine final confirmation must complete the work order."],
  [fixtureById.get("teco")?.status === "completed", "An explicit TECO closure code must complete the work order."],
  [fixtureById.get("waiting")?.status === "waiting_on_parts", "Outstanding material evidence must retain Waiting on parts precedence."],
  [fixtureById.get("none")?.status === "ongoing", "An open work order with no confirmations must remain ongoing."],
  [fixtureById.get("multiple")?.confirmations.length === 2 && fixtureById.get("multiple")?.confirmations[0]?.text === longNote, "Multiple confirmations and long notes must remain complete and newest-first."],
  [fixturePayload.summary.completed === 2, "Completed summary count must include only genuinely completed records."],
  [fixturePayload.summary.ongoing === 3, "Ongoing summary count must include only normalised ongoing records."],
  [fixturePayload.summary.waitingOnParts === 1, "Waiting-parts summary count must match the normalised activity status."],
];

const reviewOptions = [
  "Previous shift · 12 hours",
  "Previous 2 shifts · 24 hours",
  "Previous 3 shifts · 36 hours",
  "Previous 4 shifts · 48 hours",
  "Previous 8 shifts · 4 days",
];

const london = "Europe/London";
const beforeSix = reviewWindow(new Date("2026-07-30T04:59:00Z"), london, "previous", 12);
const afterSix = reviewWindow(new Date("2026-07-30T05:01:00Z"), london, "previous", 12);
const beforeEighteen = reviewWindow(new Date("2026-07-30T16:59:00Z"), london, "previous", 12);
const afterEighteen = reviewWindow(new Date("2026-07-30T17:01:00Z"), london, "previous", 12);
const daytimeSequence = reviewWindow(new Date("2026-07-30T11:00:00Z"), london, "previous", 48);
const nightSequence = reviewWindow(new Date("2026-07-30T19:00:00Z"), london, "previous", 36);
const londonMismatch = reviewWindow(new Date("2026-07-30T05:30:00Z"), london, "previous", 12);
const newYorkMismatch = reviewWindow(new Date("2026-07-30T05:30:00Z"), "America/New_York", "previous", 12);
const boundaryChecks = [
  [beforeSix.shifts[0]?.type === "day", "Immediately before 06:00 local, the last completed shift must be Day."],
  [afterSix.shifts[0]?.type === "night", "Immediately after 06:00 local, the last completed shift must be Night."],
  [beforeEighteen.shifts[0]?.type === "night", "Immediately before 18:00 local, the last completed shift must remain Night."],
  [afterEighteen.shifts[0]?.type === "day", "Immediately after 18:00 local, the last completed shift must be Day."],
  [daytimeSequence.shifts.map((shift) => shift.label).join(" · ") === "Day · Night · Day · Night", "Four completed shifts must be chronological oldest-to-newest during the day shift."],
  [nightSequence.shifts.map((shift) => shift.label).join(" · ") === "Day · Night · Day", "Three completed shifts must dynamically alternate when the current shift is Night."],
  [daytimeSequence.start === daytimeSequence.shifts[0]?.start && daytimeSequence.end === daytimeSequence.shifts.at(-1)?.end, "The evidence range must use the first and last completed shift boundaries."],
  [new Date(daytimeSequence.start).getUTCDate() !== new Date(daytimeSequence.end).getUTCDate(), "Longer shift periods must cross calendar dates without losing boundaries."],
  [londonMismatch.shifts[0]?.type !== newYorkMismatch.shifts[0]?.type, "Shift boundaries must use the site timezone rather than the browser timezone."],
];

const assertions = [
  [route.includes('label: "Shift Handover"') && route.includes('path="shift-handover"'), "Shift Handover must be present in navigation and routing."],
  [page.includes('data-vorta-shift-handover="true"'), "The responsive Shift Handover workspace marker is missing."],
  [page.includes('data-vorta-shift-handover-scope-tabs="true"') && page.includes("scopeAreas.map") && page.includes("snapshot?.items"), "Scope must be one Site-plus-relevant-areas rail derived from the selected review-period jobs."],
  [!page.includes("type ScopeMode") && !page.includes("setScopeMode") && !page.includes('aria-label="Maintenance discipline"') && !page.includes("setDiscipline"), "Building hierarchy and Discipline list filtering must be removed."],
  [page.includes("Longest breakdown") && page.includes("Criticality") && page.includes("Status"), "Criticality, status and longest-breakdown filtering are required."],
  [page.includes("sparesUsed") && page.includes("outstandingMaterials") && page.includes("confirmedWorkHours"), "Work-order, confirmation and material detail must remain visible."],
  [/\[data-vorta-shift-handover="true"\]\s*>\s*header\s*\{\s*display:\s*none\s*!important;\s*\}/m.test(surfaces), "Shift Handover must start with the operational summary cards on every viewport."],
  [page.includes('data-vorta-shift-handover-review-period="true"') && page.includes("<VortaSelect") && page.includes('label="Review period"'), "One shared Vorta Review period control is required."],
  [!page.includes("<select") && (page.match(/<VortaSelect/g) ?? []).length === 4, "Shift Handover must not invoke native browser select dialogs."],
  [vortaSelect.includes('role="listbox"') && vortaSelect.includes('role="option"') && vortaSelect.includes('data-vorta-select-listbox="true"'), "The shared Vorta selector must render a styled accessible listbox."],
  [vortaSelect.includes("ArrowDown") && vortaSelect.includes("ArrowUp") && vortaSelect.includes("Home") && vortaSelect.includes("End") && vortaSelect.includes("Escape"), "The Vorta selector must retain keyboard navigation and dismissal."],
  [vortaSelect.includes("createPortal") && vortaSelect.includes("visualViewport") && vortaSelect.includes('data-vorta-select-placement') && vortaSelect.includes('data-vorta-select-backdrop'), "Vorta selectors must use viewport-aware portalled placement above floating controls."],
  [vortaSelect.includes('min-h-[38px]') && vortaSelect.includes('min-h-[48px]') && vortaSelect.includes('sm:min-h-11') && vortaSelect.includes('data-vorta-select-compact'), "Mobile selector options must remain compact while supporting shift sequences."],
  [vortaSelect.includes('data-vorta-select-supporting-items="true"') && vortaSelect.includes('aria-describedby') && vortaSelect.includes("Included shifts:"), "Shift sequences must be visible and available to assistive technology."],
  [vortaSelect.includes("data-vortaSelectOpen") || vortaSelect.includes("vortaSelectOpen"), "Open selectors must expose a global stacking state."],
  [reviewOptions.every((option) => page.includes(option)), "All approved review-period labels must be available."],
  [page.includes("activeAdvancedFilterCount") && page.includes("Filters{activeAdvancedFilterCount"), "Mobile advanced filters must expose the active Criticality and Status count."],
  [page.includes("hasActiveAdvancedFilters") && page.includes("clearAdvancedFilters") && page.includes('data-vorta-shift-handover-clear-filters="true"') && page.includes('setSortMode("recent")'), "Mobile advanced filters need a selective Clear filters action with Most recent as the default sort."],
  [page.includes('id="shift-handover-advanced-filters"') && page.includes("lg:contents"), "Criticality, Status and Sort must collapse on mobile without duplicating wider-layout logic."],
  [page.includes('data-vorta-shift-handover-status-disclosure="true"') && page.includes("How handover statuses are calculated") && page.includes("statusInfoOpen"), "SAP status guidance must be retained in a closed-by-default disclosure."],
  [page.includes("scopeOptionsRef") && page.includes("scopeOptionsCanScrollRight") && page.includes('data-vorta-shift-handover-scope-fade="true"'), "The shared area rail needs selected-item scrolling and an overflow cue."],
  [(page.match(/<MetricCard/g) ?? []).length === 4 && !page.includes('<MetricCard label="Contractor"') && !page.includes('label="Breakdown"'), "Only the four approved operational summary cards may render."],
  [page.includes("reviewPeriodLoadingState") && page.includes("No work orders match the selected filters."), "Period-aware loading and filter-aware empty states are required."],
  [browser.includes('toHaveAttribute("data-value", "12")') && browser.includes("Review period options"), "The responsive browser contract must verify the styled Last 12 hours selector as the default."],
  [page.includes("useSearchParams") && page.includes("vorta.shift-handover.review-period"), "Review period must persist through URL and session state."],
  [page.includes("summariseItems(filteredItems)"), "Summary cards must be derived from the displayed filtered activity."],
  [page.includes("data-vorta-shift-handover-date-group") && page.includes("activityDateLabel"), "Longer review periods must group activity by site-local date."],
  [page.includes('return "Previous shift: Previous shift activity"') && page.includes("Activity from the previous ${count} shifts"), "Activity headings must use completed-shift terminology."],
  [service.includes("ShiftHandoverReviewHours") && service.includes("reviewHours"), "The service contract must carry the selected review period."],
  [service.includes('dataMode === "demo" ? "latest" : "previous"'), "Live mode must use the previous completed shift anchor while demo mode may use latest imported evidence."],
  [service.includes("handoverWindowStart") && service.includes("handoverWindowEnd"), "Each item must retain its source 12-hour handover window for workflow writes."],
  [workflow.includes("p_window_start") && workflow.includes("p_window_end"), "Controlled workflow actions must remain bound to explicit handover windows."],
  [shiftWindows.includes("new Set<number>([12, 24, 36, 48, 96])"), "The completed-shift module must allow only the approved review periods."],
  [edge.includes("buildReviewPeriods(anchor, timeZone, windowMode)") && edge.includes("site.timezone") && shiftWindows.includes("previousCompletedShift") && shiftWindows.includes("shiftContaining"), "Review windows must be assembled from completed site-timezone shift boundaries."],
  [service.includes("reviewPeriods") && service.includes("ShiftHandoverReviewShift"), "The client contract must retain the authoritative shift sequence."],
  [shiftPresentation.includes('bg-yellow-400') && shiftPresentation.includes('bg-blue-400') && shiftPresentation.includes("colour alone"), "Shift Handover must reuse the established yellow Day and blue Night rota palette with text labels."],
  [edge.includes('.from("work_order_confirmations")') && edge.includes(".range(offset, offset + PAGE_SIZE - 1)"), "Confirmation evidence must be paginated for complete longer-period results."],
  [!edge.includes("slice(0, limit)") && !edge.includes("limit * 5"), "Review-period evidence must not be silently truncated by the old fixed limit."],
  [edge.includes('.from("work_order_goods_movements")') && edge.includes('.from("work_order_material_reservations")'), "The Edge Function must include SAP material evidence."],
  [transform.includes("waiting_on_parts") && transform.includes("external_contractor") && transform.includes("temporarily_restored"), "Normalised handover statuses are incomplete."],
  [transform.includes("hasFinalCompletionEvidence") && transform.includes("hasExplicitClosureCode"), "Completion must be derived from explicit SAP closure evidence rather than generic confirmation prose."],
  [page.includes("data-vorta-shift-handover-card-status") && page.includes("data-vorta-shift-handover-detail-status"), "List and detail statuses need a shared normalised-state contract."],
  [page.includes("latestConfirmationSummary") && page.includes("data-vorta-shift-handover-confirmation-summary"), "Latest confirmation wording must be state-aware."],
  [page.includes("data-vorta-shift-handover-confirmation-history-item") && page.includes("whitespace-pre-wrap") && page.includes("[overflow-wrap:anywhere]"), "Confirmation history must expand and wrap without clipping or overlap."],
  [page.includes("data-vorta-shift-handover-functional-location") && page.includes(">Equipment</dt>"), "The neutral location hierarchy must include functional location and equipment."],
  ...statusFixtureChecks,
  ...boundaryChecks,
  [browser.includes('getByRole("button", { name: "Review period", exact: true })') && browser.includes("review=24") && browser.includes("data-vorta-portal-scroll-container"), "Responsive browser coverage must validate period selection and scroll preservation."],
  [browser.includes("Filters · 2") && browser.includes("Clear filters") && browser.includes('data-vorta-shift-handover-scope-tabs="true"') && browser.includes('data-vorta-shift-handover-metric="contractor"'), "Responsive browser coverage must verify mobile filter count, selective clearing, the area rail and retired summary cards."],
  [browser.includes('data-vorta-select-placement') && browser.includes("visualViewport") && browser.includes('data-vorta-shared-mobile-ai-launcher="true"'), "Browser coverage must verify visual-viewport placement and Ask Vorta stacking."],
  [surfaces.includes('html[data-vorta-select-open="true"]') && surfaces.includes('data-vorta-shared-mobile-ai-launcher="true"'), "Open dropdowns must suppress the shared floating Ask Vorta launcher."],
  [!page.includes("insert(") && !page.includes("delete("), "Shift Handover SAP evidence must remain read-only."],
];

const failures = assertions.filter(([passed]) => !passed).map(([, message]) => message);
if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log("✓ Shift Handover completed-shift periods, compact viewport-safe dropdowns, filters, disclosures, review periods and status truth verified.");
