from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


page_path = Path("src/screens/ShiftHandover/ShiftHandoverSection.tsx")
page = page_path.read_text()

import_anchor = '''import {
  DetailDrawer,
  DrawerCloseButton,
} from "../../components/DetailDrawer";
'''
page = replace_once(
    page,
    import_anchor,
    import_anchor + 'import { VortaSelect } from "../../components/VortaSelect";\n',
    "VortaSelect import",
)

options_anchor = '''const REVIEW_PERIOD_OPTIONS: Array<{
  value: ShiftHandoverReviewHours;
  label: string;
}> = [
  { value: 12, label: "Last 12 hours" },
  { value: 24, label: "Last 24 hours" },
  { value: 36, label: "Last 36 hours" },
  { value: 48, label: "Last 48 hours" },
  { value: 96, label: "Last 4 days" },
];
'''
options_addition = '''
const CRITICALITY_OPTIONS: Array<{ value: CriticalityFilter; label: string }> = [
  { value: "all", label: "All criticalities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active / ongoing" },
  { value: "waiting", label: "Waiting / deferred" },
  { value: "contractor", label: "External contractor" },
  { value: "completed", label: "Completed" },
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "priority", label: "Criticality" },
  { value: "breakdown", label: "Longest breakdown" },
  { value: "recent", label: "Most recent" },
];
'''
page = replace_once(page, options_anchor, options_anchor + options_addition, "select options")

review_old = '''    <label className="grid w-full gap-1 text-xs font-medium text-slate-500 sm:max-w-xs">
      Review period
      <select
        value={reviewHours}
        onChange={(event) => changeReviewPeriod(event.target.value)}
        disabled={loading}
        className="min-h-11 w-full rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-semibold text-slate-200 outline-none focus:border-blue-500/60 disabled:opacity-60"
      >
        {REVIEW_PERIOD_OPTIONS.map((option) => (
<option key={option.value} value={option.value}>
  {option.label}
</option>
        ))}
      </select>
    </label>'''
review_new = '''    <VortaSelect
      label="Review period"
      value={reviewHours}
      options={REVIEW_PERIOD_OPTIONS}
      onChange={(nextValue) => changeReviewPeriod(String(nextValue))}
      disabled={loading}
      className="w-full sm:max-w-xs"
    />'''
page = replace_once(page, review_old, review_new, "review-period select")

criticality_old = '''      <label className="grid gap-1 text-xs text-slate-500">
        Criticality
        <select
          value={criticality}
          onChange={(event) => setCriticality(event.target.value as CriticalityFilter)}
          className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60"
        >
          <option value="all">All criticalities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>'''
criticality_new = '''      <VortaSelect
        label="Criticality"
        value={criticality}
        options={CRITICALITY_OPTIONS}
        onChange={setCriticality}
      />'''
page = replace_once(page, criticality_old, criticality_new, "criticality select")

status_old = '''      <label className="grid gap-1 text-xs text-slate-500">
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60"
        >
          <option value="all">All statuses</option>
          <option value="active">Active / ongoing</option>
          <option value="waiting">Waiting / deferred</option>
          <option value="contractor">External contractor</option>
          <option value="completed">Completed</option>
        </select>
      </label>'''
status_new = '''      <VortaSelect
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={setStatus}
      />'''
page = replace_once(page, status_old, status_new, "status select")

sort_old = '''      <label className="grid gap-1 text-xs text-slate-500">
        Sort by
        <select
          value={reviewHours > 12 ? "recent" : sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          disabled={reviewHours > 12}
          className="min-h-11 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-sm font-medium text-slate-200 outline-none focus:border-blue-500/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="priority">Criticality</option>
          <option value="breakdown">Longest breakdown</option>
          <option value="recent">Most recent</option>
        </select>
      </label>'''
sort_new = '''      <VortaSelect
        label="Sort by"
        value={reviewHours > 12 ? "recent" : sortMode}
        options={SORT_OPTIONS}
        onChange={setSortMode}
        disabled={reviewHours > 12}
      />'''
page = replace_once(page, sort_old, sort_new, "sort select")
page_path.write_text(page)

browser_path = Path("tests/browser/maintenance-manager-shift-handover.spec.ts")
browser = browser_path.read_text()
browser = replace_once(
    browser,
    'import { expect, test } from "@playwright/test";',
    'import { expect, test, type Page } from "@playwright/test";',
    "Playwright Page import",
)

helper_anchor = '''import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";
'''
helper = helper_anchor + '''
async function chooseVortaSelect(
  page: Page,
  label: string,
  optionLabel: string,
): Promise<void> {
  const trigger = page.getByRole("button", { name: label, exact: true });
  await trigger.click();
  const listbox = page.getByRole("listbox", { name: `${label} options` });
  await expect(listbox).toBeVisible();
  await listbox.getByRole("option", { name: optionLabel, exact: true }).click();
}
'''
browser = replace_once(browser, helper_anchor, helper, "browser helper")

initial_review_old = '''  const reviewPeriod = page.getByLabel("Review period");
  await expect(reviewPeriod).toBeVisible();
  await expect(reviewPeriod).toHaveValue("12");
  await expect(reviewPeriod.locator("option")).toHaveCount(5);'''
initial_review_new = '''  const reviewPeriod = page.getByRole("button", { name: "Review period", exact: true });
  await expect(reviewPeriod).toBeVisible();
  await expect(reviewPeriod).toHaveAttribute("data-value", "12");
  await reviewPeriod.click();
  const reviewListbox = page.getByRole("listbox", { name: "Review period options" });
  await expect(reviewListbox).toBeVisible();
  await expect(reviewListbox.getByRole("option")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(reviewListbox).toBeHidden();'''
browser = replace_once(browser, initial_review_old, initial_review_new, "initial review selector test")

browser = replace_once(
    browser,
    '  const criticalitySelect = page.getByLabel("Criticality");',
    '  const criticalitySelect = page.getByRole("button", { name: "Criticality", exact: true });',
    "criticality browser selector",
)
browser = replace_once(
    browser,
    '  const statusSelect = page.getByLabel("Status");',
    '  const statusSelect = page.getByRole("button", { name: "Status", exact: true });',
    "status browser selector",
)
browser = replace_once(
    browser,
    '  const sortSelect = page.getByLabel("Sort by");',
    '  const sortSelect = page.getByRole("button", { name: "Sort by", exact: true });',
    "sort browser selector",
)

for old, new in {
    'await reviewPeriod.selectOption("24");': 'await chooseVortaSelect(page, "Review period", "Last 24 hours");',
    'await reviewPeriod.selectOption("12");': 'await chooseVortaSelect(page, "Review period", "Last 12 hours");',
    'await sortSelect.selectOption("breakdown");': 'await chooseVortaSelect(page, "Sort by", "Longest breakdown");',
    'await criticalitySelect.selectOption("high");': 'await chooseVortaSelect(page, "Criticality", "High");',
    'await statusSelect.selectOption("completed");': 'await chooseVortaSelect(page, "Status", "Completed");',
    'await sortSelect.selectOption("priority");': 'await chooseVortaSelect(page, "Sort by", "Criticality");',
    'await criticalitySelect.selectOption("all");': 'await chooseVortaSelect(page, "Criticality", "All criticalities");',
    'await statusSelect.selectOption("all");': 'await chooseVortaSelect(page, "Status", "All statuses");',
    'await expect(reviewPeriod).toHaveValue("24");': 'await expect(reviewPeriod).toHaveAttribute("data-value", "24");',
}.items():
    if old not in browser:
        raise SystemExit(f"browser replacement missing: {old}")
    browser = browser.replace(old, new)

second_review_old = '''  const reviewPeriod = page.getByLabel("Review period");
  await expect(reviewPeriod).toBeVisible();'''
second_review_new = '''  const reviewPeriod = page.getByRole("button", { name: "Review period", exact: true });
  await expect(reviewPeriod).toBeVisible();'''
browser = replace_once(browser, second_review_old, second_review_new, "second review selector")

loop_old = '''  for (const [value, heading] of [
    ["24", "Activity from the last 24 hours"],
    ["36", "Activity from the last 36 hours"],
    ["48", "Activity from the last 48 hours"],
    ["96", "Activity from the last 4 days"],
    ["12", "Previous shift activity for Last 12 hours"],
  ] as const) {'''
loop_new = '''  for (const [value, optionLabel, heading] of [
    ["24", "Last 24 hours", "Activity from the last 24 hours"],
    ["36", "Last 36 hours", "Activity from the last 36 hours"],
    ["48", "Last 48 hours", "Activity from the last 48 hours"],
    ["96", "Last 4 days", "Activity from the last 4 days"],
    ["12", "Last 12 hours", "Previous shift activity for Last 12 hours"],
  ] as const) {'''
browser = replace_once(browser, loop_old, loop_new, "review-period loop")
browser = replace_once(
    browser,
    '    await reviewPeriod.selectOption(value);',
    '    await chooseVortaSelect(page, "Review period", optionLabel);',
    "review-period loop selection",
)
browser = replace_once(
    browser,
    '    await expect(reviewPeriod).toHaveValue(value);',
    '    await expect(reviewPeriod).toHaveAttribute("data-value", value);',
    "review-period loop value assertion",
)
browser_path.write_text(browser)

contract_path = Path("scripts/shift-handover-contracts.mjs")
contract = contract_path.read_text()
contract = replace_once(
    contract,
    'const page = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");',
    'const page = read("src/screens/ShiftHandover/ShiftHandoverSection.tsx");\nconst vortaSelect = read("src/components/VortaSelect.tsx");',
    "contract shared select read",
)
contract = replace_once(
    contract,
    '[page.includes(\'data-vorta-shift-handover-review-period="true"\') && page.includes("Review period"), "One shared Review period control is required."],',
    '[page.includes(\'data-vorta-shift-handover-review-period="true"\') && page.includes("<VortaSelect") && page.includes(\'label="Review period"\'), "One shared Vorta Review period control is required."],\n  [!page.includes("<select") && (page.match(/<VortaSelect/g) ?? []).length === 4, "Shift Handover must not invoke native browser select dialogs."],\n  [vortaSelect.includes(\'role="listbox"\') && vortaSelect.includes(\'role="option"\') && vortaSelect.includes(\'data-vorta-select-listbox="true"\'), "The shared Vorta selector must render a styled accessible listbox."],\n  [vortaSelect.includes("ArrowDown") && vortaSelect.includes("ArrowUp") && vortaSelect.includes("Home") && vortaSelect.includes("End") && vortaSelect.includes("Escape"), "The Vorta selector must retain keyboard navigation and dismissal."],',
    "contract select assertions",
)
contract = replace_once(
    contract,
    '[browser.includes(\'toHaveValue("12")\'), "The responsive browser contract must verify Last 12 hours as the default."],',
    '[browser.includes(\'toHaveAttribute("data-value", "12")\') && browser.includes("Review period options"), "The responsive browser contract must verify the styled Last 12 hours selector as the default."],',
    "contract browser default assertion",
)
contract = replace_once(
    contract,
    'console.log("✓ Shift Handover review periods, status truth, confirmation detail layout and responsive state verified.");',
    'console.log("✓ Shift Handover Vorta dropdowns, review periods, status truth, confirmation detail layout and responsive state verified.");',
    "contract completion message",
)
contract_path.write_text(contract)
