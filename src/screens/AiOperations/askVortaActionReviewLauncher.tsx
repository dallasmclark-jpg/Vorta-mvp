import { createRoot, type Root } from "react-dom/client";
import { AskVortaActionReviewDialog } from "./AskVortaActionReviewDialog";
import type { AskVortaActionReviewContext } from "./askVortaControlledActions";

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

function closeActiveReview(): void {
  activeRoot?.unmount();
  activeRoot = null;
  activeContainer?.remove();
  activeContainer = null;
  document.body.style.removeProperty("overflow");
}

function isHandoverRecommendation(
  context: AskVortaActionReviewContext,
): boolean {
  const actionText = [
    context.action.action,
    context.action.expectedImpact,
    context.action.verification,
  ]
    .join(" ")
    .toLowerCase();

  return /handover|incoming shift|outgoing shift|next shift/.test(actionText);
}

function isPhoneViewport(): boolean {
  return window.matchMedia("(max-width: 768px)").matches;
}

export function openAskVortaActionReviewDialog(
  context: AskVortaActionReviewContext,
): void {
  if (!isHandoverRecommendation(context)) {
    window.alert(
      "Vorta is read-only from SAP. Ask Vorta can recommend the SAP action, but only an existing-work-order shift-handover action can be confirmed in Vorta.",
    );
    return;
  }

  if (isPhoneViewport()) {
    window.alert(
      "The approved mobile Ask Vorta experience remains recommendation-only. Review and confirm the Vorta shift-handover action on tablet or desktop.",
    );
    return;
  }

  closeActiveReview();
  const container = document.createElement("div");
  container.dataset.askVortaControlledAction = "handover-note";
  document.body.appendChild(container);
  document.body.style.overflow = "hidden";
  activeContainer = container;
  activeRoot = createRoot(container);
  activeRoot.render(
    <AskVortaActionReviewDialog
      {...context}
      onClose={closeActiveReview}
    />,
  );
}
