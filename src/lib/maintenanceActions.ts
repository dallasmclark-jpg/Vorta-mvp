export const VORTA_WORK_ORDER_DETAIL_EVENT = "vorta-work-order-detail";
export const VORTA_MAINTENANCE_AI_PROMPT_EVENT = "vorta-global-ai-prompt";

export interface WorkOrderDetailSelection {
  equipmentId: string;
  workOrderNumber: string;
}

export interface MaintenanceAiPrompt {
  question: string;
  submit?: boolean;
  role?: "maintenance-manager";
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

export function openMaintenanceAiAssistant(prompt: MaintenanceAiPrompt): boolean {
  if (typeof window === "undefined") return false;

  const question = prompt.question.trim();
  if (!question) return false;

  window.dispatchEvent(
    new CustomEvent<MaintenanceAiPrompt>(VORTA_MAINTENANCE_AI_PROMPT_EVENT, {
      detail: {
        question,
        submit: prompt.submit ?? true,
        role: prompt.role ?? "maintenance-manager",
      },
    }),
  );
  return true;
}
