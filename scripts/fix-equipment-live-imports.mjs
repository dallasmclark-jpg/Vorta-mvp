import { readFileSync, rmSync, writeFileSync } from "node:fs";

const path = "src/screens/Equipment/EquipmentLiveEvidenceViews.tsx";
let source = readFileSync(path, "utf8");

const replaceRequired = (from, to, label) => {
  if (!source.includes(from)) throw new Error(`Missing import repair target: ${label}`);
  source = source.replace(from, to);
};

replaceRequired(
  "import {\n  Bell,",
  "import {\n  AlertTriangle,\n  Bell,",
  "AlertTriangle",
);
replaceRequired(
  'import { useCallback, useMemo, useState } from "react";\n',
  'import { useCallback, useMemo, useState } from "react";\nimport type { EquipmentTabRoute } from "./EquipmentTabNavigation";\n',
  "EquipmentTabRoute",
);
replaceRequired(
  "  type LiveComponentsPayload,\n  type LiveEquipmentRecord,",
  "  type LiveComponentsPayload,\n  type LiveDataState,\n  type LiveEquipmentRecord,",
  "LiveDataState",
);

writeFileSync(path, source);
rmSync("scripts/fix-equipment-live-imports.mjs", { force: true });
rmSync(".github/workflows/fix-equipment-live-imports.yml", { force: true });
console.log("Repaired consolidated Equipment live imports.");
