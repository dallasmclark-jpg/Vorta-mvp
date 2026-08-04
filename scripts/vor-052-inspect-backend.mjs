import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";

const sourcePath = "netlify/functions/ask-vorta.mts";
const outputPath = ".vor-052/ask-vorta-structure.json";
const text = fs.readFileSync(sourcePath, "utf8");
const source = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function lineOf(position) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function declarationNames(statement) {
  const names = [];
  if (statement.name && ts.isIdentifier(statement.name)) names.push(statement.name.text);
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
    }
  }
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (clause?.name) names.push(clause.name.text);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) names.push(element.name.text);
    }
  }
  return names;
}

const topLevelNames = new Set();
for (const statement of source.statements) {
  for (const name of declarationNames(statement)) topLevelNames.add(name);
}

function referencesFor(statement, declaredNames) {
  const references = new Set();
  function visit(node) {
    if (ts.isIdentifier(node)) {
      const name = node.text;
      const parent = node.parent;
      const isDeclarationName =
        (parent && "name" in parent && parent.name === node) ||
        ts.isPropertyAccessExpression(parent) && parent.name === node ||
        ts.isPropertyAssignment(parent) && parent.name === node ||
        ts.isMethodDeclaration(parent) && parent.name === node ||
        ts.isPropertySignature(parent) && parent.name === node;
      if (!isDeclarationName && topLevelNames.has(name) && !declaredNames.has(name)) references.add(name);
    }
    ts.forEachChild(node, visit);
  }
  visit(statement);
  return [...references].sort();
}

const statements = source.statements.map((statement, index) => {
  const names = declarationNames(statement);
  const declared = new Set(names);
  const modifiers = statement.modifiers?.map((modifier) => ts.SyntaxKind[modifier.kind]) ?? [];
  const firstLine = statement.getText(source).split("\n", 1)[0].slice(0, 180);
  return {
    index,
    kind: ts.SyntaxKind[statement.kind],
    names,
    modifiers,
    startLine: lineOf(statement.getStart(source)),
    endLine: lineOf(statement.end),
    characterCount: statement.end - statement.getStart(source),
    references: referencesFor(statement, declared),
    firstLine,
  };
});

const report = {
  sourcePath,
  sha256: crypto.createHash("sha256").update(text).digest("hex"),
  lineCount: text.split("\n").length,
  characterCount: text.length,
  statementCount: statements.length,
  topLevelNames: [...topLevelNames].sort(),
  statements,
};

fs.mkdirSync(".vor-052", { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${outputPath}: ${report.lineCount} lines, ${report.statementCount} top-level statements.`);
