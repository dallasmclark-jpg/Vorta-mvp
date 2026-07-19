import { useEffect, useRef, useState } from "react";

const useInViewOnce = <T extends HTMLElement,>(
  threshold = 0.25,
) => {
  const elementRef = useRef<T>(null);
  const [hasEnteredView, setHasEnteredView] =
    useState(false);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    const prefersReducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

    if (
      prefersReducedMotion ||
      !("IntersectionObserver" in window)
    ) {
      setHasEnteredView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setHasEnteredView(true);
        observer.disconnect();
      },
      {
        threshold,
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return {
    elementRef,
    hasEnteredView,
  };
};

// ─── RiskMeter ────────────────────────────────────────────────────────────────

export const RiskMeter = ({
  value,
  fillClassName,
  animate = false,
  ariaLabel = "Risk score",
}: {
  value: number;
  fillClassName: string;
  animate?: boolean;
  ariaLabel?: string;
}) => {
  const {
    elementRef,
    hasEnteredView,
  } = useInViewOnce<HTMLDivElement>();

  const [
    isEmphasising,
    setIsEmphasising,
  ] = useState(false);

  const clampedValue = Math.max(
    0,
    Math.min(100, value),
  );

  const displayedValue =
    animate && !hasEnteredView
      ? 0
      : clampedValue;

  useEffect(() => {
    if (
      !animate ||
      !hasEnteredView ||
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
    ) {
      return;
    }

    setIsEmphasising(true);

    const timeoutId = window.setTimeout(
      () => {
        setIsEmphasising(false);
      },
      850,
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [animate, hasEnteredView]);

  return (
    <div
      ref={elementRef}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clampedValue}
      className={`relative h-3 w-full overflow-visible rounded-lg bg-[#050914] ring-1 ring-inset ring-slate-600/45 transition-shadow duration-300 ${
        isEmphasising
          ? "shadow-[0_0_10px_rgba(255,255,255,0.10)]"
          : ""
      }`}
    >
      <div
        className={`h-full rounded-lg opacity-80 ${
          animate
            ? "motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
            : ""
        } ${fillClassName}`}
        style={{
          width: `${displayedValue}%`,
        }}
      />

      <span
        className={`absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-white/75 shadow-[0_0_4px_rgba(255,255,255,0.22)] ${
          animate
            ? "motion-safe:transition-[left] motion-safe:duration-700 motion-safe:ease-out"
            : ""
        }`}
        style={{
          left:
            displayedValue <= 0
              ? "0"
              : `calc(${displayedValue}% - 1px)`,
        }}
        aria-hidden="true"
      />
    </div>
  );
};
