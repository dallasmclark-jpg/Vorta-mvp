import { useEffect, useState } from "react";

// Checked once at module load — avoids per-render matchMedia calls.
const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Extracts the first integer/decimal from a string.
// e.g. "74%" → { pre:"", num:74, suf:"%" }
//      "3"   → { pre:"", num:3,  suf:"" }
//      "—"   → { pre:"—", num:null, suf:"" }
//      "Medium" → { pre:"Medium", num:null, suf:"" }
function parse(v: string): { pre: string; num: number | null; suf: string } {
  const m = v.match(/^([^0-9]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return { pre: v, num: null, suf: "" };
  return { pre: m[1], num: parseFloat(m[2]), suf: m[3] };
}

interface CountUpNumberProps {
  value: string;
  /** Animation duration in ms. Default 600. */
  duration?: number;
  /** Delay before counting starts in ms. Default 0. */
  delay?: number;
  className?: string;
}

export function CountUpNumber({ value, duration = 600, delay = 0, className }: CountUpNumberProps): JSX.Element {
  const { pre, num, suf } = parse(value);
  const [count, setCount] = useState(REDUCED ? (num ?? 0) : 0);

  useEffect(() => {
    if (num === null) return;
    if (REDUCED) { setCount(num); return; }

    setCount(0);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let raf: number;

    timeoutId = setTimeout(() => {
      const startTime = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 2);
        setCount(Math.round(eased * num));
        if (progress < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(raf);
    };
  }, [num, duration, delay]);

  if (num === null) return <span className={className}>{value}</span>;
  return <span className={className}>{pre}{count}{suf}</span>;
}
