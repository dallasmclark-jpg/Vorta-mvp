import { existsSync, readFileSync, writeFileSync } from "node:fs";

const sourcePath = "netlify/functions/ask-vorta.mts";
const source = readFileSync(sourcePath, "utf8");

if (source.includes('const MODEL = "gpt-5.6-terra"')) {
  console.log("VOR-038 intelligence source is already applied in this worktree.");
  process.exit(0);
}

const patchPath = "scripts/apply-vor-038-intelligence.mjs";
if (!existsSync(patchPath)) {
  throw new Error("VOR-038 source is not patched and the patch module is missing.");
}

let patchSource = readFileSync(patchPath, "utf8");
patchSource = patchSource.replace(
  'for (const [passed, label] of checks) console.log(`${passed ? "PASS" : "FAIL"} - ${label}`);',
  'for (const [passed, label] of checks) {\n  console.log((passed ? "PASS" : "FAIL") + " - " + label);\n}',
);
patchSource = patchSource.replace(
  'console.log(`VOR-038 Ask Vorta intelligence contract passed: ${checks.length}/${checks.length}.`);',
  'console.log("VOR-038 Ask Vorta intelligence contract passed: " + checks.length + "/" + checks.length + ".");',
);
writeFileSync(patchPath, patchSource);

await import("./apply-vor-038-intelligence.mjs");

let generatedSource = readFileSync(sourcePath, "utf8");
const untypedDomains = `      const domainEntries = await Promise.all([
        ["siteRisk", executeTool("get_site_risk", {}, supabase, request)],
        ["workBacklog", executeTool("get_site_work_backlog", {}, supabase, request)],
        ["sparesRisk", executeTool("get_site_spares_risk", {}, supabase, request)],
        ["capability", executeTool("get_site_capability_actions", {}, supabase, request)],
        ["shiftHandover", executeTool("get_shift_handover", {}, supabase, request)],
      ].map(async ([key, pending]) => [key, compactToolDomain(await pending)] as const));`;
const typedDomains = `      const domainDefinitions: Array<[string, Promise<ToolResult>]> = [
        ["siteRisk", executeTool("get_site_risk", {}, supabase, request)],
        ["workBacklog", executeTool("get_site_work_backlog", {}, supabase, request)],
        ["sparesRisk", executeTool("get_site_spares_risk", {}, supabase, request)],
        ["capability", executeTool("get_site_capability_actions", {}, supabase, request)],
        ["shiftHandover", executeTool("get_shift_handover", {}, supabase, request)],
      ];
      const domainEntries = await Promise.all(
        domainDefinitions.map(async ([key, pending]) => [
          key,
          compactToolDomain(await pending),
        ] as const),
      );`;
if (!generatedSource.includes(untypedDomains)) {
  throw new Error("The VOR-038 site decision-pack typing marker was not found.");
}
generatedSource = generatedSource.replace(untypedDomains, typedDomains);
writeFileSync(sourcePath, generatedSource);
