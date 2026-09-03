import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OperationalRotaRiskMap } from "../Engineers/OperationalRotaRiskMap";

function MobileCoverageKey(): JSX.Element {
  return (
    <details
      data-vorta-engineer-rota-key="true"
      className="mt-3 rounded-lg border border-slate-800/80 bg-white/[0.025] px-3 py-2.5 md:hidden"
    >
      <summary className="cursor-pointer list-none text-xs font-semibold text-slate-300 marker:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>Coverage &amp; risk key</span>
          <span className="text-slate-600">⌄</span>
        </span>
      </summary>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-medium">
        <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-1 text-emerald-300">
          Fully Covered
        </span>
        <span className="rounded border border-amber-500/30 bg-amber-500/20 px-2 py-1 text-amber-300">
          Reduced Cover
        </span>
        <span className="rounded border border-orange-500/30 bg-orange-500/20 px-2 py-1 text-orange-300">
          Partial Cover
        </span>
        <span className="rounded border border-red-500/30 bg-red-500/20 px-2 py-1 text-red-300">
          Critical Gap
        </span>
        <span className="rounded border border-blue-500/30 bg-blue-500/20 px-2 py-1 text-blue-300">
          Contractor Cover
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[9px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-red-500" /> Missing Skill
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-amber-400" /> Reduced Resilience
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-purple-400" /> SME Dependency
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-blue-400" /> Contractor Involved
        </span>
      </div>
    </details>
  );
}

export function EngineerRotaScreen(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [legendTarget, setLegendTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let centreTimer: number | null = null;

    const locateHeader = (): void => {
      const section = root.querySelector<HTMLElement>(
        '[data-vorta-operational-rota-risk-map="true"]',
      );
      const card = section?.lastElementChild as HTMLElement | null;
      const header = card?.firstElementChild as HTMLElement | null;
      if (header && header !== legendTarget) setLegendTarget(header);
    };

    const centreCurrentDay = (): void => {
      const teamLabel = Array.from(root.querySelectorAll<HTMLElement>("div")).find(
        (node) => node.textContent?.trim() === "Team / Shift",
      );
      const scroller = teamLabel?.closest<HTMLElement>(".overflow-x-auto");
      if (!scroller || scroller.clientWidth >= scroller.scrollWidth) return;

      const today = new Date();
      const mondayIndex = (today.getDay() + 6) % 7;
      const teamColumnWidth = 108;
      const dayColumnWidth = 104;
      const target =
        teamColumnWidth +
        mondayIndex * dayColumnWidth -
        (scroller.clientWidth - dayColumnWidth) / 2;

      scroller.scrollTo({ left: Math.max(0, target), behavior: "auto" });

      const headerGrid = teamLabel?.parentElement;
      if (headerGrid) {
        Array.from(headerGrid.children).forEach((child) =>
          child.classList.remove("vorta-engineer-rota-today"),
        );
        const todayHeader = headerGrid.children[mondayIndex + 1] as HTMLElement | undefined;
        const expected = new Intl.DateTimeFormat("en-GB", {
          weekday: "short",
          day: "numeric",
        }).format(today);
        if (todayHeader?.textContent?.trim() === expected) {
          todayHeader.classList.add("vorta-engineer-rota-today");
        }
      }
    };

    const scheduleCentre = (): void => {
      if (centreTimer !== null) window.clearTimeout(centreTimer);
      centreTimer = window.setTimeout(() => {
        locateHeader();
        centreCurrentDay();
      }, 80);
    };

    locateHeader();
    scheduleCentre();
    const delayedCentre = window.setTimeout(scheduleCentre, 700);

    const observer = new MutationObserver(scheduleCentre);
    observer.observe(root, { childList: true, subtree: true });

    const handleClick = (event: MouseEvent): void => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button) return;
      const label = button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "";
      if (
        label === "Today" ||
        label.startsWith("Previous week") ||
        label.startsWith("Next week")
      ) {
        window.setTimeout(scheduleCentre, 120);
      }
    };
    root.addEventListener("click", handleClick);

    return () => {
      observer.disconnect();
      root.removeEventListener("click", handleClick);
      window.clearTimeout(delayedCentre);
      if (centreTimer !== null) window.clearTimeout(centreTimer);
    };
  }, [legendTarget]);

  return (
    <div
      ref={rootRef}
      data-vorta-page-content="true"
      data-vorta-engineer-rota="true"
      data-vorta-engineer-rota-responsive="true"
      className="flex min-h-full w-full min-w-0 flex-1 flex-col"
    >
      <style>{`
        @media (max-width: 767px) {
          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] {
            gap: 0 !important;
            overflow: visible !important;
            padding: 0.75rem 0.75rem 2rem !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child {
            border-radius: 1rem !important;
            padding: 1rem !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div:first-child {
            gap: 0 !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div:first-child > div:first-child > div:first-child {
            display: block !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] h1 {
            font-size: 0 !important;
            line-height: 1 !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] h1::after {
            content: "Rota";
            font-size: 1.125rem;
            font-weight: 600;
            letter-spacing: -0.02em;
            color: #f8fafc;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] h1 ~ * {
            display: none !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div:first-child > div:first-child > p,
          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div:first-child > div:nth-child(2) {
            display: none !important;
          }

          [data-vorta-engineer-rota-key="true"] {
            width: 100%;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 {
            margin-top: 0.875rem !important;
            gap: 0.65rem !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:first-child {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.5rem !important;
            width: 100%;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:first-child > button {
            width: 100%;
            min-width: 0;
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
            white-space: nowrap;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:first-child > button:nth-child(4) {
            display: none !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:nth-child(2) {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 2.25rem auto 2.25rem;
            align-items: center;
            gap: 0.4rem !important;
            width: 100%;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:nth-child(2) > span {
            grid-column: 1;
            grid-row: 1;
            min-width: 0 !important;
            text-align: left !important;
            font-size: 0.72rem !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:nth-child(2) > button:nth-child(2) {
            grid-column: 2;
            grid-row: 1;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:nth-child(2) > button:nth-child(1) {
            grid-column: 3;
            grid-row: 1;
            min-width: 3.6rem;
            padding-left: 0.7rem !important;
            padding-right: 0.7rem !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:nth-child(2) > button:nth-child(4) {
            grid-column: 4;
            grid-row: 1;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div.mt-5.flex.flex-col.gap-3 > div:nth-child(2) > button:nth-child(n+5) {
            display: none !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] div.mt-5.overflow-x-auto {
            margin-top: 0.75rem !important;
            margin-left: -0.25rem;
            margin-right: -0.25rem;
            padding-bottom: 0.4rem !important;
            scroll-behavior: smooth;
            scrollbar-width: none;
            overscroll-behavior-x: contain;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] div.mt-5.overflow-x-auto::-webkit-scrollbar {
            display: none;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] div.mt-5.overflow-x-auto > div {
            width: max-content;
            min-width: 836px !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] div.mt-5.overflow-x-auto > div > .grid:first-child,
          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] div.mt-5.overflow-x-auto > div > .divide-y > div > .grid {
            grid-template-columns: 108px repeat(7, 104px) !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] div.mt-5.overflow-x-auto > div > .grid:first-child > div:first-child,
          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] div.mt-5.overflow-x-auto > div > .divide-y > div > .grid > div:first-child {
            position: sticky;
            left: 0;
            z-index: 15;
            background: #141820;
            border-right: 1px solid rgba(51, 65, 85, 0.55);
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] div.mt-5.overflow-x-auto > div > .divide-y > div > .grid > div:first-child {
            padding-right: 0.45rem !important;
          }

          [data-vorta-engineer-rota-responsive="true"] .vorta-engineer-rota-today {
            border-radius: 0.45rem;
            background: rgba(59, 130, 246, 0.1);
            color: #93c5fd !important;
          }

          [data-vorta-engineer-rota-responsive="true"] [data-vorta-operational-rota-risk-map="true"] > div:last-child > div:last-child {
            margin-top: 0.75rem !important;
            gap: 0.35rem !important;
            line-height: 1.45;
          }
        }
      `}</style>

      {legendTarget ? createPortal(<MobileCoverageKey />, legendTarget) : null}
      <OperationalRotaRiskMap />
    </div>
  );
}
