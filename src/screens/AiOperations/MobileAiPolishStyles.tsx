const MOBILE_AI_POLISH_STYLES = `
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
}
`;

export function MobileAiPolishStyles(): JSX.Element {
  return (
    <style data-vorta-mobile-ai-polish="true">
      {MOBILE_AI_POLISH_STYLES}
    </style>
  );
}
