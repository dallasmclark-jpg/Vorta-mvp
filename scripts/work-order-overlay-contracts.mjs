import { existsSync, readFileSync } from "node:fs";

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
const globalOverlaySource = readSource(
  "../src/screens/Equipment/GlobalWorkOrderExecutionOverlay.tsx",
);
const workOrderPageSource = readSource(
  "../src/screens/Equipment/EquipmentWorkOrders.tsx",
);
const workOrderRegisterBridgeSource = readSource(
  "../src/screens/Equipment/EquipmentWorkOrdersWithExecution.tsx",
);
const aiNavigationSource = readSource(
  "../src/screens/Equipment/EquipmentWorkOrdersWithAiNavigation.tsx",
);
const aiAssistantSource = readSource(
  "../src/screens/AiOperations/GlobalMaintenanceAiAssistantWithFaultsV2.tsx",
);
const maintenanceActionsSource = readSource(
  "../src/lib/maintenanceActions.ts",
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
  "Portal bridge no longer captures arbitrary work order clicks",
  !bridgeSource.includes("handleWorkOrderClick") &&
    !bridgeSource.includes("WORK_ORDER_NUMBER") &&
    !bridgeSource.includes("stopImmediatePropagation"),
);
check(
  "Shared maintenance action opens the execution overlay",
  maintenanceActionsSource.includes("openWorkOrderDetail") &&
    maintenanceActionsSource.includes("VORTA_WORK_ORDER_DETAIL_EVENT"),
);
check(
  "Maintenance portal mounts the enhanced execution overlay",
  bridgeSource.includes("<MaintenanceWorkOrderExecutionOverlay />"),
);
check(
  "Work order page opens records explicitly",
  workOrderPageSource.includes("openWorkOrderDetail"),
);
check(
  "AI fault history opens records explicitly",
  aiAssistantSource.includes("openWorkOrderDetail"),
);
check(
  "Query-linked work orders open without DOM polling",
  aiNavigationSource.includes("openWorkOrderDetail") &&
    !aiNavigationSource.includes("setInterval") &&
    !aiNavigationSource.includes("querySelector"),
);
check(
  "Legacy row interception wrapper is retired",
  workOrderRegisterBridgeSource.includes("<EquipmentWorkOrdersBase />") &&
    !workOrderRegisterBridgeSource.includes("onClickCapture") &&
    !workOrderRegisterBridgeSource.includes("HTMLTableRowElement"),
);
check(
  "Global overlay traps focus through the shared accessibility hook",
  globalOverlaySource.includes("useModalFocusTrap") &&
    globalOverlaySource.includes("tabIndex={-1}"),
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
