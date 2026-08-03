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

function isSupportedVortaNativeAction(
  context: AskVortaActionReviewContext,
): boolean {
  const actionText = [
    context.action.action,
    context.action.expectedImpact,
    context.action.verification,
  ]
    .join(" ")
    .toLowerCase();

  return (
    /handover|incoming shift|outgoing shift|next shift/.test(actionText) ||
    /spare|stock review|inventory review|replenishment review/.test(actionText)
  );
}

export function openAskVortaActionReviewDialog(
  context: AskVortaActionReviewContext,
): void {
  if (!isSupportedVortaNativeAction(context)) {
    window.alert(
      "Vorta is read-only from SAP. Ask Vorta can recommend the SAP action, but it cannot create a maintenance request or notification.",
    );
    return;
  }

  closeActiveReview();
  const container = document.createElement("div");
  container.dataset.askVortaControlledAction = "true";
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
