import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { SkillsMatrixSection as SkillsMatrixPolished } from "./SkillsMatrixPolished";

type TeamVisual = {
  border: string;
  background: string;
  glow: string;
};

const TEAM_VISUALS: Record<string, TeamVisual> = {
  "Site Maintenance Capability": {
    border: "#60a5fa",
    background: "rgba(59, 130, 246, 0.08)",
    glow: "rgba(96, 165, 250, 0.25)",
  },
  "Red Shift": {
    border: "#f87171",
    background: "rgba(239, 68, 68, 0.08)",
    glow: "rgba(248, 113, 113, 0.25)",
  },
  "Green Shift": {
    border: "#34d399",
    background: "rgba(16, 185, 129, 0.08)",
    glow: "rgba(52, 211, 153, 0.25)",
  },
  "Blue Shift": {
    border: "#60a5fa",
    background: "rgba(59, 130, 246, 0.08)",
    glow: "rgba(96, 165, 250, 0.25)",
  },
  "Yellow Shift": {
    border: "#facc15",
    background: "rgba(250, 204, 21, 0.08)",
    glow: "rgba(250, 204, 21, 0.25)",
  },
  "Day Team": {
    border: "#cbd5e1",
    background: "rgba(203, 213, 225, 0.07)",
    glow: "rgba(203, 213, 225, 0.2)",
  },
  "Calibration Team": {
    border: "#c084fc",
    background: "rgba(168, 85, 247, 0.09)",
    glow: "rgba(192, 132, 252, 0.28)",
  },
  "Calibration": {
    border: "#c084fc",
    background: "rgba(168, 85, 247, 0.09)",
    glow: "rgba(192, 132, 252, 0.28)",
  },
  "Operational Technology Team": {
    border: "#22d3ee",
    background: "rgba(6, 182, 212, 0.08)",
    glow: "rgba(34, 211, 238, 0.25)",
  },
  "Operational Technology": {
    border: "#22d3ee",
    background: "rgba(6, 182, 212, 0.08)",
    glow: "rgba(34, 211, 238, 0.25)",
  },
};

function textOf(element: Element | null): string {
  return element?.textContent?.trim() ?? "";
}

function findHeading<T extends HTMLElement>(
  root: HTMLElement,
  selector: string,
  value: string,
): T | null {
  return (
    Array.from(root.querySelectorAll<T>(selector)).find(
      (element) => textOf(element) === value,
    ) ?? null
  );
}

function capabilityCards(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"))
    .filter((button) => button.textContent?.includes("Capability & resilience"));
}

function cardTitle(card: HTMLButtonElement): string {
  return textOf(card.querySelector("p"));
}

function ensureSelectedBadge(card: HTMLButtonElement, selected: boolean): void {
  const existing = card.querySelector<HTMLElement>("[data-selected-team-badge]");
  if (!selected) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const header = card.firstElementChild as HTMLElement | null;
  const controls = header?.lastElementChild as HTMLElement | null;
  if (!controls) return;

  const badge = document.createElement("span");
  badge.dataset.selectedTeamBadge = "true";
  badge.textContent = "Selected";
  badge.className =
    "rounded border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-100";
  controls.insertBefore(badge, controls.firstChild);
}

function applyCardSelection(root: HTMLElement): {
  title: string;
  visual: TeamVisual;
  selectedCard: HTMLButtonElement;
} | null {
  const cards = capabilityCards(root);
  const selectedCard = cards.find(
    (card) => card.getAttribute("aria-pressed") === "true",
  );
  if (!selectedCard) return null;

  for (const card of cards) {
    const title = cardTitle(card);
    const visual = TEAM_VISUALS[title] ?? TEAM_VISUALS["Site Maintenance Capability"];
    const selected = card === selectedCard;

    card.style.borderTopColor = visual.border;
    card.style.borderTopWidth = "2px";
    card.style.borderColor = selected ? visual.border : "rgb(31 41 55)";
    card.style.borderTopColor = visual.border;
    card.style.background = selected ? visual.background : "rgb(20 24 32)";
    card.style.boxShadow = selected
      ? `0 0 0 2px ${visual.glow}, 0 12px 28px rgba(0, 0, 0, 0.22)`
      : "none";
    card.style.transform = selected ? "translateY(-1px)" : "none";
    ensureSelectedBadge(card, selected);
  }

  const title = cardTitle(selectedCard);
  return {
    title,
    visual: TEAM_VISUALS[title] ?? TEAM_VISUALS["Site Maintenance Capability"],
    selectedCard,
  };
}

function refineSelectedHeader(
  root: HTMLElement,
  selection: ReturnType<typeof applyCardSelection>,
): void {
  if (!selection) return;

  const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>("h2"));
  const heading = headings.find((candidate) => textOf(candidate) === selection.title);
  if (!heading) return;

  const card = heading.closest<HTMLElement>("[class*='rounded-xl']");
  if (!card) return;

  card.dataset.selectedTeamHeader = "true";
  card.style.borderTopWidth = "2px";
  card.style.borderTopColor = selection.visual.border;
  card.style.background = `linear-gradient(90deg, ${selection.visual.background}, rgb(20 24 32) 58%)`;

  const repeatedMetrics = Array.from(card.querySelectorAll<HTMLElement>("p"))
    .find((paragraph) => textOf(paragraph) === "Critical skills")
    ?.closest<HTMLElement>(".grid");
  if (repeatedMetrics) repeatedMetrics.style.display = "none";

  const memberCount = textOf(selection.selectedCard.querySelectorAll("p")[1]);
  const footer = selection.selectedCard.lastElementChild;
  const footerValues = Array.from(footer?.querySelectorAll("span") ?? [])
    .map((span) => textOf(span))
    .filter(Boolean)
    .slice(0, 2);
  const subtitle = heading.parentElement?.parentElement?.querySelector<HTMLParagraphElement>(
    ":scope > p",
  );
  if (subtitle) {
    subtitle.textContent = [memberCount, ...footerValues].filter(Boolean).join(" · ");
    subtitle.style.color = "rgb(203 213 225)";
  }
}

function swapPeopleAndCoverage(root: HTMLElement): HTMLElement | null {
  const peopleHeading = findHeading<HTMLHeadingElement>(
    root,
    "h3",
    "People & Experience",
  );
  const riskHeading = findHeading<HTMLHeadingElement>(
    root,
    "h3",
    "Priority Coverage Weaknesses",
  );
  const peopleCard = peopleHeading?.closest<HTMLElement>("[class*='rounded-xl']") ?? null;
  const riskCard = riskHeading?.closest<HTMLElement>("[class*='rounded-xl']") ?? null;
  const grid = peopleCard?.parentElement ?? null;

  if (!peopleCard || !riskCard || !grid || riskCard.parentElement !== grid) return peopleCard;

  grid.dataset.skillsDetailGrid = "true";
  if (grid.firstElementChild !== peopleCard) {
    grid.insertBefore(peopleCard, riskCard);
  }
  return peopleCard;
}

function applyProfileImages(
  peopleCard: HTMLElement | null,
  avatars: Map<string, string>,
): void {
  if (!peopleCard || avatars.size === 0) return;

  const rows = Array.from(
    peopleCard.querySelectorAll<HTMLElement>("div.flex.items-center.gap-3.py-3"),
  );
  for (const row of rows) {
    const name = textOf(row.querySelector("p.text-slate-200"));
    const avatarUrl = avatars.get(name);
    const avatarHost = row.firstElementChild as HTMLElement | null;
    if (!name || !avatarUrl || !avatarHost) continue;
    if (avatarHost.querySelector("img[data-engineer-photo]")) continue;

    avatarHost.style.position = "relative";
    avatarHost.style.overflow = "hidden";
    avatarHost.style.borderRadius = "9999px";
    avatarHost.style.width = "40px";
    avatarHost.style.height = "40px";
    avatarHost.style.border = "1px solid rgb(55 65 81)";

    const image = document.createElement("img");
    image.dataset.engineerPhoto = "true";
    image.src = avatarUrl;
    image.alt = `${name} profile`;
    image.loading = "lazy";
    image.style.position = "absolute";
    image.style.inset = "0";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.addEventListener("error", () => image.remove(), { once: true });
    avatarHost.appendChild(image);
  }
}

export const SkillsMatrixSection = (): JSX.Element => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let active = true;
    void supabase
      .from("engineers")
      .select("full_name,avatar_url")
      .then(({ data, error }) => {
        if (!active || error) return;
        setAvatars(
          new Map(
            (data ?? [])
              .filter(
                (row) =>
                  typeof row.full_name === "string" &&
                  typeof row.avatar_url === "string" &&
                  row.avatar_url.length > 0,
              )
              .map((row) => [row.full_name, row.avatar_url]),
          ),
        );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    const enhance = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const selection = applyCardSelection(root);
        refineSelectedHeader(root, selection);
        const peopleCard = swapPeopleAndCoverage(root);
        applyProfileImages(peopleCard, avatars);
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [avatars]);

  return (
    <div
      ref={rootRef}
      data-skills-matrix-selection-experience="true"
      className="contents"
    >
      <style>{`
        [data-skills-detail-grid="true"] {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        @media (min-width: 1280px) {
          [data-skills-detail-grid="true"] {
            grid-template-columns: minmax(300px, 0.75fr) minmax(0, 1.55fr) !important;
          }
        }
      `}</style>
      <SkillsMatrixPolished />
    </div>
  );
};
