import { supabase } from "./supabaseClient";

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
type WorkforceEntityType = "engineer" | "operator";

interface CuratedPortrait {
  collection: PortraitCollection;
  image: number;
}

/**
 * Fallbacks are retained only for static demo personas that do not exist as
 * workforce records yet. Real engineers and operators resolve from Supabase.
 */
const CURATED_DEMO_PORTRAITS: Record<string, CuratedPortrait> = {
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
  "Sarah Hughes": { collection: "women", image: 35 },
  "Mark Evans": { collection: "men", image: 39 },
  "Aisha Khan": { collection: "women", image: 36 },
  "Tom Roberts": { collection: "men", image: 40 },
  "James Miller": { collection: "men", image: 41 },
  "Emily Davies": { collection: "women", image: 37 },
  "Owen Price": { collection: "men", image: 42 },
};

const avatarUrlCache = new Map<string, string | null>();

function fallbackPortraitUrl(name: string): string | null {
  const portrait = CURATED_DEMO_PORTRAITS[name.trim()];
  if (!portrait) return null;
  return `https://randomuser.me/api/portraits/${portrait.collection}/${portrait.image}.jpg`;
}

function entityTypeForPath(pathname: string): WorkforceEntityType | null {
  if (pathname === "/engineers") return "engineer";
  if (pathname === "/production/operators") return "operator";
  return null;
}

async function databasePortraitUrl(name: string): Promise<string | null> {
  const entityType = entityTypeForPath(window.location.pathname);
  if (!entityType) return null;

  const cacheKey = `${entityType}:${name.trim()}`;
  if (avatarUrlCache.has(cacheKey)) return avatarUrlCache.get(cacheKey) ?? null;

  const { data, error } = await supabase
    .rpc("vorta_get_workforce_avatar_by_name", {
      p_entity_type: entityType,
      p_name: name.trim(),
    })
    .maybeSingle();

  const row = data as { avatar_url?: unknown } | null;
  const url =
    !error && typeof row?.avatar_url === "string"
      ? row.avatar_url.trim() || null
      : null;
  avatarUrlCache.set(cacheKey, url);
  return url;
}

async function resolvePortraitUrl(name: string): Promise<string | null> {
  return (await databasePortraitUrl(name)) ?? fallbackPortraitUrl(name);
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

async function applyProfilePhoto(avatar: HTMLElement, name: string): Promise<void> {
  avatar.dataset.vortaProfilePhoto = "loading";
  const portraitUrl = await resolvePortraitUrl(name);

  if (!avatar.isConnected) return;
  if (!portraitUrl) {
    avatar.dataset.vortaProfilePhoto = "initials";
    return;
  }

  const image = new Image();
  image.alt = `${name} profile portrait`;
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.src = portraitUrl;

  image.onload = () => {
    if (!avatar.isConnected) return;

    avatar.textContent = "";
    image.className = "h-full w-full object-cover object-center";
    avatar.appendChild(image);
    avatar.dataset.vortaProfilePhoto = "true";
    avatar.setAttribute("aria-label", `${name} profile portrait`);
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
    void applyProfilePhoto(element, name);
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
