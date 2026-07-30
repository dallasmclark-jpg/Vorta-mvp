export type VortaShiftType = "day" | "night" | string;

export interface VortaShiftPresentation {
  label: string;
  dotClassName: string;
  textClassName: string;
}

/**
 * Shared shift-type presentation derived from the established Shift Cover rota
 * palette: yellow for day work and blue for night work. Text always accompanies
 * the colour so operational meaning never depends on colour alone.
 */
const SHIFT_TYPE_PRESENTATION: Record<"day" | "night", VortaShiftPresentation> = {
  day: {
    label: "Day",
    dotClassName: "bg-yellow-400",
    textClassName: "text-yellow-300",
  },
  night: {
    label: "Night",
    dotClassName: "bg-blue-400",
    textClassName: "text-blue-300",
  },
};

export function getVortaShiftPresentation(
  shiftType: VortaShiftType,
  suppliedLabel?: string,
): VortaShiftPresentation {
  const normalised = shiftType.trim().toLowerCase();
  const known = normalised === "day" || normalised === "night"
    ? SHIFT_TYPE_PRESENTATION[normalised]
    : null;
  if (known) return suppliedLabel ? { ...known, label: suppliedLabel } : known;
  return {
    label: suppliedLabel?.trim() || shiftType.trim() || "Shift",
    dotClassName: "bg-slate-400",
    textClassName: "text-slate-300",
  };
}
