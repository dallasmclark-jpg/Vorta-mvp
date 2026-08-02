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

const latencyContractPath = "scripts/ask-vorta-agent-contracts.mjs";
let latencyContract = readFileSync(latencyContractPath, "utf8");
const latencyReplacements = [
  ['agent.includes("MAX_TOOL_ROUNDS = 5")', 'agent.includes("MAX_TOOL_ROUNDS = 8")'],
  [
    'agent.includes(\'const MODEL = "gpt-4.1-mini"\')',
    'agent.includes(\'const MODEL = "gpt-5.6-terra"\') &&\n    agent.includes(\'const PLANNER_MODEL = "gpt-5.6-luna"\')',
  ],
  [
    '!agent.includes("reasoning: { effort:")',
    'agent.includes(\'reasoning: { effort: "low" }\') &&\n    agent.includes(\'reasoning: { effort: "medium" }\')',
  ],
  [
    '!agent.includes(\'verbosity: "low"\')',
    'agent.includes(\'verbosity: "low"\')',
  ],
  [
    'agent.includes("max_output_tokens: 3_000")',
    'agent.includes("max_output_tokens: 5_000")',
  ],
  [
    '"The agent loop, low-latency model, provider storage and response size must remain bounded for serverless latency."',
    '"The planner, reasoning loop, provider storage and response size must remain explicitly bounded for serverless latency."',
  ],
];
for (const [search, replacement] of latencyReplacements) {
  if (!latencyContract.includes(search)) {
    throw new Error(`The Ask Vorta latency contract marker was not found: ${search}`);
  }
  latencyContract = latencyContract.replace(search, replacement);
}
writeFileSync(latencyContractPath, latencyContract);
