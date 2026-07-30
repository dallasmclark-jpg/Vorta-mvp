export type VortaMaintenanceTeamCode =
  | "BLUE"
  | "RED"
  | "GREEN"
  | "YELLOW"
  | "DAYS"
  | "CALIBRATION"
  | "UNASSIGNED";

export interface VortaMaintenanceTeamPresentation {
  code: VortaMaintenanceTeamCode;
  label: string;
  dotClassName: string;
  textClassName: string;
  badgeClassName: string;
}

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
 * Canonical Vorta maintenance-team palette. These colour families are the same
 * ones used by Skills Matrix team scopes. They are deliberately independent of
 * Shift Calendar event colours so a team keeps one identity throughout Vorta.
 */
export const VORTA_MAINTENANCE_TEAM_PRESENTATION: Record<
  VortaMaintenanceTeamCode,
  VortaMaintenanceTeamPresentation
> = {
  BLUE: {
    code: "BLUE",
    label: "Blue Shift",
    dotClassName: "bg-blue-400",
    textClassName: "text-blue-300",
    badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  },
  RED: {
    code: "RED",
    label: "Red Shift",
    dotClassName: "bg-red-400",
    textClassName: "text-red-300",
    badgeClassName: "border-red-500/30 bg-red-500/10 text-red-200",
  },
  GREEN: {
    code: "GREEN",
    label: "Green Shift",
    dotClassName: "bg-emerald-400",
    textClassName: "text-emerald-300",
    badgeClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  YELLOW: {
    code: "YELLOW",
    label: "Yellow Shift",
    dotClassName: "bg-yellow-400",
    textClassName: "text-yellow-300",
    badgeClassName: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
  },
  DAYS: {
    code: "DAYS",
    label: "Day Shift",
    dotClassName: "bg-slate-300",
    textClassName: "text-slate-200",
    badgeClassName: "border-slate-500/40 bg-slate-400/10 text-slate-200",
  },
  CALIBRATION: {
    code: "CALIBRATION",
    label: "Calibration Team",
    dotClassName: "bg-violet-400",
    textClassName: "text-violet-300",
    badgeClassName: "border-violet-400/35 bg-violet-500/10 text-violet-200",
  },
  UNASSIGNED: {
    code: "UNASSIGNED",
    label: "Team unassigned",
    dotClassName: "bg-slate-500",
    textClassName: "text-slate-400",
    badgeClassName: "border-slate-700 bg-slate-800/60 text-slate-300",
  },
};

// Compatibility alias for completed-shift review-period presentation contracts.
export const SHIFT_TEAM_PRESENTATION = VORTA_MAINTENANCE_TEAM_PRESENTATION;

export const VORTA_MAINTENANCE_TEAM_CODES: readonly VortaMaintenanceTeamCode[] = [
  "BLUE",
  "RED",
  "GREEN",
  "YELLOW",
  "DAYS",
  "CALIBRATION",
];

function normaliseTeamCode(teamCode: string | null, teamName = ""): VortaMaintenanceTeamCode | null {
  const suppliedCode = teamCode?.trim().toUpperCase();
  if (suppliedCode && suppliedCode in VORTA_MAINTENANCE_TEAM_PRESENTATION) {
    return suppliedCode as VortaMaintenanceTeamCode;
  }

  const suppliedName = teamName.trim().toUpperCase();
  if (/^BLUE\b/.test(suppliedName)) return "BLUE";
  if (/^RED\b/.test(suppliedName)) return "RED";
  if (/^GREEN\b/.test(suppliedName)) return "GREEN";
  if (/^YELLOW\b/.test(suppliedName)) return "YELLOW";
  if (/^(DAYS?|DAY SHIFT)\b/.test(suppliedName)) return "DAYS";
  if (/^CALIBRATION\b/.test(suppliedName)) return "CALIBRATION";
  if (/UNASSIGNED/.test(suppliedName)) return "UNASSIGNED";
  return null;
}

export function getVortaMaintenanceTeamPresentation(
  teamCode: string | null,
  teamName?: string | null,
): VortaMaintenanceTeamPresentation {
  const code = normaliseTeamCode(teamCode, teamName ?? "") ?? "UNASSIGNED";
  return VORTA_MAINTENANCE_TEAM_PRESENTATION[code];
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
  const known = normaliseTeamCode(teamCode, cleanTeamName);

  if (cleanTeamName && known) {
    const presentation = VORTA_MAINTENANCE_TEAM_PRESENTATION[known];
    return {
      label: `${compactTeamName(cleanTeamName)} · ${cleanShiftLabel}`,
      dotClassName: presentation.dotClassName,
      textClassName: presentation.textClassName,
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
