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

export function openAskVortaActionReviewDialog(
  context: AskVortaActionReviewContext,
): void {
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
