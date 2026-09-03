import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function sentenceCase(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Completed";
  if (trimmed === trimmed.toUpperCase()) {
    const lower = trimmed.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return trimmed;
}

function cleanOutcome(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "Completed";
  if (/verification\s+passed|work\s+completed|completed/i.test(normalized)) return "Completed";
  if (/open|outstanding/i.test(normalized)) return "Open";
  if (/progress|started/i.test(normalized)) return "In progress";
  return sentenceCase(normalized).slice(0, 28);
}

function cleanDescription(value: string): { description: string; asset: string } {
  const normalized = value.trim().replace(/\s+/g, " ");
  const assetMatch = normalized.match(/^([A-Z]{1,5}-[A-Z0-9-]{1,12})\s*:\s*/i);
  const asset = assetMatch?.[1]?.toUpperCase() ?? "";
  const withoutAsset = assetMatch ? normalized.slice(assetMatch[0].length) : normalized;
  const description = withoutAsset
    .replace(/^work\s+completed[,.:;\s-]*/i, "")
    .replace(/^verification\s+passed[,.:;\s-]*/i, "")
    .trim();

  return {
    description: description || "Previous maintenance activity recorded for this equipment.",
    asset,
  };
}

function cleanWorkOrderMeta(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const parts = normalized.split("·").map((part) => part.trim()).filter(Boolean);
  const date = parts.at(-1) ?? "";
  const numberMatch = normalized.match(/(?:WO[-\s]*)?(\d{5,})/i);
  const number = numberMatch?.[1];

  if (number) return `WO-${number}${date ? ` · ${date}` : ""}`;
  return normalized.replace(/^WO[-\s]*/i, "WO-");
}

function polishSimilarWorkHistory(): void {
  const root = document.querySelector<HTMLElement>('[data-vorta-engineer-work-order-detail="true"]');
  if (!root) return;

  const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
  const section = sections.find((candidate) => {
    const heading = candidate.querySelector("h2");
    const text = heading?.textContent?.trim();
    return text === "Previous Similar Work" || text === "Similar Previous Work";
  });
  if (!section) return;

  section.dataset.vortaSimilarWork = "true";
  const heading = section.querySelector<HTMLHeadingElement>("h2");
  if (heading && heading.textContent?.trim() !== "Similar Previous Work") {
    heading.textContent = "Similar Previous Work";
  }

  const list = section.querySelector<HTMLElement>("div.divide-y");
  if (!list) return;
  list.dataset.vortaSimilarWorkList = "true";

  const rows = Array.from(list.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "DIV",
  );

  rows.forEach((row, index) => {
    row.dataset.vortaSimilarWorkRow = "true";
    if (!list.dataset.vortaSimilarExpanded && index >= 3) row.hidden = true;
    if (list.dataset.vortaSimilarExpanded) row.hidden = false;

    const content = row.querySelector<HTMLElement>(":scope > div:first-child");
    const meta = content?.querySelector<HTMLParagraphElement>("p:first-child");
    const description = content?.querySelector<HTMLParagraphElement>("p:nth-of-type(2)");
    const outcome = row.querySelector<HTMLElement>(":scope > span:last-child");

    if (meta && !meta.dataset.vortaCleaned) {
      meta.textContent = cleanWorkOrderMeta(meta.textContent ?? "");
      meta.dataset.vortaCleaned = "true";
    }

    let asset = "";
    if (description && !description.dataset.vortaCleaned) {
      const cleaned = cleanDescription(description.textContent ?? "");
      description.textContent = cleaned.description;
      asset = cleaned.asset;
      description.dataset.vortaAsset = asset;
      description.dataset.vortaCleaned = "true";
    } else if (description) {
      asset = description.dataset.vortaAsset ?? "";
    }

    if (content && !content.querySelector('[data-vorta-similar-footer="true"]')) {
      const footer = document.createElement("div");
      footer.dataset.vortaSimilarFooter = "true";

      if (asset) {
        const assetLabel = document.createElement("span");
        assetLabel.textContent = asset;
        footer.appendChild(assetLabel);
      }

      const statusLabel = document.createElement("span");
      statusLabel.textContent = cleanOutcome(outcome?.textContent ?? "Completed");
      statusLabel.dataset.vortaSimilarStatus = "true";
      footer.appendChild(statusLabel);
      content.appendChild(footer);
    }

    if (outcome) outcome.dataset.vortaOriginalOutcome = "true";
  });

  if (rows.length > 3 && !section.querySelector('[data-vorta-view-all-history="true"]')) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.vortaViewAllHistory = "true";
    button.textContent = "View all previous work →";
    button.addEventListener("click", () => {
      const expanded = list.dataset.vortaSimilarExpanded === "true";
      if (expanded) {
        delete list.dataset.vortaSimilarExpanded;
        rows.forEach((row, index) => { row.hidden = index >= 3; });
        button.textContent = "View all previous work →";
      } else {
        list.dataset.vortaSimilarExpanded = "true";
        rows.forEach((row) => { row.hidden = false; });
        button.textContent = "Show less ↑";
      }
    });
    section.appendChild(button);
  }
}

export function EngineerSearchPillStyles(): JSX.Element {
  const location = useLocation();

  useEffect(() => {
    if (!location.pathname.includes("/engineer/work/")) return;

    const timer = window.setTimeout(polishSimilarWorkHistory, 0);
    const observer = new MutationObserver(polishSimilarWorkHistory);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [location.pathname]);

  return (
    <style>{`
      /* Engineer page search bars are true pills, including inputs without an explicit type attribute. */
      [data-vorta-engineer-shell="true"] input[placeholder^="Search "] {
        border-radius: 9999px !important;
      }

      /* Compact, readable work-history cards on Engineer work-order detail. */
      [data-vorta-similar-work="true"] {
        overflow: hidden;
      }

      [data-vorta-similar-work-list="true"] {
        display: grid !important;
        gap: 0.65rem !important;
      }

      [data-vorta-similar-work-row="true"] {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        padding: 0.85rem !important;
        border: 1px solid rgba(51, 65, 85, 0.72) !important;
        border-radius: 0.85rem !important;
        background: #07172b !important;
      }

      [data-vorta-similar-work-row="true"] > div:first-child {
        width: 100% !important;
        min-width: 0 !important;
      }

      [data-vorta-similar-work-row="true"] p:first-child {
        margin: 0 !important;
        color: #60a5fa !important;
        font-size: 0.72rem !important;
        font-weight: 650 !important;
        line-height: 1.15rem !important;
        letter-spacing: 0 !important;
        overflow-wrap: anywhere;
      }

      [data-vorta-similar-work-row="true"] p:nth-of-type(2) {
        display: -webkit-box;
        margin-top: 0.35rem !important;
        overflow: hidden;
        color: #cbd5e1 !important;
        font-size: 0.82rem !important;
        line-height: 1.3rem !important;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
      }

      [data-vorta-original-outcome="true"] {
        display: none !important;
      }

      [data-vorta-similar-footer="true"] {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        margin-top: 0.7rem;
        color: #64748b;
        font-size: 0.68rem;
        line-height: 1rem;
      }

      [data-vorta-similar-footer="true"] > span + span::before {
        content: "·";
        margin-right: 0.45rem;
        color: #475569;
      }

      [data-vorta-similar-status="true"] {
        color: #94a3b8;
        font-weight: 600;
      }

      [data-vorta-view-all-history="true"] {
        display: inline-flex;
        min-height: 2.65rem;
        align-items: center;
        margin-top: 0.85rem;
        padding: 0 0.2rem;
        border: 0;
        background: transparent;
        color: #60a5fa;
        font-size: 0.76rem;
        font-weight: 650;
        cursor: pointer;
      }

      [data-vorta-view-all-history="true"]:hover {
        color: #93c5fd;
      }

      @media (min-width: 640px) {
        [data-vorta-similar-work-list="true"] {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `}</style>
  );
}
