import { readFileSync, writeFileSync } from "node:fs";

const path = "scripts/mobile-portal-audit-contracts.mjs";
const source = readFileSync(path, "utf8");
const search = `    browserTest.includes('toHaveCSS("font-size", "0px")') &&`;
const replacement = `    browserTest.includes('data-vorta-global-ai-send') &&\n    browserTest.includes('toHaveAccessibleName("Send")') &&\n    browserTest.includes('toHaveClass(/sr-only/)') &&\n    browserTest.includes('sendButton.locator("svg")') &&`;
const count = source.split(search).length - 1;
if (count !== 1) throw new Error(`expected one stale Send contract, found ${count}`);
writeFileSync(path, source.replace(search, replacement), "utf8");
console.log("VOR-022 mobile portal audit contract updated.");
