import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { LiveTrainingProvidersSection } from "./LiveTrainingProvidersSection";
import { MobileTrainingProvidersSection } from "./MobileTrainingProvidersSection";
import { TrainingProvidersSection as DemoTrainingProvidersSection } from "./TrainingProvidersSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

export function TrainingProvidersRouteEntry(): JSX.Element {
  const isPhone = useMediaQuery("(max-width: 639px)");

  if (isPhone) {
    return (
      <>
        {!isLivePilotMode ? (
          <DemoSimulationBanner
            title="Provider marketplace workflow"
            description="Provider evidence is real to this demonstration dataset. No provider is contacted and no commercial enquiry is created."
          />
        ) : null}
        <MobileTrainingProvidersSection dataMode={isLivePilotMode ? "live" : "demo"} />
      </>
    );
  }

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
