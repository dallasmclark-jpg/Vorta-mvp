import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { AiMatchingSection as DemoAiMatchingSection } from "./AiMatchingSection";
import { LiveAiMatchingSection } from "./LiveAiMatchingSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function AiMatchingRouteEntry(): JSX.Element {
  if (isLivePilotMode) return <LiveAiMatchingSection />;

  return (
    <>
      <DemoSimulationBanner
        title="AI Matching workflow"
        description="Accept, dismiss and assignment controls are demonstration interactions. They do not create an audited staffing, deployment or training decision."
      />
      <DemoAiMatchingSection />
    </>
  );
}
