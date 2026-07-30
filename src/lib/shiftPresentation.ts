export interface VortaShiftPresentation {
  label: string;
  dotClassName: string;
  textClassName: string;
}

export interface VortaShiftPresentationInput {
  teamCode: string | null;
  teamName: string | null;
  shiftLabel: string;
}

/**
 * The established Shift Calendar team palette. The scheduled team assignment is
 * supplied by the same rota calendar evidence used by Shift Cover. This map only
 * converts that authoritative team code into the existing Vorta visual tokens.
 */
const SHIFT_TEAM_PRESENTATION: Record<string, Omit<VortaShiftPresentation, "label">> = {
  YELLOW: {
    dotClassName: "bg-yellow-400",
    textClassName: "text-yellow-300",
  },
  RED: {
    dotClassName: "bg-red-400",
    textClassName: "text-red-300",
  },
  GREEN: {
    dotClassName: "bg-emerald-400",
    textClassName: "text-emerald-300",
  },
  BLUE: {
    dotClassName: "bg-blue-400",
    textClassName: "text-blue-300",
  },
  DAYS: {
    dotClassName: "bg-slate-400",
    textClassName: "text-slate-300",
  },
};

function inferredTeamCode(teamCode: string | null, teamName: string | null): string {
  const suppliedCode = teamCode?.trim().toUpperCase();
  if (suppliedCode) return suppliedCode;
  const suppliedName = teamName?.trim().toUpperCase() ?? "";
  return Object.keys(SHIFT_TEAM_PRESENTATION).find((code) => suppliedName.startsWith(code)) ?? "";
}

function compactTeamName(teamName: string): string {
  return teamName.replace(/\s+shift$/i, "").trim();
}

export function getVortaShiftPresentation({
  teamCode,
  teamName,
  shiftLabel,
}: VortaShiftPresentationInput): VortaShiftPresentation {
  const cleanShiftLabel = shiftLabel.trim() || "Shift";
  const cleanTeamName = teamName?.trim() ?? "";
  const known = SHIFT_TEAM_PRESENTATION[inferredTeamCode(teamCode, teamName)];

  if (cleanTeamName && known) {
    return {
      label: `${compactTeamName(cleanTeamName)} · ${cleanShiftLabel}`,
      ...known,
    };
  }

  if (cleanTeamName) {
    return {
      label: `${compactTeamName(cleanTeamName)} · ${cleanShiftLabel}`,
      dotClassName: "bg-slate-400",
      textClassName: "text-slate-300",
    };
  }

  return {
    label: `${cleanShiftLabel} · No rota`,
    dotClassName: "bg-slate-400",
    textClassName: "text-slate-300",
  };
}
