const MOBILE_TYPOGRAPHY_STYLES = `
@media (max-width: 767px) {
  [data-vorta-maintenance-portal="true"],
  [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"] {
    font-size: 1.0625rem;
  }

  :is(
    [data-vorta-maintenance-portal="true"],
    [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"]
  ) [class~="text-[10px]"] {
    font-size: 0.75rem !important;
    line-height: 1rem !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"],
    [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"]
  ) [class~="text-[11px]"] {
    font-size: 0.8125rem !important;
    line-height: 1.1rem !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"],
    [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"]
  ) [class~="text-[12px]"] {
    font-size: 0.875rem !important;
    line-height: 1.2rem !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"],
    [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"]
  ) [class~="text-[13px]"] {
    font-size: 0.9375rem !important;
    line-height: 1.3rem !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"],
    [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"]
  ) .text-xs {
    font-size: 0.875rem !important;
    line-height: 1.25rem !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"],
    [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"]
  ) .text-sm {
    font-size: 1rem !important;
    line-height: 1.45rem !important;
  }

  [data-vorta-maintenance-portal="true"] .text-base {
    font-size: 1.0625rem !important;
    line-height: 1.55rem !important;
  }

  [data-vorta-maintenance-portal="true"] .text-lg {
    font-size: 1.1875rem !important;
    line-height: 1.7rem !important;
  }

  [data-vorta-maintenance-portal="true"] .text-xl {
    font-size: 1.5rem !important;
    line-height: 1.9rem !important;
  }

  [data-vorta-maintenance-portal="true"] .text-2xl {
    font-size: 1.625rem !important;
    line-height: 2rem !important;
  }

  [data-vorta-maintenance-portal="true"] :is(input:not([type="file"]), textarea, select) {
    font-size: 1.0625rem !important;
    line-height: 1.5rem !important;
  }

  [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"] a,
  [data-vorta-portal-shell="true"] div[role="dialog"][aria-label="Portal navigation"] button {
    font-size: 1rem !important;
    line-height: 1.4rem !important;
  }

  [data-vorta-shared-mobile-ai-launcher="true"] {
    font-size: 1rem !important;
    line-height: 1.35rem !important;
  }

  /* Dashboard keeps its large risk values while lifting headings, labels and actions. */
  [data-vorta-dashboard-root="true"] > section > header h1 {
    font-size: 1.625rem !important;
    line-height: 2rem !important;
  }

  [data-vorta-dashboard-root="true"] h2 {
    font-size: 1.1875rem !important;
    line-height: 1.55rem !important;
  }

  [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) > div:first-child button,
  [data-vorta-dashboard-root="true"] [data-vorta-dashboard-section="labour-risk"] > div:first-child button,
  [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] button {
    font-size: 0.9375rem !important;
    line-height: 1.25rem !important;
  }

  [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] h3 {
    font-size: 1.0625rem !important;
    line-height: 1.4rem !important;
  }

  [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] [class~="text-xs"],
  [data-vorta-dashboard-root="true"] [data-risk-kpi-card] [class~="text-xs"] {
    font-size: 0.875rem !important;
    line-height: 1.25rem !important;
  }

  /* Vorta AI follows the same readable scale as the native ChatGPT mobile composer. */
  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div:first-child h3,
  [data-vorta-fault-panel="true"] header h3 {
    font-size: 1.25rem !important;
    line-height: 1.55rem !important;
  }

  :is(
    [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div:first-child p,
    [data-vorta-fault-panel="true"] header p
  ) {
    font-size: 0.875rem !important;
    line-height: 1.2rem !important;
  }

  /* Scale the existing What can I help with? empty state without changing its copy. */
  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])
    > div.flex:not(:first-child):not(:has(> div.mb-2))
    > div:only-child.justify-start
    > div
    > div.flex.flex-col.gap-2
    > p::before {
    font-size: 1.875rem !important;
    line-height: 2.3rem !important;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])
    > div.flex:not(:first-child):not(:has(> div.mb-2))
    > div:only-child.justify-start
    > div
    > div.flex.flex-col.gap-2
    > p::after {
    max-width: 20rem !important;
    font-size: 1.0625rem !important;
    line-height: 1.55rem !important;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])
    > div.flex:not(:first-child):not(:has(> div.mb-2))
    > div.justify-end p,
  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])
    .justify-start > div > div.flex.flex-col.gap-2 > p,
  [data-vorta-fault-panel="true"] .space-y-5 > section:first-child > p {
    font-size: 1.0625rem !important;
    line-height: 1.65rem !important;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])
    .justify-start > div > div.flex.flex-col.gap-2 > div:nth-of-type(3) h4 {
    font-size: 0.8125rem !important;
    line-height: 1.1rem !important;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"])
    .justify-start > div > div.flex.flex-col.gap-2 > div:nth-of-type(3) li {
    font-size: 1rem !important;
    line-height: 1.5rem !important;
  }

  [data-vorta-maintenance-portal="true"] > div.fixed:has(button[aria-label="Close global assistant"]) > div.border-t input,
  [data-vorta-fault-panel="true"] form input {
    font-size: 1.125rem !important;
    line-height: 1.6rem !important;
  }
}
`;

export function MobileTypographyStyles(): JSX.Element {
  return (
    <style data-vorta-mobile-typography="true">
      {MOBILE_TYPOGRAPHY_STYLES}
    </style>
  );
}
