import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { SkillsMatrixSection as SkillsMatrixSelectionExperience } from "./SkillsMatrixSelectionExperience";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const SKILLS_MATRIX_PAYLOAD_EVENT = "vorta:skills-matrix-polished-payload";
const PEOPLE_SCROLL_HEIGHT = "560px";
const ALL_SITE = "All Site";

type MatrixSkill = {
  id: string;
  name: string;
};

type ScopeSummary = {
  id: string;
  code?: string;
  name?: string;
};

type ScopeDetail = {
  matrixSkills?: MatrixSkill[];
};

type SkillsMatrixPayload = {
  site?: { id?: string; name?: string };
  overall?: ScopeSummary;
  teams?: ScopeSummary[];
  departments?: ScopeSummary[];
  details?: Record<string, ScopeDetail>;
};

type SkillsMatrixWindow = Window & {
  __vortaSkillsMatrixPayload?: SkillsMatrixPayload;
};

type MatrixElements = {
  card: HTMLElement;
  table: HTMLTableElement;
  tableFrame: HTMLElement;
};

function isSkillsMatrixPayload(value: unknown): value is SkillsMatrixPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SkillsMatrixPayload;
  return Boolean(candidate.overall && Array.isArray(candidate.teams) && candidate.details);
}

function applyPeopleScroll(root: HTMLElement): void {
  const peopleHeading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h3")).find(
    (heading) => heading.textContent?.trim() === "People & Experience",
  );
  const peopleCard = peopleHeading?.closest<HTMLElement>("[class*='rounded-xl']");
  const list = peopleCard?.querySelector<HTMLElement>("div.overflow-y-auto");
  if (!list) return;

  list.dataset.vortaPeopleScroll = "true";
  list.style.maxHeight = PEOPLE_SCROLL_HEIGHT;
  list.style.overflowY = "auto";
  list.style.paddingRight = "6px";
  list.style.scrollbarWidth = "thin";
  list.style.scrollbarColor = "rgba(96, 165, 250, 0.28) transparent";

  list
    .querySelectorAll<HTMLElement>("div.flex.items-center.gap-3.py-3")
    .forEach((row) => {
      row.style.display = "flex";
    });

  peopleCard
    ?.querySelector<HTMLElement>("[data-people-expansion-host]")
    ?.style.setProperty("display", "none", "important");
}

function readPayload(): SkillsMatrixPayload | null {
  const payload = (window as SkillsMatrixWindow).__vortaSkillsMatrixPayload;
  return isSkillsMatrixPayload(payload) ? payload : null;
}

function scopeDisplayName(scope: ScopeSummary): string {
  if (scope.code === "CALIBRATION") return "Calibration Team";
  if (scope.code === "OT") return "Operational Technology Team";
  return scope.name ?? "";
}

function selectedScopeDetail(
  root: HTMLElement,
  payload: SkillsMatrixPayload,
): ScopeDetail | null {
  const selectedCard = Array.from(
    root.querySelectorAll<HTMLButtonElement>("button[aria-pressed='true']"),
  ).find((button) => button.textContent?.includes("Capability & resilience"));
  const selectedTitle = selectedCard?.querySelector("p")?.textContent?.trim();
  if (!selectedTitle) return null;

  const scopes = [
    payload.overall,
    ...(payload.teams ?? []),
    ...(payload.departments ?? []),
  ].filter((scope): scope is ScopeSummary => Boolean(scope));

  const selectedScope = scopes.find(
    (scope) =>
      scope.name === selectedTitle ||
      scopeDisplayName(scope) === selectedTitle,
  );

  return selectedScope?.id
    ? payload.details?.[selectedScope.id] ?? null
    : null;
}

function findMatrixElements(root: HTMLElement): MatrixElements | null {
  const heading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h3")).find(
    (candidate) => candidate.textContent?.trim().endsWith("Skills & Experience"),
  );
  const card = heading?.closest<HTMLElement>("[class*='rounded-xl']");
  const table = card?.querySelector<HTMLTableElement>("table");
  const tableFrame = table?.parentElement?.parentElement as HTMLElement | null;

  return card && table && tableFrame
    ? { card, table, tableFrame }
    : null;
}

function applyStableBuildingFilter(
  root: HTMLElement,
  payload: SkillsMatrixPayload,
  buildingSkills: Map<string, Set<string>>,
  selectedBuilding: string,
): void {
  const detail = selectedScopeDetail(root, payload);
  const elements = findMatrixElements(root);
  if (!detail || !elements) return;

  const allowedSkillIds =
    selectedBuilding === ALL_SITE
      ? null
      : buildingSkills.get(selectedBuilding) ?? new Set<string>();
  const allowedSkillNames = new Set(
    (detail.matrixSkills ?? [])
      .filter((skill) => !allowedSkillIds || allowedSkillIds.has(skill.id))
      .map((skill) => skill.name),
  );

  const headerCells = Array.from(elements.table.tHead?.rows[0]?.cells ?? []);
  headerCells.forEach((cell, index) => {
    if (index < 3) return;
    const skillName =
      cell.querySelector("button")?.getAttribute("title") ??
      cell.textContent?.trim() ??
      "";
    const visible =
      selectedBuilding === ALL_SITE || allowedSkillNames.has(skillName);
    (cell as HTMLElement).style.display = visible ? "" : "none";
  });

  Array.from(elements.table.tBodies[0]?.rows ?? []).forEach((row) => {
    Array.from(row.cells).forEach((cell, index) => {
      if (index < 3) return;
      const header = headerCells[index] as HTMLElement | undefined;
      (cell as HTMLElement).style.display =
        !header || header.style.display !== "none" ? "" : "none";
    });
  });
}

function buildStableBuildingTabs(
  root: HTMLElement,
  payload: SkillsMatrixPayload,
  buildingSkills: Map<string, Set<string>>,
  selectedBuildingRef: { current: string },
): void {
  const detail = selectedScopeDetail(root, payload);
  const elements = findMatrixElements(root);
  if (!detail || !elements) return;

  elements.card.style.overflowAnchor = "none";
  if (!elements.card.dataset.stableMatrixHeight) {
    const height = Math.ceil(elements.card.getBoundingClientRect().height);
    if (height > 0) {
      elements.card.dataset.stableMatrixHeight = String(height);
      elements.card.style.minHeight = `${height}px`;
    }
  }

  let host = elements.card.querySelector<HTMLElement>(
    "[data-stable-building-tabs-host]",
  );
  if (!host) {
    host = document.createElement("div");
    host.dataset.stableBuildingTabsHost = "true";
    elements.tableFrame.parentElement?.insertBefore(host, elements.tableFrame);
  }

  const allSkills = detail.matrixSkills ?? [];
  const tabs = [
    { name: ALL_SITE, count: allSkills.length },
    ...Array.from(buildingSkills.entries())
      .map(([name, skillIds]) => ({
        name,
        count: allSkills.filter((skill) => skillIds.has(skill.id)).length,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  ];

  if (
    selectedBuildingRef.current !== ALL_SITE &&
    !tabs.some(
      (tab) => tab.name === selectedBuildingRef.current && tab.count > 0,
    )
  ) {
    selectedBuildingRef.current = ALL_SITE;
  }

  const row = document.createElement("div");
  row.dataset.stableBuildingTabs = "true";
  row.className =
    "mb-4 flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

  tabs.forEach((tab) => {
    const active = tab.name === selectedBuildingRef.current;
    const disabled = tab.name !== ALL_SITE && tab.count === 0;
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = disabled;
    button.setAttribute("aria-pressed", String(active));
    button.className = `shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
      active
        ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
        : disabled
          ? "cursor-not-allowed border-gray-900 text-slate-700"
          : "border-gray-800 text-slate-500 hover:border-gray-700 hover:text-slate-300"
    }`;
    button.append(document.createTextNode(tab.name));

    const count = document.createElement("span");
    count.className = "ml-1.5 text-[10px] font-medium opacity-70";
    count.textContent = String(tab.count);
    button.appendChild(count);

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectedBuildingRef.current = tab.name;
      buildStableBuildingTabs(
        root,
        payload,
        buildingSkills,
        selectedBuildingRef,
      );
      applyStableBuildingFilter(
        root,
        payload,
        buildingSkills,
        selectedBuildingRef.current,
      );
    });

    row.appendChild(button);
  });

  host.replaceChildren(row);
  applyStableBuildingFilter(
    root,
    payload,
    buildingSkills,
    selectedBuildingRef.current,
  );
}

async function loadBuildingSkills(
  siteId: string,
): Promise<Map<string, Set<string>>> {
  const { data: equipmentRows, error: equipmentError } = await supabase
    .from("equipment_assets")
    .select("id,area")
    .eq("site_id", siteId)
    .order("area");
  if (equipmentError || !equipmentRows?.length) return new Map();

  const equipmentIds = equipmentRows.map((row) => row.id);
  const { data: requirementRows, error: requirementError } = await supabase
    .from("equipment_required_skills")
    .select("equipment_id,skill_id")
    .in("equipment_id", equipmentIds);
  if (requirementError) return new Map();

  const equipmentArea = new Map(
    equipmentRows.map((row) => [
      String(row.id),
      String(row.area ?? "Unassigned"),
    ]),
  );
  const result = new Map<string, Set<string>>();

  for (const row of requirementRows ?? []) {
    const area = equipmentArea.get(String(row.equipment_id));
    if (!area || !row.skill_id) continue;
    const skills = result.get(area) ?? new Set<string>();
    skills.add(String(row.skill_id));
    result.set(area, skills);
  }

  return result;
}

export const SkillsMatrixSection = (): JSX.Element => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payloadReady, setPayloadReady] = useState(() =>
    isSkillsMatrixPayload((window as SkillsMatrixWindow).__vortaSkillsMatrixPayload),
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (payloadReady) return;

    let active = true;
    const fallback = window.setTimeout(() => {
      if (!active) return;
      setLoadFailed(true);
      setPayloadReady(true);
    }, 2500);

    void supabase.functions
      .invoke(SKILLS_MATRIX_FUNCTION, {
        body: { schemaVersion: "capability-v3" },
      })
      .then(({ data, error }) => {
        if (!active) return;
        window.clearTimeout(fallback);

        if (!error && isSkillsMatrixPayload(data)) {
          (window as SkillsMatrixWindow).__vortaSkillsMatrixPayload = data;
        } else {
          setLoadFailed(true);
        }
        setPayloadReady(true);
      });

    return () => {
      active = false;
      window.clearTimeout(fallback);
    };
  }, [payloadReady]);

  useEffect(() => {
    if (!payloadReady) return;
    const root = rootRef.current;
    if (!root) return;

    let active = true;
    const timers: number[] = [];
    const selectedBuildingRef = { current: ALL_SITE };
    let buildingSkills = new Map<string, Set<string>>();

    const schedule = (callback: () => void, delay: number): void => {
      timers.push(window.setTimeout(callback, delay));
    };

    const install = (): void => {
      if (!active) return;
      const payload = readPayload();
      if (!payload) return;
      applyPeopleScroll(root);
      buildStableBuildingTabs(
        root,
        payload,
        buildingSkills,
        selectedBuildingRef,
      );
    };

    const refreshForScopeChange = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-stable-building-tabs-host]")) return;

      const capabilityCard = target.closest<HTMLButtonElement>(
        "button[aria-pressed]",
      );
      if (!capabilityCard?.textContent?.includes("Capability & resilience")) {
        return;
      }

      selectedBuildingRef.current = ALL_SITE;
      const matrix = findMatrixElements(root);
      if (matrix) {
        delete matrix.card.dataset.stableMatrixHeight;
        matrix.card.style.minHeight = "";
      }
      schedule(install, 60);
      schedule(install, 160);
    };

    const handlePayload = (): void => {
      selectedBuildingRef.current = ALL_SITE;
      schedule(install, 40);
      schedule(install, 140);
    };

    root.addEventListener("click", refreshForScopeChange, true);
    window.addEventListener(SKILLS_MATRIX_PAYLOAD_EVENT, handlePayload);

    schedule(install, 80);
    schedule(install, 240);
    schedule(install, 600);

    const payload = readPayload();
    const siteId = payload?.site?.id;
    if (siteId) {
      void loadBuildingSkills(siteId).then((loaded) => {
        if (!active) return;
        buildingSkills = loaded;
        install();
      });
    }

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      root.removeEventListener("click", refreshForScopeChange, true);
      window.removeEventListener(SKILLS_MATRIX_PAYLOAD_EVENT, handlePayload);
    };
  }, [payloadReady]);

  if (!payloadReady) {
    return (
      <div className="space-y-4 px-6 py-5" aria-label="Loading Skills Matrix">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-white/5" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-64 animate-pulse rounded-xl border border-white/5 bg-white/[0.025]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="contents"
      data-skills-matrix-resolved-experience="true"
    >
      <style>{`
        [data-vorta-people-scroll="true"]::-webkit-scrollbar {
          width: 5px;
        }
        [data-vorta-people-scroll="true"]::-webkit-scrollbar-track {
          background: transparent;
        }
        [data-vorta-people-scroll="true"]::-webkit-scrollbar-thumb {
          border-radius: 9999px;
          background: rgba(96, 165, 250, 0.22);
        }
        [data-vorta-people-scroll="true"]:hover::-webkit-scrollbar-thumb {
          background: rgba(96, 165, 250, 0.38);
        }
        [data-people-expansion-host],
        [data-building-tabs-host] {
          display: none !important;
        }
      `}</style>
      {loadFailed ? (
        <div className="mx-6 mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
          Live capability enhancements could not be confirmed. The underlying Skills Matrix remains available.
        </div>
      ) : null}
      <SkillsMatrixSelectionExperience />
    </div>
  );
};
