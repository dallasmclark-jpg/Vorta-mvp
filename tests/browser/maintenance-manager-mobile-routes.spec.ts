import { expect, test } from "@playwright/test";
import {
  expectNoPageOverflow,
  signInMaintenanceManager,
} from "./maintenance-manager-test-helpers";

const mobileRoutes = [
  ["/dashboard", "Dashboard"],
  ["/equipment", "Equipment"],
  ["/skills-matrix", "Skills Matrix"],
  ["/engineers", "Engineers"],
  ["/requirements", "Requirements"],
  ["/training", "Training"],
  ["/training-providers", "Training Providers"],
  ["/ai-matching", "Capability Matching"],
  ["/career", "Workforce Development"],
  ["/pilot-impact", "Pilot Evidence"],
  ["/pilot-adoption", "Pilot Evidence"],
  ["/support", "Support"],
  ["/settings", "Settings"],
] as const;

test("Maintenance Manager mobile routes retain one shell and one Ask Vorta entry", async ({
  page,
}) => {
  test.setTimeout(210_000);
  const viewportWidth = page.viewportSize()?.width ?? 1366;
  test.skip(viewportWidth >= 640, "Phone-only route matrix.");

  await signInMaintenanceManager(page);

  const mobileTopBar = page.locator(
    '[data-vorta-portal-shell="true"] > section > div.md\\:hidden',
  );
  const mobileLogo = mobileTopBar.locator(":scope > :not(button)").first();
  const mobileMenu = mobileTopBar.getByRole("button", { name: "Open menu" });
  const sharedLauncher = page.locator(
    '[data-vorta-shared-mobile-ai-launcher="true"]',
  );

  for (const [path, label] of mobileRoutes) {
    await page.goto(path);
    await expect(mobileTopBar).toHaveAttribute("data-vorta-mobile-page-title", label);
    await expect(mobileTopBar).toHaveCSS("display", "grid");
    await expect(mobileLogo).toBeVisible();
    await expect(mobileMenu).toBeVisible();

    const logoBox = await mobileLogo.boundingBox();
    const menuBox = await mobileMenu.boundingBox();
    expect(logoBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(logoBox?.x ?? 9999).toBeLessThan(menuBox?.x ?? 0);

    await expect(sharedLauncher).toHaveCount(1);
    await expect(sharedLauncher).toBeVisible();
    await expect(sharedLauncher).toHaveAccessibleName("Ask Vorta");
    await expectNoPageOverflow(page);
  }

  await page.goto("/dashboard");
  await sharedLauncher.click();

  const mobileAssistant = page.locator(
    '[data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])',
  );
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
    ":scope > div:first-child > div:first-child > div:first-child svg",
  );
  await expect(assistantHeaderIcon).toBeVisible();
  await expect(
    mobileAssistant.getByText("Site risk and action assistant", { exact: true }),
  ).toBeVisible();
  const closeAssistantBox = await closeAssistant.boundingBox();
  expect(closeAssistantBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(closeAssistantBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  for (const question of [
    "What should I review first today?",
    "Which area needs attention?",
    "Which equipment is most critical?",
    "What evidence supports this?",
  ]) {
    await expect(mobileAssistant.getByRole("button", { name: question, exact: true })).toBeHidden();
  }

  const introAnswer = mobileAssistant.getByText(
    /I can answer Maintenance Manager questions using Vorta site risk/,
  );
  await expect(introAnswer).toBeVisible();
  const welcomeContent = await introAnswer.evaluate((element) =>
    window.getComputedStyle(element, "::before").content,
  );
  expect(welcomeContent).toBe('"What can I help with?"');

  const promptInput = mobileAssistant.locator('input[type="text"]').last();
  await expect(promptInput).toBeVisible();
  await expect(promptInput).toHaveValue("");
  await promptInput.focus();
  await expect(promptInput).toHaveCSS("outline-width", "0px");
  await expect(promptInput).toHaveCSS("box-shadow", "none");
  await expect(promptInput).toHaveCSS("border-top-width", "0px");

  const attachmentButton = mobileAssistant.getByRole("button", {
    name: "Add photos and files",
    exact: true,
  });
  const microphoneButton = mobileAssistant.getByRole("button", {
    name: /voice dictation/,
  });
  const sendButton = mobileAssistant.getByRole("button", { name: "Send", exact: true });
  await expect(attachmentButton).toBeVisible();
  await expect(microphoneButton).toBeVisible();
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toHaveCSS("font-size", "0px");

  const attachmentInput = page.locator('input[type="file"][accept*="image/*"]');
  await expect(attachmentInput).toHaveCount(1);
  await attachmentInput.setInputFiles({
    name: "equipment-evidence.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await expect(attachmentButton).toHaveAttribute("data-vorta-ai-attachment-count", "1");

  const attachmentBox = await attachmentButton.boundingBox();
  const inputBox = await promptInput.boundingBox();
  const microphoneBox = await microphoneButton.boundingBox();
  const sendButtonBox = await sendButton.boundingBox();
  expect(attachmentBox).not.toBeNull();
  expect(inputBox).not.toBeNull();
  expect(microphoneBox).not.toBeNull();
  expect(sendButtonBox).not.toBeNull();
  expect(attachmentBox?.x ?? 9999).toBeLessThan(inputBox?.x ?? 0);
  expect(inputBox?.x ?? 9999).toBeLessThan(microphoneBox?.x ?? 0);
  expect(microphoneBox?.x ?? 9999).toBeLessThan(sendButtonBox?.x ?? 0);
  expect(sendButtonBox?.width ?? 0).toBeGreaterThanOrEqual(40);
  expect(sendButtonBox?.height ?? 0).toBeGreaterThanOrEqual(40);

  await closeAssistant.click();
  await expect(mobileAssistant).toBeHidden();

  await page.goto("/equipment");
  const equipmentButton = page
    .locator('[data-vorta-mobile-equipment="true"] button')
    .filter({ hasText: "Open" })
    .first();
  await expect(equipmentButton).toBeVisible({ timeout: 30_000 });
  await equipmentButton.click();
  await page.waitForURL(/\/equipment\/[^/]+\/overview(?:\?.*)?$/);

  await expect(page.locator('[data-vorta-equipment-mobile-actions="true"]')).toHaveCount(0);
  await expect(sharedLauncher).toHaveCount(1);
  const finalAction = page.getByRole("button", { name: /View work and actions/ });
  await expect(finalAction).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-vorta-mobile-ai-safe-area="true"]').scrollIntoViewIfNeeded();

  const finalActionBox = await finalAction.boundingBox();
  const launcherBox = await sharedLauncher.boundingBox();
  expect(finalActionBox).not.toBeNull();
  expect(launcherBox).not.toBeNull();
  expect(finalActionBox?.y ?? 9999).toBeLessThan(launcherBox?.y ?? 0);

  const calibrationTab = page.getByRole("tab", { name: "Calibrations", exact: true });
  await calibrationTab.click();
  await page.waitForURL(/\/equipment\/[^/]+\/pms(?:\?.*)?$/);
  await expect(page.locator('input[placeholder*="calibration risk"]')).toBeHidden();
  await expect(sharedLauncher).toHaveCount(1);
  await expectNoPageOverflow(page);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Appearance", exact: true })).toBeVisible();
  for (const label of ["Light", "Dark", "System"]) {
    const appearanceOption = page.getByRole("button", { name: new RegExp(`^${label}`) });
    await expect(appearanceOption).toBeVisible();
    const box = await appearanceOption.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await page.goto("/pilot-impact");
  await expect(page.getByRole("navigation", { name: "Pilot evidence views" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Impact/ })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: /Adoption/ }).click();
  await page.waitForURL(/\/pilot-adoption$/);
  await expect(page.getByRole("link", { name: /Adoption/ })).toHaveAttribute("aria-current", "page");
});
