import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const path = "tests/browser/vor-041-ask-vorta-workspace.spec.ts";
let source = readFileSync(path, "utf8");
const before = `    await expect(expand).toBeVisible();
    await expand.evaluate((element: HTMLButtonElement) => element.click());
    await expect(workspace).toBeVisible();
    await expect(
      workspace.getByText(question, { exact: true }).last(),
    ).toBeVisible();
    await expect(
      workspace.locator("aside").getByText(question, { exact: true }),
    ).toHaveCount(1);`;
const after = `    await expect(expand).toBeVisible();
    await expand.evaluate((element: HTMLButtonElement) => element.click());
    await expect(workspace).toBeVisible();
    await expect(
      workspace.locator("aside").getByText(question, { exact: true }),
    ).toHaveCount(1);
    await page.getByRole("tab", { name: "Conversation" }).click();
    await expect(
      workspace.getByText(question, { exact: true }).last(),
    ).toBeVisible();`;
assert.equal(source.split(before).length - 1, 1, "Expected one workspace reopen assertion block");
source = source.replace(before, after);
writeFileSync(path, source);
console.log("Aligned VOR-041 reopen assertion with the persisted active tab.");