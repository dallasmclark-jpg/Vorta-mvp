export const TEAM_ORDER: Record<string, number> = {
  RED: 1,
  GREEN: 2,
  BLUE: 3,
  YELLOW: 4,
  DAYS: 5,
  CALIBRATION: 6,
  OT: 7,
};

export const SHIFT_CODES = new Set(["RED", "GREEN", "BLUE", "YELLOW", "DAYS"]);
export const SPECIALIST_CODES = new Set(["CALIBRATION", "OT"]);

export const CRITICALITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function numeric(value: unknown, fallback = 0): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

export function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function round(value: number): number {
  return Math.round(clamp(value));
}

export function average(values: number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

export function lower(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function latestIso(values: unknown[], fallback: string): string {
  let latest = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (typeof value !== "string" || !value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) latest = Math.max(latest, timestamp);
  }
  return Number.isFinite(latest) ? new Date(latest).toISOString() : fallback;
}

export function criticality(row: any, equipment: any): string {
  const requirementLevel = lower(row?.criticality);
  const equipmentLevel = lower(equipment?.criticality);
  return (CRITICALITY_WEIGHT[requirementLevel] ?? 0) >=
      (CRITICALITY_WEIGHT[equipmentLevel] ?? 0)
    ? requirementLevel || equipmentLevel || "medium"
    : equipmentLevel || requirementLevel || "medium";
}

export function isCurrentMember(row: any, today: string): boolean {
  if (row.active_from && row.active_from > today) return false;
  if (row.active_to && row.active_to < today) return false;
  return true;
}

export function isValidDate(value: unknown, today: string): boolean {
  return typeof value !== "string" || !value || value >= today;
}

export function validationState(assignment: any, today: string): string {
  if (!assignment) return "missing";
  if (assignment.expiry_date && assignment.expiry_date < today) return "expired";
  const status = lower(assignment.verification_status);
  if (status === "validated") return "validated";
  if (status === "pending" || status === "pending_validation") return "pending";
  if (status === "rejected") return "rejected";
  return "unverified";
}

export function statusFromScore(score: number, priorityRisks: any[]): string {
  const uncoveredCritical = priorityRisks.some(
    (row) => row.isCritical && row.qualifiedCount === 0,
  );
  const criticalGap = priorityRisks.some(
    (row) => row.isCritical && row.gap > 0,
  );
  if (uncoveredCritical || score < 55) return "Critical";
  if (criticalGap || score < 70) return "At risk";
  if (score < 85) return "Moderate";
  return "Strong";
}

export function recommendedAction(row: any): string {
  if (row.qualifiedCount === 0) {
    return `Develop or source ${row.minimumRequired} qualified ${row.skillName} engineer${row.minimumRequired === 1 ? "" : "s"}.`;
  }
  if (row.validationGap > 0 && row.gap === 0) {
    return `Validate ${row.validationGap} existing capability record${row.validationGap === 1 ? "" : "s"}.`;
  }
  if (row.gap > 0) {
    return `Cross-train ${row.gap} additional engineer${row.gap === 1 ? "" : "s"} to the required level.`;
  }
  if (row.singlePoint) {
    return "Create a second competent cover and complete knowledge transfer.";
  }
  return "Maintain competency through planned work and periodic validation.";
}

export function scoreGain(row: any): number {
  const base = row.qualifiedCount === 0 ? 8 : row.gap > 0 ? 5 : 2;
  const criticalityBoost = (CRITICALITY_WEIGHT[row.criticality] ?? 1) * 1.5;
  return Math.round(Math.min(18, base + criticalityBoost + row.gap * 2));
}
