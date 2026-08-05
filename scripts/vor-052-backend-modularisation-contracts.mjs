import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionRoot = path.join(repositoryRoot, "netlify/functions");
const moduleRoot = path.join(functionRoot, "ask-vorta");
const entryPath = path.join(functionRoot, "ask-vorta.mts");
const expectedMaterialisedSha = "156b0aa82fa7d1db316e17d3aafa47c31a50acfbb6dd74376e91361df49a7bc7";
const requiredModules = [
  "authenticated-context.mts",
  "contracts.mts",
  "decision-answer.mts",
  "equipment-evidence.mts",
  "image-diagnosis.mts",
  "phase-runtime.mts",
  "request-context.mts",
  "response-validation.mts",
  "route-planning.mts",
  "runtime.mts",
  "telemetry.mts",
  "tool-execution.mts",
  "utilities.mts",
];

function fail(message) {
  console.error(`VOR-052 contract failed: ${message}`);
  process.exit(1);
}
function read(file) {
  if (!fs.existsSync(file)) fail(`missing ${path.relative(repositoryRoot, file)}`);
  return fs.readFileSync(file, "utf8");
}
function requireText(source, text, label) {
  if (!source.includes(text)) fail(`${label} is missing ${JSON.stringify(text)}`);
}

const entry = read(entryPath);
if (entry.split("\n").length > 40) fail("Ask Vorta endpoint entrypoint exceeds 40 lines");
requireText(entry, 'import handler from "./ask-vorta/runtime.mjs";', "endpoint handler delegation");
requireText(entry, "export default handler;", "endpoint handler delegation");
if (!/export const config: Config = \{[\s\S]*?path: "\/api\/ask-vorta",[\s\S]*?method: "POST",[\s\S]*?\};/.test(entry)) {
  fail("deployable endpoint config must be exported directly from netlify/functions/ask-vorta.mts");
}
if (/legacy integration guards|case "get_site_ranked_actions":/.test(entry)) {
  fail("the deployable entrypoint still contains retired integration guards");
}

for (const moduleName of requiredModules) read(path.join(moduleRoot, moduleName));
const manifest = JSON.parse(read(path.join(moduleRoot, "modularisation-manifest.json")));
if (manifest.sourceSha256 !== expectedMaterialisedSha) {
  fail(`materialised VOR-051 behaviour digest changed: ${manifest.sourceSha256}`);
}
if (manifest.sourceLines !== 5992 || manifest.sourceCharacters !== 241227) {
  fail(`unexpected materialised source dimensions ${manifest.sourceLines}/${manifest.sourceCharacters}`);
}

const runtime = read(path.join(moduleRoot, "runtime.mts"));
if (runtime.split("\n").length > 750) fail("runtime module exceeds 750 lines");
requireText(runtime, 'path: "/api/ask-vorta"', "runtime endpoint compatibility config");
requireText(runtime, 'method: "POST"', "runtime endpoint compatibility config");
requireText(runtime, "authenticateAskVortaRequest(req)", "runtime authentication boundary");
requireText(runtime, "beginAskVortaInteraction({", "runtime telemetry boundary");
requireText(runtime, "updateAskVortaInteraction(", "runtime telemetry boundary");

const authentication = read(path.join(moduleRoot, "authenticated-context.mts"));
for (const marker of [
  "supabase.auth.getUser(bearer)",
  '.from("user_site_access")',
  '.eq("user_id", userId)',
  '.eq("site_id", request.siteId)',
  '.eq("active", true)',
]) requireText(authentication, marker, "authenticated site context");
if (/\.eq\(\s*["']role["']\s*,\s*request\.role/.test(authentication)) {
  fail("client-supplied role is used as an authorisation predicate");
}

const telemetry = read(path.join(moduleRoot, "telemetry.mts"));
for (const marker of [
  '.from("ask_vorta_interactions")',
  "RATE_LIMIT_REQUESTS",
  "question_fingerprint",
  "route_key",
  "planner_ms",
  "evidence_ms",
  "answer_ms",
]) requireText(telemetry, marker, "telemetry module");

const moduleFiles = requiredModules.map((name) => ({
  name,
  source: read(path.join(moduleRoot, name)),
}));
const toolsRegistryCount = moduleFiles.reduce(
  (count, file) => count + (file.source.match(/\bconst\s+TOOLS\s*:/g)?.length ?? 0),
  0,
);
if (toolsRegistryCount !== 1) fail(`expected one TOOLS registry, found ${toolsRegistryCount}`);

const forbiddenBackendActions = [
  "vorta_save_shift_handover_action",
  "vorta_create_ask_vorta_action_draft",
  "vorta_confirm_ask_vorta_action_draft",
  "create_maintenance_notification",
  "create_maintenance_work_request",
];
for (const { name, source } of moduleFiles) {
  for (const forbidden of forbiddenBackendActions) {
    if (source.includes(forbidden)) fail(`${name} crosses the confirmed-action/SAP boundary with ${forbidden}`);
  }
}
const controlledActions = read(path.join(repositoryRoot, "src/screens/AiOperations/askVortaControlledActions.ts"));
requireText(controlledActions, "handover_note", "confirmed handover action boundary");
requireText(controlledActions, "ask_vorta_action", "confirmed handover action boundary");

const graph = new Map(requiredModules.map((name) => [name, []]));
for (const { name, source } of moduleFiles) {
  for (const match of source.matchAll(/from\s+["']\.\/([^"']+)\.mjs["']/g)) {
    const dependency = `${match[1]}.mts`;
    if (graph.has(dependency)) graph.get(name).push(dependency);
  }
}
const visiting = new Set();
const visited = new Set();
function visit(name, trail = []) {
  if (visiting.has(name)) fail(`circular module dependency: ${[...trail, name].join(" -> ")}`);
  if (visited.has(name)) return;
  visiting.add(name);
  for (const dependency of graph.get(name) ?? []) visit(dependency, [...trail, name]);
  visiting.delete(name);
  visited.add(name);
}
for (const name of graph.keys()) visit(name);

const contracts = read(path.join(moduleRoot, "contracts.mts"));
requireText(contracts, "export const TOOLS", "tool registry");
requireText(contracts, "export const ANSWER_SCHEMA", "response contract");
requireText(contracts, "export const QUESTION_PLAN_SCHEMA", "planner contract");

console.log(
  `VOR-052 backend modularisation contracts passed: ${requiredModules.length} focused modules, one tool registry, acyclic imports, deployable endpoint config, authenticated site isolation, telemetry separation and unchanged API/action boundaries.`,
);