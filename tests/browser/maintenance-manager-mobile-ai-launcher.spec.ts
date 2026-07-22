import { expect, test } from "@playwright/test";
import { signInMaintenanceManager } from "./maintenance-manager-test-helpers";

test("Ask Vorta launcher keeps a compact mobile footprint without losing access", async ({
  page,
}, testInfo) => {
  await signInMaintenanceManager(page);
  await page.goto("/skills-matrix");

  await expect(
    page.getByRole("heading", { name: "Skills Matrix", exact: true }),
  ).toBeVisible();

  const launcher = page.getByRole("button", {
    name: "Ask Vorta AI",
    exact: true,
  });
  await expect(launcher).toBeVisible();

  const box = await launcher.boundingBox();
  expect(box, "Ask Vorta launcher must have a rendered footprint").not.toBeNull();

  const viewportWidth = page.viewportSize()?.width ?? 1366;
  if (viewportWidth <= 420) {
    expect(
      box?.width ?? Number.POSITIVE_INFINITY,
      "Phone launcher must be icon-sized rather than a wide pill over evidence cards",
    ).toBeLessThanOrEqual(52);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(52);

    const styles = await launcher.evaluate((element) => {
      const computed = window.getComputedStyle(element);
      return {
        fontSize: Number.parseFloat(computed.fontSize),
        right: window.innerWidth - element.getBoundingClientRect().right,
        bottom: window.innerHeight - element.getBoundingClientRect().bottom,
      };
    });
    expect(styles.fontSize).toBe(0);
    expect(styles.right).toBeGreaterThanOrEqual(10);
    expect(styles.bottom).toBeGreaterThanOrEqual(10);
  } else {
    expect(
      box?.width ?? 0,
      "Tablet and desktop launchers retain the labelled control",
    ).toBeGreaterThan(100);
  }

  await launcher.click();
  await expect(
    page.getByRole("button", { name: "Close global assistant", exact: true }),
  ).toBeVisible();

  await testInfo.attach(`ask-vorta-launcher-${testInfo.project.name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
