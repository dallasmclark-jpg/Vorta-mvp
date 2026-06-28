import { LucideIcon } from "lucide-react";
import { Button } from "./ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps): JSX.Element => (
  <div className={`flex flex-col items-center justify-center gap-4 py-12 text-center ${className}`}>
    {Icon && (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-800 bg-[#111620]">
        <Icon className="h-5 w-5 text-slate-500" />
      </div>
    )}
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="max-w-xs text-sm text-slate-500">{description}</p>
    </div>
    {action && (
      <Button
        type="button"
        onClick={action.onClick}
        className="h-auto bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
      >
        {action.label}
      </Button>
    )}
  </div>
);
