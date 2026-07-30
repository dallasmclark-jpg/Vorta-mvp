type AnyRow = Record<string, any>;

type TeamCode = "BLUE" | "RED" | "GREEN" | "YELLOW" | "DAYS" | "CALIBRATION";
type AttributionSource = "recorded" | "historical_membership" | "specialist_scope";

export interface MaintenanceTeamAttribution {
  code: TeamCode;
  name: string;
  source: AttributionSource;
}

const TEAM_LABELS: Record<TeamCode, string> = {
  BLUE: "Blue Shift",
  RED: "Red Shift",
  GREEN: "Green Shift",
  YELLOW: "Yellow Shift",
  DAYS: "Day Shift",
  CALIBRATION: "Calibration Team",
};

const TEAM_CODES = new Set<TeamCode>(Object.keys(TEAM_LABELS) as TeamCode[]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalisedName(value: unknown): string {
  return text(value).toLowerCase().replace(/\s+/g, " ");
}

function normaliseTeamCode(value: unknown, fallbackName: unknown = ""): TeamCode | null {
  const code = text(value).toUpperCase();
  if (TEAM_CODES.has(code as TeamCode)) return code as TeamCode;

  const name = text(fallbackName).toUpperCase();
  if (/^BLUE\b/.test(name)) return "BLUE";
  if (/^RED\b/.test(name)) return "RED";
  if (/^GREEN\b/.test(name)) return "GREEN";
  if (/^YELLOW\b/.test(name)) return "YELLOW";
  if (/^(DAYS?|DAY SHIFT)\b/.test(name)) return "DAYS";
  if (/^CALIBRATION\b/.test(name)) return "CALIBRATION";
  return null;
}

function activityDate(row: AnyRow): string {
  const value = row.confirmation_timestamp ?? row.created_at;
  const date = value ? new Date(value) : new Date(NaN);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

function validOnDate(
  date: string,
  validFrom: unknown,
  validUntil: unknown,
): boolean {
  if (!date) return false;
  const from = text(validFrom);
  const until = text(validUntil);
  return (!from || from <= date) && (!until || until >= date);
}

function isCalibrationSpecialist(engineer: AnyRow | undefined): boolean {
  const discipline = normalisedName(engineer?.discipline);
  return discipline.includes("calibration") || discipline === "instrumentation";
}

function directAttribution(row: AnyRow): MaintenanceTeamAttribution | null {
  const rawCode = row.maintenance_team_code
    ?? row.shift_team_code
    ?? row.team_code
    ?? row.maintenanceTeamCode;
  const rawName = row.maintenance_team_name
    ?? row.shift_team_name
    ?? row.team_name
    ?? row.maintenanceTeamName;
  const code = normaliseTeamCode(rawCode, rawName);
  return code ? { code, name: TEAM_LABELS[code], source: "recorded" } : null;
}

export function attachMaintenanceTeamAttribution(input: {
  confirmations: AnyRow[];
  engineers: AnyRow[];
  identities: AnyRow[];
  memberships: AnyRow[];
  teams: AnyRow[];
}): AnyRow[] {
  const { confirmations, engineers, identities, memberships, teams } = input;
  const engineerById = new Map(engineers.map((row) => [String(row.id), row]));
  const engineersByName = new Map<string, AnyRow[]>();
  for (const engineer of engineers) {
    const key = normalisedName(engineer.full_name);
    if (!key) continue;
    const rows = engineersByName.get(key) ?? [];
    rows.push(engineer);
    engineersByName.set(key, rows);
  }

  const identitiesByPersonnel = new Map<string, AnyRow[]>();
  for (const identity of identities) {
    if (text(identity.source_system).toUpperCase() !== "SAP") continue;
    if (normalisedName(identity.identity_type) !== "personnel_number") continue;
    if (normalisedName(identity.mapping_status) !== "verified") continue;
    const key = text(identity.source_identity);
    if (!key) continue;
    const rows = identitiesByPersonnel.get(key) ?? [];
    rows.push(identity);
    identitiesByPersonnel.set(key, rows);
  }
  for (const rows of identitiesByPersonnel.values()) {
    rows.sort((left, right) => {
      const verifiedDifference = new Date(right.verified_at ?? 0).getTime()
        - new Date(left.verified_at ?? 0).getTime();
      if (verifiedDifference) return verifiedDifference;
      return Number(right.confidence_score ?? 0) - Number(left.confidence_score ?? 0);
    });
  }

  const teamsById = new Map<string, { code: TeamCode; name: string }>();
  let hasExplicitCalibrationTeam = false;
  for (const team of teams) {
    const code = normaliseTeamCode(team.code, team.name);
    if (!code) continue;
    teamsById.set(String(team.id), { code, name: TEAM_LABELS[code] });
    if (code === "CALIBRATION") hasExplicitCalibrationTeam = true;
  }

  const membershipsByEngineer = new Map<string, AnyRow[]>();
  for (const membership of memberships) {
    const engineerId = String(membership.engineer_id ?? "");
    if (!engineerId || !teamsById.has(String(membership.team_id ?? ""))) continue;
    const rows = membershipsByEngineer.get(engineerId) ?? [];
    rows.push(membership);
    membershipsByEngineer.set(engineerId, rows);
  }

  return confirmations.map((row) => {
    const date = activityDate(row);
    const personnelNumber = text(row.personnel_number);
    const identity = personnelNumber
      ? (identitiesByPersonnel.get(personnelNumber) ?? []).find((candidate) =>
          validOnDate(date, candidate.valid_from, candidate.valid_until)
        )
      : null;
    const exactNameMatches = engineersByName.get(normalisedName(row.confirmed_by)) ?? [];
    const engineer = identity
      ? engineerById.get(String(identity.engineer_id))
      : exactNameMatches.length === 1
        ? exactNameMatches[0]
        : undefined;
    const engineerId = engineer ? String(engineer.id) : "";
    const attributions = new Map<TeamCode, MaintenanceTeamAttribution>();
    const direct = directAttribution(row);
    if (direct) attributions.set(direct.code, direct);

    if (engineerId) {
      for (const membership of membershipsByEngineer.get(engineerId) ?? []) {
        if (!validOnDate(date, membership.active_from, membership.active_to)) continue;
        const team = teamsById.get(String(membership.team_id));
        if (!team || attributions.has(team.code)) continue;
        attributions.set(team.code, {
          code: team.code,
          name: team.name,
          source: "historical_membership",
        });
      }

      if (!hasExplicitCalibrationTeam && isCalibrationSpecialist(engineer)) {
        attributions.set("CALIBRATION", {
          code: "CALIBRATION",
          name: TEAM_LABELS.CALIBRATION,
          source: "specialist_scope",
        });
      }
    }

    return {
      ...row,
      resolved_engineer_id: engineerId || null,
      maintenance_teams: [...attributions.values()],
    };
  });
}
