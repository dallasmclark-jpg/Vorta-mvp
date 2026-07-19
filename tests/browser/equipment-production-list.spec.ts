import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

test("production demo Equipment list exposes sorting and evidence gaps", async ({
  page,
}) => {
  await signInMaintenanceManager(page);
  await page.goto("/equipment");

  const section = page.locator(
    '[data-vorta-production-equipment-list="true"]',
  );
  await expect(section).toBeVisible();

  const sort = page.getByLabel("Sort equipment");
  await expect(sort).toBeVisible();
  await sort.selectOption("name");
  await expect(sort).toHaveValue("name");

  const rows = section.locator('[role="button"][aria-expanded]');
  await expect.poll(() => rows.count()).toBeGreaterThan(1);

  const names: string[] = [];
  for (let index = 0; index < (await rows.count()); index += 1) {
    names.push(
      ((await rows.nth(index).locator("button").first().textContent()) ?? "").trim(),
    );
  }
  expect(names).toEqual(
    [...names].sort((left, right) => left.localeCompare(right)),
  );

  const evidenceFilter = page.getByRole("button", {
    name: "Evidence Gaps",
    exact: true,
  });
  await expect(evidenceFilter).toBeEnabled();
  await evidenceFilter.click();
  await expect(evidenceFilter).toHaveClass(/border-blue-500/);
  await expect(page.getByText("Evidence Gaps").first()).toBeVisible();

  await expectNoPageOverflow(page);
});
