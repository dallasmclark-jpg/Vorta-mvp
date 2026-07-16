const WORK_ORDER_DETAIL_EVENT = "vorta-work-order-detail";

function getWorkOrderNumber(anchor: HTMLAnchorElement): string | null {
  const firstLabel = anchor.querySelector("span")?.textContent?.trim() ?? "";
  if (firstLabel) return firstLabel;

  return anchor.textContent?.match(/\b(?:WO-\d+|\d{8,14})\b/i)?.[0] ?? null;
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
    event.stopImmediatePropagation();

    anchor
      .closest('[data-vorta-fault-panel="true"]')
      ?.querySelector<HTMLButtonElement>('button[data-vorta-fault-close="true"]')
      ?.click();

    let equipmentId = routeMatch[1];
    try {
      equipmentId = decodeURIComponent(equipmentId);
    } catch {
      // The route value is already usable when it is not URI encoded.
    }

    window.queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent(WORK_ORDER_DETAIL_EVENT, {
          detail: {
            equipmentId,
            workOrderNumber,
          },
        }),
      );
    });
  },
  true,
);
