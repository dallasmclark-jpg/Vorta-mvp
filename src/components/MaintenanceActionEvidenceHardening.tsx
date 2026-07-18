import { useEffect } from "react";

const FIELD_ORDER = [
  "Finding",
  "Source evidence",
  "Responsible person or team",
  "System where action occurs",
  "Completion evidence",
  "Expected risk reduction",
] as const;

type EvidenceField = (typeof FIELD_ORDER)[number];

const FIELD_ALIASES = new Map<string, EvidenceField>([
  ["finding", "Finding"],
  ["issue", "Finding"],
  ["risk finding", "Finding"],
  ["source", "Source evidence"],
  ["source evidence", "Source evidence"],
  ["evidence", "Source evidence"],
  ["owner", "Responsible person or team"],
  ["responsible", "Responsible person or team"],
  ["responsible person", "Responsible person or team"],
  ["responsible team", "Responsible person or team"],
  ["assigned to", "Responsible person or team"],
  ["system", "System where action occurs"],
  ["action system", "System where action occurs"],
  ["system of action", "System where action occurs"],
  ["completion", "Completion evidence"],
  ["completion evidence", "Completion evidence"],
  ["proof of completion", "Completion evidence"],
  ["expected reduction", "Expected risk reduction"],
  ["risk reduction", "Expected risk reduction"],
  ["expected risk reduction", "Expected risk reduction"],
]);

const ACTION_TEXT =
  /risk|action|work order|training|requirement|recommend|finding|completion|evidence/i;

function cleanLabel(value: string): string {
  return value.trim().replace(/\s*[:：]\s*$/, "").toLowerCase();
}

function directValue(label: HTMLElement): string | null {
  if (label.tagName === "DT") {
    const sibling = label.nextElementSibling;
    return sibling?.textContent?.trim() || null;
  }

  const sibling = label.nextElementSibling as HTMLElement | null;
  if (sibling?.textContent?.trim()) return sibling.textContent.trim();

  const parentText = label.parentElement?.textContent?.trim() ?? "";
  const labelText = label.textContent?.trim() ?? "";
  const remainder = parentText.replace(labelText, "").trim().replace(/^[:：·\-]\s*/, "");
  return remainder || null;
}

function findCard(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>(
    "article, li, tr, section > div[class*='rounded'], section > div[class*='border']",
  );
}

function summariseCard(card: HTMLElement): void {
  if (card.dataset.vortaEvidenceSummaryReady === "true") return;
  if (!ACTION_TEXT.test(card.textContent ?? "")) return;

  const values = new Map<EvidenceField, string>();
  card
    .querySelectorAll<HTMLElement>("dt, th, [data-label], p, span")
    .forEach((label) => {
      if (label.childElementCount > 0) return;
      const canonical = FIELD_ALIASES.get(cleanLabel(label.textContent ?? ""));
      if (!canonical || values.has(canonical)) return;
      const value = directValue(label);
      if (value && value !== label.textContent?.trim()) values.set(canonical, value);
    });

  if (values.size < 2) return;

  const summary = document.createElement("dl");
  summary.dataset.vortaEvidenceSummary = "true";
  summary.className =
    "mt-3 grid gap-2 rounded-lg border border-slate-700/70 bg-slate-950/25 p-3 sm:grid-cols-2";

  FIELD_ORDER.forEach((field) => {
    const value = values.get(field);
    if (!value) return;

    const group = document.createElement("div");
    group.className = "min-w-0";

    const term = document.createElement("dt");
    term.className = "text-xs font-semibold text-slate-500";
    term.textContent = field;

    const description = document.createElement("dd");
    description.className = "mt-0.5 break-words text-xs leading-5 text-slate-300";
    description.textContent = value;

    group.append(term, description);
    summary.append(group);
  });

  card.append(summary);
  card.dataset.vortaEvidenceSummaryReady = "true";
}

export function MaintenanceActionEvidenceHardening(): JSX.Element {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      '[data-vorta-maintenance-portal="true"]',
    );
    if (!root) return undefined;

    let frame = 0;

    const synchronise = (): void => {
      root
        .querySelectorAll<HTMLElement>("dt, th, [data-label], p, span")
        .forEach((label) => {
          if (!FIELD_ALIASES.has(cleanLabel(label.textContent ?? ""))) return;
          const card = findCard(label);
          if (card) summariseCard(card);
        });
    };

    const schedule = (): void => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(synchronise);
    };

    synchronise();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <style>{`
      [data-vorta-maintenance-portal="true"] [class*="text-[8px]"],
      [data-vorta-maintenance-portal="true"] [class*="text-[8.5px]"] {
        font-size: 0.75rem !important;
        line-height: 1rem !important;
      }

      @media (max-width: 1024px) {
        [data-vorta-maintenance-portal="true"] main button,
        [data-vorta-maintenance-portal="true"] main [role="button"],
        [data-vorta-maintenance-portal="true"] [role="dialog"] button,
        [data-vorta-maintenance-portal="true"] [role="dialog"] [role="button"] {
          min-height: 2.75rem;
        }
      }
    `}</style>
  );
}
