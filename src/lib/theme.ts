export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "vorta:appearance";
const THEME_EVENT = "vorta:theme-change";
const DARK_BACKGROUND = "#0b0e14";
const LIGHT_BACKGROUND = "#f8fafc";

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  if (typeof window === "undefined") return "dark";

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

let currentPreference: ThemePreference = readStoredPreference();
let currentResolvedTheme: ResolvedTheme = resolveTheme(currentPreference);
const subscribers = new Set<() => void>();

function updateThemeColour(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;

  const colour = theme === "light" ? LIGHT_BACKGROUND : DARK_BACKGROUND;
  const themeColour = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColour?.setAttribute("content", colour);
}

function applyTheme(preference: ThemePreference): void {
  currentPreference = preference;
  currentResolvedTheme = resolveTheme(preference);

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(currentResolvedTheme);
    root.dataset.themePreference = preference;
    root.style.colorScheme = currentResolvedTheme;
    root.style.backgroundColor =
      currentResolvedTheme === "light" ? LIGHT_BACKGROUND : DARK_BACKGROUND;
    updateThemeColour(currentResolvedTheme);
  }
}

function emitChange(): void {
  subscribers.forEach((subscriber) => subscriber());

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(THEME_EVENT, {
        detail: {
          preference: currentPreference,
          resolvedTheme: currentResolvedTheme,
        },
      }),
    );
  }
}

export function getThemePreference(): ThemePreference {
  return currentPreference;
}

export function getResolvedTheme(): ResolvedTheme {
  return currentResolvedTheme;
}

export function setThemePreference(preference: ThemePreference): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // The theme still applies for this session when storage is unavailable.
    }
  }

  applyTheme(preference);
  emitChange();
}

export function subscribeTheme(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function initialiseTheme(): void {
  applyTheme(readStoredPreference());
}

if (typeof window !== "undefined") {
  initialiseTheme();

  const colourScheme = window.matchMedia("(prefers-color-scheme: light)");
  const handleSystemThemeChange = (): void => {
    if (currentPreference !== "system") return;
    applyTheme("system");
    emitChange();
  };

  colourScheme.addEventListener("change", handleSystemThemeChange);

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const preference = isThemePreference(event.newValue) ? event.newValue : "system";
    applyTheme(preference);
    emitChange();
  });
}
