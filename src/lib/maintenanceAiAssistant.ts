export type MaintenanceAiRole =
  | "maintenance-manager"
  | "planner"
  | "engineer"
  | "operator"
  | "production-manager"
  | "contractor";

export interface MaintenanceAiPrompt {
  question: string;
  role?: MaintenanceAiRole;
  submit?: boolean;
}

export function openMaintenanceAiAssistant({
  question,
  role = "maintenance-manager",
  submit = true,
}: MaintenanceAiPrompt): void {
  const trimmed = question.trim();
  if (!trimmed) return;

  window.dispatchEvent(
    new CustomEvent("vorta-global-ai-prompt", {
      detail: {
        question: trimmed,
        submit,
        role,
      },
    }),
  );
}
