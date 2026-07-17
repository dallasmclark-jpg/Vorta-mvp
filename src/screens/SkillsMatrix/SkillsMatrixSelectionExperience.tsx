import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";
import { SkillsMatrixSection as SkillsMatrixPolished } from "./SkillsMatrixPolished";

const PAYLOAD_EVENT = "vorta:skills-matrix-polished-payload";

type TeamVisual = {
  border: string;
  background: string;
  glow: string;
};

type ScopeStatus = "Strong" | "Moderate" | "At risk" | "Critical";

type ScopeSummary = {
  id: string;
  code: string;
  name: string;
  memberCount: number;
  score: number;
  skillsCoverage: number;
  experienceDepth: number;
  smeResilience: number;
  validationHealth: number;
  criticalGaps: number;
  spofCount: number;
  trainingNeeds: number;
  affectedEquipment: number;
  status: ScopeStatus;
};

type PriorityRisk = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  skillName: string;
  minimumRequired: number;
  qualifiedCount: number;
  gap: number;
  singlePoint: boolean;
  recommendedAction: string;
  projectedScoreGain: number;
};

type ScopeDetail = {
  scopeId: string;
  priorityRisks: PriorityRisk[];
};

type SkillsMatrixPayload = {
  overall: ScopeSummary;
  teams: ScopeSummary[];
  departments: ScopeSummary[];
  details: Record<string, ScopeDetail>;
};

type CapabilityIntelligence = {
  summary: ScopeSummary;
  detail: ScopeDetail;
  priorityCount: number;
  assetCount: number;
  singlePointCount: number;
  topRisk: PriorityRisk | null;
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
  Calibration: {
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

    card.querySelector<HTMLElement>("[data-selected-team-badge]")?.remove();
    card.style.borderTopColor = visual.border;
    card.style.borderTopWidth = "2px";
    card.style.borderColor = selected ? visual.border : "rgb(31 41 55)";
    card.style.borderTopColor = visual.border;
    card.style.background = selected ? visual.background : "rgb(20 24 32)";
    card.style.boxShadow = selected
      ? `0 0 0 2px ${visual.glow}, 0 12px 28px rgba(0, 0, 0, 0.22)`
      : "none";
    card.style.transform = selected ? "translateY(-1px)" : "none";
  }

  const title = cardTitle(selectedCard);
  return {
    title,
    visual: TEAM_VISUALS[title] ?? TEAM_VISUALS["Site Maintenance Capability"],
    selectedCard,
  };
}

function prepareIntelligenceHost(
  root: HTMLElement,
  selection: ReturnType<typeof applyCardSelection>,
): HTMLElement | null {
  if (!selection) return null;

  const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>("h2"));
  const heading = headings.find((candidate) => textOf(candidate) === selection.title);
  if (!heading) return null;

  const card = heading.closest<HTMLElement>("[class*='rounded-xl']");
  if (!card) return null;

  card.dataset.selectedTeamHeader = "true";
  card.style.borderTopWidth = "2px";
  card.style.borderTopColor = selection.visual.border;
  card.style.background = `linear-gradient(90deg, ${selection.visual.background}, rgb(20 24 32) 64%)`;

  let host = card.querySelector<HTMLElement>("[data-capability-intelligence-host]");
  if (!host) {
    host = document.createElement("div");
    host.dataset.capabilityIntelligenceHost = "true";
    card.appendChild(host);
  }

  Array.from(card.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    child.style.display = child === host ? "block" : "none";
  });

  return host;
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

function scopeByTitle(
  payload: SkillsMatrixPayload | null,
  title: string,
): ScopeSummary | null {
  if (!payload) return null;
  return [payload.overall, ...payload.teams, ...payload.departments].find(
    (scope) => scope.name === title,
  ) ?? null;
}

function statusClass(status: ScopeStatus): string {
  if (status === "Strong") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (status === "Moderate") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (status === "At risk") return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return "border-red-500/30 bg-red-500/10 text-red-400";
}

function CapabilityIntelligencePanel({
  intelligence,
  visual,
}: {
  intelligence: CapabilityIntelligence;
  visual: TeamVisual;
}): JSX.Element {
  const { summary, priorityCount, assetCount, singlePointCount, topRisk } = intelligence;
  const narrative = topRisk
    ? `${summary.name} is ${summary.status.toLowerCase()} at ${summary.score}/100. ${priorityCount} priority coverage ${priorityCount === 1 ? "record affects" : "records affect"} ${assetCount} ${assetCount === 1 ? "asset" : "assets"}, including ${singlePointCount} single-person ${singlePointCount === 1 ? "dependency" : "dependencies"}. The highest-ranked exposure is ${topRisk.skillName} on ${topRisk.equipmentName}, with current cover ${topRisk.qualifiedCount}/${topRisk.minimumRequired}.`
    : `${summary.name} has no priority coverage exceptions in the current Skills Matrix dataset. The capability score and status are calculated from the live selected-scope competency, experience, SME-resilience and validation records.`;

  const metrics = [
    {
      label: "Highest-risk capability",
      value: topRisk?.skillName ?? "No current exception",
    },
    {
      label: "Current cover",
      value: topRisk ? `${topRisk.qualifiedCount}/${topRisk.minimumRequired}` : "Covered",
    },
    {
      label: "Assets affected",
      value: String(assetCount),
    },
    {
      label: "Recorded action gain",
      value: topRisk ? `+${topRisk.projectedScoreGain} pts` : "No action required",
    },
  ];

  return (
    <div className="p-5 lg:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{
                borderColor: `${visual.border}55`,
                backgroundColor: visual.background,
                color: visual.border,
              }}
            >
              Capability intelligence
            </span>
            <span className={`rounded border px-2 py-1 text-[10px] font-semibold ${statusClass(summary.status)}`}>
              {summary.status}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-50">
            {summary.name} Capability Briefing
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{narrative}</p>
          {topRisk && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              <span className="font-semibold text-slate-400">Recorded action:</span>{" "}
              {topRisk.recommendedAction}
            </p>
          )}
        </div>
        <div className="shrink-0 text-left lg:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Live capability score
          </p>
          <div className="mt-1 flex items-end gap-1 lg:justify-end">
            <span className="text-3xl font-semibold tabular-nums" style={{ color: visual.border }}>
              {summary.score}
            </span>
            <span className="pb-1 text-xs text-slate-600">/ 100</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
              {metric.label}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-100" title={metric.value}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-slate-600">
        Derived from the selected scope’s current equipment requirements, engineer capability evidence and ranked coverage records.
      </p>
    </div>
  );
}

export const SkillsMatrixSection = (): JSX.Element => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [payload, setPayload] = useState<SkillsMatrixPayload | null>(null);
  const [selectedTitle, setSelectedTitle] = useState("Site Maintenance Capability");
  const [selectedVisual, setSelectedVisual] = useState<TeamVisual>(
    TEAM_VISUALS["Site Maintenance Capability"],
  );
  const [intelligenceHost, setIntelligenceHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const handlePayload = (event: Event): void => {
      const nextPayload = (event as CustomEvent<SkillsMatrixPayload>).detail;
      if (nextPayload) setPayload(nextPayload);
    };
    window.addEventListener(PAYLOAD_EVENT, handlePayload);
    return () => window.removeEventListener(PAYLOAD_EVENT, handlePayload);
  }, []);

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
        const host = prepareIntelligenceHost(root, selection);
        if (selection) {
          setSelectedTitle((current) => current === selection.title ? current : selection.title);
          setSelectedVisual((current) => current.border === selection.visual.border ? current : selection.visual);
        }
        setIntelligenceHost((current) => current === host ? current : host);
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

  const intelligence = useMemo<CapabilityIntelligence | null>(() => {
    const summary = scopeByTitle(payload, selectedTitle);
    if (!summary) return null;
    const detail = payload?.details[summary.id];
    if (!detail) return null;
    const risks = detail.priorityRisks ?? [];
    return {
      summary,
      detail,
      priorityCount: risks.length,
      assetCount: new Set(risks.map((risk) => risk.equipmentId)).size || summary.affectedEquipment,
      singlePointCount: risks.filter((risk) => risk.singlePoint).length,
      topRisk: risks[0] ?? null,
    };
  }, [payload, selectedTitle]);

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
      {intelligenceHost && intelligence
        ? createPortal(
            <CapabilityIntelligencePanel
              intelligence={intelligence}
              visual={selectedVisual}
            />,
            intelligenceHost,
          )
        : null}
    </div>
  );
};
