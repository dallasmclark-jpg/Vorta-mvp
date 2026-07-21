import { FlaskConical } from "lucide-react";

export function DemoSimulationBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}): JSX.Element {
  return (
    <div
      data-demo-simulation="true"
      className="mx-4 mt-4 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] px-4 py-3 md:mx-6 xl:mx-8"
      role="note"
    >
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">
            Demo simulation · {title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
        </div>
      </div>
    </div>
  );
}
