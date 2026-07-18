import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { MODAL_FOCUSABLE_SELECTOR } from "../hooks/useModalFocusTrap";
import { supabase } from "../lib/supabaseClient";

const EVIDENCE_LABELS = new Map<string, string>([
  ["finding", "Finding"],
  ["source", "Source evidence"],
  ["source evidence", "Source evidence"],
  ["owner", "Responsible person or team"],
  ["responsible", "Responsible person or team"],
  ["responsible person", "Responsible person or team"],
  ["responsible team", "Responsible person or team"],
  ["action system", "System where action occurs"],
  ["system", "System where action occurs"],
  ["completion", "Completion evidence"],
  ["completion evidence", "Completion evidence"],
  ["expected reduction", "Expected risk reduction"],
  ["risk reduction", "Expected risk reduction"],
  ["expected risk reduction", "Expected risk reduction"],
]);

const ACTION_CONTEXT_PATTERN =
  /action|risk|work order|training|requirement|finding|evidence|completion|owner|responsible|recommend/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveSkillName(payload: unknown, skillId: string): string | null {
  if (!isRecord(payload) || !isRecord(payload.details)) return null;

  for (const detail of Object.values(payload.details)) {
    if (!isRecord(detail)) continue;

    const matrixSkills = Array.isArray(detail.matrixSkills)
      ? detail.matrixSkills
      : [];
    const matrixSkill = matrixSkills.find(
      (item) => isRecord(item) && item.id === skillId,
    );
    if (isRecord(matrixSkill) && typeof matrixSkill.name === "string") {
      return matrixSkill.name;
    }

    const priorityRisks = Array.isArray(detail.priorityRisks)
      ? detail.priorityRisks
      : [];
    const priorityRisk = priorityRisks.find(
      (item) => isRecord(item) && item.skillId === skillId,
    );
    if (
      isRecord(priorityRisk) &&
      typeof priorityRisk.skillName === "string"
    ) {
      return priorityRisk.skillName;
    }
  }

  return null;
}

function SelectedSkillContextBridge(): null {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const skillId = searchParams.get("skill");
  const [skillName, setSkillName] = useState<string | null>(null);

  useEffect(() => {
    if (location.pathname !== "/skills-matrix" || !skillId) {
      setSkillName(null);
      return undefined;
    }

    let cancelled = false;

    void supabase.functions
      .invoke("skills-matrix-data", {
        body: { schemaVersion: "capability-v3" },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        setSkillName(error || !data ? null : resolveSkillName(data, skillId));
      })
      .catch(() => {
        if (!cancelled) setSkillName(null);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, skillId]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      '[data-vorta-maintenance-portal="true"]',
    );
    if (!root) return undefined;

    const removeMarker = (): void => {
      root
        .querySelectorAll<HTMLElement>("[data-vorta-selected-skill-context]")
        .forEach((element) => element.remove());
    };

    if (!skillName || location.pathname !== "/skills-matrix") {
      removeMarker();
      return undefined;
    }

    const synchronise = (): void => {
      const showingLabel = Array.from(
        root.querySelectorAll<HTMLElement>("span"),
      ).find((element) => element.textContent?.trim() === "Showing:");
      const contextLine = showingLabel?.closest("p");
      if (!contextLine) return;

      let marker = contextLine.querySelector<HTMLElement>(
        "[data-vorta-selected-skill-context]",
      );
      if (!marker) {
        marker = document.createElement("span");
        marker.dataset.vortaSelectedSkillContext = "true";
        marker.className = "font-medium text-blue-200";
        contextLine.append(marker);
      }

      const nextText = ` · Skill: ${skillName}`;
      if (marker.textContent !== nextText) marker.textContent = nextText;
    };

    synchronise();
    const observer = new MutationObserver(synchronise);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      removeMarker();
    };
  }, [location.pathname, skillName]);

  return null;
}

function visibleDialog(dialog: HTMLElement): boolean {
  if (dialog.dataset.vortaFocusTrap === "managed") return false;
  if (dialog.getAttribute("aria-hidden") === "true") return false;
  if (dialog.classList.contains("translate-x-full")) return false;
  if (dialog.classList.contains("pointer-events-none")) return false;

  const style = window.getComputedStyle(dialog);
  return style.display !== "none" && style.visibility !== "hidden";
}

function visibleFocusable(element: HTMLElement): boolean {
  return (
    element.getAttribute("aria-hidden") !== "true" &&
    element.getAttribute("hidden") === null &&
    element.offsetParent !== null
  );
}

function useMaintenancePortalDomHardening(): void {
  const activeDialogRef = useRef<{
    dialog: HTMLElement;
    previousFocus: HTMLElement | null;
    previousOverflow: string;
  } | null>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      '[data-vorta-maintenance-portal="true"]',
    );
    if (!root) return undefined;

    let scheduledFrame = 0;

    const releaseFallbackTrap = (): void => {
      const active = activeDialogRef.current;
      if (!active) return;

      delete active.dialog.dataset.vortaFallbackFocusTrap;
      document.body.style.overflow = active.previousOverflow;
      if (active.previousFocus?.isConnected) active.previousFocus.focus();
      activeDialogRef.current = null;
    };

    const synchroniseFallbackTrap = (): void => {
      const dialogs = Array.from(
        root.querySelectorAll<HTMLElement>(
          '[role="dialog"], [role="alertdialog"]',
        ),
      ).filter(visibleDialog);
      const nextDialog = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
      const current = activeDialogRef.current;

      if (current?.dialog === nextDialog) return;
      releaseFallbackTrap();
      if (!nextDialog) return;

      const previousFocus = document.activeElement as HTMLElement | null;
      const previousOverflow = document.body.style.overflow;
      if (!nextDialog.hasAttribute("tabindex")) nextDialog.tabIndex = -1;
      nextDialog.dataset.vortaFallbackFocusTrap = "true";
      document.body.style.overflow = "hidden";
      activeDialogRef.current = {
        dialog: nextDialog,
        previousFocus,
        previousOverflow,
      };

      window.requestAnimationFrame(() => {
        const first = Array.from(
          nextDialog.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR),
        ).find(visibleFocusable);
        (first ?? nextDialog).focus();
      });
    };

    const normaliseEvidenceLabels = (): void => {
      root
        .querySelectorAll<HTMLElement>("dt, th, [data-label], p, span")
        .forEach((element) => {
          if (element.childElementCount > 0) return;
          const current = element.textContent?.trim() ?? "";
          if (!current || current.length > 42) return;

          const replacement = EVIDENCE_LABELS.get(current.toLowerCase());
          const context = element.parentElement?.textContent ?? "";
          if (!replacement || !ACTION_CONTEXT_PATTERN.test(context)) return;

          if (current !== replacement) element.textContent = replacement;
          element.dataset.vortaEvidenceLabel = "true";
          element.closest<HTMLElement>("article, section, li, tr")?.setAttribute(
            "data-vorta-action-evidence",
            "true",
          );
        });
    };

    const normaliseOperationalStates = (): void => {
      root.querySelectorAll<HTMLElement>("main p, main div").forEach((element) => {
        if (element.childElementCount > 0) return;
        const text = element.textContent?.trim() ?? "";
        if (text.length < 4 || text.length > 180) return;

        let state: "loading" | "empty" | "stale" | "error" | null = null;
        if (/^(loading|refreshing|recalculating|checking|preparing)\b/i.test(text)) {
          state = "loading";
        } else if (/^(no |nothing |none available|no data)/i.test(text)) {
          state = "empty";
        } else if (/(could not|failed to|unable to|unavailable)/i.test(text)) {
          state = "error";
        } else if (/\bstale\b/i.test(text)) {
          state = "stale";
        }
        if (!state) return;

        const host = element.closest<HTMLElement>(
          '[role="alert"], section, article, div[class*="rounded"], div[class*="border"]',
        );
        if (!host) return;

        host.dataset.vortaOperationalState = state;
        if (state === "error") {
          host.setAttribute("role", "alert");
          host.setAttribute("aria-live", "assertive");
        } else {
          host.setAttribute("role", "status");
          host.setAttribute("aria-live", "polite");
        }
      });
    };

    const synchronise = (): void => {
      normaliseEvidenceLabels();
      normaliseOperationalStates();
      synchroniseFallbackTrap();
    };

    const scheduleSynchronise = (): void => {
      window.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = window.requestAnimationFrame(synchronise);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      const active = activeDialogRef.current;
      if (!active) return;

      if (event.key === "Escape") {
        const closeButton = active.dialog.querySelector<HTMLButtonElement>(
          'button[aria-label^="Close" i], button[data-dialog-close]',
        );
        if (closeButton && !closeButton.disabled) {
          event.preventDefault();
          event.stopPropagation();
          closeButton.click();
        }
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        active.dialog.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR),
      ).filter(visibleFocusable);
      if (focusable.length === 0) {
        event.preventDefault();
        active.dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    synchronise();
    const observer = new MutationObserver(scheduleSynchronise);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-hidden", "open"],
    });
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(scheduledFrame);
      window.removeEventListener("keydown", handleKeyDown, true);
      releaseFallbackTrap();
    };
  }, []);
}

export function MaintenancePortalHardening(): JSX.Element {
  useMaintenancePortalDomHardening();

  return (
    <>
      <SelectedSkillContextBridge />
      <style>{`
        [data-vorta-maintenance-portal="true"] {
          min-width: 0;
        }

        [data-vorta-maintenance-portal="true"] *,
        [data-vorta-maintenance-portal="true"] *::before,
        [data-vorta-maintenance-portal="true"] *::after {
          min-width: 0;
        }

        [data-vorta-maintenance-portal="true"] [class*="text-[9px]"],
        [data-vorta-maintenance-portal="true"] [class*="text-[10px]"],
        [data-vorta-maintenance-portal="true"] [class*="text-[11px]"] {
          font-size: 0.75rem !important;
          line-height: 1rem !important;
        }

        [data-vorta-maintenance-portal="true"] [data-vorta-evidence-label="true"] {
          color: rgb(148 163 184) !important;
          font-size: 0.75rem !important;
          font-weight: 600 !important;
          letter-spacing: 0.04em;
        }

        [data-vorta-maintenance-portal="true"] [data-vorta-operational-state] {
          border-radius: 0.75rem;
          border-width: 1px;
          padding: 1rem;
        }

        [data-vorta-maintenance-portal="true"] [data-vorta-operational-state="loading"] {
          border-color: rgb(59 130 246 / 0.25);
          background: rgb(59 130 246 / 0.055);
        }

        [data-vorta-maintenance-portal="true"] [data-vorta-operational-state="empty"] {
          border-color: rgb(71 85 105 / 0.7);
          background: rgb(15 23 42 / 0.35);
        }

        [data-vorta-maintenance-portal="true"] [data-vorta-operational-state="stale"] {
          border-color: rgb(234 179 8 / 0.3);
          background: rgb(234 179 8 / 0.055);
        }

        [data-vorta-maintenance-portal="true"] [data-vorta-operational-state="error"] {
          border-color: rgb(239 68 68 / 0.3);
          background: rgb(239 68 68 / 0.055);
        }

        [data-vorta-maintenance-portal="true"] main button,
        [data-vorta-maintenance-portal="true"] main [role="button"],
        [data-vorta-maintenance-portal="true"] [role="dialog"] button,
        [data-vorta-maintenance-portal="true"] [role="dialog"] [role="button"] {
          min-height: 2.5rem;
        }

        [data-vorta-maintenance-portal="true"] main td,
        [data-vorta-maintenance-portal="true"] main th,
        [data-vorta-maintenance-portal="true"] [role="dialog"] {
          overflow-wrap: anywhere;
        }

        [data-vorta-maintenance-portal="true"] [role="dialog"] {
          max-height: calc(100dvh - 1rem);
        }

        @media (max-width: 420px) {
          [data-vorta-maintenance-portal="true"] main {
            overflow-x: clip;
          }

          [data-vorta-maintenance-portal="true"] main [class*="grid-cols-2"],
          [data-vorta-maintenance-portal="true"] main [class*="grid-cols-3"],
          [data-vorta-maintenance-portal="true"] main [class*="grid-cols-4"],
          [data-vorta-maintenance-portal="true"] main [class*="grid-cols-5"],
          [data-vorta-maintenance-portal="true"] main [class*="grid-cols-6"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          [data-vorta-maintenance-portal="true"] [role="dialog"] {
            width: calc(100vw - 0.75rem) !important;
            max-width: calc(100vw - 0.75rem) !important;
            margin-inline: auto;
          }

          [data-vorta-maintenance-portal="true"] main [class*="overflow-x-auto"] table {
            min-width: 42rem;
          }
        }

        @media (min-width: 600px) and (max-width: 1024px) {
          [data-vorta-maintenance-portal="true"] main [class*="grid-cols-4"],
          [data-vorta-maintenance-portal="true"] main [class*="grid-cols-5"],
          [data-vorta-maintenance-portal="true"] main [class*="grid-cols-6"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          [data-vorta-maintenance-portal="true"] [role="dialog"] {
            max-width: min(92vw, 48rem) !important;
          }
        }

        @media (min-width: 1366px) {
          [data-vorta-maintenance-portal="true"] main > div {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
