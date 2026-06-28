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
  className?: string;
}

/**
 * Renders a string value. If the value contains a number, that number counts
 * up from 0 to the final value on mount / when the numeric value changes.
 * Non-numeric values (e.g. "—", "Medium") render instantly and statically.
 * Respects prefers-reduced-motion.
 */
export function CountUpNumber({ value, duration = 600, className }: CountUpNumberProps): JSX.Element {
  const { pre, num, suf } = parse(value);
  const [count, setCount] = useState(REDUCED ? (num ?? 0) : 0);

  useEffect(() => {
    if (num === null) return;
    if (REDUCED) { setCount(num); return; }

    setCount(0);
    const startTime = performance.now();
    let raf: number;

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease-out quadratic: fast start, decelerate to final value.
      const eased = 1 - Math.pow(1 - progress, 2);
      setCount(Math.round(eased * num));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [num, duration]);

  if (num === null) return <span className={className}>{value}</span>;
  return <span className={className}>{pre}{count}{suf}</span>;
}
