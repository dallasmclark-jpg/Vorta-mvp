import {
  useCallback,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useParams } from "react-router-dom";
import { DEFAULT_EQUIPMENT_ID } from "./equipmentData";
import { EquipmentWorkOrders as EquipmentWorkOrdersBase } from "./EquipmentWorkOrders";
import { VORTA_WORK_ORDER_DETAIL_EVENT } from "./GlobalWorkOrderExecutionOverlay";

function workOrderNumberFromRow(row: HTMLTableRowElement): string | null {
  if (row.id.startsWith("work-order-")) {
    return row.id.slice("work-order-".length).trim() || null;
  }

  const firstCell = row.querySelector("td");
  const candidate = firstCell?.textContent?.trim() ?? "";
  return candidate.match(/\b(?:WO-\d+|\d{8,14})\b/i)?.[0] ?? null;
}

export function EquipmentWorkOrdersWithExecution(): JSX.Element {
  const { equipmentId } = useParams<{ equipmentId?: string }>();
  const resolvedEquipmentId = equipmentId ?? DEFAULT_EQUIPMENT_ID;

  const handleWorkOrderClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>): void => {
      if (event.defaultPrevented || event.button !== 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-global-work-order-overlay="true"]')) return;
      if (target.closest("button,a,input,select,textarea")) return;

      const row = target.closest<HTMLTableRowElement>(
        "#work-order-register tbody tr",
      );
      if (!row) return;

      const workOrderNumber = workOrderNumberFromRow(row);
      if (!workOrderNumber) return;

      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();

      window.dispatchEvent(
        new CustomEvent(VORTA_WORK_ORDER_DETAIL_EVENT, {
          detail: {
            equipmentId: resolvedEquipmentId,
            workOrderNumber,
          },
        }),
      );
    },
    [resolvedEquipmentId],
  );

  return (
    <div className="contents" onClickCapture={handleWorkOrderClick}>
      <EquipmentWorkOrdersBase />
    </div>
  );
}
