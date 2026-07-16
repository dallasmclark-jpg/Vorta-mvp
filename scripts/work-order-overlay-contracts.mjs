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
const enhancedOverlaySource = readSource(
  "../src/screens/Equipment/MaintenanceWorkOrderExecutionOverlay.tsx",
);
const workOrderRegisterBridgeSource = readSource(
  "../src/screens/Equipment/EquipmentWorkOrdersWithExecution.tsx",
);
const documentInterceptorSource = readSource(
  "../src/lib/equipmentDocumentNavigationInterceptor.ts",
);
const retiredInterceptorUrl = new URL(
  "../src/lib/vortaAiWorkOrderNavigationFix.ts",
  import.meta.url,
);
const retiredEvidenceControlUrl = new URL(
  "../src/screens/Equipment/WorkOrderEvidenceControl.tsx",
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
  "Work order register buttons retain their native controls",
  bridgeSource.includes('interactiveElement.closest("#work-order-register")'),
);
check(
  "Maintenance portal mounts the enhanced execution overlay",
  bridgeSource.includes("<MaintenanceWorkOrderExecutionOverlay />"),
);
check(
  "Work order register rows dispatch the shared overlay event",
  workOrderRegisterBridgeSource.includes(
    "new CustomEvent(VORTA_WORK_ORDER_DETAIL_EVENT",
  ) &&
    workOrderRegisterBridgeSource.includes(
      '"#work-order-register tbody tr"',
    ),
);
check(
  "Work order register ignores native row controls",
  workOrderRegisterBridgeSource.includes(
    'target.closest("button,a,input,select,textarea")',
  ),
);
check(
  "Work order page preserves the shared equipment header hierarchy",
  workOrderRegisterBridgeSource.includes("<EquipmentWorkOrdersBase />") &&
    !workOrderRegisterBridgeSource.includes("WorkOrderEvidenceControl"),
);
check(
  "Work order register no longer contains a duplicate execution drawer",
  !workOrderRegisterBridgeSource.includes("ExecutionDrawer") &&
    !workOrderRegisterBridgeSource.includes(
      'data-work-order-execution-drawer="true"',
    ),
);
check(
  "Execution overlay presents a manager verdict",
  enhancedOverlaySource.includes("Execution evidence complete") &&
    enhancedOverlaySource.includes("Follow-up required") &&
    enhancedOverlaySource.includes("Latest engineer update"),
);
check(
  "Execution overlay distinguishes final and interim confirmations",
  enhancedOverlaySource.includes("Final confirmation") &&
    enhancedOverlaySource.includes("Interim confirmation"),
);
check(
  "Execution overlay summarises 261 material issues",
  enhancedOverlaySource.includes('movement.movementType === "261"') &&
    enhancedOverlaySource.includes("261 goods issues"),
);
check(
  "Execution overlay prevents background scrolling and restores focus",
  enhancedOverlaySource.includes('document.body.style.overflow = "hidden"') &&
    enhancedOverlaySource.includes("previousFocusRef.current?.focus()"),
);
check(
  "Document navigation no longer imports the global work order interceptor",
  !documentInterceptorSource.includes("vortaAiWorkOrderNavigationFix"),
);
check(
  "Obsolete document-wide work order interceptor has been removed",
  !existsSync(retiredInterceptorUrl),
);
check(
  "Duplicate equipment-level evidence control has been removed",
  !existsSync(retiredEvidenceControlUrl),
);

if (failures.length > 0) {
  console.error(`\n${failures.length} work order overlay contract(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nWork order overlay contracts passed.");
}
