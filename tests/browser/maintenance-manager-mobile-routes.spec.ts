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
  expect(navigationBox).not.toBeNull();
  expect((navigationBox?.x ?? 0) + (navigationBox?.width ?? 0)).toBeGreaterThanOrEqual(358);
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

  const assistantHeaderIcon = mobileAssistant
    .locator('[data-vorta-global-ai-header="true"] svg')
    .first();
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
  expect(await pseudoFontSizePixels(introAnswer, "::before"), "Mobile typography: assistant welcome").toBeGreaterThanOrEqual(30);
  expect(await pseudoFontSizePixels(introAnswer, "::after"), "Mobile typography: assistant helper").toBeGreaterThanOrEqual(17);

  const promptInput = mobileAssistant.locator('input[type="text"]').last();
  await expect(promptInput).toBeVisible();
  await expect(promptInput).toHaveValue("");
  expect(await fontSizePixels(promptInput), "Mobile typography: composer input").toBeGreaterThanOrEqual(18);
  await promptInput.focus();
  await expect(promptInput).toHaveCSS("outline-width", "0px");
  await expect(promptInput).toHaveCSS("box-shadow", "none");
  await expect(promptInput).toHaveCSS("border-top-width", "0px");

  const attachButton = mobileAssistant.getByRole("button", {
    name: "Add photos and files",
    exact: true,
  });
  const microphoneButton = mobileAssistant.getByRole("button", {
    name: /voice dictation$/,
  });
  const sendButton = mobileAssistant.getByRole("button", {
    name: "Send",
    exact: true,
  });
  await expect(attachButton).toBeVisible();
  await expect(microphoneButton).toBeVisible();
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toHaveCSS("font-size", "0px");

  const attachBox = await attachButton.boundingBox();
  const inputBox = await promptInput.boundingBox();
  const microphoneBox = await microphoneButton.boundingBox();
  const sendButtonBox = await sendButton.boundingBox();
  expect(attachBox?.width ?? 0).toBeGreaterThanOrEqual(40);
  expect(microphoneBox?.width ?? 0).toBeGreaterThanOrEqual(40);
  expect(sendButtonBox?.width ?? 0).toBeGreaterThanOrEqual(40);
  expect(sendButtonBox?.height ?? 0).toBeGreaterThanOrEqual(40);
  expect(attachBox?.x ?? 9999).toBeLessThan(inputBox?.x ?? 0);
  expect(inputBox?.x ?? 9999).toBeLessThan(microphoneBox?.x ?? 0);
  expect(microphoneBox?.x ?? 9999).toBeLessThan(sendButtonBox?.x ?? 0);

  const fileInput = page.locator(
    'input[type="file"][accept*="image/*"]',
  );
  await expect(fileInput).toHaveAttribute("accept", /image\/*/);
  await fileInput.setInputFiles({
    name: "equipment-photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("vorta-photo"),
  });
  await expect(attachButton).toHaveAttribute("data-vorta-ai-attachment-count", "1");

  await closeAssistant.click();
  await expect(mobileAssistant).toBeHidden();

  await page.goto("/equipment");
  const equipmentOverviewButton = page
    .locator('[data-vorta-mobile-equipment="true"] button[aria-label^="Open overview for "]')
    .first();
  await expect(equipmentOverviewButton).toBeVisible({ timeout: 30_000 });
  await equipmentOverviewButton.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);

  await expect(
    page.locator('[data-vorta-equipment-mobile-actions="true"]'),
  ).toHaveCount(0);
  await expect(sharedLauncher).toHaveCount(1);
  const finalAction = page.getByRole("button", { name: /View work and actions/ });
  await expect(finalAction).toBeVisible({ timeout: 30_000 });
  await page
    .locator('[data-vorta-mobile-ai-safe-area="true"]')
    .scrollIntoViewIfNeeded();

  const finalActionBox = await finalAction.boundingBox();
  const launcherBox = await sharedLauncher.boundingBox();
  expect(finalActionBox).not.toBeNull();
  expect(launcherBox).not.toBeNull();
  expect(finalActionBox?.y ?? 9999).toBeLessThan(launcherBox?.y ?? 0);

  const calibrationTab = page.getByRole("tab", {
    name: "Calibrations",
    exact: true,
  });
  await calibrationTab.click();
  await page.waitForURL(/\/equipment\/[^/]+\/pms(?:\?.*)?$/);
  await expect(page.locator('input[placeholder*="calibration risk"]')).toBeHidden();
  await expect(sharedLauncher).toHaveCount(1);
  await expectNoPageOverflow(page);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
  for (const label of ["Light", "Dark", "System"]) {
    const appearanceOption = page.getByRole("button", {
      name: new RegExp(`^${label}`),
    });
    await expect(appearanceOption).toBeVisible();
    const box = await appearanceOption.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await page.goto("/pilot-impact");
  await expect(
    page.getByRole("navigation", { name: "Pilot evidence views" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Impact/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("link", { name: /Adoption/ }).click();
  await page.waitForURL(/\/pilot-adoption$/);
  await expect(page.getByRole("link", { name: /Adoption/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("The 640 to 767 phone range uses the same compact workflows", async ({ page }) => {
  test.skip(test.info().project.name !== "phone-360", "Run the breakpoint bridge once.");
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 700, height: 900 });
  await signInMaintenanceManager(page);

  const mobileTopBar = page.locator('[data-vorta-mobile-topbar="true"]');
  await expect(mobileTopBar).toBeVisible();
  await expect(mobileTopBar).toHaveCSS("display", "grid");

  for (const [path, marker] of [
    ["/skills-matrix", '[data-vorta-mobile-capability-summary="true"]'],
    ["/requirements", '[data-vorta-mobile-requirements="true"]'],
    ["/engineers", '[data-vorta-mobile-engineers="true"]'],
    ["/training", '[data-vorta-mobile-training="true"]'],
    ["/training-providers", '[data-vorta-mobile-training-providers="true"]'],
    ["/settings", '[data-vorta-mobile-settings="true"]'],
  ] as const) {
    await page.goto(path);
    await expect(page.locator(marker)).toBeVisible({ timeout: 30_000 });
    await expectNoPageOverflow(page);
  }

  await page.goto("/skills-matrix");
  const capabilityHeading = page.getByRole("heading", { name: "Capability Summary" });
  expect(await fontSizePixels(capabilityHeading), "Mobile typography at 700px").toBeGreaterThanOrEqual(24);

  await page.goto("/settings/pilot-setup");
  await page.waitForURL(/\/settings$/);
  await page.goto("/settings/data-import");
  await page.waitForURL(/\/settings$/);

  await page.goto("/dashboard");
  await page.locator('[data-vorta-shared-mobile-ai-launcher="true"]').click();
  const assistant = page.locator('[data-vorta-global-ai-panel="true"]');
  const box = await assistant.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(698);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(898);
  const promptInput = assistant.locator('input[type="text"]').last();
  expect(await fontSizePixels(promptInput), "Mobile typography: 700px composer").toBeGreaterThanOrEqual(18);
});
