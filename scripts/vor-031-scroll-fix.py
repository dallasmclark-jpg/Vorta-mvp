from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text()
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one replacement, found {count}: {old[:120]!r}")
    target.write_text(content.replace(old, new, 1))


for component in (
    "src/components/VortaSelect.tsx",
    "src/components/VortaMultiSelect.tsx",
):
    replace_once(
        component,
        "  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);\n",
        "  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);\n"
        "  const menuReady = menuPosition !== null;\n",
    )

    replace_once(
        component,
        '''    updateMenuPosition();
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
''',
        '''    updateMenuPosition();
    const visualViewport = window.visualViewport;
    const handleWindowScroll = (event: Event): void => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      updateMenuPosition();
    };
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", handleWindowScroll, true);
    visualViewport?.addEventListener("resize", updateMenuPosition);
    visualViewport?.addEventListener("scroll", updateMenuPosition);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", handleWindowScroll, true);
      visualViewport?.removeEventListener("resize", updateMenuPosition);
      visualViewport?.removeEventListener("scroll", updateMenuPosition);
    };
''',
    )

    replace_once(
        component,
        '''  useEffect(() => {
    if (!open || !menuPosition) return undefined;
''',
        '''  useEffect(() => {
    if (!open || !menuReady) return undefined;
''',
    )

    replace_once(
        component,
        "  }, [activeIndex, menuPosition, open]);\n",
        "  }, [activeIndex, menuReady, open]);\n",
    )

    replace_once(
        component,
        'className="fixed z-[120] overscroll-contain overflow-y-auto rounded-xl border border-gray-700 bg-[#141820]',
        'className="fixed z-[120] touch-pan-y overscroll-contain overflow-y-auto rounded-xl border border-gray-700 bg-[#141820]',
    )

    replace_once(
        component,
        '''            maxHeight: menuPosition.maxHeight,
          }}
''',
        '''            maxHeight: menuPosition.maxHeight,
            overscrollBehavior: "contain",
            touchAction: "pan-y",
            WebkitOverflowScrolling: "touch",
          }}
''',
    )


test_path = ROOT / "tests/browser/maintenance-manager-shift-handover-select-scroll.spec.ts"
test_path.write_text('''import { expect, test, type Locator, type Page } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

async function expectInternalMenuScroll(
  page: Page,
  listbox: Locator,
): Promise<void> {
  await expect(listbox).toBeVisible();
  await expect(listbox).toHaveCSS("touch-action", "pan-y");

  const overflow = await listbox.evaluate(
    (element) => element.scrollHeight - element.clientHeight,
  );
  expect(overflow, "The mobile listbox must have internally scrollable content").toBeGreaterThan(24);

  const pageScroller = page.locator('[data-vorta-portal-scroll-container="true"]');
  const pageScrollBefore = await pageScroller.evaluate((element) => element.scrollTop);
  const box = await listbox.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + Math.min((box?.height ?? 0) / 2, 120),
  );
  await page.mouse.wheel(0, Math.min(240, overflow));
  await page.waitForTimeout(350);

  const menuScrollAfter = await listbox.evaluate((element) => element.scrollTop);
  expect(
    menuScrollAfter,
    "Internal menu scrolling must not snap back to the focused first option",
  ).toBeGreaterThan(20);
  await expect(listbox).toBeVisible();

  const pageScrollAfter = await pageScroller.evaluate((element) => element.scrollTop);
  expect(
    Math.abs(pageScrollAfter - pageScrollBefore),
    "Scrolling a portalled dropdown must not move the Shift Handover page",
  ).toBeLessThanOrEqual(2);
}

test("Shift Handover portalled dropdowns scroll on a narrow mobile viewport", async ({ page }) => {
  test.setTimeout(150_000);
  await signInMaintenanceManager(page);
  await page.goto("/shift-handover");
  await expect(page.locator('[data-vorta-shift-handover="true"]')).toBeVisible();

  const reviewTrigger = page.getByRole("button", { name: "Review period", exact: true });
  await expect(reviewTrigger).toBeVisible();
  await reviewTrigger.click();
  const reviewListbox = page.getByRole("listbox", { name: "Review period options" });
  await expectInternalMenuScroll(page, reviewListbox);
  await page.keyboard.press("Escape");
  await expect(reviewListbox).toBeHidden();

  const teamTrigger = page.getByRole("button", { name: "Maintenance team", exact: true });
  if (!(await teamTrigger.isVisible())) {
    await page.getByRole("button", { name: /^Filters(?: · \\d+)?$/ }).click();
  }
  await expect(teamTrigger).toBeVisible();
  await teamTrigger.click();
  const teamListbox = page.getByRole("listbox", { name: "Maintenance team options" });
  await expectInternalMenuScroll(page, teamListbox);
  await page.keyboard.press("Escape");
  await expect(teamListbox).toBeHidden();
});
''')

workflow = ".github/workflows/shift-handover-quality.yml"
for marker in (
    '      - "src/components/VortaMultiSelect.tsx"\n',
):
    replace_once(
        workflow,
        marker,
        '      - "src/components/VortaSelect.tsx"\n' + marker,
    )

for marker in (
    '      - "tests/browser/maintenance-manager-shift-handover-team-filter.spec.ts"\n',
):
    replace_once(
        workflow,
        marker,
        marker + '      - "tests/browser/maintenance-manager-shift-handover-select-scroll.spec.ts"\n',
    )

replace_once(
    workflow,
    '''      - name: Run maintenance-team responsive regression
        run: |
          npx playwright test \\
            tests/browser/maintenance-manager-shift-handover-team-filter.spec.ts \\
            --project=phone-360 \\
            --project=samsung-tablet-portrait \\
            --project=samsung-tablet-landscape \\
            --project=laptop-1366 \\
            --project=desktop-1920 \\
            --config=playwright.config.ts
''',
    '''      - name: Run Shift Handover responsive regression
        run: |
          npx playwright test \\
            tests/browser/maintenance-manager-shift-handover-team-filter.spec.ts \\
            --project=phone-360 \\
            --project=samsung-tablet-portrait \\
            --project=samsung-tablet-landscape \\
            --project=laptop-1366 \\
            --project=desktop-1920 \\
            --config=playwright.config.ts
          npx playwright test \\
            tests/browser/maintenance-manager-shift-handover-select-scroll.spec.ts \\
            --project=phone-360 \\
            --config=playwright.config.ts
''',
)
