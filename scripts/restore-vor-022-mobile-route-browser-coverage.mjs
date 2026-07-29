import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const path = "tests/browser/maintenance-manager-mobile-routes.spec.ts";
let source = execFileSync(
  "git",
  [
    "show",
    "b8f96a1f17ce5b9eda857a06b78a1297c0730900:tests/browser/maintenance-manager-mobile-routes.spec.ts",
  ],
  { encoding: "utf8" },
);

function replaceOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing VOR-022 browser patch target: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`Ambiguous VOR-022 browser patch target: ${label}`);
  }
  source = `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}

source = source
  .replace('["/skills-matrix", "Skills Matrix"]', '["/skills-matrix", "Capability"]')
  .replace('["/career", "Workforce Development"]', '["/career", "Development"]');

replaceOnce(
  `  const mobileTopBar = page.locator(\n    '[data-vorta-portal-shell="true"] > section > div.md\\\\:hidden',\n  );\n  const mobileLogo = mobileTopBar.locator(":scope > :not(button)").first();\n  const mobileMenu = mobileTopBar.getByRole("button", { name: "Open menu" });`,
  `  const mobileTopBar = page.locator('[data-vorta-mobile-topbar="true"]');\n  const mobileLogo = mobileTopBar.locator(\n    '[data-vorta-mobile-topbar-home="true"]',\n  );\n  const mobileTitle = mobileTopBar.locator(\n    '[data-vorta-mobile-header-title="true"]',\n  );\n  const mobileMenu = mobileTopBar.getByRole("button", { name: "Open menu" });`,
  "primary mobile topbar locator",
);

replaceOnce(
  `    await expect(mobileTopBar).toHaveAttribute("data-vorta-mobile-page-title", label);\n    await expect(mobileTopBar).toHaveCSS("display", "flex");\n    await expect(mobileLogo).toBeVisible();\n    await expect(mobileMenu).toBeVisible();\n\n    const logoBox = await mobileLogo.boundingBox();\n    const menuBox = await mobileMenu.boundingBox();\n    expect(logoBox).not.toBeNull();\n    expect(menuBox).not.toBeNull();\n    expect(logoBox?.x ?? 9999).toBeLessThan(menuBox?.x ?? 0);`,
  `    await expect(mobileTopBar).toHaveCSS("display", "grid");\n    await expect(mobileTitle).toHaveText(label);\n    await expect(mobileLogo).toBeVisible();\n    await expect(mobileMenu).toBeVisible();\n\n    const logoBox = await mobileLogo.boundingBox();\n    const titleBox = await mobileTitle.boundingBox();\n    const menuBox = await mobileMenu.boundingBox();\n    expect(logoBox).not.toBeNull();\n    expect(titleBox).not.toBeNull();\n    expect(menuBox).not.toBeNull();\n    expect(logoBox?.x ?? 9999).toBeLessThan(titleBox?.x ?? 0);\n    expect(titleBox?.x ?? 9999).toBeLessThan(menuBox?.x ?? 0);`,
  "primary mobile topbar assertions",
);

source = source
  .replace(
    'await expect(navigation.getByRole("link", { name: "Pilot Setup" })).toBeHidden();',
    'await expect(navigation.getByRole("link", { name: "Pilot Setup" })).toHaveCount(0);',
  )
  .replace(
    'await expect(navigation.getByRole("link", { name: "Data Import" })).toBeHidden();',
    'await expect(navigation.getByRole("link", { name: "Data Import" })).toHaveCount(0);',
  );

source = source.replaceAll(
  `page.locator(\n    '[data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])',\n  )`,
  `page.locator('[data-vorta-global-ai-panel="true"]')`,
);

replaceOnce(
  `  const assistantHeaderIcon = mobileAssistant.locator(\n    ":scope > div:first-child > div:first-child > div:first-child svg",\n  );`,
  `  const assistantHeaderIcon = mobileAssistant\n    .locator('[data-vorta-global-ai-header="true"] svg')\n    .first();`,
  "assistant header icon locator",
);

replaceOnce(
  `  const mobileTopBar = page.locator(\n    '[data-vorta-portal-shell="true"] > section > div.md\\\\:hidden',\n  );\n  await expect(mobileTopBar).toBeVisible();\n  await expect(mobileTopBar).toHaveCSS("display", "flex");`,
  `  const mobileTopBar = page.locator('[data-vorta-mobile-topbar="true"]');\n  await expect(mobileTopBar).toBeVisible();\n  await expect(mobileTopBar).toHaveCSS("display", "grid");`,
  "700px mobile topbar assertions",
);

if (!source.includes("Add photos and files") || !source.includes("The 640 to 767 phone range")) {
  throw new Error("VOR-022 full mobile browser coverage was not restored");
}
if (source.includes(":has(button[aria-label=\"Close global assistant\"])")) {
  throw new Error("VOR-022 browser suite still uses structural AI panel selection");
}

writeFileSync(path, source, "utf8");
console.log("Restored full semantic mobile route browser coverage.");
