import { useEffect, useState } from "react";

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const [count, setCount] = useState(0);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    if (num === null) {
      setCounting(false);
      return;
    }
    if (REDUCED) {
      setCount(num);
      setCounting(false);
      return;
    }

    setCounting(false);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;

    timeoutId = setTimeout(() => {
      setCount(0);
      setCounting(true);
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
  return <span className={className}>{pre}{counting ? count : num}{suf}</span>;
}
