const FONT_LINK_ID = "vorta-inter-tight-font";
const STYLE_ID = "vorta-typography-system";
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&display=swap";

if (!document.getElementById(FONT_LINK_ID)) {
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  document.head.append(link);
}

const typographyCss = String.raw`
:root {
  --vorta-font-ui: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --vorta-font-display: "Inter Tight", "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --vorta-type-page-title-size: 1.75rem;
  --vorta-type-page-title-line: 2.125rem;
  --vorta-type-section-title-size: 1.25rem;
  --vorta-type-section-title-line: 1.625rem;
  --vorta-type-card-title-size: 1rem;
  --vorta-type-card-title-line: 1.375rem;
  --vorta-type-body-size: 0.875rem;
  --vorta-type-body-line: 1.3125rem;
  --vorta-type-control-size: 0.875rem;
  --vorta-type-control-line: 1.25rem;
  --vorta-type-metadata-size: 0.75rem;
  --vorta-type-metadata-line: 1.125rem;
  --vorta-type-eyebrow-size: 0.6875rem;
  --vorta-type-eyebrow-line: 1rem;
  --vorta-type-kpi-size: 2rem;
  --vorta-type-kpi-line: 2.25rem;
  --vorta-type-kpi-compact-size: 1.625rem;
  --vorta-type-kpi-compact-line: 1.875rem;
  --vorta-type-marketing-display-size: 4rem;
  --vorta-type-marketing-display-line: 4rem;
}

html,
body,
button,
input,
textarea,
select {
  font-family: var(--vorta-font-ui);
}

html {
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

[data-vorta-page-content="true"],
[data-vorta-dashboard-root="true"] {
  font-variant-numeric: lining-nums tabular-nums;
  font-feature-settings: "cv02" 1, "cv03" 1, "cv04" 1, "cv11" 1;
}

[data-vorta-page-content="true"] :is(h1, h2),
[data-vorta-dashboard-root="true"] :is(h1, h2) {
  font-family: var(--vorta-font-display);
  font-synthesis: none;
}

[data-vorta-page-content="true"] h1,
[data-vorta-dashboard-root="true"] h1,
.vorta-type-page-title {
  font-family: var(--vorta-font-display);
  font-weight: 600;
  letter-spacing: -0.025em;
}

[data-vorta-page-content="true"] h2,
[data-vorta-dashboard-root="true"] h2,
.vorta-type-section-title {
  font-family: var(--vorta-font-display);
  font-weight: 600;
  letter-spacing: -0.018em;
}

[data-vorta-page-content="true"] h3,
[data-vorta-dashboard-root="true"] h3,
.vorta-type-card-title {
  font-weight: 600;
  letter-spacing: -0.01em;
}

[data-vorta-page-content="true"] [data-risk-kpi-card] :is([class~="text-xl"], [class~="text-2xl"], [class~="text-3xl"]),
[data-vorta-dashboard-root="true"] [data-risk-kpi-card] :is([class~="text-xl"], [class~="text-2xl"], [class~="text-3xl"]),
[data-vorta-kpi="true"],
.vorta-type-kpi,
.vorta-type-kpi-compact {
  font-family: var(--vorta-font-display);
  font-weight: 600;
  font-variant-numeric: lining-nums tabular-nums;
  letter-spacing: -0.025em;
}

[data-vorta-risk-intelligence-label="true"],
[data-vorta-technical-label="true"],
[data-vorta-eyebrow="true"],
.vorta-type-eyebrow {
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.vorta-type-page-title {
  font-size: var(--vorta-type-page-title-size);
  line-height: var(--vorta-type-page-title-line);
}

.vorta-type-section-title {
  font-size: var(--vorta-type-section-title-size);
  line-height: var(--vorta-type-section-title-line);
}

.vorta-type-card-title {
  font-size: var(--vorta-type-card-title-size);
  line-height: var(--vorta-type-card-title-line);
}

.vorta-type-body {
  font-family: var(--vorta-font-ui);
  font-size: var(--vorta-type-body-size);
  font-weight: 400;
  line-height: var(--vorta-type-body-line);
  letter-spacing: 0;
}

.vorta-type-control {
  font-family: var(--vorta-font-ui);
  font-size: var(--vorta-type-control-size);
  font-weight: 500;
  line-height: var(--vorta-type-control-line);
  letter-spacing: -0.005em;
}

.vorta-type-metadata {
  font-family: var(--vorta-font-ui);
  font-size: var(--vorta-type-metadata-size);
  font-weight: 500;
  line-height: var(--vorta-type-metadata-line);
  letter-spacing: 0;
}

.vorta-type-eyebrow {
  font-family: var(--vorta-font-ui);
  font-size: var(--vorta-type-eyebrow-size);
  line-height: var(--vorta-type-eyebrow-line);
}

.vorta-type-kpi {
  font-size: var(--vorta-type-kpi-size);
  line-height: var(--vorta-type-kpi-line);
}

.vorta-type-kpi-compact {
  font-size: var(--vorta-type-kpi-compact-size);
  line-height: var(--vorta-type-kpi-compact-line);
}

.vorta-type-marketing-display {
  font-family: var(--vorta-font-display);
  font-size: var(--vorta-type-marketing-display-size);
  font-weight: 600;
  line-height: var(--vorta-type-marketing-display-line);
  letter-spacing: -0.04em;
}

[data-vorta-unit="true"],
.vorta-type-unit {
  font-family: var(--vorta-font-ui);
  font-size: 0.5em;
  font-weight: 500;
  letter-spacing: 0;
  vertical-align: baseline;
}

[data-vorta-identifier="true"],
[data-vorta-timestamp="true"],
.vorta-type-technical-value {
  font-family: var(--vorta-font-ui);
  font-weight: 500;
  font-variant-numeric: lining-nums tabular-nums;
  letter-spacing: 0.01em;
}

@media (max-width: 767px) {
  :root {
    --vorta-type-page-title-size: 1.625rem;
    --vorta-type-page-title-line: 2rem;
    --vorta-type-kpi-size: 1.75rem;
    --vorta-type-kpi-line: 2rem;
    --vorta-type-kpi-compact-size: 1.5rem;
    --vorta-type-kpi-compact-line: 1.75rem;
    --vorta-type-marketing-display-size: 2.625rem;
    --vorta-type-marketing-display-line: 2.75rem;
  }
}
`;

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = typographyCss;
  document.head.append(style);
}
