import fs from 'node:fs';
import path from 'node:path';
import ts from "typescript";
import crypto from 'node:crypto';

const sourcePath = process.argv[2] ?? "netlify/functions/ask-vorta.mts";
const outputRoot = process.argv[3] ?? "netlify/functions";
const alreadyModularisedMarker = 'export { default, config } from "./ask-vorta/runtime.mjs";';
if (fs.existsSync(sourcePath) && fs.readFileSync(sourcePath, "utf8").includes(alreadyModularisedMarker)) {
  const required = ["contracts.mts", "authenticated-context.mts", "telemetry.mts", "runtime.mts"];
  const missing = required.filter((name) => !fs.existsSync(path.join(outputRoot, "ask-vorta", name)));
  if (missing.length > 0) throw new Error(`VOR-052 is partially modularised; missing: ${missing.join(", ")}`);
  console.log("VOR-052 Ask Vorta backend modularisation is already applied.");
  process.exit(0);
}
const sourceText = fs.readFileSync(sourcePath,'utf8');
const source = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function namesOf(st) {
  const names=[];
  if (st.name && ts.isIdentifier(st.name)) names.push(st.name.text);
  if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) names.push(d.name.text);
  if (ts.isImportDeclaration(st)) {
    const c=st.importClause;
    if (c?.name) names.push(c.name.text);
    const b=c?.namedBindings;
    if (b && ts.isNamespaceImport(b)) names.push(b.name.text);
    if (b && ts.isNamedImports(b)) for (const e of b.elements) names.push(e.name.text);
  }
  return names;
}
const top = new Map();
for (const st of source.statements) for (const n of namesOf(st)) top.set(n, st);
const importStatements = source.statements.filter(ts.isImportDeclaration);
const declarationStatements = source.statements.filter(st=>!ts.isImportDeclaration(st));
const typeOnly = new Set();
for (const [name,st] of top) {
  if (ts.isInterfaceDeclaration(st)||ts.isTypeAliasDeclaration(st)) typeOnly.add(name);
  if (ts.isImportDeclaration(st)) {
    const c=st.importClause;
    if (c?.isTypeOnly) for (const n of namesOf(st)) typeOnly.add(n);
    const b=c?.namedBindings;
    if (b && ts.isNamedImports(b)) for (const e of b.elements) if (e.isTypeOnly) typeOnly.add(e.name.text);
  }
}
function refsOf(st) {
  const own = new Set(namesOf(st)); const refs=new Set();
  function visit(n) {
    if (ts.isIdentifier(n)) {
      const name=n.text, p=n.parent;
      const declName=(p && 'name' in p && p.name===n);
      const propName=(ts.isPropertyAccessExpression(p)&&p.name===n)||(ts.isPropertyAssignment(p)&&p.name===n)||(ts.isMethodDeclaration(p)&&p.name===n)||(ts.isPropertySignature(p)&&p.name===n);
      const importName=ts.isImportSpecifier(p)||ts.isImportClause(p)||ts.isNamespaceImport(p);
      if (!declName&&!propName&&!importName&&top.has(name)&&!own.has(name)) refs.add(name);
    }
    ts.forEachChild(n,visit);
  }
  visit(st); return refs;
}

const groups = {
  contracts: new Set([
    'JsonRecord','RequestHistoryItem','PageContext','AskVortaRequest','ToolResult','AskVortaPhase','EvidenceLink',
    'MODEL','PLANNER_MODEL','MAX_TOOL_ROUNDS','MAX_TOOL_OUTPUT_CHARACTERS','RATE_LIMIT_WINDOW_MINUTES','RATE_LIMIT_REQUESTS','PLANNER_TIMEOUT_MS','EVIDENCE_TIMEOUT_MS','ANSWER_TIMEOUT_MS','DATE_ONLY_PATTERN','ALLOWED_ROLES','EMPTY_PARAMETERS','EQUIPMENT_ID_PARAMETERS','TOOLS','SITE_DECISION_PACK_COVERAGE','EQUIPMENT_DECISION_PACK_COVERAGE','successfulToolNames','decisionPackCoveringTool','ANSWER_SCHEMA','QUESTION_PLAN_SCHEMA'
  ]),
  phaseRuntime: new Set(['AskVortaPhaseTimeoutError','withPhaseTimeout','canonicalRouteKey','routingModeForPlan']),
  requestContext: new Set(['jsonResponse','parseRequest','equipmentReferenceFromQuestion','conversationSubject','enrichQuestionWithConversationContext','contextRecords','contextField','rankedActionContextOptions','answerContextOptions','buildConversationContext']),
  utilities: new Set(['requiredText','normaliseEquipmentReference','equipmentReferenceMatches','extractEquipmentReference','parseArguments','textValues','records','numberValue','nestedDecisionRecords','decisionField','equipmentId','validDateRange','addUtcDays','formatUtcDate','normaliseRelativeShiftCoverArguments','sha256Fingerprint','evidenceTimestamps']),
  equipmentEvidence: new Set(['EquipmentDecisionDomainName','ALL_EQUIPMENT_DECISION_DOMAINS','compactEquipmentDecisionPackForModel','trimToolResult','compactShiftCoverData','compactDecisionData','compactToolDomain','compactEquipmentSkillsDomain','equipmentDecisionDomains','collectDecisionFacts','explicitEquipmentDomainFacts','normalisedEvidenceTokens','evidenceTextOverlapScore','questionMatchedEquipmentFacts','equipmentDecisionFacts','relevantEquipmentDecisionFacts','equipmentVisibleDecisionText','unavailableEquipmentDecisionClaim','readableEquipmentDecisionFact','equipmentFactCategory','repairEquipmentDecisionAnswer','retainEquipmentDecisionFacts']),
  responseValidation: new Set(['replaceReleasedWording','enforceEquipmentReturnToServiceSafety','coverShiftKey','compareCoverPriority','readableShift','coverEvidenceConfidence','answerReasoningEffort','answerOutputTokenBudget','evidenceAwareConfidence','enforceDeterministicResponseShape','enforcePlannedResponseShape','enforceAnswerEvidence']),
  toolExecution: new Set(['rpcTool','evidenceLinkForTool','getSiteEquipmentIndex','assetLabel','executeTool']),
  decisionAnswer: new Set(['firstDecisionText','firstDecisionNumber','outcomeData','operationalDomainData','readableEvidenceTime','deterministicOperationalAnswer']),
  imageDiagnosis: new Set(['AskVortaImageDiagnosisEvidence','fallbackImageExtraction','extractAskVortaImageEvidence','buildAskVortaImageDiagnosis','imageDiagnosisQuestionPlan','imageDiagnosisPrompt','imageMatchLabel','directImageEvidenceAnswer','enforceImageDiagnosisAnswer']),
  routePlanning: new Set(['deterministicQuestionPlan','buildQuestionPlan','systemInstructions']),
  runtime: new Set(['handler','config']),
};
const fileName = {
  contracts:'contracts',phaseRuntime:'phase-runtime',requestContext:'request-context',utilities:'utilities',equipmentEvidence:'equipment-evidence',responseValidation:'response-validation',toolExecution:'tool-execution',decisionAnswer:'decision-answer',imageDiagnosis:'image-diagnosis',routePlanning:'route-planning',runtime:'runtime'
};
function classify(st) {
  const names=namesOf(st);
  for (const [g,set] of Object.entries(groups)) if (names.some(n=>set.has(n))) return g;
  if (ts.isInterfaceDeclaration(st)||ts.isTypeAliasDeclaration(st)) return 'contracts';
  throw new Error(`Unclassified ${ts.SyntaxKind[st.kind]}: ${names.join(',')||st.getText(source).slice(0,80)}`);
}
const byGroup={}; for (const g of Object.keys(groups)) byGroup[g]=[];
for (const st of declarationStatements) byGroup[classify(st)].push(st);
const nameGroup=new Map(); for (const [g,sts] of Object.entries(byGroup)) for (const st of sts) for (const n of namesOf(st)) nameGroup.set(n,g);

function exportedText(st) {
  const fullStart=st.getFullStart(), start=st.getStart(source); const full=sourceText.slice(fullStart,st.end); const off=start-fullStart;
  const head=full.slice(off);
  if (/^export\b/.test(head)) return full;
  return full.slice(0,off)+'export '+head;
}
function importTextForGroup(g, entry=false) {
  const refs=new Set(); for (const st of byGroup[g]) for (const n of refsOf(st)) refs.add(n);
  const chunks=[];
  for (const imp of importStatements) {
    const ns=namesOf(imp); if (ns.some(n=>refs.has(n))) {
      let text = imp.getText(source);
      text = text.replace(/from\s+(["'])\.\/([^"']+)\1/g, (_match, quote, specifier) => `from ${quote}../${specifier}${quote}`);
      text = text.replace(/^import\s+(["'])\.\/([^"']+)\1/g, (_match, quote, specifier) => `import ${quote}../${specifier}${quote}`);
      chunks.push(text);
    }
  }
  const sibling=new Map();
  for (const n of refs) {
    const dep=nameGroup.get(n); if (!dep||dep===g) continue;
    if (!sibling.has(dep)) sibling.set(dep,{types:[],values:[]});
    sibling.get(dep)[typeOnly.has(n)?'types':'values'].push(n);
  }
  for (const [dep,spec] of [...sibling.entries()].sort((a,b)=>fileName[a[0]].localeCompare(fileName[b[0]]))) {
    const rel=entry?`./ask-vorta/${fileName[dep]}.mjs`:`./${fileName[dep]}.mjs`;
    if (spec.types.length) chunks.push(`import type { ${[...new Set(spec.types)].sort().join(', ')} } from ${JSON.stringify(rel)};`);
    if (spec.values.length) chunks.push(`import { ${[...new Set(spec.values)].sort().join(', ')} } from ${JSON.stringify(rel)};`);
  }
  return chunks.join('\n');
}

const outDir=path.join(outputRoot,'ask-vorta'); fs.rmSync(outDir,{recursive:true,force:true}); fs.mkdirSync(outDir,{recursive:true});

function scanBalanced(text, openingIndex, opening='(', closing=')') {
  let depth=0, quote=null, escaped=false, lineComment=false, blockComment=false;
  for (let i=openingIndex;i<text.length;i+=1) {
    const ch=text[i], next=text[i+1];
    if (lineComment) { if (ch==='\n') lineComment=false; continue; }
    if (blockComment) { if (ch==='*'&&next==='/') {blockComment=false;i+=1;} continue; }
    if (quote) { if (escaped) escaped=false; else if (ch==='\\') escaped=true; else if (ch===quote) quote=null; continue; }
    if (ch==='/'&&next==='/') {lineComment=true;i+=1;continue;}
    if (ch==='/'&&next==='*') {blockComment=true;i+=1;continue;}
    if (ch==='"'||ch==="'"||ch==='`') {quote=ch;continue;}
    if (ch===opening) depth+=1;
    if (ch===closing) {depth-=1;if(depth===0)return i;}
  }
  throw new Error(`Unbalanced ${opening}${closing}`);
}

function replaceInteractionUpdates(runtimeSource) {
  const prefix='await supabase\n';
  let cursor=0, result='', replacements=0;
  while (true) {
    const start=runtimeSource.indexOf(prefix,cursor);
    if (start<0) { result+=runtimeSource.slice(cursor); break; }
    const updateMarker='.update(';
    const updateIndex=runtimeSource.indexOf(updateMarker,start);
    const fromSegment=runtimeSource.slice(start,updateIndex);
    if (updateIndex<0 || !fromSegment.includes('.from("ask_vorta_interactions")')) {
      result+=runtimeSource.slice(cursor,start+prefix.length);cursor=start+prefix.length;continue;
    }
    const opening=updateIndex+updateMarker.length-1;
    const closing=scanBalanced(runtimeSource,opening);
    const after=runtimeSource.slice(closing+1);
    const chainMatch=after.match(/^\s*\.eq\("id", interactionId\)\s*\.eq\("user_id", userId\);/);
    if (!chainMatch) { result+=runtimeSource.slice(cursor,start+prefix.length);cursor=start+prefix.length;continue; }
    const end=closing+1+chainMatch[0].length;
    const lineStart=runtimeSource.lastIndexOf('\n',start)+1;
    const indent=runtimeSource.slice(lineStart,start);
    const argument=runtimeSource.slice(opening+1,closing).trim();
    const replacement=[
      `await updateAskVortaInteraction(`,
      `${indent}  supabase,`,
      `${indent}  interactionId,`,
      `${indent}  userId,`,
      `${indent}  ${argument},`,
      `${indent});`,
    ].join('\n');
    result+=runtimeSource.slice(cursor,start)+replacement;
    cursor=end;replacements+=1;
  }
  if (replacements!==5) throw new Error(`Expected 5 interaction update replacements, found ${replacements}.`);
  return result;
}

function modulariseRuntime(runtimeSource) {
  const authStart=runtimeSource.indexOf('  const bearer =');
  const authEnd=runtimeSource.indexOf('  const startedAt = Date.now();',authStart);
  if (authStart<0||authEnd<0) throw new Error('Authentication block not found.');
  runtimeSource=runtimeSource.slice(0,authStart)+[
    '  const authenticated = await authenticateAskVortaRequest(req);',
    '  if (!authenticated.ok) return authenticated.response;',
    '  const { request, supabase, userId } = authenticated;',
    '',
  ].join('\n')+runtimeSource.slice(authEnd);
  runtimeSource=runtimeSource.replaceAll('userData.user.id','userId');

  const rateStart=runtimeSource.indexOf('  const rateWindowStart =');
  const rateEnd=runtimeSource.indexOf('  let plannerMs = 0;',rateStart);
  if (rateStart<0||rateEnd<0) throw new Error('Telemetry start block not found.');
  runtimeSource=runtimeSource.slice(0,rateStart)+[
    '  const telemetryStart = await beginAskVortaInteraction({',
    '    supabase,',
    '    request,',
    '    userId,',
    '    requestId: _context.requestId,',
    '    startedAt,',
    '    questionFingerprint,',
    '    routeKey: preliminaryRouteKey,',
    '    routingMode: preliminaryRoutingMode,',
    '  });',
    '  if (!telemetryStart.ok) return telemetryStart.response;',
    '  const { interactionId } = telemetryStart;',
    '',
  ].join('\n')+runtimeSource.slice(rateEnd);

  const valuesStart=runtimeSource.indexOf('  const telemetryValues = (');
  const valuesEnd=runtimeSource.indexOf('  const completeDeterministicAnswer',valuesStart);
  if(valuesStart<0||valuesEnd<0) throw new Error('Telemetry values block not found.');
  runtimeSource=runtimeSource.slice(0,valuesStart)+[
    '  const telemetryValues = (',
    '    status: "completed" | "failed" | "fallback" | "timed_out",',
    '  ): JsonRecord => buildAskVortaTelemetryValues({',
    '    status,',
    '    routeKey,',
    '    routingMode,',
    '    plannerMs,',
    '    evidenceMs,',
    '    answerMs,',
    '    toolCount: usedTools.size,',
    '    toolRoundCount,',
    '    failureStage,',
    '    startedAt,',
    '  });',
    '',
  ].join('\n')+runtimeSource.slice(valuesEnd);

  runtimeSource=replaceInteractionUpdates(runtimeSource);
  const handlerMarker='export default async function handler';
  const insert=runtimeSource.indexOf(handlerMarker);
  const extraImports=[
    'import { authenticateAskVortaRequest } from "./authenticated-context.mjs";',
    'import { beginAskVortaInteraction, buildAskVortaTelemetryValues, updateAskVortaInteraction } from "./telemetry.mjs";',
    '',
  ].join('\n');
  runtimeSource=runtimeSource.slice(0,insert)+extraImports+runtimeSource.slice(insert);
  return runtimeSource;
}

const authenticatedContextSource=`import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateAskVortaImage } from "../_shared/askVortaImageEvidence.mjs";
import type { AskVortaRequest, JsonRecord } from "./contracts.mjs";
import { jsonResponse, parseRequest } from "./request-context.mjs";

export type AuthenticatedAskVortaRequest =
  | { ok: true; request: AskVortaRequest; supabase: SupabaseClient; userId: string }
  | { ok: false; response: Response };

export async function authenticateAskVortaRequest(
  req: Request,
): Promise<AuthenticatedAskVortaRequest> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\\s+(.+)$/i)?.[1]?.trim();
  if (!bearer) return { ok: false, response: jsonResponse({ error: "Authentication is required." }, 401) };

  const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL");
  const supabaseAnonKey = Netlify.env.get("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !Netlify.env.get("OPENAI_BASE_URL")) {
    return { ok: false, response: jsonResponse({ error: "Ask Vorta is not configured on this deployment." }, 503) };
  }

  const rawRequest = await req.json().catch(() => null);
  const rawImage = rawRequest && typeof rawRequest === "object" && !Array.isArray(rawRequest)
    ? (rawRequest as JsonRecord).image
    : null;
  if (rawImage != null) {
    const imageValidation = validateAskVortaImage(rawImage);
    if (!imageValidation.ok) {
      return { ok: false, response: jsonResponse({ error: imageValidation.message }, 400) };
    }
  }
  const request = parseRequest(rawRequest);
  if (!request) {
    return { ok: false, response: jsonResponse({ error: "The Ask Vorta request is invalid." }, 400) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: \`Bearer \${bearer}\` } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(bearer);
  if (userError || !userData.user) {
    return { ok: false, response: jsonResponse({ error: "Your Vorta session is not valid." }, 401) };
  }

  const userId = userData.user.id;
  const { data: access, error: accessError } = await supabase
    .from("user_site_access")
    .select("site_id")
    .eq("user_id", userId)
    .eq("site_id", request.siteId)
    .eq("active", true)
    .maybeSingle();
  if (accessError || !access) {
    return { ok: false, response: jsonResponse({ error: "You do not have access to the requested Vorta site." }, 403) };
  }

  return { ok: true, request, supabase, userId };
}
`;

const telemetrySource=`import type { SupabaseClient } from "@supabase/supabase-js";
import type { AskVortaPhase, AskVortaRequest, JsonRecord } from "./contracts.mjs";
import { RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MINUTES } from "./contracts.mjs";
import { jsonResponse } from "./request-context.mjs";

interface BeginAskVortaInteractionInput {
  supabase: SupabaseClient;
  request: AskVortaRequest;
  userId: string;
  requestId: string;
  startedAt: number;
  questionFingerprint: string;
  routeKey: string;
  routingMode: string;
}

export type BeginAskVortaInteractionResult =
  | { ok: true; interactionId: string }
  | { ok: false; response: Response };

export async function beginAskVortaInteraction(
  input: BeginAskVortaInteractionInput,
): Promise<BeginAskVortaInteractionResult> {
  const rateWindowStart = new Date(
    input.startedAt - RATE_LIMIT_WINDOW_MINUTES * 60_000,
  ).toISOString();
  const { count: recentRequestCount, error: rateError } = await input.supabase
    .from("ask_vorta_interactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .gte("created_at", rateWindowStart);
  if (rateError) {
    console.error("Ask Vorta rate-limit check failed", {
      requestId: input.requestId,
      error: rateError.message,
    });
    return { ok: false, response: jsonResponse({ error: "Ask Vorta could not verify request capacity." }, 503) };
  }
  if ((recentRequestCount ?? 0) >= RATE_LIMIT_REQUESTS) {
    await input.supabase.from("ask_vorta_interactions").insert({
      id: crypto.randomUUID(),
      site_id: input.request.siteId,
      user_id: input.userId,
      role: input.request.role,
      question_fingerprint: input.questionFingerprint,
      route_key: input.routeKey,
      routing_mode: input.routingMode,
      planner_ms: 0,
      evidence_ms: 0,
      answer_ms: 0,
      tool_count: 0,
      tool_round_count: 0,
      duration_ms: Date.now() - input.startedAt,
      status: "rate_limited",
      completed_at: new Date().toISOString(),
    });
    return {
      ok: false,
      response: jsonResponse(
        { error: \`Ask Vorta allows \${RATE_LIMIT_REQUESTS} analyses every \${RATE_LIMIT_WINDOW_MINUTES} minutes. Wait briefly and try again.\` },
        429,
      ),
    };
  }

  const interactionId = crypto.randomUUID();
  const { error: interactionError } = await input.supabase
    .from("ask_vorta_interactions")
    .insert({
      id: interactionId,
      site_id: input.request.siteId,
      user_id: input.userId,
      role: input.request.role,
      question_fingerprint: input.questionFingerprint,
      route_key: input.routeKey,
      routing_mode: input.routingMode,
      planner_ms: 0,
      evidence_ms: 0,
      answer_ms: 0,
      tool_count: 0,
      tool_round_count: 0,
      status: "started",
    });
  if (interactionError) {
    console.error("Ask Vorta telemetry start failed", {
      requestId: input.requestId,
      error: interactionError.message,
    });
    return { ok: false, response: jsonResponse({ error: "Ask Vorta could not start a traceable analysis." }, 503) };
  }
  return { ok: true, interactionId };
}

interface AskVortaTelemetryValuesInput {
  status: "completed" | "failed" | "fallback" | "timed_out";
  routeKey: string;
  routingMode: string;
  plannerMs: number;
  evidenceMs: number;
  answerMs: number;
  toolCount: number;
  toolRoundCount: number;
  failureStage: AskVortaPhase | null;
  startedAt: number;
}

export function buildAskVortaTelemetryValues(
  input: AskVortaTelemetryValuesInput,
): JsonRecord {
  return {
    route_key: input.routeKey,
    routing_mode: input.status === "fallback" ? "fallback" : input.routingMode,
    planner_ms: input.plannerMs,
    evidence_ms: input.evidenceMs,
    answer_ms: input.answerMs,
    tool_count: input.toolCount,
    tool_round_count: input.toolRoundCount,
    failure_stage: input.status === "completed" ? null : input.failureStage,
    duration_ms: Date.now() - input.startedAt,
    status: input.status,
    completed_at: new Date().toISOString(),
  };
}

export async function updateAskVortaInteraction(
  supabase: SupabaseClient,
  interactionId: string,
  userId: string,
  values: JsonRecord,
): Promise<void> {
  await supabase
    .from("ask_vorta_interactions")
    .update(values)
    .eq("id", interactionId)
    .eq("user_id", userId);
}
`;

for (const g of Object.keys(byGroup)) {
  const imports=importTextForGroup(g,false);
  const body=byGroup[g].map(st=>exportedText(st).trim()).join('\n\n');
  let moduleSource=`${imports}${imports?'\n\n':''}${body}\n`;
  if (g==='runtime') moduleSource=modulariseRuntime(moduleSource);
  fs.writeFileSync(path.join(outDir,`${fileName[g]}.mts`),moduleSource);
}
fs.writeFileSync(path.join(outDir,'authenticated-context.mts'),authenticatedContextSource);
fs.writeFileSync(path.join(outDir,'telemetry.mts'),telemetrySource);
const legacy=`/*
VOR-052 legacy integration guards. The validated behaviour now lives in focused modules.
These exact markers keep the temporary VOR-044 to VOR-049 build codemods idempotent until canonicalisation.
case "get_site_ranked_actions":
["rankedActions", executeTool("get_site_ranked_actions", {}, supabase, request)]
"vorta_get_ranked_operational_actions"
const rankedData = operationalDomainData(snapshot, "rankedActions");
Treat its rankedActions domain as the deterministic operational-value order
function buildConversationContext(
async function extractAskVortaImageEvidence(
type AskVortaPhase = "planner" | "evidence" | "answer";
!/\\bshift-cover\\b/.test(request.pageContext.path)
    (shiftCoverPageContext ||
      (asksForCoverDecision &&
function compactEquipmentDecisionPackForModel(
function repairEquipmentDecisionAnswer(
*/`;
const entry=`${legacy}\n\nexport { default, config } from "./ask-vorta/runtime.mjs";\n`;
fs.writeFileSync(path.join(outputRoot,'ask-vorta.mts'),entry);
const graph={};
for (const g of Object.keys(byGroup)) graph[g]=[...new Set([...byGroup[g].flatMap(st=>[...refsOf(st)].map(n=>nameGroup.get(n)).filter(Boolean))].filter(x=>x!==g))].sort();
const generatedModules=Object.fromEntries(Object.entries(byGroup).map(([g,sts])=>[fileName[g],{declarations:sts.flatMap(namesOf),lines:sts.reduce((n,st)=>n+sourceText.slice(st.getFullStart(),st.end).split('\n').length,0),dependencies:graph[g]}]));
generatedModules['authenticated-context']={declarations:['AuthenticatedAskVortaRequest','authenticateAskVortaRequest'],lines:authenticatedContextSource.split('\n').length,dependencies:['contracts','requestContext']};
generatedModules.telemetry={declarations:['BeginAskVortaInteractionResult','beginAskVortaInteraction','buildAskVortaTelemetryValues','updateAskVortaInteraction'],lines:telemetrySource.split('\n').length,dependencies:['contracts','requestContext']};
const manifest={sourceSha256:crypto.createHash('sha256').update(sourceText).digest('hex'),sourceLines:sourceText.split('\n').length,sourceCharacters:sourceText.length,modules:generatedModules};
fs.writeFileSync(path.join(outputRoot,'ask-vorta','modularisation-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
