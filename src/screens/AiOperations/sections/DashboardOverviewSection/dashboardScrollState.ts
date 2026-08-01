const DASHBOARD_SCROLL_KEY = "vorta:maintenance-dashboard:scroll-top";
const DASHBOARD_WORK_PLAN_KEY =
  "vorta:maintenance-dashboard:work-plan-expanded";
const PORTAL_SCROLL_SELECTOR = '[data-vorta-portal-scroll-container="true"]';
const EXPANDED_WORK_PLAN_SELECTOR =
  '[data-vorta-biggest-reduction-opportunity="true"]';

function portalScrollContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(PORTAL_SCROLL_SELECTOR);
}

function currentScrollTop(): number {
  const container = portalScrollContainer();
  return container ? container.scrollTop : window.scrollY;
}

function restoreAfterHistoryNavigation(): void {
  window.removeEventListener("popstate", restoreAfterHistoryNavigation);
  window.requestAnimationFrame(() => {
    restoreDashboardScrollPosition();
  });
}

function clearDashboardReturnState(): void {
  window.sessionStorage.removeItem(DASHBOARD_SCROLL_KEY);
  window.sessionStorage.removeItem(DASHBOARD_WORK_PLAN_KEY);
  window.removeEventListener("popstate", restoreAfterHistoryNavigation);
}

export function saveDashboardScrollPosition(): void {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    DASHBOARD_WORK_PLAN_KEY,
    document.querySelector(EXPANDED_WORK_PLAN_SELECTOR) ? "true" : "false",
  );

  const scrollTop = currentScrollTop();
  if (!Number.isFinite(scrollTop) || scrollTop <= 0) return;

  window.sessionStorage.setItem(DASHBOARD_SCROLL_KEY, String(scrollTop));
  window.removeEventListener("popstate", restoreAfterHistoryNavigation);
  window.addEventListener("popstate", restoreAfterHistoryNavigation);
}

export function restoreDashboardWorkPlanExpanded(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(DASHBOARD_WORK_PLAN_KEY) === "true";
}

export function restoreDashboardScrollPosition(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const stored = Number(window.sessionStorage.getItem(DASHBOARD_SCROLL_KEY));
  if (!Number.isFinite(stored) || stored <= 0) {
    window.sessionStorage.removeItem(DASHBOARD_WORK_PLAN_KEY);
    window.removeEventListener("popstate", restoreAfterHistoryNavigation);
    return () => undefined;
  }

  let cancelled = false;
  let frame = 0;
  let attempts = 0;
  const maxAttempts = 180;

  const restore = (): void => {
    if (cancelled) return;

    const container = portalScrollContainer();
    const maximum = container
      ? Math.max(0, container.scrollHeight - container.clientHeight)
      : Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const next = Math.min(stored, maximum);

    if (container) {
      container.scrollTop = next;
    } else {
      window.scrollTo({ top: next, left: 0, behavior: "auto" });
    }

    const actual = currentScrollTop();
    const contentCanReachStoredPosition = maximum >= stored - 1;
    const restored = Math.abs(actual - next) <= 1;

    if (restored && contentCanReachStoredPosition) {
      clearDashboardReturnState();
      return;
    }

    attempts += 1;
    if (attempts >= maxAttempts) {
      clearDashboardReturnState();
      return;
    }

    frame = window.requestAnimationFrame(restore);
  };

  frame = window.requestAnimationFrame(restore);

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frame);
  };
}
