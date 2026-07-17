import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Shield, TrendingUp, Users } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { SkillsMatrixSection as SkillsMatrixCore } from "./SkillsMatrixSection";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const PAYLOAD_EVENT = "vorta:skills-matrix-polished-payload";
const PATCH_MARKER = "__vortaSkillsMatrixPolishInstalled";

interface ScopeSummary {
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
  status: "Strong" | "Moderate" | "At risk" | "Critical";
}

interface ScopeEngineer {
  id: string;
  name: string;
  averageYearsExperience: number;
  criticalKnowledgeHolder: boolean;
  trainingNeeds: number;
}

interface ScopeDetail {
  scopeId: string;
  priorityRisks: unknown[];
  engineers: ScopeEngineer[];
}

interface SkillsMatrixPayload {
  overall: ScopeSummary;
  teams: ScopeSummary[];
  departments: ScopeSummary[];
  details: Record<string, ScopeDetail>;
  [key: string]: unknown;
}

interface FunctionInvocationResult {
  data: unknown;
  error: unknown;
  response?: Response | null;
}

let latestPayload: SkillsMatrixPayload | null = null;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function displayName(scope: ScopeSummary): string {
  if (scope.code === "CALIBRATION") return "Calibration Team";
  if (scope.code === "OT") return "Operational Technology Team";
  return scope.name;
}

function overallStatus(score: number): ScopeSummary["status"] {
  if (score < 55) return "Critical";
  if (score < 70) return "At risk";
  if (score < 85) return "Moderate";
  return "Strong";
}

function rebalanceOverallCapability(
  payload: SkillsMatrixPayload,
): SkillsMatrixPayload {
  const teams = payload.teams.map((team) => ({
    ...team,
    name: displayName(team),
  }));
  const shiftTeams = teams.filter((team) =>
    ["RED", "GREEN", "BLUE", "YELLOW", "DAYS"].includes(team.code),
  );
  const specialistTeams = teams.filter((team) =>
    ["CALIBRATION", "OT"].includes(team.code),
  );
  const criticalTeams = teams.filter(
    (team) => team.status === "Critical" || team.score < 55,
  );

  const shiftResilience = average(shiftTeams.map((team) => team.score));
  const specialistResilience = average(
    specialistTeams.map((team) => team.score),
  );

  let score = Math.round(
    payload.overall.skillsCoverage * 0.35 +
      shiftResilience * 0.3 +
      specialistResilience * 0.1 +
      payload.overall.experienceDepth * 0.1 +
      payload.overall.smeResilience * 0.1 +
      payload.overall.validationHealth * 0.05,
  );

  if (criticalTeams.length >= 5) score = Math.min(score, 64);
  else if (criticalTeams.length >= 3) score = Math.min(score, 69);
  else if (criticalTeams.length >= 1) score = Math.min(score, 79);

  if (teams.some((team) => team.score < 30)) {
    score = Math.min(score, 64);
  }

  const overall = {
    ...payload.overall,
    score,
    status: overallStatus(score),
    criticalGaps: criticalTeams.length,
  };

  return {
    ...payload,
    overall,
    teams,
  };
}

function publishPayload(payload: SkillsMatrixPayload): void {
  latestPayload = payload;
  if (typeof window === "undefined") return;
  (
    window as unknown as {
      __vortaSkillsMatrixPayload?: SkillsMatrixPayload;
    }
  ).__vortaSkillsMatrixPayload = payload;

  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent<SkillsMatrixPayload>(PAYLOAD_EVENT, {
        detail: payload,
      }),
    );
  }, 0);
}

function installPayloadPolish(): void {
  const functions = supabase.functions as unknown as {
    invoke: (
      functionName: string,
      options?: unknown,
    ) => Promise<FunctionInvocationResult>;
    [PATCH_MARKER]?: boolean;
  };

  if (functions[PATCH_MARKER]) return;

  const invoke = functions.invoke.bind(functions);
  functions.invoke = async (
    functionName: string,
    options?: unknown,
  ): Promise<FunctionInvocationResult> => {
    const result = await invoke(functionName, options);
    if (
      functionName !== SKILLS_MATRIX_FUNCTION ||
      result.error ||
      !result.data ||
      typeof result.data !== "object"
    ) {
      return result;
    }

    const polished = rebalanceOverallCapability(
      result.data as SkillsMatrixPayload,
    );
    publishPayload(polished);

    return {
      ...result,
      data: polished,
    };
  };
  functions[PATCH_MARKER] = true;
}

installPayloadPolish();

function findElementByText<T extends Element>(
  root: Element,
  selector: string,
  text: string,
): T | null {
  return (
    Array.from(root.querySelectorAll<T>(selector)).find(
      (element) => element.textContent?.trim() === text,
    ) ?? null
  );
}

function scopeForCard(
  card: HTMLButtonElement,
  payload: SkillsMatrixPayload | null,
): ScopeSummary | null {
  if (!payload) return null;
  const title = card.querySelector("p")?.textContent?.trim() ?? "";
  const scopes = [payload.overall, ...payload.teams, ...payload.departments];
  return (
    scopes.find(
      (scope) =>
        scope.name === title ||
        displayName(scope) === title,
    ) ?? null
  );
}

function improveCardLegibility(card: HTMLButtonElement): void {
  card.dataset.capabilityCard = "true";
  const title = card.querySelector<HTMLParagraphElement>("p");
  if (title) {
    title.style.fontSize = "14px";
    title.style.lineHeight = "1.35";
  }

  const memberCount = title?.nextElementSibling as HTMLElement | null;
  if (memberCount) {
    memberCount.style.fontSize = "12px";
    memberCount.style.color = "rgb(148 163 184)";
  }

  for (const label of [
    "Critical skills",
    "Experience depth",
    "SME resilience",
  ]) {
    const element = findElementByText<HTMLElement>(card, "span", label);
    if (element) {
      element.style.fontSize = "12px";
      element.style.color = "rgb(148 163 184)";
    }
  }

  const status = card.querySelector<HTMLElement>("[class*='rounded'][class*='border']");
  if (status) {
    status.style.fontSize = "11px";
    status.style.padding = "3px 8px";
  }

  const footer = card.lastElementChild as HTMLElement | null;
  footer?.querySelectorAll<HTMLElement>("span").forEach((element) => {
    element.style.fontSize = "12px";
  });
}

function suppressNonActionableMatrixMarkers(root: HTMLElement): void {
  const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>("h3"));
  const matrixHeading = headings.find((heading) =>
    heading.textContent?.includes("Skills & Experience"),
  );
  if (!matrixHeading) return;

  const cardContent = matrixHeading.parentElement?.parentElement?.parentElement;
  const table = cardContent?.querySelector("table");
  if (!table) return;

  table.querySelectorAll<HTMLButtonElement>("button[title]").forEach((button) => {
    const title = button.title;
    if (title.includes("Unverified") || title.includes("No evidence")) {
      button.querySelectorAll<HTMLElement>("span.bg-amber-300").forEach((marker) => {
        marker.style.display = "none";
      });
    }
    if (title.includes("Not assessed")) {
      button.querySelectorAll<HTMLElement>("span.bg-orange-400").forEach((marker) => {
        marker.style.display = "none";
      });
    }
  });
}

export const SkillsMatrixSection = (): JSX.Element => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState<SkillsMatrixPayload | null>(
    latestPayload,
  );
  const [selectedScopeId, setSelectedScopeId] = useState("overall");
  const [showAllWeaknesses, setShowAllWeaknesses] = useState(false);
  const [riskToggleHost, setRiskToggleHost] = useState<HTMLElement | null>(null);
  const [peopleSummaryHost, setPeopleSummaryHost] = useState<HTMLElement | null>(null);
  const [visibleRiskCount, setVisibleRiskCount] = useState(0);

  useEffect(() => {
    const handlePayload = (event: Event): void => {
      const next = (event as CustomEvent<SkillsMatrixPayload>).detail;
      if (next) setPayload(next);
    };

    if (latestPayload) setPayload(latestPayload);
    window.addEventListener(PAYLOAD_EVENT, handlePayload);
    return () => window.removeEventListener(PAYLOAD_EVENT, handlePayload);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const enhance = (): void => {
      const explanatoryText = Array.from(
        root.querySelectorAll<HTMLParagraphElement>("p"),
      ).find((paragraph) => {
        const text = paragraph.textContent?.trim() ?? "";
        return (
          text === "Shift teams plus Calibration and Operational Technology" ||
          text === "Permanent capability grouped by organisational department"
        );
      });
      if (explanatoryText) explanatoryText.hidden = true;

      const overallCard = Array.from(
        root.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"),
      ).find((button) =>
        button.textContent?.includes("Site Maintenance Capability"),
      );
      const cardGrid = overallCard?.parentElement;
      if (cardGrid) {
        cardGrid.dataset.capabilityGrid = "true";
        Array.from(cardGrid.children).forEach((child) => {
          if (!(child instanceof HTMLButtonElement)) return;
          improveCardLegibility(child);
          const scope = scopeForCard(child, payload);
          if (scope) child.dataset.scopeId = scope.id;

          if (child.getAttribute("aria-pressed") === "true" && scope) {
            setSelectedScopeId((current) => {
              if (current === scope.id) return current;
              setShowAllWeaknesses(false);
              return scope.id;
            });
          }
        });

        if (overallCard && payload) {
          const footer = overallCard.lastElementChild as HTMLElement | null;
          const footerSpans = footer?.querySelectorAll<HTMLElement>("span");
          if (footerSpans?.[0]) {
            const count = payload.overall.criticalGaps;
            footerSpans[0].textContent = `${count} critical team${count === 1 ? "" : "s"}`;
          }
          if (footerSpans?.[1]) {
            const teamsWithSpof = payload.teams.filter(
              (team) => team.spofCount > 0,
            ).length;
            footerSpans[1].textContent = `${teamsWithSpof} team${teamsWithSpof === 1 ? "" : "s"} with SPOF`;
          }
        }
      }

      const riskHeading = findElementByText<HTMLHeadingElement>(
        root,
        "h3",
        "Priority Coverage Weaknesses",
      );
      const riskContent = riskHeading?.parentElement?.parentElement?.parentElement;
      const riskList = riskContent
        ? Array.from(riskContent.children).find((child) =>
            child.classList.contains("divide-y"),
          ) as HTMLElement | undefined
        : undefined;

      if (riskContent && riskList) {
        const risks = Array.from(riskList.children) as HTMLElement[];
        risks.forEach((risk, index) => {
          risk.style.display = showAllWeaknesses || index < 3 ? "" : "none";
        });
        setVisibleRiskCount(risks.length);

        let host = riskContent.querySelector<HTMLElement>(
          "[data-vorta-risk-toggle-host]",
        );
        if (!host) {
          host = document.createElement("div");
          host.dataset.vortaRiskToggleHost = "true";
          host.className = "flex justify-center border-t border-gray-800 pt-4";
          riskContent.appendChild(host);
        }
        setRiskToggleHost(host);
      } else {
        setRiskToggleHost(null);
        setVisibleRiskCount(0);
      }

      const peopleHeading = findElementByText<HTMLHeadingElement>(
        root,
        "h3",
        "People & Experience",
      );
      const peopleContent = peopleHeading?.parentElement?.parentElement;
      const peopleList = peopleContent
        ? Array.from(peopleContent.children).find((child) =>
            child.classList.contains("overflow-y-auto"),
          )
        : undefined;

      if (peopleContent && peopleList) {
        let host = peopleContent.querySelector<HTMLElement>(
          "[data-vorta-people-summary-host]",
        );
        if (!host) {
          host = document.createElement("div");
          host.dataset.vortaPeopleSummaryHost = "true";
          peopleContent.insertBefore(host, peopleList);
        }
        setPeopleSummaryHost(host);
      } else {
        setPeopleSummaryHost(null);
      }

      suppressNonActionableMatrixMarkers(root);
    };

    let followUp = 0;
    const scheduleEnhance = (): void => {
      enhance();
      window.clearTimeout(followUp);
      followUp = window.setTimeout(enhance, 80);
    };

    scheduleEnhance();
    root.addEventListener("click", scheduleEnhance, true);

    return () => {
      window.clearTimeout(followUp);
      root.removeEventListener("click", scheduleEnhance, true);
    };
  }, [payload, showAllWeaknesses]);

  const selectedDetail = payload?.details[selectedScopeId] ?? null;
  const peopleMetrics = useMemo(() => {
    const engineers = selectedDetail?.engineers ?? [];
    return {
      averageExperience: average(
        engineers.map((engineer) => engineer.averageYearsExperience),
      ),
      smeCount: engineers.filter(
        (engineer) => engineer.criticalKnowledgeHolder,
      ).length,
      trainingNeeds: engineers.reduce(
        (sum, engineer) => sum + engineer.trainingNeeds,
        0,
      ),
    };
  }, [selectedDetail]);

  return (
    <div ref={rootRef} data-skills-matrix-polish="true" className="contents">
      <SkillsMatrixCore />

      {riskToggleHost && visibleRiskCount > 3
        ? createPortal(
            <button
              type="button"
              onClick={() => setShowAllWeaknesses((current) => !current)}
              className="rounded-lg border border-gray-700 bg-[#111620] px-4 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500/40 hover:text-blue-300"
            >
              {showAllWeaknesses
                ? "Show top 3"
                : `View all ${visibleRiskCount} weaknesses`}
            </button>,
            riskToggleHost,
          )
        : null}

      {peopleSummaryHost && selectedDetail
        ? createPortal(
            <div className="grid grid-cols-3 gap-2 border-y border-gray-800 py-3">
              <div className="rounded-lg bg-[#10151d] px-3 py-2">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium">Avg experience</span>
                </div>
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-200">
                  {peopleMetrics.averageExperience.toFixed(1)} yrs
                </p>
              </div>
              <div className="rounded-lg bg-[#10151d] px-3 py-2">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Shield className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium">Critical SMEs</span>
                </div>
                <p className="mt-1 text-sm font-semibold tabular-nums text-blue-300">
                  {peopleMetrics.smeCount}
                </p>
              </div>
              <div className="rounded-lg bg-[#10151d] px-3 py-2">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium">Training needs</span>
                </div>
                <p className="mt-1 text-sm font-semibold tabular-nums text-amber-300">
                  {peopleMetrics.trainingNeeds}
                </p>
              </div>
            </div>,
            peopleSummaryHost,
          )
        : null}
    </div>
  );
};
