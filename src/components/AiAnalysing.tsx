import { Brain } from "lucide-react";

interface AiAnalysingProps {
  message?: string;
  className?: string;
  /** If true, renders as a full-width card-style block. Default: inline. */
  block?: boolean;
}

export const AiAnalysing = ({
  message = "AI is analysing…",
  className = "",
  block = false,
}: AiAnalysingProps): JSX.Element => {
  const dots = (
    <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400"
          style={{
            animation: "dot-blink 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );

  if (block) {
    return (
      <div
        role="status"
        aria-label={message}
        className={`flex items-center gap-3 rounded-xl border border-[#3b82f620] bg-[#0d1523] px-4 py-3 ${className}`}
      >
        <Brain className="h-4 w-4 shrink-0 text-blue-400" aria-hidden />
        <span className="text-sm text-slate-400">{message}</span>
        {dots}
      </div>
    );
  }

  return (
    <span
      role="status"
      aria-label={message}
      className={`inline-flex items-center gap-2 text-sm text-slate-500 ${className}`}
    >
      <Brain className="h-3.5 w-3.5 text-blue-400" aria-hidden />
      {message}
      {dots}
    </span>
  );
};
