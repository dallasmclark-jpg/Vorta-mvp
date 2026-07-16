import { isFaultQuestion } from "../screens/AiOperations/faultIntelligenceData";

const INSTALL_MARKER = "vortaAiGenericFaultBridge";
const FAULT_PROMPT_EVENT = "vorta-global-ai-fault-prompt-v2";

function clearControlledInput(input: HTMLInputElement): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function findGenericAssistantCloseButton(
  form: HTMLFormElement,
): HTMLButtonElement | null {
  const panel = form.closest<HTMLElement>('[data-vorta-ai-panel="true"]');
  if (!panel) return null;

  return panel.querySelector<HTMLButtonElement>(
    'button[aria-label="Close global assistant"]:not([data-vorta-fault-close="true"])',
  );
}

function installGenericFaultBridge(): void {
  const root = document.documentElement;
  if (root.dataset[INSTALL_MARKER] === "true") return;
  root.dataset[INSTALL_MARKER] = "true";

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.closest('[data-vorta-fault-panel="true"]')) return;

      const input = form.querySelector<HTMLInputElement>(
        'input[placeholder^="Ask about"]',
      );
      if (!input) return;

      const question = input.value.trim();
      if (!question || !isFaultQuestion(question)) return;

      const closeButton = findGenericAssistantCloseButton(form);
      if (!closeButton) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      clearControlledInput(input);
      closeButton.click();

      window.queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent(FAULT_PROMPT_EVENT, {
            detail: {
              question,
              submit: true,
              role: "maintenance-manager",
            },
          }),
        );
      });
    },
    true,
  );
}

installGenericFaultBridge();
