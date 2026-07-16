function getWorkOrderNumber(anchor: HTMLAnchorElement): string | null {
  const firstLabel = anchor.querySelector("span")?.textContent?.trim() ?? "";
  if (firstLabel) return firstLabel;

  return anchor.textContent?.match(/\b(?:WO-\d+|\d{8,14})\b/i)?.[0] ?? null;
}

function isCompletedRecord(anchor: HTMLAnchorElement): boolean {
  return Array.from(anchor.querySelectorAll("span")).some(
    (element) => element.textContent?.trim().toLowerCase() === "completed",
  );
}

function navigateInsideVorta(path: string): void {
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === path) return;

  window.history.pushState(window.history.state, "", path);
  window.dispatchEvent(
    new PopStateEvent("popstate", {
      state: window.history.state,
    }),
  );
}

document.addEventListener(
  "click",
  (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || !anchor.closest('[data-vorta-fault-panel="true"]')) return;

    const url = new URL(anchor.href, window.location.origin);
    const routeMatch = url.pathname.match(/^\/equipment\/([^/]+)\/history\/?$/);
    if (!routeMatch) return;

    const workOrderNumber = getWorkOrderNumber(anchor);
    if (!workOrderNumber) return;

    event.preventDefault();
    event.stopPropagation();

    anchor
      .closest('[data-vorta-fault-panel="true"]')
      ?.querySelector<HTMLButtonElement>('button[data-vorta-fault-close="true"]')
      ?.click();

    const view = isCompletedRecord(anchor) ? "completed" : "open";
    navigateInsideVorta(
      `/equipment/${routeMatch[1]}/work-orders?workOrder=${encodeURIComponent(
        workOrderNumber,
      )}&view=${view}`,
    );
  },
  true,
);
