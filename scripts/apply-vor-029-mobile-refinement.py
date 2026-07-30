from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


vorta_select = r'''import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export interface VortaSelectOption<TValue extends string | number> {
  value: TValue;
  label: string;
}

interface VortaSelectProps<TValue extends string | number> {
  label: string;
  value: TValue;
  options: readonly VortaSelectOption<TValue>[];
  onChange: (value: TValue) => void;
  disabled?: boolean;
  className?: string;
}

type MenuPlacement = "top" | "bottom";
type MenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: MenuPlacement;
  compact: boolean;
};

let openVortaSelectCount = 0;

function updateGlobalSelectState(open: boolean): () => void {
  if (typeof document === "undefined" || !open) return () => undefined;
  openVortaSelectCount += 1;
  document.documentElement.dataset.vortaSelectOpen = "true";
  return () => {
    openVortaSelectCount = Math.max(0, openVortaSelectCount - 1);
    if (openVortaSelectCount === 0) {
      delete document.documentElement.dataset.vortaSelectOpen;
    }
  };
}

export function VortaSelect<TValue extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: VortaSelectProps<TValue>): JSX.Element {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => updateGlobalSelectState(open), [open]);

  const updateMenuPosition = useCallback((): void => {
    if (typeof window === "undefined") return;
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const compact = window.matchMedia("(max-width: 639px)").matches;
    const margin = 12;
    const gap = 8;
    const optionHeight = compact ? 38 : 44;
    const containerPadding = compact ? 8 : 12;
    const desiredHeight = Math.min(
      options.length * optionHeight + containerPadding,
      compact ? 248 : 288,
    );
    const spaceBelow = Math.max(0, viewportBottom - rect.bottom - gap - margin);
    const spaceAbove = Math.max(0, rect.top - viewportTop - gap - margin);
    const placement: MenuPlacement =
      spaceBelow >= Math.min(desiredHeight, 160) || spaceBelow >= spaceAbove
        ? "bottom"
        : "top";
    const availableHeight = Math.max(
      72,
      Math.min(
        placement === "bottom" ? spaceBelow : spaceAbove,
        viewportHeight - margin * 2,
      ),
    );
    const maxHeight = Math.min(desiredHeight, availableHeight);
    const availableWidth = Math.max(0, viewportWidth - margin * 2);
    const width = Math.min(rect.width, availableWidth);
    const left = Math.min(
      Math.max(rect.left, viewportLeft + margin),
      viewportLeft + viewportWidth - margin - width,
    );
    const top = placement === "bottom"
      ? Math.min(rect.bottom + gap, viewportBottom - margin - maxHeight)
      : Math.max(viewportTop + margin, rect.top - gap - maxHeight);

    setMenuPosition({ left, top, width, maxHeight, placement, compact });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return undefined;
    }

    updateMenuPosition();
    const visualViewport = window.visualViewport;
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    visualViewport?.addEventListener("resize", updateMenuPosition);
    visualViewport?.addEventListener("scroll", updateMenuPosition);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      visualViewport?.removeEventListener("resize", updateMenuPosition);
      visualViewport?.removeEventListener("scroll", updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsidePress = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target)
        && !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  useEffect(() => {
    if (!open || !menuPosition) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const option = optionRefs.current[activeIndex];
      const menu = menuRef.current;
      if (!option || !menu) return;
      const optionTop = option.offsetTop;
      const optionBottom = optionTop + option.offsetHeight;
      if (optionTop < menu.scrollTop) {
        menu.scrollTop = Math.max(0, optionTop - 4);
      } else if (optionBottom > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = optionBottom - menu.clientHeight + 4;
      }
      option.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, menuPosition, open]);

  const closeAndFocusTrigger = (): void => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  const selectIndex = (index: number): void => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    closeAndFocusTrigger();
  };

  const moveActive = (nextIndex: number): void => {
    setActiveIndex(Math.max(0, Math.min(options.length - 1, nextIndex)));
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled || options.length === 0) return;
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) return;

    event.preventDefault();
    if (event.key === "ArrowUp") setActiveIndex(Math.max(0, selectedIndex - 1));
    else if (event.key === "Home") setActiveIndex(0);
    else if (event.key === "End") setActiveIndex(options.length - 1);
    else setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveActive(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectIndex(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const selectedOption = options[selectedIndex] ?? options[0];
  const menu = open && menuPosition && typeof document !== "undefined"
    ? createPortal(
      <>
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[110] bg-transparent"
          data-vorta-select-backdrop="true"
          onPointerDown={closeAndFocusTrigger}
        />
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={`${label} options`}
          className="fixed z-[120] overscroll-contain overflow-y-auto rounded-xl border border-gray-700 bg-[#141820] p-1 shadow-2xl shadow-black/45 sm:p-1.5"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
          data-vorta-select-listbox="true"
          data-vorta-select-placement={menuPosition.placement}
          data-vorta-select-compact={menuPosition.compact ? "true" : "false"}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <button
                key={String(option.value)}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={active ? 0 : -1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex min-h-[38px] w-full items-center justify-between gap-2.5 rounded-lg border px-2.5 py-1 text-left text-[13px] font-medium leading-5 transition-colors sm:min-h-11 sm:gap-3 sm:px-3 sm:py-2 sm:text-sm ${
                  selected
                    ? "border-blue-500/60 bg-[#10151d] text-blue-200"
                    : active
                      ? "border-gray-700 bg-[#1a202a] text-slate-100"
                      : "border-transparent text-slate-300 hover:bg-[#1a202a]"
                }`}
                data-value={String(option.value)}
              >
                <span className="min-w-0 break-words">{option.label}</span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </>,
      document.body,
    )
    : null;

  return (
    <div
      ref={rootRef}
      className={`relative grid min-w-0 gap-1 ${className}`}
      data-vorta-select="true"
    >
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => {
          if (!disabled && options.length > 0) {
            setActiveIndex(selectedIndex);
            setOpen((current) => !current);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-700 bg-[#0d1117] px-3 text-left text-sm font-medium text-slate-200 outline-none transition-colors hover:border-gray-600 focus-visible:border-blue-500/70 focus-visible:ring-2 focus-visible:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        data-vorta-select-trigger="true"
        data-value={String(value)}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? String(value)}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
}
'''

Path("src/components/VortaSelect.tsx").write_text(vorta_select)

page_path = Path("src/screens/ShiftHandover/ShiftHandoverSection.tsx")
page = page_path.read_text()
page = replace_once(
    page,
    '''function reviewPeriodHeading(reviewHours: ShiftHandoverReviewHours): string {
  if (reviewHours === 12) return "Previous shift activity for Last 12 hours";
  if (reviewHours === 96) return "Activity from the last 4 days";
  return `Activity from the last ${reviewHours} hours`;
}''',
    '''function reviewPeriodHeading(reviewHours: ShiftHandoverReviewHours): string {
  if (reviewHours === 12) return "Previous shift activity";
  if (reviewHours === 96) return "Activity from the last 4 days";
  return `Activity from the last ${reviewHours} hours`;
}''',
    "review-period heading",
)
page = replace_once(
    page,
    '  const [sortMode, setSortMode] = useState<SortMode>("priority");\n  const [query, setQuery] = useState("");\n  const [filtersOpen, setFiltersOpen] = useState(false);',
    '  const [sortMode, setSortMode] = useState<SortMode>("recent");\n  const [query, setQuery] = useState("");\n  const [filtersOpen, setFiltersOpen] = useState(false);\n  const [statusInfoOpen, setStatusInfoOpen] = useState(false);',
    "filter state defaults",
)
page = replace_once(
    page,
    '''  const activeAdvancedFilterCount = Number(criticality !== "all")
    + Number(status !== "all");
''',
    '''  const activeAdvancedFilterCount = Number(criticality !== "all")
    + Number(status !== "all");
  const hasActiveAdvancedFilters = criticality !== "all"
    || status !== "all"
    || sortMode !== "recent";

  const clearAdvancedFilters = (): void => {
    setCriticality("all");
    setStatus("all");
    setSortMode("recent");
  };
''',
    "active filter state",
)
page = replace_once(
    page,
    '      className={`${filtersOpen ? "grid" : "hidden"} gap-3 lg:contents`}',
    '      className={`${filtersOpen ? "grid" : "hidden"} gap-2 sm:gap-3 lg:contents`}',
    "compact advanced filter layout",
)
page = replace_once(
    page,
    '''      <VortaSelect
        label="Sort by"
        value={reviewHours > 12 ? "recent" : sortMode}
        options={SORT_OPTIONS}
        onChange={setSortMode}
        disabled={reviewHours > 12}
      />
    </div>''',
    '''      <VortaSelect
        label="Sort by"
        value={reviewHours > 12 ? "recent" : sortMode}
        options={SORT_OPTIONS}
        onChange={setSortMode}
        disabled={reviewHours > 12}
      />

      {hasActiveAdvancedFilters ? (
        <button
          type="button"
          onClick={clearAdvancedFilters}
          className="inline-flex min-h-9 items-center justify-center justify-self-start rounded-lg px-2.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/10 hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 lg:hidden"
          data-vorta-shift-handover-clear-filters="true"
        >
          Clear filters
        </button>
      ) : null}
    </div>''',
    "clear filters action",
)
page = replace_once(
    page,
    '''          <div className="rounded-xl border border-gray-800 bg-[#10151d] px-4 py-3 text-xs leading-5 text-slate-500">
            Handover status is normalised from SAP work-order status, confirmation text, final confirmations, goods movements and open material reservations. The original SAP status codes remain visible in each detail panel.
          </div>''',
    '''          <div
            className="rounded-xl border border-gray-800 bg-[#10151d] px-4 py-3"
            data-vorta-shift-handover-status-disclosure="true"
          >
            <button
              type="button"
              onClick={() => setStatusInfoOpen((open) => !open)}
              className="flex min-h-9 w-full items-center justify-between gap-3 text-left text-sm font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
              aria-expanded={statusInfoOpen}
              aria-controls="shift-handover-status-explanation"
            >
              <span>How handover statuses are calculated</span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${statusInfoOpen ? "rotate-90" : ""}`}
                aria-hidden="true"
              />
            </button>
            {statusInfoOpen ? (
              <p
                id="shift-handover-status-explanation"
                className="mt-2 border-t border-gray-800 pt-3 text-xs leading-5 text-slate-500"
              >
                Handover status is normalised from SAP work-order status, confirmation text, final confirmations, goods movements and open material reservations. The original SAP status codes remain visible in each detail panel.
              </p>
            ) : null}
          </div>''',
    "status explanation disclosure",
)
page_path.write_text(page)

css_path = Path("src/card-surfaces.css")
css = css_path.read_text()
css_anchor = '''/* Shift Handover starts with the operational summary cards, not evidence copy. */
[data-vorta-shift-handover="true"] > header {
  display: none !important;
}
'''
css_replacement = css_anchor + '''
/* Open listboxes own the foreground so floating AI launchers cannot cover options. */
html[data-vorta-select-open="true"] :is(
  [data-vorta-shared-mobile-ai-launcher="true"],
  [data-vorta-ask-vorta-launcher="true"],
  [data-vorta-floating-ai-launcher="true"]
) {
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
'''
css = replace_once(css, css_anchor, css_replacement, "select stacking CSS")
css_path.write_text(css)

browser_path = Path("tests/browser/maintenance-manager-shift-handover.spec.ts")
browser = browser_path.read_text()
browser = browser.replace(
    'page.getByRole("heading", { name: "Previous shift activity for Last 12 hours" })',
    'page.getByRole("heading", { name: "Previous shift activity", exact: true })',
)
browser = browser.replace(
    '["12", "Last 12 hours", "Previous shift activity for Last 12 hours"]',
    '["12", "Last 12 hours", "Previous shift activity"]',
)
menu_anchor = '''  await expect(reviewListbox).toBeVisible();
  await expect(reviewListbox.getByRole("option")).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(reviewListbox).toBeHidden();'''
menu_replacement = '''  await expect(reviewListbox).toBeVisible();
  await expect(reviewListbox.getByRole("option")).toHaveCount(5);
  await expect(reviewListbox).toHaveAttribute("data-vorta-select-placement", /top|bottom/);
  await expect(page.locator("html")).toHaveAttribute("data-vorta-select-open", "true");
  const openingViewportWidth = page.viewportSize()?.width ?? 1366;
  const viewportBounds = await page.evaluate(() => {
    const visualViewport = window.visualViewport;
    return {
      top: visualViewport?.offsetTop ?? 0,
      bottom: (visualViewport?.offsetTop ?? 0) + (visualViewport?.height ?? window.innerHeight),
    };
  });
  const reviewMenuBox = await reviewListbox.boundingBox();
  expect(reviewMenuBox?.y ?? -1).toBeGreaterThanOrEqual(viewportBounds.top - 1);
  expect((reviewMenuBox?.y ?? 0) + (reviewMenuBox?.height ?? 0)).toBeLessThanOrEqual(viewportBounds.bottom + 1);
  if (openingViewportWidth < 640) {
    await expect(reviewListbox).toHaveAttribute("data-vorta-select-compact", "true");
    expect(reviewMenuBox?.height ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(210);
    for (const option of await reviewListbox.getByRole("option").all()) {
      const optionBox = await option.boundingBox();
      expect(optionBox?.height ?? 0).toBeGreaterThanOrEqual(36);
      expect(optionBox?.height ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(40);
    }
  }
  const askVortaLauncher = page.locator('[data-vorta-shared-mobile-ai-launcher="true"]');
  if (await askVortaLauncher.count()) {
    await expect(askVortaLauncher).toHaveCSS("visibility", "hidden");
  }
  await page.keyboard.press("Escape");
  await expect(reviewListbox).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-vorta-select-open", "true");
  if (await askVortaLauncher.count()) {
    await expect(askVortaLauncher).not.toHaveCSS("visibility", "hidden");
  }'''
browser = replace_once(browser, menu_anchor, menu_replacement, "browser menu proportions")
filter_anchor = '''    await chooseVortaSelect(page, "Sort by", "Criticality");
    await expect(page.getByRole("button", { name: "Filters · 2", exact: true })).toBeVisible();
    await chooseVortaSelect(page, "Criticality", "All criticalities");
    await chooseVortaSelect(page, "Status", "All statuses");
    await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeVisible();'''
filter_replacement = '''    await chooseVortaSelect(page, "Sort by", "Criticality");
    await expect(page.getByRole("button", { name: "Filters · 2", exact: true })).toBeVisible();
    const clearFilters = page.getByRole("button", { name: "Clear filters", exact: true });
    await expect(clearFilters).toBeVisible();
    await clearFilters.click();
    await expect(criticalitySelect).toHaveAttribute("data-value", "all");
    await expect(statusSelect).toHaveAttribute("data-value", "all");
    await expect(sortSelect).toHaveAttribute("data-value", "recent");
    await expect(page.getByRole("button", { name: "Filters", exact: true })).toBeVisible();
    await expect(clearFilters).toBeHidden();'''
browser = replace_once(browser, filter_anchor, filter_replacement, "browser clear filters")
new_test = r'''

test("Shift Handover mobile dropdowns remain compact, viewport safe and fully clearable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-360", "Exercise compact Android-sized controls once; responsive presence is covered elsewhere.");
  test.setTimeout(180_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");

  const scrollContainer = page.locator('[data-vorta-portal-scroll-container="true"]');
  const filtersButton = page.getByRole("button", { name: "Filters", exact: true });
  const criticalitySelect = page.getByRole("button", { name: "Criticality", exact: true });
  const statusSelect = page.getByRole("button", { name: "Status", exact: true });
  const sortSelect = page.getByRole("button", { name: "Sort by", exact: true });
  const reviewPeriod = page.getByRole("button", { name: "Review period", exact: true });
  const searchInput = page.getByPlaceholder("Search work order or equipment");

  await filtersButton.click();
  await expect(criticalitySelect).toBeVisible();
  await expect(statusSelect).toBeVisible();
  await expect(sortSelect).toBeVisible();

  await criticalitySelect.evaluate((element) => {
    const container = document.querySelector<HTMLElement>('[data-vorta-portal-scroll-container="true"]');
    if (!container) return;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const rect = element.getBoundingClientRect();
    container.scrollTop += rect.bottom - viewportHeight + 24;
  });
  await page.waitForTimeout(100);
  const triggerBox = await criticalitySelect.boundingBox();
  const visualHeight = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
  expect(triggerBox?.y ?? 0).toBeGreaterThan(visualHeight * 0.45);
  const scrollBeforeOpen = await scrollContainer.evaluate((element) => element.scrollTop);
  await criticalitySelect.click();
  const criticalityListbox = page.getByRole("listbox", { name: "Criticality options" });
  await expect(criticalityListbox).toBeVisible();
  await expect(criticalityListbox).toHaveAttribute("data-vorta-select-placement", "top");
  const listboxBox = await criticalityListbox.boundingBox();
  const viewport = await page.evaluate(() => ({
    top: window.visualViewport?.offsetTop ?? 0,
    bottom: (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight),
  }));
  expect(listboxBox?.y ?? -1).toBeGreaterThanOrEqual(viewport.top - 1);
  expect((listboxBox?.y ?? 0) + (listboxBox?.height ?? 0)).toBeLessThanOrEqual(viewport.bottom + 1);
  expect(listboxBox?.height ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(210);
  const selectedOption = criticalityListbox.getByRole("option", { name: "All criticalities", exact: true });
  await expect(selectedOption).toBeFocused();
  const selectedBox = await selectedOption.boundingBox();
  expect(selectedBox?.y ?? -1).toBeGreaterThanOrEqual((listboxBox?.y ?? 0) - 1);
  expect((selectedBox?.y ?? 0) + (selectedBox?.height ?? 0)).toBeLessThanOrEqual((listboxBox?.y ?? 0) + (listboxBox?.height ?? 0) + 1);
  const scrollAfterOpen = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(Math.abs(scrollAfterOpen - scrollBeforeOpen)).toBeLessThanOrEqual(2);
  const askVortaLauncher = page.locator('[data-vorta-shared-mobile-ai-launcher="true"]');
  if (await askVortaLauncher.count()) {
    await expect(askVortaLauncher).toHaveCSS("visibility", "hidden");
  }
  await criticalityListbox.getByRole("option", { name: "High", exact: true }).click();
  if (await askVortaLauncher.count()) {
    await expect(askVortaLauncher).not.toHaveCSS("visibility", "hidden");
  }

  for (const [label, value] of [
    ["Critical", "critical"],
    ["High", "high"],
    ["Medium", "medium"],
    ["Low", "low"],
    ["All criticalities", "all"],
  ] as const) {
    await chooseVortaSelect(page, "Criticality", label);
    await expect(criticalitySelect).toHaveAttribute("data-value", value);
  }
  for (const [label, value] of [
    ["Active / ongoing", "active"],
    ["Waiting / deferred", "waiting"],
    ["External contractor", "contractor"],
    ["Completed", "completed"],
    ["All statuses", "all"],
  ] as const) {
    await chooseVortaSelect(page, "Status", label);
    await expect(statusSelect).toHaveAttribute("data-value", value);
  }
  for (const [label, value] of [
    ["Criticality", "priority"],
    ["Longest breakdown", "breakdown"],
    ["Most recent", "recent"],
  ] as const) {
    await chooseVortaSelect(page, "Sort by", label);
    await expect(sortSelect).toHaveAttribute("data-value", value);
  }

  await searchInput.fill("VF");
  await chooseVortaSelect(page, "Criticality", "High");
  await expect(page.getByRole("button", { name: "Filters · 1", exact: true })).toBeVisible();
  await chooseVortaSelect(page, "Status", "Completed");
  await expect(page.getByRole("button", { name: "Filters · 2", exact: true })).toBeVisible();
  await chooseVortaSelect(page, "Sort by", "Criticality");
  const clearFilters = page.getByRole("button", { name: "Clear filters", exact: true });
  await expect(clearFilters).toBeVisible();
  const scrollBeforeClear = await scrollContainer.evaluate((element) => element.scrollTop);
  await clearFilters.click();
  await expect(criticalitySelect).toHaveAttribute("data-value", "all");
  await expect(statusSelect).toHaveAttribute("data-value", "all");
  await expect(sortSelect).toHaveAttribute("data-value", "recent");
  await expect(searchInput).toHaveValue("VF");
  await expect(reviewPeriod).toHaveAttribute("data-value", "12");
  await expect(clearFilters).toBeHidden();
  const scrollAfterClear = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(scrollAfterClear).toBeGreaterThanOrEqual(Math.max(0, scrollBeforeClear - 80));

  await searchInput.fill("");
  const statusDisclosure = page.getByRole("button", { name: "How handover statuses are calculated", exact: true });
  await statusDisclosure.scrollIntoViewIfNeeded();
  await expect(statusDisclosure).toHaveAttribute("aria-expanded", "false");
  const disclosureScrollBefore = await scrollContainer.evaluate((element) => element.scrollTop);
  await statusDisclosure.click();
  await expect(statusDisclosure).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Handover status is normalised from SAP work-order status", { exact: false })).toBeVisible();
  const disclosureScrollAfter = await scrollContainer.evaluate((element) => element.scrollTop);
  expect(disclosureScrollAfter).toBeGreaterThanOrEqual(Math.max(0, disclosureScrollBefore - 20));
  await statusDisclosure.click();
  await expect(statusDisclosure).toHaveAttribute("aria-expanded", "false");
  await expectNoPageOverflow(page);
});
'''
browser = replace_once(
    browser,
    '\ntest("Shift Handover refreshes the session after a wrapped 401", async ({',
    new_test + '\ntest("Shift Handover refreshes the session after a wrapped 401", async ({',
    "focused mobile refinement test",
)
browser_path.write_text(browser)

contract_path = Path("scripts/shift-handover-contracts.mjs")
contract = contract_path.read_text()
contract = replace_once(
    contract,
    '''  [vortaSelect.includes("ArrowDown") && vortaSelect.includes("ArrowUp") && vortaSelect.includes("Home") && vortaSelect.includes("End") && vortaSelect.includes("Escape"), "The Vorta selector must retain keyboard navigation and dismissal."],''',
    '''  [vortaSelect.includes("ArrowDown") && vortaSelect.includes("ArrowUp") && vortaSelect.includes("Home") && vortaSelect.includes("End") && vortaSelect.includes("Escape"), "The Vorta selector must retain keyboard navigation and dismissal."],
  [vortaSelect.includes("createPortal") && vortaSelect.includes("visualViewport") && vortaSelect.includes('data-vorta-select-placement') && vortaSelect.includes('data-vorta-select-backdrop'), "Vorta selectors must use viewport-aware portalled placement above floating controls."],
  [vortaSelect.includes('min-h-[38px]') && vortaSelect.includes('sm:min-h-11') && vortaSelect.includes('data-vorta-select-compact'), "Mobile selector options must be compact without changing wider-layout sizing."],
  [vortaSelect.includes("data-vortaSelectOpen") || vortaSelect.includes("vortaSelectOpen"), "Open selectors must expose a global stacking state."],''',
    "contract dropdown placement assertions",
)
contract = replace_once(
    contract,
    '''  [page.includes("activeAdvancedFilterCount") && page.includes("Filters{activeAdvancedFilterCount"), "Mobile advanced filters must expose the active Criticality and Status count."],
  [page.includes('id="shift-handover-advanced-filters"') && page.includes("lg:contents"), "Criticality, Status and Sort must collapse on mobile without duplicating wider-layout logic."],''',
    '''  [page.includes("activeAdvancedFilterCount") && page.includes("Filters{activeAdvancedFilterCount"), "Mobile advanced filters must expose the active Criticality and Status count."],
  [page.includes("hasActiveAdvancedFilters") && page.includes("clearAdvancedFilters") && page.includes('data-vorta-shift-handover-clear-filters="true"') && page.includes('setSortMode("recent")'), "Mobile advanced filters need a selective Clear filters action with Most recent as the default sort."],
  [page.includes('id="shift-handover-advanced-filters"') && page.includes("lg:contents"), "Criticality, Status and Sort must collapse on mobile without duplicating wider-layout logic."],
  [page.includes('data-vorta-shift-handover-status-disclosure="true"') && page.includes("How handover statuses are calculated") && page.includes("statusInfoOpen"), "SAP status guidance must be retained in a closed-by-default disclosure."],''',
    "contract filter/disclosure assertions",
)
contract = replace_once(
    contract,
    '''  [page.includes("Previous shift activity for Last 12 hours") && page.includes("Activity from the last 4 days"), "Activity headings must describe the selected period."],''',
    '''  [page.includes('return "Previous shift activity"') && !page.includes("Previous shift activity for Last 12 hours") && page.includes("Activity from the last 4 days"), "Activity headings must describe each period without embedding the dropdown label in a sentence."],''',
    "contract heading assertion",
)
contract = replace_once(
    contract,
    '''  [browser.includes("Filters · 2") && browser.includes('data-vorta-shift-handover-scope-tabs="true"') && browser.includes('data-vorta-shift-handover-metric="contractor"'), "Responsive browser coverage must verify mobile filter count, the area rail and retired summary cards."],''',
    '''  [browser.includes("Filters · 2") && browser.includes("Clear filters") && browser.includes('data-vorta-shift-handover-scope-tabs="true"') && browser.includes('data-vorta-shift-handover-metric="contractor"'), "Responsive browser coverage must verify mobile filter count, selective clearing, the area rail and retired summary cards."],
  [browser.includes('data-vorta-select-placement') && browser.includes("visualViewport") && browser.includes('data-vorta-shared-mobile-ai-launcher="true"'), "Browser coverage must verify visual-viewport placement and Ask Vorta stacking."],
  [surfaces.includes('html[data-vorta-select-open="true"]') && surfaces.includes('data-vorta-shared-mobile-ai-launcher="true"'), "Open dropdowns must suppress the shared floating Ask Vorta launcher."],''',
    "contract browser stacking assertions",
)
contract = replace_once(
    contract,
    'console.log("✓ Shift Handover Vorta dropdowns, review periods, status truth, confirmation detail layout and responsive state verified.");',
    'console.log("✓ Shift Handover compact viewport-safe dropdowns, filters, disclosures, review periods and status truth verified.");',
    "contract completion message",
)
contract_path.write_text(contract)

print("Applied VOR-029 mobile dropdown and filter refinements.")
