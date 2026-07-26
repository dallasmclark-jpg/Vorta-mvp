import { Navigate } from "react-router-dom";
import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { AiMatchingSection as DemoAiMatchingSection } from "./AiMatchingSection";
import { LiveAiMatchingSection } from "./LiveAiMatchingSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";
const capabilityMatchingEnabled =
  String(import.meta.env.VITE_ENABLE_CAPABILITY_MATCHING ?? "").trim().toLowerCase() === "true";

export function AiMatchingRouteEntry(): JSX.Element {
  if (!capabilityMatchingEnabled) {
    return <Navigate to="/requirements" replace />;
  }

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
