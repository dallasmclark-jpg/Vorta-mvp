import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { LiveTrainingSection } from "./LiveTrainingSection";
import { TrainingSection as DemoTrainingSection } from "./TrainingSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function TrainingRouteEntry(): JSX.Element {
  if (isLivePilotMode) return <LiveTrainingSection />;

  return (
    <>
      <DemoSimulationBanner
        title="Training workflow"
        description="Booking approvals, completion changes and plan creation affect this browser session only. No source-system record or provider booking is changed."
      />
      <DemoTrainingSection />
    </>
  );
}
