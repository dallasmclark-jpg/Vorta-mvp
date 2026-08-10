import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Missing VOR-076 stock truth anchor: ${label}`);
  return source.replace(before, after);
}

const helperPath = "netlify/functions/_shared/askVortaSparePhotoMatch.mjs";
let helper = readFileSync(helperPath, "utf8");
helper = replaceOnce(
  helper,
  `function numberValue(value) {\n  const parsed = Number(value);\n  return Number.isFinite(parsed) ? parsed : 0;\n}`,
  `function numberValue(value) {\n  const parsed = Number(value);\n  return Number.isFinite(parsed) ? parsed : 0;\n}\n\nfunction optionalNumberValue(value) {\n  if (value === null || value === undefined || value === "") return null;\n  const parsed = Number(value);\n  return Number.isFinite(parsed) ? parsed : null;\n}`,
  "optional stock quantity parser",
);
helper = replaceOnce(
  helper,
  `        quantity: numberValue(component.quantity_available),`,
  `        quantity: optionalNumberValue(component.quantity_available),`,
  "candidate stock quantity",
);
writeFileSync(helperPath, helper);

const typesPath = "netlify/functions/_shared/askVortaSparePhotoMatch.d.mts";
let types = readFileSync(typesPath, "utf8");
types = replaceOnce(types, `  quantity: number;`, `  quantity: number | null;`, "quantity type");
writeFileSync(typesPath, types);

const routePath = "netlify/functions/ask-vorta/spare-photo-identification.mts";
let route = readFileSync(routePath, "utf8");
route = replaceOnce(
  route,
  `    \`Qty \${match.quantity}\`,`,
  `    match.quantity !== null ? \`Qty \${match.quantity}\` : "",`,
  "omit unknown quantity",
);
writeFileSync(routePath, route);

console.log("VOR-076 stock truth patch applied.");
