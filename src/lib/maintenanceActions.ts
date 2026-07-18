export const VORTA_WORK_ORDER_DETAIL_EVENT = "vorta-work-order-detail";

export interface WorkOrderDetailSelection {
  equipmentId: string;
  workOrderNumber: string;
}

export function openWorkOrderDetail(selection: WorkOrderDetailSelection): boolean {
  if (typeof window === "undefined") return false;

  const equipmentId = selection.equipmentId.trim();
  const workOrderNumber = selection.workOrderNumber.trim();
  if (!equipmentId || !workOrderNumber) return false;

  window.dispatchEvent(
    new CustomEvent<WorkOrderDetailSelection>(VORTA_WORK_ORDER_DETAIL_EVENT, {
      detail: { equipmentId, workOrderNumber },
    }),
  );
  return true;
}
