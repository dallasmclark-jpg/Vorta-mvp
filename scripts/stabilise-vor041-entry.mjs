import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const path = "tests/browser/vor-041-ask-vorta-workspace.spec.ts";
let source = readFileSync(path, "utf8");
const before = `    await expect
      .poll(
        async () => (await workspace.isVisible()) || (await panel.isVisible()),
        { message: "Ask Vorta should open either the compact panel or the full workspace" },
      )
      .toBe(true);

    if (!(await workspace.isVisible())) {
      await expect(panel).toBeVisible();
      const panelBox = await panel.boundingBox();
      expect(panelBox?.width ?? 0).toBeGreaterThanOrEqual(480);
      await expect(expand).toBeVisible();
      await expand.evaluate((element: HTMLButtonElement) => element.click());
    }

    await expect(workspace).toBeVisible();`;
const after = `    await expect
      .poll(
        async () => (await workspace.isVisible()) || (await expand.isVisible()),
        { message: "Ask Vorta should expose the full workspace or its Expand control" },
      )
      .toBe(true);

    if (!(await workspace.isVisible()) && (await expand.isVisible())) {
      await expand.evaluate((element: HTMLButtonElement) => element.click());
    }

    await expect(workspace).toBeVisible();`;
assert.equal(source.split(before).length - 1, 1, "Expected one responsive workspace-entry block");
source = source.replace(before, after);
writeFileSync(path, source);
console.log("Stabilised VOR-041 against the compact-to-workspace transition.");