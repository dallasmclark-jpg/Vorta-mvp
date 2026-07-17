import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { SkillsMatrixSection as SkillsMatrixSelectionExperience } from "./SkillsMatrixSelectionExperience";

const SKILLS_MATRIX_FUNCTION = "skills-matrix-data";
const PEOPLE_SCROLL_HEIGHT = "560px";

type SkillsMatrixPayload = {
  site?: { id?: string; name?: string };
  overall?: unknown;
  teams?: unknown[];
  departments?: unknown[];
  details?: Record<string, unknown>;
};

type SkillsMatrixWindow = Window & {
  __vortaSkillsMatrixPayload?: SkillsMatrixPayload;
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

    let followUp = 0;
    const apply = (): void => {
      applyPeopleScroll(root);
      window.clearTimeout(followUp);
      followUp = window.setTimeout(() => applyPeopleScroll(root), 120);
    };

    const initial = window.setTimeout(apply, 40);
    root.addEventListener("click", apply, true);

    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(followUp);
      root.removeEventListener("click", apply, true);
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
    <div ref={rootRef} className="contents" data-skills-matrix-resolved-experience="true">
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
        [data-people-expansion-host] {
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
