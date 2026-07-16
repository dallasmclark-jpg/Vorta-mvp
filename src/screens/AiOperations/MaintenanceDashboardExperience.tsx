import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { DashboardOverviewSection } from "./sections/DashboardOverviewSection";

interface DashboardFreshness {
  maintenanceDataAt: string | null;
  workforceDataAt: string | null;
  riskCalculatedAt: string | null;
}

const STALE_AFTER_MS = 30 * 60 * 1000;

function timestampOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

function parseFreshness(payload: unknown): DashboardFreshness | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const freshness = (payload as Record<string, unknown>).freshness;
  if (!freshness || typeof freshness !== "object" || Array.isArray(freshness)) {
    return null;
  }

  const record = freshness as Record<string, unknown>;
  return {
    maintenanceDataAt: timestampOrNull(record.maintenanceDataAt),
    workforceDataAt: timestampOrNull(record.workforceDataAt),
    riskCalculatedAt: timestampOrNull(record.riskCalculatedAt),
  };
}

function ageInMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : Math.max(0, Date.now() - timestamp);
}

function isStale(value: string | null): boolean {
  const age = ageInMilliseconds(value);
  return age === null || age > STALE_AFTER_MS;
}

function formatRelativeTime(value: string | null): string {
  const age = ageInMilliseconds(value);
  if (age === null) return "unavailable";

  const minutes = Math.round(age / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value as string));
}

function findDashboardContainer(
  scopeTabs: Element,
  root: HTMLElement,
): HTMLElement | null {
  let current = scopeTabs.parentElement;

  while (current && current !== root) {
    if (
      current.classList.contains("flex") &&
      current.classList.contains("flex-col") &&
      current.classList.contains("gap-5")
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function directHeader(container: HTMLElement): HTMLElement | null {
  return (
    Array.from(container.children).find(
      (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "HEADER",
    ) ?? null
  );
}

export function MaintenanceDashboardExperience(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const originalRefreshRef = useRef<HTMLButtonElement | null>(null);
  const backgroundRefreshStartedRef = useRef(false);
  const [controlHost, setControlHost] = useState<HTMLElement | null>(null);
  const [freshnessHost, setFreshnessHost] = useState<HTMLElement | null>(null);
  const [freshness, setFreshness] = useState<DashboardFreshness | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const loadFreshness = useCallback(async (): Promise<DashboardFreshness | null> => {
    const { data, error } = await supabase.rpc(
      "vorta_get_operational_dashboard_snapshot",
    );

    if (error) {
      console.warn("Dashboard freshness could not be loaded:", error.message);
      return null;
    }

    const parsed = parseFreshness(data);
    setFreshness(parsed);
    return parsed;
  }, []);

  const refreshDashboard = useCallback(async (): Promise<void> => {
    if (refreshing) return;

    setRefreshing(true);
    setRefreshError(null);

    try {
      const { data, error } = await supabase.rpc(
        "vorta_recalculate_and_get_operational_dashboard",
      );

      if (error) throw error;

      const parsed = parseFreshness(data);
      setFreshness(parsed);

      // The existing dashboard reload remains responsible for rendering the
      // newly calculated snapshot. Its legacy work-plan refresh is now a
      // permission-checked compatibility no-op at the database boundary.
      originalRefreshRef.current?.click();
    } catch (error) {
      console.warn("Risk intelligence refresh failed:", error);
      setRefreshError("Refresh failed. The previous calculated snapshot remains visible.");
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    void loadFreshness();
  }, [loadFreshness]);

  useEffect(() => {
    if (
      !freshness?.riskCalculatedAt ||
      backgroundRefreshStartedRef.current ||
      !isStale(freshness.riskCalculatedAt)
    ) {
      return;
    }

    backgroundRefreshStartedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void refreshDashboard();
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [freshness?.riskCalculatedAt, refreshDashboard]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const keyboardCleanups = new Map<HTMLElement, () => void>();
    const dialogCleanups = new Map<HTMLElement, () => void>();

    const enhanceKeyboardCard = (element: HTMLElement): void => {
      if (
        keyboardCleanups.has(element) ||
        element.matches("button,a,input,select,textarea") ||
        element.getAttribute("role")
      ) {
        return;
      }

      element.setAttribute("role", "link");
      element.tabIndex = 0;

      const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.target !== element) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        element.click();
      };

      element.addEventListener("keydown", handleKeyDown);
      keyboardCleanups.set(element, () => {
        element.removeEventListener("keydown", handleKeyDown);
      });
    };

    const enhanceDialog = (dialog: HTMLElement): void => {
      if (dialogCleanups.has(dialog)) return;

      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-label", "Recommended maintenance intervention");

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const closeButton = dialog.querySelector<HTMLButtonElement>(
        'button[aria-label="Close"]',
      );
      const previousFocus = document.activeElement as HTMLElement | null;
      closeButton?.focus();

      const handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") closeButton?.click();
      };

      window.addEventListener("keydown", handleKeyDown);
      dialogCleanups.set(dialog, () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = previousOverflow;
        previousFocus?.focus();
      });
    };

    const syncEnhancements = (): void => {
      const operationsTitle = Array.from(root.querySelectorAll("h1")).find(
        (heading) => heading.textContent?.trim() === "Operations Overview",
      );
      const pageHeader = operationsTitle?.closest("header");
      const actionContainer = pageHeader?.lastElementChild;

      if (actionContainer instanceof HTMLElement) {
        const buttons = Array.from(
          actionContainer.querySelectorAll<HTMLButtonElement>("button"),
        );
        const analysisButton = buttons.find((button) =>
          button.textContent?.includes("Run Risk Analysis"),
        );
        const refreshButton = buttons.find(
          (button) => button.getAttribute("aria-label") === "Refresh",
        );

        for (const button of [analysisButton, refreshButton]) {
          if (button) {
            button.dataset.vortaDashboardOriginalControl = "true";
            button.style.display = "none";
          }
        }

        if (refreshButton) originalRefreshRef.current = refreshButton;

        let host = actionContainer.querySelector<HTMLElement>(
          "[data-vorta-dashboard-control-host]",
        );
        if (!host) {
          host = document.createElement("div");
          host.dataset.vortaDashboardControlHost = "true";
          const profileButton = buttons.find(
            (button) => button.getAttribute("aria-label") === "User profile",
          );
          actionContainer.insertBefore(host, profileButton ?? null);
        }
        setControlHost((current) => (current === host ? current : host));
      }

      const scopeTabs = root.querySelector(
        '[aria-label="Risk intelligence scope"]',
      );
      if (scopeTabs) {
        const dashboardContainer = findDashboardContainer(scopeTabs, root);
        const briefingHeader = dashboardContainer
          ? directHeader(dashboardContainer)
          : null;
        const freshnessContainer = briefingHeader?.children.item(2);

        if (freshnessContainer instanceof HTMLElement) {
          freshnessContainer.classList.add("vorta-live-dashboard-freshness");
          freshnessContainer
            .querySelectorAll<HTMLElement>("p")
            .forEach((element) => {
              element.dataset.vortaDashboardOriginalFreshness = "true";
              element.style.display = "none";
            });

          let host = freshnessContainer.querySelector<HTMLElement>(
            "[data-vorta-dashboard-freshness-host]",
          );
          if (!host) {
            host = document.createElement("div");
            host.dataset.vortaDashboardFreshnessHost = "true";
            freshnessContainer.appendChild(host);
          }
          setFreshnessHost((current) => (current === host ? current : host));
        }
      }

      const navigableSections = Array.from(root.querySelectorAll("section")).filter(
        (section) => {
          const title = section.querySelector(":scope > div h2, :scope > h2");
          const text = title?.textContent?.trim() ?? "";
          return text.includes("Equipment Risk") || text.endsWith("Labour Risk");
        },
      );

      navigableSections.forEach((section) => {
        section
          .querySelectorAll<HTMLElement>(".cursor-pointer")
          .forEach(enhanceKeyboardCard);
      });

      const interventionLabel = Array.from(root.querySelectorAll("p")).find(
        (element) =>
          element.textContent?.trim() === "Recommended Maintenance Intervention",
      );
      const dialog = interventionLabel?.closest<HTMLElement>(
        ".relative.flex.max-h-\\[90vh\\]",
      );
      if (dialog) enhanceDialog(dialog);

      for (const [element, cleanup] of keyboardCleanups) {
        if (!root.contains(element)) {
          cleanup();
          keyboardCleanups.delete(element);
        }
      }

      for (const [element, cleanup] of dialogCleanups) {
        if (!root.contains(element)) {
          cleanup();
          dialogCleanups.delete(element);
        }
      }
    };

    syncEnhancements();
    const observer = new MutationObserver(syncEnhancements);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      keyboardCleanups.forEach((cleanup) => cleanup());
      dialogCleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const freshnessIsStale = isStale(freshness?.riskCalculatedAt ?? null);

  return (
    <div ref={rootRef} data-vorta-dashboard-root="true">
      <style>{`
        .vorta-live-dashboard-freshness::before,
        .vorta-live-dashboard-freshness::after {
          content: none !important;
          display: none !important;
        }

        [data-vorta-dashboard-root="true"] button.animate-pulse {
          animation: none !important;
          border-color: rgb(59 130 246 / 0.4) !important;
          background: rgb(59 130 246 / 0.12) !important;
          color: rgb(147 197 253) !important;
          box-shadow: none !important;
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
      `}</style>

      <DashboardOverviewSection />

      {controlHost
        ? createPortal(
            <div className="flex items-center gap-2">
              {refreshError ? (
                <span
                  role="status"
                  className="hidden max-w-56 text-right text-[11px] leading-4 text-red-300 lg:block"
                >
                  {refreshError}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void refreshDashboard()}
                disabled={refreshing}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 text-sm font-semibold text-slate-50 transition-colors hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing…" : "Refresh risk intelligence"}
              </button>
            </div>,
            controlHost,
          )
        : null}

      {freshnessHost
        ? createPortal(
            <div
              data-vorta-dashboard-freshness-content="true"
              className="flex flex-col gap-0.5 text-left lg:items-end lg:text-right"
            >
              <span
                className={`text-xs font-medium ${
                  freshnessIsStale ? "text-yellow-400" : "text-emerald-400"
                }`}
              >
                Risk calculated {formatRelativeTime(freshness?.riskCalculatedAt ?? null)}
              </span>
              <span className="text-xs text-slate-500">
                Maintenance {formatRelativeTime(freshness?.maintenanceDataAt ?? null)}
                {" · Workforce "}
                {formatRelativeTime(freshness?.workforceDataAt ?? null)}
              </span>
            </div>,
            freshnessHost,
          )
        : null}
    </div>
  );
}
