import { expect, test, type Page } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

async function expectEquipmentContentFitsViewport(
  page: Page,
  label: string,
): Promise<void> {
  const layout = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(
      '[data-vorta-equipment-mobile-route-content="true"]',
    );
    if (!content) {
      return {
        missing: true,
        viewportWidth: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        contentClientWidth: 0,
        contentScrollWidth: 0,
        wideSurfaces: [] as string[],
        offenders: [] as string[],
      };
    }

    const viewportWidth = window.innerWidth;
    const visible = (element: Element): element is HTMLElement => {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
        return false;
      }
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number.parseFloat(style.opacity || "1") > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const wideSurfaces = Array.from(
      content.querySelectorAll<HTMLElement>("table, svg, canvas, pre"),
    )
      .filter(visible)
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => {
        const classes =
          typeof element.className === "string"
            ? element.className
            : element.getAttribute("class") ?? "";
        return `${element.tagName.toLowerCase()}.${classes}`;
      })
      .slice(0, 8);

    const offenders = Array.from(content.querySelectorAll<HTMLElement>("*"))
      .filter(visible)
      .filter(
        (element) =>
          !element.closest('[data-vorta-equipment-tablist="true"]'),
      )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .map((element) => {
        const classes =
          typeof element.className === "string"
            ? element.className
            : element.getAttribute("class") ?? "";
        return `${element.tagName.toLowerCase()}.${classes}`;
      })
      .slice(0, 8);

    return {
      missing: false,
      viewportWidth,
      pageWidth: document.documentElement.scrollWidth,
      contentClientWidth: content.clientWidth,
      contentScrollWidth: content.scrollWidth,
      wideSurfaces,
      offenders,
    };
  });

  expect(layout.missing, `${label}: mobile route content`).toBe(false);
  expect(layout.pageWidth, `${label}: document width`).toBeLessThanOrEqual(
    layout.viewportWidth + 1,
  );
  expect(
    layout.contentScrollWidth,
    `${label}: equipment content width`,
  ).toBeLessThanOrEqual(layout.contentClientWidth + 1);
  expect(layout.wideSurfaces, `${label}: wide data surfaces`).toEqual([]);
  expect(layout.offenders, `${label}: clipped visible elements`).toEqual([]);
}

test("Equipment tab changes preserve vertical position and one mobile hero", async ({
  page,
}) => {
  test.skip(test.info().project.name !== "phone-360", "Run equipment phone continuity once.");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 700, height: 900 });
  await signInMaintenanceManager(page);

  await page.goto("/equipment");
  const equipmentButton = page
    .locator('[data-vorta-mobile-equipment="true"] button')
    .filter({ hasText: "Open" })
    .first();
  await expect(equipmentButton).toBeVisible({ timeout: 30_000 });
  await equipmentButton.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);

  const sharedHero = page.locator(
    '[data-vorta-equipment-shared-mobile-hero="true"]',
  );
  await expect(sharedHero).toHaveCount(1);
  await expect(sharedHero).toBeVisible();
  await expect(
    page.locator(
      '[data-vorta-equipment-mobile-route-content="true"] [data-vorta-equipment-mobile-tabs="true"]',
    ),
  ).toHaveCount(0);

  const equipmentName = (await sharedHero.locator("h1").textContent())?.trim();
  expect(equipmentName).toBeTruthy();

  await page.evaluate(() => {
    const maximum = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    window.scrollTo(0, Math.min(320, maximum));
  });
  const scrollPositionBeforeTabChange = await page.evaluate(() => window.scrollY);
  expect(scrollPositionBeforeTabChange).toBeGreaterThan(0);

  await sharedHero
    .getByRole("tab", { name: "Work Orders", exact: true })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForURL(/\/equipment\/[^/]+\/work-orders(?:\?.*)?$/);
  await expect(sharedHero).toBeVisible();
  await expect(sharedHero.locator("h1")).toHaveText(equipmentName ?? "");
  await page.waitForTimeout(220);

  const workOrderScrollPosition = await page.evaluate(() => window.scrollY);
  expect(
    Math.abs(workOrderScrollPosition - scrollPositionBeforeTabChange),
  ).toBeLessThanOrEqual(4);

  await sharedHero
    .getByRole("tab", { name: "Calibrations", exact: true })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForURL(/\/equipment\/[^/]+\/pms(?:\?.*)?$/);
  await expect(sharedHero).toBeVisible();
  await expect(sharedHero.locator("h1")).toHaveText(equipmentName ?? "");
  await page.waitForTimeout(220);

  const calibrationScrollPosition = await page.evaluate(() => window.scrollY);
  expect(
    Math.abs(calibrationScrollPosition - workOrderScrollPosition),
  ).toBeLessThanOrEqual(4);
  await expectEquipmentContentFitsViewport(page, "Calibrations at 700px");
  await expectNoPageOverflow(page);
});

test("Every Equipment section fits the full phone viewport", async ({ page }) => {
  test.skip(test.info().project.name !== "phone-360", "Run the complete equipment width audit once.");
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await signInMaintenanceManager(page);

  await page.goto("/equipment");
  const equipmentButton = page
    .locator('[data-vorta-mobile-equipment="true"] button')
    .filter({ hasText: "Open" })
    .first();
  await expect(equipmentButton).toBeVisible({ timeout: 30_000 });
  await equipmentButton.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);

  const equipmentMatch = page.url().match(/\/equipment\/([^/]+)\/overview/);
  expect(equipmentMatch?.[1]).toBeTruthy();
  const equipmentId = equipmentMatch?.[1] ?? "";
  const routes = [
    ["overview", "Overview"],
    ["notifications", "Notifications"],
    ["work-orders", "Work Orders"],
    ["pms", "Calibrations"],
    ["history", "History"],
    ["skills", "Skills & Engineers"],
    ["spares", "Spares"],
    ["documents", "Documents"],
  ] as const;

  for (const width of [360, 700]) {
    await page.setViewportSize({ width, height: 900 });

    for (const [route, label] of routes) {
      await page.goto(`/equipment/${equipmentId}/${route}`);
      await expect(
        page.locator('[data-vorta-equipment-shared-mobile-hero="true"]'),
      ).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(220);
      await expectEquipmentContentFitsViewport(page, `${label} at ${width}px`);
      await expectNoPageOverflow(page);
    }
  }

  await page.goto(`/equipment/${equipmentId}/spares`);
  const sparesTable = page.locator(
    '[data-vorta-equipment-mobile-route-content="true"] table',
  ).first();
  await expect(sparesTable).toBeVisible({ timeout: 30_000 });
  await expect(sparesTable).toHaveCSS("display", "block");
  await expect(sparesTable).toHaveCSS("min-width", "0px");
  const firstSparesRow = sparesTable.locator("tbody tr").first();
  await expect(firstSparesRow).toHaveCSS("display", "grid");
});
