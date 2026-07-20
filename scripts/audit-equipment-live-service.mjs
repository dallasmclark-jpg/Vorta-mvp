import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import ts from "typescript";

const targets = [
  "src/screens/Equipment/EquipmentLiveEvidenceViews.tsx",
  "src/screens/Equipment/equipmentService.ts",
  "src/screens/Equipment/EquipmentPilotEvidenceShared.tsx",
];

const read = (path) => readFileSync(path, "utf8");
const lineAt = (sourceFile, position) => sourceFile.getLineAndCharacterOfPosition(position).line + 1;
const nodeName = (node) => {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map((declaration) => (ts.isIdentifier(declaration.name) ? declaration.name.text : "<destructured>"))
      .join(", ");
  }
  return "<anonymous>";
};
const isExported = (node) => Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
const kindName = (node) => {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isVariableStatement(node)) return "variable";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isEnumDeclaration(node)) return "enum";
  return ts.SyntaxKind[node.kind];
};

function analyse(path) {
  const source = read(path);
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = [];
  const declarations = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const names = [];
      const clause = statement.importClause;
      if (clause?.name) names.push(clause.name.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        names.push(...clause.namedBindings.elements.map((element) => element.name.text));
      }
      imports.push({
        source: statement.moduleSpecifier.text,
        names,
      });
      continue;
    }
    if (
      ts.isFunctionDeclaration(statement) ||
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isVariableStatement(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)
    ) {
      const start = lineAt(sourceFile, statement.getStart(sourceFile));
      const end = lineAt(sourceFile, statement.getEnd());
      declarations.push({
        name: nodeName(statement),
        kind: kindName(statement),
        start,
        end,
        lines: end - start + 1,
        exported: isExported(statement),
      });
    }
  }

  const matches = (pattern) => [...source.matchAll(pattern)].length;
  return {
    path,
    source,
    lines: source.trimEnd().split("\n").length,
    imports,
    declarations,
    metrics: {
      supabaseFromCalls: matches(/\.from\s*\(/g),
      supabaseRpcCalls: matches(/\.rpc\s*\(/g),
      promiseAllCalls: matches(/Promise\.all(?:Settled)?\s*\(/g),
      exportedDeclarations: declarations.filter((item) => item.exported).length,
      mockMarkers: matches(/\bMOCK_|mock data|demo data/gi),
      liveMarkers: matches(/\blive\b/gi),
    },
  };
}

const analyses = Object.fromEntries(targets.map((path) => [path, analyse(path)]));
const liveViews = analyses[targets[0]];
const service = analyses[targets[1]];
const shared = analyses[targets[2]];

const liveNames = new Set(liveViews.declarations.map((item) => item.name));
const sharedNames = new Set(shared.declarations.map((item) => item.name));
const exactDuplicates = [...liveNames].filter((name) => sharedNames.has(name));
const semanticDuplicates = [
  ["useEvidence", "usePilotEvidence"],
  ["EvidenceMessage", "EvidenceStateMessage"],
  ["AskButton", "AskVortaButton"],
].filter(([left, right]) => liveNames.has(left) && sharedNames.has(right));

const serviceSections = service.declarations
  .filter((item) => item.lines >= 20 || item.exported)
  .sort((a, b) => a.start - b.start);

const largest = (analysis, count = 12) =>
  [...analysis.declarations].sort((a, b) => b.lines - a.lines).slice(0, count);

const rows = (items) => items.map((item) => `| ${item.name} | ${item.kind} | ${item.start}-${item.end} | ${item.lines} | ${item.exported ? "yes" : "no"} |`).join("\n");

const report = `# Equipment live evidence and service audit

Generated from production commit context on ${new Date().toISOString()}.

## Executive findings

1. **EquipmentLiveEvidenceViews duplicates the new shared pilot-evidence UI layer.** Exact duplicate declaration names: ${exactDuplicates.join(", ") || "none"}. Semantic duplicates: ${semanticDuplicates.map(([left, right]) => `${left} ↔ ${right}`).join(", ") || "none"}.
2. **equipmentService is a mixed-responsibility module.** It contains ${service.metrics.mockMarkers} mock/demo markers, ${service.metrics.supabaseFromCalls} table-query calls, ${service.metrics.supabaseRpcCalls} RPC calls and ${service.metrics.exportedDeclarations} exported top-level declarations across ${service.lines} lines.
3. The safest next change is to consolidate the duplicated live-view UI and request-state helpers first. Any service split should preserve the existing public export surface and separate immutable demo fixtures from operational dashboard/RPC readers without moving risk or validation rules.

## File metrics

| File | Lines | Imports | Top-level declarations | Exported declarations | .from calls | .rpc calls | Mock/demo markers |
|---|---:|---:|---:|---:|---:|---:|---:|
${[liveViews, service, shared].map((item) => `| ${item.path} | ${item.lines} | ${item.imports.length} | ${item.declarations.length} | ${item.metrics.exportedDeclarations} | ${item.metrics.supabaseFromCalls} | ${item.metrics.supabaseRpcCalls} | ${item.metrics.mockMarkers} |`).join("\n")}

## EquipmentLiveEvidenceViews largest declarations

| Name | Kind | Lines | Size | Exported |
|---|---|---:|---:|---|
${rows(largest(liveViews))}

## Shared pilot-evidence largest declarations

| Name | Kind | Lines | Size | Exported |
|---|---|---:|---:|---|
${rows(largest(shared))}

## equipmentService responsibility map

| Name | Kind | Lines | Size | Exported |
|---|---|---:|---:|---|
${rows(serviceSections)}

## equipmentService largest declarations

| Name | Kind | Lines | Size | Exported |
|---|---|---:|---:|---|
${rows(largest(service, 20))}

## Import fan-out

### EquipmentLiveEvidenceViews
${liveViews.imports.map((item) => `- \`${item.source}\`: ${item.names.join(", ") || "side effect"}`).join("\n")}

### equipmentService
${service.imports.map((item) => `- \`${item.source}\`: ${item.names.join(", ") || "side effect"}`).join("\n")}
`;

const output = "docs/audits/equipment-live-service-audit.md";
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, report);
console.log(report);
