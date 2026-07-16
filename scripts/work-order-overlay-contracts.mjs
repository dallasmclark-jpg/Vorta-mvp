import {
  existsSync,
  readFileSync,
} from "node:fs";

const readSource = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const aiOperationsSource = readSource(
  "../src/screens/AiOperations/AiOperations.tsx",
);
const bridgeSource = readSource(
  "../src/screens/AiOperations/MaintenanceAiWorkOrderExperience.tsx",
);
const documentInterceptorSource = readSource(
  "../src/lib/equipmentDocumentNavigationInterceptor.ts",
);
const retiredInterceptorUrl = new URL(
  "../src/lib/vortaAiWorkOrderNavigationFix.ts",
  import.meta.url,
);

const failures = [];

const check = (name, condition) => {
  if (condition) {
    console.log(`✓ ${name}`);
    return;
  }

  failures.push(name);
  console.error(`✗ ${name}`);
};

check(
  "Maintenance routes are wrapped by the React work order experience",
  aiOperationsSource.includes("<MaintenanceAiWorkOrderExperience>") &&
    aiOperationsSource.includes("</MaintenanceAiWorkOrderExperience>"),
);
check(
  "React bridge owns work order click capture",
  bridgeSource.includes("onClickCapture={handleWorkOrderClick}"),
);
check(
  "React bridge covers linked work order buttons and anchors",
  bridgeSource.includes('closest<HTMLElement>("a[href],button")'),
);
check(
  "React bridge resolves equipment from the active equipment route",
  bridgeSource.includes("equipmentIdFromPath(window.location.pathname)"),
);
check(
  "React bridge opens the shared execution overlay event",
  bridgeSource.includes("VORTA_WORK_ORDER_DETAIL_EVENT"),
);
check(
  "React bridge closes the fault assistant before opening work order detail",
  bridgeSource.includes('button[data-vorta-fault-close="true"]'),
);
check(
  "React bridge ignores clicks inside the work order overlay",
  bridgeSource.includes('data-global-work-order-overlay="true"'),
);
check(
  "Document navigation no longer imports the global work order interceptor",
  !documentInterceptorSource.includes("vortaAiWorkOrderNavigationFix"),
);
check(
  "Obsolete document-wide work order interceptor has been removed",
  !existsSync(retiredInterceptorUrl),
);

if (failures.length > 0) {
  console.error(`\n${failures.length} work order overlay contract(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nWork order overlay contracts passed.");
}
