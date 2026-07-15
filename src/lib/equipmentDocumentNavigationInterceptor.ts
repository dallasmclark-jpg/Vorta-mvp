function isControlledEquipmentDocumentUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.href);
    return (
      url.origin === window.location.origin &&
      /^\/equipment\/[^/]+\/documents\/[^/?#]+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function normaliseControlledDocumentLinks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    if (!isControlledEquipmentDocumentUrl(anchor.href)) return;
    anchor.target = '_self';
    anchor.removeAttribute('rel');
  });
}

normaliseControlledDocumentLinks();

document.addEventListener(
  'click',
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
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || !isControlledEquipmentDocumentUrl(anchor.href)) return;

    event.preventDefault();
    window.location.assign(anchor.href);
  },
  true,
);

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof Element) normaliseControlledDocumentLinks(node);
    });
  });
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
