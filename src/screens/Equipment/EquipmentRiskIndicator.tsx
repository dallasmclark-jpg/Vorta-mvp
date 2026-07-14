interface EquipmentRiskIndicatorProps {
  riskLevel: string;
}

const RISK_DOT_CLASS: Record<string, string> = {
  Critical: "bg-red-500",
  High: "bg-orange-400",
  Medium: "bg-yellow-400",
  Low: "bg-emerald-500",
};

export function EquipmentRiskIndicator({
  riskLevel,
}: EquipmentRiskIndicatorProps): JSX.Element {
  const label = `${riskLevel || "Unknown"} equipment risk`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`h-2 w-2 shrink-0 rounded-full ${
        RISK_DOT_CLASS[riskLevel] ?? "bg-slate-500"
      }`}
    />
  );
}

