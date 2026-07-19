export type VortaDataMode = "live" | "demo" | "unavailable";

const VALID_DATA_MODES = new Set<VortaDataMode>([
  "live",
  "demo",
  "unavailable",
]);

export function getConfiguredDataMode(): VortaDataMode {
  const configured = String(
    import.meta.env.VITE_VORTA_DATA_MODE ?? "",
  )
    .trim()
    .toLowerCase() as VortaDataMode;

  if (VALID_DATA_MODES.has(configured)) {
    return configured;
  }

  return import.meta.env.PROD ? "unavailable" : "demo";
}

export function getEffectiveDataMode(
  hasActiveSite: boolean,
): VortaDataMode {
  if (!hasActiveSite) {
    return "unavailable";
  }

  return getConfiguredDataMode();
}

export function demoFallbacksAllowed(): boolean {
  return getConfiguredDataMode() === "demo";
}

export class VortaDataUnavailableError extends Error {
  readonly code = "VORTA_DATA_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "VortaDataUnavailableError";
  }
}
