import { DemoSimulationBanner } from "../../components/DemoSimulationBanner";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { LiveTrainingSection as DesktopLiveTrainingSection } from "./LiveTrainingSection";
import { MobileTrainingSection } from "./MobileTrainingSection";
import { TrainingSection as DesktopDemoTrainingSection } from "./TrainingSection";

const isLivePilotMode =
  String(import.meta.env.VITE_VORTA_DATA_MODE ?? "").trim().toLowerCase() === "live";

function MobileLiveTrainingSection(): JSX.Element {
  return <MobileTrainingSection dataMode="live" />;
}

function MobileDemoTrainingSection(): JSX.Element {
  return (
    <>
      <DemoSimulationBanner
        title="Training workflow"
        description="Training planning on this demonstration page does not change a source-system or provider booking."
      />
      <MobileTrainingSection dataMode="demo" />
    </>
  );
}

export function TrainingRouteEntry(): JSX.Element {
  const isPhone = useMediaQuery("(max-width: 639px)");
  const LiveTrainingSection = isPhone
    ? MobileLiveTrainingSection
    : DesktopLiveTrainingSection;

  if (isLivePilotMode) return <LiveTrainingSection />;
  if (isPhone) return <MobileDemoTrainingSection />;

  return (
    <>
      <DemoSimulationBanner
        title="Training workflow"
        description="Booking approvals, completion changes and plan creation affect this browser session only. No source-system record or provider booking is changed."
      />
      <DesktopDemoTrainingSection />
    </>
  );
}
