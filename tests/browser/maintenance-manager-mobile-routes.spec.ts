import { expect, test, type Locator } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const mobileRoutes = [
  ["/dashboard", "Dashboard"],
  ["/equipment", "Equipment"],
  ["/skills-matrix", "Capability"],
  ["/engineers", "Engineers"],
  ["/requirements", "Requirements"],
  ["/training", "Training"],
  ["/training-providers", "Training Providers"],
  ["/career", "Development"],
  ["/pilot-impact", "Pilot Evidence"],
  ["/pilot-adoption", "Pilot Evidence"],
  ["/support", "Support"],
  ["/settings", "Settings"],
] as const;

async function fontSizePixels(locator: Locator): Promise<number> {
  return locator.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
}

async function pseudoFontSizePixels(
  locator: Locator,
  pseudo: "::before" | "::after",
): Promise<number> {
  return locator.evaluate(
    (element, pseudoElement) =>
      Number.parseFloat(window.getComputedStyle(element, pseudoElement).fontSize),
    pseudo,
  );
}

test("Maintenance Manager mobile routes retain one shell and one Ask Vorta entry", async ({
  page,
}) => {
  test.setTimeout(210_000);
  const viewportWidth = page.viewportSize()?.width ?? 1366;
  test.skip(viewportWidth >= 640, "Phone-only route matrix.");

  await signInMaintenanceManager(page);

  const mobileTopBar = page.locator('[data-vorta-mobile-topbar="true"]');
  const mobileLogo = mobileTopBar.locator(
    '[data-vorta-mobile-topbar-home="true"]',
  );
  const mobileTitle = mobileTopBar.locator(
    '[data-vorta-mobile-header-title="true"]',
  );
  const mobileMenu = mobileTopBar.getByRole("button", { name: "Open menu" });
  const sharedLauncher = page.locator(
    '[data-vorta-shared-mobile-ai-launcher="true"]',
  );

  for (const [path, label] of mobileRoutes) {
    await page.goto(path);
    await expect(mobileTopBar).toHaveCSS("display", "grid");
    await expect(mobileTitle).toHaveText(label);
    await expect(mobileLogo).toBeVisible();
    await expect(mobileMenu).toBeVisible();

    const logoBox = await mobileLogo.boundingBox();
    const titleBox = await mobileTitle.boundingBox();
    const menuBox = await mobileMenu.boundingBox();
    expect(logoBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(logoBox?.x ?? 9999).toBeLessThan(titleBox?.x ?? 0);
    expect(titleBox?.x ?? 9999).toBeLessThan(menuBox?.x ?? 0);

    await expect(sharedLauncher).toHaveCount(1);
    await expect(sharedLauncher).toBeVisible();
    await expect(sharedLauncher).toHaveAccessibleName("Ask Vorta");
    expect(await fontSizePixels(sharedLauncher), "Mobile typography: Ask Vorta launcher").toBeGreaterThanOrEqual(16);
    await expectNoPageOverflow(page);
  }

  await mobileMenu.click();
  const navigation = page.getByRole("dialog", { name: "Portal navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Capability Matching" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Pilot Setup" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Data Import" })).toHaveCount(0);
  const firstNavigationLink = navigation.getByRole("link").first();
  expect(await fontSizePixels(firstNavigationLink), "Mobile typography: navigation links").toBeGreaterThanOrEqual(16);
  const navigationBox = await navigation.boundingBox();
  const navigationViewport = page.viewportSize();
  expect(navigationBox).not.toBeNull();
  expect((navigationBox?.x ?? 0) + (navigationBox?.width ?? 0)).toBeGreaterThanOrEqual(
    (navigationViewport?.width ?? 360) - 2,
  );
  await navigation.getByRole("button", { name: "Close sidebar" }).click();

  await page.goto("/engineers");
  const engineerPhotos = page.locator(
    '[data-vorta-mobile-engineers="true"] [data-vorta-engineer-avatar-image="true"]',
  );
  await expect(engineerPhotos.first()).toBeVisible({ timeout: 30_000 });
  expect(await engineerPhotos.count()).toBeGreaterThan(0);
  await expect(engineerPhotos.first()).toHaveAttribute("src", /^https:\/\//);
  const engineerDescription = page.getByText(
    "Who is available, capable and at risk today.",
    { exact: true },
  );
  expect(await fontSizePixels(engineerDescription), "Mobile typography: body copy").toBeGreaterThanOrEqual(16);

  await page.goto("/skills-matrix");
  const capabilitySummary = page.locator('[data-vorta-mobile-capability-summary="true"]');
  await expect(capabilitySummary).toBeVisible();
  const capabilityHeading = page.getByRole("heading", { name: "Capability Summary" });
  await expect(capabilityHeading).toBeVisible();
  expect(await fontSizePixels(capabilityHeading), "Mobile typography: page heading").toBeGreaterThanOrEqual(24);
  const capabilityDescription = page.getByText(
    "Current workforce coverage, critical gaps and affected assets.",
    { exact: true },
  );
  expect(await fontSizePixels(capabilityDescription), "Mobile typography: secondary copy").toBeGreaterThanOrEqual(16);
  const capabilityScope = page.getByRole("button", {
    name: "Site Maintenance Capability",
    exact: true,
  });
  expect(await fontSizePixels(capabilityScope), "Mobile typography: selector tabs").toBeGreaterThanOrEqual(16);
  const capabilityEyebrow = capabilitySummary.getByText(/capability$/i).first();
  expect(await fontSizePixels(capabilityEyebrow), "Mobile typography: compact labels").toBeGreaterThanOrEqual(12);

  await page.goto("/ai-matching");
  await page.waitForURL(/\/requirements$/);

  await page.goto("/dashboard");
  const plantAreaHeading = page.getByRole("heading", { name: "Plant Area Risk", exact: true });
  expect(await fontSizePixels(plantAreaHeading), "Mobile typography: dashboard section heading").toBeGreaterThanOrEqual(19);
  await sharedLauncher.click();

  const mobileAssistant = page.locator('[data-vorta-global-ai-panel="true"]');
  const closeAssistant = mobileAssistant.getByRole("button", {
    name: "Close global assistant",
    exact: true,
  });
  await expect(mobileAssistant).toBeVisible();
  await expect(closeAssistant).toBeVisible();

  const assistantBox = await mobileAssistant.boundingBox();
  const viewport = page.viewportSize();
  expect(assistantBox).not.toBeNull();
  expect(Math.abs(assistantBox?.x ?? 9999)).toBeLessThanOrEqual(1);
  expect(Math.abs(assistantBox?.y ?? 9999)).toBeLessThanOrEqual(1);
  expect(assistantBox?.width ?? 0).toBeGreaterThanOrEqual((viewport?.width ?? 360) - 2);
  expect(assistantBox?.height ?? 0).toBeGreaterThanOrEqual((viewport?.height ?? 640) - 2);

  const assistantHeaderIcon = mobileAssistant.locator(
    '[data-vorta-global-ai-header="true"] svg',
  ).first();
  await expect(assistantHeaderIcon).toBeVisible();
  const assistantSubtitle = mobileAssistant.getByText(
    "Site risk and action assistant",
    { exact: true },
  );
  await expect(assistantSubtitle).toBeVisible();
  expect(await fontSizePixels(assistantSubtitle), "Mobile typography: assistant subtitle").toBeGreaterThanOrEqual(14);
  const closeAssistantBox = await closeAssistant.boundingBox();
  expect(closeAssistantBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(closeAssistantBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  for (const question of [
    "What should I review first today?",
    "Which area needs attention?",
    "Which equipment is most critical?",
    "What evidence supports this?",
  ]) {
    await expect(
      mobileAssistant.getByRole("button", { name: question, exact: true }),
    ).toBeHidden();
  }

  const introAnswer = mobileAssistant.getByText(
    /I can answer Maintenance Manager questions using Vorta site risk/,
  );
  await expect(introAnswer).toBeVisible();
  const welcomeContent = await introAnswer.evaluate((element) =>
    window.getComputedStyle(element, "::before").content,
  );
  expect(welcomeContent).toBe('"What can I help with?"');
  expect(await pseudoFontSizePixels(introAnswer, "::before"), "Mobile typography: assistant greeting").toBeGreaterThanOrEqual(24);
});
