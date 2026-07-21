import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { LiveTrainingProvidersSection } from "./LiveTrainingProvidersSection";
import { TrainingProvidersSection as DemoTrainingProvidersSection } from "./TrainingProvidersSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function TrainingProvidersRouteEntry(): JSX.Element {
  if (isLivePilotMode) return <LiveTrainingProvidersSection />;

  return (
    <>
      <DemoSimulationBanner
        title="Provider marketplace workflow"
        description="Shortlists and availability requests are browser-only demonstrations. They do not contact a provider or create a commercial enquiry."
      />
      <DemoTrainingProvidersSection />
    </>
  );
}
