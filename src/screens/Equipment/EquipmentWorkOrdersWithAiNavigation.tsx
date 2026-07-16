import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { EquipmentWorkOrdersWithExecution } from "./EquipmentWorkOrdersWithExecution";

function rowMatchesWorkOrder(
  row: HTMLTableRowElement,
  workOrderNumber: string,
): boolean {
  if (row.id === `work-order-${workOrderNumber}`) return true;

  const firstCellText = row.querySelector("td")?.textContent?.trim() ?? "";
  return firstCellText.startsWith(workOrderNumber);
}

function findWorkOrderRow(workOrderNumber: string): HTMLTableRowElement | null {
  const rows = Array.from(
    document.querySelectorAll<HTMLTableRowElement>(
      "#work-order-register tbody tr",
    ),
  );

  return rows.find((row) => rowMatchesWorkOrder(row, workOrderNumber)) ?? null;
}

function selectCompletedRegister(): void {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("#work-order-register button"),
  );
  const completedButton = buttons.find((button) =>
    button.textContent?.trim().startsWith("Completed"),
  );

  if (
    completedButton &&
    !completedButton.className.includes("bg-blue-600")
  ) {
    completedButton.click();
  }
}

export function EquipmentWorkOrdersWithAiNavigation(): JSX.Element {
  const [searchParams] = useSearchParams();
  const processedTarget = useRef<string | null>(null);
  const workOrderNumber = searchParams.get("workOrder")?.trim() ?? "";
  const requestedView = searchParams.get("view")?.trim().toLowerCase() ?? "open";

  useEffect(() => {
    if (!workOrderNumber) return;

    const targetKey = `${workOrderNumber}:${requestedView}`;
    if (processedTarget.current === targetKey) return;

    let attempts = 0;
    const maximumAttempts = 150;

    const openTarget = (): void => {
      attempts += 1;

      if (requestedView === "completed") {
        selectCompletedRegister();
      }

      const row = findWorkOrderRow(workOrderNumber);
      if (row) {
        processedTarget.current = targetKey;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.click();
        window.clearInterval(intervalId);
        return;
      }

      if (attempts >= maximumAttempts) {
        window.clearInterval(intervalId);
      }
    };

    const intervalId = window.setInterval(openTarget, 100);
    openTarget();

    return () => window.clearInterval(intervalId);
  }, [requestedView, workOrderNumber]);

  return <EquipmentWorkOrdersWithExecution />;
}
