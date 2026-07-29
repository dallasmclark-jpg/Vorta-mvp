import { readFileSync, writeFileSync } from "node:fs";

const paths = [
  "src/screens/ContractorPortal/ContractorEngineersSection.tsx",
  "src/screens/ContractorPortal/ContractorSettingsSection.tsx",
  "src/screens/OperatorPortal/OperatorTrainingSection.tsx",
  "src/screens/ProductionManager/ProductionSettingsSection.tsx",
];

for (const path of paths) {
  const source = readFileSync(path, "utf8");
  if (!source.includes(' data-vorta-mobile-page-title="true"')) {
    throw new Error(`Expected generated title hook in ${path}`);
  }
  writeFileSync(
    path,
    source.replaceAll(' data-vorta-mobile-page-title="true"', ""),
    "utf8",
  );
}

console.log("Removed Maintenance-only title hooks from unrelated portals.");
