import { useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { SkillsMatrixSection as SkillsMatrixSelectionExperience } from "./SkillsMatrixSelectionExperience";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const SKILLS_MATRIX_OPTIONS = {
  body: { schemaVersion: "capability-v3" },
};
const PAYLOAD_EVENT = "vorta:skills-matrix-polished-payload";

type ScopeSummary = {
  code: string;
  name: string;
  score: number;
  skillsCoverage: number;
  experienceDepth: number;
  smeResilience: number;
  validationHealth: number;
  criticalGaps: number;
  spofCount: number;
  status: "Strong" | "Moderate" | "At risk" | "Critical";
  [key: string]: unknown;
};

type SkillsMatrixPayload = {
  overall: ScopeSummary;
  teams: ScopeSummary[];
  departments: ScopeSummary[];
  details: Record<string, unknown>;
  [key: string]: unknown;
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function capabilityStatus(score: number): ScopeSummary["status"] {
  if (score < 55) return "Critical";
  if (score < 70) return "At risk";
  if (score < 85) return "Moderate";
  return "Strong";
}

function normalisePayload(payload: SkillsMatrixPayload): SkillsMatrixPayload {
  const teams = payload.teams.map((team) => ({
    ...team,
    name:
      team.code === "CALIBRATION"
        ? "Calibration Team"
        : team.code === "OT"
          ? "Operational Technology Team"
          : team.name,
  }));
  const shiftTeams = teams.filter((team) =>
    ["RED", "GREEN", "BLUE", "YELLOW", "DAYS"].includes(team.code),
  );
  const specialistTeams = teams.filter((team) =>
    ["CALIBRATION", "OT"].includes(team.code),
  );
  const criticalTeams = teams.filter(
    (team) => team.status === "Critical" || team.score < 55,
  );
  const criticalTeamShare = criticalTeams.length / Math.max(1, teams.length);

  let score = Math.round(
    payload.overall.skillsCoverage * 0.3 +
      average(shiftTeams.map((team) => team.score)) * 0.3 +
      average(specialistTeams.map((team) => team.score)) * 0.15 +
      payload.overall.experienceDepth * 0.1 +
      payload.overall.smeResilience * 0.1 +
      payload.overall.validationHealth * 0.05 -
      criticalTeamShare * 12,
  );

  if (teams.some((team) => team.score < 30)) {
    score = Math.min(score, 59);
  }
  score = Math.round(clamp(score));

  return {
    ...payload,
    teams,
    overall: {
      ...payload.overall,
      score,
      status: capabilityStatus(score),
      criticalGaps: criticalTeams.length,
      spofCount: teams.filter((team) => team.spofCount > 0).length,
    },
  };
}

function isSkillsMatrixPayload(value: unknown): value is SkillsMatrixPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SkillsMatrixPayload>;
  return Boolean(candidate.overall && Array.isArray(candidate.teams) && candidate.details);
}

export const SkillsMatrixSection = (): JSX.Element => {
  useEffect(() => {
    let correctionTimer = 0;
    const replayPayload = window.setTimeout(() => {
      void supabase.functions
        .invoke(SKILLS_MATRIX_FUNCTION, SKILLS_MATRIX_OPTIONS)
        .then(({ data, error }) => {
          if (error || !isSkillsMatrixPayload(data)) return;
          const corrected = normalisePayload(data);
          correctionTimer = window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent<SkillsMatrixPayload>(PAYLOAD_EVENT, {
                detail: corrected,
              }),
            );
          }, 25);
        });
    }, 50);

    return () => {
      window.clearTimeout(replayPayload);
      window.clearTimeout(correctionTimer);
    };
  }, []);

  return <SkillsMatrixSelectionExperience />;
};
