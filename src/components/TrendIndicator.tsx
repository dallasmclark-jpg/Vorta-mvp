import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export type TrendDirection = "up" | "down" | "flat";

interface TrendIndicatorProps {
  direction: TrendDirection;
  label: string;
  /** Whether upward movement is good (green) or bad (red). Defaults to true. */
  positiveIsUp?: boolean;
  className?: string;
}

export const TrendIndicator = ({
  direction,
  label,
  positiveIsUp = true,
  className = "",
}: TrendIndicatorProps): JSX.Element => {
  const isPositive =
    direction === "flat"
      ? null
      : positiveIsUp
      ? direction === "up"
      : direction === "down";

  const colour =
    isPositive === null
      ? "text-slate-500"
      : isPositive
      ? "text-emerald-400"
      : "text-red-400";

  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <span className={`inline-flex items-center gap-1 ${colour} ${className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </span>
  );
};
