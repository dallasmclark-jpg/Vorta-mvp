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

type PortraitCollection = "men" | "women";

interface CuratedPortrait {
  collection: PortraitCollection;
  image: number;
}

/**
 * Explicit demo-only portrait assignments.
 *
 * These are curated synthetic personas rather than random name-to-image hashes.
 * Unknown profiles deliberately keep their initials until a customer-controlled
 * profile photo URL is available.
 */
const CURATED_DEMO_PORTRAITS: Record<string, CuratedPortrait> = {
  // Maintenance engineers
  "Alex Turner": { collection: "men", image: 11 },
  "Amelia Fox": { collection: "women", image: 11 },
  "Andrew Patel": { collection: "men", image: 12 },
  "Ben Cooper": { collection: "men", image: 13 },
  "Ben Harrison": { collection: "men", image: 14 },
  "Callum Scott": { collection: "men", image: 15 },
  "Charlotte Reed": { collection: "women", image: 12 },
  "Chloe Williams": { collection: "women", image: 13 },
  "Chris Morgan": { collection: "men", image: 16 },
  "Daniel Roberts": { collection: "men", image: 17 },
  "Dylan Morris": { collection: "men", image: 18 },
  "Emma Clarke": { collection: "women", image: 14 },
  "Ethan White": { collection: "men", image: 19 },
  "Gareth Owen": { collection: "men", image: 20 },
  "Grace Murphy": { collection: "women", image: 15 },
  "Hannah Lewis": { collection: "women", image: 16 },
  "Hannah Roberts": { collection: "women", image: 17 },
  "Isla Green": { collection: "women", image: 18 },
  "Jack Price": { collection: "men", image: 21 },
  "James Mitchell": { collection: "men", image: 22 },
  "Josh Edwards": { collection: "men", image: 23 },
  "Laura Davies": { collection: "women", image: 19 },
  "Leanne Carter": { collection: "women", image: 20 },
  "Luke Harrison": { collection: "men", image: 24 },
  "Matthew Evans": { collection: "men", image: 25 },
  "Matthew Lewis": { collection: "men", image: 26 },
  "Megan Ellis": { collection: "women", image: 21 },
  "Mohammed Khan": { collection: "men", image: 27 },
  "Natalie Morgan": { collection: "women", image: 22 },
  "Nathan Brooks": { collection: "men", image: 28 },
  "Nia Roberts": { collection: "women", image: 23 },
  "Oliver Clarke": { collection: "men", image: 29 },
  "Olivia Bennett": { collection: "women", image: 24 },
  "Owen Griffiths": { collection: "men", image: 30 },
  "Priya Shah": { collection: "women", image: 25 },
  "Rebecca Hughes": { collection: "women", image: 26 },
  "Rhys Thomas": { collection: "men", image: 31 },
  "Sophie Bennett": { collection: "women", image: 27 },
  "Sophie Williams": { collection: "women", image: 28 },
  "Zara Ahmed": { collection: "women", image: 29 },

  // Shift-cover demo engineers
  "James Hadley": { collection: "men", image: 32 },
  "Sarah Mitchell": { collection: "women", image: 30 },
  "Tom Okafor": { collection: "men", image: 33 },
  "Emma Patel": { collection: "women", image: 31 },
  "Liam Donovan": { collection: "men", image: 34 },
  "Paul Kenton": { collection: "men", image: 35 },
  "Aisha Mensah": { collection: "women", image: 32 },
  "Dan Forsyth": { collection: "men", image: 36 },
  "Ben Thomas": { collection: "men", image: 37 },
  "Chloe Watts": { collection: "women", image: 33 },
  "Ryan Tate": { collection: "men", image: 38 },
  "Priya Sharma": { collection: "women", image: 34 },

  // Production operators
  "Sarah Hughes": { collection: "women", image: 35 },
  "Mark Evans": { collection: "men", image: 39 },
  "Aisha Khan": { collection: "women", image: 36 },
  "Tom Roberts": { collection: "men", image: 40 },
  "James Miller": { collection: "men", image: 41 },
  "Emily Davies": { collection: "women", image: 37 },
  "Owen Price": { collection: "men", image: 42 },
};

function demoPortraitUrl(name: string): string | null {
  const portrait = CURATED_DEMO_PORTRAITS[name.trim()];
  if (!portrait) return null;
  return `https://randomuser.me/api/portraits/${portrait.collection}/${portrait.image}.jpg`;
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
  if (element.dataset.vortaProfilePhoto) return false;
  if (element.querySelector("img")) return false;

  const initials = element.textContent?.trim() ?? "";
  return /^[A-Z]{2,3}$/.test(initials);
}

function applyProfilePhoto(avatar: HTMLElement, name: string): void {
  const portraitUrl = demoPortraitUrl(name);
  if (!portraitUrl) {
    avatar.dataset.vortaProfilePhoto = "initials";
    return;
  }

  avatar.dataset.vortaProfilePhoto = "loading";

  const image = new Image();
  image.alt = `${name} demo profile portrait`;
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.src = portraitUrl;

  image.onload = () => {
    if (!avatar.isConnected) return;

    avatar.textContent = "";
    image.className = "h-full w-full object-cover object-center";
    avatar.appendChild(image);
    avatar.dataset.vortaProfilePhoto = "true";
    avatar.setAttribute("aria-label", `${name} demo profile portrait`);
    avatar.style.overflow = "hidden";
    avatar.style.backgroundColor = "#111827";
    avatar.style.border = "1px solid rgba(255, 255, 255, 0.10)";
    avatar.style.boxShadow = "inset 0 0 0 1px rgba(255, 255, 255, 0.04)";
  };

  image.onerror = () => {
    avatar.dataset.vortaProfilePhoto = "initials";
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
