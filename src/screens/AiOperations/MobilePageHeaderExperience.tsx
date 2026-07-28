import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface MobilePageProfile {
  title: string;
  duplicateHeadings: string[];
}

const PAGE_PROFILES: Array<{
  matches: (pathname: string) => boolean;
  profile: MobilePageProfile;
}> = [
  {
    matches: (pathname) => pathname === "/dashboard",
    profile: { title: "Dashboard", duplicateHeadings: ["Operations Overview"] },
  },
  {
    matches: (pathname) => pathname === "/shift-handover",
    profile: { title: "Shift Handover", duplicateHeadings: ["Shift Handover"] },
  },
  {
    matches: (pathname) => /^\/equipment\/[^/]+(?:\/|$)/.test(pathname),
    profile: { title: "Equipment", duplicateHeadings: [] },
  },
  {
    matches: (pathname) => pathname === "/equipment",
    profile: { title: "Equipment", duplicateHeadings: ["Equipment"] },
  },
  {
    matches: (pathname) => pathname === "/skills-matrix",
    profile: {
      title: "Capability",
      duplicateHeadings: ["Capability Summary", "Skills Matrix"],
    },
  },
  {
    matches: (pathname) => pathname === "/engineers",
    profile: { title: "Engineers", duplicateHeadings: ["Engineers"] },
  },
  {
    matches: (pathname) => pathname === "/requirements",
    profile: {
      title: "Requirements",
      duplicateHeadings: ["Requirements", "Requirements Evidence"],
    },
  },
  {
    matches: (pathname) => pathname === "/training",
    profile: {
      title: "Training",
      duplicateHeadings: ["Training", "Training Plan", "Training Evidence"],
    },
  },
  {
    matches: (pathname) => pathname === "/training-providers",
    profile: {
      title: "Training Providers",
      duplicateHeadings: ["Training Providers", "Training Provider Evidence"],
    },
  },
  {
    matches: (pathname) => pathname === "/career",
    profile: {
      title: "Development",
      duplicateHeadings: ["Workforce Development", "Career Evidence", "Career"],
    },
  },
  {
    matches: (pathname) => pathname === "/pilot-impact" || pathname === "/pilot-adoption",
    profile: {
      title: "Pilot Evidence",
      duplicateHeadings: ["Pilot Evidence", "Pilot Impact", "Pilot Adoption"],
    },
  },
  {
    matches: (pathname) => pathname === "/support",
    profile: { title: "Support", duplicateHeadings: ["Support", "Support Evidence"] },
  },
  {
    matches: (pathname) => pathname === "/settings",
    profile: {
      title: "Settings",
      duplicateHeadings: ["Settings", "System & Access"],
    },
  },
  {
    matches: (pathname) => pathname.includes("/maintenance/labour-risk/shift-cover"),
    profile: {
      title: "Shift Cover",
      duplicateHeadings: ["Shift Cover", "Operational Rota Risk Map"],
    },
  },
  {
    matches: (pathname) => pathname.includes("/maintenance/labour-risk/"),
    profile: { title: "Labour Risk", duplicateHeadings: ["Labour Risk"] },
  },
];

const THEME_SHORTCUT_LABELS = new Set(["light", "dark", "system"]);
const MOBILE_DASHBOARD_LOGO_SELECTOR =
  '[data-vorta-mobile-dashboard-logo-link="true"]';

function normaliseText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function fallbackTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "Dashboard";
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function profileForPath(pathname: string): MobilePageProfile {
  return (
    PAGE_PROFILES.find(({ matches }) => matches(pathname))?.profile ?? {
      title: fallbackTitle(pathname),
      duplicateHeadings: [],
    }
  );
}

function clearDuplicateThemeShortcuts(): void {
  document
    .querySelectorAll<HTMLElement>('[data-vorta-mobile-settings-duplicate-theme-toggle="true"]')
    .forEach((control) =>
      control.removeAttribute("data-vorta-mobile-settings-duplicate-theme-toggle"),
    );
}

function removeSettingsHeaderThemeShortcut(pathname: string): void {
  clearDuplicateThemeShortcuts();
  if (pathname !== "/settings") return;

  const mobileSettings = document.querySelector<HTMLElement>(
    '[data-vorta-mobile-settings="true"]',
  );
  if (!mobileSettings) return;

  const appearanceSection = Array.from(
    mobileSettings.querySelectorAll<HTMLElement>("section"),
  ).find((section) =>
    Array.from(section.querySelectorAll<HTMLHeadingElement>("h2")).some(
      (heading) => normaliseText(heading.textContent) === "appearance",
    ),
  );

  document
    .querySelectorAll<HTMLElement>('button, [role="button"]')
    .forEach((control) => {
      if (appearanceSection?.contains(control)) return;
      if (!THEME_SHORTCUT_LABELS.has(normaliseText(control.textContent))) return;
      control.setAttribute("data-vorta-mobile-settings-duplicate-theme-toggle", "true");
    });
}

const MOBILE_PAGE_HEADER_STYLES = `
@media (max-width: 767px) {
  [data-vorta-portal-shell="true"] > section > div.md\\:hidden {
    position: relative !important;
    min-height: 4rem !important;
    padding-inline: 0.75rem !important;
  }

  [data-vorta-portal-shell="true"] > section > div.md\\:hidden::after {
    position: absolute !important;
    inset-inline: 4rem !important;
    top: 50% !important;
    display: block !important;
    min-width: 0 !important;
    overflow: hidden !important;
    transform: translateY(-50%) !important;
    color: rgb(226 232 240) !important;
    content: attr(data-vorta-mobile-header-title) !important;
    font-size: 1.125rem !important;
    font-weight: 650 !important;
    line-height: 1.4rem !important;
    text-align: center !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    pointer-events: none !important;
  }

  ${MOBILE_DASHBOARD_LOGO_SELECTOR} {
    cursor: pointer !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: manipulation;
  }

  ${MOBILE_DASHBOARD_LOGO_SELECTOR}:focus,
  ${MOBILE_DASHBOARD_LOGO_SELECTOR}:focus-visible,
  ${MOBILE_DASHBOARD_LOGO_SELECTOR}:active {
    border: 0 !important;
    box-shadow: none !important;
    outline: none !important;
  }

  ${MOBILE_DASHBOARD_LOGO_SELECTOR}:focus-visible {
    opacity: 0.78;
  }

  [data-vorta-mobile-duplicate-page-title="true"] {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    clip-path: inset(50%) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }

  [data-vorta-mobile-settings-duplicate-theme-toggle="true"] {
    display: none !important;
  }
}
`;

export function MobilePageHeaderExperience(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const profile = profileForPath(location.pathname);
    const duplicateHeadings = new Set(profile.duplicateHeadings.map(normaliseText));

    const applyHeader = (): void => {
      if (!window.matchMedia("(max-width: 767px)").matches) {
        clearDuplicateThemeShortcuts();
        return;
      }

      const topBar = document.querySelector<HTMLElement>(
        '[data-vorta-portal-shell="true"] > section > div.md\\:hidden',
      );
      if (topBar?.dataset.vortaMobileHeaderTitle !== profile.title) {
        topBar?.setAttribute("data-vorta-mobile-header-title", profile.title);
      }

      const dashboardLogo = topBar?.querySelector<HTMLElement>(":scope > :not(button)");
      dashboardLogo?.setAttribute("data-vorta-mobile-dashboard-logo-link", "true");
      dashboardLogo?.setAttribute("role", "link");
      dashboardLogo?.setAttribute("tabindex", "0");
      dashboardLogo?.setAttribute("aria-label", "Go to main dashboard");

      const portal = document.querySelector<HTMLElement>(
        '[data-vorta-maintenance-portal="true"]',
      );
      if (!portal) return;

      portal
        .querySelectorAll<HTMLElement>('[data-vorta-mobile-duplicate-page-title="true"]')
        .forEach((heading) => heading.removeAttribute("data-vorta-mobile-duplicate-page-title"));

      if (duplicateHeadings.size > 0) {
        const duplicate = Array.from(portal.querySelectorAll<HTMLHeadingElement>("h1")).find(
          (heading) => duplicateHeadings.has(normaliseText(heading.textContent)),
        );
        duplicate?.setAttribute("data-vorta-mobile-duplicate-page-title", "true");
      }

      removeSettingsHeaderThemeShortcut(location.pathname);
    };

    const handleDashboardLogoClick = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(MOBILE_DASHBOARD_LOGO_SELECTOR)) return;
      navigate("/dashboard");
    };

    const handleDashboardLogoKeyDown = (event: Event): void => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(MOBILE_DASHBOARD_LOGO_SELECTOR)) return;
      event.preventDefault();
      navigate("/dashboard");
    };

    const frame = window.requestAnimationFrame(applyHeader);
    const shell = document.querySelector('[data-vorta-portal-shell="true"] > section');
    const observer = new MutationObserver(applyHeader);
    if (shell) {
      observer.observe(shell, { childList: true, subtree: true, characterData: true });
      shell.addEventListener("click", handleDashboardLogoClick);
      shell.addEventListener("keydown", handleDashboardLogoKeyDown);
    }
    window.addEventListener("resize", applyHeader);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      shell?.removeEventListener("click", handleDashboardLogoClick);
      shell?.removeEventListener("keydown", handleDashboardLogoKeyDown);
      window.removeEventListener("resize", applyHeader);
      clearDuplicateThemeShortcuts();
    };
  }, [location.pathname, navigate]);

  return <style data-vorta-mobile-page-header="true">{MOBILE_PAGE_HEADER_STYLES}</style>;
}
