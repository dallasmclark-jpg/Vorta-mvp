const WORKFORCE_PATHS = new Set([
  "/engineers",
  "/production/operators",
  "/maintenance/labour-risk/shift-cover",
]);
const AVATAR_SELECTOR = "div.flex.shrink-0.items-center.justify-center.font-bold";
const HUMAN_NAME = /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,2}$/;

const NON_NAME_LABELS = new Set([
  "All Operators",
  "Engineer Register",
  "Production Manager",
  "Operator Portal",
  "On Shift",
  "High Risk",
  "Medium Risk",
  "Low Risk",
  "Critical Risk",
  "Available Cover Pool",
  "Shift Cover Risk",
]);

function hashName(name: string): number {
  let hash = 0;
  for (const character of name.trim().toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) & 0x7fffffff;
  }
  return hash;
}

function demoPortraitUrl(name: string): string {
  const portraitNumber = (hashName(name) % 70) + 1;
  return `https://i.pravatar.cc/160?img=${portraitNumber}`;
}

function isLikelyName(value: string): boolean {
  return value.length <= 48 && HUMAN_NAME.test(value) && !NON_NAME_LABELS.has(value);
}

function firstNameFrom(container: Element | null, selectors: string[]): string | null {
  if (!container) return null;

  for (const selector of selectors) {
    for (const element of Array.from(container.querySelectorAll(selector))) {
      const value = element.textContent?.trim() ?? "";
      if (isLikelyName(value)) return value;
    }
  }

  return null;
}

function findProfileName(avatar: HTMLElement): string | null {
  const row = avatar.closest("tr");
  const rowName = firstNameFrom(row, [
    "td:first-child p.font-medium",
    "td:first-child p.font-semibold",
    "td:first-child span.font-medium",
    "td:first-child span.font-semibold",
    "td:first-child p",
    "td:first-child span",
  ]);
  if (rowName) return rowName;

  const drawerHeader = avatar.closest("div.border-b.border-gray-800.p-5");
  const drawerName = firstNameFrom(drawerHeader, ["h2"]);
  if (drawerName) return drawerName;

  const mobileCard = avatar.closest("div.rounded-xl.border.p-4");
  const mobileName = firstNameFrom(mobileCard, [
    "p.font-medium",
    "p.font-semibold",
    "span.font-medium",
    "span.font-semibold",
    "p",
  ]);
  if (mobileName) return mobileName;

  let ancestor: Element | null = avatar.parentElement;
  for (let depth = 0; ancestor && depth < 7; depth += 1, ancestor = ancestor.parentElement) {
    const genericName = firstNameFrom(ancestor, [
      "h2",
      "p.text-sm.font-semibold",
      "p.font-semibold",
      "p.font-medium",
      "span.text-sm.font-semibold",
      "span.font-semibold",
      "span.font-medium",
    ]);
    if (genericName) return genericName;
  }

  return null;
}

function isAvatarPlaceholder(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.dataset.vortaProfilePhoto === "true") return false;
  if (element.querySelector("img")) return false;

  const initials = element.textContent?.trim() ?? "";
  return /^[A-Z]{2,3}$/.test(initials);
}

function applyProfilePhoto(avatar: HTMLElement, name: string): void {
  avatar.dataset.vortaProfilePhoto = "loading";

  const image = new Image();
  image.alt = `${name} profile photo`;
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.src = demoPortraitUrl(name);

  image.onload = () => {
    if (!avatar.isConnected) return;

    avatar.textContent = "";
    image.className = "h-full w-full object-cover object-center";
    avatar.appendChild(image);
    avatar.dataset.vortaProfilePhoto = "true";
    avatar.setAttribute("aria-label", `${name} profile photo`);
    avatar.style.overflow = "hidden";
    avatar.style.backgroundColor = "#111827";
    avatar.style.border = "1px solid rgba(255, 255, 255, 0.10)";
    avatar.style.boxShadow = "inset 0 0 0 1px rgba(255, 255, 255, 0.04)";
  };

  image.onerror = () => {
    delete avatar.dataset.vortaProfilePhoto;
  };
}

function enhanceWorkforcePhotos(): void {
  if (!WORKFORCE_PATHS.has(window.location.pathname)) return;

  for (const element of Array.from(document.querySelectorAll(AVATAR_SELECTOR))) {
    if (!isAvatarPlaceholder(element)) continue;
    const name = findProfileName(element);
    if (!name) continue;
    applyProfilePhoto(element, name);
  }
}

let frameId = 0;
function scheduleEnhancement(): void {
  window.cancelAnimationFrame(frameId);
  frameId = window.requestAnimationFrame(enhanceWorkforcePhotos);
}

const observer = new MutationObserver(scheduleEnhancement);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", scheduleEnhancement);
window.addEventListener("load", scheduleEnhancement);
scheduleEnhancement();
