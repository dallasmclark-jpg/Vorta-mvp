import { MobileAiComposerControls } from "./MobileAiComposerControls";

const MOBILE_AI_POLISH_STYLES = `
[data-vorta-ai-attach-control="true"],
[data-vorta-ai-mobile-mic="true"] {
  display: none;
}

@media (max-width: 639px) {
  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div:first-child,
    [data-vorta-fault-panel="true"] header
  ) {
    min-height: 4rem !important;
    padding: 0.5rem 0.875rem !important;
    border-bottom-color: rgb(30 41 59) !important;
    background: linear-gradient(180deg, rgb(15 19 27), rgb(11 14 20)) !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div:first-child > div:first-child > div:first-child,
    [data-vorta-fault-panel="true"] header > div:first-child > div:first-child
  ) {
    display: flex !important;
    width: 2.25rem !important;
    height: 2.25rem !important;
    align-items: center;
    justify-content: center;
    border: 1px solid rgb(96 165 250 / 0.24) !important;
    border-radius: 0.75rem !important;
    background: linear-gradient(145deg, rgb(59 130 246 / 0.22), rgb(14 165 233 / 0.08)) !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div:first-child p,
    [data-vorta-fault-panel="true"] header p
  ) {
    display: block !important;
    color: rgb(100 116 139) !important;
    font-size: 0.6875rem !important;
    line-height: 1rem !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) button[aria-label="Close global assistant"],
    [data-vorta-fault-panel="true"] button[data-vorta-fault-close="true"]
  ) {
    border: 1px solid rgb(51 65 85 / 0.8) !important;
    background: rgb(30 41 59 / 0.42) !important;
    color: rgb(148 163 184) !important;
    -webkit-tap-highlight-color: transparent;
  }

  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t > div.flex,
    [data-vorta-fault-panel="true"] form > div
  ):focus-within {
    border-color: rgb(71 85 105) !important;
    box-shadow: none !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t,
    [data-vorta-fault-panel="true"] form
  ) input,
  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t,
    [data-vorta-fault-panel="true"] form
  ) input:focus,
  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t,
    [data-vorta-fault-panel="true"] form
  ) input:focus-visible {
    border: 0 !important;
    outline: 0 solid transparent !important;
    box-shadow: none !important;
    --tw-ring-color: transparent !important;
    --tw-ring-shadow: 0 0 #0000 !important;
    -webkit-tap-highlight-color: transparent;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t > div.flex > [data-vorta-ai-attach-control="true"] {
    order: 1;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t > div.flex > input {
    order: 2;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t > div.flex > button[aria-label$="voice dictation"] {
    order: 3;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t > div.flex > button:has(svg.lucide-send) {
    order: 4;
    width: 2.5rem !important;
    height: 2.5rem !important;
    padding: 0 !important;
    gap: 0 !important;
    border-radius: 9999px !important;
    font-size: 0 !important;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t > div.flex > button:has(svg.lucide-send) svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t > div.flex > button[aria-label$="voice dictation"],
  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t > div.flex > [data-vorta-ai-attach-control="true"],
  [data-vorta-fault-panel="true"] [data-vorta-ai-attach-control="true"],
  [data-vorta-fault-panel="true"] [data-vorta-ai-mobile-mic="true"] {
    display: inline-flex !important;
    width: 2.5rem !important;
    height: 2.5rem !important;
    min-width: 2.5rem;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 9999px !important;
    background: transparent;
  }

  [data-vorta-fault-panel="true"] form {
    align-items: center;
  }

  [data-vorta-fault-panel="true"] form > [data-vorta-ai-attach-control="true"] {
    order: 1;
  }

  [data-vorta-fault-panel="true"] form > div {
    order: 2;
    min-width: 0;
    flex: 1 1 auto;
    border: 1px solid rgb(51 65 85) !important;
  }

  [data-vorta-fault-panel="true"] form > div > svg {
    display: none !important;
  }

  [data-vorta-fault-panel="true"] form > [data-vorta-ai-mobile-mic="true"] {
    order: 3;
  }

  [data-vorta-fault-panel="true"] form > button[type="submit"] {
    order: 4;
  }
}
`;

export function MobileAiPolishStyles(): JSX.Element {
  return (
    <>
      <style data-vorta-mobile-ai-polish="true">
        {MOBILE_AI_POLISH_STYLES}
      </style>
      <MobileAiComposerControls />
    </>
  );
}
