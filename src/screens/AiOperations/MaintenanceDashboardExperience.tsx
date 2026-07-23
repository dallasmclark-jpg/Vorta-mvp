import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";

type DashboardSectionKey = "overview" | "plant" | "labour" | "trends";

const MOBILE_SECTION_OPTIONS: Array<{
  key: DashboardSectionKey;
  label: string;
  ariaLabel: string;
}> = [
  { key: "overview", label: "Overview", ariaLabel: "Jump to dashboard overview" },
  { key: "plant", label: "Plant", ariaLabel: "Jump to plant risk" },
  { key: "labour", label: "Labour", ariaLabel: "Jump to labour risk" },
  { key: "trends", label: "Trends", ariaLabel: "Jump to risk reduction trends" },
];

function resolveDashboardSection(
  root: HTMLElement,
  sectionKey: DashboardSectionKey,
): HTMLElement | null {
  const sections = Array.from(root.getElementsByTagName("section"));

  if (sectionKey === "overview") {
    return sections[0] ?? null;
  }

  if (sectionKey === "labour") {
    return (
      sections.find(
        (section) => section.dataset.vortaDashboardSection === "labour-risk",
      ) ?? null
    );
  }

  if (sectionKey === "trends") {
    return (
      sections.find(
        (section) =>
          section.getAttribute("aria-label") === "Risk reduction performance",
      ) ?? null
    );
  }

  return (
    sections.find((section) => {
      const heading = section
        .getElementsByTagName("h2")
        .item(0)
        ?.textContent?.trim()
        .toLowerCase() ?? "";
      return heading.includes("plant area risk") || heading.includes("equipment risk");
    }) ?? null
  );
}

function scrollToDashboardSection(sectionKey: DashboardSectionKey): void {
  const root = document.getElementById("maintenance-dashboard-root");
  if (!root) return;

  const target = resolveDashboardSection(root, sectionKey);
  if (!target) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

function MobileDashboardSectionNav(): JSX.Element {
  return (
    <nav
      data-vorta-mobile-section-nav="true"
      aria-label="Dashboard section navigation"
    >
      {MOBILE_SECTION_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-label={option.ariaLabel}
          onClick={() => scrollToDashboardSection(option.key)}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}

export function MaintenanceDashboardExperience(): JSX.Element {
  return (
    <div id="maintenance-dashboard-root" data-vorta-dashboard-root="true">
      <style>{`
        [data-vorta-dashboard-root="true"] [role="tab"] {
          min-height: 2.5rem;
        }

        [data-vorta-mobile-section-nav="true"] {
          display: none;
        }

        @media (min-width: 1280px) {
          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            grid-auto-flow: row !important;
            overflow: visible !important;
            scroll-snap-type: none !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] > * {
            width: 100% !important;
            min-width: 0 !important;
          }

          [data-vorta-dashboard-root="true"] button[aria-label^="Scroll to previous risk KPI"],
          [data-vorta-dashboard-root="true"] button[aria-label^="Scroll to next risk KPI"] {
            display: none !important;
          }
        }

        @media (max-width: 639px) {
          [data-vorta-dashboard-root="true"] > section {
            gap: 1rem !important;
            padding: 0.75rem 0.75rem 7rem !important;
          }

          [data-vorta-dashboard-root="true"] > section > header {
            gap: 0.75rem !important;
            padding-bottom: 1rem !important;
          }

          [data-vorta-dashboard-root="true"] > section > header > div:last-child {
            width: 100%;
            gap: 0.5rem;
          }

          [data-vorta-dashboard-root="true"] > section > header > div:last-child > button:first-child {
            min-width: 0;
            min-height: 2.75rem;
            flex: 1 1 auto;
            padding-inline: 0.75rem;
          }

          [data-vorta-dashboard-root="true"] > section > header h1 {
            font-size: 1.375rem !important;
            line-height: 1.75rem !important;
          }

          [data-vorta-dashboard-root="true"] h2 {
            font-size: 1.0625rem !important;
            line-height: 1.4rem !important;
          }

          [data-vorta-mobile-section-nav="true"] {
            position: fixed;
            z-index: 45;
            right: auto;
            bottom: calc(env(safe-area-inset-bottom) + 0.75rem);
            left: 50%;
            display: grid;
            width: calc(100vw - 1.5rem);
            max-width: 28rem;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.25rem;
            transform: translateX(-50%);
            border: 1px solid rgba(71, 85, 105, 0.8);
            border-radius: 0.875rem;
            background: rgba(13, 17, 23, 0.96);
            padding: 0.25rem;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.48);
            backdrop-filter: blur(14px);
          }

          [data-vorta-mobile-section-nav="true"] button {
            min-height: 2.75rem;
            border-radius: 0.625rem;
            padding: 0.5rem 0.25rem;
            color: #cbd5e1;
            font-size: 0.75rem;
            font-weight: 700;
            transition: background-color 150ms ease, color 150ms ease;
          }

          [data-vorta-mobile-section-nav="true"] button:hover,
          [data-vorta-mobile-section-nav="true"] button:focus-visible {
            background: rgba(37, 99, 235, 0.22);
            color: #eff6ff;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]),
          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-section="labour-risk"],
          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction performance"] {
            scroll-margin-top: 1rem;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) > div:first-child,
          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-section="labour-risk"] > div:first-child {
            align-items: flex-start;
            gap: 0.5rem;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) > div:first-child button,
          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-section="labour-risk"] > div:first-child button {
            display: inline-flex;
            min-height: 2.75rem;
            align-items: center;
            justify-content: flex-end;
            padding: 0.25rem 0.5rem;
            text-align: right;
            font-size: 0.8125rem !important;
            line-height: 1.1rem;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) div:has(> [aria-label^="View equipment in "]) {
            display: flex !important;
            grid-template-columns: none !important;
            gap: 0.75rem !important;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scroll-snap-type: x mandatory;
            scroll-padding-inline: 0;
            padding-right: 0.75rem;
            padding-bottom: 0.25rem;
            margin-right: -0.75rem;
            scrollbar-width: none;
          }

          [data-vorta-dashboard-root="true"] section:has([aria-label^="View equipment in "]) div:has(> [aria-label^="View equipment in "])::-webkit-scrollbar {
            display: none;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] {
            width: calc(100vw - 3rem);
            min-width: calc(100vw - 3rem);
            max-width: 22rem;
            flex: 0 0 calc(100vw - 3rem);
            scroll-snap-align: start;
            scroll-snap-stop: always;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] > div {
            gap: 0.625rem !important;
            padding: 0.875rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] h3 {
            font-size: 0.9375rem !important;
            line-height: 1.25rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] [class~="text-xs"] {
            font-size: 0.8125rem !important;
            line-height: 1.125rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] [class~="text-xl"] {
            font-size: 1.5rem !important;
            line-height: 1.8rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] p[class*="min-h-9"] {
            min-height: 0 !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] dl {
            gap: 0.5rem !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] dl > div:not(:first-child) {
            display: none !important;
          }

          [data-vorta-dashboard-root="true"] [aria-label^="View equipment in "] button {
            min-height: 2.75rem;
            width: 100%;
            justify-content: center;
            font-size: 0.8125rem !important;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-card-rail="labour-risk"] {
            display: flex !important;
            grid-template-columns: none !important;
            gap: 0.75rem !important;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scroll-snap-type: x mandatory;
            scroll-padding-inline: 0;
            padding-right: 0.75rem;
            padding-bottom: 0.25rem;
            margin-right: -0.75rem;
            scrollbar-width: none;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-card-rail="labour-risk"]::-webkit-scrollbar {
            display: none;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-card="labour-risk"] {
            width: calc(100vw - 3rem);
            min-width: calc(100vw - 3rem);
            max-width: 22rem;
            flex: 0 0 calc(100vw - 3rem);
            scroll-snap-align: start;
            scroll-snap-stop: always;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-dashboard-card="labour-risk"] > div {
            gap: 0.625rem !important;
            padding: 0.875rem !important;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-mobile-secondary="true"] {
            display: none !important;
          }

          [data-vorta-dashboard-root="true"] [data-vorta-mobile-card-action="true"] {
            display: inline-flex !important;
            min-height: 2.75rem;
            width: 100%;
            align-items: center;
            justify-content: center;
          }

          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] {
            scroll-padding-inline: 0;
          }

          [data-vorta-dashboard-root="true"] [aria-label="Risk reduction KPI cards"] > [data-risk-kpi-card] {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            scroll-snap-align: start;
            scroll-snap-stop: always;
          }

          [data-vorta-dashboard-root="true"] [data-risk-kpi-card] [class~="text-xs"] {
            font-size: 0.8125rem !important;
            line-height: 1.125rem !important;
          }

          [data-vorta-dashboard-root="true"] button[aria-label^="Scroll to previous risk KPI"],
          [data-vorta-dashboard-root="true"] button[aria-label^="Scroll to next risk KPI"] {
            display: none !important;
          }
        }
      `}</style>

      <DashboardOverviewSection />
      <MobileDashboardSectionNav />
    </div>
  );
}
