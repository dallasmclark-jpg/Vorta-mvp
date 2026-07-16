import { isFaultQuestion } from "../screens/AiOperations/faultIntelligenceData";

const INSTALL_MARKER = "vortaAiGenericFaultBridge";
const FAULT_PROMPT_EVENT = "vorta-global-ai-fault-prompt-v2";
const GENERIC_CLOSE_SELECTOR =
  'button[aria-label="Close global assistant"]:not([data-vorta-fault-close="true"])';

function clearControlledInput(input: HTMLInputElement): void {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;

  valueSetter?.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function findGenericPanel(element: Element): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("div.fixed")).find(
      (candidate) =>
        candidate.contains(element) &&
        Boolean(candidate.querySelector(GENERIC_CLOSE_SELECTOR)) &&
        !candidate.matches('[data-vorta-fault-panel="true"]'),
    ) ?? null
  );
}

function findGenericInput(panel: HTMLElement): HTMLInputElement | null {
  return (
    Array.from(panel.querySelectorAll<HTMLInputElement>('input[type="text"]')).find(
      (input) => !input.closest('[data-vorta-fault-panel="true"]'),
    ) ?? null
  );
}

function routeFaultQuestion(
  event: Event,
  panel: HTMLElement,
  input: HTMLInputElement,
): boolean {
  const question = input.value.trim();
  if (!question || !isFaultQuestion(question)) return false;

  event.preventDefault();
  event.stopImmediatePropagation();

  clearControlledInput(input);
  panel.querySelector<HTMLButtonElement>(GENERIC_CLOSE_SELECTOR)?.click();

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

  return true;
}

function installGenericFaultBridge(): void {
  const root = document.documentElement;
  if (root.dataset[INSTALL_MARKER] === "true") return;
  root.dataset[INSTALL_MARKER] = "true";

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest<HTMLButtonElement>("button");
      if (!button || button.disabled) return;
      if (button.textContent?.trim() !== "Send") return;

      const panel = findGenericPanel(button);
      if (!panel) return;

      const input = findGenericInput(panel);
      if (!input) return;

      routeFaultQuestion(event, panel, input);
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") return;

      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "text") return;

      const panel = findGenericPanel(input);
      if (!panel) return;

      routeFaultQuestion(event, panel, input);
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const panel = findGenericPanel(form);
      if (!panel) return;

      const input = findGenericInput(panel);
      if (!input) return;

      routeFaultQuestion(event, panel, input);
    },
    true,
  );
}

installGenericFaultBridge();
