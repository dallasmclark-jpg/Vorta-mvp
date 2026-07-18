import type { ReactNode } from "react";

export function ProgressBar({ value }: { value: number }): JSX.Element {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-slate-800"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
    >
      <div
        className="h-full rounded-full bg-blue-500 transition-[width] duration-500"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export function FieldLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <label className={`grid gap-1.5 text-xs font-medium text-slate-400 ${className}`}>
      {children}
    </label>
  );
}

export function LoadingState(): JSX.Element {
  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col gap-5 overflow-x-hidden px-4 pb-12 pt-0 md:px-6 xl:px-8">
      <div className="h-28 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="h-20 animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
      <div className="h-[460px] animate-pulse rounded-xl border border-gray-800 bg-[#141820]" />
    </section>
  );
}
