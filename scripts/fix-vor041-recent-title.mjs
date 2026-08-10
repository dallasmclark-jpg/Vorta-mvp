import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const path = "tests/browser/vor-041-ask-vorta-workspace.spec.ts";
let source = readFileSync(path, "utf8");
const before = `    await expect(workspace).toBeVisible();
    await expect(
      workspace.locator("aside").getByText(question, { exact: true }),
    ).toHaveCount(1);
    await page.getByRole("tab", { name: "Conversation" }).click();`;
const after = `    await expect(workspace).toBeVisible();
    const recentTitle = question.replace(/[?.!]+$/, "");
    await expect(
      workspace.locator("aside").getByText(recentTitle, { exact: true }),
    ).toHaveCount(1);
    await page.getByRole("tab", { name: "Conversation" }).click();`;
assert.equal(source.split(before).length - 1, 1, "Expected one Recent-title assertion block");
source = source.replace(before, after);
writeFileSync(path, source);
console.log("Aligned VOR-041 Recent assertion with generated conversation title.");